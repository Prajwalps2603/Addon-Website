import { Router } from 'express';
import * as z from 'zod';
import {
  categoryTree,
  findProducts,
  fitSql,
  fitVerdictsFor,
  getProductDetail,
  getProductRowsByIds,
  getProductsByIds,
  getVehicle,
  getVehicleRow,
  listVehicleMakes,
  productWhereActive,
  whereIn,
} from '../lib/catalog.js';
import { notFound } from '../lib/errors.js';
import { idList, toBuild, toCategoryPick, toDrop, toProductSummary, toVehicle } from '../lib/mappers.js';
import { expandQuery, logSearch, matchCategories, matchVehicles, searchProducts } from '../lib/search.js';
import { idParam, paginated, parse } from '../lib/validate.js';

// ---------------------------------------------------------------------------
// Query validation
// ---------------------------------------------------------------------------

const BODY_TYPES = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'];
const LEGALITY = ['road_legal', 'check_rules', 'off_road_only'];
const BUILD_SLOTS = [
  'wheels', 'spoiler', 'splitter', 'skirts', 'diffuser', 'exhaust', 'roofRack',
  'lightBar', 'underglow', 'decal', 'bullBar', 'sideStep', 'snorkel', 'lowering',
];
// 'fit' ranks direct fits first for the chosen car (then with work, universal, unchecked); without a car it is the default order.
const SORTS = ['relevance', 'popular', 'newest', 'price_asc', 'price_desc', 'rating', 'discount', 'fit'];
const MAX_IDS = 100;

// Query strings arrive as text; a repeated key arrives as an array (the last one wins) and a blank one means "not set".
function cleanQuery(query) {
  const out = {};
  for (const [key, raw] of Object.entries(query ?? {})) {
    const value = Array.isArray(raw) ? raw.at(-1) : raw;
    if (typeof value === 'string' && value.trim() !== '') out[key] = value;
  }
  return out;
}

const flag = z
  .enum(['1', '0', 'true', 'false'], { error: "Use '1' or leave it out." })
  .transform((value) => value === '1' || value === 'true')
  .optional();
const rupees = z.coerce.number().int({ error: 'Enter a whole number of rupees.' }).min(0).max(10_000_000).optional();

const productQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z
      .string()
      .trim()
      .max(100)
      .regex(/^[a-z0-9][a-z0-9-]*$/i, { error: 'That category is not valid.' })
      .optional(),
    vehicleId: idParam.optional(),
    fitOnly: flag,
    bodyType: z.enum(BODY_TYPES).optional(),
    minPrice: rupees,
    maxPrice: rupees,
    inStock: flag,
    onSale: flag,
    inDrop: flag,
    isNew: flag,
    featured: flag,
    legality: z.enum(LEGALITY).optional(),
    maxDifficulty: z.coerce.number().int().min(1).max(5).optional(),
    tags: z.string().trim().max(400).optional(),
    // One Build Bay slot, or several separated by commas (the Build Bay lists every slot in one request).
    buildSlot: z
      .string()
      .transform((value) => [...new Set(value.split(',').map((slot) => slot.trim()).filter(Boolean))])
      .pipe(z.array(z.enum(BUILD_SLOTS, { error: 'That Build Bay slot is not valid.' })).min(1).max(BUILD_SLOTS.length))
      .optional(),
    ids: z
      .string()
      .regex(/^\s*\d+(\s*,\s*\d+)*\s*,?\s*$/, { error: 'Give product ids separated by commas.' })
      .transform((value) => idList(JSON.stringify(value.split(',').map((id) => id.trim()).filter(Boolean))))
      .refine((ids) => ids.length <= MAX_IDS, { error: `No more than ${MAX_IDS} ids.` })
      .optional(),
    sort: z.enum(SORTS).optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(24),
  })
  .refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
    path: ['maxPrice'],
    error: 'The highest price must be at least the lowest.',
  });

const vehicleQuerySchema = z.object({ vehicleId: idParam.optional() });
const suggestQuerySchema = z.object({ q: z.string().trim().max(120).default(''), vehicleId: idParam.optional() });

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

