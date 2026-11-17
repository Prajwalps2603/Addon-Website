import { startTestApp } from './helpers.js';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, test } from 'node:test';

import { toIso } from '../src/db/index.js';
import { PRODUCT_SELECT, getProductRow } from '../src/lib/catalog.js';
import {
  idList,
  jsonArray,
  jsonObject,
  orderTaxLines,
  quoteItems,
  stringList,
  toAddress,
  toAdminCustomer,
  toAdminDrop,
  toAdminOrderListItem,
  toAdminProduct,
  toAdminQuestion,
  toAdminQuote,
  toAdminQuoteItem,
  toAdminReport,
  toBuild,
  toCategory,
  toCategoryPick,
  toCoupon,
  toDrop,
  toEnquiry,
  toFitment,
  toGarageEntry,
  toLead,
  toOrder,
  toOrderEvent,
  toOrderItem,
  toProductDetail,
  toProductSummary,
  toQuestion,
  toQuote,
  toRelation,
  toReport,
  toSavedKit,
  toStockAlert,
  toStraightLabel,
  toUser,
  toVariant,
  toVehicle,
  vehicleLabel,
} from '../src/lib/mappers.js';
import { taxBreakdown } from '../src/lib/money.js';

// The contract itself is the oracle: every mapper must return exactly the keys api.ts declares.
const API_TYPES = fs.readFileSync(new URL('../../client/src/types/api.ts', import.meta.url), 'utf8');

function interfaceKeys(name) {
  const found = API_TYPES.match(new RegExp(`export interface ${name}(?:<[^>]+>)?(?: extends ([^{]+))? \\{\\r?\\n([\\s\\S]*?)\\r?\\n\\}`));
  assert.ok(found, `api.ts has no interface ${name}`);
  const keys = { required: new Set(), optional: new Set() };
  for (const base of (found[1] ?? '').split(',').map((part) => part.trim().replace(/<.*$/, '')).filter(Boolean)) {
    const inherited = interfaceKeys(base);
    inherited.required.forEach((key) => keys.required.add(key));
    inherited.optional.forEach((key) => keys.optional.add(key));
  }
  for (const line of found[2].split(/\r?\n/)) {
    const field = line.match(/^ {2}(\w+)(\?)?:/);
    if (field) (field[2] ? keys.optional : keys.required).add(field[1]);
  }
  return keys;
}

function assertShape(value, name) {
  const { required, optional } = interfaceKeys(name);
  const actual = Object.keys(value).filter((key) => !optional.has(key));
  assert.deepEqual(actual.sort(), [...required].sort(), `${name}: keys differ from api.ts`);
}

let t;
let db;
let f;
const productRow = (product) => getProductRow(t.ctx, product.id);

before(async () => {
  t = await startTestApp();
  db = t.ctx.db;
  f = t.fixtures;
});
after(async () => {
  await t.close();
});

describe('the api.ts reader used by these tests', () => {
  test('reads own, inherited and optional keys', () => {
    assert.deepEqual([...interfaceKeys('User').required], ['id', 'name', 'email', 'phone', 'role', 'createdAt']);
    assert.ok(interfaceKeys('ProductDetail').required.has('slug'), 'inherited from ProductSummary');
    assert.ok(interfaceKeys('AdminProduct').required.has('fitNote'), 'inherited twice');
    assert.ok(interfaceKeys('Order').optional.has('accessToken'));
    assert.ok(!interfaceKeys('Order').required.has('carrier'), 'nested object keys are not top-level keys');
    assert.throws(() => assertShape({ id: 1 }, 'User'));
  });
});

describe('JSON columns', () => {
  test('helpers return an empty value for anything that is not what the column should hold', () => {
    assert.deepEqual(jsonArray('["a",1]'), ['a', 1]);
    assert.deepEqual(jsonArray(['kept']), ['kept']);
    for (const bad of ['{not json', '', 'null', '{"a":1}', '"text"', '7', null, undefined, 7, {}]) {
      assert.deepEqual(jsonArray(bad), [], `jsonArray(${JSON.stringify(bad)})`);
    }
    assert.deepEqual(jsonObject('{"a":1}'), { a: 1 });
    for (const bad of ['[1]', 'oops', '', 'null', null, undefined, [1]]) {
      assert.deepEqual(jsonObject(bad), {}, `jsonObject(${JSON.stringify(bad)})`);
    }
    assert.deepEqual(stringList('[" a ", "", 5, null, {"x":1}, ["y"], "b"]'), ['a', '5', 'b']);
    assert.deepEqual(idList('[3, "4", -1, 0, 1.5, "x", null, 3, 9007199254740993]'), [3, 4]);
    assert.deepEqual(idList('oops'), []);
  });

  test('a product row with broken JSON in every column still maps, with empty values', () => {
    const broken = {
      ...productRow(f.products.bodyType),
      images: '{not json',
      highlights: 'null',
      specs: '[{"label":"Material","value":"ABS"},{"label":"","value":"dropped"},"loose",{"label":"Weight","value":1.2},null,{"label":"Bare"}]',
      box_contents: '"just a string"',
      tags: '{"a":1}',
      body_types: '["hatchback","spaceship",7]',
      fitting_tools: '',
      fitting_steps: '[{"en":"Clean the surface","hi":"सतह साफ करें"},"Press firmly for 30 seconds",{"hi":""},42,{"en":{"nested":true}}]',
      goals: '["sporty","flying",null]',
    };
    const detail = toProductDetail(broken);
    assert.equal(detail.image, null);
    assert.deepEqual(detail.images, []);
    assert.deepEqual(detail.highlights, []);
    assert.deepEqual(detail.specs, [
      { label: 'Material', value: 'ABS' },
      { label: 'Weight', value: '1.2' },
      { label: 'Bare', value: '' },
    ]);
    assert.deepEqual(detail.boxContents, []);
    assert.deepEqual(detail.tags, []);
    assert.deepEqual(detail.bodyTypes, ['hatchback']);
    assert.deepEqual(detail.fittingTools, []);
    assert.deepEqual(detail.fittingSteps, [
      { en: 'Clean the surface', hi: 'सतह साफ करें' },
      { en: 'Press firmly for 30 seconds', hi: '' },
    ]);
    assert.deepEqual(detail.goals, ['sporty']);
    assertShape(detail, 'ProductDetail');
  });

  test('columns that were already parsed are accepted as they are', () => {
    const row = { ...productRow(f.products.universal), tags: ['boot', 'spoiler'], images: ['/catalog/spoiler/a.webp'] };
    const summary = toProductSummary(row);
    assert.deepEqual(summary.tags, ['boot', 'spoiler']);
    assert.equal(summary.image, '/catalog/spoiler/a.webp');
  });

  test('variant attributes, order item designs, lead carts, kit ids and build states survive bad JSON', () => {
    const variant = db.get('SELECT * FROM product_variants WHERE id = ?', [f.products.wheel.variants[0].id]);
    assert.deepEqual(toVariant(variant).attributes, { Size: '15 inch', Finish: 'Gloss Black' });
    assert.deepEqual(toVariant({ ...variant, attributes: '[1,2]' }).attributes, {});
    assert.deepEqual(toVariant({ ...variant, attributes: 'oops' }).attributes, {});
    assert.deepEqual(toVariant({ ...variant, attributes: '{"Size":"15 inch","Count":4,"Nested":{"a":1},"Blank":null}' }).attributes, {
      Size: '15 inch',
      Count: '4',
    });

    const item = { id: 1, price: 799, qty: 1, mrp: 999 };
    assert.equal(toOrderItem({ ...item, custom: 'oops' }).custom, null);
    assert.equal(toOrderItem({ ...item, custom: '["a"]' }).custom, null);
    assert.equal(toOrderItem({ ...item, custom: null }).custom, null);
    assert.deepEqual(toOrderItem({ ...item, custom: '{"text":"SWIFT","style":"gloss"}' }).custom, { text: 'SWIFT', style: 'gloss' });

    assert.deepEqual(toLead({ cart: 'x' }).cart, []);
    assert.deepEqual(toLead({ cart: '[{"key":"1:0:"},"junk",null]' }).cart, [{ key: '1:0:' }]);
    assert.deepEqual(toSavedKit({ product_ids: '{"a":1}' }).productIds, []);
    assert.deepEqual(toReport({ photos: '{bad' }).photos, []);
    assert.deepEqual(toBuild({ state: 'not json' }).state, {
      bodyType: 'hatchback',
      paint: '#ffffff',
      rideHeight: 0,
      wheelSize: 0,
      night: false,
      tint: 0,
      parts: {},
    });
    assert.deepEqual(quoteItems({ items: 'oops' }), []);
  });

  test('no mapper throws on an empty row', () => {
    const simple = [
      toUser, toAdminCustomer, toAddress, toCategory, toVehicle, toGarageEntry, toProductSummary, toVariant, toFitment,
      toStraightLabel, toProductDetail, toAdminProduct, toDrop, toAdminDrop, toReport, toAdminReport, toQuestion,
      toAdminQuestion, toCoupon, toOrderItem, toOrderEvent, toOrder, toAdminOrderListItem, toQuote, toAdminQuote,
      toEnquiry, toLead, toSavedKit, toStockAlert, toBuild,
    ];
    for (const mapper of simple) assert.doesNotThrow(() => mapper({}), mapper.name);
  });
});

