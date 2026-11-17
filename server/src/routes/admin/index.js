import { Router } from 'express';
import { requireAdmin } from '../../lib/auth.js';
import bookings from './bookings.js';
import builds from './builds.js';
import categories from './categories.js';
import coupons from './coupons.js';
import customers from './customers.js';
import demand from './demand.js';
import demo from './demo.js';
import drops from './drops.js';
import enquiries from './enquiries.js';
import followups from './followups.js';
import kits from './kits.js';
import leads from './leads.js';
import orders from './orders.js';
import products from './products.js';
import questions from './questions.js';
import quotes from './quotes.js';
import reports from './reports.js';
import settings from './settings.js';
import stats from './stats.js';
import stockAlerts from './stockAlerts.js';
import uploads from './uploads.js';

const sections = [
  stats,
  demand,
  followups,
  products,
  uploads,
  categories,
  drops,
  orders,
  bookings,
  quotes,
  coupons,
  customers,
  reports,
  questions,
  enquiries,
  leads,
  kits,
  stockAlerts,
  builds,
  settings,
  demo,
];

// Mounted at /api/admin. Everything below the guard is admin only: each section router
// declares its own full paths (/products, /orders/:orderNumber, ...) and needs no auth check of its own.
export default function adminRoutes(ctx) {
  const router = Router();
  router.use(requireAdmin);
  for (const section of sections) router.use('/', section(ctx));
  return router;
}
