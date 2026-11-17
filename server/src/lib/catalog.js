/**
 * Shared catalogue reads: vehicles, the category tree, product lists and the product page,
 * each with the fit verdict for the shopper's car attached.
 *
 * Products are read through the v_products view (alias `p`), which adds category names and the
 * price after any live drop. Lists hide inactive products unless told otherwise; the by-key row
 * lookups (getProductRow, getProductRowsByIds) return whatever is there, so check `row.is_active`.
 */
import {
  jsonArray,
  toAdminProduct,
  toCategory,
  toFitment,
  toProductDetail,
  toProductSummary,
  toRelation,
  toVariant,
  toVehicle,
} from './mappers.js';
import { applyDrop } from './money.js';

/** The fragment every storefront product query needs. The find* helpers add it for you. */
export const productWhereActive = 'p.is_active = 1';

/**
 * SELECT for product rows that toProductSummary() and toProductDetail() understand: every v_products
 * column plus `has_variants`. Append your own WHERE on alias p.
 */
export const PRODUCT_SELECT =
  'SELECT p.*, EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) AS has_variants FROM v_products p';

const DEFAULT_ORDER = '(p.stock > 0) DESC, p.is_featured DESC, p.sold_count DESC, p.id DESC';
const SIMILAR_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const PRICE_LOOKBACK_DAYS = 30;
const PRICE_HISTORY_POINTS = 60;

const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const COLUMN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

