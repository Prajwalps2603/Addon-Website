import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';

let t;
let admin;
before(async () => {
  t = await startTestApp();
  admin = t.asAdmin();
});
after(() => t.close());

const iso = (ms) => `${new Date(ms).toISOString().slice(0, 19)}Z`;
const HOUR = 60 * 60 * 1000;

let skuCounter = 0;
function fullInput(overrides = {}) {
  skuCounter += 1;
  const { vehicles, categories, products } = t.fixtures;
  return {
    name: `Addon Test Diffuser ${skuCounter}`,
    sku: `T-NEW-${String(skuCounter).padStart(3, '0')}`,
    brand: 'Addon Aero',
    categoryId: categories.spoilers.id,
    shortDescription: 'A rear diffuser with four fins.',
    description: 'First paragraph.\n\nSecond paragraph.',
    price: 4999,
    mrp: 6499,
    costPrice: 2800,
    stock: 7,
    lowStockThreshold: 3,
    supplier: 'Pune Plastics',
    hsnCode: '87089900',
    gstRate: 28,
    weightGrams: 2200,
    shipClass: 'bulky',
    netQuantity: '1 piece',
    manufacturer: 'Addon Auto Motive, Pune',
    countryOfOrigin: 'India',
    images: ['/uploads/abc.webp', '/catalog/diffuser/one.webp'],
    artKind: 'diffuser',
    finishColor: '#1A1A1A',
    highlights: ['Four fins', 'ABS plastic'],
    specs: [
      { label: 'Material', value: 'ABS' },
      { label: 'Finish', value: 'Matte black' },
    ],
    boxContents: ['Diffuser', 'Screws'],
    tags: ['diffuser', 'rear'],
    fitmentType: 'vehicle',
    bodyTypes: [],
    pcd: '',
    fitments: [
      { vehicleId: vehicles.swiftOld.id, fitType: 'direct', note: '', isVerified: true },
      { vehicleId: vehicles.creta.id, fitType: 'no', note: 'Bumper shape differs.', isVerified: false },
    ],
    label: {
      legality: 'check_rules',
      legalityNote: 'Must not stick out past the bumper.',
      warrantyImpact: 'possible',
      warrantyNote: 'Drilling the bumper can void paint warranty.',
      wiring: 'none',
      reversible: false,
      skipIf: 'You park on steep ramps.',
      installDifficulty: 3,
      installTimeMin: 45,
      installTimeMax: 90,
      proInstall: true,
      fittingCostMin: 300,
      fittingCostMax: 600,
    },
    fittingTools: ['Drill', '10 mm spanner'],
    fittingSteps: [
      { en: 'Clean the bumper.', hi: 'बम्पर साफ़ करें।' },
      { en: 'Drill and fix.', hi: '' },
    ],
    warrantyMonths: 6,
    returnable: false,
    codEligible: true,
    goals: ['sporty'],
    essentialRank: 4,
    buildSlot: 'diffuser',
    buildStyle: 'fins',
    customKind: null,
    isFeatured: true,
    isNew: true,
    isActive: true,
    variants: [],
    requiresIds: [products.universal.id],
    pairsWithIds: [products.bodyType.id],
    ...overrides,
  };
}

/** The parts of an AdminProduct that should equal the AdminProductInput that wrote it. */
function asInput(product) {
  return {
    name: product.name,
    sku: product.sku,
    brand: product.brand,
    categoryId: product.categoryId,
    shortDescription: product.shortDescription,
    description: product.description,
    price: product.regularPrice,
    mrp: product.mrp,
    costPrice: product.costPrice,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    supplier: product.supplier,
    hsnCode: product.hsnCode,
    gstRate: product.gstRate,
    weightGrams: product.weightGrams,
    shipClass: product.shipClass,
    netQuantity: product.netQuantity,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.countryOfOrigin,
    images: product.images,
    artKind: product.artKind,
    finishColor: product.finishColor,
    highlights: product.highlights,
    specs: product.specs,
    boxContents: product.boxContents,
    tags: product.tags,
    fitmentType: product.fitmentType,
    bodyTypes: product.bodyTypes,
    pcd: product.pcd,
    fitments: product.fitments.map((f) => ({ vehicleId: f.vehicle.id, fitType: f.fitType, note: f.note, isVerified: f.isVerified })),
    label: product.label,
    fittingTools: product.fittingTools,
    fittingSteps: product.fittingSteps,
    warrantyMonths: product.warrantyMonths,
    returnable: product.returnable,
    codEligible: product.codEligible,
    goals: product.goals,
    essentialRank: product.essentialRank,
    buildSlot: product.buildSlot,
    buildStyle: product.buildStyle,
    customKind: product.customKind,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isActive: product.isActive,
    variants: product.variants.map((v) => ({ name: v.name, sku: v.sku, price: v.regularPrice, mrp: v.mrp, stock: v.stock, attributes: v.attributes })),
    requiresIds: product.requiresIds,
    pairsWithIds: product.pairsWithIds,
  };
}

