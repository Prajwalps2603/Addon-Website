import { Router } from 'express';
import * as z from 'zod';
import { findProductRows, getAdminProduct, getCategory, getProductRow, whereIn } from '../../lib/catalog.js';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors.js';
import { slugify, uniqueSlug } from '../../lib/ids.js';
import { toAdminProduct } from '../../lib/mappers.js';
import { idParam, paginated, paginationOf, parse } from '../../lib/validate.js';

// Build Bay slots and the art styles each one accepts (BUILD_SPEC section 7).
export const BUILD_STYLES = {
  wheels: ['five-spoke', 'multi-spoke', 'mesh', 'split-spoke', 'turbine', 'steelie'],
  spoiler: ['lip', 'ducktail', 'roof', 'gt-wing'],
  splitter: ['lip', 'race'],
  skirts: ['blade'],
  diffuser: ['fins'],
  exhaust: ['single', 'twin', 'quad'],
  roofRack: ['crossbars', 'basket', 'box'],
  lightBar: ['roof-bar', 'bumper-pods'],
  underglow: ['glow'],
  decal: ['stripe', 'side-graphic'],
  bullBar: ['bar'],
  sideStep: ['board'],
  snorkel: ['snorkel'],
  lowering: ['springs', 'coilover'],
};

const BODY_TYPES = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'];
const KIT_GOALS = ['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection'];
const GST_RATES = [0, 3, 5, 12, 18, 28, 40];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const MAX_VARIANTS = 50;

const money = z.int().min(0).max(10_000_000);
const count = z.int().min(0).max(1_000_000);
const shortText = (max = 200) => z.string().trim().max(max);
const textList = (maxItems = 30, maxLength = 200) => z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);
const nullableText = (max = 60) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value));

const imageUrl = z
  .string()
  .trim()
  .refine((value) => /^\/[^\s]*$/.test(value) || /^https:\/\/[^\s]+$/.test(value), {
    error: 'Use an uploaded image (/uploads/...) or a full https:// address.',
  });

const labelSchema = z
  .object({
    legality: z.enum(['road_legal', 'check_rules', 'off_road_only']).default('road_legal'),
    legalityNote: shortText(400).default(''),
    warrantyImpact: z.enum(['none', 'possible', 'likely']).default('none'),
    warrantyNote: shortText(400).default(''),
    wiring: z.enum(['none', 'plug_and_play', 'splice']).default('none'),
    reversible: z.boolean().default(true),
    skipIf: shortText(300).default(''),
    installDifficulty: z.int().min(1).max(5).default(1),
    installTimeMin: z.int().min(0).max(10_000).default(15),
    installTimeMax: z.int().min(0).max(10_000).default(30),
    proInstall: z.boolean().default(false),
    fittingCostMin: money.default(0),
    fittingCostMax: money.default(0),
  })
  .superRefine((label, ctx) => {
    if (label.installTimeMax < label.installTimeMin) {
      ctx.addIssue({ code: 'custom', path: ['installTimeMax'], message: 'Must be at least the shortest fitting time.' });
    }
    if (label.fittingCostMax < label.fittingCostMin) {
      ctx.addIssue({ code: 'custom', path: ['fittingCostMax'], message: 'Must be at least the lowest fitting charge.' });
    }
    if (label.legality !== 'road_legal' && label.legalityNote === '') {
      ctx.addIssue({ code: 'custom', path: ['legalityNote'], message: 'Say in one line what the road rules are for this part.' });
    }
    if (label.warrantyImpact !== 'none' && label.warrantyNote === '') {
      ctx.addIssue({ code: 'custom', path: ['warrantyNote'], message: 'Say in one line how this can affect the car warranty.' });
    }
  });

const variantSchema = z
  .object({
    id: z.int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    sku: z.string().trim().min(1).max(60).regex(SKU_PATTERN, { error: 'Use letters, numbers, dots, dashes and slashes only.' }),
    price: money,
    mrp: money,
    stock: count.default(0),
    attributes: z.record(z.string().min(1).max(40), z.string().trim().max(80)).default({}),
  })
  .superRefine((variant, ctx) => {
    if (variant.price > variant.mrp) ctx.addIssue({ code: 'custom', path: ['price'], message: 'The price cannot be above the MRP.' });
  });

