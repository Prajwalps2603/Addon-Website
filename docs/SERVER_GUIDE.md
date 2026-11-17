# Server guide

What the server foundation gives you, with real signatures. Read this instead of the source.
The contract stays in [API.md](API.md), `client/src/types/api.ts` and `server/src/db/schema.sql`.

## Check your work (from `server/`)

- `node --disable-warning=ExperimentalWarning --test "test/<your-file>.test.js"` and `node --check src/routes/<file>.js`.
- Never start the server to test. `startTestApp()` runs the whole API on a random port with an in-memory database.
- `test/foundation.test.js` must stay green. It only uses paths no route will ever own.

## A route module

```js
// server/src/routes/inbound.js  (mounted at /api, so this is POST /api/newsletter)
import { Router } from 'express';
import * as z from 'zod';
import { limiters } from '../lib/rateLimit.js';
import { emailSchema, parse } from '../lib/validate.js';

export default function inboundRoutes(ctx) {
  const router = Router();
  router.post('/newsletter', limiters.forms, (req, res) => {
    const { email } = parse(z.object({ email: emailSchema }), req.body);   // throws a 400 with fields
    ctx.db.run('INSERT OR IGNORE INTO newsletter_subscribers (email, created_at) VALUES (?, ?)', [email, ctx.now()]);
    res.json({ ok: true });
  });
  return router;
}
```

- Keep the file path and the default export `(ctx) => Router`. `app.js` already mounts every stub:
  `/api` settings, catalog, reports, inbound, cart · `/api/auth` · `/api/account` · `/api/orders` · `/api/payments` · `/api/kits` · `/api/builds` · `/api/admin`.
- Admin section routers (`routes/admin/*.js`) are mounted at `/api/admin` behind `requireAdmin`: declare full paths (`/products/:id`) and add no auth check.
- Fail by throwing: `throw notFound('Product')`. Express 5 forwards sync and async throws to the one error handler, which answers with `ApiErrorBody`. Never write `res.status(500)` or your own error JSON. An unexpected error becomes a logged 500 `server_error`.
- `req.user` is set on every `/api` request: the `users` row (`id, name, email, phone, role, created_at, updated_at`, no password hash) or `null`. Add `requireAuth` to insist on one.
- `req.body` is `undefined` when nothing was sent (`parse` copes). `req.query` is read-only: `const q = parse(schema, req.query)`. Query values are strings: use `z.coerce.number()`. Wildcard paths need a name: `/{*rest}`.
- `POST /api/payments/razorpay/webhook` gets `req.body` as a raw `Buffer`. Everywhere else JSON up to 1 MB is parsed.
- `/api` responses are sent with `Cache-Control: no-store`. `/uploads/*` is served with a one-year immutable cache.
- Return shapes through `lib/mappers.js`. Money is integer rupees.

## ctx

| Member | Use |
|---|---|
| `ctx.db` | SQLite wrapper, below. |
| `ctx.config` | `env, isProd, isTest, port, jwtSecret, dbPath, uploadsDir, clientDist, publicUrl` (no trailing slash), `razorpay { keyId, keySecret, webhookSecret }`, `smtp { host, port, secure, user, pass, from }`, `admin { email, password }`. |
| `ctx.settings` | Store settings, below. |
| `ctx.mailer` | `await ctx.mailer.send({ to, subject, text, html, replyTo })` resolves to `{ ok }` and never throws. Without SMTP the message is logged and kept in `ctx.mailer.outbox` (newest last, also in tests). `ctx.mailer.configured`. |
| `ctx.now()` | Current time as `2026-11-17T09:30:00Z` (no milliseconds, same as the schema defaults). Use it for every timestamp you write or compare. Tests may replace it. |

## ctx.db (`src/db/index.js`)

```js
ctx.db.get('SELECT * FROM products WHERE slug = ?', [slug]);            // plain object, or undefined
ctx.db.all('SELECT * FROM v_products WHERE category_id = :id', { id });  // array of plain objects
ctx.db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, id]);  // { changes, lastInsertRowid }
ctx.db.exec('PRAGMA optimize');                                          // no parameters
const order = ctx.db.tx(() => { ...; return row; });                    // rolls back if the function throws
```