describe('users and addresses', () => {
  test('toUser returns the User shape and nothing private', () => {
    const row = db.get('SELECT * FROM users WHERE id = ?', [f.customer.id]);
    const user = toUser(row);
    assertShape(user, 'User');
    assert.deepEqual(user, {
      id: f.customer.id,
      name: 'Kiran Customer',
      email: 'kiran@example.com',
      phone: '9876543210',
      role: 'customer',
      createdAt: row.created_at,
    });
    assert.ok(!JSON.stringify(user).includes(row.password_hash));
    assert.equal(toUser(db.get('SELECT * FROM users WHERE id = ?', [f.admin.id])).role, 'admin');
  });

  test('toAdminCustomer adds the order figures', () => {
    const row = db.get('SELECT u.*, 3 AS order_count, 12500 AS total_spent, NULL AS last_order_at FROM users u WHERE u.id = ?', [f.customer.id]);
    const customer = toAdminCustomer(row);
    assertShape(customer, 'AdminCustomer');
    assert.equal(customer.orderCount, 3);
    assert.equal(customer.totalSpent, 12500);
    assert.equal(customer.lastOrderAt, null);
    assert.equal(toAdminCustomer({ ...row, last_order_at: '2026-11-10T08:00:00Z' }).lastOrderAt, '2026-11-10T08:00:00Z');
  });

  test('toAddress turns is_default into a boolean', () => {
    const id = db.run(
      `INSERT INTO addresses (user_id, label, name, phone, line1, landmark, city, state, pincode, is_default)
       VALUES (?, 'Office', 'Kiran Rao', '9876543210', '12 MG Road', 'Opposite the metro station', 'Bengaluru', 'Karnataka', '560001', 1)`,
      [f.customer.id],
    ).lastInsertRowid;
    const address = toAddress(db.get('SELECT * FROM addresses WHERE id = ?', [id]));
    assertShape(address, 'Address');
    assert.deepEqual(address, {
      id,
      label: 'Office',
      name: 'Kiran Rao',
      phone: '9876543210',
      line1: '12 MG Road',
      line2: '',
      landmark: 'Opposite the metro station',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      isDefault: true,
    });
  });
});

describe('categories and vehicles', () => {
  test('toCategory', () => {
    const row = db.get('SELECT * FROM categories WHERE id = ?', [f.categories.spoilers.id]);
    const category = toCategory(row, { productCount: 4 });
    assertShape(category, 'Category');
    assert.deepEqual(category, {
      id: f.categories.spoilers.id,
      slug: 'spoilers-wings',
      name: 'Spoilers & Wings',
      blurb: 'Spoilers & Wings for the test catalogue.',
      artKind: 'spoiler',
      image: '',
      parentId: f.categories.exterior.id,
      sortOrder: 1,
      isActive: true,
      productCount: 4,
      children: [],
    });
    const parent = toCategory({ ...row, parent_id: null, is_active: 0, product_count: 9 }, { children: [category] });
    assert.equal(parent.parentId, null);
    assert.equal(parent.isActive, false);
    assert.equal(parent.productCount, 9);
    assert.deepEqual(parent.children, [category]);
  });

  test('toVehicle prints the label for a closed range, an open range and a single year', () => {
    const vehicle = (id) => toVehicle(db.get('SELECT * FROM vehicles WHERE id = ?', [id]));
    const swiftOld = vehicle(f.vehicles.swiftOld.id);
    assertShape(swiftOld, 'Vehicle');
    assert.deepEqual(swiftOld, {
      id: f.vehicles.swiftOld.id,
      make: 'Maruti Suzuki',
      makeSlug: 'maruti-suzuki',
      model: 'Swift',
      modelSlug: 'swift',
      generation: '3rd gen',
      bodyType: 'hatchback',
      yearFrom: 2018,
      yearTo: 2024,
      pcd: '4x100',
      isPopular: true,
      label: 'Maruti Suzuki Swift (2018-2024)',
    });
    assert.equal(vehicle(f.vehicles.swiftNew.id).label, 'Maruti Suzuki Swift (2024 onwards)');
    assert.equal(vehicle(f.vehicles.swiftNew.id).yearTo, null);
    assert.equal(vehicle(f.vehicles.creta.id).label, 'Hyundai Creta (2020 onwards)');
    for (const key of ['swiftOld', 'swiftNew', 'creta']) assert.equal(vehicle(f.vehicles[key].id).label, f.vehicles[key].label);
    assert.equal(vehicleLabel({ make: 'Tata', model: 'Nano', year_from: 2019, year_to: 2019 }), 'Tata Nano (2019)');
  });

  test('toGarageEntry keeps the garage row and the vehicle apart', () => {
    db.run("INSERT INTO user_vehicles (user_id, vehicle_id, year, nickname, is_active) VALUES (?, ?, 2025, 'Red one', 1)", [
      f.customer.id,
      f.vehicles.swiftNew.id,
    ]);
    const row = db.get(
      `SELECT uv.vehicle_id, uv.year, uv.nickname, uv.is_active, v.*
       FROM user_vehicles uv JOIN vehicles v ON v.id = uv.vehicle_id WHERE uv.user_id = ?`,
      [f.customer.id],
    );
    const entry = toGarageEntry(row);
    assertShape(entry, 'GarageEntry');
    assertShape(entry.vehicle, 'Vehicle');
    assert.equal(entry.vehicleId, f.vehicles.swiftNew.id);
    assert.equal(entry.vehicle.id, f.vehicles.swiftNew.id);
    assert.equal(entry.year, 2025);
    assert.equal(entry.nickname, 'Red one');
    assert.equal(entry.isActive, true);
    assert.equal(entry.vehicle.label, 'Maruti Suzuki Swift (2024 onwards)');
  });
});