const sortFitments = (list) => [...list].sort((a, b) => a.vehicleId - b.vehicleId);
const priceRows = (id) => t.ctx.db.all('SELECT price, mrp FROM price_history WHERE product_id = ? ORDER BY id', [id]).map((row) => ({ ...row }));

describe('permissions', () => {
  const paths = [
    ['GET', '/api/admin/products'],
    ['POST', '/api/admin/products'],
    ['PATCH', '/api/admin/products/1'],
    ['DELETE', '/api/admin/products/1'],
    ['POST', '/api/admin/uploads'],
    ['GET', '/api/admin/categories'],
    ['PUT', '/api/admin/categories/1/picks'],
    ['GET', '/api/admin/drops'],
    ['GET', '/api/admin/reports'],
    ['GET', '/api/admin/questions'],
    ['GET', '/api/admin/builds'],
    ['DELETE', '/api/admin/builds/x'],
  ];
  test('signed-out callers get 401 and customers 403', async () => {
    const customer = t.asCustomer();
    for (const [method, path] of paths) {
      assert.equal((await t.newClient()(path, { method, body: method === 'GET' ? undefined : {} })).status, 401, `${method} ${path}`);
      assert.equal((await customer(path, { method, body: method === 'GET' ? undefined : {} })).status, 403, `${method} ${path}`);
    }
  });
});

