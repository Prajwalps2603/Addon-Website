import { startTestApp } from './helpers.js';

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { toIso } from '../src/db/index.js';
import {
  PRODUCT_SELECT,
  categoryTree,
  findProductRows,
  findProducts,
  fitSql,
  fitVerdict,
  fitVerdictsFor,
  getAdminProduct,
  getCategory,
  getProductDetail,
  getProductRow,
  getProductRowsByIds,
  getProductsByIds,
  getVehicle,
  getVehicleRow,
  inList,
  listVehicleMakes,
  priceTrail,
  productWhereActive,
  whereIn,
} from '../src/lib/catalog.js';
import { toAdminProduct, toProductDetail, toProductSummary } from '../src/lib/mappers.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const indiaDate = (ms) => new Date(ms + 330 * 60 * 1000).toISOString().slice(0, 10);

let skuCounter = 0;
function addProduct(ctx, fields) {
  skuCounter += 1;
  const row = {
    slug: `extra-part-${skuCounter}`,
    sku: `T-XTR-${String(skuCounter).padStart(3, '0')}`,
    name: `Extra Part ${skuCounter}`,
    price: 999,
    mrp: 1499,
    stock: 10,
    fitment_type: 'universal',
    body_types: '[]',
    pcd: '',
    is_active: 1,
    is_featured: 0,
    sold_count: 0,
    ...fields,
  };
  const id = ctx.db.run(
    `INSERT INTO products (slug, sku, name, category_id, price, mrp, stock, fitment_type, body_types, pcd, is_active, is_featured, sold_count)
     VALUES (:slug, :sku, :name, :category_id, :price, :mrp, :stock, :fitment_type, :body_types, :pcd, :is_active, :is_featured, :sold_count)`,
    row,
  ).lastInsertRowid;
  return { id, slug: row.slug, name: row.name };
}

function addVehicle(ctx, make, model, { bodyType = 'hatchback', yearFrom = 2020, yearTo = null, pcd = '', popular = false } = {}) {
  const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return ctx.db.run(
    `INSERT INTO vehicles (make, make_slug, model, model_slug, generation, body_type, year_from, year_to, pcd, is_popular)
     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?)`,
    [make, slug(make), model, slug(model), bodyType, yearFrom, yearTo, pcd, popular],
  ).lastInsertRowid;
}

function addFitment(ctx, productId, vehicleId, fitType, note = '', verified = false) {
  ctx.db.run('INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note, is_verified) VALUES (?, ?, ?, ?, ?)', [
    productId,
    vehicleId,
    fitType,
    note,
    verified,
  ]);
}

// Runs fn and reports how many reads it made through ctx.db.
function countReads(ctx, fn) {
  const { get, all } = ctx.db;
  let reads = 0;
  ctx.db.get = (...args) => {
    reads += 1;
    return get(...args);
  };
  ctx.db.all = (...args) => {
    reads += 1;
    return all(...args);
  };
  try {
    fn();
  } finally {
    ctx.db.get = get;
    ctx.db.all = all;
  }
  return reads;
}

describe('fitVerdict', () => {
  const swift = { id: 1, make: 'Maruti Suzuki', make_slug: 'maruti-suzuki', model: 'Swift', model_slug: 'swift', body_type: 'hatchback', pcd: '4x100' };
  const creta = { id: 3, make: 'Hyundai', make_slug: 'hyundai', model: 'Creta', model_slug: 'creta', body_type: 'suv', pcd: '5x114.3' };
  const unknownPcd = { ...creta, id: 4, model: 'Nexon', pcd: '' };
  const product = (fields) => ({ id: 10, fitment_type: 'universal', body_types: '[]', pcd: '', ...fields });
  const fitment = (fields) => ({ product_id: 10, vehicle_id: 1, fit_type: 'direct', note: '', is_verified: 0, ...fields });

  test('no vehicle gives no verdict', () => {
    for (const nobody of [null, undefined]) {
      assert.deepEqual(fitVerdict(product({ fitment_type: 'vehicle' }), nobody, fitment({ is_verified: 1 }), { siblingFits: true }), {
        fit: null,
        fitNote: '',
        fitVerified: false,
      });
    }
  });

  test('a fitment row for the pair wins: direct, with_work or no, with its note', () => {
    assert.deepEqual(fitVerdict(product({ fitment_type: 'vehicle' }), swift, fitment({ is_verified: 1 })), {
      fit: 'direct',
      fitNote: '',
      fitVerified: true,
    });
    assert.deepEqual(fitVerdict(product({ fitment_type: 'vehicle' }), swift, fitment({ note: 'Uses the factory holes.' })), {
      fit: 'direct',
      fitNote: 'Uses the factory holes.',
      fitVerified: false,
    });
    assert.deepEqual(
      fitVerdict(product({ fitment_type: 'vehicle' }), swift, fitment({ fit_type: 'with_work', note: 'Needs two holes drilled in the boot lid' })),
      { fit: 'with_work', fitNote: 'Needs two holes drilled in the boot lid', fitVerified: false },
    );
    assert.deepEqual(fitVerdict(product({ fitment_type: 'vehicle' }), swift, fitment({ fit_type: 'no', note: 'Fouls the rear wiper' })), {
      fit: 'no',
      fitNote: 'Fouls the rear wiper',
      fitVerified: false,
    });
  });

  test('the row beats every fitment type, in both directions', () => {
    assert.equal(fitVerdict(product({ fitment_type: 'universal' }), swift, fitment({ fit_type: 'no' })).fit, 'no');
    assert.equal(fitVerdict(product({ fitment_type: 'none' }), swift, fitment({ fit_type: 'with_work' })).fit, 'with_work');
    assert.equal(fitVerdict(product({ fitment_type: 'body_type', body_types: '["suv"]' }), swift, fitment()).fit, 'direct');
    assert.equal(fitVerdict(product({ fitment_type: 'pcd', pcd: '5x114.3' }), swift, fitment()).fit, 'direct');
    assert.equal(fitVerdict(product({ fitment_type: 'vehicle' }), swift, fitment({ fit_type: 'with_work' }), { siblingFits: true }).fit, 'with_work');
  });

  test('fitVerified is true only for a verified direct fit', () => {
    const verified = (fitType) => fitVerdict(product(), swift, fitment({ fit_type: fitType, is_verified: 1 })).fitVerified;
    assert.equal(verified('direct'), true);
    assert.equal(verified('with_work'), false);
    assert.equal(verified('no'), false);
    assert.equal(fitVerdict(product(), swift).fitVerified, false);
  });

  test("'universal' and 'none' products are universal", () => {
    assert.deepEqual(fitVerdict(product({ fitment_type: 'universal' }), swift), { fit: 'universal', fitNote: '', fitVerified: false });
    assert.deepEqual(fitVerdict(product({ fitment_type: 'none' }), creta), { fit: 'universal', fitNote: '', fitVerified: false });
  });

  test("'body_type': universal when the car's body type is listed, else no with the reason", () => {
    const hatchOnly = product({ fitment_type: 'body_type', body_types: '["hatchback"]' });
    assert.deepEqual(fitVerdict(hatchOnly, swift), { fit: 'universal', fitNote: '', fitVerified: false });
    assert.deepEqual(fitVerdict(hatchOnly, creta), { fit: 'no', fitNote: 'Made for hatchbacks only.', fitVerified: false });

    const two = product({ fitment_type: 'body_type', body_types: '["sedan","suv"]' });
    assert.equal(fitVerdict(two, creta).fit, 'universal');
    assert.deepEqual(fitVerdict(two, swift), { fit: 'no', fitNote: 'Made for sedans and SUVs only.', fitVerified: false });
    const three = product({ fitment_type: 'body_type', body_types: ['muv', 'pickup', 'coupe'] });
    assert.equal(fitVerdict(three, swift).fitNote, 'Made for MUVs, pickups and coupes only.');

    for (const broken of ['oops', '[]', '"hatchback"', '{"a":"hatchback"}', '']) {
      assert.deepEqual(fitVerdict(product({ fitment_type: 'body_type', body_types: broken }), swift), { fit: 'no', fitNote: '', fitVerified: false });
    }
  });

  test("'pcd': universal on a match, no on a known mismatch, unknown when either side is blank", () => {
    const wheel = product({ fitment_type: 'pcd', pcd: '4x100' });
    assert.deepEqual(fitVerdict(wheel, swift), { fit: 'universal', fitNote: '', fitVerified: false });
    assert.deepEqual(fitVerdict(wheel, creta), {
      fit: 'no',
      fitNote: 'Needs a 4x100 bolt pattern. This car has 5x114.3.',
      fitVerified: false,
    });
    assert.deepEqual(fitVerdict(wheel, unknownPcd), { fit: 'unknown', fitNote: '', fitVerified: false });
    assert.equal(fitVerdict(product({ fitment_type: 'pcd', pcd: '' }), swift).fit, 'unknown');
    assert.equal(fitVerdict(product({ fitment_type: 'pcd', pcd: ' 4 X 100 ' }), swift).fit, 'universal', 'spacing and case do not matter');
    assert.equal(fitVerdict(product({ fitment_type: 'pcd', pcd: '4×100' }), swift).fit, 'universal', 'nor does a multiplication sign');
  });

  test("'vehicle': no when only another generation of the same model is listed, else unknown", () => {
    const spoiler = product({ fitment_type: 'vehicle' });
    assert.deepEqual(fitVerdict(spoiler, swift, null, { siblingFits: true }), {
      fit: 'no',
      fitNote: 'Made for another generation of the Swift.',
      fitVerified: false,
    });
    assert.equal(fitVerdict(spoiler, swift, null, true).fit, 'no');
    for (const none of [undefined, null, false, {}, { siblingFits: false }]) {
      assert.deepEqual(fitVerdict(spoiler, swift, null, none), { fit: 'unknown', fitNote: '', fitVerified: false });
    }
    assert.equal(fitVerdict(product({ fitment_type: 'universal' }), swift, null, { siblingFits: true }).fit, 'universal', 'only vehicle parts read it');
  });

  test('takes a Vehicle from the API mappers as well as a vehicles row', () => {
    const mapped = { id: 3, make: 'Hyundai', makeSlug: 'hyundai', model: 'Creta', modelSlug: 'creta', bodyType: 'suv', pcd: '5x114.3' };
    assert.equal(fitVerdict(product({ fitment_type: 'body_type', body_types: '["suv"]' }), mapped).fit, 'universal');
    assert.equal(fitVerdict(product({ fitment_type: 'pcd', pcd: '4x100' }), mapped).fit, 'no');
    assert.equal(fitVerdict(product({ fitment_type: 'vehicle' }), mapped, null, { siblingFits: true }).fitNote, 'Made for another generation of the Creta.');
    assert.deepEqual(fitSql(mapped).params, {
      fitVehicleId: 3,
      fitBodyType: 'suv',
      fitPcd: '5x114.3',
      fitMakeSlug: 'hyundai',
      fitModelSlug: 'creta',
    });
    assert.throws(() => fitSql(null), TypeError);
  });
});