const IN_STOCK_FIRST = '(p.stock > 0) DESC';
const ORDERS = {
  popular: `${IN_STOCK_FIRST}, p.sold_count DESC, p.rating_avg DESC`,
  rating: `${IN_STOCK_FIRST}, p.rating_avg DESC, p.rating_count DESC, p.sold_count DESC`,
  discount: `${IN_STOCK_FIRST}, (CASE WHEN p.mrp > 0 THEN (p.mrp - p.sale_price) * 1.0 / p.mrp ELSE 0 END) DESC, p.sold_count DESC`,
  newest: `${IN_STOCK_FIRST}, p.created_at DESC, p.id DESC`,
  price_asc: `${IN_STOCK_FIRST}, p.sale_price ASC`,
  price_desc: `${IN_STOCK_FIRST}, p.sale_price DESC`,
  default: `${IN_STOCK_FIRST}, p.is_featured DESC, p.sold_count DESC, p.id DESC`,
};

const FITS = "('direct', 'with_work', 'universal')";
const ON_SALE_SQL = '(p.sale_price < p.mrp OR p.drop_percent > 0)';
const jsonListOf = (column) => `json_each(CASE WHEN json_valid(${column}) THEN ${column} ELSE '[]' END)`;

// node:sqlite refuses named parameters a statement does not use; keep the ones it mentions.
function pick(sql, params) {
  const picked = {};
  for (const [, name] of sql.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)) {
    if (Object.hasOwn(params, name)) picked[name] = params[name];
  }
  return picked;
}

function whereSql(clauses) {
  const all = [productWhereActive, ...clauses];
  return ` WHERE ${all.map((clause) => `(${clause})`).join(' AND ')}`;
}

