import { Router } from 'express';
import * as z from 'zod';
import { toIso } from '../../db/index.js';
import { getProductsByIds } from '../../lib/catalog.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { toAdminDrop } from '../../lib/mappers.js';
import { idParam, parse } from '../../lib/validate.js';

const MAX_ITEMS = 8;

const timestamp = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) && !Number.isNaN(Date.parse(value)), { error: 'Enter a valid date and time.' })
  .transform((value) => toIso(value));

const dropSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    note: z.string().trim().max(500).default(''),
    startsAt: timestamp,
    endsAt: timestamp,
    isActive: z.boolean().default(true),
    items: z
      .array(
        z.object({
          productId: z.int().positive(),
          percentOff: z.int({ error: 'Enter a whole percent from 1 to 90.' }).min(1).max(90),
          reason: z.string().trim().max(200).default(''),
        }),
      )
      .min(1)
      .max(MAX_ITEMS),
  })
  .superRefine((input, ctx) => {
    if (input.endsAt <= input.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The drop must end after it starts.' });
    const seen = new Set();
    input.items.forEach((item, index) => {
      if (seen.has(item.productId)) ctx.addIssue({ code: 'custom', path: ['items', index, 'productId'], message: 'This product is already in the drop.' });
      seen.add(item.productId);
    });
  });

/** AdminDrop[] for drops rows, with every item's product read in one query. */
function mapDrops(ctx, rows) {
  if (rows.length === 0) return [];
  const items = ctx.db.all(
    'SELECT * FROM drop_items WHERE drop_id IN (SELECT value FROM json_each(?)) ORDER BY rowid',
    [rows.map((row) => row.id)],
  );
  const products = new Map(
    getProductsByIds(ctx, items.map((item) => item.product_id), { includeInactive: true }).map((product) => [product.id, product]),
  );
  const byDrop = new Map();
  for (const item of items) {
    const list = byDrop.get(item.drop_id) ?? [];
    list.push({ ...item, product: products.get(item.product_id) });
    byDrop.set(item.drop_id, list);
  }
  const now = ctx.now();
  return rows.map((row) => toAdminDrop(row, byDrop.get(row.id) ?? [], now));
}

function loadDrop(ctx, id) {
  const row = ctx.db.get('SELECT * FROM drops WHERE id = ?', [id]);
  if (!row) throw notFound('Drop');
  return mapDrops(ctx, [row])[0];
}

/** Writes the drop and its items; returns the ids of other active drops it switched off. Runs inside a transaction. */
function saveDrop(ctx, input, id) {
  const { db } = ctx;
  const products = new Map(
    db.all('SELECT id, is_active FROM products WHERE id IN (SELECT value FROM json_each(?))', [input.items.map((item) => item.productId)]).map((row) => [
      row.id,
      row,
    ]),
  );
  const fields = {};
  input.items.forEach((item, index) => {
    const product = products.get(item.productId);
    if (!product) fields[`items.${index}.productId`] = 'That product does not exist.';
    else if (!product.is_active) fields[`items.${index}.productId`] = 'That product is hidden from the shop.';
  });
  if (Object.keys(fields).length > 0) throw badRequest('Check the parts in this drop.', fields);

  const values = { title: input.title, note: input.note, startsAt: input.startsAt, endsAt: input.endsAt, isActive: input.isActive };
  let dropId = id;
  if (dropId === null) {
    dropId = Number(
      db.run('INSERT INTO drops (title, note, starts_at, ends_at, is_active, created_at) VALUES (:title, :note, :startsAt, :endsAt, :isActive, :createdAt)', {
        ...values,
        createdAt: ctx.now(),
      }).lastInsertRowid,
    );
  } else {
    db.run('UPDATE drops SET title = :title, note = :note, starts_at = :startsAt, ends_at = :endsAt, is_active = :isActive WHERE id = :id', {
      ...values,
      id: dropId,
    });
    db.run('DELETE FROM drop_items WHERE drop_id = ?', [dropId]);
  }
  for (const item of input.items) {
    db.run('INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, ?, ?)', [dropId, item.productId, item.percentOff, item.reason]);
  }

  // Only one drop runs at a time: switching this one on switches off any other whose window overlaps it.
  let deactivated = [];
  if (input.isActive) {
    deactivated = db
      .all('SELECT id FROM drops WHERE is_active = 1 AND id <> ? AND starts_at < ? AND ends_at > ? ORDER BY id', [dropId, input.endsAt, input.startsAt])
      .map((row) => row.id);
    if (deactivated.length > 0) {
      db.run('UPDATE drops SET is_active = 0 WHERE id IN (SELECT value FROM json_each(?))', [deactivated]);
    }
  }
  return { dropId, deactivated };
}

function respond(ctx, res, status, { dropId, deactivated }) {
  // AdminDrop plus the ids of the drops this one switched off, so the admin can say so.
  res.setHeader('X-Deactivated-Drops', deactivated.join(','));
  res.status(status).json({ ...loadDrop(ctx, dropId), deactivatedDropIds: deactivated });
}

export default function adminDropsRoutes(ctx) {
  const router = Router();

  router.get('/drops', (req, res) => {
    res.json(mapDrops(ctx, ctx.db.all('SELECT * FROM drops ORDER BY starts_at DESC, id DESC')));
  });

  router.get('/drops/:id', (req, res) => {
    res.json(loadDrop(ctx, parse(idParam, req.params.id)));
  });

  router.post('/drops', (req, res) => {
    const input = parse(dropSchema, req.body);
    respond(ctx, res, 201, ctx.db.tx(() => saveDrop(ctx, input, null)));
  });

  router.put('/drops/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(dropSchema, req.body);
    const result = ctx.db.tx(() => {
      if (!ctx.db.get('SELECT id FROM drops WHERE id = ?', [id])) throw notFound('Drop');
      return saveDrop(ctx, input, id);
    });
    respond(ctx, res, 200, result);
  });

  router.delete('/drops/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    if (ctx.db.run('DELETE FROM drops WHERE id = ?', [id]).changes === 0) throw notFound('Drop');
    res.json({ ok: true });
  });

  return router;
}