describe('products', () => {
  test('toProductSummary maps a v_products row to the exact ProductSummary', () => {
    const summary = toProductSummary(productRow(f.products.spoiler));
    assertShape(summary, 'ProductSummary');
    assert.deepEqual(summary, {
      id: f.products.spoiler.id,
      slug: 'addon-aero-roof-spoiler-swift',
      name: 'Addon Aero Roof Spoiler for Maruti Suzuki Swift (2018-2024)',
      brand: 'Addon Aero',
      categoryId: f.categories.spoilers.id,
      categorySlug: 'spoilers-wings',
      categoryName: 'Spoilers & Wings',
      parentCategorySlug: 'exterior-styling',
      parentCategoryName: 'Exterior Styling',
      shortDescription: 'A part from the test catalogue.',
      price: 3499,
      regularPrice: 3499,
      mrp: 4999,
      discountPercent: 30,
      drop: null,
      stock: 12,
      inStock: true,
      lowStock: false,
      image: null,
      artKind: 'spoiler',
      ratingAvg: 0,
      ratingCount: 0,
      isNew: false,
      isFeatured: false,
      hasVariants: false,
      fitmentType: 'vehicle',
      fit: null,
      fitNote: '',
      fitVerified: false,
      legality: 'road_legal',
      warrantyImpact: 'none',
      installDifficulty: 2,
      proInstall: false,
      shipClass: 'bulky',
      codEligible: true,
      tags: [],
      customKind: null,
      buildSlot: 'spoiler',
      buildStyle: 'roof',
      finishColor: '',
    });
  });

  test('every fixture product maps to the ProductSummary shape', () => {
    const rows = db.all(PRODUCT_SELECT);
    assert.equal(rows.length, 6);
    for (const row of rows) assertShape(toProductSummary(row), 'ProductSummary');

    const wheel = toProductSummary(productRow(f.products.wheel));
    assert.equal(wheel.hasVariants, true);
    assert.equal(wheel.fitmentType, 'pcd');
    assert.equal(wheel.shipClass, 'freight');
    assert.equal(wheel.price, 21999);

    const outOfStock = toProductSummary(productRow(f.products.outOfStock));
    assert.equal(outOfStock.stock, 0);
    assert.equal(outOfStock.inStock, false);
    assert.equal(outOfStock.lowStock, false);

    const showPlate = toProductSummary(productRow(f.products.showPlate));
    assert.equal(showPlate.customKind, 'show-plate');
    assert.equal(showPlate.codEligible, false);
    assert.equal(showPlate.legality, 'off_road_only');
    assert.equal(showPlate.fitmentType, 'none');
  });

  test('the verdict passed in lands on fit, fitNote and fitVerified', () => {
    const row = productRow(f.products.spoiler);
    const direct = toProductSummary(row, { fit: 'direct', fitNote: '', fitVerified: true });
    assert.deepEqual([direct.fit, direct.fitNote, direct.fitVerified], ['direct', '', true]);
    const work = toProductSummary(row, { fit: 'with_work', fitNote: 'Needs two holes drilled in the boot lid', fitVerified: false });
    assert.deepEqual([work.fit, work.fitNote, work.fitVerified], ['with_work', 'Needs two holes drilled in the boot lid', false]);
    const none = toProductSummary(row, { fit: null, fitNote: '', fitVerified: false });
    assert.equal(none.fit, null);
  });

  test('stock flags, photo, art kind, rating and difficulty are derived from the row', () => {
    const row = productRow(f.products.universal);
    assert.equal(toProductSummary({ ...row, stock: 5 }).lowStock, true, 'at the threshold');
    assert.equal(toProductSummary({ ...row, stock: 6 }).lowStock, false);
    assert.equal(toProductSummary({ ...row, stock: 1 }).lowStock, true);
    assert.deepEqual(
      [toProductSummary({ ...row, stock: -2 }).stock, toProductSummary({ ...row, stock: -2 }).inStock],
      [0, false],
    );

    const photos = toProductSummary({ ...row, images: '["/catalog/spoiler/lip-1.webp","/catalog/spoiler/lip-2.webp"]' });
    assert.equal(photos.image, '/catalog/spoiler/lip-1.webp');
    assert.equal(toProductSummary({ ...row, images: '["", "/catalog/spoiler/lip-2.webp"]' }).image, '/catalog/spoiler/lip-2.webp');

    db.run("UPDATE products SET art_kind = 'lip-spoiler' WHERE id = ?", [f.products.universal.id]);
    assert.equal(toProductSummary(productRow(f.products.universal)).artKind, 'lip-spoiler', "the product's own art kind wins");
    db.run('UPDATE products SET art_kind = NULL WHERE id = ?', [f.products.universal.id]);
    assert.equal(toProductSummary(productRow(f.products.universal)).artKind, 'spoiler', "else the category's");

    assert.equal(toProductSummary({ ...row, rating_avg: 4.6666, rating_count: 3 }).ratingAvg, 4.7);
    assert.equal(toProductSummary({ ...row, install_difficulty: 9 }).installDifficulty, 5);
    assert.equal(toProductSummary({ ...row, is_new: 1, is_featured: 1 }).isNew, true);
    assert.equal(toProductSummary({ ...row, build_slot: '', custom_kind: '' }).buildSlot, null);
  });

  test('discountPercent is the whole percent the price is under MRP, never overstated', () => {
    const row = productRow(f.products.universal);
    const percent = (salePrice, mrp) => toProductSummary({ ...row, sale_price: salePrice, mrp }).discountPercent;
    assert.equal(percent(1299, 1999), 35);
    assert.equal(percent(1899, 2499), 24);
    assert.equal(percent(1999, 1999), 0);
    assert.equal(percent(2100, 1999), 0);
  });

  test('toVariant, toFitment and toStraightLabel', () => {
    const variant = toVariant(db.get('SELECT * FROM product_variants WHERE id = ?', [f.products.wheel.variants[1].id]));
    assertShape(variant, 'ProductVariant');
    assert.deepEqual(variant, {
      id: f.products.wheel.variants[1].id,
      name: '15 inch / Gunmetal',
      sku: 'T-WHL-001-GUN',
      price: 23999,
      regularPrice: 23999,
      mrp: 29999,
      stock: 2,
      inStock: true,
      attributes: { Size: '15 inch', Finish: 'Gunmetal' },
    });

    const fitment = toFitment(
      db.get(
        `SELECT pf.vehicle_id, pf.fit_type, pf.note, pf.is_verified, v.*
         FROM product_fitments pf JOIN vehicles v ON v.id = pf.vehicle_id WHERE pf.product_id = ?`,
        [f.products.spoiler.id],
      ),
    );
    assertShape(fitment, 'ProductFitment');
    assertShape(fitment.vehicle, 'Vehicle');
    assert.equal(fitment.vehicle.id, f.vehicles.swiftOld.id);
    assert.equal(fitment.vehicle.label, 'Maruti Suzuki Swift (2018-2024)');
    assert.deepEqual([fitment.fitType, fitment.note, fitment.isVerified], ['direct', '', true]);

    db.run(
      `UPDATE products SET legality = 'check_rules', legality_note = 'Keep it within the width of the car.', warranty_impact = 'possible',
         warranty_note = 'Drilling the tailgate may affect the paint warranty.', wiring = 'plug_and_play', reversible = 0,
         skip_if = 'Skip this if you plan to sell the car within a year.', install_time_min = 45, install_time_max = 90,
         pro_install = 1, fitting_cost_min = 300, fitting_cost_max = 600 WHERE id = ?`,
      [f.products.spoiler.id],
    );
    const label = toStraightLabel(productRow(f.products.spoiler));
    assertShape(label, 'StraightLabel');
    assert.deepEqual(label, {
      legality: 'check_rules',
      legalityNote: 'Keep it within the width of the car.',
      warrantyImpact: 'possible',
      warrantyNote: 'Drilling the tailgate may affect the paint warranty.',
      wiring: 'plug_and_play',
      reversible: false,
      skipIf: 'Skip this if you plan to sell the car within a year.',
      installDifficulty: 2,
      installTimeMin: 45,
      installTimeMax: 90,
      proInstall: true,
      fittingCostMin: 300,
      fittingCostMax: 600,
    });
  });

  test('toProductDetail adds the page fields and takes the parts it is given', () => {
    const row = productRow(f.products.wheel);
    const bare = toProductDetail(row);
    assertShape(bare, 'ProductDetail');
    assert.deepEqual(
      [bare.variants, bare.fitments, bare.relations, bare.similar, bare.priceHistory, bare.lowest30Days],
      [[], [], [], [], [], null],
    );
    assert.equal(bare.hasVariants, true, 'from the row when no variants were passed');
    assert.equal(bare.sku, 'T-WHL-001');
    assert.equal(bare.pcd, '4x100');
    assert.deepEqual(bare.goals, ['sporty']);
    assert.equal(bare.gstRate, 18);
    assert.equal(bare.netQuantity, '1 piece');
    assert.equal(bare.countryOfOrigin, 'India');
    assert.equal(bare.returnable, true);
    assert.equal(bare.isDemo, false);
    assertShape(bare.label, 'StraightLabel');

    const variants = db.all('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order', [row.id]).map((variant) => toVariant(variant));
    const other = toProductSummary(productRow(f.products.outOfStock));
    const detail = toProductDetail(row, {
      fit: { fit: 'universal', fitNote: '', fitVerified: false },
      variants,
      relations: [toRelation({ kind: 'requires', note: 'Alloys need the right nuts.' }, other)],
      similar: [other],
      lowest30Days: 20999,
      priceHistory: [{ date: '2026-10-01', price: 20999 }, { date: '2026-11-01', price: 21999 }],
    });
    assertShape(detail, 'ProductDetail');
    assert.equal(detail.fit, 'universal');
    assert.equal(detail.variants.length, 2);
    assert.equal(detail.lowest30Days, 20999);
    assert.equal(detail.priceHistory.length, 2);
    assertShape(detail.relations[0], 'RelatedProduct');
    assert.deepEqual(detail.relations[0], { kind: 'requires', note: 'Alloys need the right nuts.', product: other });
    assert.equal(toProductDetail(row, { variants: [] }).hasVariants, false, 'from the parts when they are passed');

    const pick = toCategoryPick({ tier: 'sweet_spot', reason: 'The one we fit most.' }, other);
    assertShape(pick, 'CategoryPick');
    assert.deepEqual(pick, { tier: 'sweet_spot', reason: 'The one we fit most.', product: other });
  });

  test('cost price and supplier reach only the admin shape', () => {
    db.run("UPDATE products SET supplier = 'Shree Balaji Traders, Karol Bagh', sold_count = 14 WHERE id = ?", [f.products.spoiler.id]);
    const row = { ...productRow(f.products.spoiler), cost_price: 20917 };

    const requires = toProductSummary(productRow(f.products.universal));
    const pairs = toProductSummary(productRow(f.products.showPlate));
    const parts = {
      relations: [
        toRelation({ kind: 'requires', note: '' }, requires),
        toRelation({ kind: 'pairs_with', note: '' }, pairs),
      ],
    };

    for (const shape of [toProductSummary(row), toProductDetail(row, parts)]) {
      const json = JSON.stringify(shape);
      assert.ok(!json.includes('Shree Balaji'), 'the supplier must not be sent to shoppers');
      assert.ok(!/cost|supplier/i.test(Object.keys(shape).join(' ')), 'no cost or supplier key');
      assert.ok(!json.includes('20917'), 'the cost price must not be sent to shoppers');
    }

    const admin = toAdminProduct(row, parts);
    assertShape(admin, 'AdminProduct');
    assert.equal(admin.costPrice, 20917);
    assert.equal(admin.supplier, 'Shree Balaji Traders, Karol Bagh');
    assert.equal(admin.lowStockThreshold, 5);
    assert.equal(admin.essentialRank, 2);
    assert.equal(admin.isActive, true);
    assert.equal(admin.soldCount, 14);
    assert.deepEqual(admin.requiresIds, [f.products.universal.id]);
    assert.deepEqual(admin.pairsWithIds, [f.products.showPlate.id]);
    assert.equal(admin.createdAt, row.created_at);
    assert.equal(admin.updatedAt, row.updated_at);
    assert.equal(toAdminProduct({ ...row, cost_price: null }).costPrice, null);
  });
});

