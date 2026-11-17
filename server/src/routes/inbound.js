import { Router } from 'express';
import * as z from 'zod';
import { getProductRow } from '../lib/catalog.js';
import { badRequest, notFound } from '../lib/errors.js';
import { ticketNumber } from '../lib/ids.js';
import { toEnquiry } from '../lib/mappers.js';
import * as notify from '../lib/notify.js';
import { limiters } from '../lib/rateLimit.js';
import { emailSchema, idParam, parse, phoneSchema } from '../lib/validate.js';

const ENQUIRY_KINDS = ['contact', 'complaint', 'bulk', 'install', 'return'];

// Forms send '' for a field left blank: treat it as absent.
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);
const optionalPhone = z.preprocess(blankToUndefined, phoneSchema.optional());
const optionalEmail = z.preprocess(blankToUndefined, emailSchema.optional());
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value ?? '');

const CONTACT_MESSAGE = 'Give a mobile number or an email so we can reply.';
function needsContact(input, zctx) {
  if (input.phone || input.email) return;
  zctx.addIssue({ code: 'custom', path: ['phone'], message: CONTACT_MESSAGE });
  zctx.addIssue({ code: 'custom', path: ['email'], message: CONTACT_MESSAGE });
}

const enquirySchema = z
  .object({
    kind: z.preprocess(blankToUndefined, z.enum(ENQUIRY_KINDS).default('contact')),
    name: z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(80),
    phone: optionalPhone,
    email: optionalEmail,
    subject: optionalText(120),
    message: z
      .string({ error: 'Type your message' })
      .trim()
      .min(5, { error: 'Type your message' })
      .max(4000, { error: 'Keep the message to 4000 characters or fewer.' }),
    productId: z.preprocess(blankToUndefined, idParam.optional()),
    orderNumber: optionalText(40).transform((value) => value.toUpperCase()),
    vehicle: optionalText(80),
  })
  .superRefine(needsContact);

const stockAlertSchema = z
  .object({
    productId: idParam,
    variantId: z.preprocess(blankToUndefined, idParam.optional()).transform((value) => value ?? null),
    phone: optionalPhone,
    email: optionalEmail,
  })
  .superRefine(needsContact);

export default function inboundRoutes(ctx) {
  const router = Router();

  router.post('/enquiries', limiters.forms, (req, res) => {
    const input = parse(enquirySchema, req.body);
    let productName = '';
    if (input.productId !== undefined) {
      const product = getProductRow(ctx, input.productId);
      if (!product) throw badRequest('That product was not found.', { productId: 'That product was not found' });
      productName = product.name;
    }

    const now = ctx.now();
    const enquiryId = ctx.db.tx(() => {
      const number = ticketNumber(ctx);
      return ctx.db.run(
        `INSERT INTO enquiries (ticket_number, kind, name, phone, email, subject, message, product_id, order_number, vehicle,
           status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
        [
          number,
          input.kind,
          input.name,
          input.phone ?? '',
          input.email ?? '',
          input.subject,
          input.message,
          input.productId ?? null,
          input.orderNumber,
          input.vehicle,
          now,
          now,
        ],
      ).lastInsertRowid;
    });

    const enquiry = toEnquiry({ ...ctx.db.get('SELECT * FROM enquiries WHERE id = ?', [enquiryId]), product_name: productName || null });
    // The customer's copy (when they gave an email) and the shop's notification. It never throws and
    // the reply does not wait on the mail server.
    notify.enquiryReceived(ctx, enquiry);

    res.status(201).json({ ticketNumber: enquiry.ticketNumber });
  });

  router.post('/stock-alerts', limiters.forms, (req, res) => {
    const input = parse(stockAlertSchema, req.body);
    const product = getProductRow(ctx, input.productId);
    if (!product || !product.is_active) throw notFound('Product');
    if (input.variantId !== null) {
      const variant = ctx.db.get('SELECT id FROM product_variants WHERE id = ? AND product_id = ?', [input.variantId, product.id]);
      if (!variant) throw badRequest('Choose one of the listed options.', { variantId: 'Choose one of the listed options' });
    }
    const phone = input.phone ?? '';
    const email = input.email ?? '';

    ctx.db.tx(() => {
      // The same person asking again for the same part (and option) joins their earlier request.
      const existing = ctx.db.get(
        `SELECT id, phone, email FROM stock_alerts
          WHERE product_id = :productId AND variant_id IS :variantId AND status = 'waiting'
            AND ((:phone <> '' AND phone = :phone) OR (:email <> '' AND email = :email COLLATE NOCASE))
          ORDER BY id LIMIT 1`,
        { productId: product.id, variantId: input.variantId, phone, email },
      );
      if (existing) {
        ctx.db.run('UPDATE stock_alerts SET phone = ?, email = ? WHERE id = ?', [
          existing.phone || phone,
          existing.email || email,
          existing.id,
        ]);
      } else {
        ctx.db.run(
          "INSERT INTO stock_alerts (product_id, variant_id, phone, email, status, created_at) VALUES (?, ?, ?, ?, 'waiting', ?)",
          [product.id, input.variantId, phone, email, ctx.now()],
        );
      }
    });
    res.status(201).json({ ok: true });
  });

  return router;
}
