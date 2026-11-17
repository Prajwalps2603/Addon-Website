import { Router } from 'express';
import * as z from 'zod';
import { hashPassword, requireAuth, verifyPassword } from '../lib/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { toAddress, toGarageEntry, toUser } from '../lib/mappers.js';
import { ordersFromRows } from '../lib/orders.js';
import { addressSchema, idParam, parse, passwordSchema, phoneSchema } from '../lib/validate.js';
import { nameSchema } from './auth.js';

const USER_COLUMNS = 'id, name, email, phone, role, created_at, updated_at';
const MAX_WISHLIST = 500;
const MAX_GARAGE = 20;

const profileSchema = z.object({ name: nameSchema, phone: phoneSchema });

const passwordChangeSchema = z.object({
  currentPassword: z.string({ error: 'Enter your current password' }).min(1, { error: 'Enter your current password' }).max(200),
  newPassword: passwordSchema,
});

const positiveId = z.number({ error: 'That id is not valid' }).int({ error: 'That id is not valid' }).positive({ error: 'That id is not valid' });

const wishlistSchema = z.object({
  productIds: z.array(positiveId).max(MAX_WISHLIST, { error: `Keep the saved list to ${MAX_WISHLIST} parts or fewer` }),
});

const garageSchema = z.object({
  vehicles: z
    .array(
      z.object({
        vehicleId: positiveId,
        year: z.number().int().min(1950).max(2100).nullable().default(null),
        nickname: z.string().trim().max(40).default(''),
        isActive: z.boolean().default(false),
      }),
    )
    .max(MAX_GARAGE, { error: `Keep the garage to ${MAX_GARAGE} cars or fewer` }),
});

const GARAGE_SELECT = `SELECT uv.vehicle_id, uv.year, uv.nickname, uv.is_active, v.*
  FROM user_vehicles uv JOIN vehicles v ON v.id = uv.vehicle_id
  WHERE uv.user_id = ? ORDER BY uv.id`;