const fitmentSchema = z.object({
  vehicleId: z.int().positive(),
  fitType: z.enum(['direct', 'with_work', 'no']),
  note: shortText(300).default(''),
  isVerified: z.boolean().default(false),
});

const productSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .optional()
      .refine((value) => !value || SLUG_PATTERN.test(value), { error: 'Use lower-case letters, numbers and single dashes.' }),
    sku: z.string().trim().min(1).max(60).regex(SKU_PATTERN, { error: 'Use letters, numbers, dots, dashes and slashes only.' }),
    brand: shortText(80).default('Addon'),
    categoryId: z.int().positive(),
    shortDescription: shortText(300).default(''),
    description: z.string().trim().max(10_000).default(''),
    price: money,
    mrp: money,
    costPrice: money.nullable().default(null),
    stock: count.default(0),
    lowStockThreshold: count.default(5),
    supplier: shortText(120).default(''),
    hsnCode: z
      .string()
      .trim()
      .regex(/^(\d{4}|\d{6}|\d{8})?$/, { error: 'An HSN code has 4, 6 or 8 digits.' })
      .default(''),
    gstRate: z
      .int()
      .refine((rate) => GST_RATES.includes(rate), { error: `Use a GST rate of ${GST_RATES.join(', ')} percent.` })
      .default(18),
    weightGrams: z.int().min(0).max(1_000_000).default(500),
    shipClass: z.enum(['small', 'medium', 'bulky', 'freight']).default('small'),
    netQuantity: z.string().trim().min(1).max(60).default('1 piece'),
    manufacturer: shortText(300).default(''),
    countryOfOrigin: z.string().trim().min(1).max(60).default('India'),
    images: z.array(imageUrl).max(12).default([]),
    artKind: nullableText(40).default(null),
    finishColor: z
      .string()
      .trim()
      .regex(/^(#[0-9a-fA-F]{6})?$/, { error: 'Use a hex colour such as #1A1A1A, or leave it blank.' })
      .default(''),
    highlights: textList(12, 200).default([]),
    specs: z
      .array(z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().max(200) }))
      .max(40)
      .default([]),
    boxContents: textList(30, 120).default([]),
    tags: textList(30, 40).default([]),
    fitmentType: z.enum(['vehicle', 'body_type', 'pcd', 'universal', 'none']).default('universal'),
    bodyTypes: z.array(z.enum(BODY_TYPES)).max(BODY_TYPES.length).default([]),
    pcd: z
      .string()
      .trim()
      .regex(/^(\d+\s*[x×]\s*\d+(\.\d+)?)?$/i, { error: 'Write the bolt pattern like 4x100 or 5x114.3.' })
      .default(''),
    fitments: z.array(fitmentSchema).max(500).default([]),
    label: labelSchema.prefault({}),
    fittingTools: textList(30, 120).default([]),
    fittingSteps: z
      .array(z.object({ en: z.string().trim().min(1).max(500), hi: z.string().trim().max(500).default('') }))
      .max(40)
      .default([]),
    warrantyMonths: z.int().min(0).max(120).default(0),
    returnable: z.boolean().default(true),
    codEligible: z.boolean().default(true),
    goals: z.array(z.enum(KIT_GOALS)).max(KIT_GOALS.length).default([]),
    essentialRank: z.int().min(0).max(1000).default(0),
    buildSlot: z.enum(Object.keys(BUILD_STYLES)).nullable().default(null),
    buildStyle: nullableText(40).default(null),
    customKind: nullableText(40).default(null),
    isFeatured: z.boolean().default(false),
    isNew: z.boolean().default(false),
    isActive: z.boolean().default(true),
    variants: z.array(variantSchema).max(MAX_VARIANTS).default([]),
    requiresIds: z.array(z.int().positive()).max(30).default([]),
    pairsWithIds: z.array(z.int().positive()).max(30).default([]),
  })
  .superRefine((input, ctx) => {
    const issue = (path, message) => ctx.addIssue({ code: 'custom', path, message });
    if (input.variants.length === 0 && input.price > input.mrp) issue(['price'], 'The price cannot be above the MRP.');
    if (input.fitmentType === 'body_type' && input.bodyTypes.length === 0) issue(['bodyTypes'], 'Choose the body types this part is made for.');
    if (input.fitmentType === 'pcd' && input.pcd === '') issue(['pcd'], 'Enter the bolt pattern this wheel needs.');

    if ((input.buildSlot === null) !== (input.buildStyle === null)) {
      issue([input.buildSlot === null ? 'buildSlot' : 'buildStyle'], 'Set both the Build Bay slot and its style, or neither.');
    } else if (input.buildSlot !== null && !BUILD_STYLES[input.buildSlot].includes(input.buildStyle)) {
      issue(['buildStyle'], `For ${input.buildSlot} use one of: ${BUILD_STYLES[input.buildSlot].join(', ')}.`);
    }
    if (input.customKind === 'show-plate' && input.codEligible) issue(['codEligible'], 'Show plates are prepaid only.');

    const seen = new Map();
    input.variants.forEach((variant, index) => {
      const key = variant.sku.toLowerCase();
      if (seen.has(key)) issue(['variants', index, 'sku'], 'Two variants have this SKU.');
      seen.set(key, index);
      if (variant.sku.toLowerCase() === input.sku.toLowerCase()) issue(['variants', index, 'sku'], 'Give the variant its own SKU, not the product SKU.');
    });
    const variantIds = input.variants.map((variant) => variant.id).filter(Boolean);
    if (new Set(variantIds).size !== variantIds.length) issue(['variants'], 'The same variant is listed twice.');

    const vehicles = new Set();
    input.fitments.forEach((fitment, index) => {
      if (vehicles.has(fitment.vehicleId)) issue(['fitments', index, 'vehicleId'], 'This car is listed twice.');
      vehicles.add(fitment.vehicleId);
    });

    const requires = new Set(input.requiresIds);
    input.pairsWithIds.forEach((id, index) => {
      if (requires.has(id)) issue(['pairsWithIds', index], 'A part cannot be both required and a pairing.');
    });
  });

