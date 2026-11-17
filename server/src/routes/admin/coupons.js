import { Router } from 'express';
import * as z from 'zod';
import { toIso } from '../../db/index.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { toCoupon } from '../../lib/mappers.js';
import { idParam, parse } from '../../lib/validate.js';

const nullish = (value) => (value === '' || value === undefined ? null : value);

/** An optional timestamp: null, a bare day ('YYYY-MM-DD', start of that day in India) or a full ISO timestamp. */
const optionalTimestamp = z.preprocess(
  nullish,
  z
    .string({ error: 'Enter a valid date.' })
    .trim()
    .max(40)
    .transform((value, check) => {
      const ms = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00+05:30`) : Date.parse(value);
      if (!Number.isFinite(ms) || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
        check.issues.push({ code: 'custom', message: 'Enter a valid date.', input: value });
        return z.NEVER;
      }
      return toIso(new Date(ms));
    })
    .nullable(),
);

const couponInputSchema = z
  .object({
    code: z
      .string({ error: 'Enter a code' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,19}$/, { error: 'Use 3 to 20 letters, numbers, - or _' }),
    description: z.preprocess((value) => value ?? '', z.string().trim().max(200)),
    type: z.enum(['percent', 'flat', 'free_shipping'], { error: 'Choose percent, flat or free shipping' }),
    value: z.preprocess((value) => (value === '' || value === null || value === undefined ? 0 : value), z.coerce.number().int({ error: 'Enter whole numbers' }).min(0)),
    minOrder: z.preprocess((value) => (value === '' || value === null || value === undefined ? 0 : value), z.coerce.number().int().min(0).max(10_000_000)),
    maxDiscount: z.preprocess(nullish, z.coerce.number().int().min(1).max(10_000_000).nullable()),
    startsAt: optionalTimestamp,
    endsAt: optionalTimestamp,
    usageLimit: z.preprocess(nullish, z.coerce.number().int().min(1).max(10_000_000).nullable()),
    isActive: z.boolean().default(true),
  })
  .superRefine((input, check) => {
    if (input.type === 'percent' && (input.value < 1 || input.value > 100)) {
      check.addIssue({ code: 'custom', path: ['value'], message: 'A percent coupon takes 1 to 100.' });
    }
    if (input.type === 'flat' && (input.value < 1 || input.value > 1_000_000)) {
      check.addIssue({ code: 'custom', path: ['value'], message: 'Enter the rupees off, 1 or more.' });
    }
    if (input.type === 'flat' && input.minOrder > 0 && input.value >= input.minOrder) {
      check.addIssue({ code: 'custom', path: ['value'], message: 'The amount off must be less than the minimum order.' });
    }
    if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      check.addIssue({ code: 'custom', path: ['endsAt'], message: 'The end must be after the start.' });
    }
  })
  .transform((input) => ({
    ...input,
    // Free shipping has no value, and only a percent coupon has a cap.
    value: input.type === 'free_shipping' ? 0 : input.value,
    maxDiscount: input.type === 'percent' ? input.maxDiscount : null,
  }));

function isUniqueViolation(err) {
  return err?.errcode === 2067 || /UNIQUE constraint failed/i.test(String(err?.message));
}

export default function adminCouponsRoutes(ctx) {
  const router = Router();

  const getRow = (id) => ctx.db.get('SELECT * FROM coupons WHERE id = ?', [id]);

  function columns(input) {
    return {
      code: input.code,
      description: input.description,
      type: input.type,
      value: input.value,
      min_order: input.minOrder,
      max_discount: input.maxDiscount,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      usage_limit: input.usageLimit,
      is_active: input.isActive,
    };
  }

  function duplicate(code) {
    return conflict(`The code ${code} is already in use.`);
  }

  router.get('/coupons', (req, res) => {
    const rows = ctx.db.all('SELECT * FROM coupons ORDER BY is_active DESC, created_at DESC, id DESC');
    res.json(rows.map(toCoupon));
  });

  router.post('/coupons', (req, res) => {
    const input = parse(couponInputSchema, req.body);
    if (ctx.db.get('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE', [input.code])) throw duplicate(input.code);
    let id;
    try {
      id = Number(
        ctx.db.run(
          `INSERT INTO coupons (code, description, type, value, min_order, max_discount, starts_at, ends_at, usage_limit, is_active, created_at)
           VALUES (:code, :description, :type, :value, :min_order, :max_discount, :starts_at, :ends_at, :usage_limit, :is_active, :created_at)`,
          { ...columns(input), created_at: ctx.now() },
        ).lastInsertRowid,
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate(input.code);
      throw err;
    }
    res.status(201).json(toCoupon(getRow(id)));
  });

  router.put('/coupons/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const existing = getRow(id);
    if (!existing) throw notFound('Coupon');
    const input = parse(couponInputSchema, req.body);
    if (input.usageLimit !== null && input.usageLimit < Number(existing.used_count)) {
      throw badRequest(`This code has already been used ${existing.used_count} times.`, { usageLimit: `At least ${existing.used_count}, the times already used` });
    }
    if (ctx.db.get('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE AND id <> ?', [input.code, id])) throw duplicate(input.code);
    try {
      ctx.db.run(
        `UPDATE coupons SET code = :code, description = :description, type = :type, value = :value, min_order = :min_order,
           max_discount = :max_discount, starts_at = :starts_at, ends_at = :ends_at, usage_limit = :usage_limit, is_active = :is_active
         WHERE id = :id`,
        { ...columns(input), id },
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw duplicate(input.code);
      throw err;
    }
    res.json(toCoupon(getRow(id)));
  });

  router.delete('/coupons/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    // Orders keep the code as text, so deleting a coupon never touches order history.
    const { changes } = ctx.db.run('DELETE FROM coupons WHERE id = ?', [id]);
    if (changes === 0) throw notFound('Coupon');
    res.json({ ok: true });
  });

  return router;
}
