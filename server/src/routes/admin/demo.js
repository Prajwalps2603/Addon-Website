import { Router } from 'express';

const DEMO_PRODUCTS = 'SELECT id FROM products WHERE is_demo = 1';
const DEMO_ORDERS = 'SELECT id FROM orders WHERE is_demo = 1';
const DEMO_DROPS = 'SELECT id FROM drops WHERE is_demo = 1';

// Children first, so nothing relies on ON DELETE behaviour and every count is exact.
// Rows of real orders and enquiries that point at a sample product keep their own data
// (the order line keeps its name, SKU and price) and only lose the link.
const STEPS = [
  ['orderEvents', `DELETE FROM order_events WHERE order_id IN (${DEMO_ORDERS})`],
  ['orderItems', `DELETE FROM order_items WHERE order_id IN (${DEMO_ORDERS})`],
  ['orders', 'DELETE FROM orders WHERE is_demo = 1'],
  ['bookings', 'DELETE FROM bookings WHERE is_demo = 1'],
  [null, `UPDATE order_items SET product_id = NULL WHERE product_id IN (${DEMO_PRODUCTS})`],
  [null, `UPDATE enquiries SET product_id = NULL WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['fitments', `DELETE FROM product_fitments WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['variants', `DELETE FROM product_variants WHERE product_id IN (${DEMO_PRODUCTS})`],
  [
    'relations',
    `DELETE FROM product_relations WHERE product_id IN (${DEMO_PRODUCTS}) OR related_id IN (${DEMO_PRODUCTS})`,
  ],
  ['picks', `DELETE FROM category_picks WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['priceHistory', `DELETE FROM price_history WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['dropItems', `DELETE FROM drop_items WHERE drop_id IN (${DEMO_DROPS}) OR product_id IN (${DEMO_PRODUCTS})`],
  ['reports', `DELETE FROM reviews WHERE is_demo = 1 OR product_id IN (${DEMO_PRODUCTS})`],
  ['questions', `DELETE FROM product_questions WHERE is_demo = 1 OR product_id IN (${DEMO_PRODUCTS})`],
  ['wishlistItems', `DELETE FROM wishlist_items WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['stockAlerts', `DELETE FROM stock_alerts WHERE product_id IN (${DEMO_PRODUCTS})`],
  ['builds', 'DELETE FROM builds WHERE is_demo = 1'],
  ['coupons', 'DELETE FROM coupons WHERE is_demo = 1'],
  ['drops', 'DELETE FROM drops WHERE is_demo = 1'],
  ['products', 'DELETE FROM products WHERE is_demo = 1'],
];

/** Deletes every sample row in one transaction and returns how many rows went from each table. */
export function clearDemoData(ctx) {
  return ctx.db.tx(() => {
    const removed = {};
    for (const [name, sql] of STEPS) {
      const { changes } = ctx.db.run(sql);
      if (name) removed[name] = Number(changes);
    }
    return removed;
  });
}

// The sample rows still in the store, by kind: what "Clear sample data" would remove at the top level.
const COUNTS = {
  products: 'SELECT COUNT(*) AS n FROM products WHERE is_demo = 1',
  orders: 'SELECT COUNT(*) AS n FROM orders WHERE is_demo = 1',
  bookings: 'SELECT COUNT(*) AS n FROM bookings WHERE is_demo = 1',
  reports: 'SELECT COUNT(*) AS n FROM reviews WHERE is_demo = 1',
  questions: 'SELECT COUNT(*) AS n FROM product_questions WHERE is_demo = 1',
  builds: 'SELECT COUNT(*) AS n FROM builds WHERE is_demo = 1',
  coupons: 'SELECT COUNT(*) AS n FROM coupons WHERE is_demo = 1',
  drops: 'SELECT COUNT(*) AS n FROM drops WHERE is_demo = 1',
};

export function countDemoData(ctx) {
  return Object.fromEntries(Object.entries(COUNTS).map(([name, sql]) => [name, Number(ctx.db.get(sql).n)]));
}

// GET /demo (counts) and POST /demo/clear (mounted at /api/admin, admin only).
// Categories, vehicles, settings, users and every real row stay as they are.
export default function adminDemoRoutes(ctx) {
  const router = Router();

  // One request for the settings page's sample-data section, instead of paging through the products.
  router.get('/demo', (req, res) => {
    res.json({ counts: countDemoData(ctx) });
  });

  router.post('/demo/clear', (req, res) => {
    res.json({ removed: clearDemoData(ctx) });
  });

  return router;
}