export default function accountRoutes(ctx) {
  const router = Router();
  router.use(requireAuth);

  const { db } = ctx;
  const listAddresses = (userId) =>
    db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]).map(toAddress);
  const ownAddress = (userId, rawId) => {
    const id = parse(idParam, rawId);
    const row = db.get('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [id, userId]);
    // Someone else's address answers exactly like a missing one.
    if (!row) throw notFound('Address');
    return row;
  };
  const wishlistIds = (userId) =>
    db
      .all('SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY created_at, rowid', [userId])
      .map((row) => row.product_id);
  const garage = (userId) => db.all(GARAGE_SELECT, [userId]).map(toGarageEntry);

  // ---------------------------------------------------------------------------
  // Profile and password
  // ---------------------------------------------------------------------------

  router.put('/profile', (req, res) => {
    const { name, phone } = parse(profileSchema, req.body);
    db.run('UPDATE users SET name = ?, phone = ?, updated_at = ? WHERE id = ?', [name, phone, ctx.now(), req.user.id]);
    res.json({ user: toUser(db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [req.user.id])) });
  });

  router.put('/password', async (req, res) => {
    const { currentPassword, newPassword } = parse(passwordChangeSchema, req.body);
    const row = db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(currentPassword, row?.password_hash ?? null))) {
      throw badRequest('The current password is not right.', { currentPassword: 'The current password is not right.' });
    }
    const passwordHash = await hashPassword(newPassword);
    // A pending reset link would otherwise still undo this change.
    db.run(
      'UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = ? WHERE id = ?',
      [passwordHash, ctx.now(), req.user.id],
    );
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Orders: the same Order shape as the order page (delivery estimate and studio booking included),
  // loaded in a fixed number of queries however many orders there are
  // ---------------------------------------------------------------------------

  router.get('/orders', (req, res) => {
    const rows = db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC', [req.user.id]);
    res.json(ordersFromRows(ctx, rows, { includeToken: true }));
  });

  // ---------------------------------------------------------------------------
  // Addresses: at most one default per user, and the first one saved is it
  // ---------------------------------------------------------------------------

  router.get('/addresses', (req, res) => {
    res.json(listAddresses(req.user.id));
  });

  router.post('/addresses', (req, res) => {
    const input = parse(addressSchema, req.body);
    const userId = req.user.id;
    const row = db.tx(() => {
      const hasAny = Boolean(db.get('SELECT 1 AS found FROM addresses WHERE user_id = ? LIMIT 1', [userId]));
      const isDefault = input.isDefault || !hasAny;
      if (isDefault) db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
      const id = db.run(
        `INSERT INTO addresses (user_id, label, name, phone, line1, line2, landmark, city, state, pincode, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, input.label, input.name, input.phone, input.line1, input.line2, input.landmark, input.city, input.state, input.pincode, isDefault, ctx.now()],
      ).lastInsertRowid;
      return db.get('SELECT * FROM addresses WHERE id = ?', [id]);
    });
    res.status(201).json(toAddress(row));
  });

  router.put('/addresses/:id', (req, res) => {
    const userId = req.user.id;
    const existing = ownAddress(userId, req.params.id);
    const input = parse(addressSchema, req.body);
    const row = db.tx(() => {
      if (input.isDefault) db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ? AND id <> ?', [userId, existing.id]);
      db.run(
        `UPDATE addresses SET label = ?, name = ?, phone = ?, line1 = ?, line2 = ?, landmark = ?, city = ?, state = ?, pincode = ?, is_default = ?
         WHERE id = ? AND user_id = ?`,
        [input.label, input.name, input.phone, input.line1, input.line2, input.landmark, input.city, input.state, input.pincode, input.isDefault, existing.id, userId],
      );
      return db.get('SELECT * FROM addresses WHERE id = ?', [existing.id]);
    });
    res.json(toAddress(row));
  });

  router.delete('/addresses/:id', (req, res) => {
    const userId = req.user.id;
    const existing = ownAddress(userId, req.params.id);
    db.tx(() => {
      db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [existing.id, userId]);
      if (existing.is_default) {
        // Hand the default to the newest address left, so checkout still has one to pre-fill.
        db.run(
          `UPDATE addresses SET is_default = 1
           WHERE id = (SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1)`,
          [userId],
        );
      }
    });
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Wishlist
  // ---------------------------------------------------------------------------

  router.get('/wishlist', (req, res) => {
    res.json({ productIds: wishlistIds(req.user.id) });
  });

  router.put('/wishlist', (req, res) => {
    const { productIds } = parse(wishlistSchema, req.body);
    const userId = req.user.id;
    const unique = [...new Set(productIds)];
    const known = new Set(
      db.all('SELECT id FROM products WHERE id IN (SELECT value FROM json_each(?))', [unique]).map((row) => row.id),
    );
    const now = ctx.now();
    db.tx(() => {
      db.run('DELETE FROM wishlist_items WHERE user_id = ?', [userId]);
      for (const productId of unique) {
        if (known.has(productId)) {
          db.run('INSERT INTO wishlist_items (user_id, product_id, created_at) VALUES (?, ?, ?)', [userId, productId, now]);
        }
      }
    });
    res.json({ productIds: wishlistIds(userId) });
  });

  // ---------------------------------------------------------------------------
  // Garage: exactly one active car whenever there is any
  // ---------------------------------------------------------------------------

  router.get('/garage', (req, res) => {
    res.json(garage(req.user.id));
  });

  router.put('/garage', (req, res) => {
    const { vehicles } = parse(garageSchema, req.body);
    const userId = req.user.id;
    const known = new Set(
      db
        .all('SELECT id FROM vehicles WHERE id IN (SELECT value FROM json_each(?))', [vehicles.map((entry) => entry.vehicleId)])
        .map((row) => row.id),
    );
    const seen = new Set();
    const entries = [];
    for (const entry of vehicles) {
      const key = `${entry.vehicleId}|${entry.year ?? ''}`;
      if (!known.has(entry.vehicleId) || seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
    const activeIndex = Math.max(0, entries.findIndex((entry) => entry.isActive));

    const now = ctx.now();
    db.tx(() => {
      db.run('DELETE FROM user_vehicles WHERE user_id = ?', [userId]);
      entries.forEach((entry, index) => {
        db.run(
          'INSERT INTO user_vehicles (user_id, vehicle_id, year, nickname, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, entry.vehicleId, entry.year, entry.nickname, index === activeIndex, now],
        );
      });
    });
    res.json(garage(userId));
  });

  return router;
}
