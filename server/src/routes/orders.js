import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../lib/errors.js';
import { cancelOrder, createOrder, getOrderRow, loadOrder, tokenMatches } from '../lib/orders.js';
import { limiters } from '../lib/rateLimit.js';
import { parse, phoneSchema } from '../lib/validate.js';

const ORDER_NUMBER = /^[A-Za-z0-9-]{4,40}$/;

const orderNumberSchema = z
  .string({ error: 'Enter the order number' })
  .trim()
  .toUpperCase()
  .regex(ORDER_NUMBER, { error: 'Enter the order number as printed, e.g. ADN-261117-4F7K' });

const trackSchema = z.object({ orderNumber: orderNumberSchema, phone: phoneSchema });
const tokenQuerySchema = z.object({ token: z.string().max(200).optional() });
const cancelSchema = z.object({
  token: z.string().max(200).optional(),
  reason: z.preprocess((value) => value ?? '', z.string().trim().max(300)),
});

/**
 * Who may see or act on an order: its owner, an admin, or anyone holding its access token.
 * Everyone else gets the same 404 as for an order that does not exist, so numbers cannot be probed.
 * Returns { row, isBuyer, isAdmin }.
 */
export function orderAccess(req, orderNumber, token) {
  const number = typeof orderNumber === 'string' ? orderNumber.trim().toUpperCase() : '';
  const row = ORDER_NUMBER.test(number) ? getOrderRow(req.app.locals.ctx, number) : null;
  if (!row) throw notFound('Order');
  const isOwner = Boolean(req.user && row.user_id && req.user.id === row.user_id);
  const hasToken = tokenMatches(row, token);
  const isAdmin = req.user?.role === 'admin';
  if (!isOwner && !hasToken && !isAdmin) throw notFound('Order');
  return { row, isBuyer: isOwner || hasToken, isAdmin };
}

export default function ordersRoutes(ctx) {
  const router = Router();

  router.post('/', async (req, res) => {
    const { order, payment, created } = await createOrder(ctx, req.body, { user: req.user ?? null });
    res.status(created ? 201 : 200).json({ order, payment });
  });

  router.get('/track', limiters.lookup, (req, res) => {
    const query = parse(trackSchema, req.query);
    const row = getOrderRow(ctx, query.orderNumber);
    const last10 = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);
    if (!row || (last10(row.phone) !== query.phone && last10(row.ship_phone) !== query.phone)) throw notFound('Order');
    res.json(loadOrder(ctx, row.order_number));
  });

  router.get('/:orderNumber', (req, res) => {
    const { token } = parse(tokenQuerySchema, req.query);
    const { row, isBuyer } = orderAccess(req, req.params.orderNumber, token);
    res.json(loadOrder(ctx, row.order_number, { includeToken: isBuyer }));
  });

  router.post('/:orderNumber/cancel', (req, res) => {
    const body = parse(cancelSchema, req.body);
    const { row, isBuyer, isAdmin } = orderAccess(req, req.params.orderNumber, body.token);
    const actor = isBuyer ? 'customer' : isAdmin ? 'admin' : 'customer';
    // The storefront cancel follows the buyer's rule (before packing) even for an admin.
    cancelOrder(ctx, row.order_number, { actor, reason: body.reason, rules: 'customer' });
    res.json(loadOrder(ctx, row.order_number, { includeToken: isBuyer }));
  });

  return router;
}