describe('products', () => {
  test('create then read back every field, and update round-trips too', async () => {
    const input = fullInput();
    const created = await admin('/api/admin/products', { method: 'POST', body: input });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id;
    assert.equal(created.body.slug, `addon-test-diffuser-${skuCounter}`);

    const read = await admin(`/api/admin/products/${id}`);
    assert.equal(read.status, 200);
    const back = asInput(read.body);
    assert.deepEqual({ ...back, fitments: sortFitments(back.fitments) }, { ...input, fitments: sortFitments(input.fitments) });
    assert.equal(read.body.hasVariants, false);
    assert.deepEqual(priceRows(id), [{ price: 4999, mrp: 6499 }]);

    // Full update with different values everywhere.
    const changed = fullInput({
      name: 'Addon Test Diffuser Renamed',
      slug: 'diffuser-renamed',
      categoryId: t.fixtures.categories.alloys.id,
      price: 4599,
      mrp: 6499,
      costPrice: null,
      fitmentType: 'body_type',
      bodyTypes: ['hatchback', 'sedan'],
      fitments: [],
      label: { ...input.label, legality: 'road_legal', legalityNote: '', warrantyImpact: 'none', warrantyNote: '', wiring: 'plug_and_play' },
      buildSlot: null,
      buildStyle: null,
      artKind: null,
      customKind: 'show-plate',
      codEligible: false,
      isActive: false,
      requiresIds: [],
      pairsWithIds: [t.fixtures.products.universal.id, t.fixtures.products.wheel.id],
      images: [],
      goals: [],
    });
    const updated = await admin(`/api/admin/products/${id}`, { method: 'PUT', body: changed });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const again = asInput(updated.body);
    // artKind null falls back to the category's art kind when read.
    assert.equal(again.artKind, 'alloy-wheel');
    assert.deepEqual({ ...again, artKind: null, slug: updated.body.slug }, changed);
    assert.equal(updated.body.slug, 'diffuser-renamed');
    assert.deepEqual(priceRows(id), [
      { price: 4999, mrp: 6499 },
      { price: 4599, mrp: 6499 },
    ]);

    // Same price again: no new history row. Slug omitted keeps the current one.
    const { slug: _slug, ...noSlug } = changed;
    const same = await admin(`/api/admin/products/${id}`, { method: 'PUT', body: { ...noSlug, stock: 2 } });
    assert.equal(same.status, 200);
    assert.equal(same.body.slug, 'diffuser-renamed');
    assert.equal(priceRows(id).length, 2);
  });

  test('a minimal product gets sensible defaults and a slug from its name', async () => {
    const res = await admin('/api/admin/products', {
      method: 'POST',
      body: { name: 'Addon Spoiler Lip', sku: 'T-MIN-1', categoryId: t.fixtures.categories.spoilers.id, price: 999, mrp: 1299 },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.slug, 'addon-spoiler-lip');
    assert.equal(res.body.gstRate, 18);
    assert.equal(res.body.isActive, true);
    // A second product with the same name gets the next free slug.
    const second = await admin('/api/admin/products', {
      method: 'POST',
      body: { name: 'Addon Spoiler Lip', sku: 'T-MIN-2', categoryId: t.fixtures.categories.spoilers.id, price: 999, mrp: 1299 },
    });
    assert.equal(second.body.slug, 'addon-spoiler-lip-2');
  });

  test('duplicate slug and SKU are 409 naming the field', async () => {
    const { spoiler, wheel } = t.fixtures.products;
    const dupSku = await admin('/api/admin/products', { method: 'POST', body: fullInput({ sku: spoiler.sku }) });
    assert.equal(dupSku.status, 409);
    assert.equal(dupSku.body.error.code, 'conflict');
    assert.ok(dupSku.body.error.fields.sku);

    const dupSlug = await admin('/api/admin/products', { method: 'POST', body: fullInput({ slug: spoiler.slug }) });
    assert.equal(dupSlug.status, 409);
    assert.ok(dupSlug.body.error.fields.slug);

    const dupVariant = await admin('/api/admin/products', {
      method: 'POST',
      body: fullInput({ variants: [{ name: 'A', sku: wheel.variants[0].sku, price: 100, mrp: 200, stock: 1, attributes: {} }] }),
    });
    assert.equal(dupVariant.status, 409);
    assert.ok(dupVariant.body.error.fields['variants.0.sku']);

    // Updating a product to another product's SKU is refused too; keeping its own is fine.
    const own = await admin(`/api/admin/products/${t.fixtures.products.universal.id}`);
    const put = await admin(`/api/admin/products/${own.body.id}`, { method: 'PUT', body: { ...asInput(own.body), sku: spoiler.sku } });
    assert.equal(put.status, 409);
    assert.ok(put.body.error.fields.sku);
    const keep = await admin(`/api/admin/products/${own.body.id}`, { method: 'PUT', body: asInput(own.body) });
    assert.equal(keep.status, 200, JSON.stringify(keep.body));
  });

  test('validation: Straight Label, enums, build slot and style, subcategory, price above MRP', async () => {
    const cases = [
      [{ categoryId: t.fixtures.categories.exterior.id }, 'categoryId'],
      [{ categoryId: 99999 }, 'categoryId'],
      [{ buildSlot: 'wheels', buildStyle: 'fins' }, 'buildStyle'],
      [{ buildSlot: 'spaceship', buildStyle: 'fins' }, 'buildSlot'],
      [{ buildSlot: 'wheels', buildStyle: null }, 'buildStyle'],
      [{ shipClass: 'huge' }, 'shipClass'],
      [{ goals: ['speed'] }, 'goals.0'],
      [{ price: 7000, mrp: 6000 }, 'price'],
      [{ label: { ...fullInput().label, installDifficulty: 6 } }, 'label.installDifficulty'],
      [{ label: { ...fullInput().label, legality: 'off_road_only', legalityNote: '' } }, 'label.legalityNote'],
      [{ label: { ...fullInput().label, installTimeMin: 90, installTimeMax: 30 } }, 'label.installTimeMax'],
      [{ label: { ...fullInput().label, wiring: 'magic' } }, 'label.wiring'],
      [{ fitmentType: 'pcd', pcd: '' }, 'pcd'],
      [{ fitmentType: 'body_type', bodyTypes: [] }, 'bodyTypes'],
      [{ fitments: [{ vehicleId: 99999, fitType: 'direct', note: '', isVerified: false }] }, 'fitments.0.vehicleId'],
      [{ requiresIds: [99999] }, 'requiresIds.0'],
      [{ customKind: 'show-plate', codEligible: true }, 'codEligible'],
      [{ name: '' }, 'name'],
      [{ slug: 'Bad Slug!' }, 'slug'],
    ];
    for (const [overrides, field] of cases) {
      const res = await admin('/api/admin/products', { method: 'POST', body: fullInput(overrides) });
      assert.equal(res.status, 400, `${field}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.error.code, 'validation_error');
      assert.ok(res.body.error.fields?.[field], `${field} missing in ${JSON.stringify(res.body.error.fields)}`);
    }
  });

  test('variants: price and stock follow them, ids sent are kept, missing ones removed', async () => {
    const variants = [
      { name: '16 inch / Black', sku: 'T-VAR-16', price: 25999, mrp: 31999, stock: 3, attributes: { Size: '16 inch' } },
      { name: '15 inch / Black', sku: 'T-VAR-15', price: 21999, mrp: 26999, stock: 5, attributes: { Size: '15 inch' } },
    ];
    const created = await admin('/api/admin/products', {
      method: 'POST',
      body: fullInput({ price: 1, mrp: 1, stock: 999, variants, fitmentType: 'pcd', pcd: '4x100', fitments: [] }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const product = created.body;
    assert.equal(product.hasVariants, true);
    assert.equal(product.regularPrice, 21999);
    assert.equal(product.mrp, 26999);
    assert.equal(product.stock, 8);
    assert.deepEqual(priceRows(product.id), [{ price: 21999, mrp: 26999 }]);
    const [v16, v15] = product.variants;
    assert.equal(v16.sku, 'T-VAR-16');

    // Keep the 16 inch (by id, with the SKUs swapped round), drop the 15 inch, add a 17 inch.
    const put = await admin(`/api/admin/products/${product.id}`, {
      method: 'PUT',
      body: fullInput({
        sku: product.sku,
        price: 1,
        mrp: 1,
        fitmentType: 'pcd',
        pcd: '4x100',
        fitments: [],
        variants: [
          { id: v16.id, name: '16 inch / Gunmetal', sku: 'T-VAR-15', price: 24999, mrp: 31999, stock: 4, attributes: { Size: '16 inch' } },
          { name: '17 inch / Black', sku: 'T-VAR-17', price: 28999, mrp: 34999, stock: 1, attributes: {} },
        ],
      }),
    });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.variants.length, 2);
    assert.equal(put.body.variants[0].id, v16.id);
    assert.equal(put.body.variants[0].sku, 'T-VAR-15');
    assert.notEqual(put.body.variants[1].id, v15.id);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM product_variants WHERE id = ?', [v15.id]).n, 0);
    assert.equal(put.body.regularPrice, 24999);
    assert.equal(put.body.stock, 5);
    assert.deepEqual(priceRows(product.id).at(-1), { price: 24999, mrp: 31999 });

    // A variant id from another product is refused.
    const foreign = await admin(`/api/admin/products/${product.id}`, {
      method: 'PUT',
      body: fullInput({
        sku: product.sku,
        fitments: [],
        variants: [{ id: t.fixtures.products.wheel.variants[0].id, name: 'X', sku: 'T-VAR-X', price: 1, mrp: 1, stock: 1, attributes: {} }],
      }),
    });
    assert.equal(foreign.status, 400);
    assert.ok(foreign.body.error.fields['variants.0.id']);

    // Quick edits of price or stock are refused while there are variants.
    const patch = await admin(`/api/admin/products/${product.id}`, { method: 'PATCH', body: { stock: 50 } });
    assert.equal(patch.status, 400);
  });

  test('PATCH quick edits write price history only when the price changes', async () => {
    const id = t.fixtures.products.bodyType.id;
    const before = priceRows(id).length;
    const stock = await admin(`/api/admin/products/${id}`, { method: 'PATCH', body: { stock: 2, isFeatured: true } });
    assert.equal(stock.status, 200);
    assert.equal(stock.body.stock, 2);
    assert.equal(stock.body.lowStock, true);
    assert.equal(stock.body.isFeatured, true);
    assert.equal(priceRows(id).length, before);

    const price = await admin(`/api/admin/products/${id}`, { method: 'PATCH', body: { price: 2299 } });
    assert.equal(price.body.regularPrice, 2299);
    assert.deepEqual(priceRows(id).at(-1), { price: 2299, mrp: 3299 });

    assert.equal((await admin(`/api/admin/products/${id}`, { method: 'PATCH', body: { price: 9999 } })).status, 400);
    assert.equal((await admin(`/api/admin/products/${id}`, { method: 'PATCH', body: {} })).status, 400);
    assert.equal((await admin('/api/admin/products/99999', { method: 'PATCH', body: { stock: 1 } })).status, 404);
  });

  test('list filters by q, category, status and pages', async () => {
    const bySku = await admin('/api/admin/products?q=T-WHL-001');
    assert.equal(bySku.status, 200);
    assert.ok(bySku.body.items.some((item) => item.id === t.fixtures.products.wheel.id));
    assert.ok(bySku.body.items.every((item) => item.costPrice !== undefined && item.supplier !== undefined));

    const byVariantSku = await admin('/api/admin/products?q=GUN');
    assert.ok(byVariantSku.body.items.some((item) => item.id === t.fixtures.products.wheel.id));

    const byName = await admin('/api/admin/products?q=locking');
    assert.deepEqual(byName.body.items.map((item) => item.id), [t.fixtures.products.outOfStock.id]);

    const out = await admin('/api/admin/products?status=out_of_stock');
    assert.ok(out.body.items.every((item) => item.stock === 0));
    assert.ok(out.body.items.some((item) => item.id === t.fixtures.products.outOfStock.id));

    const low = await admin('/api/admin/products?status=low_stock');
    assert.ok(low.body.items.every((item) => item.stock > 0 && item.stock <= item.lowStockThreshold));

    const wheels = await admin(`/api/admin/products?category=${t.fixtures.categories.wheels.slug}`);
    assert.ok(wheels.body.items.length >= 2);
    assert.ok(wheels.body.items.every((item) => item.categoryId === t.fixtures.categories.alloys.id));

    const paged = await admin('/api/admin/products?limit=2&page=2');
    assert.equal(paged.body.items.length, 2);
    assert.equal(paged.body.page, 2);
    assert.ok(paged.body.total > 4);

    assert.equal((await admin('/api/admin/products?status=sold')).status, 400);
    assert.equal((await admin('/api/admin/products?category=nope')).status, 404);
  });

  test('DELETE removes a never-ordered product and hides an ordered one', async () => {
    const fresh = await admin('/api/admin/products', { method: 'POST', body: fullInput({ fitments: [] }) });
    const del = await admin(`/api/admin/products/${fresh.body.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal(del.body.ok, true);
    assert.equal(del.body.deleted, true);
    assert.equal((await admin(`/api/admin/products/${fresh.body.id}`)).status, 404);

    const ordered = await admin('/api/admin/products', { method: 'POST', body: fullInput({ fitments: [] }) });
    const orderId = t.ctx.db.run(
      `INSERT INTO orders (order_number, access_token, payment_method, customer_name, phone, ship_name, ship_phone, ship_line1,
         ship_city, ship_state, ship_pincode, subtotal, total)
       VALUES ('ADN-261117-TEST', 'tok', 'cod', 'Ravi', '9876501234', 'Ravi', '9876501234', '1 MG Road', 'Pune', 'Maharashtra', '411001', 4999, 4999)`,
    ).lastInsertRowid;
    t.ctx.db.run("INSERT INTO order_items (order_id, product_id, name, price, mrp, qty) VALUES (?, ?, 'x', 4999, 6499, 1)", [orderId, ordered.body.id]);
    const hide = await admin(`/api/admin/products/${ordered.body.id}`, { method: 'DELETE' });
    assert.equal(hide.status, 200);
    assert.equal(hide.body.deleted, false);
    assert.equal(hide.body.deactivated, true);
    assert.match(hide.body.message, /hidden/);
    const after = await admin(`/api/admin/products/${ordered.body.id}`);
    assert.equal(after.status, 200);
    assert.equal(after.body.isActive, false);

    assert.equal((await admin('/api/admin/products/99999', { method: 'DELETE' })).status, 404);
  });
});

describe('uploads', () => {
  test('uploads images through the endpoint', async () => {
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#ffd500' } }).png().toBuffer();
    const form = new FormData();
    form.append('images', new Blob([png], { type: 'image/png' }), 'a.png');
    form.append('images', new Blob([png], { type: 'image/png' }), 'b.png');
    const res = await admin('/api/admin/uploads', { method: 'POST', body: form });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.urls.length, 2);
    assert.match(res.body.urls[0], /^\/uploads\/[0-9a-f]+\.webp$/);

    const bad = new FormData();
    bad.append('images', new Blob([Buffer.from('not an image')], { type: 'image/png' }), 'x.png');
    assert.equal((await admin('/api/admin/uploads', { method: 'POST', body: bad })).status, 400);
    assert.equal((await admin('/api/admin/uploads', { method: 'POST', body: new FormData() })).status, 400);
  });
});

describe('categories', () => {
  test('list includes inactive; create, update, delete with clear 409s', async () => {
    const { exterior, spoilers } = t.fixtures.categories;
    const created = await admin('/api/admin/categories', {
      method: 'POST',
      body: { name: 'Diffusers', parentId: exterior.id, blurb: 'Rear diffusers.', artKind: 'diffuser', image: '', sortOrder: 4, isActive: false },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.slug, 'diffusers');
    assert.equal(created.body.isActive, false);

    const list = await admin('/api/admin/categories');
    const parent = list.body.find((category) => category.id === exterior.id);
    assert.ok(parent.children.some((child) => child.id === created.body.id));

    const dup = await admin('/api/admin/categories', { method: 'POST', body: { name: 'Other', slug: 'diffusers', parentId: exterior.id } });
    assert.equal(dup.status, 409);
    assert.ok(dup.body.error.fields.slug);

    const deep = await admin('/api/admin/categories', { method: 'POST', body: { name: 'Too deep', parentId: spoilers.id } });
    assert.equal(deep.status, 400);
    assert.ok(deep.body.error.fields.parentId);

    const updated = await admin(`/api/admin/categories/${created.body.id}`, {
      method: 'PUT',
      body: { name: 'Rear Diffusers', parentId: exterior.id, blurb: '', artKind: 'diffuser', image: '/uploads/x.webp', sortOrder: 2, isActive: true },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'Rear Diffusers');
    assert.equal(updated.body.slug, 'diffusers');
    assert.equal(updated.body.isActive, true);

    const hasChildren = await admin(`/api/admin/categories/${exterior.id}`, { method: 'DELETE' });
    assert.equal(hasChildren.status, 409);
    assert.match(hasChildren.body.error.message, /subcategor/);
    const hasProducts = await admin(`/api/admin/categories/${spoilers.id}`, { method: 'DELETE' });
    assert.equal(hasProducts.status, 409);
    assert.match(hasProducts.body.error.message, /product/);

    assert.equal((await admin(`/api/admin/categories/${created.body.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin(`/api/admin/categories/${created.body.id}`, { method: 'DELETE' })).status, 404);
  });

  test('picks: three tiers from that subcategory only', async () => {
    const { spoilers, exterior } = t.fixtures.categories;
    const { spoiler, universal, bodyType, wheel } = t.fixtures.products;
    const body = {
      picks: [
        { tier: 'sensible', productId: universal.id, reason: 'Cheap and universal.' },
        { tier: 'sweet_spot', productId: bodyType.id, reason: 'Best value.' },
        { tier: 'all_out', productId: spoiler.id, reason: 'Made for the Swift.' },
      ],
    };
    const put = await admin(`/api/admin/categories/${spoilers.id}/picks`, { method: 'PUT', body });
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.deepEqual(
      put.body.map((pick) => [pick.tier, pick.product.id, pick.reason]),
      body.picks.map((pick) => [pick.tier, pick.productId, pick.reason]),
    );
    const get = await admin(`/api/admin/categories/${spoilers.id}/picks`);
    assert.equal(get.body.length, 3);

    const wrongCategory = await admin(`/api/admin/categories/${spoilers.id}/picks`, {
      method: 'PUT',
      body: { picks: [{ tier: 'sensible', productId: wheel.id, reason: '' }] },
    });
    assert.equal(wrongCategory.status, 400);
    assert.ok(wrongCategory.body.error.fields['picks.0.productId']);

    const twice = await admin(`/api/admin/categories/${spoilers.id}/picks`, {
      method: 'PUT',
      body: { picks: [{ tier: 'sensible', productId: universal.id }, { tier: 'sensible', productId: bodyType.id }] },
    });
    assert.equal(twice.status, 400);

    const topLevel = await admin(`/api/admin/categories/${exterior.id}/picks`, { method: 'PUT', body: { picks: [] } });
    assert.equal(topLevel.status, 400);

    const cleared = await admin(`/api/admin/categories/${spoilers.id}/picks`, { method: 'PUT', body: { picks: [] } });
    assert.deepEqual(cleared.body, []);
  });
});

describe('drops', () => {
  test('validation of items, percent and window', async () => {
    const now = Date.now();
    const base = { title: 'Friday Five', note: '', startsAt: iso(now), endsAt: iso(now + 24 * HOUR), isActive: false };
    const { universal } = t.fixtures.products;
    const bad = [
      [{ items: [] }, 'items'],
      [{ items: [{ productId: universal.id, percentOff: 95, reason: '' }] }, 'items.0.percentOff'],
      [{ items: [{ productId: universal.id, percentOff: 0, reason: '' }] }, 'items.0.percentOff'],
      [{ items: [{ productId: 99999, percentOff: 10, reason: '' }] }, 'items.0.productId'],
      [{ endsAt: iso(now - HOUR), items: [{ productId: universal.id, percentOff: 10 }] }, 'endsAt'],
      [{ items: Array.from({ length: 9 }, (_, i) => ({ productId: i + 1, percentOff: 10 })) }, 'items'],
    ];
    for (const [overrides, field] of bad) {
      const res = await admin('/api/admin/drops', { method: 'POST', body: { ...base, ...overrides } });
      assert.equal(res.status, 400, field);
      assert.ok(res.body.error.fields?.[field], `${field}: ${JSON.stringify(res.body.error)}`);
    }
    const inactive = await admin(`/api/admin/products/${t.fixtures.products.showPlate.id}`);
    assert.equal(inactive.status, 200);
  });

  test('activating a drop switches off overlapping ones, and the live drop prices the catalogue', async () => {
    const now = Date.now();
    const { universal, spoiler } = t.fixtures.products;
    const first = await admin('/api/admin/drops', {
      method: 'POST',
      body: {
        title: 'Drop one',
        note: 'Note',
        startsAt: iso(now - HOUR),
        endsAt: iso(now + 24 * HOUR),
        isActive: true,
        items: [{ productId: universal.id, percentOff: 20, reason: 'Overstocked.' }],
      },
    });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.state, 'live');
    assert.deepEqual(first.body.deactivatedDropIds, []);
    assert.equal(first.body.items[0].product.id, universal.id);
    assert.equal(first.body.items[0].percentOff, 20);

    const later = await admin('/api/admin/drops', {
      method: 'POST',
      body: {
        title: 'Next week',
        note: '',
        startsAt: iso(now + 7 * 24 * HOUR),
        endsAt: iso(now + 8 * 24 * HOUR),
        isActive: true,
        items: [{ productId: spoiler.id, percentOff: 10, reason: '' }],
      },
    });
    assert.equal(later.body.state, 'scheduled');
    assert.deepEqual(later.body.deactivatedDropIds, []);

    const product = await admin(`/api/admin/products/${universal.id}`);
    assert.equal(product.body.price, Math.round((1299 * 80) / 100));
    assert.equal(product.body.regularPrice, 1299);

    const catalogue = await t.api(`/api/products/${t.fixtures.products.universal.slug}`);
    if (catalogue.status !== 404) {
      assert.equal(catalogue.body.price, Math.round((1299 * 80) / 100));
    }

    // An overlapping drop switches the first one off and says so.
    const second = await admin('/api/admin/drops', {
      method: 'POST',
      body: {
        title: 'Drop two',
        note: '',
        startsAt: iso(now),
        endsAt: iso(now + 2 * HOUR),
        isActive: true,
        items: [{ productId: spoiler.id, percentOff: 15, reason: 'Clearance.' }],
      },
    });
    assert.equal(second.status, 201);
    assert.deepEqual(second.body.deactivatedDropIds, [first.body.id]);
    assert.equal(second.headers.get('x-deactivated-drops'), String(first.body.id));

    const list = await admin('/api/admin/drops');
    const byId = new Map(list.body.map((drop) => [drop.id, drop]));
    assert.equal(byId.get(first.body.id).state, 'off');
    assert.equal(byId.get(later.body.id).isActive, true);
    assert.equal(byId.get(second.body.id).state, 'live');

    const afterSwitch = await admin(`/api/admin/products/${universal.id}`);
    assert.equal(afterSwitch.body.price, 1299);
    const catalogueAfter = await t.api(`/api/products/${t.fixtures.products.universal.slug}`);
    if (catalogueAfter.status !== 404) assert.equal(catalogueAfter.body.price, 1299);

    // Update: replace items and turn it off.
    const put = await admin(`/api/admin/drops/${second.body.id}`, {
      method: 'PUT',
      body: {
        title: 'Drop two edited',
        note: '',
        startsAt: iso(now),
        endsAt: iso(now + 2 * HOUR),
        isActive: false,
        items: [{ productId: universal.id, percentOff: 30, reason: '' }],
      },
    });
    assert.equal(put.status, 200);
    assert.equal(put.body.title, 'Drop two edited');
    assert.equal(put.body.state, 'off');
    assert.deepEqual(put.body.items.map((item) => item.product.id), [universal.id]);

    for (const id of [first.body.id, second.body.id, later.body.id]) {
      assert.equal((await admin(`/api/admin/drops/${id}`, { method: 'DELETE' })).status, 200);
    }
    assert.equal((await admin(`/api/admin/drops/${first.body.id}`, { method: 'DELETE' })).status, 404);
  });
});

describe('fitted reports', () => {
  test('approve, reject and delete recompute the rating', async () => {
    const { spoiler } = t.fixtures.products;
    const insert = (rating, status) =>
      Number(
        t.ctx.db.run("INSERT INTO reviews (product_id, author_name, rating, status) VALUES (?, 'Ravi', ?, ?)", [spoiler.id, rating, status])
          .lastInsertRowid,
      );
    const a = insert(5, 'pending');
    const b = insert(3, 'pending');
    insert(1, 'rejected');
    const rating = () => ({ ...t.ctx.db.get('SELECT rating_avg, rating_count FROM products WHERE id = ?', [spoiler.id]) });

    const pending = await admin('/api/admin/reports?status=pending');
    assert.equal(pending.status, 200);
    assert.equal(pending.body.total, 2);
    assert.equal(pending.body.items[0].productSlug, spoiler.slug);

    const approved = await admin(`/api/admin/reports/${a}`, { method: 'PUT', body: { status: 'approved' } });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, 'approved');
    assert.deepEqual(rating(), { rating_avg: 5, rating_count: 1 });

    await admin(`/api/admin/reports/${b}`, { method: 'PUT', body: { status: 'approved' } });
    assert.deepEqual(rating(), { rating_avg: 4, rating_count: 2 });

    await admin(`/api/admin/reports/${a}`, { method: 'PUT', body: { status: 'rejected' } });
    assert.deepEqual(rating(), { rating_avg: 3, rating_count: 1 });

    assert.equal((await admin(`/api/admin/reports/${b}`, { method: 'DELETE' })).status, 200);
    assert.deepEqual(rating(), { rating_avg: 0, rating_count: 0 });

    assert.equal((await admin(`/api/admin/reports/${a}`, { method: 'PUT', body: { status: 'live' } })).status, 400);
    assert.equal((await admin('/api/admin/reports/99999', { method: 'PUT', body: { status: 'approved' } })).status, 404);
  });
});

describe('fitment desk', () => {
  const ask = (productId, vehicleId, kind = 'fitment', name = 'Asker') =>
    Number(
      t.ctx.db.run(
        `INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, phone, question)
         VALUES (?, ?, ?, ?, ?, '9876512345', 'Will this fit?')`,
        [productId, kind, vehicleId, vehicleId ? 'Hyundai Creta (2020 onwards)' : '', name],
      ).lastInsertRowid,
    );

  test('lists fitment questions first, most asked first, with sameAskCount', async () => {
    const { universal, bodyType } = t.fixtures.products;
    const { creta, swiftNew } = t.fixtures.vehicles;
    const general = ask(universal.id, null, 'general');
    const single = ask(bodyType.id, swiftNew.id);
    const triple = [ask(universal.id, creta.id), ask(universal.id, creta.id), ask(universal.id, creta.id)];

    const res = await admin('/api/admin/questions?status=pending');
    assert.equal(res.status, 200);
    const ids = res.body.items.map((item) => item.id);
    assert.ok(ids.indexOf(triple[0]) < ids.indexOf(single));
    assert.ok(ids.indexOf(single) < ids.indexOf(general));
    const first = res.body.items.find((item) => item.id === triple[0]);
    assert.equal(first.sameAskCount, 3);
    assert.equal(first.phone, '9876512345');
    assert.equal(first.productSlug, universal.slug);

    const generalOnly = await admin('/api/admin/questions?kind=general&status=pending');
    assert.ok(generalOnly.body.items.every((item) => item.kind === 'general'));

    // Clean up for the next test.
    for (const id of [general, single, ...triple]) await admin(`/api/admin/questions/${id}`, { method: 'DELETE' });
  });

  test('answering a fitment question writes product_fitments and answers the others who asked', async () => {
    const { universal } = t.fixtures.products;
    const { creta } = t.fixtures.vehicles;
    const [one, two, three] = [ask(universal.id, creta.id), ask(universal.id, creta.id), ask(universal.id, creta.id)];
    const otherCar = ask(universal.id, t.fixtures.vehicles.swiftOld.id);

    const missingVerdict = await admin(`/api/admin/questions/${one}`, { method: 'PUT', body: { answer: 'Yes' } });
    assert.equal(missingVerdict.status, 400);
    assert.ok(missingVerdict.body.error.fields.fitType);
    const workWithoutNote = await admin(`/api/admin/questions/${one}`, { method: 'PUT', body: { fitType: 'with_work' } });
    assert.equal(workWithoutNote.status, 400);

    const res = await admin(`/api/admin/questions/${one}`, {
      method: 'PUT',
      body: { fitType: 'with_work', answer: 'Fits after trimming the bumper clip.', isVerified: true },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'published');
    assert.equal(res.body.answerFitType, 'with_work');
    assert.equal(res.body.answer, 'Fits after trimming the bumper clip.');
    assert.equal(res.body.sameAskCount, 3);

    const fitment = t.ctx.db.get('SELECT * FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [universal.id, creta.id]);
    assert.deepEqual(
      { fit_type: fitment.fit_type, note: fitment.note, is_verified: fitment.is_verified },
      { fit_type: 'with_work', note: 'Fits after trimming the bumper clip.', is_verified: 1 },
    );
    for (const id of [two, three]) {
      const sibling = t.ctx.db.get('SELECT * FROM product_questions WHERE id = ?', [id]);
      assert.equal(sibling.status, 'published');
      assert.equal(sibling.answer_fit_type, 'with_work');
      assert.equal(sibling.answer, 'Fits after trimming the bumper clip.');
    }
    assert.equal(t.ctx.db.get('SELECT status FROM product_questions WHERE id = ?', [otherCar]).status, 'pending');

    // The store now answers that car from the fitment table.
    const product = await admin(`/api/admin/products/${universal.id}`);
    assert.ok(product.body.fitments.some((f) => f.vehicle.id === creta.id && f.fitType === 'with_work'));

    // Changing the verdict later upserts the same row.
    const change = await admin(`/api/admin/questions/${one}`, { method: 'PUT', body: { fitType: 'no' } });
    assert.equal(change.status, 200);
    assert.equal(change.body.answerFitType, 'no');
    assert.match(change.body.answer, /does not fit/);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [universal.id, creta.id]).n, 1);
    assert.equal(t.ctx.db.get('SELECT fit_type FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [universal.id, creta.id]).fit_type, 'no');

    const rejected = await admin(`/api/admin/questions/${otherCar}`, { method: 'PUT', body: { status: 'rejected' } });
    assert.equal(rejected.body.status, 'rejected');
    assert.equal((await admin(`/api/admin/questions/${otherCar}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin(`/api/admin/questions/${otherCar}`, { method: 'DELETE' })).status, 404);
  });

  test('general questions store the answer and publish', async () => {
    const id = ask(t.fixtures.products.universal.id, null, 'general');
    const empty = await admin(`/api/admin/questions/${id}`, { method: 'PUT', body: {} });
    assert.equal(empty.status, 400);
    const res = await admin(`/api/admin/questions/${id}`, { method: 'PUT', body: { answer: 'It is ABS plastic.' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'published');
    assert.equal(res.body.answer, 'It is ABS plastic.');
    assert.ok(res.body.answeredAt);
    assert.equal(res.body.answerFitType, null);
  });
});

describe('builds', () => {
  test('list by status, update status, isHouse and title, delete', async () => {
    const { spoiler, wheel } = t.fixtures.products;
    const state = { bodyType: 'hatchback', paint: '#c00000', rideHeight: -1, wheelSize: 1, night: false, tint: 20, parts: { wheels: { style: 'mesh' } } };
    t.ctx.db.run("INSERT INTO builds (slug, title, author_name, state, product_ids, status) VALUES ('red-swift', 'Red Swift', 'Ravi', ?, ?, 'pending')", [
      state,
      [spoiler.id, wheel.id],
    ]);
    t.ctx.db.run("INSERT INTO builds (slug, title, state, status) VALUES ('private-one', 'Private', '{}', 'private')");

    const pending = await admin('/api/admin/builds?status=pending');
    assert.equal(pending.status, 200);
    assert.equal(pending.body.total, 1);
    const build = pending.body.items[0];
    assert.equal(build.slug, 'red-swift');
    assert.deepEqual(build.products.map((p) => p.id), [spoiler.id, wheel.id]);
    assert.equal(build.total, spoiler.price + wheel.price);
    assert.equal(build.state.paint, '#c00000');

    const put = await admin('/api/admin/builds/red-swift', { method: 'PUT', body: { status: 'approved', isHouse: true, title: 'The Red Swift' } });
    assert.equal(put.status, 200);
    assert.equal(put.body.status, 'approved');
    assert.equal(put.body.isHouse, true);
    assert.equal(put.body.title, 'The Red Swift');

    assert.equal((await admin('/api/admin/builds/red-swift', { method: 'PUT', body: { status: 'famous' } })).status, 400);
    assert.equal((await admin('/api/admin/builds/red-swift', { method: 'PUT', body: {} })).status, 400);
    assert.equal((await admin('/api/admin/builds/nope', { method: 'PUT', body: { status: 'approved' } })).status, 404);

    assert.equal((await admin('/api/admin/builds/private-one', { method: 'DELETE' })).status, 200);
    assert.equal((await admin('/api/admin/builds/private-one', { method: 'DELETE' })).status, 404);
  });
});
