import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

let t;
const extra = {};

function addCategory(slug, name, parentId) {
  return Number(
    t.ctx.db.run('INSERT INTO categories (slug, name, parent_id) VALUES (?, ?, ?)', [slug, name, parentId]).lastInsertRowid,
  );
}

let skuSeq = 0;
function addProduct(fields) {
  skuSeq += 1;
  const row = {
    slug: `kit-test-${skuSeq}`,
    sku: `T-KIT-${String(skuSeq).padStart(3, '0')}`,
    name: `Kit test part ${skuSeq}`,
    stock: 10,
    fitment_type: 'universal',
    body_types: [],
    goals: ['new_car'],
    essential_rank: 1,
    is_active: 1,
    custom_kind: null,
    ...fields,
  };
  row.mrp ??= Math.round(row.price * 1.3);
  const id = Number(
    t.ctx.db.run(
      `INSERT INTO products (slug, sku, name, category_id, price, mrp, stock, fitment_type, body_types, goals, essential_rank, is_active, custom_kind)
       VALUES (:slug, :sku, :name, :category_id, :price, :mrp, :stock, :fitment_type, :body_types, :goals, :essential_rank, :is_active, :custom_kind)`,
      row,
    ).lastInsertRowid,
  );
  return { id, ...row };
}

before(async () => {
  t = await startTestApp();
  const { swiftOld, creta } = t.fixtures.vehicles;
  const interior = addCategory('interior', 'Interior', null);
  const mats = addCategory('floor-mats', 'Floor Mats', interior);
  const seats = addCategory('seat-covers', 'Seat Covers', interior);
  const cams = addCategory('dash-cams', 'Dash Cams', interior);
  const flaps = addCategory('mud-flaps', 'Mud Flaps', interior);
  const covers = addCategory('body-covers', 'Body Covers', interior);
  const shades = addCategory('sun-shades', 'Sun Shades', interior);
  extra.categories = { mats, seats, cams, flaps, covers, shades };

  extra.matsCheap = addProduct({ category_id: mats, name: 'Addon 7D Floor Mats Basic', price: 1499, essential_rank: 1 });
  extra.matsMid = addProduct({ category_id: mats, name: 'Addon 7D Floor Mats Plus', price: 2999, essential_rank: 1 });
  extra.matsTop = addProduct({ category_id: mats, name: 'Addon 7D Floor Mats Luxe', price: 4999, essential_rank: 1 });
  extra.matsOut = addProduct({ category_id: mats, name: 'Addon Rubber Mats', price: 999, essential_rank: 1, stock: 0 });
  extra.seatsUniversal = addProduct({ category_id: seats, name: 'Addon Seat Covers', price: 3999, essential_rank: 2 });
  extra.seatsHatch = addProduct({
    category_id: seats,
    name: 'Addon Seat Covers for Hatchbacks',
    price: 6999,
    essential_rank: 2,
    fitment_type: 'body_type',
    body_types: ['hatchback'],
  });
  extra.seatsInactive = addProduct({ category_id: seats, name: 'Old Seat Covers', price: 500, essential_rank: 1, is_active: 0 });
  extra.camCheap = addProduct({ category_id: cams, name: 'Addon Dash Cam', price: 4999, essential_rank: 3 });
  extra.camTop = addProduct({ category_id: cams, name: 'Addon Dash Cam 4K', price: 8999, essential_rank: 3 });
  extra.flaps = addProduct({ category_id: flaps, name: 'Addon Mud Flaps', price: 799, essential_rank: 2, fitment_type: 'vehicle' });
  t.ctx.db.run("INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note) VALUES (?, ?, 'with_work', 'Drill two holes')", [
    extra.flaps.id,
    swiftOld.id,
  ]);
  t.ctx.db.run("INSERT INTO product_fitments (product_id, vehicle_id, fit_type) VALUES (?, ?, 'no')", [extra.flaps.id, creta.id]);
  extra.coverSuv = addProduct({
    category_id: covers,
    name: 'Addon SUV Body Cover',
    price: 1999,
    essential_rank: 4,
    fitment_type: 'body_type',
    body_types: ['suv'],
  });
  // Vehicle-specific with no fitment rows: 'unknown' for every car, so never auto-picked.
  extra.shadeUnknown = addProduct({ category_id: shades, name: 'Addon Sun Shades', price: 599, essential_rank: 1, fitment_type: 'vehicle' });
  extra.customKind = addProduct({ category_id: shades, name: 'Designer Thing', price: 299, essential_rank: 1, custom_kind: 'show-plate' });
  extra.noRank = addProduct({ category_id: shades, name: 'Not auto picked', price: 199, essential_rank: 0 });
});

