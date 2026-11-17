import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../lib/errors.js';
import { randomToken } from '../lib/ids.js';
import { normalizePhone } from '../lib/india.js';
import { toQuote } from '../lib/mappers.js';
import { cartItemsSchema, priceCart, priceCartRequestSchema } from '../lib/pricing.js';
import { estimateShipping } from '../lib/shipping.js';
import { parse, phoneSchema, pincodeSchema } from '../lib/validate.js';

const optionalText = (max) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim().slice(0, max) : ''), z.string());

const leadSchema = z.object({
  token: z.preprocess((value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value) ? value : undefined), z.string().optional()),
  name: optionalText(80),
  phone: phoneSchema,
  // A mistyped email must never cost us the lead: keep it only when it looks like one.
  email: z.preprocess((value) => {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return email.length <= 120 && z.email().safeParse(email).success ? email : '';
  }, z.string()),
  items: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown())),
});

const TOKEN = /^[A-Za-z0-9_-]{1,100}$/;

// Cart, delivery estimate, abandoned-checkout leads and quote links (mounted at /api).
export default function cartRoutes(ctx) {
  const router = Router();

  router.post('/cart/price', (req, res) => {
    const request = parse(priceCartRequestSchema, req.body);
    res.json(priceCart(ctx, request, { user: req.user }));
  });

  router.get('/shipping/estimate', (req, res) => {
    const { pincode } = parse(z.object({ pincode: pincodeSchema }), req.query);
    res.json(estimateShipping(ctx, pincode));
  });

  // Sent once the shopper has typed a valid phone at checkout. Only a bad phone is refused:
  // anything wrong with the cart is stored as best we can, so the shopper never sees an error from it.
  router.post('/checkout/lead', (req, res) => {
    const lead = parse(leadSchema, req.body);
    const phone = normalizePhone(lead.phone) ?? lead.phone;

    let lines = [];
    let total = 0;
    try {
      const items = cartItemsSchema.safeParse(lead.items);
      const cart = priceCart(ctx, { items: items.success ? items.data : [] }, { user: req.user });
      lines = cart.lines;
      total = cart.total;
    } catch (err) {
      console.error('[cart] Could not price a checkout lead', err);
    }

    const now = ctx.now();
    let token = lead.token ?? randomToken();
    try {
      token = ctx.db.tx(() => {
        const existing = lead.token ? ctx.db.get('SELECT id, status FROM checkout_leads WHERE token = ?', [lead.token]) : null;
        // A recovered lead belongs to its order: a new checkout starts a new lead.
        if (existing && existing.status !== 'recovered') {
          ctx.db.run(
            `UPDATE checkout_leads SET name = CASE WHEN ? = '' THEN name ELSE ? END, phone = ?,
               email = CASE WHEN ? = '' THEN email ELSE ? END, cart = ?, cart_total = ?, updated_at = ? WHERE id = ?`,
            [lead.name, lead.name, phone, lead.email, lead.email, lines, total, now, existing.id],
          );
          return lead.token;
        }
        const fresh = randomToken();
        ctx.db.run(
          `INSERT INTO checkout_leads (token, name, phone, email, cart, cart_total, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
          [fresh, lead.name, phone, lead.email, lines, total, now, now],
        );
        return fresh;
      });
    } catch (err) {
      console.error('[cart] Could not save a checkout lead', err);
    }
    res.json({ token });
  });

  router.get('/quotes/:token', (req, res) => {
    const { token } = req.params;
    if (!TOKEN.test(token)) throw notFound('Quote');
    const row = ctx.db.get('SELECT * FROM quotes WHERE token = ?', [token]);
    if (!row) throw notFound('Quote');
    const cart = priceCart(ctx, { items: [], quoteToken: token }, { user: req.user });
    res.json(toQuote(row, { cart, now: ctx.now() }));
  });

  return router;
}