const patchSchema = z
  .object({
    stock: count.optional(),
    price: money.optional(),
    mrp: money.optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  })
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), { error: 'Send at least one change.' });

const listSchema = paginationOf({ defaultLimit: 20, maxLimit: 100 }).extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'inactive', 'low_stock', 'out_of_stock', '']).optional(),
});

const STATUS_WHERE = {
  active: 'p.is_active = 1',
  inactive: 'p.is_active = 0',
  low_stock: 'p.stock > 0 AND p.stock <= p.low_stock_threshold',
  out_of_stock: 'p.stock <= 0',
};

const likePattern = (text) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

const isUniqueViolation = (err) => err?.code === 'ERR_SQLITE_ERROR' && err?.errcode === 2067;

function fieldConflict(field, message) {
  return new HttpError(409, 'conflict', message, { [field]: message });
}

/** Checks everything that needs the database before a write, and returns the resolved slug. */
function checkReferences(ctx, input, productId) {
  const db = ctx.db;
  const category = db.get('SELECT id, parent_id FROM categories WHERE id = ?', [input.categoryId]);
  if (!category) throw badRequest('Choose a category.', { categoryId: 'That category does not exist.' });
  if (category.parent_id === null) {
    throw badRequest('Products go in a subcategory.', { categoryId: 'Choose a subcategory, not a top-level category.' });
  }

  const fields = {};
  if (input.fitments.length > 0) {
    const known = new Set(
      db.all('SELECT id FROM vehicles WHERE id IN (SELECT value FROM json_each(?))', [input.fitments.map((f) => f.vehicleId)]).map((row) => row.id),
    );
    input.fitments.forEach((fitment, index) => {
      if (!known.has(fitment.vehicleId)) fields[`fitments.${index}.vehicleId`] = 'That car is not in the list.';
    });
  }

  const relatedIds = [...input.requiresIds, ...input.pairsWithIds];
  if (relatedIds.length > 0) {
    const known = new Set(db.all('SELECT id FROM products WHERE id IN (SELECT value FROM json_each(?))', [relatedIds]).map((row) => row.id));
    for (const key of ['requiresIds', 'pairsWithIds']) {
      input[key].forEach((id, index) => {
        if (id === productId) fields[`${key}.${index}`] = 'A part cannot point to itself.';
        else if (!known.has(id)) fields[`${key}.${index}`] = 'That product does not exist.';
      });
    }
  }

  if (productId !== null) {
    const own = new Set(db.all('SELECT id FROM product_variants WHERE product_id = ?', [productId]).map((row) => row.id));
    input.variants.forEach((variant, index) => {
      if (variant.id !== undefined && !own.has(variant.id)) fields[`variants.${index}.id`] = 'That variant does not belong to this product.';
    });
  }
  if (Object.keys(fields).length > 0) throw badRequest('Check the highlighted fields.', fields);

  // Unique keys: say which field clashes.
  if (db.get('SELECT id FROM products WHERE sku = ? COLLATE NOCASE AND id IS NOT ?', [input.sku, productId])) {
    throw fieldConflict('sku', `Another product already uses the SKU ${input.sku}.`);
  }
  if (input.variants.length > 0) {
    const clash = db.get(
      'SELECT sku FROM product_variants WHERE LOWER(sku) IN (SELECT LOWER(value) FROM json_each(?)) AND product_id IS NOT ?',
      [input.variants.map((variant) => variant.sku), productId],
    );
    if (clash) {
      const index = input.variants.findIndex((variant) => variant.sku.toLowerCase() === String(clash.sku).toLowerCase());
      throw fieldConflict(`variants.${index}.sku`, `Another product already has a variant with the SKU ${clash.sku}.`);
    }
  }

  if (input.slug) {
    if (db.get('SELECT id FROM products WHERE slug = ? AND id IS NOT ?', [input.slug, productId])) {
      throw fieldConflict('slug', `Another product already uses the web address ${input.slug}.`);
    }
    return input.slug;
  }
  if (productId !== null) return db.get('SELECT slug FROM products WHERE id = ?', [productId]).slug;
  if (!slugify(input.name)) throw badRequest('Give the product a web address.', { slug: 'The name has no letters or numbers to make one from.' });
  return uniqueSlug(ctx, 'products', input.name);
}

