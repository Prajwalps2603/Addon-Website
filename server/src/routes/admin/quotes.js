import { Router } from 'express';
import * as z from 'zod';
import { toIso } from '../../db/index.js';
import { getProductRowsByIds } from '../../lib/catalog.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { randomToken } from '../../lib/ids.js';
import { quoteItems, toAdminQuote, toAdminQuoteItem } from '../../lib/mappers.js';
import { formatINR } from '../../lib/money.js';
import { idParam, paginated, pagination, parse, phoneSchema } from '../../lib/validate.js';

const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

const timestampSchema = z
  .string({ error: 'Enter a valid date.' })
  .trim()
  .max(40)
  .transform((value, check) => {
    // A bare day means the end of that day in India.
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T23:59:59+05:30`) : Date.parse(value);
    if (!Number.isFinite(ms) || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
      check.issues.push({ code: 'custom', message: 'Enter a valid date.', input: value });
      return z.NEVER;
    }
    return toIso(new Date(ms));
  });

const quoteItemSchema = z.object({
  productId: z.coerce.number({ error: 'Choose a product' }).int().positive({ error: 'Choose a product' }),
  variantId: z.preprocess((value) => (value === '' || value === undefined ? null : value), z.coerce.number().int().positive().nullable()),
  qty: z.coerce.number({ error: 'Enter a quantity' }).int({ error: 'Enter a whole number' }).min(1).max(99),
  unitPrice: z.coerce.number({ error: 'Enter a price' }).int({ error: 'Enter whole rupees' }).min(0).max(10_000_000),
});

const quoteInputSchema = z.object({
  customerName: z.string({ error: "Enter the customer's name" }).trim().min(2, { error: "Enter the customer's name" }).max(80),
  phone: z.preprocess((value) => (value === null || value === undefined ? '' : value), z.union([z.literal(''), phoneSchema])),
  note: z.preprocess((value) => value ?? '', z.string().trim().max(1000)),
  items: z.array(quoteItemSchema, { error: 'Add at least one item' }).min(1, { error: 'Add at least one item' }).max(50),
  shippingFee: z.preprocess((value) => (value === '' || value === undefined ? null : value), z.coerce.number().int().min(0).max(100_000).nullable()),
  validUntil: timestampSchema,
});

const QUOTE_STATUSES = ['open', 'ordered', 'cancelled', 'expired'];
const listQuerySchema = z.object({
  status: z.preprocess(blankToUndefined, z.enum(QUOTE_STATUSES).optional()),
});
const createQuerySchema = z.object({
  allowBelowCost: z.preprocess(blankToUndefined, z.enum(['0', '1', 'true', 'false']).optional()),
});

export default function adminQuotesRoutes(ctx) {
  const router = Router();

  /** Product and variant rows for every line of these quotes, in two queries. */
  function lookups(lines) {
    const products = getProductRowsByIds(ctx, lines.map((line) => line.productId));
    const variantIds = [...new Set(lines.map((line) => line.variantId).filter(Boolean))];
    const variants = new Map(
      variantIds.length > 0
        ? ctx.db.all('SELECT * FROM product_variants WHERE id IN (SELECT value FROM json_each(?))', [variantIds]).map((row) => [row.id, row])
        : [],
    );
    return { products, variants };
  }

  function mapQuotes(rows) {
    const { products, variants } = lookups(rows.flatMap((row) => quoteItems(row)));
    const now = ctx.now();
    return rows.map((row) =>
      toAdminQuote(row, {
        items: quoteItems(row).map((item) => {
          const variant = item.variantId ? variants.get(item.variantId) : null;
          return toAdminQuoteItem(item, products.get(item.productId), variant && variant.product_id === item.productId ? variant : null);
        }),
        now,
      }),
    );
  }

  /** Checks every line against the live catalogue and the margin guard. Throws a 400 naming the line. */
  function checkItems(items, { allowBelowCost }) {
    const { products, variants } = lookups(items);
    const seen = new Set();
    items.forEach((item, index) => {
      const at = `items.${index}`;
      const product = products.get(item.productId);
      if (!product || !product.is_active) throw badRequest('One of the items is not an active product.', { [`${at}.productId`]: 'Choose an active product' });
      if (product.custom_kind) {
        throw badRequest(`${product.name} is designed by the customer before buying, so it cannot go on a quote.`, { [`${at}.productId`]: 'Configured parts cannot be quoted' });
      }
      let variant = null;
      if (product.has_variants) {
        variant = item.variantId ? variants.get(item.variantId) : null;
        if (!variant || variant.product_id !== product.id || !variant.is_active) {
          throw badRequest(`Choose a size or finish for ${product.name}.`, { [`${at}.variantId`]: 'Choose an active variant of this product' });
        }
      } else if (item.variantId) {
        throw badRequest(`${product.name} has no variants.`, { [`${at}.variantId`]: 'This product has no variants' });
      }
      const key = `${item.productId}:${item.variantId ?? 0}`;
      if (seen.has(key)) throw badRequest(`${product.name} is on the quote twice. Change the quantity instead.`, { [`${at}.productId`]: 'Already on this quote' });
      seen.add(key);

      const cost = product.cost_price;
      if (!allowBelowCost && cost !== null && cost !== undefined && item.unitPrice < Number(cost)) {
        const name = variant ? `${product.name} (${variant.name})` : product.name;
        throw badRequest(
          `${name} is quoted at ${formatINR(item.unitPrice)}, below its cost price of ${formatINR(cost)}. Raise the price, or confirm a below-cost sale.`,
          { [`${at}.unitPrice`]: `Below cost price of ${formatINR(cost)}` },
        );
      }
    });
  }

  function readInput(req) {
    const input = parse(quoteInputSchema, req.body);
    const { allowBelowCost } = parse(createQuerySchema, req.query);
    if (Date.parse(input.validUntil) <= Date.parse(ctx.now())) {
      throw badRequest('The quote must be valid until a time in the future.', { validUntil: 'Choose a date in the future' });
    }
    checkItems(input.items, { allowBelowCost: allowBelowCost === '1' || allowBelowCost === 'true' });
    return {
      customer_name: input.customerName,
      phone: input.phone,
      note: input.note,
      items: input.items.map(({ productId, variantId, qty, unitPrice }) => ({ productId, variantId: variantId ?? null, qty, unitPrice })),
      shipping_fee: input.shippingFee,
      valid_until: input.validUntil,
    };
  }

  function getQuoteRow(id) {
    return ctx.db.get('SELECT * FROM quotes WHERE id = ?', [id]);
  }

  router.get('/quotes', (req, res) => {
    const { status } = parse(listQuerySchema, req.query);
    const { page, limit } = parse(pagination, req.query);
    const now = ctx.now();
    let where = '';
    const params = {};
    if (status === 'open') {
      where = "WHERE status = 'open' AND julianday(valid_until) > julianday(:now)";
      params.now = now;
    } else if (status === 'expired') {
      where = "WHERE status = 'open' AND julianday(valid_until) <= julianday(:now)";
      params.now = now;
    } else if (status) {
      where = 'WHERE status = :status';
      params.status = status;
    }
    const total = ctx.db.get(`SELECT COUNT(*) AS n FROM quotes ${where}`, params).n;
    const rows = ctx.db.all(`SELECT * FROM quotes ${where} ORDER BY created_at DESC, id DESC LIMIT :pageLimit OFFSET :pageOffset`, {
      ...params,
      pageLimit: limit,
      pageOffset: (page - 1) * limit,
    });
    res.json(paginated(mapQuotes(rows), total, { page, limit }));
  });

  // One quote, so the quote editor can open a link to it directly.
  router.get('/quotes/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const row = getQuoteRow(id);
    if (!row) throw notFound('Quote');
    res.json(mapQuotes([row])[0]);
  });

  router.post('/quotes', (req, res) => {
    const values = readInput(req);
    const id = Number(
      ctx.db.run(
        `INSERT INTO quotes (token, customer_name, phone, note, items, shipping_fee, valid_until, status, created_at)
         VALUES (:token, :customer_name, :phone, :note, :items, :shipping_fee, :valid_until, 'open', :created_at)`,
        { ...values, token: randomToken(), created_at: ctx.now() },
      ).lastInsertRowid,
    );
    res.status(201).json(mapQuotes([getQuoteRow(id)])[0]);
  });

  router.put('/quotes/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const existing = getQuoteRow(id);
    if (!existing) throw notFound('Quote');
    if (existing.status !== 'open') {
      throw conflict(existing.status === 'ordered' ? 'This quote has already been ordered, so it can no longer be changed.' : 'This quote was cancelled, so it can no longer be changed.');
    }
    const values = readInput(req);
    // Guarded on status so a checkout that orders the quote at this moment wins cleanly.
    const { changes } = ctx.db.run(
      `UPDATE quotes SET customer_name = :customer_name, phone = :phone, note = :note, items = :items,
         shipping_fee = :shipping_fee, valid_until = :valid_until
       WHERE id = :id AND status = 'open'`,
      { ...values, id },
    );
    if (changes === 0) throw conflict('This quote has just been ordered or cancelled, so it can no longer be changed.');
    res.json(mapQuotes([getQuoteRow(id)])[0]);
  });

  router.delete('/quotes/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const existing = getQuoteRow(id);
    if (!existing) throw notFound('Quote');
    if (existing.status === 'ordered') throw conflict('This quote has already been ordered, so it cannot be cancelled. Cancel the order instead.');
    if (existing.status === 'open') {
      const { changes } = ctx.db.run("UPDATE quotes SET status = 'cancelled' WHERE id = ? AND status = 'open'", [id]);
      if (changes === 0) throw conflict('This quote has just been ordered, so it cannot be cancelled. Cancel the order instead.');
    }
    res.json({ ok: true });
  });

  return router;
}