describe('a live drop', () => {
  let app;
  let dropId;
  const startsAt = toIso(new Date(Date.now() - 60 * 60 * 1000));
  const endsAt = toIso(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const row = (product) => getProductRow(app.ctx, product.id);

  before(async () => {
    app = await startTestApp();
    dropId = app.ctx.db.run("INSERT INTO drops (title, note, starts_at, ends_at) VALUES ('The Friday Five', 'Five parts, three days.', ?, ?)", [
      startsAt,
      endsAt,
    ]).lastInsertRowid;
    const item = (product, percent, reason) =>
      app.ctx.db.run('INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, ?, ?)', [dropId, product.id, percent, reason]);
    item(app.fixtures.products.spoiler, 15, 'The last of the old packaging.');
    item(app.fixtures.products.wheel, 7, 'One finish too many on the shelf.');
  });
  after(async () => {
    await app.close();
  });

  test('price is the dropped price, regularPrice the price before it, discountPercent is against MRP', () => {
    const spoiler = toProductSummary(row(app.fixtures.products.spoiler));
    assert.equal(spoiler.price, 2974);
    assert.equal(spoiler.regularPrice, 3499);
    assert.equal(spoiler.mrp, 4999);
    assert.equal(spoiler.discountPercent, 40);
    assertShape(spoiler.drop, 'ProductDrop');
    assert.deepEqual(spoiler.drop, { percentOff: 15, reason: 'The last of the old packaging.', endsAt });

    const wheel = toProductSummary(row(app.fixtures.products.wheel));
    assert.equal(wheel.price, 20459);
    assert.equal(wheel.regularPrice, 21999);
    assert.equal(wheel.discountPercent, 26);
    assert.equal(wheel.drop.percentOff, 7);
  });

  test('a product outside the drop is untouched', () => {
    const universal = toProductSummary(row(app.fixtures.products.universal));
    assert.equal(universal.price, 1299);
    assert.equal(universal.regularPrice, 1299);
    assert.equal(universal.discountPercent, 35);
    assert.equal(universal.drop, null);
  });

  test('variants take the same percentage, rounded as the view rounds', () => {
    const wheelRow = row(app.fixtures.products.wheel);
    const variants = app.ctx.db
      .all('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order', [wheelRow.id])
      .map((variant) => toVariant(variant, wheelRow.drop_percent));
    assert.deepEqual(
      variants.map((variant) => [variant.price, variant.regularPrice, variant.mrp]),
      [
        [20459, 21999, 27999],
        [22319, 23999, 29999],
      ],
    );
    assert.equal(variants[0].price, wheelRow.sale_price, 'the product price is its cheapest variant after the drop');
    const fromSql = app.ctx.db.get('SELECT CAST(ROUND(23999 * (100 - 7) / 100.0) AS INTEGER) AS sale').sale;
    assert.equal(variants[1].price, fromSql);
  });

  test('toDrop and toAdminDrop', () => {
    const { fixtures } = app;
    const dropRow = app.ctx.db.get('SELECT * FROM drops WHERE id = ?', [dropId]);
    const items = app.ctx.db
      .all('SELECT * FROM drop_items WHERE drop_id = ? ORDER BY percent_off DESC', [dropId])
      .map((item) => ({ ...item, product: toProductSummary(row({ id: item.product_id })) }));

    const drop = toDrop(dropRow, [...items, { product_id: 999, percent_off: 50, reason: 'No such product', product: undefined }]);
    assertShape(drop, 'Drop');
    assert.deepEqual(
      { ...drop, items: drop.items.map((item) => [item.product.id, item.percentOff, item.reason]) },
      {
        id: dropId,
        title: 'The Friday Five',
        note: 'Five parts, three days.',
        startsAt,
        endsAt,
        items: [
          [fixtures.products.spoiler.id, 15, 'The last of the old packaging.'],
          [fixtures.products.wheel.id, 7, 'One finish too many on the shelf.'],
        ],
      },
    );
    assert.deepEqual(Object.keys(drop.items[0]), ['product', 'percentOff', 'reason']);
    assert.equal(drop.items[0].product.price, 2974);

    const admin = toAdminDrop(dropRow, items, toIso(new Date()));
    assertShape(admin, 'AdminDrop');
    assert.equal(admin.isActive, true);
    assert.equal(admin.state, 'live');
    assert.equal(toAdminDrop(dropRow, items, toIso(new Date(Date.now() - 2 * 60 * 60 * 1000))).state, 'scheduled');
    assert.equal(toAdminDrop(dropRow, items, endsAt).state, 'ended');
    assert.equal(toAdminDrop({ ...dropRow, is_active: 0 }, items, toIso(new Date())).state, 'off');
  });

  test('once the drop ends the regular price is back', () => {
    app.ctx.db.run('UPDATE drops SET ends_at = ? WHERE id = ?', [toIso(new Date(Date.now() - 60 * 1000)), dropId]);
    const spoiler = toProductSummary(row(app.fixtures.products.spoiler));
    assert.equal(spoiler.price, 3499);
    assert.equal(spoiler.regularPrice, 3499);
    assert.equal(spoiler.discountPercent, 30);
    assert.equal(spoiler.drop, null);
  });
});

describe('fitted reports and questions', () => {
  test('toReport and toAdminReport', () => {
    const id = db.run(
      `INSERT INTO reviews (product_id, user_id, order_number, author_name, vehicle, rating, fitted_by, time_minutes, difficulty,
         fitted_ok, issues, body, photos, is_verified_purchase, status, is_demo)
       VALUES (?, ?, 'ADN-261101-AB2C', 'Kiran R.', 'Maruti Suzuki Swift 2021', 4, 'local_garage', 50, 2, 0,
         'One clip was missing from the box.', 'Looks factory fitted once it is on.', ?, 1, 'approved', 1)`,
      [f.products.spoiler.id, f.customer.id, ['/uploads/a.webp', '/uploads/b.webp']],
    ).lastInsertRowid;
    const row = db.get(
      'SELECT r.*, p.name AS product_name, p.slug AS product_slug FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.id = ?',
      [id],
    );

    const report = toReport(row);
    assertShape(report, 'FittedReport');
    assert.deepEqual(report, {
      id,
      productId: f.products.spoiler.id,
      authorName: 'Kiran R.',
      vehicle: 'Maruti Suzuki Swift 2021',
      rating: 4,
      fittedBy: 'local_garage',
      timeMinutes: 50,
      difficulty: 2,
      fittedOk: false,
      issues: 'One clip was missing from the box.',
      body: 'Looks factory fitted once it is on.',
      photos: ['/uploads/a.webp', '/uploads/b.webp'],
      isVerifiedPurchase: true,
      isDemo: true,
      createdAt: row.created_at,
    });
    assert.deepEqual(
      [toReport({ ...row, time_minutes: null, difficulty: null }).timeMinutes, toReport({ ...row, difficulty: null }).difficulty],
      [null, null],
    );

    const admin = toAdminReport(row);
    assertShape(admin, 'AdminReport');
    assert.equal(admin.status, 'approved');
    assert.equal(admin.orderNumber, 'ADN-261101-AB2C');
    assert.equal(admin.productName, f.products.spoiler.name);
    assert.equal(admin.productSlug, f.products.spoiler.slug);
  });

  test('toQuestion never carries the phone number; toAdminQuestion does', () => {
    const id = db.run(
      `INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, phone, question)
       VALUES (?, 'fitment', ?, 'Hyundai Creta (2020 onwards)', 'Meera', '9812300011', 'Will this sit flush on the Creta tailgate?')`,
      [f.products.spoiler.id, f.vehicles.creta.id],
    ).lastInsertRowid;
    const select = `SELECT q.*, p.name AS product_name, p.slug AS product_slug,
        (SELECT COUNT(*) FROM product_questions s WHERE s.product_id = q.product_id AND s.vehicle_id = q.vehicle_id) AS same_ask_count
      FROM product_questions q JOIN products p ON p.id = q.product_id WHERE q.id = ?`;
    const pending = db.get(select, [id]);

    const question = toQuestion(pending);
    assertShape(question, 'Question');
    assert.deepEqual(question, {
      id,
      kind: 'fitment',
      vehicleLabel: 'Hyundai Creta (2020 onwards)',
      authorName: 'Meera',
      question: 'Will this sit flush on the Creta tailgate?',
      answer: null,
      answerFitType: null,
      answeredAt: null,
      isDemo: false,
      createdAt: pending.created_at,
    });
    assert.ok(!JSON.stringify(question).includes('9812300011'));

    db.run(
      "UPDATE product_questions SET answer = 'It fits with two small holes.', answer_fit_type = 'with_work', answered_at = '2026-11-17T09:00:00Z', status = 'published' WHERE id = ?",
      [id],
    );
    const answered = toQuestion(db.get(select, [id]));
    assert.deepEqual([answered.answer, answered.answerFitType, answered.answeredAt], ['It fits with two small holes.', 'with_work', '2026-11-17T09:00:00Z']);

    const admin = toAdminQuestion(db.get(select, [id]));
    assertShape(admin, 'AdminQuestion');
    assert.equal(admin.phone, '9812300011');
    assert.equal(admin.status, 'published');
    assert.equal(admin.vehicleId, f.vehicles.creta.id);
    assert.equal(admin.productId, f.products.spoiler.id);
    assert.equal(admin.productName, f.products.spoiler.name);
    assert.equal(admin.productSlug, f.products.spoiler.slug);
    assert.equal(admin.sameAskCount, 1);
    assert.equal(toAdminQuestion({ ...pending, same_ask_count: 4 }).sameAskCount, 4);
    assert.equal(toAdminQuestion({ ...pending, same_ask_count: undefined, vehicle_id: null }).sameAskCount, 1);
    assert.equal(toAdminQuestion({ ...pending, vehicle_id: null }).vehicleId, null);
  });
});

describe('coupons, orders and quotes', () => {
  let orderId;
  const orderRow = () => db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const itemRows = () => db.all('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [orderId]);
  const eventRows = () => db.all('SELECT * FROM order_events WHERE order_id = ? ORDER BY id', [orderId]);

  before(() => {
    orderId = db.run(
      `INSERT INTO orders (order_number, invoice_number, access_token, idempotency_key, user_id, status, payment_method, payment_status,
         razorpay_order_id, razorpay_payment_id, customer_name, email, phone, ship_name, ship_phone, ship_line1, ship_line2, ship_landmark,
         ship_city, ship_state, ship_pincode, gstin, vehicle, subtotal, discount, coupon_code, prepaid_discount, shipping_fee, cod_fee,
         total, advance_amount, amount_paid, quote_token, notes, tracking_carrier, tracking_number, tracking_url, pack_photo)
       VALUES ('ADN-261117-4F7K', 'ADN/26-27/0007', 'tok_SECRET_ACCESS', 'idem_SECRET_KEY', ?, 'placed', 'cod', 'pending',
         'order_SECRET_RZP', 'pay_SECRET_RZP', 'Kiran Rao', 'kiran@example.com', '9876543210', 'Kiran Rao', '9876543210', '12 MG Road', 'Flat 4B',
         'Opposite the metro station', 'Pune', 'Maharashtra', '411001', '27AAPFU0939F1ZV', 'Maruti Suzuki Swift (2018-2024)', 6097, 500, 'FIT10',
         0, 199, 49, 5845, 0, 0, 'quote_SECRET_TOKEN', 'Call before delivery.', 'Delhivery', 'DL123456', 'https://track.example/DL123456',
         '/uploads/pack.webp')`,
      [f.customer.id],
    ).lastInsertRowid;
    const item = (product, qty, custom) =>
      db.run(
        `INSERT INTO order_items (order_id, product_id, variant_id, slug, name, variant_name, sku, image, price, mrp, qty, gst_rate, hsn_code, custom)
         VALUES (?, ?, NULL, ?, ?, '', ?, '', ?, ?, ?, 18, '87089900', ?)`,
        [orderId, product.id, product.slug, product.name, product.sku, product.price, product.mrp, qty, custom],
      );
    item(f.products.spoiler, 1, null);
    item(f.products.universal, 2, { note: 'Gift wrap' });
    db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, 'placed', 'Order placed.', 'customer', '2026-11-17T09:30:00Z')", [orderId]);
    db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, 'confirmed', 'Confirmed on the phone.', 'admin', '2026-11-17T10:00:00Z')", [orderId]);
  });

  test('toCoupon', () => {
    const row = db.get('SELECT * FROM coupons WHERE id = ?', [f.coupon.id]);
    const coupon = toCoupon(row);
    assertShape(coupon, 'Coupon');
    assert.deepEqual(coupon, {
      id: f.coupon.id,
      code: 'FIT10',
      description: '10% off orders above ₹999',
      type: 'percent',
      value: 10,
      minOrder: 999,
      maxDiscount: 500,
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      usedCount: 0,
      isActive: true,
      createdAt: row.created_at,
    });
    const dated = toCoupon({ ...row, max_discount: null, starts_at: '2026-11-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z', usage_limit: 100, is_active: 0 });
    assert.deepEqual(
      [dated.maxDiscount, dated.startsAt, dated.endsAt, dated.usageLimit, dated.isActive],
      [null, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', 100, false],
    );
  });

  test('toOrderItem and toOrderEvent', () => {
    const [first, second] = itemRows().map(toOrderItem);
    assertShape(first, 'OrderItem');
    assert.deepEqual(first, {
      id: first.id,
      productId: f.products.spoiler.id,
      variantId: null,
      slug: f.products.spoiler.slug,
      name: f.products.spoiler.name,
      variantName: '',
      sku: 'T-EXT-001',
      image: null,
      price: 3499,
      mrp: 4999,
      qty: 1,
      lineTotal: 3499,
      gstRate: 18,
      hsnCode: '87089900',
      custom: null,
      fitAtStudio: false,
      fittingCharge: 0,
      fittingServiceName: '',
    });
    assert.equal(second.lineTotal, 2598);
    assert.deepEqual(second.custom, { note: 'Gift wrap' });
    assert.equal(toOrderItem({ ...itemRows()[0], image: '/catalog/spoiler/a.webp', product_id: null }).image, '/catalog/spoiler/a.webp');
    assert.equal(toOrderItem({ ...itemRows()[0], product_id: null }).productId, null);

    const event = toOrderEvent(eventRows()[1]);
    assertShape(event, 'OrderEvent');
    assert.deepEqual(event, { status: 'confirmed', note: 'Confirmed on the phone.', actor: 'admin', createdAt: '2026-11-17T10:00:00Z' });
  });

  test('toOrder builds the whole Order and keeps private columns out', () => {
    const row = orderRow();
    const order = toOrder(row, { items: itemRows(), events: eventRows(), settings: t.ctx.settings.get() });
    assertShape(order, 'Order');
    assertShape(order.shippingAddress, 'ShippingAddress');
    assertShape(order.tax, 'TaxBreakdown');
    for (const item of order.items) assertShape(item, 'OrderItem');
    for (const event of order.events) assertShape(event, 'OrderEvent');

    const { items, events, tax, ...rest } = order;
    assert.deepEqual(rest, {
      orderNumber: 'ADN-261117-4F7K',
      invoiceNumber: 'ADN/26-27/0007',
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      customerName: 'Kiran Rao',
      email: 'kiran@example.com',
      phone: '9876543210',
      shippingAddress: {
        name: 'Kiran Rao',
        phone: '9876543210',
        line1: '12 MG Road',
        line2: 'Flat 4B',
        landmark: 'Opposite the metro station',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
      },
      gstin: '27AAPFU0939F1ZV',
      vehicle: 'Maruti Suzuki Swift (2018-2024)',
      subtotal: 6097,
      discount: 500,
      couponCode: 'FIT10',
      prepaidDiscount: 0,
      shippingFee: 199,
      codFee: 49,
      total: 5845,
      advanceAmount: 0,
      amountPaid: 0,
      amountDue: 5845,
      upiReference: '',
      notes: 'Call before delivery.',
      tracking: { carrier: 'Delhivery', number: 'DL123456', url: 'https://track.example/DL123456' },
      packPhoto: '/uploads/pack.webp',
      fulfilment: 'delivery',
      studioSlot: null,
      fittingTotal: 0,
      bookingNumber: '',
      canCancel: true,
      estimatedDelivery: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    assert.equal(items.length, 2);
    assert.deepEqual(events.map((event) => event.status), ['placed', 'confirmed']);
    assert.equal(Math.round((tax.taxableValue + tax.gst) * 100), 5845 * 100, 'tax is worked out on what was charged');

    const json = JSON.stringify(order);
    for (const secret of ['tok_SECRET_ACCESS', 'idem_SECRET_KEY', 'order_SECRET_RZP', 'pay_SECRET_RZP', 'quote_SECRET_TOKEN']) {
      assert.ok(!json.includes(secret), `${secret} must stay on the server`);
    }
    assert.ok(!('accessToken' in order));
  });

  test('toOrder includes the access token only when asked', () => {
    const order = toOrder(orderRow(), { items: itemRows(), includeToken: true });
    assert.equal(order.accessToken, 'tok_SECRET_ACCESS');
    assertShape(order, 'Order');
    assert.ok(!JSON.stringify(order).includes('order_SECRET_RZP'));
    assert.ok(!('accessToken' in toOrder(orderRow(), { includeToken: false })));
  });

  test('amountDue is total minus amountPaid, never below zero', () => {
    const due = (fields) => toOrder({ ...orderRow(), ...fields }).amountDue;
    assert.equal(due({ amount_paid: 0 }), 5845);
    assert.equal(due({ advance_amount: 500, amount_paid: 500 }), 5345);
    assert.equal(due({ amount_paid: 5845 }), 0);
    assert.equal(due({ amount_paid: 6000 }), 0);
    assert.equal(toOrder({ ...orderRow(), advance_amount: 500, amount_paid: 500 }).advanceAmount, 500);
  });

  test('canCancel is true only before packing', () => {
    const canCancel = (status) => toOrder({ ...orderRow(), status }).canCancel;
    for (const status of ['pending_payment', 'placed', 'confirmed']) assert.equal(canCancel(status), true, status);
    for (const status of ['packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']) {
      assert.equal(canCancel(status), false, status);
    }
  });

  test('estimatedDelivery is null unless a complete window is given', () => {
    const base = { items: itemRows() };
    assert.equal(toOrder(orderRow(), base).estimatedDelivery, null);
    assert.equal(toOrder(orderRow(), { ...base, estimatedDelivery: { earliest: '2026-11-20' } }).estimatedDelivery, null);
    assert.deepEqual(
      toOrder(orderRow(), { ...base, estimatedDelivery: { earliest: '2026-11-20', latest: '2026-11-23', minDays: 3 } }).estimatedDelivery,
      { earliest: '2026-11-20', latest: '2026-11-23' },
    );
  });

  test('tax splits by the store State in settings and the delivery State', () => {
    const tax = (storeState, shipState = 'Maharashtra') =>
      toOrder({ ...orderRow(), ship_state: shipState }, { items: itemRows(), settings: { address: { state: storeState } } }).tax;

    assert.deepEqual(tax('Maharashtra'), { taxableValue: 4953.38, gst: 891.62, cgst: 445.81, sgst: 445.81, igst: 0, isInterState: false });
    assert.deepEqual(tax('Karnataka'), { taxableValue: 4953.39, gst: 891.61, cgst: 0, sgst: 0, igst: 891.61, isInterState: true });
    assert.equal(tax('Karnataka', 'Karnataka').isInterState, false);
    assert.equal(tax('').isInterState, false, 'a store with no State set yet charges CGST + SGST');
    assert.equal(toOrder(orderRow(), { items: itemRows() }).tax.isInterState, false, 'no settings passed');

    assert.equal(t.ctx.settings.get().address.state, '');
    t.ctx.settings.update({ address: { state: 'Karnataka' } });
    assert.equal(toOrder(orderRow(), { items: itemRows(), settings: t.ctx.settings.get() }).tax.igst, 891.61);
    t.ctx.settings.update({ address: { state: '' } });
  });

  test('orderTaxLines spreads discounts over the items and always adds up to the total', () => {
    const lines = orderTaxLines(orderRow(), itemRows());
    assert.deepEqual(lines, [
      { amount: 3212.06, gstRate: 18 },
      { amount: 2384.94, gstRate: 18 },
      { amount: 199, gstRate: 18 },
      { amount: 49, gstRate: 18 },
    ]);
    const sumPaise = (list) => list.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
    assert.equal(sumPaise(lines), 5845 * 100);

    // Mixed rates: delivery and the COD fee follow the highest rate in the order.
    const mixed = orderTaxLines({ total: 2000, shipping_fee: 100, cod_fee: 50 }, [
      { price: 1000, qty: 1, gst_rate: 18 },
      { price: 500, qty: 2, gst_rate: 28 },
    ]);
    assert.deepEqual(mixed, [
      { amount: 925, gstRate: 18 },
      { amount: 925, gstRate: 28 },
      { amount: 100, gstRate: 28 },
      { amount: 50, gstRate: 28 },
    ]);
    const mixedTax = taxBreakdown(mixed, { storeState: 'Delhi', shipState: 'Delhi' });
    assert.equal(Math.round((mixedTax.taxableValue + mixedTax.gst) * 100), 2000 * 100);

    // Shares that do not divide evenly are settled to the paisa, and no line goes negative.
    const thirds = orderTaxLines({ total: 100, shipping_fee: 0, cod_fee: 0 }, [
      { price: 50, qty: 1, gst_rate: 18 },
      { price: 50, qty: 1, gst_rate: 18 },
      { price: 50, qty: 1, gst_rate: 18 },
    ]);
    assert.deepEqual(thirds.map((line) => line.amount), [33.33, 33.34, 33.33]);
    const withFreebie = orderTaxLines({ total: 1, shipping_fee: 0, cod_fee: 0 }, [
      { price: 1, qty: 1, gst_rate: 18 },
      { price: 1, qty: 1, gst_rate: 18 },
      { price: 0, qty: 1, gst_rate: 18 },
    ]);
    assert.ok(withFreebie.every((line) => line.amount >= 0));
    assert.equal(sumPaise(withFreebie), 100);

    assert.deepEqual(orderTaxLines({ total: 1180, shipping_fee: 0, cod_fee: 0 }), [{ amount: 1180, gstRate: 18 }], 'no item rows');
    assert.deepEqual(orderTaxLines({ total: 0, shipping_fee: 0, cod_fee: 0 }, []), []);
  });

  test('toAdminOrderListItem', () => {
    const row = db.get(
      'SELECT o.*, (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = o.id) AS item_count FROM orders o WHERE o.id = ?',
      [orderId],
    );
    const listItem = toAdminOrderListItem(row);
    assertShape(listItem, 'AdminOrderListItem');
    assert.deepEqual(listItem, {
      orderNumber: 'ADN-261117-4F7K',
      status: 'placed',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      customerName: 'Kiran Rao',
      phone: '9876543210',
      city: 'Pune',
      state: 'Maharashtra',
      itemCount: 3,
      total: 5845,
      amountDue: 5845,
      fulfilment: 'delivery',
      studioSlot: null,
      createdAt: row.created_at,
    });
    assert.equal(toAdminOrderListItem({ ...row, amount_paid: 9999 }).amountDue, 0);
  });

  test('toQuote shows the customer the lines without prices and marks a late quote expired', () => {
    const id = db.run(
      `INSERT INTO quotes (token, customer_name, phone, note, items, shipping_fee, valid_until)
       VALUES ('quote-token-1', 'Rahul', '9812300022', 'Price held till Friday.', ?, 0, '2026-11-20T18:30:00Z')`,
      [
        [
          { productId: f.products.spoiler.id, variantId: null, qty: 1, unitPrice: 3199 },
          { productId: f.products.wheel.id, variantId: f.products.wheel.variants[0].id, qty: 1, unitPrice: 20999 },
          { productId: 0, qty: 1, unitPrice: 5 },
          'junk',
        ],
      ],
    ).lastInsertRowid;
    const row = db.get('SELECT * FROM quotes WHERE id = ?', [id]);
    const cart = { lines: [], total: 24198 };

    const quote = toQuote(row, { cart, now: '2026-11-17T10:00:00Z' });
    assertShape(quote, 'QuoteView');
    assert.deepEqual(quote, {
      token: 'quote-token-1',
      customerName: 'Rahul',
      note: 'Price held till Friday.',
      validUntil: '2026-11-20T18:30:00Z',
      status: 'open',
      items: [
        { productId: f.products.spoiler.id, variantId: null, qty: 1 },
        { productId: f.products.wheel.id, variantId: f.products.wheel.variants[0].id, qty: 1 },
      ],
      cart,
    });
    assert.ok(!JSON.stringify(quote).includes('9812300022'));
    assert.equal(toQuote(row, { cart, now: '2026-11-20T18:30:00Z' }).status, 'expired');
    assert.equal(toQuote({ ...row, status: 'ordered' }, { cart, now: '2026-12-01T00:00:00Z' }).status, 'ordered');
    assert.equal(toQuote({ ...row, status: 'cancelled' }, { cart, now: '2026-12-01T00:00:00Z' }).status, 'cancelled');
  });

  test('toAdminQuote adds names, regular prices, cost and margin', () => {
    const row = db.get("SELECT * FROM quotes WHERE token = 'quote-token-1'");
    const wheelVariant = db.get('SELECT * FROM product_variants WHERE id = ?', [f.products.wheel.variants[0].id]);
    const stored = quoteItems(row);
    assert.equal(stored.length, 2, 'malformed lines are dropped');
    const items = [
      toAdminQuoteItem(stored[0], productRow(f.products.spoiler)),
      toAdminQuoteItem(stored[1], productRow(f.products.wheel), wheelVariant),
    ];
    assert.deepEqual(items[1], {
      productId: f.products.wheel.id,
      variantId: wheelVariant.id,
      qty: 1,
      unitPrice: 20999,
      name: f.products.wheel.name,
      variantName: '15 inch / Gloss Black',
      sku: 'T-WHL-001-BLK',
      regularPrice: 21999,
      costPrice: 16000,
    });
    assert.deepEqual([items[0].sku, items[0].variantName, items[0].regularPrice, items[0].costPrice], ['T-EXT-001', '', 3499, 2100]);

    const quote = toAdminQuote(row, { items, now: '2026-11-17T10:00:00Z' });
    assertShape(quote, 'AdminQuote');
    assert.equal(quote.phone, '9812300022');
    assert.equal(quote.shippingFee, 0);
    assert.equal(quote.status, 'open');
    assert.equal(quote.orderNumber, '');
    assert.equal(quote.total, 3199 + 20999);
    assert.equal(quote.margin, 3199 + 20999 - 2100 - 16000);
    assert.equal(toAdminQuote({ ...row, shipping_fee: null }, { items }).shippingFee, null);
    assert.equal(toAdminQuote(row, { items, now: '2026-11-21T00:00:00Z' }).status, 'expired');

    const noCost = [items[0], toAdminQuoteItem(stored[1], { ...productRow(f.products.wheel), cost_price: null }, wheelVariant)];
    assert.equal(toAdminQuote(row, { items: noCost }).margin, null, 'unknown when any cost price is missing');
    assert.equal(toAdminQuoteItem(stored[0], undefined).costPrice, null, 'a product that no longer exists');
  });
});

describe('inbound messages, leads and builds', () => {
  test('toEnquiry', () => {
    const id = db.run(
      `INSERT INTO enquiries (ticket_number, kind, name, phone, email, subject, message, product_id, order_number, vehicle, status, admin_note)
       VALUES ('ADN-T-000042', 'install', 'Meera', '9812300011', 'meera@example.com', 'Fitting in Pune', 'Do you fit spoilers at your shop?', ?, '',
         'Hyundai Creta 2022', 'acknowledged', 'Called back, visiting Saturday.')`,
      [f.products.spoiler.id],
    ).lastInsertRowid;
    const row = db.get('SELECT e.*, p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id = e.product_id WHERE e.id = ?', [id]);
    const enquiry = toEnquiry(row);
    assertShape(enquiry, 'Enquiry');
    assert.deepEqual(enquiry, {
      id,
      ticketNumber: 'ADN-T-000042',
      kind: 'install',
      name: 'Meera',
      phone: '9812300011',
      email: 'meera@example.com',
      subject: 'Fitting in Pune',
      message: 'Do you fit spoilers at your shop?',
      productId: f.products.spoiler.id,
      productName: f.products.spoiler.name,
      orderNumber: '',
      vehicle: 'Hyundai Creta 2022',
      status: 'acknowledged',
      adminNote: 'Called back, visiting Saturday.',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    const general = toEnquiry({ ...row, product_id: null, product_name: null });
    assert.deepEqual([general.productId, general.productName], [null, null]);
  });

  test('toLead leaves the browser token out', () => {
    const cart = [{ key: `${f.products.universal.id}:0:`, productId: f.products.universal.id, name: f.products.universal.name, qty: 2, lineTotal: 2598 }];
    const id = db.run(
      "INSERT INTO checkout_leads (token, name, phone, email, cart, cart_total, status) VALUES ('lead_SECRET_TOKEN', 'Arjun', '9812300033', '', ?, 2598, 'contacted')",
      [cart],
    ).lastInsertRowid;
    const row = db.get('SELECT * FROM checkout_leads WHERE id = ?', [id]);
    const lead = toLead(row);
    assertShape(lead, 'CheckoutLead');
    assert.deepEqual(lead, {
      id,
      name: 'Arjun',
      phone: '9812300033',
      email: '',
      cart,
      cartTotal: 2598,
      status: 'contacted',
      orderNumber: '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
    assert.ok(!JSON.stringify(lead).includes('lead_SECRET_TOKEN'));
  });

  test('toSavedKit and toStockAlert', () => {
    const kitId = db.run(
      `INSERT INTO saved_kits (token, name, phone, vehicle_label, goal, budget, dealer_quote, delivery_date, product_ids, total, status)
       VALUES ('kit-token-1', 'Sana', '9812300044', 'Maruti Suzuki Swift (2024 onwards)', 'new_car', 15000, 28000, '2026-12-05', ?, 4798, 'open')`,
      [[f.products.universal.id, f.products.spoiler.id]],
    ).lastInsertRowid;
    const kitRow = db.get('SELECT * FROM saved_kits WHERE id = ?', [kitId]);
    const kit = toSavedKit(kitRow);
    assertShape(kit, 'SavedKit');
    assert.deepEqual(kit, {
      id: kitId,
      token: 'kit-token-1',
      name: 'Sana',
      phone: '9812300044',
      vehicleLabel: 'Maruti Suzuki Swift (2024 onwards)',
      goal: 'new_car',
      budget: 15000,
      dealerQuote: 28000,
      deliveryDate: '2026-12-05',
      productIds: [f.products.universal.id, f.products.spoiler.id],
      total: 4798,
      status: 'open',
      createdAt: kitRow.created_at,
    });

    const alertId = db.run("INSERT INTO stock_alerts (product_id, variant_id, phone, email) VALUES (?, NULL, '9812300055', '')", [
      f.products.outOfStock.id,
    ]).lastInsertRowid;
    const alertRow = db.get(
      `SELECT a.*, p.name AS product_name, p.slug AS product_slug, p.stock AS stock
       FROM stock_alerts a JOIN products p ON p.id = a.product_id WHERE a.id = ?`,
      [alertId],
    );
    const alert = toStockAlert(alertRow);
    assertShape(alert, 'StockAlert');
    assert.deepEqual(alert, {
      id: alertId,
      productId: f.products.outOfStock.id,
      productName: f.products.outOfStock.name,
      productSlug: f.products.outOfStock.slug,
      stock: 0,
      variantId: null,
      phone: '9812300055',
      email: '',
      status: 'waiting',
      createdAt: alertRow.created_at,
    });
    assert.equal(toStockAlert({ ...alertRow, variant_id: 7, stock: 3, status: 'notified' }).variantId, 7);
  });

  test('toBuild totals the current prices and completes a partial state', () => {
    const state = { bodyType: 'suv', paint: '#1c1c1c', rideHeight: 1, wheelSize: 2, night: true, tint: 35, parts: { wheels: { style: 'mesh', color: '#222222', productId: f.products.wheel.id } } };
    const id = db.run(
      `INSERT INTO builds (slug, title, author_name, vehicle_label, state, product_ids, status, is_house, is_demo)
       VALUES ('night-creta', 'Night Creta', 'Addon', 'Hyundai Creta (2020 onwards)', ?, ?, 'approved', 1, 1)`,
      [state, [f.products.wheel.id, f.products.universal.id]],
    ).lastInsertRowid;
    const row = db.get('SELECT * FROM builds WHERE id = ?', [id]);
    const products = idList(row.product_ids).map((productId) => toProductSummary(getProductRow(t.ctx, productId)));

    const build = toBuild(row, products);
    assertShape(build, 'Build');
    assertShape(build.state, 'BuildState');
    assert.deepEqual(build, {
      slug: 'night-creta',
      title: 'Night Creta',
      authorName: 'Addon',
      vehicleLabel: 'Hyundai Creta (2020 onwards)',
      state,
      products,
      total: 21999 + 1299,
      isHouse: true,
      status: 'approved',
      isDemo: true,
      createdAt: row.created_at,
    });

    const partial = toBuild({ ...row, state: '{"bodyType":"sedan","parts":["not","an","object"]}' });
    assert.deepEqual(partial.state, { bodyType: 'sedan', paint: '#ffffff', rideHeight: 0, wheelSize: 0, night: false, tint: 0, parts: {} });
    assert.deepEqual([partial.products, partial.total], [[], 0]);
  });
});