/** The products columns an AdminProductInput sets, with price, MRP and stock taken from the variants when there are any. */
function productColumns(input, slug) {
  let { price, mrp, stock } = input;
  if (input.variants.length > 0) {
    const cheapest = input.variants.reduce((low, variant) => (variant.price < low.price ? variant : low));
    price = cheapest.price;
    mrp = cheapest.mrp;
    stock = input.variants.reduce((sum, variant) => sum + variant.stock, 0);
  }
  const { label } = input;
  return {
    slug,
    sku: input.sku,
    name: input.name,
    brand: input.brand,
    category_id: input.categoryId,
    short_description: input.shortDescription,
    description: input.description,
    price,
    mrp,
    cost_price: input.costPrice,
    stock,
    low_stock_threshold: input.lowStockThreshold,
    supplier: input.supplier,
    hsn_code: input.hsnCode,
    gst_rate: input.gstRate,
    weight_grams: input.weightGrams,
    ship_class: input.shipClass,
    net_quantity: input.netQuantity,
    manufacturer: input.manufacturer,
    country_of_origin: input.countryOfOrigin,
    images: input.images,
    art_kind: input.artKind,
    finish_color: input.finishColor,
    highlights: input.highlights,
    specs: input.specs,
    box_contents: input.boxContents,
    tags: input.tags,
    fitment_type: input.fitmentType,
    body_types: [...new Set(input.bodyTypes)],
    pcd: input.pcd,
    legality: label.legality,
    legality_note: label.legalityNote,
    warranty_impact: label.warrantyImpact,
    warranty_note: label.warrantyNote,
    wiring: label.wiring,
    reversible: label.reversible,
    skip_if: label.skipIf,
    install_difficulty: label.installDifficulty,
    install_time_min: label.installTimeMin,
    install_time_max: label.installTimeMax,
    pro_install: label.proInstall,
    fitting_cost_min: label.fittingCostMin,
    fitting_cost_max: label.fittingCostMax,
    fitting_tools: input.fittingTools,
    fitting_steps: input.fittingSteps,
    warranty_months: input.warrantyMonths,
    returnable: input.returnable,
    cod_eligible: input.codEligible,
    goals: input.goals,
    essential_rank: input.essentialRank,
    build_slot: input.buildSlot,
    build_style: input.buildStyle,
    custom_kind: input.customKind,
    is_featured: input.isFeatured,
    is_new: input.isNew,
    is_active: input.isActive,
  };
}