- Params: an array for `?`, an object for `:name`, or one bare value. `true/false` become 1/0, `undefined` becomes NULL, a `Date` becomes the `ctx.now()` format, arrays and plain objects are stored as JSON text (so JSON columns need no `JSON.stringify`, and `WHERE id IN (SELECT value FROM json_each(?))` takes an array).
- Whole numbers bind as INTEGER, so `'ADN-' || ?` and TEXT columns get `5`, not `5.0`. Integer maths applies: write `/ 100.0` when you want a fraction. `NaN` throws.
- A named object with a key the SQL does not use throws `Unknown named parameter`. Pick the fields. A named parameter missing from the object binds NULL.
- `tx(fn)`: `fn` must be synchronous (an async function is refused). Hash passwords, process images and call Razorpay before or after it. Nesting is safe: an inner `tx` is a savepoint.
- JSON columns come back as strings (mappers parse them). `v_products` works out live drops with SQLite's own clock, not `ctx.now()`.
- UNIQUE violations throw `err.code === 'ERR_SQLITE_ERROR'` with `err.errcode === 2067`: catch that and `throw conflict(...)`.
- `openDb(path)` (also `':memory:'`), `toIso(dateOrString)`, `ctx.db.inTransaction`, `ctx.db.raw`, `ctx.db.close()`.

## lib/errors.js

Each helper returns an `HttpError` to throw. `fields` maps a dotted path to a message.

| Call | Response |
|---|---|
| `badRequest(message?, fields?)` | 400 `validation_error` |
| `unauthorized(message?)` | 401 `unauthorized` |
| `forbidden(message?)` | 403 `forbidden` |
| `notFound('Order')` | 404 `not_found`, "Order not found." |
| `conflict(message, code = 'conflict')` | 409, e.g. `conflict('Only 2 left of this part.', 'out_of_stock')` |
| `new HttpError(status, code, message, fields?)` | anything else, e.g. `new HttpError(400, 'payment_failed', '...')` |

## lib/validate.js (Zod 4: `import * as z from 'zod'`)

- `parse(schema, data)` returns the parsed value or throws a 400 with `fields` (`{ 'contact.phone': 'Enter a 10 digit mobile number' }`). Default Zod wording is replaced with plain messages; your own `{ error: '...' }` wins.
- `phoneSchema` (any common form to 10 digits), `pincodeSchema`, `emailSchema` (trimmed, lower case), `passwordSchema` (8 to 72), `stateSchema` (name or GST code to the official name), `gstinSchema`, `addressSchema` (the whole `AddressInput`, defaults filled).
- `idParam`: `const id = parse(idParam, req.params.id)`. `pagination`: `const { page, limit } = parse(pagination, req.query)` (20 per page, 100 at most). `paginationOf({ defaultLimit: 24, maxLimit: 60 })`.
- `paginated(items, total, { page, limit })` builds `Paginated<T>`. `validationError(issues)` turns Zod issues into the 400.

## lib/auth.js

- Middlewares: `optionalAuth` (already global on `/api`), `requireAuth` (401), `requireAdmin` (401, or 403 for a customer). They take no arguments: `router.get('/orders', requireAuth, handler)`.
- `setSessionCookie(res, user)` signs in (`addon_session`, httpOnly, SameSite=Lax, 30 days, Secure in production; the token holds only `user.id`). `clearSessionCookie(res)` signs out.
- `await hashPassword(password)`, `await verifyPassword(password, hashOrNull)` (false, at the same speed, when there is no hash: use it for unknown emails too).
- `signSession(ctx, userId)` and `SESSION_COOKIE` for tests.

## lib/ids.js