after(() => t.close());

const buildKits = (body) => t.api('/api/kits/build', { method: 'POST', body });
const NEVER = () => [extra.matsOut.id, extra.seatsInactive.id, extra.shadeUnknown.id, extra.customKind.id, extra.noRank.id];
const TIERS = ['essential', 'smart', 'full'];

function checkKitResponse(res, { budget, exclude = [], allowedFits = ['direct', 'with_work', 'universal'] }) {
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { kits } = res.body;
  assert.ok(kits.length <= 3);
  const seenSets = new Set();
  let lastTier = -1;
  let lastTotal = -1;
  let previousIds = null;
  for (const kit of kits) {
    const tierIndex = TIERS.indexOf(kit.tier);
    assert.ok(tierIndex > lastTier, 'tiers are in order and not repeated');
    lastTier = tierIndex;
    assert.ok(kit.items.length >= 2, 'no kit with fewer than two parts');
    assert.ok(kit.total <= budget, `${kit.tier} ${kit.total} over ${budget}`);
    assert.equal(kit.total, kit.items.reduce((sum, item) => sum + item.product.price, 0));
    assert.equal(kit.mrpTotal, kit.items.reduce((sum, item) => sum + item.product.mrp, 0));
    assert.ok(kit.total >= lastTotal, 'totals rise with the tier');
    lastTotal = kit.total;
    if (kit.tier === 'essential') assert.ok(kit.total <= budget * 0.6);
    if (kit.tier === 'smart') assert.ok(kit.total <= budget * 0.85);
    assert.ok(kit.title.length > 0 && kit.blurb.length > 0);
    assert.doesNotMatch(kit.blurb, /!/);

    const categories = kit.items.map((item) => item.product.categoryId);
    assert.equal(new Set(categories).size, categories.length, 'one part per subcategory');
    const ids = kit.items.map((item) => item.product.id);
    const key = [...ids].sort((a, b) => a - b).join(',');
    assert.ok(!seenSets.has(key), 'no duplicate kits');
    seenSets.add(key);
    for (const item of kit.items) {
      assert.ok(item.product.inStock);
      assert.ok(!NEVER().includes(item.product.id), `${item.product.name} should never be picked`);
      assert.ok(!exclude.includes(item.product.id), 'excluded part picked');
      assert.ok(typeof item.reason === 'string' && item.reason.length > 5);
      if (item.product.fit !== null && item.product.fit !== undefined) assert.ok(allowedFits.includes(item.product.fit), item.product.fit);
    }
    // Each tier keeps every subcategory of the tier before it.
    if (previousIds) for (const category of previousIds) assert.ok(categories.includes(category), 'higher tier drops a subcategory');
    previousIds = categories;
  }
  return kits;
}

