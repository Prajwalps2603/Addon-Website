import { createHash } from 'node:crypto';
import { Router } from 'express';
import * as z from 'zod';
import { HttpError, badRequest, conflict, notFound } from '../lib/errors.js';
import {
  amountOwedOnline,
  confirmUpiPayment,
  expireStaleOrders,
  getOrderRow,
  loadOrder,
  markPaid,
  paymentInstructionFor,
  tokenMatches,
} from '../lib/orders.js';
import { fromPaise, verifyPaymentSignature, verifyWebhookSignature } from '../lib/razorpay.js';
import { parse } from '../lib/validate.js';
import { orderAccess } from './orders.js';

const orderNumberSchema = z
  .string({ error: 'Enter the order number' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,40}$/, { error: 'Enter the order number' });

const verifySchema = z.object({
  orderNumber: orderNumberSchema,
  razorpay_order_id: z.string({ error: 'Missing payment details' }).trim().min(1).max(100),
  razorpay_payment_id: z.string({ error: 'Missing payment details' }).trim().min(1).max(100),
  razorpay_signature: z.string({ error: 'Missing payment details' }).trim().min(1).max(200),
});

const retrySchema = z.object({
  orderNumber: orderNumberSchema,
  token: z.string().max(200).optional(),
});

const upiConfirmSchema = z.object({
  orderNumber: orderNumberSchema,
  accessToken: z.string({ error: 'Open this page from your order link' }).min(1, { error: 'Open this page from your order link' }).max(200),
  upiReference: z
    .string({ error: 'Enter the 12 digit UPI reference (UTR)' })
    .transform((value) => value.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\d{12}$/, { error: 'Enter the 12 digit UPI reference (UTR) from your UPI app' })),
});

export default function paymentsRoutes(ctx) {
  const router = Router();

  // The checkout handler's response. Trust only the Razorpay order id we stored for this order.
  router.post('/razorpay/verify', (req, res) => {
    const body = parse(verifySchema, req.body);
    const row = getOrderRow(ctx, body.orderNumber);
    if (!row || !row.razorpay_order_id) throw notFound('Order');
    const signed =
      body.razorpay_order_id === row.razorpay_order_id &&
      verifyPaymentSignature(ctx, { orderId: row.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature });
    if (!signed) {
      throw new HttpError(400, 'payment_failed', 'We could not confirm this payment. If money left your account, message us with your order number and we will check.');
    }
    const due = amountOwedOnline(row);
    if (due > 0 || row.razorpay_payment_id !== body.razorpay_payment_id) {
      markPaid(ctx, row.order_number, { amount: due, method: 'razorpay', reference: body.razorpay_payment_id });
    }
    // Only the buyer can hold a valid signature, so this is the buyer's own view.
    res.json(loadOrder(ctx, row.order_number, { includeToken: true }));
  });

  // Razorpay's server-to-server notice. Always 200 once the signature is good, so it is not retried forever.
  router.post('/razorpay/webhook', (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const signature = req.get('x-razorpay-signature') ?? '';
    if (!verifyWebhookSignature(ctx, raw, signature)) throw badRequest('Invalid webhook signature.');

    const eventId = req.get('x-razorpay-event-id') || `body-${createHash('sha256').update(raw).digest('hex')}`;
    if (ctx.db.get('SELECT 1 AS seen FROM webhook_events WHERE event_id = ?', [eventId])) {
      return res.json({ ok: true });
    }

    try {
      handleWebhookEvent(ctx, JSON.parse(raw.toString('utf8')));
      ctx.db.run('INSERT OR IGNORE INTO webhook_events (event_id, created_at) VALUES (?, ?)', [eventId, ctx.now()]);
    } catch (err) {
      console.error(`[razorpay] Webhook ${eventId} could not be handled: ${err?.message ?? err}`);
    }
    return res.json({ ok: true });
  });

  // The buyer closed the Razorpay sheet: the same Razorpay order is offered again.
  router.post('/razorpay/retry', async (req, res) => {
    const body = parse(retrySchema, req.body);
    expireStaleOrders(ctx);
    const { row } = orderAccess(req, body.orderNumber, body.token);
    if (row.status !== 'pending_payment') {
      if (row.status === 'cancelled') throw conflict('This order was cancelled because the payment did not arrive in time. Place it again from your cart.');
      throw conflict('This order is not waiting for a payment.');
    }
    res.json(await paymentInstructionFor(ctx, row));
  });

  // Direct UPI: the buyer reports the UTR. Payment stays 'pending' until an admin checks the statement.
  router.post('/upi/confirm', (req, res) => {
    const body = parse(upiConfirmSchema, req.body);
    const row = getOrderRow(ctx, body.orderNumber);
    if (!row || !tokenMatches(row, body.accessToken)) throw notFound('Order');
    res.json(confirmUpiPayment(ctx, row, body.upiReference));
  });

  return router;
}

/** payment.captured and order.paid: find the order by its stored Razorpay order id and record the money. */
function handleWebhookEvent(ctx, event) {
  if (!event || !['payment.captured', 'order.paid'].includes(event.event)) return;
  const payment = event.payload?.payment?.entity ?? null;
  const razorpayOrder = event.payload?.order?.entity ?? null;
  const razorpayOrderId = payment?.order_id ?? razorpayOrder?.id;
  if (!razorpayOrderId) return;
  const row = ctx.db.get('SELECT * FROM orders WHERE razorpay_order_id = ?', [String(razorpayOrderId)]);
  if (!row) {
    console.warn(`[razorpay] Webhook ${event.event} for unknown Razorpay order ${razorpayOrderId}`);
    return;
  }
  const paise = payment?.amount ?? razorpayOrder?.amount_paid ?? 0;
  markPaid(ctx, row.order_number, { amount: fromPaise(paise), method: 'razorpay', reference: String(payment?.id ?? '') });
}