- `slugify('Roof Spoiler (Swift)')` gives `'roof-spoiler-swift'`. `uniqueSlug(ctx, 'products', name, { excludeId })` adds `-2`, `-3` until free (tables: products, categories, builds).
- `randomToken(bytes = 24)`: URL-safe, 32 characters. Use for access tokens and quote, lead and kit tokens.
- `orderNumber(ctx)` gives `ADN-261117-4F7K` (India date, never one already in `orders`).
- `ticketNumber(ctx)` gives `ADN-T-000123`, next in sequence. Insert the enquiry straight after.
- `invoiceNumber(ctx, date?)` gives `ADN/26-27/0001`: gapless per financial year (April to March, India time), prefix from settings. Call it inside the `ctx.db.tx` that writes `orders.invoice_number`. `financialYear(date)` gives `{ startYear, label }`.

## lib/india.js

- `STATES`: 36 entries `{ name, code, type: 'state' | 'ut' }`, `code` is the GST State code. `findState(nameOrCode)` gives an entry or null. `stateCode('Karnataka')` gives `'29'`.
- `stateFromPincode('560001')` gives `'Karnataka'` or null. It is a best guess from the PIN prefix: use it to pre-fill or warn, never to reject.
- `normalizePhone('+91 98765 43210')` gives `'9876543210'` or null. It refuses numbers that are one digit repeated (`9999999999`), so do not use those in tests.
- `isValidPincode(pin)`, `isValidGstin(gstin)` (layout and State code), `stateFromGstin(gstin)`.

## lib/money.js

- `taxBreakdown(lines, { storeState, shipState })` gives `TaxBreakdown`. `lines` are `{ amount, gstRate }` with GST-inclusive rupees after discounts; pass shipping and the COD fee as lines too. `storeState` is `ctx.settings.get().address.state`. Same State or either blank: CGST + SGST. Otherwise IGST.
- `taxByRate(lines, opts)` gives one row per rate `{ gstRate, amount, taxableValue, cgst, sgst, igst, gst }` for invoices and the CSV export. `isInterState(a, b)`.
- `percentOff(price, mrp)` (whole percent, rounded down), `applyDrop(price, percent)` (same rounding as `v_products.sale_price`; use it for variant prices), `formatINR(119999)` gives `'₹1,19,999'` (`{ paise: true }` for two decimals).

## lib/uploads.js

```js
router.post('/uploads', imageUpload({ field: 'images', maxFiles: 8, maxSizeMb: 8 }), async (req, res) => {
  res.status(201).json({ urls: await saveImages(ctx, req.files) });   // ['/uploads/3f9c...e1.webp']
});
```

`saveImages` writes `<random>.webp` (1200px wide at most) and `<random>-480.webp` into `ctx.config.uploadsDir`. No file, a non-image (judged by content) or a file over the limit is a 400. `field` defaults to `'images'`; the fitted-report endpoint uses `'photos'`.

## lib/rateLimit.js

`limiters.auth` (10 per 15 minutes per address and email, 100 per address: login, register, password reset), `limiters.forms` (30 per 10 minutes: enquiries, questions, stock alerts, kits, builds, photo uploads), `limiters.lookup` (40 per 10 minutes: order tracking). Put one before the handler. They answer 429 `rate_limited`, allow twenty times more outside production, and are off under test. `createLimiter({ windowMs, limit, message, keyGenerator? })` makes another.

## ctx.settings (`lib/settings.js`)

- `get()`: every setting merged over `DEFAULT_SETTINGS`, as a fresh copy: all `AdminSettings` fields except `hasDemoData` and `allPromos`, with `promos` holding every promo, `payments { razorpay, razorpayKeyId, upi, upiId, upiPayeeName }` and `notifications { orderEmail }`. Use this in pricing, shipping, invoices and search (`get().searchSynonyms`).
- `public()` gives `PublicSettings` (promos live at `ctx.now()`, `hasDemoData` from `products.is_demo`). `admin()` gives `AdminSettings`.
- `update(partial)`: deep partial of `AdminSettings`. Objects merge, arrays replace, the result is validated as a whole (400 with `fields` such as `shipping.originPincode`) and only then stored. Send the promo list as `allPromos` (`promos` is read as the full list only when `allPromos` is absent). Read-only fields are ignored. Returns `get()`. The admin PUT is `ctx.settings.update(req.body); res.json(ctx.settings.admin());`.
- Razorpay is on only when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set; UPI only when `payments.upiId` is filled. Contact details, address and GSTIN start blank. Never invent them.
- The seed fills promo images with `ctx.settings.update({ allPromos: ctx.settings.get().promos.map((p) => ({ ...p, image })) })` (ids `build-bay`, `new-car`, `friday-five`).
- `invalidate()` only if you write the `settings` table yourself.