function findCategory(tree, slug) {
  for (const top of tree) {
    if (top.slug === slug) return top;
    const child = top.children.find((sub) => sub.slug === slug);
    if (child) return child;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

/**
 * Facets over the result set. `filters` are the named filter groups: the category group is left out of the
 * category counts and the price group out of the price range, so the shopper can switch either.
 */
function computeFacets(ctx, filters, params, { tree, vehicleRow }) {
  const all = (except) => Object.entries(filters).flatMap(([group, clauses]) => (group === except ? [] : clauses));
  const run = (sql, method = 'all') => ctx.db[method](sql, pick(sql, params));

  const filter = whereSql(all());
  const fitsSql = vehicleRow ? `, SUM((${fitSql(vehicleRow).sql}) IN ${FITS}) AS fits` : '';
  const totals = run(
    `SELECT COUNT(*) AS total, SUM(p.stock > 0) AS in_stock, SUM(${ON_SALE_SQL}) AS on_sale${fitsSql} FROM v_products p${filter}`,
    'get',
  );
  const price = run(`SELECT MIN(p.sale_price) AS min, MAX(p.sale_price) AS max FROM v_products p${whereSql(all('price'))}`, 'get');
  const legality = run(`SELECT p.legality AS value, COUNT(*) AS count FROM v_products p${filter} GROUP BY p.legality ORDER BY count DESC, value`);
  const tags = run(
    `SELECT t.value AS tag, COUNT(DISTINCT p.id) AS count
     FROM v_products p, ${jsonListOf('p.tags')} t${filter} AND t.type = 'text'
     GROUP BY t.value ORDER BY count DESC, tag LIMIT 40`,
  );
  const byCategory = new Map(
    run(`SELECT p.category_id AS id, COUNT(*) AS count FROM v_products p${whereSql(all('category'))} GROUP BY p.category_id`).map((row) => [
      row.id,
      row.count,
    ]),
  );

  const categories = [];
  for (const top of tree) {
    const children = top.children
      .map((child) => ({ slug: child.slug, name: child.name, parentSlug: top.slug, count: byCategory.get(child.id) ?? 0 }))
      .filter((child) => child.count > 0);
    const count = children.reduce((sum, child) => sum + child.count, byCategory.get(top.id) ?? 0);
    if (count > 0) categories.push({ slug: top.slug, name: top.name, parentSlug: null, count }, ...children);
  }

  return {
    categories,
    price: { min: price?.min ?? 0, max: price?.max ?? 0 },
    tags: tags.map((row) => ({ tag: row.tag, count: row.count })),
    legality: legality.map((row) => ({ value: row.value, count: row.count })),
    inStockCount: totals?.in_stock ?? 0,
    onSaleCount: totals?.on_sale ?? 0,
    fitsCount: totals?.fits ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Shared reads
// ---------------------------------------------------------------------------

/** The live Friday Five as a Drop, or null. Uses the database clock, as v_products does, so prices agree. */
function currentDrop(ctx, vehicleId) {
  const row = ctx.db.get(
    `SELECT * FROM drops
     WHERE is_active = 1
       AND starts_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now')
       AND ends_at   >  strftime('%Y-%m-%dT%H:%M:%SZ','now')
     ORDER BY starts_at DESC, id DESC LIMIT 1`,
  );
  if (!row) return null;
  const items = ctx.db.all('SELECT * FROM drop_items WHERE drop_id = ? ORDER BY rowid', [row.id]);
  const products = new Map(getProductsByIds(ctx, items.map((item) => item.product_id), { vehicleId }).map((product) => [product.id, product]));
  return toDrop(
    row,
    items.map((item) => ({ ...item, product: products.get(item.product_id) })),
  );
}

const TIER_ORDER = "CASE tier WHEN 'sensible' THEN 0 WHEN 'sweet_spot' THEN 1 ELSE 2 END";

function categoryPicks(ctx, category, vehicleId) {
  if (!category || category.parentId === null) return [];
  const rows = ctx.db.all(`SELECT * FROM category_picks WHERE category_id = ? ORDER BY ${TIER_ORDER}`, [category.id]);
  const products = new Map(getProductsByIds(ctx, rows.map((row) => row.product_id), { vehicleId }).map((product) => [product.id, product]));
  return rows.filter((row) => products.has(row.product_id)).map((row) => toCategoryPick(row, products.get(row.product_id)));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default function catalogRoutes(ctx) {
  const router = Router();

  router.get('/categories', (req, res) => {
    res.json(categoryTree(ctx));
  });

  router.get('/vehicles', (req, res) => {
    res.json(listVehicleMakes(ctx));
  });

  router.get('/vehicles/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const vehicle = getVehicle(ctx, id);
    if (!vehicle) throw notFound('Vehicle');
    res.json(vehicle);
  });

  router.get('/products', (req, res) => {
    const query = parse(productQuerySchema, cleanQuery(req.query));
    const vehicleRow = getVehicleRow(ctx, query.vehicleId);
    const vehicle = vehicleRow ? toVehicle(vehicleRow) : null;
    const tree = categoryTree(ctx);
    const params = {};
    const filters = { category: [], price: [], rest: [] };

    // An exact set (wishlist, compare, recently viewed): in the order asked, no paging, no other filters.
    if (query.ids) {
      const items = getProductsByIds(ctx, query.ids, { vehicleId: vehicleRow?.id });
      const list = whereIn('p.id', items.map((item) => item.id), 'pid');
      filters.rest.push(list.sql);
      Object.assign(params, list.params);
      if (vehicleRow) Object.assign(params, fitSql(vehicleRow).params);
      res.json({
        ...paginated(items, items.length, { page: 1, limit: Math.max(items.length, 1) }),
        facets: computeFacets(ctx, filters, params, { tree, vehicleRow }),
        vehicle,
        category: null,
        picks: [],
        understoodAs: null,
      });
      return;
    }

    let category = null;
    if (query.category) {
      category = findCategory(tree, query.category);
      if (!category) throw notFound('Category');
      const inCategory = whereIn('p.category_id', [category.id, ...category.children.map((child) => child.id)], 'cat');
      filters.category.push(inCategory.sql);
      Object.assign(params, inCategory.params);
    }

    if (query.minPrice !== undefined) {
      filters.price.push('p.sale_price >= :minPrice');
      params.minPrice = query.minPrice;
    }
    if (query.maxPrice !== undefined) {
      filters.price.push('p.sale_price <= :maxPrice');
      params.maxPrice = query.maxPrice;
    }

    const rest = filters.rest;
    if (query.inStock) rest.push('p.stock > 0');
    if (query.onSale) rest.push(ON_SALE_SQL);
    if (query.inDrop) rest.push('p.drop_percent > 0');
    if (query.isNew) rest.push('p.is_new = 1');
    if (query.featured) rest.push('p.is_featured = 1');
    if (query.legality) {
      rest.push('p.legality = :legality');
      params.legality = query.legality;
    }
    if (query.maxDifficulty !== undefined) {
      rest.push('p.install_difficulty <= :maxDifficulty');
      params.maxDifficulty = query.maxDifficulty;
    }
    if (query.buildSlot) {
      rest.push('p.build_slot IN (SELECT value FROM json_each(:buildSlots))');
      params.buildSlots = query.buildSlot;
    }
    if (query.tags) {
      const tagList = [...new Set(query.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
      if (tagList.length > 0) {
        rest.push(`EXISTS (SELECT 1 FROM ${jsonListOf('p.tags')} t WHERE t.type = 'text' AND LOWER(t.value) IN (SELECT value FROM json_each(:tagList)))`);
        params.tagList = tagList;
      }
    }
    if (query.bodyType) {
      // Parts that suit that kind of car: universal ones, wheels by bolt pattern, those made for the body type,
      // and car-specific parts listed for at least one car of that body type.
      rest.push(`(p.fitment_type IN ('universal', 'none', 'pcd')
        OR (p.fitment_type = 'body_type' AND EXISTS (SELECT 1 FROM ${jsonListOf('p.body_types')} bt WHERE bt.value = :bodyType))
        OR (p.fitment_type = 'vehicle' AND EXISTS (
          SELECT 1 FROM product_fitments bpf JOIN vehicles bv ON bv.id = bpf.vehicle_id
          WHERE bpf.product_id = p.id AND bpf.fit_type <> 'no' AND bv.body_type = :bodyType)))`);
      params.bodyType = query.bodyType;
    }
    if (vehicleRow) {
      const fit = fitSql(vehicleRow);
      Object.assign(params, fit.params);
      if (query.fitOnly) rest.push(`(${fit.sql}) <> 'no'`);
    }

    // Search.
    const q = query.q ?? '';
    let understoodAs = null;
    let scores = null;
    if (q !== '') {
      const result = searchProducts(ctx, q, { vehicleRow });
      understoodAs = result.understoodAs;
      scores = result.scores;
      if (scores) {
        rest.push('p.id IN (SELECT value FROM json_each(:matchIds))');
        params.matchIds = [...scores.keys()];
      }
    }

    const offset = (query.page - 1) * query.limit;
    const sort = query.sort ?? (scores ? 'relevance' : 'default');
    let items;
    let total;
    if (sort === 'relevance' && scores) {
      // Rank in JavaScript: in stock first, then relevance, then best selling.
      const sql = `SELECT p.id, p.stock, p.sold_count FROM v_products p${whereSql([...filters.category, ...filters.price, ...rest])}`;
      const matched = ctx.db.all(sql, pick(sql, params));
      matched.sort(
        (a, b) =>
          Number(b.stock > 0) - Number(a.stock > 0) ||
          (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
          b.sold_count - a.sold_count ||
          a.id - b.id,
      );
      total = matched.length;
      const pageIds = matched.slice(offset, offset + query.limit).map((row) => row.id);
      const rows = getProductRowsByIds(ctx, pageIds);
      const pageRows = pageIds.map((id) => rows.get(id)).filter(Boolean);
      const verdicts = fitVerdictsFor(ctx, pageRows, vehicleRow);
      items = pageRows.map((row) => toProductSummary(row, verdicts.get(row.id)));
    } else {
      const found = findProducts(ctx, {
        where: [...filters.category, ...filters.price, ...rest],
        params,
        orderBy:
          sort === 'fit' && vehicleRow
            ? `${IN_STOCK_FIRST}, CASE (${fitSql(vehicleRow).sql}) WHEN 'direct' THEN 0 WHEN 'with_work' THEN 1 WHEN 'universal' THEN 2 WHEN 'unknown' THEN 3 ELSE 4 END, ${ORDERS.default.replace(`${IN_STOCK_FIRST}, `, '')}`
            : (ORDERS[sort] ?? ORDERS.default),
        limit: query.limit,
        offset,
        vehicleId: vehicleRow?.id,
      });
      items = found.items;
      total = found.total;
    }

    if (q !== '' && query.page === 1) logSearch(ctx, q, total, vehicleRow?.id ?? null);

    res.json({
      ...paginated(items, total, query),
      facets: computeFacets(ctx, filters, params, { tree, vehicleRow }),
      vehicle,
      category,
      picks: categoryPicks(ctx, category, vehicleRow?.id),
      understoodAs,
    });
  });

  router.get('/products/:slug', (req, res) => {
    const { vehicleId } = parse(vehicleQuerySchema, cleanQuery(req.query));
    const product = getProductDetail(ctx, req.params.slug, { vehicleId });
    if (!product) throw notFound('Product');
    res.json(product);
  });

  router.get('/search/suggest', (req, res) => {
    const { q, vehicleId } = parse(suggestQuerySchema, cleanQuery(req.query));
    if (q === '') {
      res.json({ products: [], categories: [], vehicles: [], understoodAs: null });
      return;
    }
    const vehicleRow = getVehicleRow(ctx, vehicleId);
    const { scores, understoodAs } = searchProducts(ctx, q, { vehicleRow });
    let products = [];
    if (scores && scores.size > 0) {
      const ranked = ctx.db
        .all(`SELECT id, stock, sold_count FROM products WHERE is_active = 1 AND id IN (SELECT value FROM json_each(?))`, [[...scores.keys()]])
        .sort(
          (a, b) =>
            Number(b.stock > 0) - Number(a.stock > 0) || scores.get(b.id) - scores.get(a.id) || b.sold_count - a.sold_count || a.id - b.id,
        );
      products = getProductsByIds(
        ctx,
        ranked.slice(0, 6).map((row) => row.id),
        { vehicleId: vehicleRow?.id },
      );
    }
    const { terms } = expandQuery(ctx, q);
    res.json({
      products,
      categories: matchCategories(ctx, terms, 4),
      vehicles: matchVehicles(ctx, terms, 4),
      understoodAs,
    });
  });

  router.get('/home', (req, res) => {
    const { vehicleId } = parse(vehicleQuerySchema, cleanQuery(req.query));
    const vehicleRow = getVehicleRow(ctx, vehicleId);
    const carId = vehicleRow?.id;
    const list = (options) => findProducts(ctx, { limit: 8, vehicleId: carId, ...options }).items;

    const featured = list({ where: ['p.is_featured = 1'], orderBy: ORDERS.default });
    const newArrivals = list({ orderBy: `${IN_STOCK_FIRST}, p.is_new DESC, p.created_at DESC, p.id DESC` });
    const bestSellers = list({ orderBy: ORDERS.popular });

    let forYourCar = [];
    if (vehicleRow) {
      const fit = fitSql(vehicleRow);
      forYourCar = list({
        where: [`(${fit.sql}) IN ${FITS}`],
        params: fit.params,
        orderBy: `${IN_STOCK_FIRST}, CASE (${fit.sql}) WHEN 'direct' THEN 0 WHEN 'with_work' THEN 1 ELSE 2 END, p.sold_count DESC`,
      });
    }

    const popularVehicles = ctx.db
      .all('SELECT * FROM vehicles WHERE is_popular = 1 ORDER BY sort_order, year_from DESC, id LIMIT 12')
      .map(toVehicle);

    // Approved builds, house builds first, with every build's parts read in one go.
    const buildRows = ctx.db.all(
      "SELECT * FROM builds WHERE status = 'approved' ORDER BY is_house DESC, created_at DESC, id DESC LIMIT 6",
    );
    const partIds = [...new Set(buildRows.flatMap((row) => idList(row.product_ids)))];
    const parts = new Map(getProductsByIds(ctx, partIds, { vehicleId: carId }).map((product) => [product.id, product]));
    const builds = buildRows.map((row) =>
      toBuild(
        row,
        idList(row.product_ids)
          .map((id) => parts.get(id))
          .filter(Boolean),
      ),
    );

    res.json({
      categories: categoryTree(ctx),
      featured,
      newArrivals,
      bestSellers,
      drop: currentDrop(ctx, carId),
      popularVehicles,
      builds,
      forYourCar,
    });
  });

  router.get('/drops/current', (req, res) => {
    const { vehicleId } = parse(vehicleQuerySchema, cleanQuery(req.query));
    res.json(currentDrop(ctx, getVehicleRow(ctx, vehicleId)?.id));
  });

  return router;
}
