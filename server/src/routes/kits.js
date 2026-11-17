import { Router } from 'express';
import * as z from 'zod';
import { getProductRowsByIds } from '../lib/catalog.js';
import { badRequest } from '../lib/errors.js';
import { randomToken } from '../lib/ids.js';
import { buildKits, KIT_BUDGET_MAX, KIT_BUDGET_MIN, KIT_GOALS } from '../lib/kits.js';
import { limiters } from '../lib/rateLimit.js';
import { parse, phoneSchema } from '../lib/validate.js';

const BODY_TYPES = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'];
const MAX_KIT_PRODUCTS = 40;

const goalSchema = z.enum(KIT_GOALS, { error: 'Choose what the kit is for.' });
const budgetSchema = z
  .number({ error: 'Enter your budget in rupees.' })
  .int({ error: 'Enter your budget in whole rupees.' })
  .min(KIT_BUDGET_MIN, { error: `The smallest budget we plan for is ₹${KIT_BUDGET_MIN}.` })
  .max(KIT_BUDGET_MAX, { error: 'The largest budget we plan for is ₹5,00,000.' });
const productIdSchema = z.int({ error: 'That product id is not valid.' }).positive({ error: 'That product id is not valid.' });

const kitRequestSchema = z.object({
  goal: goalSchema,
  budget: budgetSchema,
  vehicleId: productIdSchema.nullish(),
  bodyType: z.enum(BODY_TYPES).nullish(),
  exclude: z.array(productIdSchema).max(500).default([]),
});

// 'YYYY-MM-DD' that is a real calendar day.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Enter a valid date.' })
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, { error: 'Enter a valid date.' });

const saveKitSchema = z.object({
  name: z.string({ error: 'Enter your name.' }).trim().min(2, { error: 'Enter your name.' }).max(80),
  phone: phoneSchema,
  vehicleLabel: z.string().trim().max(120).default(''),
  goal: goalSchema,
  budget: budgetSchema,
  dealerQuote: z.int({ error: 'Enter the dealer quote in whole rupees.' }).min(0).max(10000000).optional(),
  deliveryDate: z.union([isoDate, z.literal('')]).optional(),
  productIds: z
    .array(productIdSchema, { error: 'Pick at least one part.' })
    .min(1, { error: 'Pick at least one part.' })
    .max(MAX_KIT_PRODUCTS),
});

export default function kitsRoutes(ctx) {
  const router = Router();

  router.post('/build', (req, res) => {
    const request = parse(kitRequestSchema, req.body);
    res.json(buildKits(ctx, request));
  });

  router.post('/save', limiters.forms, (req, res) => {
    const input = parse(saveKitSchema, req.body);
    const ids = [...new Set(input.productIds)];
    const rows = getProductRowsByIds(ctx, ids);
    const missing = ids.filter((id) => !rows.get(id)?.is_active);
    if (missing.length > 0) {
      throw badRequest('Some parts in this kit are no longer sold. Build the kit again.', {
        productIds: `Unknown product${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      });
    }
    // The total is worked out here at today's prices; the client never sends one.
    const total = ids.reduce((sum, id) => sum + Number(rows.get(id).sale_price), 0);
    const token = randomToken();
    ctx.db.run(
      `INSERT INTO saved_kits (token, name, phone, vehicle_label, goal, budget, dealer_quote, delivery_date, product_ids, total, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [token, input.name, input.phone, input.vehicleLabel, input.goal, input.budget, input.dealerQuote ?? 0, input.deliveryDate ?? '', ids, total, ctx.now()],
    );
    res.status(201).json({ token });
  });

  return router;
}