## Start-up (`src/index.js`)

Loads the config (production refuses a missing `JWT_SECRET` or the default `ADMIN_PASSWORD`), opens the database, and when `products` is empty imports `src/seed/index.js` and awaits its `runSeed(ctx)` export. A missing or failing seed is logged and the server still starts. `UPLOADS_DIR` and `CLIENT_DIST` may override the default folders.

## Tests

```js
import { startTestApp } from './helpers.js';        // first import: it sets NODE_ENV=test
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

let t;
before(async () => { t = await startTestApp(); });
after(() => t.close());

test('admin can list coupons', async () => {
  const admin = t.asAdmin();
  const res = await admin('/api/admin/coupons');                     // { status, ok, body, headers }
  assert.equal(res.status, 200);
  assert.equal(res.body[0].code, t.fixtures.coupon.code);
  assert.equal((await t.api('/api/admin/coupons')).status, 401);     // signed out
});
```

- `startTestApp({ config, fixtures })`: `config` is merged over the test config (`{ razorpay: { keyId, keySecret, webhookSecret } }`), `fixtures: false` starts empty. Returns `{ ctx, app, url, api, newClient(), asAdmin(), asCustomer(), asUser(id), fixtures, close() }`.
- `api(path, { method, body, cookie, headers })`: `path` starts at the root (`/api/...`). A plain object is sent as JSON; a string, `FormData` or `Buffer` is sent as it is. JSON answers are parsed into `body`, anything else is text. Each client keeps the cookies the server sets, so a login through `t.api` stays signed in. `asAdmin()`, `asCustomer()` and `asUser(id)` return a client that is already signed in.
- Fixtures (ids, slugs and prices are on the objects):
  - `categories`: `exterior` > `spoilers` (`spoilers-wings`), `wheels` > `alloys` (`alloy-wheels`).
  - `vehicles`: `swiftOld` (2018 to 2024) and `swiftNew` (2024 onwards), both hatchbacks with pcd `4x100`; `creta`, an SUV with pcd `5x114.3`.
  - `products`: `spoiler` (fitment `vehicle`, verified `direct` row for `swiftOld`, bulky), `universal`, `bodyType` (hatchbacks only), `wheel` (fitment `pcd` 4x100, freight, `variants[0]` 21999 with stock 4 and `variants[1]` 23999 with stock 2), `outOfStock` (stock 0), `showPlate` (`custom_kind` `show-plate`, `cod_eligible` 0, fitment `none`). All 18% GST, none `is_demo`.
  - `coupon`: `FIT10`, 10% off above ₹999, at most ₹500. `admin` and `customer`: `{ id, name, email, phone, password }`, so the real login route can be tested too.
- Fix the clock with `t.ctx.now = () => '2026-11-17T10:00:00Z'`. Read sent email from `t.ctx.mailer.outbox`. Uploads go to a temp folder that `close()` removes.
- For another user: insert the row, then `t.asUser(id)`. Never share a database file or a fixed port between test files.

## Mappers and catalogue helpers

Two modules turn rows into the shapes of `api.ts`. `lib/mappers.js` is pure (row in, shape out). `lib/catalog.js` reads the catalogue and returns shapes with the fit verdict attached. Tested in `test/mappers.test.js` and `test/catalog-lib.test.js`.

### lib/mappers.js