describe('IN lists', () => {
  test('inList names one parameter per distinct value', () => {
    assert.deepEqual(inList([3, 4, 3], 'cat'), { sql: '(:cat0, :cat1)', params: { cat0: 3, cat1: 4 } });
    assert.deepEqual(inList(['led', "o'brien; DROP TABLE users"]), { sql: '(:in0, :in1)', params: { in0: 'led', in1: "o'brien; DROP TABLE users" } });
    assert.deepEqual(inList(new Set([7])), { sql: '(:in0)', params: { in0: 7 } });
    assert.deepEqual(inList([]), { sql: '(NULL)', params: {} });
    assert.deepEqual(inList(undefined), { sql: '(NULL)', params: {} });
  });

  test('inList and whereIn refuse anything that could change the SQL', () => {
    assert.throws(() => inList([1], 'bad name'), TypeError);
    assert.throws(() => inList([1], '1x'), TypeError);
    assert.throws(() => inList([{ id: 1 }]), TypeError);
    assert.throws(() => inList([null]), TypeError);
    assert.throws(() => inList([Number.NaN]), TypeError);
    assert.throws(() => whereIn('p.id; DROP TABLE users', [1]), TypeError);
    assert.throws(() => whereIn('p.id = 1 OR p.id', [1]), TypeError);
    assert.deepEqual(whereIn('p.category_id', [3, 4], 'cat'), { sql: 'p.category_id IN (:cat0, :cat1)', params: { cat0: 3, cat1: 4 } });
    assert.deepEqual(whereIn('slug', []), { sql: 'slug IN (NULL)', params: {} });
  });
});