function syncVariants(db, productId, variants) {
  const keep = variants.map((variant) => variant.id).filter(Boolean);
  db.run('DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (SELECT value FROM json_each(?))', [productId, keep]);
  // Kept variants may swap SKUs with each other: park them on placeholders first so UNIQUE never trips mid-way.
  if (keep.length > 0) {
    db.run("UPDATE product_variants SET sku = '~' || id || '~' || sku WHERE product_id = ? AND id IN (SELECT value FROM json_each(?))", [productId, keep]);
  }
  variants.forEach((variant, index) => {
    const values = {
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      mrp: variant.mrp,
      stock: variant.stock,
      attributes: variant.attributes,
      sortOrder: index + 1,
    };
    if (variant.id) {
      db.run(
        `UPDATE product_variants SET name = :name, sku = :sku, price = :price, mrp = :mrp, stock = :stock,
           attributes = :attributes, sort_order = :sortOrder, is_active = 1
         WHERE id = :id AND product_id = :productId`,
        { ...values, id: variant.id, productId },
      );
    } else {
      db.run(
        `INSERT INTO product_variants (product_id, name, sku, price, mrp, stock, attributes, sort_order)
         VALUES (:productId, :name, :sku, :price, :mrp, :stock, :attributes, :sortOrder)`,
        { ...values, productId },
      );
    }
  });
}

function replaceFitmentsAndRelations(db, productId, input) {
  db.run('DELETE FROM product_fitments WHERE product_id = ?', [productId]);
  for (const fitment of input.fitments) {
    db.run('INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note, is_verified) VALUES (?, ?, ?, ?, ?)', [
      productId,
      fitment.vehicleId,
      fitment.fitType,
      fitment.note,
      fitment.isVerified,
    ]);
  }
  db.run('DELETE FROM product_relations WHERE product_id = ?', [productId]);
  const relations = [
    ...[...new Set(input.requiresIds)].map((id) => [id, 'requires']),
    ...[...new Set(input.pairsWithIds)].map((id) => [id, 'pairs_with']),
  ];
  for (const [relatedId, kind] of relations) {
    db.run('INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, ?)', [productId, relatedId, kind]);
  }
}

function recordPrice(ctx, productId, price, mrp) {
  ctx.db.run('INSERT INTO price_history (product_id, price, mrp, recorded_at) VALUES (?, ?, ?, ?)', [productId, price, mrp, ctx.now()]);
}

function translateUnique(err) {
  if (!isUniqueViolation(err)) return err;
  const message = String(err.message);
  if (message.includes('product_variants.sku')) return fieldConflict('variants', 'A variant SKU is already in use.');
  if (message.includes('products.sku')) return fieldConflict('sku', 'Another product already uses this SKU.');
  if (message.includes('products.slug')) return fieldConflict('slug', 'Another product already uses this web address.');
  return conflict('That clashes with something that already exists.');
}

function loadProduct(ctx, id) {
  const product = getAdminProduct(ctx, id);
  if (!product) throw notFound('Product');
  return product;
}

