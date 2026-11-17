import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import * as z from 'zod';
import { getProductRow, getVehicleRow } from '../lib/catalog.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { toQuestion, toReport, vehicleLabel } from '../lib/mappers.js';
import { limiters } from '../lib/rateLimit.js';
import { imageUpload, saveImages } from '../lib/uploads.js';
import { idParam, paginationOf, parse, phoneSchema } from '../lib/validate.js';

const FITTERS = ['self', 'local_garage', 'dealer', 'not_fitted'];
const MAX_PHOTOS = 3;
// saveImages names files with 12 random bytes in hex: /uploads/<24 hex>.webp
const UPLOAD_URL = /^\/uploads\/([a-f0-9]{24})\.webp$/;
const MAX_PUBLIC_QUESTIONS = 100;

const reportsPage = paginationOf({ defaultLimit: 10, maxLimit: 50 });

// Optional free text: a missing value or null becomes ''.
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value ?? '');

// An optional whole number in a range; null and absence both mean "not given".
const optionalInt = (min, max) => z.number().int().min(min).max(max).nullish().transform((value) => value ?? null);

const reportSchema = z
  .object({
    authorName: z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(60),
    vehicle: z.string({ error: 'Tell us which car you fitted it to' }).trim().min(2, { error: 'Tell us which car you fitted it to' }).max(80),
    rating: z.number({ error: 'Choose a rating from 1 to 5' }).int().min(1, { error: 'Choose a rating from 1 to 5' }).max(5, { error: 'Choose a rating from 1 to 5' }),
    fittedBy: z.enum(FITTERS, { error: 'Choose who fitted it' }),
    timeMinutes: optionalInt(1, 24 * 60),
    difficulty: optionalInt(1, 5),
    fittedOk: z.boolean({ error: 'Tell us whether it fitted without problems' }),
    issues: optionalText(1000),
    body: optionalText(2000),
    photos: z
      .array(z.string().trim().regex(UPLOAD_URL, { error: 'Upload the photo again.' }))
      .max(MAX_PHOTOS, { error: `Attach up to ${MAX_PHOTOS} photos.` })
      .nullish()
      .transform((list) => [...new Set(list ?? [])]),
    orderNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(40)
      .nullish()
      .transform((value) => value || null),
    phone: z.preprocess((value) => (value === '' || value === null ? undefined : value), phoneSchema.optional()),
  })
  .superRefine((input, zctx) => {
    if (input.orderNumber && !input.phone) {
      zctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter the mobile number used on the order' });
    }
    if (input.phone && !input.orderNumber) {
      zctx.addIssue({ code: 'custom', path: ['orderNumber'], message: 'Enter the order number' });
    }
  });

const questionSchema = z
  .object({
    kind: z.enum(['general', 'fitment'], { error: 'Choose the kind of question' }),
    authorName: z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(60),
    phone: z.preprocess((value) => (value === '' || value === null ? undefined : value), phoneSchema.optional()),
    vehicleId: z.preprocess((value) => (value === '' || value === null ? undefined : value), idParam.optional()),
    question: z
      .string({ error: 'Type your question' })
      .trim()
      .min(5, { error: 'Type your question' })
      .max(1000, { error: 'Keep the question to 1000 characters or fewer.' }),
  })
  .superRefine((input, zctx) => {
    if (input.kind !== 'fitment') return;
    if (input.vehicleId === undefined) {
      zctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Choose your car' });
    }
    if (input.phone === undefined) {
      zctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter your mobile number so we can reply on WhatsApp' });
    }
  });

const lastTen = (phone) => String(phone ?? '').replace(/\D/g, '').slice(-10);
const oneDecimal = (value) => Math.round(value * 10) / 10;