describe('vehicles', () => {
  let t;
  let ids;
  before(async () => {
    t = await startTestApp();
    ids = {
      audi: addVehicle(t.ctx, 'Audi', 'A4', { bodyType: 'sedan', yearFrom: 2016, pcd: '5x112' }),
      nexon: addVehicle(t.ctx, 'Tata', 'Nexon', { bodyType: 'suv', yearFrom: 2017 }),
      baleno: addVehicle(t.ctx, 'Maruti Suzuki', 'Baleno', { yearFrom: 2022, pcd: '4x100' }),
      alto: addVehicle(t.ctx, 'Maruti Suzuki', 'Alto K10', { yearFrom: 2022, popular: true }),
      cretaOld: addVehicle(t.ctx, 'Hyundai', 'Creta', { bodyType: 'suv', yearFrom: 2015, yearTo: 2020, pcd: '5x114.3' }),
    };
  });
  after(async () => {
    await t.close();
  });

  test('getVehicle returns the Vehicle with its label, getVehicleRow the row', () => {
    const { vehicles } = t.fixtures;
    assert.deepEqual(getVehicle(t.ctx, vehicles.swiftOld.id), {
      id: vehicles.swiftOld.id,
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
    assert.equal(getVehicle(t.ctx, vehicles.swiftNew.id).label, 'Maruti Suzuki Swift (2024 onwards)');
    assert.equal(getVehicle(t.ctx, vehicles.creta.id).label, 'Hyundai Creta (2020 onwards)');
    assert.equal(getVehicle(t.ctx, ids.cretaOld).label, 'Hyundai Creta (2015-2020)');
    assert.equal(getVehicle(t.ctx, String(vehicles.creta.id)).id, vehicles.creta.id, 'an id from a query string');

    const row = getVehicleRow(t.ctx, vehicles.creta.id);
    assert.equal(row.body_type, 'suv');
    assert.equal(row.make_slug, 'hyundai');
  });

  test('a missing or malformed id is null, never a throw', () => {
    for (const bad of [9999, 0, -1, 1.5, Number.NaN, 'abc', '', '1 OR 1=1', null, undefined, {}, []]) {
      assert.equal(getVehicle(t.ctx, bad), null, `getVehicle(${JSON.stringify(bad)})`);
      assert.equal(getVehicleRow(t.ctx, bad), null);
    }
  });

  test('listVehicleMakes: popular first then alphabetical, generations newest first', () => {
    const makes = listVehicleMakes(t.ctx);
    assert.deepEqual(makes.map((make) => [make.name, make.slug, make.isPopular]), [
      ['Hyundai', 'hyundai', true],
      ['Maruti Suzuki', 'maruti-suzuki', true],
      ['Audi', 'audi', false],
      ['Tata', 'tata', false],
    ]);
    for (const make of makes) {
      assert.deepEqual(Object.keys(make), ['name', 'slug', 'isPopular', 'models']);
      for (const model of make.models) assert.deepEqual(Object.keys(model), ['name', 'slug', 'bodyType', 'isPopular', 'generations']);
    }

    const maruti = makes[1];
    assert.deepEqual(maruti.models.map((model) => [model.name, model.slug, model.isPopular, model.bodyType]), [
      ['Alto K10', 'alto-k10', true, 'hatchback'],
      ['Swift', 'swift', true, 'hatchback'],
      ['Baleno', 'baleno', false, 'hatchback'],
    ]);
    const swift = maruti.models[1];
    assert.deepEqual(swift.generations.map((vehicle) => vehicle.label), ['Maruti Suzuki Swift (2024 onwards)', 'Maruti Suzuki Swift (2018-2024)']);
    assert.deepEqual(swift.generations.map((vehicle) => vehicle.id), [t.fixtures.vehicles.swiftNew.id, t.fixtures.vehicles.swiftOld.id]);

    const creta = makes[0].models[0];
    assert.deepEqual(creta.generations.map((vehicle) => vehicle.yearFrom), [2020, 2015]);
    assert.equal(creta.isPopular, true, 'popular when any generation is');

    const everyVehicle = makes.flatMap((make) => make.models.flatMap((model) => model.generations));
    assert.equal(everyVehicle.length, 3 + Object.keys(ids).length);
    assert.equal(new Set(everyVehicle.map((vehicle) => vehicle.id)).size, everyVehicle.length);
  });
});

describe('categoryTree', () => {
  let t;
  let f;
  const counts = (tree) => tree.map((category) => [category.slug, category.productCount, category.children.map((child) => [child.slug, child.productCount])]);
  const addCategory = (slug, name, parentId, sortOrder, isActive = 1) =>
    t.ctx.db.run('INSERT INTO categories (slug, name, parent_id, sort_order, is_active) VALUES (?, ?, ?, ?, ?)', [slug, name, parentId, sortOrder, isActive])
      .lastInsertRowid;

  before(async () => {
    t = await startTestApp();
    f = t.fixtures;
  });
  after(async () => {
    await t.close();
  });

  test('top-level categories with children, counting active products, parents summing their children', () => {
    const tree = categoryTree(t.ctx);
    assert.deepEqual(counts(tree), [
      ['exterior-styling', 4, [['spoilers-wings', 4]]],
      ['wheels-tyres', 2, [['alloy-wheels', 2]]],
    ]);
    assert.deepEqual(tree[0].children[0], {
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
    assert.equal(tree[0].parentId, null);
    assert.deepEqual(counts(categoryTree(t.ctx, { includeInactive: true })), counts(tree));
  });

  test('an inactive product is not counted', () => {
    t.ctx.db.run('UPDATE products SET is_active = 0 WHERE id = ?', [f.products.universal.id]);
    assert.deepEqual(counts(categoryTree(t.ctx)), [
      ['exterior-styling', 3, [['spoilers-wings', 3]]],
      ['wheels-tyres', 2, [['alloy-wheels', 2]]],
    ]);
    assert.deepEqual(counts(categoryTree(t.ctx, { includeInactive: true }))[0], ['exterior-styling', 3, [['spoilers-wings', 3]]]);
  });

  test('inactive categories are hidden with everything under them, unless asked for', () => {
    const bodyKits = addCategory('body-kits', 'Body Kits', f.categories.exterior.id, 2, 0);
    addProduct(t.ctx, { category_id: bodyKits });
    const audio = addCategory('audio', 'Audio', null, 3, 0);
    const speakers = addCategory('speakers', 'Speakers', audio, 1, 1);
    addProduct(t.ctx, { category_id: speakers });
    addCategory('accessories', 'Accessories', null, 0, 1);

    assert.deepEqual(counts(categoryTree(t.ctx)), [
      ['accessories', 0, []],
      ['exterior-styling', 3, [['spoilers-wings', 3]]],
      ['wheels-tyres', 2, [['alloy-wheels', 2]]],
    ]);

    const all = categoryTree(t.ctx, { includeInactive: true });
    assert.deepEqual(counts(all), [
      ['accessories', 0, []],
      ['exterior-styling', 4, [['spoilers-wings', 3], ['body-kits', 1]]],
      ['wheels-tyres', 2, [['alloy-wheels', 2]]],
      ['audio', 1, [['speakers', 1]]],
    ]);
    assert.equal(all[1].children[1].isActive, false);
    assert.equal(all[3].isActive, false);
    assert.equal(all[3].children[0].isActive, true);
  });

  test('getCategory finds a top-level or sub category by slug or id', () => {
    const alloys = getCategory(t.ctx, 'alloy-wheels');
    assert.deepEqual([alloys.id, alloys.parentId, alloys.productCount, alloys.children], [f.categories.alloys.id, f.categories.wheels.id, 2, []]);
    const exterior = getCategory(t.ctx, f.categories.exterior.id);
    assert.deepEqual([exterior.slug, exterior.productCount, exterior.children.length], ['exterior-styling', 3, 1]);
    assert.equal(getCategory(t.ctx, 'no-such-category'), null);
    assert.equal(getCategory(t.ctx, 9999), null);
    assert.equal(getCategory(t.ctx, 'body-kits'), null, 'inactive');
    assert.equal(getCategory(t.ctx, 'speakers'), null, 'under an inactive parent');
    assert.equal(getCategory(t.ctx, 'body-kits', { includeInactive: true }).productCount, 1);
    assert.equal(getCategory(t.ctx, 'exterior-styling', { includeInactive: true }).productCount, 4);
  });
});

describe('findProducts and the lookups beside it', () => {
  let t;
  let f;
  let vehicles;
  let extra;
  const ACTIVE = 14;

  const allRows = () => t.ctx.db.all(`${PRODUCT_SELECT} ORDER BY p.id`);
  const noCount = (vehicle) => [...fitVerdictsFor(t.ctx, allRows().filter((row) => row.is_active), vehicle).values()].filter((verdict) => verdict.fit === 'no').length;

  before(async () => {
    t = await startTestApp();
    f = t.fixtures;
    const { spoilers, alloys } = f.categories;
    const nexonId = addVehicle(t.ctx, 'Tata', 'Nexon', { bodyType: 'suv', yearFrom: 2017 });
    vehicles = {
      swiftOld: getVehicleRow(t.ctx, f.vehicles.swiftOld.id),
      swiftNew: getVehicleRow(t.ctx, f.vehicles.swiftNew.id),
      creta: getVehicleRow(t.ctx, f.vehicles.creta.id),
      nexon: getVehicleRow(t.ctx, nexonId),
    };
    extra = {
      fitsWithWork: addProduct(t.ctx, { category_id: spoilers.id }),
      siblingNo: addProduct(t.ctx, { category_id: spoilers.id, fitment_type: 'vehicle' }),
      badBodyTypes: addProduct(t.ctx, { category_id: spoilers.id, fitment_type: 'body_type', body_types: 'oops' }),
      blankPcd: addProduct(t.ctx, { category_id: alloys.id, fitment_type: 'pcd', pcd: '' }),
      bigPcd: addProduct(t.ctx, { category_id: alloys.id, fitment_type: 'pcd', pcd: '5 X 114.3' }),
      sedanSuv: addProduct(t.ctx, { category_id: spoilers.id, fitment_type: 'body_type', body_types: '["sedan","suv"]' }),
      scalarBody: addProduct(t.ctx, { category_id: spoilers.id, fitment_type: 'body_type', body_types: '"hatchback"' }),
      objectBody: addProduct(t.ctx, { category_id: spoilers.id, fitment_type: 'body_type', body_types: '{"a":"hatchback","b":"suv"}' }),
      inactive: addProduct(t.ctx, { category_id: spoilers.id, is_active: 0 }),
    };
    addFitment(t.ctx, extra.fitsWithWork.id, vehicles.creta.id, 'with_work', 'Needs two holes drilled in the tailgate');
    addFitment(t.ctx, extra.fitsWithWork.id, vehicles.swiftOld.id, 'no', 'Fouls the rear wiper');
    addFitment(t.ctx, extra.siblingNo.id, vehicles.swiftOld.id, 'no', 'Wrong mounting points');
  });
  after(async () => {
    await t.close();
  });

  test('lists active products as ProductSummary with the true total', () => {
    const { items, total, vehicle } = findProducts(t.ctx, { limit: 50 });
    assert.equal(total, ACTIVE);
    assert.equal(items.length, ACTIVE);
    assert.equal(vehicle, null);
    assert.ok(!items.some((item) => item.id === extra.inactive.id));
    assert.deepEqual(items.find((item) => item.id === f.products.wheel.id), toProductSummary(getProductRow(t.ctx, f.products.wheel.id)));
    assert.ok(items.every((item) => item.fit === null && item.fitNote === '' && item.fitVerified === false));
    assert.equal(items.find((item) => item.id === f.products.wheel.id).hasVariants, true);
    assert.equal(items.find((item) => item.id === f.products.spoiler.id).hasVariants, false);
    assert.ok(!JSON.stringify(items).includes('cost_price') && !('costPrice' in items[0]));

    assert.equal(findProducts(t.ctx).items.length, ACTIVE, 'the default page of 24 holds them all');
    const everything = findProducts(t.ctx, { includeInactive: true, limit: 50 });
    assert.equal(everything.total, ACTIVE + 1);
    assert.ok(everything.items.some((item) => item.id === extra.inactive.id));
    assert.equal(findProducts(t.ctx, { where: [productWhereActive], limit: 50 }).total, ACTIVE, 'adding the fragment yourself changes nothing');
  });

  test('the default order puts out-of-stock parts last', () => {
    const { items } = findProducts(t.ctx, { limit: 50 });
    assert.equal(items.at(-1).id, f.products.outOfStock.id);
    assert.ok(items.slice(0, -1).every((item) => item.inStock));
  });

  test('pages do not overlap, cover everything and keep the total', () => {
    const seen = [];
    for (let offset = 0; offset < ACTIVE + 4; offset += 4) {
      const page = findProducts(t.ctx, { limit: 4, offset, orderBy: 'p.sale_price DESC' });
      assert.equal(page.total, ACTIVE);
      assert.equal(page.items.length, Math.max(0, Math.min(4, ACTIVE - offset)));
      seen.push(...page.items.map((item) => item.id));
    }
    assert.equal(seen.length, ACTIVE);
    assert.equal(new Set(seen).size, ACTIVE, 'ties on price never repeat or drop a product');

    assert.deepEqual(findProducts(t.ctx, { limit: 4, offset: 100 }), { items: [], total: ACTIVE, vehicle: null });
    assert.deepEqual(findProducts(t.ctx, { limit: 0 }), { items: [], total: ACTIVE, vehicle: null });
    assert.equal(findProducts(t.ctx, { limit: '5', offset: '2' }).items.length, 5, 'numbers from a query string');
  });

  test('where fragments and named parameters filter and sort', () => {
    const alloysOnly = findProducts(t.ctx, { where: ['p.category_id = :categoryId'], params: { categoryId: f.categories.alloys.id }, limit: 50 });
    assert.equal(alloysOnly.total, 4);
    assert.ok(alloysOnly.items.every((item) => item.categorySlug === 'alloy-wheels' && item.parentCategorySlug === 'wheels-tyres'));

    const cheap = findProducts(t.ctx, {
      where: ['p.sale_price <= :maxPrice', 'p.stock > 0', "p.fitment_type IN ('universal', 'none')"],
      params: { maxPrice: 1000 },
      orderBy: 'p.sale_price ASC',
    });
    assert.deepEqual(cheap.items.map((item) => item.id), [f.products.showPlate.id, extra.fitsWithWork.id]);
    assert.equal(cheap.total, 2);

    assert.equal(findProducts(t.ctx, { where: 'p.slug = :slug', params: { slug: f.products.wheel.slug } }).items[0].id, f.products.wheel.id, 'one fragment as a string');

    const inCategories = whereIn('p.category_id', [f.categories.alloys.id, 9999], 'cat');
    assert.equal(findProducts(t.ctx, { where: [inCategories.sql], params: inCategories.params }).total, 4);
    assert.equal(findProducts(t.ctx, { where: [whereIn('p.id', []).sql] }).total, 0, 'an empty list matches nothing');
    assert.equal(
      findProducts(t.ctx, { where: ['p.id IN (SELECT value FROM json_each(:ids))'], params: { ids: [f.products.wheel.id, f.products.spoiler.id] } }).total,
      2,
    );
  });

  test('parameters used only by the ordering, or by nothing, do not break the count', () => {
    const pinned = findProducts(t.ctx, {
      where: ['p.category_id = :categoryId'],
      params: { categoryId: f.categories.spoilers.id, pinned: f.products.showPlate.slug, neverUsed: 'x' },
      orderBy: '(p.slug = :pinned) DESC, p.sale_price DESC',
      limit: 3,
    });
    assert.equal(pinned.total, 10);
    assert.deepEqual(pinned.items.map((item) => item.id).slice(0, 2), [f.products.showPlate.id, f.products.spoiler.id]);
    assert.throws(() => findProducts(t.ctx, { where: ['p.id = :id'], params: { ':id': 1 } }), TypeError);
  });

  test('vehicleId sets the verdict on every item and returns the Vehicle', () => {
    const { items, total, vehicle } = findProducts(t.ctx, { vehicleId: vehicles.creta.id, limit: 50 });
    assert.equal(total, ACTIVE);
    assert.equal(vehicle.label, 'Hyundai Creta (2020 onwards)');
    const verdictOf = (product) => {
      const item = items.find((entry) => entry.id === product.id);
      return [item.fit, item.fitNote, item.fitVerified];
    };
    assert.deepEqual(verdictOf(f.products.spoiler), ['unknown', '', false]);
    assert.deepEqual(verdictOf(f.products.universal), ['universal', '', false]);
    assert.deepEqual(verdictOf(f.products.bodyType), ['no', 'Made for hatchbacks only.', false]);
    assert.deepEqual(verdictOf(f.products.wheel), ['no', 'Needs a 4x100 bolt pattern. This car has 5x114.3.', false]);
    assert.deepEqual(verdictOf(f.products.showPlate), ['universal', '', false]);
    assert.deepEqual(verdictOf(extra.fitsWithWork), ['with_work', 'Needs two holes drilled in the tailgate', false]);
    assert.deepEqual(verdictOf(extra.bigPcd), ['universal', '', false]);
    assert.deepEqual(verdictOf(extra.sedanSuv), ['universal', '', false]);
    assert.deepEqual(verdictOf(extra.badBodyTypes), ['no', '', false]);
    assert.deepEqual(verdictOf(extra.blankPcd), ['unknown', '', false]);

    const forSwiftOld = findProducts(t.ctx, { vehicleId: vehicles.swiftOld.id, limit: 50 }).items;
    const spoiler = forSwiftOld.find((item) => item.id === f.products.spoiler.id);
    assert.deepEqual([spoiler.fit, spoiler.fitNote, spoiler.fitVerified], ['direct', '', true]);
    assert.equal(forSwiftOld.find((item) => item.id === extra.fitsWithWork.id).fit, 'no', 'a row beats the universal rule');
    assert.equal(forSwiftOld.find((item) => item.id === extra.fitsWithWork.id).fitNote, 'Fouls the rear wiper');

    const forSwiftNew = findProducts(t.ctx, { vehicleId: vehicles.swiftNew.id, limit: 50 }).items;
    const sibling = forSwiftNew.find((item) => item.id === f.products.spoiler.id);
    assert.deepEqual([sibling.fit, sibling.fitNote], ['no', 'Made for another generation of the Swift.']);
    assert.equal(forSwiftNew.find((item) => item.id === extra.siblingNo.id).fit, 'unknown', "a sibling's 'no' row lists nothing");
    assert.equal(forSwiftNew.find((item) => item.id === extra.fitsWithWork.id).fit, 'universal');

    const forNexon = findProducts(t.ctx, { vehicleId: vehicles.nexon.id, limit: 50 }).items;
    assert.equal(forNexon.find((item) => item.id === f.products.wheel.id).fit, 'unknown', 'the bolt pattern of this car is not on file');
  });

  test('an unknown vehicle id is treated as no vehicle', () => {
    for (const vehicleId of [9999, 'abc', 0]) {
      const result = findProducts(t.ctx, { vehicleId, fitOnly: true, limit: 50 });
      assert.equal(result.vehicle, null);
      assert.equal(result.total, ACTIVE);
      assert.ok(result.items.every((item) => item.fit === null));
    }
  });

  test("fitOnly leaves out the parts that do not fit, and the total and pages stay right", () => {
    assert.equal(noCount(vehicles.swiftOld), 7);
    assert.equal(noCount(vehicles.swiftNew), 6);
    assert.equal(noCount(vehicles.creta), 5);
    assert.equal(noCount(vehicles.nexon), 4);

    for (const vehicle of Object.values(vehicles)) {
      const expected = ACTIVE - noCount(vehicle);
      const all = findProducts(t.ctx, { vehicleId: vehicle.id, limit: 50 }).items;
      const fitting = all.filter((item) => item.fit !== 'no').map((item) => item.id).sort((a, b) => a - b);
      assert.equal(fitting.length, expected);

      const seen = [];
      for (let offset = 0; offset < ACTIVE; offset += 3) {
        const page = findProducts(t.ctx, { vehicleId: vehicle.id, fitOnly: true, limit: 3, offset });
        assert.equal(page.total, expected, `${vehicle.model}: total on the page at ${offset}`);
        assert.equal(page.items.length, Math.max(0, Math.min(3, expected - offset)), `${vehicle.model}: a full page at ${offset}`);
        assert.ok(page.items.every((item) => item.fit !== 'no'));
        seen.push(...page.items.map((item) => item.id));
      }
      assert.deepEqual(seen.sort((a, b) => a - b), fitting, `${vehicle.model}: exactly the parts that are not ruled out`);
    }

    assert.equal(findProducts(t.ctx, { fitOnly: true, limit: 50 }).total, ACTIVE, 'fitOnly without a vehicle changes nothing');
  });

  test('fitOnly works together with other filters, ordering parameters and inactive products', () => {
    const result = findProducts(t.ctx, {
      where: ['p.category_id = :categoryId'],
      params: { categoryId: f.categories.alloys.id, pinned: 'x' },
      orderBy: '(p.slug = :pinned) DESC, p.id',
      vehicleId: vehicles.creta.id,
      fitOnly: true,
    });
    assert.deepEqual(result.items.map((item) => [item.id, item.fit]), [
      [f.products.outOfStock.id, 'universal'],
      [extra.blankPcd.id, 'unknown'],
      [extra.bigPcd.id, 'universal'],
    ]);
    assert.equal(result.total, 3);
    assert.equal(findProducts(t.ctx, { vehicleId: vehicles.creta.id, fitOnly: true, includeInactive: true, limit: 0 }).total, ACTIVE + 1 - 5);
  });

  test('the SQL verdict agrees with fitVerdict for every product and car', () => {
    const rows = allRows();
    assert.equal(rows.length, ACTIVE + 1);
    for (const vehicle of Object.values(vehicles)) {
      const fit = fitSql(vehicle);
      const fromSql = new Map(t.ctx.db.all(`SELECT p.id, ${fit.sql} AS fit FROM v_products p`, fit.params).map((row) => [row.id, row.fit]));
      const fromJs = fitVerdictsFor(t.ctx, rows, vehicle);
      for (const row of rows) {
        assert.equal(fromSql.get(row.id), fromJs.get(row.id).fit, `${row.slug} on ${vehicle.make} ${vehicle.model} ${vehicle.year_from}`);
      }
    }
    const filter = fitSql(vehicles.creta);
    const fits = t.ctx.db.get(
      `SELECT COUNT(*) AS n FROM v_products p WHERE p.is_active = 1 AND (${filter.sql}) IN ('direct', 'with_work', 'universal')`,
      filter.params,
    ).n;
    assert.equal(fits, 6, 'the count a fitsCount facet needs');
  });

  test('a body type alone is enough to judge parts made for body types', () => {
    const anySuv = { bodyType: 'suv' };
    const rows = allRows();
    const fromJs = fitVerdictsFor(t.ctx, rows, anySuv);
    assert.deepEqual(fromJs.get(f.products.bodyType.id), { fit: 'no', fitNote: 'Made for hatchbacks only.', fitVerified: false });
    assert.equal(fromJs.get(extra.sedanSuv.id).fit, 'universal');
    assert.equal(fromJs.get(f.products.universal.id).fit, 'universal');
    assert.equal(fromJs.get(f.products.wheel.id).fit, 'unknown', 'no bolt pattern to compare');
    assert.equal(fromJs.get(f.products.spoiler.id).fit, 'unknown', 'no model to look up');
    assert.equal(fromJs.get(extra.fitsWithWork.id).fit, 'universal', 'rows for particular cars do not apply');

    const fit = fitSql(anySuv);
    const fromSql = new Map(t.ctx.db.all(`SELECT p.id, ${fit.sql} AS fit FROM v_products p`, fit.params).map((row) => [row.id, row.fit]));
    for (const row of rows) assert.equal(fromSql.get(row.id), fromJs.get(row.id).fit, row.slug);
  });

  test('fitVerdictsFor judges a whole list in one read and covers every row', () => {
    const rows = allRows();
    let verdicts;
    assert.equal(countReads(t.ctx, () => (verdicts = fitVerdictsFor(t.ctx, rows, vehicles.swiftNew))), 1);
    assert.equal(verdicts.size, rows.length);
    assert.equal(verdicts.get(f.products.spoiler.id).fit, 'no');

    assert.equal(countReads(t.ctx, () => (verdicts = fitVerdictsFor(t.ctx, rows, null))), 0);
    assert.equal(verdicts.size, rows.length);
    assert.deepEqual(verdicts.get(f.products.spoiler.id), { fit: null, fitNote: '', fitVerified: false });
    assert.equal(fitVerdictsFor(t.ctx, [], vehicles.creta).size, 0);

    const mapped = getVehicle(t.ctx, vehicles.swiftOld.id);
    assert.deepEqual(fitVerdictsFor(t.ctx, rows, mapped).get(f.products.spoiler.id), { fit: 'direct', fitNote: '', fitVerified: true });
  });

  test('the number of reads does not grow with the page (no N+1)', () => {
    const readsFor = (limit) => countReads(t.ctx, () => findProducts(t.ctx, { vehicleId: vehicles.swiftNew.id, fitOnly: true, limit }));
    assert.equal(readsFor(1), 4, 'vehicle, count, page, fitments');
    assert.equal(readsFor(50), 4);
    assert.equal(countReads(t.ctx, () => findProducts(t.ctx, { limit: 50 })), 2, 'count and page when no car is named');
  });

  test('findProductRows hands back the raw rows, the verdicts and the vehicle row', () => {
    const { rows, total, verdicts, vehicle } = findProductRows(t.ctx, {
      where: ['p.id = :id'],
      params: { id: f.products.spoiler.id },
      vehicleId: vehicles.swiftOld.id,
    });
    assert.equal(total, 1);
    assert.equal(rows[0].cost_price, 2100);
    assert.equal(rows[0].sale_price, 3499);
    assert.equal(rows[0].has_variants, 0);
    assert.equal(vehicle.body_type, 'hatchback');
    assert.deepEqual(verdicts.get(f.products.spoiler.id), { fit: 'direct', fitNote: '', fitVerified: true });
  });

  test('getProductsByIds keeps the order asked for and drops what is missing', () => {
    const { wheel, spoiler, universal } = f.products;
    const ids = [wheel.id, 9999, spoiler.id, wheel.id, extra.inactive.id, String(universal.id), 'junk', null];
    assert.deepEqual(getProductsByIds(t.ctx, ids).map((item) => item.id), [wheel.id, spoiler.id, universal.id]);
    assert.deepEqual(getProductsByIds(t.ctx, ids, { includeInactive: true }).map((item) => item.id), [wheel.id, spoiler.id, extra.inactive.id, universal.id]);
    assert.deepEqual(getProductsByIds(t.ctx, [universal.id, spoiler.id, wheel.id]).map((item) => item.id), [universal.id, spoiler.id, wheel.id]);
    assert.deepEqual(getProductsByIds(t.ctx, []), []);
    assert.deepEqual(getProductsByIds(t.ctx, undefined), []);

    const forCreta = getProductsByIds(t.ctx, [wheel.id, spoiler.id], { vehicleId: vehicles.creta.id });
    assert.deepEqual(forCreta.map((item) => item.fit), ['no', 'unknown']);
    assert.deepEqual(getProductsByIds(t.ctx, [wheel.id])[0], toProductSummary(getProductRow(t.ctx, wheel.id)));
    assert.equal(countReads(t.ctx, () => getProductsByIds(t.ctx, ids, { vehicleId: vehicles.creta.id })), 3, 'rows, vehicle, fitments');
  });

  test('getProductRowsByIds returns a Map of rows, inactive ones included', () => {
    const rows = getProductRowsByIds(t.ctx, [f.products.wheel.id, extra.inactive.id, 9999]);
    assert.deepEqual([...rows.keys()].sort((a, b) => a - b), [f.products.wheel.id, extra.inactive.id]);
    assert.equal(rows.get(f.products.wheel.id).has_variants, 1);
    assert.equal(rows.get(extra.inactive.id).is_active, 0);
    assert.equal(getProductRowsByIds(t.ctx, []).size, 0);
  });

  test('getProductRow reads by id (number) or slug (string)', () => {
    const { wheel, spoiler } = f.products;
    const byId = getProductRow(t.ctx, wheel.id);
    const bySlug = getProductRow(t.ctx, wheel.slug);
    assert.deepEqual(byId, bySlug);
    assert.equal(byId.sale_price, 21999);
    assert.equal(byId.category_slug, 'alloy-wheels');
    assert.equal(byId.parent_category_slug, 'wheels-tyres');
    assert.equal(byId.resolved_art_kind, 'alloy-wheel');
    assert.equal(byId.has_variants, 1);
    assert.equal(getProductRow(t.ctx, spoiler.slug).has_variants, 0);
    assert.equal(getProductRow(t.ctx, extra.inactive.id).is_active, 0, 'inactive products are returned: the caller decides');

    for (const missing of [9999, 'no-such-part', '', String(wheel.id), null, undefined, Number.NaN, 0, -1, 1.5, {}]) {
      assert.equal(getProductRow(t.ctx, missing), null, `getProductRow(${JSON.stringify(missing)})`);
    }
  });
});

describe('priceTrail', () => {
  const now = '2026-11-17T12:00:00Z';
  const nowMs = Date.parse(now);
  const daysAgo = (days) => toIso(new Date(nowMs - days * DAY_MS));
  const price = (amount, days) => ({ price: amount, recorded_at: daysAgo(days) });
  const drop = (percent, fromDays, toDays) => ({ percent_off: percent, starts_at: daysAgo(fromDays), ends_at: daysAgo(toDays) });
  const prices = (trail) => trail.priceHistory.map((point) => point.price);

  test('nothing recorded gives nothing', () => {
    assert.deepEqual(priceTrail([], [], { now }), { lowest30Days: null, priceHistory: [] });
    assert.deepEqual(priceTrail([{ price: 500, recorded_at: 'not a date' }], [], { now }), { lowest30Days: null, priceHistory: [] });
  });

  test('a product that has only ever had one price has no earlier price', () => {
    const trail = priceTrail([price(3499, 12)], [], { now, currentPrice: 3499 });
    assert.equal(trail.lowest30Days, null);
    assert.deepEqual(trail.priceHistory, [{ date: '2026-11-05', price: 3499 }]);
  });

  test('after a price cut it is the price charged before the cut', () => {
    const trail = priceTrail([price(3999, 60), price(3499, 10)], [], { now, currentPrice: 3499 });
    assert.equal(trail.lowest30Days, 3999);
    assert.deepEqual(trail.priceHistory, [
      { date: '2026-09-18', price: 3999 },
      { date: '2026-11-07', price: 3499 },
    ]);
  });

  test('it is the lowest of the prices in force during the 30 days before the current one', () => {
    assert.equal(priceTrail([price(3999, 60), price(3299, 20), price(3499, 5)], [], { now }).lowest30Days, 3299);
    assert.equal(priceTrail([price(2999, 90), price(3499, 40), price(3199, 5)], [], { now }).lowest30Days, 3499, 'a price that ended before the window does not count');
    assert.equal(priceTrail([price(2999, 50), price(3499, 3)], [], { now }).lowest30Days, 2999, 'also after a rise');
  });

  test('a live drop is the current price, measured against what came before it', () => {
    const trail = priceTrail([price(3499, 60)], [drop(15, 1, -3)], { now, currentPrice: 2974 });
    assert.equal(trail.lowest30Days, 3499);
    assert.deepEqual(prices(trail), [3499, 2974]);
    assert.equal(trail.priceHistory.at(-1).date, '2026-11-16');
  });

  test('an earlier drop inside the window is the lowest price, one that ended before it is not', () => {
    const inside = priceTrail([price(3499, 60)], [drop(30, 12, 9), drop(15, 1, -3)], { now, currentPrice: 2974 });
    assert.equal(inside.lowest30Days, 2449);
    assert.deepEqual(prices(inside), [3499, 2449, 3499, 2974]);

    const before = priceTrail([price(3499, 60)], [drop(30, 50, 45), drop(15, 1, -3)], { now, currentPrice: 2974 });
    assert.equal(before.lowest30Days, 3499);
    assert.deepEqual(prices(before), [3499, 2449, 3499, 2974]);
  });

  test('an ended drop followed by nothing puts the current price at its end', () => {
    const trail = priceTrail([price(3499, 60)], [drop(20, 6, 2)], { now, currentPrice: 3499 });
    assert.deepEqual(prices(trail), [3499, 2799, 3499]);
    assert.equal(trail.lowest30Days, 2799);
  });

  test('drops that have not started are ignored, overlapping ones give the larger cut', () => {
    assert.deepEqual(prices(priceTrail([price(1000, 30)], [drop(50, -1, -4)], { now, currentPrice: 1000 })), [1000]);
    const overlapping = priceTrail([price(1000, 30)], [drop(10, 5, -2), drop(25, 3, -1)], { now, currentPrice: 750 });
    assert.deepEqual(prices(overlapping), [1000, 900, 750]);
    assert.equal(overlapping.lowest30Days, 900);
  });

  test('a regular price change during a drop moves the dropped price too', () => {
    const trail = priceTrail([price(1000, 30), price(800, 2)], [drop(10, 5, -2)], { now, currentPrice: 720 });
    assert.deepEqual(prices(trail), [1000, 900, 720]);
    assert.equal(trail.lowest30Days, 900);
  });

  test('when the history does not end on the current price, today is added as the last point', () => {
    const stale = priceTrail([price(3499, 60)], [], { now, currentPrice: 2999 });
    assert.deepEqual(stale.priceHistory, [
      { date: '2026-09-18', price: 3499 },
      { date: '2026-11-17', price: 2999 },
    ]);
    assert.equal(stale.lowest30Days, 3499);
    assert.deepEqual(priceTrail([], [], { now, currentPrice: 999 }), { lowest30Days: null, priceHistory: [{ date: '2026-11-17', price: 999 }] });
  });

  test('dates are days in India, one point per day, 60 points at most', () => {
    const lateEvening = [
      { price: 1000, recorded_at: '2026-11-10T08:00:00Z' },
      { price: 950, recorded_at: '2026-11-16T10:00:00Z' },
      { price: 900, recorded_at: '2026-11-16T19:00:00Z' },
      { price: 850, recorded_at: '2026-11-17T05:00:00Z' },
    ];
    assert.deepEqual(priceTrail(lateEvening, [], { now }).priceHistory, [
      { date: '2026-11-10', price: 1000 },
      { date: '2026-11-16', price: 950 },
      { date: '2026-11-17', price: 850 },
    ]);

    const long = Array.from({ length: 80 }, (_, index) => price(1000 + index, 200 - index));
    const trail = priceTrail(long, [], { now });
    assert.equal(trail.priceHistory.length, 60);
    assert.equal(trail.priceHistory.at(-1).price, 1079);
    assert.ok(trail.priceHistory.every((point, index, list) => index === 0 || list[index - 1].date < point.date), 'oldest first');
  });

  test('entries dated after now are not counted', () => {
    const trail = priceTrail([price(1000, 10), price(1200, -2)], [], { now, currentPrice: 1000 });
    assert.deepEqual(prices(trail), [1000]);
  });
});

describe('getProductDetail', () => {
  let t;
  let f;
  let lips;
  let alloyInStock;
  let alloySoldOut;
  let dropId;
  const now = Date.now();
  const ago = (ms) => toIso(new Date(now - ms));

  before(async () => {
    t = await startTestApp();
    f = t.fixtures;
    const { db } = t.ctx;
    const { spoiler, universal, showPlate } = f.products;

    // Ten more spoilers: odd ones in stock, even ones sold out, the tenth inactive.
    lips = Array.from({ length: 10 }, (_, index) => {
      const n = index + 1;
      return addProduct(t.ctx, {
        category_id: f.categories.spoilers.id,
        name: `Lip Spoiler ${n}`,
        stock: n % 2 === 1 ? 5 : 0,
        sold_count: n,
        is_featured: n === 2,
        is_active: n === 10 ? 0 : 1,
      });
    });
    alloyInStock = addProduct(t.ctx, { category_id: f.categories.alloys.id, name: 'Hub Rings', stock: 3 });
    alloySoldOut = addProduct(t.ctx, { category_id: f.categories.alloys.id, name: 'Valve Caps', stock: 0, sold_count: 500, is_featured: 1 });

    addFitment(t.ctx, spoiler.id, f.vehicles.creta.id, 'with_work', 'Needs two holes drilled in the tailgate');
    const relate = (relatedId, kind, note) =>
      db.run('INSERT INTO product_relations (product_id, related_id, kind, note) VALUES (?, ?, ?, ?)', [spoiler.id, relatedId, kind, note]);
    relate(showPlate.id, 'pairs_with', '');
    relate(universal.id, 'requires', 'The lip closes the gap under the spoiler.');
    relate(lips[9].id, 'pairs_with', 'No longer sold.');

    db.run('DELETE FROM price_history WHERE product_id = ?', [spoiler.id]);
    const record = (price, daysAgo) =>
      db.run('INSERT INTO price_history (product_id, price, mrp, recorded_at) VALUES (?, ?, 4999, ?)', [spoiler.id, price, ago(daysAgo * DAY_MS)]);
    record(3999, 60);
    record(3299, 20);
    record(3499, 5);
  });
  after(async () => {
    await t.close();
  });

  test('returns the complete ProductDetail', () => {
    const { spoiler, universal, showPlate } = f.products;
    const detail = getProductDetail(t.ctx, spoiler.slug);
    assert.deepEqual(Object.keys(detail), Object.keys(toProductDetail(getProductRow(t.ctx, spoiler.id))));
    assert.equal(detail.id, spoiler.id);
    assert.equal(detail.sku, 'T-EXT-001');
    assert.deepEqual([detail.price, detail.regularPrice, detail.mrp, detail.discountPercent, detail.drop], [3499, 3499, 4999, 30, null]);
    assert.deepEqual([detail.fit, detail.fitNote, detail.fitVerified], [null, '', false]);
    assert.deepEqual([detail.variants, detail.hasVariants], [[], false]);
    assert.equal(detail.label.installDifficulty, 2);
    assert.deepEqual(detail.goals, ['sporty']);

    assert.deepEqual(
      detail.fitments.map((fitment) => [fitment.vehicle.label, fitment.fitType, fitment.note, fitment.isVerified]),
      [
        ['Hyundai Creta (2020 onwards)', 'with_work', 'Needs two holes drilled in the tailgate', false],
        ['Maruti Suzuki Swift (2018-2024)', 'direct', '', true],
      ],
    );
    assert.equal(detail.fitments[0].vehicle.id, f.vehicles.creta.id);

    assert.deepEqual(
      detail.relations.map((relation) => [relation.kind, relation.note, relation.product.id]),
      [
        ['requires', 'The lip closes the gap under the spoiler.', universal.id],
        ['pairs_with', '', showPlate.id],
      ],
      'requires first; the relation to an inactive part is hidden',
    );
    assert.deepEqual(detail.relations[0].product, toProductSummary(getProductRow(t.ctx, universal.id)));
    assert.ok(!JSON.stringify(detail).includes('cost_price') && !('costPrice' in detail) && !('supplier' in detail));
  });

  test('similar: same subcategory, in stock first, eight at most, never the product itself or an inactive one', () => {
    const { spoiler, universal, bodyType, showPlate, wheel, outOfStock } = f.products;
    const similar = getProductDetail(t.ctx, spoiler.slug).similar;
    assert.deepEqual(
      similar.map((item) => item.id),
      [lips[8].id, lips[6].id, lips[4].id, lips[2].id, lips[0].id, universal.id, bodyType.id, showPlate.id],
      'the eight in stock, best sellers first; the sold-out ones do not make the cut',
    );
    assert.ok(similar.every((item) => item.inStock && item.categoryId === f.categories.spoilers.id));
    assert.deepEqual(similar[5], toProductSummary(getProductRow(t.ctx, universal.id)));

    const forWheel = getProductDetail(t.ctx, wheel.slug).similar;
    assert.deepEqual(
      forWheel.map((item) => [item.id, item.inStock]),
      [
        [alloyInStock.id, true],
        [alloySoldOut.id, false],
        [outOfStock.id, false],
      ],
      'in stock comes before featured and best selling',
    );
  });

  test('vehicleId sets the verdict on the product, its relations and its similar parts', () => {
    const { spoiler, bodyType, wheel } = f.products;
    const forSwift = getProductDetail(t.ctx, spoiler.slug, { vehicleId: f.vehicles.swiftOld.id });
    assert.deepEqual([forSwift.fit, forSwift.fitNote, forSwift.fitVerified], ['direct', '', true]);
    assert.ok(forSwift.relations.every((relation) => relation.product.fit === 'universal'));
    assert.ok(forSwift.similar.every((item) => item.fit === 'universal'));

    const forCreta = getProductDetail(t.ctx, spoiler.slug, { vehicleId: f.vehicles.creta.id });
    assert.deepEqual([forCreta.fit, forCreta.fitNote, forCreta.fitVerified], ['with_work', 'Needs two holes drilled in the tailgate', false]);
    assert.deepEqual(
      forCreta.similar.map((item) => [item.id, item.fit]).slice(-2),
      [
        [f.products.showPlate.id, 'universal'],
        [bodyType.id, 'no'],
      ],
      'among parts in stock, one ruled out for this car goes last',
    );
    assert.equal(getProductDetail(t.ctx, spoiler.slug, { vehicleId: f.vehicles.swiftNew.id }).fit, 'no');
    assert.equal(getProductDetail(t.ctx, wheel.slug, { vehicleId: f.vehicles.creta.id }).fit, 'no');
    assert.equal(getProductDetail(t.ctx, spoiler.slug, { vehicleId: 9999 }).fit, null);
  });

  test('variants come in order with their own prices', () => {
    const detail = getProductDetail(t.ctx, f.products.wheel.slug);
    assert.equal(detail.hasVariants, true);
    assert.deepEqual(
      detail.variants.map((variant) => [variant.id, variant.name, variant.price, variant.regularPrice, variant.stock]),
      [
        [f.products.wheel.variants[0].id, '15 inch / Gloss Black', 21999, 21999, 4],
        [f.products.wheel.variants[1].id, '15 inch / Gunmetal', 23999, 23999, 2],
      ],
    );
    t.ctx.db.run('UPDATE product_variants SET is_active = 0 WHERE id = ?', [f.products.wheel.variants[1].id]);
    assert.equal(getProductDetail(t.ctx, f.products.wheel.slug).variants.length, 1, 'inactive variants are not offered');
    t.ctx.db.run('UPDATE product_variants SET is_active = 1 WHERE id = ?', [f.products.wheel.variants[1].id]);
  });

  test('lowest30Days and priceHistory come from price_history', () => {
    const detail = getProductDetail(t.ctx, f.products.spoiler.slug);
    assert.equal(detail.lowest30Days, 3299);
    assert.deepEqual(detail.priceHistory, [
      { date: indiaDate(now - 60 * DAY_MS), price: 3999 },
      { date: indiaDate(now - 20 * DAY_MS), price: 3299 },
      { date: indiaDate(now - 5 * DAY_MS), price: 3499 },
    ]);

    const untouched = getProductDetail(t.ctx, f.products.universal.slug);
    assert.equal(untouched.lowest30Days, null, 'one price since it was listed');
    assert.deepEqual(untouched.priceHistory.map((point) => point.price), [1299]);
  });

  test('a live drop lowers the product and its variants, and joins the price history', () => {
    const { db } = t.ctx;
    const { spoiler, wheel } = f.products;
    dropId = db.run("INSERT INTO drops (title, starts_at, ends_at) VALUES ('The Friday Five', ?, ?)", [ago(HOUR_MS), ago(-3 * DAY_MS)]).lastInsertRowid;
    db.run("INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, 15, 'The last of the old packaging.')", [dropId, spoiler.id]);
    db.run("INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, 7, 'One finish too many on the shelf.')", [dropId, wheel.id]);

    const detail = getProductDetail(t.ctx, spoiler.slug);
    assert.deepEqual([detail.price, detail.regularPrice, detail.discountPercent], [2974, 3499, 40]);
    assert.deepEqual(detail.drop, { percentOff: 15, reason: 'The last of the old packaging.', endsAt: ago(-3 * DAY_MS) });
    assert.equal(detail.lowest30Days, 3299);
    assert.deepEqual(detail.priceHistory.map((point) => point.price), [3999, 3299, 3499, 2974]);
    assert.equal(detail.priceHistory.at(-1).date, indiaDate(now - HOUR_MS));

    const wheelDetail = getProductDetail(t.ctx, wheel.slug);
    assert.deepEqual([wheelDetail.price, wheelDetail.regularPrice, wheelDetail.discountPercent], [20459, 21999, 26]);
    assert.deepEqual(
      wheelDetail.variants.map((variant) => [variant.price, variant.regularPrice, variant.mrp]),
      [
        [20459, 21999, 27999],
        [22319, 23999, 29999],
      ],
    );
    assert.equal(wheelDetail.lowest30Days, null, 'its history begins after the drop did, so there is no earlier price to quote');
    db.run('UPDATE price_history SET recorded_at = ? WHERE product_id = ?', [ago(40 * DAY_MS), wheel.id]);
    const withHistory = getProductDetail(t.ctx, wheel.slug);
    assert.equal(withHistory.lowest30Days, 21999);
    assert.deepEqual(withHistory.priceHistory.map((point) => point.price), [21999, 20459]);

    const listed = findProducts(t.ctx, { where: ['p.drop_percent > 0'], orderBy: 'p.drop_percent DESC' });
    assert.deepEqual(listed.items.map((item) => [item.id, item.price, item.drop.percentOff]), [
      [spoiler.id, 2974, 15],
      [wheel.id, 20459, 7],
    ]);
  });

  test('an earlier drop within 30 days sets lowest30Days; a switched-off one never ran', () => {
    const { db } = t.ctx;
    const { spoiler } = f.products;
    const earlier = db.run("INSERT INTO drops (title, starts_at, ends_at) VALUES ('Earlier drop', ?, ?)", [ago(10 * DAY_MS), ago(8 * DAY_MS)]).lastInsertRowid;
    db.run('INSERT INTO drop_items (drop_id, product_id, percent_off) VALUES (?, ?, 50)', [earlier, spoiler.id]);
    const off = db.run("INSERT INTO drops (title, starts_at, ends_at, is_active) VALUES ('Cancelled drop', ?, ?, 0)", [ago(15 * DAY_MS), ago(14 * DAY_MS)]).lastInsertRowid;
    db.run('INSERT INTO drop_items (drop_id, product_id, percent_off) VALUES (?, ?, 80)', [off, spoiler.id]);

    const detail = getProductDetail(t.ctx, spoiler.slug);
    assert.equal(detail.price, 2974);
    assert.equal(detail.lowest30Days, 1650);
    assert.deepEqual(detail.priceHistory.map((point) => point.price), [3999, 3299, 1650, 3299, 3499, 2974]);
  });

  test('an inactive or unknown product is null unless includeInactive is set', () => {
    const { db } = t.ctx;
    assert.equal(getProductDetail(t.ctx, 'no-such-part'), null);
    assert.equal(getProductDetail(t.ctx, ''), null);
    assert.equal(getProductDetail(t.ctx, undefined), null);
    assert.equal(getProductDetail(t.ctx, lips[9].slug), null);
    const hidden = getProductDetail(t.ctx, lips[9].slug, { includeInactive: true });
    assert.equal(hidden.id, lips[9].id);
    assert.ok(hidden.similar.every((item) => item.id !== lips[9].id));

    db.run('UPDATE products SET is_active = 0 WHERE id = ?', [f.products.universal.id]);
    const detail = getProductDetail(t.ctx, f.products.spoiler.slug);
    assert.deepEqual(detail.relations.map((relation) => relation.product.id), [f.products.showPlate.id]);
    assert.ok(detail.similar.every((item) => item.id !== f.products.universal.id));
    db.run('UPDATE products SET is_active = 1 WHERE id = ?', [f.products.universal.id]);
  });

  test('getAdminProduct adds the owner-only fields and keeps relations to inactive parts', () => {
    const { spoiler, universal, showPlate } = f.products;
    const admin = getAdminProduct(t.ctx, spoiler.id);
    assert.deepEqual(Object.keys(admin), Object.keys(toAdminProduct(getProductRow(t.ctx, spoiler.id))));
    assert.equal(admin.costPrice, 2100);
    assert.equal(admin.isActive, true);
    assert.deepEqual(admin.requiresIds, [universal.id]);
    assert.deepEqual(admin.pairsWithIds, [showPlate.id, lips[9].id]);
    assert.equal(admin.relations.length, 3);
    assert.equal(admin.price, 2974);
    assert.equal(admin.regularPrice, 3499);
    assert.equal(admin.fitments.length, 2);
    assert.deepEqual(getAdminProduct(t.ctx, spoiler.slug), admin);

    const inactive = getAdminProduct(t.ctx, lips[9].id);
    assert.equal(inactive.isActive, false);
    assert.equal(inactive.name, 'Lip Spoiler 10');
    assert.equal(getAdminProduct(t.ctx, 9999), null);
  });

  test('a product page costs a fixed, small number of reads', () => {
    const reads = countReads(t.ctx, () => getProductDetail(t.ctx, f.products.spoiler.slug, { vehicleId: f.vehicles.creta.id }));
    assert.ok(reads <= 10, `${reads} reads`);
  });
});