export default function adminProductsRoutes(ctx) {
  const router = Router();

  router.get('/products', (req, res) => {
    const query = parse(listSchema, req.query);
    const where = [];
    const params = {};
    if (query.q) {
      where.push(
        `(p.name LIKE :q ESCAPE '\\' OR p.sku LIKE :q ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku LIKE :q ESCAPE '\\'))`,
      );
      params.q = likePattern(query.q);
    }
    if (query.category) {
      const key = /^\d+$/.test(query.category) ? Number(query.category) : query.category;
      const category = getCategory(ctx, key, { includeInactive: true });
      if (!category) throw notFound('Category');
      const inCategory = whereIn('p.category_id', [category.id, ...category.children.map((child) => child.id)], 'cat');
      where.push(inCategory.sql);
      Object.assign(params, inCategory.params);
    }
    if (query.status) where.push(STATUS_WHERE[query.status]);

    const { rows, total } = findProductRows(ctx, {
      where,
      params,
      orderBy: 'p.created_at DESC, p.id DESC',
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      includeInactive: true,
    });
    res.json(paginated(rows.map((row) => toAdminProduct(row)), total, query));
  });

  router.get('/products/:id', (req, res) => {
    res.json(loadProduct(ctx, parse(idParam, req.params.id)));
  });

  router.post('/products', (req, res) => {
    const input = parse(productSchema, req.body);
    let id;
    try {
      id = ctx.db.tx(() => {
        const slug = checkReferences(ctx, input, null);
        const columns = productColumns(input, slug);
        const now = ctx.now();
        const names = Object.keys(columns);
        const productId = Number(
          ctx.db.run(
            `INSERT INTO products (${names.join(', ')}, created_at, updated_at)
             VALUES (${names.map((name) => `:${name}`).join(', ')}, :createdAt, :updatedAt)`,
            { ...columns, createdAt: now, updatedAt: now },
          ).lastInsertRowid,
        );
        syncVariants(ctx.db, productId, input.variants.map(({ id: _ignored, ...variant }) => variant));
        replaceFitmentsAndRelations(ctx.db, productId, input);
        recordPrice(ctx, productId, columns.price, columns.mrp);
        return productId;
      });
    } catch (err) {
      throw translateUnique(err);
    }
    res.status(201).json(loadProduct(ctx, id));
  });

  router.put('/products/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(productSchema, req.body);
    try {
      ctx.db.tx(() => {
        const existing = ctx.db.get('SELECT id, price FROM products WHERE id = ?', [id]);
        if (!existing) throw notFound('Product');
        const slug = checkReferences(ctx, input, id);
        const columns = productColumns(input, slug);
        const names = Object.keys(columns);
        ctx.db.run(`UPDATE products SET ${names.map((name) => `${name} = :${name}`).join(', ')}, updated_at = :updatedAt WHERE id = :id`, {
          ...columns,
          updatedAt: ctx.now(),
          id,
        });
        syncVariants(ctx.db, id, input.variants);
        replaceFitmentsAndRelations(ctx.db, id, input);
        if (existing.price !== columns.price) recordPrice(ctx, id, columns.price, columns.mrp);
      });
    } catch (err) {
      throw translateUnique(err);
    }
    res.json(loadProduct(ctx, id));
  });

  router.patch('/products/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const patch = parse(patchSchema, req.body);
    ctx.db.tx(() => {
      const row = getProductRow(ctx, id);
      if (!row) throw notFound('Product');
      const touchesStock = patch.stock !== undefined || patch.price !== undefined || patch.mrp !== undefined;
      if (touchesStock && ctx.db.get('SELECT 1 AS found FROM product_variants WHERE product_id = ?', [id])) {
        throw badRequest('This product has variants. Change their price and stock in the full product form.');
      }
      const price = patch.price ?? row.price;
      const mrp = patch.mrp ?? row.mrp;
      if (price > mrp) throw badRequest('The price cannot be above the MRP.', { [patch.price !== undefined ? 'price' : 'mrp']: 'The price cannot be above the MRP.' });
      ctx.db.run(
        `UPDATE products SET stock = :stock, price = :price, mrp = :mrp, is_active = :isActive, is_featured = :isFeatured, updated_at = :now
         WHERE id = :id`,
        {
          stock: patch.stock ?? row.stock,
          price,
          mrp,
          isActive: patch.isActive ?? Boolean(row.is_active),
          isFeatured: patch.isFeatured ?? Boolean(row.is_featured),
          now: ctx.now(),
          id,
        },
      );
      if (price !== row.price) recordPrice(ctx, id, price, mrp);
    });
    res.json(loadProduct(ctx, id));
  });

  router.delete('/products/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const result = ctx.db.tx(() => {
      const row = ctx.db.get('SELECT id FROM products WHERE id = ?', [id]);
      if (!row) throw notFound('Product');
      if (ctx.db.get('SELECT 1 AS found FROM order_items WHERE product_id = ? LIMIT 1', [id])) {
        ctx.db.run('UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?', [ctx.now(), id]);
        return {
          ok: true,
          deleted: false,
          deactivated: true,
          message: 'This part is on past orders, so it was hidden from the shop instead of deleted.',
        };
      }
      ctx.db.run('DELETE FROM products WHERE id = ?', [id]);
      return { ok: true, deleted: true, deactivated: false, message: 'Product deleted.' };
    });
    res.json(result);
  });

  return router;
}
