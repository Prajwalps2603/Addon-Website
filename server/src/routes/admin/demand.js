import { Router } from 'express';
import { vehicleLabel } from '../../lib/mappers.js';
import { parse } from '../../lib/validate.js';
import { SALE_STATUS_SQL, istRange, rangeQuerySchema, shiftIso } from './stats.js';

// GET /demand (mounted at /api/admin, admin only): the sales the shop could not make.
// Searches follow the chosen range; waiting alerts, open questions and the reorder list are live queues.

export const NO_SUPPLIER = 'No supplier set';
const REORDER_COVER_DAYS = 30;
const REORDER_MIN_QTY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const int = (value) => Math.round(Number(value) || 0);

export default function adminDemandRoutes(ctx) {
  const router = Router();

  router.get('/demand', (req, res) => {
    const { days } = parse(rangeQuerySchema, req.query);
    res.json(buildDemand(ctx, days));
  });

  return router;
}

/**
 * How many to order: enough to cover the last 30 days of sales again and to climb back above
 * the low-stock line, never fewer than 5.
 */
export function suggestReorderQty({ stock, threshold, soldLast30 }) {
  const need = soldLast30 + threshold - Math.max(0, stock);
  return Math.max(REORDER_MIN_QTY, need);
}

export function purchaseOrderMessage(storeName, supplier, items) {
  const greeting = supplier === NO_SUPPLIER ? 'Hello,' : `Hello ${supplier},`;
  const lines = items.map((item, index) => `${index + 1}. ${item.sku}: ${item.name}, qty ${item.suggestedQty}`);
  return [
    greeting,
    `Purchase order from ${storeName}. Please send:`,
    '',
    ...lines,
    '',
    'Please confirm the price and dispatch date. Thank you.',
  ].join('\n');
}

export function buildDemand(ctx, days) {
  const { db } = ctx;
  const now = ctx.now();
  const { from, to } = istRange(now, days);

  const topSearches = db
    .all(
      `SELECT LOWER(TRIM(query)) AS q, COUNT(*) AS n, AVG(result_count) AS avg_results
       FROM search_log
       WHERE created_at >= :from AND created_at <= :to AND TRIM(query) <> ''
       GROUP BY q
       ORDER BY n DESC, q ASC
       LIMIT 20`,
      { from, to },
    )
    .map((row) => ({ query: row.q, count: int(row.n), avgResults: Math.round((Number(row.avg_results) || 0) * 10) / 10 }));

  const missedSearches = db
    .all(
      `SELECT LOWER(TRIM(query)) AS q, COUNT(*) AS n, MAX(created_at) AS last_seen
       FROM search_log
       WHERE created_at >= :from AND created_at <= :to AND result_count = 0 AND TRIM(query) <> ''
       GROUP BY q
       ORDER BY n DESC, last_seen DESC, q ASC
       LIMIT 20`,
      { from, to },
    )
    .map((row) => ({ query: row.q, count: int(row.n), lastSeen: row.last_seen }));

  const mostWaitedFor = db
    .all(
      `SELECT p.id, p.name, p.slug, p.stock, COUNT(*) AS waiting
       FROM stock_alerts a
       JOIN products p ON p.id = a.product_id
       WHERE a.status = 'waiting'
       GROUP BY p.id
       ORDER BY waiting DESC, p.name ASC
       LIMIT 20`,
    )
    .map((row) => ({ productId: row.id, name: row.name, slug: row.slug, waiting: int(row.waiting), stock: int(row.stock) }));

  // Pending fitment questions, by car. The label typed with the question wins; otherwise the vehicle row's.
  const questionRows = db.all(
    `SELECT q.vehicle_label, v.make, v.model, v.year_from, v.year_to, COUNT(*) AS n
     FROM product_questions q
     LEFT JOIN vehicles v ON v.id = q.vehicle_id
     WHERE q.kind = 'fitment' AND q.status = 'pending'
     GROUP BY q.vehicle_label, q.vehicle_id`,
  );
  const cars = new Map();
  for (const row of questionRows) {
    const label = row.vehicle_label.trim() || (row.make ? vehicleLabel(row) : '');
    if (!label) continue;
    const key = label.toLowerCase();
    const entry = cars.get(key) ?? { vehicleLabel: label, questions: 0 };
    entry.questions += int(row.n);
    cars.set(key, entry);
  }
  const unansweredCars = [...cars.values()]
    .sort((a, b) => b.questions - a.questions || a.vehicleLabel.localeCompare(b.vehicleLabel))
    .slice(0, 20);

  const salesFrom = shiftIso(now, -REORDER_COVER_DAYS * DAY_MS);
  const reorderRows = db.all(
    `SELECT p.id, p.name, p.sku, p.stock, p.low_stock_threshold, TRIM(p.supplier) AS supplier,
            COALESCE(s.units, 0) AS sold
     FROM products p
     LEFT JOIN (
       SELECT oi.product_id, SUM(oi.qty) AS units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= :salesFrom AND o.created_at <= :now AND ${SALE_STATUS_SQL}
       GROUP BY oi.product_id
     ) s ON s.product_id = p.id
     WHERE p.is_active = 1 AND p.stock <= p.low_stock_threshold
     ORDER BY p.stock ASC, p.name ASC, p.id ASC`,
    { salesFrom, now },
  );

  const groups = new Map();
  for (const row of reorderRows) {
    const supplier = row.supplier || NO_SUPPLIER;
    const key = supplier === NO_SUPPLIER ? '' : supplier.toLowerCase();
    const group = groups.get(key) ?? { supplier, items: [] };
    group.items.push({
      productId: row.id,
      name: row.name,
      sku: row.sku,
      stock: int(row.stock),
      suggestedQty: suggestReorderQty({ stock: int(row.stock), threshold: int(row.low_stock_threshold), soldLast30: int(row.sold) }),
    });
    groups.set(key, group);
  }

  const storeName = ctx.settings.get().storeName;
  const reorder = [...groups.entries()]
    .sort(([a], [b]) => (a === '') - (b === '') || a.localeCompare(b))
    .map(([, group]) => ({ ...group, message: purchaseOrderMessage(storeName, group.supplier, group.items) }));

  return { rangeDays: days, topSearches, missedSearches, mostWaitedFor, unansweredCars, reorder };
}
