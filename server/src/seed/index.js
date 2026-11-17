// Fills an empty database with the complete sample store. Every row it writes that can carry
// is_demo does, so the owner can clear the samples in one go before going live.
import { hashPassword } from '../lib/auth.js';
import { seedCategories } from './categories.js';
import { seedExtras } from './extras.js';
import { seedProducts } from './products.js';
import { loadCatalog, loadPhotos, normalizePhotos } from './shared.js';
import { seedVehicles } from './vehicles.js';

const NOTHING_WRITTEN = {
  admin: 0,
  categories: 0,
  subcategories: 0,
  vehicles: 0,
  products: 0,
  variants: 0,
  fitments: 0,
  priceHistory: 0,
  productsWithPhotos: 0,
  relations: 0,
  picks: 0,
  dropItems: 0,
  reports: 0,
  questions: 0,
  coupons: 0,
  builds: 0,
  promoImages: 0,
};

const countOf = (ctx, table) => ctx.db.get(`SELECT COUNT(*) AS total FROM ${table}`).total;

// Deletes the catalogue and every sample row. Settings, users, and real orders, coupons and builds stay.
// Order matters: products hold a plain foreign key to categories, so they go first; the tables
// that hang off products and vehicles (variants, fitments, picks, price history...) follow by cascade.
function clearCatalogue(ctx) {
  const statements = [
    'DELETE FROM orders WHERE is_demo = 1',
    'DELETE FROM reviews WHERE is_demo = 1',
    'DELETE FROM product_questions WHERE is_demo = 1',
    'DELETE FROM builds WHERE is_demo = 1',
    'DELETE FROM coupons WHERE is_demo = 1',
    'DELETE FROM drops',
    'DELETE FROM products',
    'DELETE FROM categories',
    'DELETE FROM vehicles',
  ];
  return statements.reduce((removed, sql) => removed + ctx.db.run(sql).changes, 0);
}

// The admin account is created once, from ADMIN_EMAIL and ADMIN_PASSWORD, and only while the store has no admin.
// If that address already belongs to a customer account, the account is promoted and given the configured password.
function writeAdmin(ctx, passwordHash, now) {
  if (!passwordHash || ctx.db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1")) return 0;
  const { email } = ctx.config.admin;
  const existing = ctx.db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    ctx.db.run("UPDATE users SET role = 'admin', password_hash = ?, updated_at = ? WHERE id = ?", [passwordHash, now, existing.id]);
  } else {
    ctx.db.run("INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at) VALUES ('Store Admin', ?, '', ?, 'admin', ?, ?)", [
      email,
      passwordHash,
      now,
      now,
    ]);
  }
  return 1;
}

/**
 * Seeds the sample store: admin user, categories, vehicles, products (with variants, fitments and
 * price history), then relations, picks, the Friday Five, fitted reports, questions, coupons,
 * house builds and promo photos. All in one transaction: it either all lands or none of it does.
 *
 * A database that already holds a catalogue (any category, vehicle or product) is left exactly as
 * it is, so calling this twice, or after the owner has cleared the sample data, changes nothing.
 *
 *   reset   delete the catalogue and every sample row first, then seed. Settings and users are kept.
 *   log     where progress lines go (console.log by default)
 *   photos  a photo library to use instead of reading photos.json: { catalog: { [artKind]: Photo[] }, editorial: Photo[] }
 *
 * Returns the number of rows written per kind, plus `skipped` (true when nothing was done) and
 * `removed` (rows deleted by a reset, cascades not counted).
 */
export async function runSeed(ctx, { reset = false, log = console.log, photos } = {}) {
  const hasCatalogue = ['categories', 'vehicles', 'products'].some((table) => countOf(ctx, table) > 0);
  if (hasCatalogue && !reset) {
    log('[seed] This database already has a catalogue. Nothing was changed. Run the seed with --reset to rebuild the sample store.');
    return { skipped: true, removed: 0, ...NOTHING_WRITTEN };
  }

  const catalog = loadCatalog();
  const library = photos ? normalizePhotos(photos) : loadPhotos();
  // bcrypt is asynchronous and a transaction must not wait on anything, so the hash is made first.
  const needsAdmin = !ctx.db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  const passwordHash = needsAdmin ? await hashPassword(ctx.config.admin.password) : null;

  const result = ctx.db.tx(() => {
    const now = ctx.now();
    const nowMs = Date.parse(now);
    const removed = reset ? clearCatalogue(ctx) : 0;
    const admin = writeAdmin(ctx, passwordHash, now);
    const categories = seedCategories(ctx, { catalog, photos: library });
    const vehicles = seedVehicles(ctx, { catalog });
    const products = seedProducts(ctx, { catalog, photos: library, nowMs, categoryIds: categories.ids, vehicles });
    const extras = seedExtras(ctx, { photos: library, nowMs, log, categoryIds: categories.ids, vehicles, productIds: products.ids });

    return {
      skipped: false,
      removed,
      admin,
      categories: categories.categories,
      subcategories: categories.subcategories,
      vehicles: vehicles.count,
      products: products.products,
      variants: products.variants,
      // Fitment answers from the sample questions are written by the extras step, so count the table.
      fitments: countOf(ctx, 'product_fitments'),
      priceHistory: products.priceHistory,
      productsWithPhotos: products.withPhotos,
      ...extras,
    };
  });

  if (result.removed > 0) log(`[seed] Reset: removed ${result.removed} catalogue and sample rows.`);
  if (result.admin === 1) log(`[seed] Created the admin account ${ctx.config.admin.email}.`);
  log(
    `[seed] Loaded ${result.categories} categories, ${result.subcategories} subcategories, ${result.vehicles} vehicles and ` +
      `${result.products} products (${result.variants} variants, ${result.productsWithPhotos} with photos).`,
  );
  return result;
}
