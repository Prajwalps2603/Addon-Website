import { Router } from 'express';
import * as z from 'zod';
import { parse } from '../../lib/validate.js';
import { countFollowUps } from './followups.js';

// GET /stats (mounted at /api/admin, admin only): the owner's numbers for a range of India days.

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Orders that count as sales: money was promised or paid and the order still stands. */
export const SALE_STATUS_SQL = "o.status NOT IN ('cancelled', 'returned', 'pending_payment')";

const ORDER_STATUSES = ['pending_payment', 'placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
const PAYMENT_METHODS = ['upi', 'razorpay', 'cod'];

/** `days` as the admin screens send it: 7, 30, 90 or 365 (30 when left out). */
export const rangeQuerySchema = z.object({
  days: z
    .enum(['7', '30', '90', '365'], { error: 'Choose 7, 30, 90 or 365 days.' })
    .default('30')
    .transform(Number),
});

/** An ISO timestamp in the schema's format (no milliseconds). */
export function isoAt(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Shifts an ISO timestamp by a number of milliseconds. */
export function shiftIso(iso, ms) {
  return isoAt(Date.parse(iso) + ms);
}

/**
 * The last `days` India calendar days, today included: `from` is India midnight at the start of the
 * first day (as a UTC timestamp), `to` is now, and `dates` lists every day 'YYYY-MM-DD', oldest first.
 */
export function istRange(nowIso, days) {
  const nowMs = Date.parse(nowIso);
  const today = new Date(nowMs + IST_OFFSET_MS).toISOString().slice(0, 10);
  const todayStartUtc = Date.parse(`${today}T00:00:00Z`);
  const firstDayUtc = todayStartUtc - (days - 1) * DAY_MS;
  const dates = [];
  for (let i = 0; i < days; i += 1) dates.push(new Date(firstDayUtc + i * DAY_MS).toISOString().slice(0, 10));
  return { from: isoAt(firstDayUtc - IST_OFFSET_MS), to: isoAt(nowMs), dates };
}

const int = (value) => Math.round(Number(value) || 0);

export default function adminStatsRoutes(ctx) {
  const router = Router();

  router.get('/stats', (req, res) => {
    const { days } = parse(rangeQuerySchema, req.query);
    res.json(buildStats(ctx, days));
  });

  return router;
}

export function buildStats(ctx, days) {
  const { db } = ctx;
  const now = ctx.now();
  const { from, to, dates } = istRange(now, days);
  const range = { from, to };
  const inRange = 'o.created_at >= :from AND o.created_at <= :to';
  const sales = `${inRange} AND ${SALE_STATUS_SQL}`;

  const totals = db.get(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(o.total), 0) AS revenue,
            COALESCE(SUM(o.total - o.shipping_fee - o.cod_fee), 0) AS goods
     FROM orders o WHERE ${sales}`,
    range,
  );

  const lines = db.get(
    `SELECT COALESCE(SUM(oi.qty), 0) AS units,
            COUNT(*) AS line_count,
            SUM(p.cost_price IS NULL) AS unknown_cost,
            COALESCE(SUM(p.cost_price * oi.qty), 0) AS cost
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE ${sales}`,
    range,
  );

  const collected = db.get(
    `SELECT COALESCE(SUM(o.amount_paid), 0) AS amount FROM orders o
     WHERE ${inRange} AND o.payment_status <> 'refunded'`,
    range,
  ).amount;

  const codOutstanding = db.get(
    `SELECT COALESCE(SUM(MAX(o.total - o.amount_paid, 0)), 0) AS amount FROM orders o
     WHERE ${inRange} AND o.payment_method = 'cod'
       AND o.status IN ('shipped', 'out_for_delivery', 'delivered')
       AND o.payment_status NOT IN ('paid', 'refunded')`,
    range,
  ).amount;

  const newCustomers = db.get(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'customer' AND created_at >= :from AND created_at <= :to",
    range,
  ).n;

  // The live packing queue: orders the shop still has to send out.
  const pendingOrders = db.get("SELECT COUNT(*) AS n FROM orders WHERE status IN ('placed', 'confirmed', 'packed')").n;

  const perDay = new Map(
    db
      .all(
        `SELECT date(o.created_at, '+330 minutes') AS day, COUNT(*) AS orders, SUM(o.total) AS revenue
         FROM orders o WHERE ${sales} GROUP BY day`,
        range,
      )
      .map((row) => [row.day, row]),
  );
  const series = dates.map((date) => ({
    date,
    revenue: int(perDay.get(date)?.revenue),
    orders: int(perDay.get(date)?.orders),
  }));

  const statusCounts = new Map(
    db.all(`SELECT o.status, COUNT(*) AS n FROM orders o WHERE ${inRange} GROUP BY o.status`, range).map((row) => [row.status, row.n]),
  );
  const byStatus = ORDER_STATUSES.filter((status) => statusCounts.has(status)).map((status) => ({
    status,
    count: int(statusCounts.get(status)),
  }));

  const methodRows = new Map(
    db
      .all(
        `SELECT o.payment_method AS method, COUNT(*) AS n, SUM(o.total) AS revenue
         FROM orders o WHERE ${sales} GROUP BY o.payment_method`,
        range,
      )
      .map((row) => [row.method, row]),
  );
  const byPaymentMethod = PAYMENT_METHODS.filter((method) => methodRows.has(method)).map((method) => ({
    method,
    count: int(methodRows.get(method).n),
    revenue: int(methodRows.get(method).revenue),
  }));

  const topProducts = db
    .all(
      `SELECT oi.product_id, COALESCE(p.name, MAX(oi.name)) AS name, COALESCE(p.slug, MAX(oi.slug)) AS slug,
              SUM(oi.qty) AS units, SUM(oi.price * oi.qty) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE ${sales} AND oi.product_id IS NOT NULL
       GROUP BY oi.product_id
       ORDER BY units DESC, revenue DESC, oi.product_id
       LIMIT 10`,
      range,
    )
    .map((row) => ({ productId: row.product_id, name: row.name, slug: row.slug, units: int(row.units), revenue: int(row.revenue) }));

  const topCategories = db
    .all(
      `SELECT c.name, SUM(oi.qty) AS units, SUM(oi.price * oi.qty) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       JOIN categories c ON c.id = p.category_id
       WHERE ${sales}
       GROUP BY c.id
       ORDER BY revenue DESC, units DESC, c.name
       LIMIT 10`,
      range,
    )
    .map((row) => ({ name: row.name, units: int(row.units), revenue: int(row.revenue) }));

  const topStates = db
    .all(
      `SELECT o.ship_state AS state, COUNT(*) AS orders, SUM(o.total) AS revenue
       FROM orders o WHERE ${sales} AND TRIM(o.ship_state) <> ''
       GROUP BY o.ship_state
       ORDER BY revenue DESC, orders DESC, state
       LIMIT 10`,
      range,
    )
    .map((row) => ({ state: row.state, orders: int(row.orders), revenue: int(row.revenue) }));

  // The car text is typed by the buyer: group case-insensitively and show the most used spelling.
  const vehicleRows = db.all(
    `SELECT LOWER(TRIM(o.vehicle)) AS k, TRIM(o.vehicle) AS vehicle, COUNT(*) AS n
     FROM orders o WHERE ${sales} AND TRIM(o.vehicle) <> ''
     GROUP BY k, TRIM(o.vehicle)`,
    range,
  );
  const vehicles = new Map();
  for (const row of vehicleRows) {
    const entry = vehicles.get(row.k) ?? { vehicle: row.vehicle, orders: 0, best: 0 };
    entry.orders += row.n;
    if (row.n > entry.best || (row.n === entry.best && row.vehicle < entry.vehicle)) {
      entry.best = row.n;
      entry.vehicle = row.vehicle;
    }
    vehicles.set(row.k, entry);
  }
  const topVehicles = [...vehicles.values()]
    .sort((a, b) => b.orders - a.orders || a.vehicle.localeCompare(b.vehicle))
    .slice(0, 10)
    .map(({ vehicle, orders }) => ({ vehicle, orders }));

  const lowStock = db
    .all(
      `SELECT id, name, slug, sku, stock, low_stock_threshold, supplier FROM products
       WHERE is_active = 1 AND stock <= low_stock_threshold
       ORDER BY stock ASC, name ASC, id ASC
       LIMIT 100`,
    )
    .map((row) => ({
      productId: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      stock: int(row.stock),
      threshold: int(row.low_stock_threshold),
      supplier: row.supplier,
    }));

  const queues = db.get(
    `SELECT
       (SELECT COUNT(*) FROM enquiries WHERE status = 'new') AS enquiries,
       (SELECT COUNT(*) FROM reviews WHERE status = 'pending') AS reports,
       (SELECT COUNT(*) FROM product_questions WHERE status = 'pending') AS questions,
       (SELECT COUNT(*) FROM checkout_leads WHERE status = 'open') AS leads,
       (SELECT COUNT(*) FROM stock_alerts WHERE status = 'waiting') AS stock_alerts,
       (SELECT COUNT(*) FROM builds WHERE status = 'pending') AS builds`,
  );

  const orders = int(totals.orders);
  const revenue = int(totals.revenue);
  const margin = int(lines.unknown_cost) > 0 ? null : int(totals.goods) - int(lines.cost);

  return {
    rangeDays: days,
    revenue,
    orders,
    averageOrderValue: orders > 0 ? Math.round(revenue / orders) : 0,
    unitsSold: int(lines.units),
    newCustomers: int(newCustomers),
    pendingOrders: int(pendingOrders),
    collected: int(collected),
    codOutstanding: int(codOutstanding),
    margin,
    series,
    byStatus,
    byPaymentMethod,
    topProducts,
    topCategories,
    topStates,
    topVehicles,
    lowStock,
    openCounts: {
      followUps: countFollowUps(ctx),
      enquiries: int(queues.enquiries),
      reports: int(queues.reports),
      questions: int(queues.questions),
      leads: int(queues.leads),
      stockAlerts: int(queues.stock_alerts),
      builds: int(queues.builds),
    },
  };
}