function median(sorted) {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export default function reportsRoutes(ctx) {
  const router = Router();

  // Storefront reads and writes only touch active products.
  function activeProduct(slug) {
    const row = getProductRow(ctx, String(slug));
    if (!row || !row.is_active) throw notFound('Product');
    return row;
  }

  // The summary covers every approved report, not just the page being shown.
  // Time, difficulty and "fitted first time" only count reports where the part was actually fitted.
  function reportSummary(productId) {
    const totals = ctx.db.get(
      `SELECT COUNT(*) AS total,
              AVG(rating) AS average,
              SUM(fitted_by <> 'not_fitted') AS fitted,
              SUM(fitted_by <> 'not_fitted' AND fitted_ok = 1) AS fitted_ok,
              AVG(CASE WHEN fitted_by <> 'not_fitted' THEN difficulty END) AS difficulty,
              SUM(fitted_by = 'self') AS by_self,
              SUM(fitted_by = 'local_garage') AS by_local_garage,
              SUM(fitted_by = 'dealer') AS by_dealer,
              SUM(fitted_by = 'not_fitted') AS by_not_fitted
         FROM reviews
        WHERE product_id = ? AND status = 'approved'`,
      [productId],
    );
    const times = ctx.db
      .all(
        `SELECT time_minutes FROM reviews
          WHERE product_id = ? AND status = 'approved' AND fitted_by <> 'not_fitted' AND time_minutes IS NOT NULL
          ORDER BY time_minutes`,
        [productId],
      )
      .map((row) => Number(row.time_minutes));
    const total = Number(totals.total ?? 0);
    const fitted = Number(totals.fitted ?? 0);
    return {
      total,
      average: total > 0 ? oneDecimal(Number(totals.average)) : 0,
      fittedOkPercent: fitted > 0 ? Math.round((Number(totals.fitted_ok ?? 0) * 100) / fitted) : null,
      medianTimeMinutes: median(times),
      averageDifficulty: totals.difficulty === null || totals.difficulty === undefined ? null : oneDecimal(Number(totals.difficulty)),
      byFitter: {
        self: Number(totals.by_self ?? 0),
        local_garage: Number(totals.by_local_garage ?? 0),
        dealer: Number(totals.by_dealer ?? 0),
        not_fitted: Number(totals.by_not_fitted ?? 0),
      },
    };
  }

  router.get('/products/:slug/reports', (req, res) => {
    const product = activeProduct(req.params.slug);
    const { page, limit } = parse(reportsPage, req.query);
    const rows = ctx.db.all(
      `SELECT * FROM reviews WHERE product_id = ? AND status = 'approved'
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [product.id, limit, (page - 1) * limit],
    );
    const summary = reportSummary(product.id);
    res.json({
      items: rows.map(toReport),
      total: summary.total,
      average: summary.average,
      fittedOkPercent: summary.fittedOkPercent,
      medianTimeMinutes: summary.medianTimeMinutes,
      averageDifficulty: summary.averageDifficulty,
      byFitter: summary.byFitter,
    });
  });

  // Finds the delivered order that proves this purchase, or throws the reason it cannot.
  function eligibleOrder(product, input, user) {
    const hasProduct = 'EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = :productId)';
    const alreadyReported = 'EXISTS (SELECT 1 FROM reviews r WHERE r.order_number = o.order_number AND r.product_id = :productId)';

    if (input.orderNumber) {
      const order = ctx.db.get(
        `SELECT o.id, o.order_number, o.status, o.phone, o.user_id, ${hasProduct} AS has_product, ${alreadyReported} AS reported
           FROM orders o WHERE o.order_number = :orderNumber`,
        { orderNumber: input.orderNumber, productId: product.id },
      );
      const owns = order && ((user && order.user_id === user.id) || lastTen(order.phone) === input.phone);
      if (!owns) throw forbidden('We could not find an order with that number and mobile number.');
      if (!order.has_product) throw forbidden('That order does not include this part. Reports come from people who bought it.');
      if (order.status !== 'delivered') {
        throw forbidden('That order has not been delivered yet. You can file a report once the part reaches you.');
      }
      if (order.reported) throw conflict('You have already sent a fitted report for this part from that order.');
      return order;
    }

    if (!user) {
      throw forbidden('Sign in, or enter your order number and mobile number, so we know you received this part.');
    }
    const orders = ctx.db.all(
      `SELECT o.id, o.order_number, o.status, ${alreadyReported} AS reported
         FROM orders o
        WHERE o.user_id = :userId AND ${hasProduct}
        ORDER BY o.created_at DESC, o.id DESC`,
      { userId: user.id, productId: product.id },
    );
    const delivered = orders.filter((order) => order.status === 'delivered');
    if (delivered.length === 0) {
      if (orders.length > 0) throw forbidden('Your order with this part has not been delivered yet. You can file a report once it reaches you.');
      throw forbidden('Fitted reports come from people who bought this part. We could not find it in your delivered orders.');
    }
    const open = delivered.find((order) => !order.reported);
    if (!open) throw conflict('You have already sent a fitted report for this part.');
    return open;
  }

  function checkPhotosExist(photos) {
    photos.forEach((url, index) => {
      const [, name] = url.match(UPLOAD_URL);
      if (!fs.existsSync(path.join(ctx.config.uploadsDir, `${name}.webp`))) {
        throw badRequest('One of the photos was not found. Upload it again.', { [`photos.${index}`]: 'Upload the photo again.' });
      }
    });
  }

  router.post('/products/:slug/reports', limiters.forms, (req, res) => {
    const product = activeProduct(req.params.slug);
    const input = parse(reportSchema, req.body);
    checkPhotosExist(input.photos);
    const notFitted = input.fittedBy === 'not_fitted';

    ctx.db.tx(() => {
      const order = eligibleOrder(product, input, req.user);
      ctx.db.run(
        `INSERT INTO reviews (product_id, user_id, order_number, author_name, vehicle, rating, fitted_by, time_minutes,
           difficulty, fitted_ok, issues, body, photos, is_verified_purchase, status, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', 0, ?)`,
        [
          product.id,
          req.user?.id ?? null,
          order.order_number,
          input.authorName,
          input.vehicle,
          input.rating,
          input.fittedBy,
          notFitted ? null : input.timeMinutes,
          notFitted ? null : input.difficulty,
          input.fittedOk,
          input.issues,
          input.body,
          input.photos,
          ctx.now(),
        ],
      );
    });
    res.status(201).json({ ok: true, status: 'pending' });
  });

  router.post('/reports/photos', limiters.forms, imageUpload({ field: 'photos', maxFiles: MAX_PHOTOS, maxSizeMb: 5 }), async (req, res) => {
    res.json({ urls: await saveImages(ctx, req.files) });
  });

  router.get('/products/:slug/questions', (req, res) => {
    const product = activeProduct(req.params.slug);
    const rows = ctx.db.all(
      `SELECT id, kind, vehicle_label, author_name, question, answer, answer_fit_type, answered_at, is_demo, created_at
         FROM product_questions
        WHERE product_id = ? AND status = 'published'
        ORDER BY COALESCE(answered_at, created_at) DESC, id DESC
        LIMIT ?`,
      [product.id, MAX_PUBLIC_QUESTIONS],
    );
    res.json(rows.map(toQuestion));
  });

  router.post('/products/:slug/questions', limiters.forms, (req, res) => {
    const product = activeProduct(req.params.slug);
    const input = parse(questionSchema, req.body);
    let vehicle = null;
    if (input.vehicleId !== undefined) {
      vehicle = getVehicleRow(ctx, input.vehicleId);
      if (!vehicle) throw badRequest('Choose your car from the list.', { vehicleId: 'Choose your car from the list' });
    }
    ctx.db.run(
      `INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, phone, question, status, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [
        product.id,
        input.kind,
        vehicle?.id ?? null,
        vehicle ? vehicleLabel(vehicle) : '',
        input.authorName,
        input.phone ?? '',
        input.question,
        ctx.now(),
      ],
    );
    res.status(201).json({ ok: true });
  });

  return router;
}