Every mapper returns exactly the keys of its interface, so cost price, supplier, password hashes, gateway ids and tokens cannot leak through one. JSON columns are parsed here and never throw: bad JSON becomes `[]`, `{}` or `null`. 0/1 become booleans, `''` becomes `null` where the type says `| null`.

| Mapper | Row it takes | Notes |
|---|---|---|
| `toUser(row)`, `toAdminCustomer(row)` | `users` (or `req.user`) | Admin form needs `order_count`, `total_spent`, `last_order_at` columns. |
| `toAddress(row)` | `addresses` | |
| `toCategory(row, { productCount, children })` | `categories` | `children` already mapped. Use `categoryTree()` unless you have a reason not to. |
| `toVehicle(row)`, `vehicleLabel(row)` | `vehicles` | Label: `Maruti Suzuki Swift (2018-2024)`, `Hyundai Creta (2024 onwards)`. |
| `toGarageEntry(row)` | `SELECT uv.vehicle_id, uv.year, uv.nickname, uv.is_active, v.* FROM user_vehicles uv JOIN vehicles v ...` | |
| `toProductSummary(row, fit)` | a product row from `catalog.js` | `fit` is a verdict `{ fit, fitNote, fitVerified }`; leave it out when no car was named. `price` = `sale_price`, `regularPrice` = `price`. |
| `toVariant(row, dropPercent)` | `product_variants` | Pass the product row's `drop_percent`. |
| `toProductDetail(row, parts)`, `toAdminProduct(row, parts)` | a product row | `parts = { fit, variants, fitments, relations, similar, lowest30Days, priceHistory }`, already in API shape, each optional. Normally you call `getProductDetail()` / `getAdminProduct()` instead. `toAdminProduct(row)` alone fills every column-backed field, which is enough for a list. |
| `toFitment(row)` | `SELECT pf.vehicle_id, pf.fit_type, pf.note, pf.is_verified, v.* FROM product_fitments pf JOIN vehicles v ...` | |
| `toStraightLabel(row)`, `toRelation(row, product)`, `toCategoryPick(row, product)` | product row; `product_relations`; `category_picks` | `product` is a `ProductSummary`. |
| `toDrop(row, items)`, `toAdminDrop(row, items, now)` | `drops` | `items`: `drop_items` rows with `product` (a `ProductSummary`) attached. `now` is `ctx.now()`; `state` is `off`, `scheduled`, `live` or `ended`. |
| `toReport(row)`, `toAdminReport(row)` | `reviews` | Admin form needs `product_name`, `product_slug`. |
| `toQuestion(row)`, `toAdminQuestion(row)` | `product_questions` | The public form never has the phone. Admin form needs `product_name`, `product_slug`, `same_ask_count`. |
| `toCoupon(row)` | `coupons` | |
| `toOrderItem(row)`, `toOrderEvent(row)` | `order_items`, `order_events` | |
| `toOrder(row, { items, events, settings, includeToken, estimatedDelivery })` | `orders` plus its item and event rows | Below. |
| `toAdminOrderListItem(row)` | `orders` with `item_count` (units) | |
| `toQuote(row, { cart, now })` | `quotes` | `cart` from `priceCart`. An open quote past `valid_until` reads `expired`. |
| `toAdminQuote(row, { items, now })`, `toAdminQuoteItem(item, productRow, variantRow)`, `quoteItems(row)` | `quotes` | `quoteItems` parses the stored lines; map each with `toAdminQuoteItem`. `total` is the items total; `margin` is `null` when any cost is unknown. |
| `toEnquiry(row)` | `enquiries` (optional `product_name`) | |
| `toLead(row)`, `toSavedKit(row)` | `checkout_leads`, `saved_kits` | The lead's browser token is left out. |
| `toStockAlert(row)` | `stock_alerts` with `product_name`, `product_slug`, `stock` | `stock` is the variant's when the alert names one. |
| `toBuild(row, products)` | `builds` | `products = getProductsByIds(ctx, idList(row.product_ids))`. `total` is the sum of their current prices. |