function toId(value) {
  const id = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cleanIds(values) {
  const ids = [];
  for (const value of values ?? []) {
    const id = toId(value);
    if (id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
const popularThenName = (a, b) => Number(b.isPopular) - Number(a.isPopular) || byName(a, b);

// ---------------------------------------------------------------------------
// IN (...) lists
// ---------------------------------------------------------------------------

/**
 * A safe IN list for named parameters:
 *   inList([3, 4], 'cat')  gives  { sql: '(:cat0, :cat1)', params: { cat0: 3, cat1: 4 } }
 * Values must be text or numbers; repeats are dropped. An empty list gives '(NULL)', which matches nothing.
 * Give each list in one query its own prefix.
 */
export function inList(values, prefix = 'in') {
  if (!NAME.test(prefix)) throw new TypeError(`inList: "${prefix}" is not a usable parameter prefix`);
  const unique = [...new Set(values ?? [])];
  const params = {};
  unique.forEach((value, index) => {
    const usable = typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
    if (!usable) throw new TypeError('inList: values must be text or numbers');
    params[`${prefix}${index}`] = value;
  });
  const names = Object.keys(params);
  return { sql: names.length > 0 ? `(${names.map((name) => `:${name}`).join(', ')})` : '(NULL)', params };
}

/**
 * A complete `column IN (...)` fragment for a `where` array:
 *   whereIn('p.category_id', [3, 4], 'cat')  gives  { sql: 'p.category_id IN (:cat0, :cat1)', params: { cat0: 3, cat1: 4 } }
 */
export function whereIn(column, values, prefix = 'in') {
  if (!COLUMN.test(column)) throw new TypeError(`whereIn: "${column}" is not a column name`);
  const list = inList(values, prefix);
  return { sql: `${column} IN ${list.sql}`, params: list.params };
}

// node:sqlite refuses a named object holding a key the statement does not use, and the count,
// page and verdict queries each use a different subset. This keeps the ones a statement mentions.
function pickParams(sql, params) {
  const picked = {};
  for (const [, name] of sql.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (Object.hasOwn(params, name)) picked[name] = params[name];
  }
  return picked;
}

function whereSql(clauses) {
  return clauses.length > 0 ? ` WHERE ${clauses.map((clause) => `(${clause})`).join(' AND ')}` : '';
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** The vehicles row for an id, or null. A missing, blank or malformed id is null too. */
export function getVehicleRow(ctx, id) {
  const vehicleId = toId(id);
  if (vehicleId === null) return null;
  return ctx.db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]) ?? null;
}

/** The Vehicle (API shape, with its label) for an id, or null. */
export function getVehicle(ctx, id) {
  const row = getVehicleRow(ctx, id);
  return row ? toVehicle(row) : null;
}

/**
 * VehicleMake[] for GET /api/vehicles: popular makes first, then alphabetical; inside a make,
 * popular models first, then alphabetical; inside a model, generations newest first.
 */
export function listVehicleMakes(ctx) {
  const makes = new Map();
  for (const row of ctx.db.all('SELECT * FROM vehicles ORDER BY year_from DESC, id DESC')) {
    const vehicle = toVehicle(row);
    let make = makes.get(vehicle.makeSlug);
    if (!make) {
      make = { name: vehicle.make, slug: vehicle.makeSlug, isPopular: false, models: new Map() };
      makes.set(make.slug, make);
    }
    let model = make.models.get(vehicle.modelSlug);
    if (!model) {
      // Rows arrive newest first, so the body type shown for a model is its current generation's.
      model = { name: vehicle.model, slug: vehicle.modelSlug, bodyType: vehicle.bodyType, isPopular: false, generations: [] };
      make.models.set(model.slug, model);
    }
    model.generations.push(vehicle);
    model.isPopular ||= vehicle.isPopular;
    make.isPopular ||= vehicle.isPopular;
  }
  return [...makes.values()]
    .map((make) => ({ ...make, models: [...make.models.values()].sort(popularThenName) }))
    .sort(popularThenName);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Category[]: top-level categories with their `children`, ordered by sort_order then name.
 * productCount counts active products; a parent's count is its own plus its children's.
 * Inactive categories (and everything under them) are left out unless includeInactive is true.
 */
export function categoryTree(ctx, { includeInactive = false } = {}) {
  const rows = ctx.db.all(
    // One grouped count, not a subquery per category: SQLite answers the subquery through
    // idx_products_active and so walks every active product once per category.
    `SELECT c.*, COALESCE(n.own_count, 0) AS own_count
     FROM categories c
     LEFT JOIN (SELECT category_id, COUNT(*) AS own_count FROM products WHERE is_active = 1 GROUP BY category_id) n
       ON n.category_id = c.id
     ${includeInactive ? '' : 'WHERE c.is_active = 1'}
     ORDER BY c.sort_order, c.name, c.id`,
  );
  const byParent = new Map();
  for (const row of rows) {
    const siblings = byParent.get(row.parent_id) ?? [];
    siblings.push(row);
    byParent.set(row.parent_id, siblings);
  }
  const build = (row) => {
    const children = (byParent.get(row.id) ?? []).map(build);
    const productCount = children.reduce((sum, child) => sum + child.productCount, row.own_count);
    return toCategory(row, { productCount, children });
  };
  return (byParent.get(null) ?? []).map(build);
}

/** One Category (with children and counts) by id or slug, top-level or sub, or null. */
export function getCategory(ctx, idOrSlug, { includeInactive = false } = {}) {
  const matches = (category) => (typeof idOrSlug === 'number' ? category.id === idOrSlug : category.slug === idOrSlug);
  const search = (categories) => {
    for (const category of categories) {
      const found = matches(category) ? category : search(category.children);
      if (found) return found;
    }
    return null;
  };
  return search(categoryTree(ctx, { includeInactive }));
}

// ---------------------------------------------------------------------------
// Fit verdict
// ---------------------------------------------------------------------------

const BODY_TYPE_PLURALS = { hatchback: 'hatchbacks', sedan: 'sedans', suv: 'SUVs', muv: 'MUVs', pickup: 'pickups', coupe: 'coupes' };
const FIT_TYPES = new Set(['direct', 'with_work', 'no']);

// '4x100', '4 X 100' and '4×100' are the same bolt pattern. PCD_SQL does the same to p.pcd.
const normalizePcd = (value) => String(value ?? '').toLowerCase().replaceAll(' ', '').replaceAll('×', 'x');
const PCD_SQL = "REPLACE(REPLACE(LOWER(p.pcd), ' ', ''), '×', 'x')";

// Accepts a vehicles row or a Vehicle from the API mappers.
function vehicleFacts(vehicle) {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    model: String(vehicle.model ?? ''),
    bodyType: String(vehicle.body_type ?? vehicle.bodyType ?? ''),
    pcd: String(vehicle.pcd ?? '').trim(),
    makeSlug: String(vehicle.make_slug ?? vehicle.makeSlug ?? ''),
    modelSlug: String(vehicle.model_slug ?? vehicle.modelSlug ?? ''),
  };
}

function listOf(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

const verdict = (fit, fitNote = '') => ({ fit, fitNote, fitVerified: false });

/**
 * The fit verdict of API.md for one product and one car: { fit, fitNote, fitVerified }.
 *
 *   productRow   a v_products row (fitment_type, body_types, pcd)
 *   vehicle      a vehicles row or a Vehicle; null or undefined gives fit null. When only the body type is
 *                known (a kit for "an SUV"), pass { bodyType: 'suv' }: parts that need more than that come out 'unknown'.
 *   fitmentRow   the product_fitments row for exactly this product and car, when there is one: it wins
 *   siblingInfo  { siblingFits: true } when the product has a direct or with_work row for another
 *                generation of the same model. Only fitment_type 'vehicle' reads it.
 *
 * fitVerified is true only for a 'direct' row the shop has verified (the Fit Promise case).
 * A 'no' worked out from the rules carries a plain reason in fitNote.
 * To judge many products at once, use fitVerdictsFor(): it loads the rows in one query.
 */
export function fitVerdict(productRow, vehicle, fitmentRow = null, siblingInfo = null) {
  const car = vehicleFacts(vehicle);
  if (!car) return verdict(null);

  if (fitmentRow) {
    const fit = FIT_TYPES.has(fitmentRow.fit_type) ? fitmentRow.fit_type : 'direct';
    return { fit, fitNote: String(fitmentRow.note ?? ''), fitVerified: fit === 'direct' && Number(fitmentRow.is_verified) === 1 };
  }

  switch (productRow.fitment_type) {
    case 'body_type': {
      const bodyTypes = jsonArray(productRow.body_types);
      if (bodyTypes.includes(car.bodyType)) return verdict('universal');
      const madeFor = bodyTypes.map((bodyType) => BODY_TYPE_PLURALS[bodyType]).filter(Boolean);
      return verdict('no', madeFor.length > 0 ? `Made for ${listOf(madeFor)} only.` : '');
    }
    case 'pcd': {
      const needs = normalizePcd(productRow.pcd);
      const has = normalizePcd(car.pcd);
      if (needs === '' || has === '') return verdict('unknown');
      if (needs === has) return verdict('universal');
      return verdict('no', `Needs a ${String(productRow.pcd).trim()} bolt pattern. This car has ${car.pcd}.`);
    }
    case 'vehicle': {
      const siblingFits = siblingInfo === true || Boolean(siblingInfo?.siblingFits);
      if (!siblingFits) return verdict('unknown');
      return verdict('no', car.model ? `Made for another generation of the ${car.model}.` : 'Made for another generation of this model.');
    }
    default:
      return verdict('universal');
  }
}

/**
 * The same verdict as an SQL expression on alias p, for filtering, counting and sorting in the database:
 *   const fit = fitSql(vehicleRow);
 *   where.push(`(${fit.sql}) IN ('direct', 'with_work', 'universal')`);  Object.assign(params, fit.params);
 * It evaluates to 'direct', 'with_work', 'universal', 'no' or 'unknown'. The parameters are
 * fitVehicleId, fitBodyType, fitPcd, fitMakeSlug and fitModelSlug: bind them only with a query that uses the expression.
 */
export function fitSql(vehicle) {
  const car = vehicleFacts(vehicle);
  if (!car) throw new TypeError('fitSql() needs a vehicle');
  return {
    sql: `COALESCE(
      (SELECT pf.fit_type FROM product_fitments pf WHERE pf.product_id = p.id AND pf.vehicle_id = :fitVehicleId),
      CASE p.fitment_type
        WHEN 'vehicle' THEN CASE WHEN EXISTS (
            SELECT 1 FROM product_fitments pf JOIN vehicles sv ON sv.id = pf.vehicle_id
            WHERE pf.product_id = p.id AND pf.fit_type <> 'no' AND sv.id <> :fitVehicleId
              AND sv.make_slug = :fitMakeSlug AND sv.model_slug = :fitModelSlug
          ) THEN 'no' ELSE 'unknown' END
        WHEN 'body_type' THEN CASE WHEN EXISTS (
            SELECT 1 FROM json_each(CASE WHEN json_valid(p.body_types) THEN p.body_types ELSE '[]' END) bt
            WHERE typeof(bt.key) = 'integer' AND bt.type = 'text' AND bt.value = :fitBodyType
          ) THEN 'universal' ELSE 'no' END
        WHEN 'pcd' THEN CASE
            WHEN :fitPcd = '' OR ${PCD_SQL} = '' THEN 'unknown'
            WHEN ${PCD_SQL} = :fitPcd THEN 'universal'
            ELSE 'no' END
        ELSE 'universal'
      END)`,
    params: {
      fitVehicleId: car.id,
      fitBodyType: car.bodyType,
      fitPcd: normalizePcd(car.pcd),
      fitMakeSlug: car.makeSlug,
      fitModelSlug: car.modelSlug,
    },
  };
}

/**
 * Verdicts for many products and one car in a single query: Map of product id to { fit, fitNote, fitVerified }.
 * Every product row passed in gets an entry (fit null when there is no vehicle).
 */
export function fitVerdictsFor(ctx, productRows, vehicle) {
  const verdicts = new Map();
  const car = vehicleFacts(vehicle);
  if (!car || productRows.length === 0) {
    for (const row of productRows) verdicts.set(row.id, fitVerdict(row, null));
    return verdicts;
  }

  // One read brings this car's rows and those of its sibling generations, which the 'vehicle' rule needs.
  const fitments = ctx.db.all(
    `SELECT pf.product_id, pf.vehicle_id, pf.fit_type, pf.note, pf.is_verified
     FROM product_fitments pf
     JOIN vehicles sv ON sv.id = pf.vehicle_id
     WHERE (sv.id = :vehicleId OR (sv.make_slug = :makeSlug AND sv.model_slug = :modelSlug))
       AND pf.product_id IN (SELECT value FROM json_each(:productIds))`,
    { vehicleId: car.id, makeSlug: car.makeSlug, modelSlug: car.modelSlug, productIds: [...new Set(productRows.map((row) => row.id))] },
  );
  const own = new Map();
  const withSibling = new Set();
  for (const fitment of fitments) {
    if (fitment.vehicle_id === car.id) own.set(fitment.product_id, fitment);
    else if (fitment.fit_type !== 'no') withSibling.add(fitment.product_id);
  }
  for (const row of productRows) {
    verdicts.set(row.id, fitVerdict(row, car, own.get(row.id) ?? null, { siblingFits: withSibling.has(row.id) }));
  }
  return verdicts;
}

// ---------------------------------------------------------------------------
// Product lists
// ---------------------------------------------------------------------------

function nonNegativeInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

/**
 * The engine behind findProducts(), for callers that need the raw rows (kits, cart pricing, exports):
 * { rows, total, verdicts, vehicle }. `rows` are v_products rows with `has_variants`, `verdicts` is a Map
 * of product id to verdict, `vehicle` is the vehicles row or null. Same options as findProducts().
 * Raw rows hold cost_price and supplier: map them before they reach a response.
 */
export function findProductRows(
  ctx,
  { where = [], params = {}, orderBy, limit = 24, offset = 0, vehicleId, fitOnly = false, includeInactive = false } = {},
) {
  for (const name of Object.keys(params)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new TypeError(`findProducts: write the parameter "${name}" as a bare name and use :name in the SQL`);
  }
  const vehicle = getVehicleRow(ctx, vehicleId);
  const clauses = [].concat(where ?? []).filter((clause) => typeof clause === 'string' && clause.trim() !== '');
  const bind = { ...params };
  if (!includeInactive) clauses.unshift(productWhereActive);
  if (fitOnly && vehicle) {
    const fit = fitSql(vehicle);
    clauses.push(`(${fit.sql}) <> 'no'`);
    Object.assign(bind, fit.params);
  }

  const filter = whereSql(clauses);
  const countSql = `SELECT COUNT(*) AS total FROM v_products p${filter}`;
  const { total } = ctx.db.get(countSql, pickParams(countSql, bind));

  const pageLimit = nonNegativeInt(limit, 24);
  let rows = [];
  if (pageLimit > 0 && total > 0) {
    // p.id last makes the order total, so a product never shows on two pages or on none.
    const pageSql = `${PRODUCT_SELECT}${filter} ORDER BY ${orderBy || DEFAULT_ORDER}, p.id LIMIT :pageLimit OFFSET :pageOffset`;
    rows = ctx.db.all(pageSql, pickParams(pageSql, { ...bind, pageLimit, pageOffset: nonNegativeInt(offset, 0) }));
  }
  return { rows, total, verdicts: fitVerdictsFor(ctx, rows, vehicle), vehicle };
}

/**
 * One page of products as ProductSummary[] with the true total: { items, total, vehicle }.
 *
 *   where           SQL fragments on alias p (v_products), joined with AND. 'p.is_active = 1' is added for you.
 *   params          a named object for the :names in where and orderBy. Names you do not use are ignored.
 *                   Reserved: pageLimit, pageOffset and the fit* names of fitSql().
 *   orderBy         SQL, trusted (never shopper input). Default: in stock, featured, best selling, newest.
 *   limit, offset   default 24 and 0. limit 0 returns the total alone.
 *   vehicleId       sets fit, fitNote and fitVerified on every item. An unknown id is treated as no vehicle.
 *   fitOnly         with a vehicle: leaves out parts whose verdict is 'no', in SQL, so total stays right.
 *   includeInactive true lists inactive products too.
 *
 * `vehicle` is the Vehicle that vehicleId resolved to, or null.
 */
export function findProducts(ctx, options = {}) {
  const { rows, total, verdicts, vehicle } = findProductRows(ctx, options);
  return {
    items: rows.map((row) => toProductSummary(row, verdicts.get(row.id))),
    total,
    vehicle: vehicle ? toVehicle(vehicle) : null,
  };
}

/**
 * Product rows (v_products plus has_variants) for a list of ids, in one query: Map of id to row.
 * Inactive products are included, since a cart or an old order may still point at one.
 */
export function getProductRowsByIds(ctx, ids) {
  const wanted = cleanIds(ids);
  const rows = wanted.length > 0 ? ctx.db.all(`${PRODUCT_SELECT} WHERE p.id IN (SELECT value FROM json_each(?))`, [wanted]) : [];
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * ProductSummary[] for exactly these ids, in the order given (wishlist, compare, recently viewed, a build's parts).
 * Unknown ids, repeats and inactive products are dropped; pass includeInactive to keep the last.
 */
export function getProductsByIds(ctx, ids, { vehicleId, includeInactive = false } = {}) {
  const wanted = cleanIds(ids);
  const byId = getProductRowsByIds(ctx, wanted);
  const rows = wanted.map((id) => byId.get(id)).filter((row) => row && (includeInactive || row.is_active));
  const verdicts = fitVerdictsFor(ctx, rows, getVehicleRow(ctx, vehicleId));
  return rows.map((row) => toProductSummary(row, verdicts.get(row.id)));
}

/**
 * One product row (v_products plus has_variants), or null. A number looks up the id, a string the slug.
 * Inactive products are returned too: check row.is_active before showing one to a shopper.
 */
export function getProductRow(ctx, idOrSlug) {
  if (typeof idOrSlug === 'number') {
    const id = toId(idOrSlug);
    return id === null ? null : (ctx.db.get(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]) ?? null);
  }
  if (typeof idOrSlug !== 'string' || idOrSlug === '') return null;
  return ctx.db.get(`${PRODUCT_SELECT} WHERE p.slug = ?`, [idOrSlug]) ?? null;
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

const indiaDate = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

/**
 * What shoppers were actually charged over time, worked out from the regular price changes and the drops.
 *
 *   history       price_history rows, oldest first: { price, recorded_at }
 *   drops         drop windows the product was in: { percent_off, starts_at, ends_at } (active drops only)
 *   now           the present, as a timestamp or milliseconds; nothing later is counted
 *   currentPrice  the row's sale_price: added as today's point when the history does not end on it
 *
 * Returns { lowest30Days, priceHistory }:
 *   lowest30Days  the lowest price charged in the 30 days before the current price took effect,
 *                 or null when nothing was charged before it
 *   priceHistory  [{ date: 'YYYY-MM-DD' (the day in India), price }], oldest first, one point per day a price
 *                 changed, the last 60 at most
 */
export function priceTrail(history, drops = [], { now = Date.now(), currentPrice } = {}) {
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  const changes = history
    .map((entry) => ({ at: Date.parse(entry.recorded_at), price: Number(entry.price) }))
    .filter((change) => Number.isFinite(change.at) && Number.isFinite(change.price) && change.at <= nowMs)
    .sort((a, b) => a.at - b.at);
  const windows = drops
    .map((drop) => ({ from: Date.parse(drop.starts_at), to: Date.parse(drop.ends_at), percent: Number(drop.percent_off) }))
    .filter((window) => window.percent > 0 && window.from <= nowMs && window.to > window.from);

  const instants = new Set(changes.map((change) => change.at));
  for (const window of windows) {
    instants.add(window.from);
    if (window.to <= nowMs) instants.add(window.to);
  }

  // One point each time the price a shopper pays changed.
  const points = [];
  for (const at of [...instants].sort((a, b) => a - b)) {
    const regular = changes.findLast((change) => change.at <= at);
    if (!regular) continue;
    const percent = windows.reduce((highest, window) => (window.from <= at && at < window.to ? Math.max(highest, window.percent) : highest), 0);
    const price = applyDrop(regular.price, percent);
    if (points.at(-1)?.price !== price) points.push({ at, price });
  }
  if (Number.isFinite(currentPrice) && points.at(-1)?.price !== currentPrice) points.push({ at: nowMs, price: currentPrice });
  if (points.length === 0) return { lowest30Days: null, priceHistory: [] };

  // points[i] was the price from its own instant until the next one.
  const windowStart = points.at(-1).at - PRICE_LOOKBACK_DAYS * DAY_MS;
  let lowest30Days = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (points[index + 1].at > windowStart) lowest30Days = Math.min(lowest30Days ?? Infinity, points[index].price);
  }

  const byDay = new Map();
  for (const point of points) byDay.set(indiaDate(point.at), point.price);
  const priceHistory = [...byDay].map(([date, price]) => ({ date, price })).slice(-PRICE_HISTORY_POINTS);
  return { lowest30Days, priceHistory };
}

function loadPriceTrail(ctx, row) {
  const history = ctx.db.all('SELECT price, recorded_at FROM price_history WHERE product_id = ? ORDER BY recorded_at, id', [row.id]);
  const drops = ctx.db.all(
    `SELECT di.percent_off, dr.starts_at, dr.ends_at
     FROM drop_items di
     JOIN drops dr ON dr.id = di.drop_id
     WHERE di.product_id = ? AND dr.is_active = 1`,
    [row.id],
  );
  // The clock is the machine's, as in v_products, so the trail agrees with the sale_price beside it.
  return priceTrail(history, drops, { now: Date.now(), currentPrice: row.sale_price });
}

// ---------------------------------------------------------------------------
// Product page
// ---------------------------------------------------------------------------

function loadProductParts(ctx, row, { vehicleId, includeInactive }) {
  const vehicle = getVehicleRow(ctx, vehicleId);

  const variants = ctx.db
    .all('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY sort_order, id', [row.id])
    .map((variant) => toVariant(variant, row.drop_percent));

  const fitments = ctx.db
    .all(
      `SELECT pf.vehicle_id, pf.fit_type, pf.note, pf.is_verified, v.*
       FROM product_fitments pf
       JOIN vehicles v ON v.id = pf.vehicle_id
       WHERE pf.product_id = ?
       ORDER BY v.make, v.model, v.year_from DESC, v.id`,
      [row.id],
    )
    .map(toFitment);

  const relationRows = ctx.db.all(
    `SELECT related_id, kind, note FROM product_relations WHERE product_id = ?
     ORDER BY CASE kind WHEN 'requires' THEN 0 ELSE 1 END, rowid`,
    [row.id],
  );
  const relatedRows = getProductRowsByIds(ctx, relationRows.map((relation) => relation.related_id));

  // Same subcategory: in stock first, then (when a car is named) parts that are not ruled out for it.
  const similarClauses = ['p.category_id = :categoryId', 'p.id <> :productId', productWhereActive];
  const similarParams = { categoryId: row.category_id, productId: row.id, similarLimit: SIMILAR_LIMIT };
  let fitOrder = '';
  if (vehicle) {
    const fit = fitSql(vehicle);
    fitOrder = `((${fit.sql}) = 'no'), `;
    Object.assign(similarParams, fit.params);
  }
  const similarSql = `${PRODUCT_SELECT}${whereSql(similarClauses)}
    ORDER BY (p.stock > 0) DESC, ${fitOrder}p.is_featured DESC, p.sold_count DESC, p.rating_avg DESC, p.id
    LIMIT :similarLimit`;
  const similarRows = ctx.db.all(similarSql, pickParams(similarSql, similarParams));

  const verdicts = fitVerdictsFor(ctx, [row, ...relatedRows.values(), ...similarRows], vehicle);
  const summary = (productRow) => toProductSummary(productRow, verdicts.get(productRow.id));

  const relations = relationRows
    .filter((relation) => relatedRows.has(relation.related_id) && (includeInactive || relatedRows.get(relation.related_id).is_active))
    .map((relation) => toRelation(relation, summary(relatedRows.get(relation.related_id))));

  return {
    fit: verdicts.get(row.id),
    variants,
    fitments,
    relations,
    similar: similarRows.map(summary),
    ...loadPriceTrail(ctx, row),
  };
}

/**
 * The whole ProductDetail for GET /api/products/:slug, or null when there is no such product
 * (or it is inactive and includeInactive is not set): variants with any live drop applied, every
 * fitment with its vehicle, relations, up to 8 similar parts, lowest30Days and priceHistory.
 * vehicleId sets the fit verdict on the product and on every related and similar part.
 */
export function getProductDetail(ctx, slug, { vehicleId, includeInactive = false } = {}) {
  const row = getProductRow(ctx, slug);
  if (!row || (!includeInactive && !row.is_active)) return null;
  return toProductDetail(row, loadProductParts(ctx, row, { vehicleId, includeInactive }));
}

/**
 * The AdminProduct for the admin product endpoints, by id (number) or slug, or null.
 * Inactive products are returned, and relations to inactive products are kept so requiresIds and pairsWithIds are complete.
 */
export function getAdminProduct(ctx, idOrSlug) {
  const row = getProductRow(ctx, idOrSlug);
  if (!row) return null;
  return toAdminProduct(row, loadProductParts(ctx, row, { includeInactive: true }));
}