describe('POST /api/kits/build', () => {
  test('respects budget, fit, one-per-subcategory and tier order across budgets, goals and cars', async () => {
    const { swiftOld, swiftNew, creta } = t.fixtures.vehicles;
    const cars = [{ vehicleId: swiftOld.id }, { vehicleId: swiftNew.id }, { vehicleId: creta.id }, { bodyType: 'hatchback' }, { bodyType: 'suv' }, {}];
    for (const goal of ['new_car', 'sporty']) {
      for (const budget of [500, 2000, 5000, 9000, 15000, 30000, 60000, 200000, 500000]) {
        for (const car of cars) {
          const res = await buildKits({ goal, budget, ...car });
          checkKitResponse(res, { budget });
          assert.equal(res.body.goal, goal);
          assert.equal(res.body.budget, budget);
        }
      }
    }
  });

  test('a big budget gives three distinct tiers that climb from cheapest to better options', async () => {
    const res = await buildKits({ goal: 'new_car', budget: 30000, vehicleId: t.fixtures.vehicles.swiftOld.id });
    const kits = checkKitResponse(res, { budget: 30000 });
    assert.deepEqual(kits.map((kit) => kit.tier), ['essential', 'smart', 'full']);
    const [essential, smart, full] = kits;
    const pickIn = (kit, categoryId) => kit.items.find((item) => item.product.categoryId === categoryId)?.product.id;
    assert.equal(pickIn(essential, extra.categories.mats), extra.matsCheap.id, 'essential takes the cheaper mats');
    assert.equal(pickIn(smart, extra.categories.mats), extra.matsMid.id, 'smart takes the middle option');
    assert.equal(pickIn(full, extra.categories.mats), extra.matsTop.id, 'full takes the better option');
    assert.ok(full.items.length >= smart.items.length && smart.items.length >= essential.items.length);
    assert.ok(essential.items.some((item) => item.reason === 'Protects the new carpets from day one.'));
    // The universal boot spoiler is rank 1 for new_car too.
    assert.ok(full.items.some((item) => item.product.id === t.fixtures.products.universal.id));
    assert.equal(res.body.vehicle.id, t.fixtures.vehicles.swiftOld.id);
  });

  test('fit: parts that do not fit or are unchecked on the car are never picked', async () => {
    const { swiftOld, swiftNew, creta } = t.fixtures.vehicles;
    const { spoiler, wheel } = t.fixtures.products;
    const ids = (res) => res.body.kits.flatMap((kit) => kit.items.map((item) => item.product.id));

    const swift = await buildKits({ goal: 'new_car', budget: 200000, vehicleId: swiftOld.id });
    const flapsItem = swift.body.kits.at(-1).items.find((item) => item.product.id === extra.flaps.id);
    assert.ok(flapsItem, 'with_work part is offered');
    assert.equal(flapsItem.product.fit, 'with_work');
    assert.match(flapsItem.reason, /work/);
    assert.ok(!ids(swift).includes(extra.coverSuv.id), 'SUV cover not offered on a hatchback');
    assert.ok(ids(swift).includes(extra.seatsHatch.id), 'hatchback seat covers offered on a hatchback');

    const cretaRes = await buildKits({ goal: 'new_car', budget: 200000, vehicleId: creta.id });
    assert.ok(!ids(cretaRes).includes(extra.flaps.id), "a 'no' fitment row is respected");
    assert.ok(!ids(cretaRes).includes(extra.seatsHatch.id));
    assert.ok(ids(cretaRes).includes(extra.coverSuv.id));

    const sportyCreta = await buildKits({ goal: 'sporty', budget: 200000, vehicleId: creta.id });
    assert.ok(!ids(sportyCreta).includes(wheel.id), 'wrong bolt pattern');
    assert.ok(!ids(sportyCreta).includes(spoiler.id), 'vehicle part unchecked on this car');

    const sportyNew = await buildKits({ goal: 'sporty', budget: 200000, vehicleId: swiftNew.id });
    assert.ok(!ids(sportyNew).includes(spoiler.id), 'made for the other Swift generation');

    const sportyOld = await buildKits({ goal: 'sporty', budget: 200000, vehicleId: swiftOld.id });
    // The spoiler and the boot lip share a subcategory, so only one of them is in a kit.
    for (const kit of sportyOld.body.kits) {
      const spoilers = kit.items.filter((item) => item.product.categoryId === t.fixtures.categories.spoilers.id);
      assert.ok(spoilers.length <= 1);
    }
    assert.ok(ids(sportyOld).includes(wheel.id), 'matching bolt pattern');
  });

  test('with only a body type: universal and matching body-type parts, no vehicle', async () => {
    const res = await buildKits({ goal: 'new_car', budget: 200000, bodyType: 'suv' });
    checkKitResponse(res, { budget: 200000 });
    assert.equal(res.body.vehicle, null);
    const ids = res.body.kits.flatMap((kit) => kit.items.map((item) => item.product.id));
    assert.ok(ids.includes(extra.coverSuv.id));
    assert.ok(!ids.includes(extra.seatsHatch.id));
    assert.ok(!ids.includes(extra.flaps.id), 'vehicle-specific parts need a named car');
    for (const kit of res.body.kits) for (const item of kit.items) assert.equal(item.product.fit, 'universal');

    const none = await buildKits({ goal: 'new_car', budget: 200000 });
    const noneIds = none.body.kits.flatMap((kit) => kit.items.map((item) => item.product.id));
    assert.ok(!noneIds.includes(extra.coverSuv.id) && !noneIds.includes(extra.seatsHatch.id), 'no car: universal parts only');
  });

  test('exclusions are respected', async () => {
    const exclude = [extra.matsCheap.id, extra.matsMid.id, t.fixtures.products.universal.id];
    const res = await buildKits({ goal: 'new_car', budget: 30000, bodyType: 'hatchback', exclude });
    const kits = checkKitResponse(res, { budget: 30000, exclude });
    assert.ok(kits.length > 0);
  });

  test('the same request gives the same kits', async () => {
    const body = { goal: 'new_car', budget: 17500, vehicleId: t.fixtures.vehicles.swiftOld.id };
    const first = await buildKits(body);
    const second = await buildKits(body);
    assert.deepEqual(first.body, second.body);
  });

  test('nothing to offer gives an empty list, not an error', async () => {
    const res = await buildKits({ goal: 'offroad', budget: 50000 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.kits, []);
    const tiny = await buildKits({ goal: 'new_car', budget: 500, bodyType: 'hatchback' });
    assert.equal(tiny.status, 200);
    assert.deepEqual(tiny.body.kits, []);
  });

  test('identical tiers are merged', async () => {
    // Exclude everything but two parts: essential, smart and full would all be the same two, so one kit comes back.
    const keep = [extra.matsCheap.id, extra.camCheap.id];
    const all = t.ctx.db.all('SELECT id FROM products').map((row) => row.id);
    const exclude = all.filter((id) => !keep.includes(id));
    const res = await buildKits({ goal: 'new_car', budget: 500000, exclude });
    const kits = checkKitResponse(res, { budget: 500000, exclude });
    assert.equal(kits.length, 1);
    assert.deepEqual(kits[0].items.map((item) => item.product.id).sort(), [...keep].sort());
  });

  test('validation', async () => {
    const cases = [
      [{ goal: 'new_car', budget: 499 }, 'budget'],
      [{ goal: 'new_car', budget: 500001 }, 'budget'],
      [{ goal: 'new_car', budget: 1000.5 }, 'budget'],
      [{ goal: 'new_car', budget: '5000' }, 'budget'],
      [{ goal: 'drift', budget: 5000 }, 'goal'],
      [{ budget: 5000 }, 'goal'],
      [{ goal: 'new_car', budget: 5000, bodyType: 'van' }, 'bodyType'],
      [{ goal: 'new_car', budget: 5000, exclude: ['x'] }, 'exclude.0'],
      [{ goal: 'new_car', budget: 5000, vehicleId: 999999 }, 'vehicleId'],
      [{ goal: 'new_car', budget: 5000, vehicleId: -1 }, 'vehicleId'],
    ];
    for (const [body, field] of cases) {
      const res = await buildKits(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error.code, 'validation_error');
      assert.ok(field in res.body.error.fields, `${field} in ${JSON.stringify(res.body.error.fields)}`);
    }
    assert.equal((await t.api('/api/kits/build', { method: 'POST' })).status, 400);
  });
});

describe('POST /api/kits/save', () => {
  const save = (body) => t.api('/api/kits/save', { method: 'POST', body });
  const good = () => ({
    name: 'Ravi Kumar',
    phone: '+91 98450 12345',
    vehicleLabel: 'Maruti Suzuki Swift (2018-2024)',
    goal: 'new_car',
    budget: 20000,
    dealerQuote: 32000,
    deliveryDate: '2026-12-05',
    productIds: [extra.matsCheap.id, extra.camCheap.id, extra.matsCheap.id],
  });

  test('saves the kit as a lead with the total at current prices', async () => {
    const res = await save({ ...good(), total: 1 });
    assert.equal(res.status, 201);
    assert.equal(typeof res.body.token, 'string');
    assert.ok(res.body.token.length >= 20);
    const row = t.ctx.db.get('SELECT * FROM saved_kits WHERE token = ?', [res.body.token]);
    assert.equal(row.total, extra.matsCheap.price + extra.camCheap.price);
    assert.equal(row.phone, '9845012345');
    assert.equal(row.status, 'open');
    assert.equal(row.dealer_quote, 32000);
    assert.equal(row.delivery_date, '2026-12-05');
    assert.deepEqual(JSON.parse(row.product_ids), [extra.matsCheap.id, extra.camCheap.id]);

    const minimal = await save({ name: 'Ravi', phone: '9845012345', goal: 'sporty', budget: 5000, productIds: [extra.matsCheap.id] });
    assert.equal(minimal.status, 201);
  });

  test('validation', async () => {
    const cases = [
      [{ name: '' }, 'name'],
      [{ phone: '12345' }, 'phone'],
      [{ goal: 'drift' }, 'goal'],
      [{ budget: 100 }, 'budget'],
      [{ dealerQuote: -5 }, 'dealerQuote'],
      [{ deliveryDate: '2026-02-30' }, 'deliveryDate'],
      [{ deliveryDate: 'next week' }, 'deliveryDate'],
      [{ productIds: [] }, 'productIds'],
      [{ productIds: [999999] }, 'productIds'],
      [{ productIds: [extra.seatsInactive.id] }, 'productIds'],
      [{ productIds: ['a'] }, 'productIds.0'],
    ];
    for (const [patch, field] of cases) {
      const res = await save({ ...good(), ...patch });
      assert.equal(res.status, 400, JSON.stringify(patch));
      assert.ok(field in res.body.error.fields, `${field} in ${JSON.stringify(res.body.error.fields)}`);
    }
  });
});

describe('Build Bay builds', () => {
  const post = (body) => t.api('/api/builds', { method: 'POST', body });
  const state = (patch = {}) => ({
    bodyType: 'hatchback',
    paint: '#C81E1E',
    rideHeight: -1,
    wheelSize: 1,
    night: true,
    tint: 35,
    parts: {
      wheels: { style: 'mesh', color: '#1a1a1a', productId: null },
      spoiler: { style: 'roof', productId: null },
      underglow: { style: 'glow', color: '#00ffcc' },
      lowering: { style: 'springs' },
    },
    ...patch,
  });
  const good = (patch = {}) => ({
    title: 'Night Swift',
    authorName: 'Ravi',
    vehicleLabel: 'Maruti Suzuki Swift (2018-2024)',
    state: state(),
    productIds: [t.fixtures.products.spoiler.id, t.fixtures.products.wheel.id],
    ...patch,
  });

  test('a private build is saved and readable by its slug, not in the gallery', async () => {
    const res = await post(good());
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const build = res.body;
    assert.match(build.slug, /^night-swift-[0-9a-f]{6}$/);
    assert.equal(build.status, 'private');
    assert.equal(build.isHouse, false);
    assert.equal(build.state.paint, '#c81e1e');
    assert.deepEqual(build.products.map((product) => product.id), [t.fixtures.products.spoiler.id, t.fixtures.products.wheel.id]);
    assert.equal(build.total, t.fixtures.products.spoiler.price + t.fixtures.products.wheel.price);

    const read = await t.api(`/api/builds/${build.slug}`);
    assert.equal(read.status, 200);
    assert.deepEqual(read.body, build);

    const gallery = await t.api('/api/builds');
    assert.ok(!gallery.body.items.some((item) => item.slug === build.slug));

    const again = await post(good());
    assert.notEqual(again.body.slug, build.slug);
    assert.equal((await t.api('/api/builds/no-such-build')).status, 404);
  });

  test('a gallery submission is pending, and only approved builds are listed, house builds first', async () => {
    const pending = await post(good({ title: 'For the gallery', submitToGallery: true }));
    assert.equal(pending.status, 201);
    assert.equal(pending.body.status, 'pending');
    let gallery = await t.api('/api/builds');
    assert.ok(!gallery.body.items.some((item) => item.slug === pending.body.slug));

    t.ctx.db.run("UPDATE builds SET status = 'approved' WHERE slug = ?", [pending.body.slug]);
    const house = await post(good({ title: 'House build', submitToGallery: true }));
    t.ctx.db.run("UPDATE builds SET status = 'approved', is_house = 1, created_at = '2020-01-01T00:00:00Z' WHERE slug = ?", [house.body.slug]);
    const rejected = await post(good({ title: 'Rejected build', submitToGallery: true }));
    t.ctx.db.run("UPDATE builds SET status = 'rejected' WHERE slug = ?", [rejected.body.slug]);

    gallery = await t.api('/api/builds');
    assert.equal(gallery.status, 200);
    assert.ok(gallery.body.items.every((item) => item.status === 'approved'));
    assert.equal(gallery.body.items[0].slug, house.body.slug);
    assert.ok(gallery.body.items.some((item) => item.slug === pending.body.slug));
    assert.equal(gallery.body.total, 2);
    assert.ok(gallery.body.items[0].products.length > 0);
    assert.equal(gallery.body.items[0].total, gallery.body.items[0].products.reduce((sum, product) => sum + product.price, 0));

    const paged = await t.api('/api/builds?limit=1&page=2');
    assert.equal(paged.body.items.length, 1);
    assert.equal(paged.body.items[0].slug, pending.body.slug);
    assert.equal(paged.body.pages, 2);
    assert.equal((await t.api('/api/builds?limit=0')).status, 400);

    // A rejected or pending build is still readable by its slug.
    assert.equal((await t.api(`/api/builds/${rejected.body.slug}`)).status, 200);
  });

  test('every bad field is refused', async () => {
    const { creta } = t.fixtures.vehicles;
    assert.ok(creta);
    const parts = (extraParts) => ({ ...state().parts, ...extraParts });
    const cases = [
      [{ title: '' }, 'title'],
      [{ title: 'x'.repeat(61) }, 'title'],
      [{ state: state({ bodyType: 'coupe' }) }, 'state.bodyType'],
      [{ state: state({ paint: 'red' }) }, 'state.paint'],
      [{ state: state({ paint: '#12345' }) }, 'state.paint'],
      [{ state: state({ rideHeight: -3 }) }, 'state.rideHeight'],
      [{ state: state({ rideHeight: 0.5, parts: {} }) }, 'state.rideHeight'],
      [{ state: state({ wheelSize: 3 }) }, 'state.wheelSize'],
      [{ state: state({ tint: 61 }) }, 'state.tint'],
      [{ state: state({ night: 'yes' }) }, 'state.night'],
      [{ state: { ...state(), extra: 1 } }, 'state'],
      [{ state: state({ parts: parts({ wings: { style: 'gt-wing' } }) }) }, 'state.parts'],
      [{ state: state({ parts: parts({ wheels: { style: 'banana' } }) }) }, 'state.parts.wheels.style'],
      [{ state: state({ parts: parts({ wheels: { style: 'mesh', color: 'black' } }) }) }, 'state.parts.wheels.color'],
      [{ state: state({ parts: parts({ underglow: { style: 'glow' } }) }) }, 'state.parts.underglow.color'],
      [{ state: state({ parts: parts({ bullBar: { style: 'bar' } }) }) }, 'state.parts.bullBar'],
      [{ state: state({ parts: parts({ snorkel: { style: 'snorkel' } }) }) }, 'state.parts.snorkel'],
      [{ state: state({ bodyType: 'sedan' }) }, 'state.parts.spoiler.style'],
      [{ state: state({ rideHeight: 0 }) }, 'state.rideHeight'],
      [{ state: state({ parts: parts({ exhaust: { style: 'twin', productId: 999999 } }) }) }, 'state.parts.exhaust.productId'],
      [{ productIds: [999999] }, 'productIds'],
      [{ productIds: [t.fixtures.products.spoiler.id, extra.seatsInactive.id] }, 'productIds'],
      [{ productIds: 'all' }, 'productIds'],
      [{ submitToGallery: 'yes' }, 'submitToGallery'],
      [{ state: undefined }, 'state'],
    ];
    const before = t.ctx.db.get('SELECT COUNT(*) AS n FROM builds').n;
    for (const [patch, field] of cases) {
      const res = await post(good(patch));
      assert.equal(res.status, 400, `${JSON.stringify(patch)} gave ${res.status}`);
      assert.equal(res.body.error.code, 'validation_error');
      assert.ok(
        Object.keys(res.body.error.fields ?? {}).some((key) => key === field || key.startsWith(`${field}.`)),
        `${field} in ${JSON.stringify(res.body.error.fields)}`,
      );
    }
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM builds').n, before, 'nothing saved');
  });

  test('SUV-only parts are fine on an SUV, and a build may have no products', async () => {
    const res = await post(
      good({
        title: 'Trail Creta',
        productIds: [],
        state: state({
          bodyType: 'suv',
          rideHeight: 2,
          parts: {
            bullBar: { style: 'bar' },
            sideStep: { style: 'board' },
            snorkel: { style: 'snorkel' },
            roofRack: { style: 'basket' },
            lightBar: { style: 'roof-bar' },
            decal: { style: 'side-graphic', color: '#fff' },
            spoiler: { style: 'roof' },
          },
        }),
      }),
    );
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.total, 0);
    assert.deepEqual(res.body.products, []);
  });
});