- `toOrder`: `items` and `events` are raw rows in display order. `settings` is `ctx.settings.get()` (its `address.state` decides CGST + SGST or IGST). `includeToken: true` adds `accessToken`: only on order creation and the buyer's own views. `estimatedDelivery` is `{ earliest, latest }` or left out for `null`. It sets `amountDue = max(0, total - amountPaid)` and `canCancel` (status `pending_payment`, `placed` or `confirmed`).
- `orderTaxLines(orderRow, itemRows)` gives the `{ amount, gstRate }` lines for `taxBreakdown` and `taxByRate`: what was charged for the goods (`total - shipping_fee - cod_fee`, so after every discount) spread over the items by value, to the paisa, plus delivery and the COD fee at the highest rate among the items. Use it for invoices, the CSV export and the cart, so every screen shows the same tax. It reads `total`, `shipping_fee`, `cod_fee` and, per item, `price`, `qty`, `gst_rate`.
- JSON helpers for your own reads: `jsonArray(text)`, `jsonObject(text)`, `stringList(text)`, `idList(text)` (positive whole numbers, no repeats).

### lib/catalog.js

Products are read through `v_products` under the alias `p`. Product rows for the mappers must come from these helpers (or from `PRODUCT_SELECT`, which is `SELECT p.*, ... AS has_variants FROM v_products p`): a bare `SELECT * FROM v_products` has no `has_variants`.

- `findProducts(ctx, { where, params, orderBy, limit, offset, vehicleId, fitOnly, includeInactive })` returns `{ items: ProductSummary[], total, vehicle: Vehicle | null }`.
  - `where`: SQL fragments on `p`, joined with AND. **`p.is_active = 1` is added for you**; pass `includeInactive: true` for admin lists. `productWhereActive` is that fragment, for your own queries.
  - `params`: named values for the `:names` in `where` and `orderBy`. Names a query does not use are ignored here (no "Unknown named parameter"). Reserved names: `pageLimit`, `pageOffset`, `fitVehicleId`, `fitBodyType`, `fitPcd`, `fitMakeSlug`, `fitModelSlug`.
  - `orderBy`: trusted SQL, never shopper input. Default: in stock, featured, best selling, newest. `p.id` is always appended, so pages never overlap. Useful columns: `p.sale_price`, `p.drop_percent`, `p.sold_count`, `p.rating_avg`, `p.created_at`.
  - `limit` (default 24; 0 returns the total alone), `offset` (default 0). Validate shopper input first.
  - `vehicleId`: sets `fit`, `fitNote`, `fitVerified` on every item, with one extra query for the page. An unknown id counts as no vehicle. `fitOnly: true` drops verdict `no` in SQL, so `total` and the pages stay right.
- `findProductRows(ctx, sameOptions)` returns `{ rows, total, verdicts, vehicle }` for callers that need raw rows (kits, pricing, exports): `toProductSummary(row, verdicts.get(row.id))`. Raw rows hold `cost_price` and `supplier`.
- `getProductsByIds(ctx, ids, { vehicleId, includeInactive })` returns `ProductSummary[]` in the order of `ids`; unknown ids, repeats and inactive products are dropped. `getProductRowsByIds(ctx, ids)` returns a `Map` of id to row, inactive included (carts, quotes).
- `getProductRow(ctx, idOrSlug)`: a number reads the id, a string the slug. Row or `null`. Inactive products are returned: check `row.is_active`.
- `getProductDetail(ctx, slug, { vehicleId, includeInactive })` returns the whole `ProductDetail` or `null` (unknown, or inactive without `includeInactive`): variants with any live drop applied, fitments with vehicles, relations (requires first), up to 8 `similar` (same subcategory, in stock first), `lowest30Days`, `priceHistory`. `getAdminProduct(ctx, idOrSlug)` returns `AdminProduct` or `null`.
- `lowest30Days` is the lowest price charged in the 30 days before the current price took effect, counting regular prices and earlier drops; `null` when nothing was charged before it. `priceHistory` is `{ date: 'YYYY-MM-DD' (day in India), price }`, one point per day the price a shopper pays changed, drops included. Both come from `price_history` and the drop tables: write a `price_history` row on every regular price change, and backdate `recorded_at` in the seed, or products created inside a live drop have no earlier price to show. `priceTrail(history, drops, { now, currentPrice })` is the pure function behind them.
- `getVehicle(ctx, id)` returns `Vehicle | null`, `getVehicleRow(ctx, id)` the row. A malformed id is `null`, never a throw. `listVehicleMakes(ctx)` returns `VehicleMake[]`: popular first then alphabetical, for makes and for models; generations newest first.
- `categoryTree(ctx, { includeInactive })` returns top-level `Category[]` with `children`, by `sort_order`. `productCount` counts active products; a parent sums its children. Inactive categories and everything under them are left out unless asked for. `getCategory(ctx, idOrSlug, { includeInactive })` returns one `Category` (top-level or sub) or `null`.
- Fit verdict (the rule in API.md):
  - `fitVerdict(productRow, vehicle, fitmentRow, siblingInfo)` returns `{ fit, fitNote, fitVerified }`. `vehicle` is a row, a `Vehicle`, or `{ bodyType }` when that is all you know; `null` gives `fit: null`. `fitmentRow` is the `product_fitments` row for exactly that pair. `siblingInfo` is `{ siblingFits: true }` when the product has a `direct` or `with_work` row for another generation of the same model.
  - `fitVerdictsFor(ctx, productRows, vehicle)` does the lookups for a whole list in one query and returns a `Map` of product id to verdict. Use this, not a loop of queries.
  - `fitSql(vehicle)` returns `{ sql, params }`: the same verdict as an SQL expression on `p`, for counting and sorting, e.g. `SUM((${fit.sql}) IN ('direct', 'with_work', 'universal'))` for `fitsCount`.
  - `fitVerified` is true only for a verified `direct` row. A `no` worked out from the rules carries a plain reason in `fitNote` ("Made for hatchbacks only.", "Needs a 4x100 bolt pattern. This car has 5x114.3.").
- IN lists: `whereIn('p.category_id', ids, 'cat')` gives `{ sql: 'p.category_id IN (:cat0, :cat1)', params }`, `inList(values, 'cat')` just the list. Values are bound, never pasted; an empty list matches nothing. For `?` queries, `IN (SELECT value FROM json_each(?))` takes an array.

A list route:

```js
import { findProducts, getCategory, whereIn } from '../lib/catalog.js';
import { notFound } from '../lib/errors.js';
import { paginated, parse } from '../lib/validate.js';

router.get('/products', (req, res) => {
  const query = parse(productQuerySchema, req.query);     // your Zod schema: page, limit, category, vehicleId, fitOnly, maxPrice ...
  const where = [];
  const params = {};
  if (query.maxPrice) {
    where.push('p.sale_price <= :maxPrice');
    params.maxPrice = query.maxPrice;
  }
  if (query.category) {
    const category = getCategory(ctx, query.category);
    if (!category) throw notFound('Category');
    const inCategory = whereIn('p.category_id', [category.id, ...category.children.map((child) => child.id)], 'cat');
    where.push(inCategory.sql);
    Object.assign(params, inCategory.params);
  }
  const { items, total, vehicle } = findProducts(ctx, {
    where,
    params,
    orderBy: '(p.stock > 0) DESC, p.sale_price ASC',
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
    vehicleId: query.vehicleId,
    fitOnly: query.fitOnly === '1',
  });
  res.json({ ...paginated(items, total, query), vehicle });
});
```

A detail route:

```js
import * as z from 'zod';
import { getProductDetail } from '../lib/catalog.js';
import { notFound } from '../lib/errors.js';
import { idParam, parse } from '../lib/validate.js';

router.get('/products/:slug', (req, res) => {
  const { vehicleId } = parse(z.object({ vehicleId: idParam.optional() }), req.query);
  const product = getProductDetail(ctx, req.params.slug, { vehicleId });   // null for unknown or inactive
  if (!product) throw notFound('Product');
  res.json(product);
});
```
