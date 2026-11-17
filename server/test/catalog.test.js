import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { expandQuery, stem, withinOneEdit } from '../src/lib/search.js';

let t;
let P; // fixture products
let V; // fixture vehicles
let C; // fixture categories

before(async () => {
  t = await startTestApp();
  P = t.fixtures.products;
  V = t.fixtures.vehicles;
  C = t.fixtures.categories;
});
after(() => t.close());

const get = (path) => t.api(path);
const ids = (items) => items.map((item) => item.id);
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

// Each test starts from the fixture catalogue with these columns reset.
function resetCatalogue() {
  t.ctx.db.exec(`
    UPDATE products SET is_active = 1, is_new = 0, is_featured = 0, sold_count = 0, rating_avg = 0, rating_count = 0,
      tags = '[]', created_at = '2026-01-01T00:00:00Z';
    DELETE FROM drop_items; DELETE FROM drops; DELETE FROM category_picks; DELETE FROM builds; DELETE FROM search_log;
  `);
  t.ctx.db.run('UPDATE products SET stock = 0 WHERE id = ?', [P.outOfStock.id]);
  t.ctx.db.run('UPDATE products SET mrp = 999, price = 799 WHERE id = ?', [P.showPlate.id]);
}
beforeEach(() => resetCatalogue());

function setProduct(id, fields) {
  const keys = Object.keys(fields);
  t.ctx.db.run(`UPDATE products SET ${keys.map((key) => `${key} = :${key}`).join(', ')} WHERE id = :id`, { ...fields, id });
}

function startDrop(items, { startsAgoMs = 60_000, endsInMs = 3_600_000, title = 'Friday Five' } = {}) {
  const now = Date.now();
  const dropId = t.ctx.db.run('INSERT INTO drops (title, note, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, 1)', [
    title,
    'Test drop',
    iso(now - startsAgoMs),
    iso(now + endsInMs),
  ]).lastInsertRowid;
  for (const [productId, percent, reason] of items) {
    t.ctx.db.run('INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, ?, ?)', [dropId, productId, percent, reason ?? '']);
  }
  return dropId;
}

// ---------------------------------------------------------------------------
describe('categories and vehicles', () => {
  test('GET /categories returns the active tree with counts', async () => {
    const res = await get('/api/categories');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((c) => c.slug), ['exterior-styling', 'wheels-tyres']);
    const exterior = res.body[0];
    assert.equal(exterior.productCount, 4);
    assert.deepEqual(exterior.children.map((c) => c.slug), ['spoilers-wings']);
    t.ctx.db.run('UPDATE categories SET is_active = 0 WHERE id = ?', [C.wheels.id]);
    try {
      const hidden = await get('/api/categories');
      assert.deepEqual(hidden.body.map((c) => c.slug), ['exterior-styling']);
    } finally {
      t.ctx.db.run('UPDATE categories SET is_active = 1 WHERE id = ?', [C.wheels.id]);
    }
  });

  test('GET /vehicles groups makes and models, popular first', async () => {
    const res = await get('/api/vehicles');
    assert.equal(res.status, 200);
    const maruti = res.body.find((make) => make.slug === 'maruti-suzuki');
    assert.ok(maruti);
    const swift = maruti.models.find((model) => model.slug === 'swift');
    assert.deepEqual(swift.generations.map((g) => g.id), [V.swiftNew.id, V.swiftOld.id]);
  });

  test('GET /vehicles/:id returns one, 404 when unknown, 400 when malformed', async () => {
    const ok = await get(`/api/vehicles/${V.creta.id}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.label, V.creta.label);
    assert.equal((await get('/api/vehicles/99999')).status, 404);
    const bad = await get('/api/vehicles/abc');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'validation_error');
  });
});

// ---------------------------------------------------------------------------
describe('GET /products filters', () => {
  test('default list: every active product, out of stock last, full response shape', async () => {
    const res = await get('/api/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 6);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.pages, 1);
    assert.equal(res.body.limit, 24);
    assert.equal(res.body.items.at(-1).id, P.outOfStock.id);
    assert.equal(res.body.vehicle, null);
    assert.equal(res.body.category, null);
    assert.deepEqual(res.body.picks, []);
    assert.equal(res.body.understoodAs, null);
    for (const key of ['categories', 'price', 'tags', 'legality', 'inStockCount', 'onSaleCount', 'fitsCount']) {
      assert.ok(key in res.body.facets, key);
    }
    assert.equal(res.body.items[0].fit, null);
    assert.equal('cost_price' in res.body.items[0] || 'costPrice' in res.body.items[0], false);
  });

  test('inactive products are never listed', async () => {
    setProduct(P.universal.id, { is_active: 0 });
    const res = await get('/api/products');
    assert.equal(res.body.total, 5);
    assert.ok(!ids(res.body.items).includes(P.universal.id));
  });

  test('a top-level category includes its subcategories; a subcategory only itself', async () => {
    const top = await get('/api/products?category=exterior-styling');
    assert.equal(top.status, 200);
    assert.equal(top.body.total, 4);
    assert.equal(top.body.category.slug, 'exterior-styling');
    assert.equal(top.body.category.children.length, 1);
    assert.deepEqual(top.body.picks, []);
    const sub = await get('/api/products?category=alloy-wheels');
    assert.deepEqual(new Set(ids(sub.body.items)), new Set([P.wheel.id, P.outOfStock.id]));
    assert.equal(sub.body.category.parentId, C.wheels.id);
  });

  test('an unknown category is a 404, a malformed one a 400', async () => {
    assert.equal((await get('/api/products?category=no-such-thing')).status, 404);
    assert.equal((await get('/api/products?category=%3Cscript%3E')).status, 400);
  });

  test('vehicleId sets fit verdicts; fitOnly hides "no" with right totals and pages', async () => {
    const all = await get(`/api/products?vehicleId=${V.creta.id}`);
    assert.equal(all.body.total, 6);
    assert.equal(all.body.vehicle.id, V.creta.id);
    const byId = new Map(all.body.items.map((item) => [item.id, item]));
    assert.equal(byId.get(P.wheel.id).fit, 'no');
    assert.equal(byId.get(P.bodyType.id).fit, 'no');
    assert.equal(byId.get(P.spoiler.id).fit, 'unknown');
    assert.equal(byId.get(P.universal.id).fit, 'universal');
    assert.equal(all.body.facets.fitsCount, 3); // universal, out-of-stock nuts (universal), show plate (none)

    const page1 = await get(`/api/products?vehicleId=${V.creta.id}&fitOnly=1&limit=2`);
    assert.equal(page1.body.total, 4);
    assert.equal(page1.body.pages, 2);
    assert.equal(page1.body.items.length, 2);
    const page2 = await get(`/api/products?vehicleId=${V.creta.id}&fitOnly=1&limit=2&page=2`);
    assert.equal(page2.body.items.length, 2);
    const seen = [...page1.body.items, ...page2.body.items];
    assert.equal(new Set(ids(seen)).size, 4);
    assert.ok(seen.every((item) => item.fit !== 'no'));
    assert.equal(page2.body.items.at(-1).id, P.outOfStock.id);
    assert.equal(page1.body.facets.fitsCount, 3);

    const swift = await get(`/api/products?vehicleId=${V.swiftOld.id}`);
    const spoiler = swift.body.items.find((item) => item.id === P.spoiler.id);
    assert.equal(spoiler.fit, 'direct');
    assert.equal(spoiler.fitVerified, true);
    const newSwift = await get(`/api/products?vehicleId=${V.swiftNew.id}&fitOnly=1`);
    assert.ok(!ids(newSwift.body.items).includes(P.spoiler.id), 'another generation only: does not fit');
  });

  test('fitOnly without a vehicle changes nothing; an unknown vehicle id is no vehicle', async () => {
    assert.equal((await get('/api/products?fitOnly=1')).body.total, 6);
    const unknown = await get('/api/products?vehicleId=99999&fitOnly=1');
    assert.equal(unknown.status, 200);
    assert.equal(unknown.body.vehicle, null);
    assert.equal(unknown.body.total, 6);
  });

  test('bodyType keeps parts that suit that kind of car', async () => {
    const suv = await get('/api/products?bodyType=suv');
    const suvIds = ids(suv.body.items);
    assert.ok(!suvIds.includes(P.bodyType.id), 'hatchback-only spoiler');
    assert.ok(!suvIds.includes(P.spoiler.id), 'Swift-only spoiler');
    assert.ok(suvIds.includes(P.universal.id));
    assert.ok(suvIds.includes(P.wheel.id), 'wheels go by bolt pattern');
    const hatch = ids((await get('/api/products?bodyType=hatchback')).body.items);
    assert.ok(hatch.includes(P.bodyType.id) && hatch.includes(P.spoiler.id));
    assert.equal((await get('/api/products?bodyType=tractor')).status, 400);
  });

  test('price range uses the current sale price', async () => {
    const res = await get('/api/products?minPrice=1000&maxPrice=5000');
    assert.deepEqual(new Set(ids(res.body.items)), new Set([P.universal.id, P.bodyType.id, P.spoiler.id]));
    startDrop([[P.spoiler.id, 50, 'Half off']]); // 3499 -> 1750
    const cheap = await get('/api/products?maxPrice=2000');
    assert.ok(ids(cheap.body.items).includes(P.spoiler.id));
    const bad = await get('/api/products?minPrice=5000&maxPrice=1000');
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.maxPrice);
    assert.equal((await get('/api/products?minPrice=-5')).status, 400);
    assert.equal((await get('/api/products?maxPrice=cheap')).status, 400);
  });

  test('inStock, onSale, isNew, featured', async () => {
    assert.equal((await get('/api/products?inStock=1')).body.total, 5);
    setProduct(P.showPlate.id, { mrp: 799 });
    const sale = await get('/api/products?onSale=1');
    assert.equal(sale.body.total, 5);
    assert.ok(!ids(sale.body.items).includes(P.showPlate.id));
    setProduct(P.wheel.id, { is_new: 1 });
    assert.deepEqual(ids((await get('/api/products?isNew=1')).body.items), [P.wheel.id]);
    setProduct(P.universal.id, { is_featured: 1 });
    assert.deepEqual(ids((await get('/api/products?featured=1')).body.items), [P.universal.id]);
    assert.equal((await get('/api/products?inStock=yes')).status, 400);
  });

  test('legality, maxDifficulty, tags, buildSlot', async () => {
    assert.deepEqual(ids((await get('/api/products?legality=off_road_only')).body.items), [P.showPlate.id]);
    const easy = await get('/api/products?maxDifficulty=1');
    assert.equal(easy.body.total, 3); // universal, nuts, show plate
    assert.ok(easy.body.items.every((item) => item.installDifficulty <= 1));
    assert.equal((await get('/api/products?maxDifficulty=9')).status, 400);

    setProduct(P.universal.id, { tags: JSON.stringify(['abs', 'Easy Fit']) });
    setProduct(P.wheel.id, { tags: JSON.stringify(['alloy']) });
    assert.deepEqual(ids((await get('/api/products?tags=easy%20fit')).body.items), [P.universal.id]);
    assert.equal((await get('/api/products?tags=abs,alloy')).body.total, 2);

    assert.deepEqual(ids((await get('/api/products?buildSlot=wheels')).body.items), [P.wheel.id]);
    // Several slots in one request, as the Build Bay asks.
    const slots = await get('/api/products?buildSlot=wheels,spoiler&sort=price_asc');
    assert.deepEqual(ids(slots.body.items), [P.spoiler.id, P.wheel.id]);
    assert.equal((await get('/api/products?buildSlot=jetpack')).status, 400);
    assert.equal((await get('/api/products?buildSlot=wheels,jetpack')).status, 400);
    assert.equal((await get('/api/products?legality=maybe')).status, 400);
  });

  test('ids: exactly that set, in that order, no paging, inactive dropped', async () => {
    setProduct(P.bodyType.id, { is_active: 0 });
    const order = [P.showPlate.id, P.outOfStock.id, P.bodyType.id, P.spoiler.id, 99999];
    const res = await get(`/api/products?ids=${order.join(',')}&limit=1&page=3&category=alloy-wheels`);
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res.body.items), [P.showPlate.id, P.outOfStock.id, P.spoiler.id]);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.pages, 1);
    assert.equal((await get('/api/products?ids=1,abc')).status, 400);
    const tooMany = Array.from({ length: 101 }, (_, i) => i + 1).join(',');
    assert.equal((await get(`/api/products?ids=${tooMany}`)).status, 400);
  });

  test('paging: limit default 24, max 60, pages computed', async () => {
    const res = await get('/api/products?limit=4&page=2');
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.pages, 2);
    assert.equal((await get('/api/products?limit=61')).status, 400);
    assert.equal((await get('/api/products?page=0')).status, 400);
    const beyond = await get('/api/products?page=9');
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body.items, []);
    assert.equal(beyond.body.total, 6);
  });

  test('repeated and blank query keys are tolerated', async () => {
    const res = await get('/api/products?category=&limit=2&limit=3&q=');
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 3);
  });
});

// ---------------------------------------------------------------------------
describe('GET /products sorting', () => {
  const inStockIds = () => [P.spoiler.id, P.universal.id, P.bodyType.id, P.wheel.id, P.showPlate.id];

  test('price_asc and price_desc, out of stock always last', async () => {
    const asc = await get('/api/products?sort=price_asc');
    const prices = asc.body.items.slice(0, 5).map((item) => item.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    assert.equal(asc.body.items.at(-1).id, P.outOfStock.id, 'the cheapest product is out of stock and still last');
    const desc = await get('/api/products?sort=price_desc');
    assert.equal(desc.body.items[0].id, P.wheel.id);
    assert.equal(desc.body.items.at(-1).id, P.outOfStock.id);
  });

  test('popular uses sold_count', async () => {
    setProduct(P.bodyType.id, { sold_count: 50 });
    setProduct(P.showPlate.id, { sold_count: 20 });
    setProduct(P.outOfStock.id, { sold_count: 999 });
    const res = await get('/api/products?sort=popular');
    assert.deepEqual(ids(res.body.items).slice(0, 2), [P.bodyType.id, P.showPlate.id]);
    assert.equal(res.body.items.at(-1).id, P.outOfStock.id);
  });

  test('rating, discount and newest', async () => {
    setProduct(P.wheel.id, { rating_avg: 4.8, rating_count: 3 });
    setProduct(P.universal.id, { rating_avg: 4.1, rating_count: 9 });
    assert.deepEqual(ids((await get('/api/products?sort=rating')).body.items).slice(0, 2), [P.wheel.id, P.universal.id]);

    // universal: 1299 vs 1999 is 35% off, the biggest of the in-stock fixtures.
    assert.equal((await get('/api/products?sort=discount')).body.items[0].id, P.universal.id);
    startDrop([[P.bodyType.id, 60]]); // 2499 -> 1000 against 3299: 69% off
    assert.equal((await get('/api/products?sort=discount')).body.items[0].id, P.bodyType.id);

    setProduct(P.showPlate.id, { created_at: '2026-11-01T00:00:00Z' });
    setProduct(P.outOfStock.id, { created_at: '2026-11-10T00:00:00Z' });
    const newest = await get('/api/products?sort=newest');
    assert.equal(newest.body.items[0].id, P.showPlate.id);
    assert.equal(newest.body.items.at(-1).id, P.outOfStock.id);
    assert.deepEqual(new Set(ids(newest.body.items).slice(0, 5)), new Set(inStockIds()));
    assert.equal((await get('/api/products?sort=cheapest')).status, 400);
  });

  test('fit: direct fits first for the chosen car, then with work, universal, unchecked; no car means the default order', async () => {
    // Swift (2018-2024): the roof spoiler is a direct fit, the hatchback spoiler suits by body type,
    // the 4x100 wheel by bolt pattern, the universal spoiler fits any car.
    const res = await get(`/api/products?sort=fit&vehicleId=${V.swiftOld.id}`);
    assert.equal(res.status, 200);
    const fits = res.body.items.map((item) => item.fit);
    assert.equal(res.body.items[0].id, P.spoiler.id);
    assert.equal(fits[0], 'direct');
    const rank = { direct: 0, with_work: 1, universal: 2, unknown: 3, no: 4 };
    const inStock = res.body.items.filter((item) => item.inStock);
    assert.deepEqual(
      inStock.map((item) => rank[item.fit]),
      [...inStock.map((item) => rank[item.fit])].sort((a, b) => a - b),
      'in-stock parts are ordered by fit',
    );
    assert.equal(res.body.items.at(-1).id, P.outOfStock.id, 'out of stock still last');

    const noCar = await get('/api/products?sort=fit');
    assert.equal(noCar.status, 200);
    assert.deepEqual(ids(noCar.body.items), ids((await get('/api/products')).body.items));
  });

  test('relevance without q falls back to the default order', async () => {
    setProduct(P.wheel.id, { is_featured: 1 });
    const res = await get('/api/products?sort=relevance');
    assert.equal(res.status, 200);
    assert.equal(res.body.items[0].id, P.wheel.id);
    assert.equal(res.body.items.at(-1).id, P.outOfStock.id);
  });
});

// ---------------------------------------------------------------------------
describe('facets', () => {
  test('category counts ignore the category filter; the rest follow the result set', async () => {
    setProduct(P.universal.id, { tags: JSON.stringify(['abs', 'easy fit']) });
    setProduct(P.spoiler.id, { tags: JSON.stringify(['abs']) });
    setProduct(P.wheel.id, { tags: JSON.stringify(['alloy']) });

    const res = await get('/api/products?category=spoilers-wings');
    const { facets } = res.body;
    const count = (slug) => facets.categories.find((entry) => entry.slug === slug)?.count;
    assert.equal(count('exterior-styling'), 4);
    assert.equal(count('spoilers-wings'), 4);
    assert.equal(count('wheels-tyres'), 2, 'the other category is still offered');
    assert.equal(count('alloy-wheels'), 2);
    assert.equal(facets.categories.find((entry) => entry.slug === 'alloy-wheels').parentSlug, 'wheels-tyres');
    assert.equal(facets.categories.find((entry) => entry.slug === 'wheels-tyres').parentSlug, null);

    assert.deepEqual(facets.price, { min: 799, max: 3499 });
    assert.deepEqual(facets.tags, [
      { tag: 'abs', count: 2 },
      { tag: 'easy fit', count: 1 },
    ]);
    assert.deepEqual(facets.legality, [
      { value: 'road_legal', count: 3 },
      { value: 'off_road_only', count: 1 },
    ]);
    assert.equal(facets.inStockCount, 4);
    assert.equal(facets.onSaleCount, 4);
    assert.equal(facets.fitsCount, 0, 'no vehicle named');
  });

  test('inStockCount and price range follow the other filters', async () => {
    const res = await get('/api/products?category=alloy-wheels');
    assert.equal(res.body.facets.inStockCount, 1);
    assert.deepEqual(res.body.facets.price, { min: 899, max: 21999 });
    const priced = await get('/api/products?maxPrice=1000');
    assert.deepEqual(priced.body.facets.price, { min: 799, max: 21999 }, 'the price range ignores the price filter itself');
    assert.equal(priced.body.total, 2);
    const empty = await get('/api/products?category=alloy-wheels&legality=off_road_only');
    assert.equal(empty.body.total, 0);
    assert.deepEqual(empty.body.facets.price, { min: 0, max: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('Pick of Three', () => {
  test('subcategory pages carry the picks with fit verdicts; top-level pages do not', async () => {
    const pick = (tier, productId, reason) =>
      t.ctx.db.run('INSERT INTO category_picks (category_id, tier, product_id, reason) VALUES (?, ?, ?, ?)', [C.spoilers.id, tier, productId, reason]);
    pick('all_out', P.spoiler.id, 'Made for the Swift.');
    pick('sensible', P.universal.id, 'Fits anything.');
    pick('sweet_spot', P.bodyType.id, 'Best value.');

    const res = await get(`/api/products?category=spoilers-wings&vehicleId=${V.swiftOld.id}`);
    assert.deepEqual(
      res.body.picks.map((p) => p.tier),
      ['sensible', 'sweet_spot', 'all_out'],
    );
    assert.equal(res.body.picks[0].reason, 'Fits anything.');
    assert.equal(res.body.picks[2].product.id, P.spoiler.id);
    assert.equal(res.body.picks[2].product.fit, 'direct');
    assert.equal(res.body.picks[1].product.fit, 'universal');

    setProduct(P.bodyType.id, { is_active: 0 });
    const withoutInactive = await get('/api/products?category=spoilers-wings');
    assert.deepEqual(
      withoutInactive.body.picks.map((p) => p.tier),
      ['sensible', 'all_out'],
    );
    assert.equal(withoutInactive.body.picks[0].product.fit, null);

    assert.deepEqual((await get('/api/products?category=exterior-styling')).body.picks, []);
  });
});

// ---------------------------------------------------------------------------
describe('search', () => {
  test('stem, typo distance and expandQuery', () => {
    assert.equal(stem('wheels'), 'wheel');
    assert.equal(stem('accessories'), 'accessory');
    assert.equal(stem('glasses'), 'glass');
    assert.equal(stem('glass'), 'glass');
    assert.equal(stem('4x100'), '4x100');
    assert.ok(withinOneEdit('spoilr', 'spoiler'));
    assert.ok(withinOneEdit('sopiler', 'spoiler'));
    assert.ok(!withinOneEdit('spolr', 'spoiler'));

    assert.deepEqual(expandQuery(t.ctx, 'Dikki Lights'), { terms: ['boot', 'light'], understoodAs: 'boot lights' });
    assert.deepEqual(expandQuery(t.ctx, 'alloy wheels'), { terms: ['alloy', 'wheel'], understoodAs: null });
    assert.deepEqual(expandQuery(t.ctx, 'stepney cover for my car'), {
      terms: ['spare', 'wheel', 'cover', 'car'],
      understoodAs: 'spare wheel cover for my car',
    });
    assert.deepEqual(expandQuery(t.ctx, '   '), { terms: [], understoodAs: null });
  });

  test('multi-word synonyms win over one-word ones', () => {
    const saved = t.ctx.settings.get().searchSynonyms;
    try {
      t.ctx.settings.update({
        searchSynonyms: [
          { says: 'tail', means: 'rear' },
          { says: 'tail light', means: 'tail lamp' },
        ],
      });
      assert.equal(expandQuery(t.ctx, 'tail light').understoodAs, 'tail lamp');
      assert.equal(expandQuery(t.ctx, 'tail spoiler').understoodAs, 'rear spoiler');
      assert.equal(expandQuery(t.ctx, 'tail lights').understoodAs, 'tail lamp', 'plural phrase');
    } finally {
      t.ctx.settings.update({ searchSynonyms: saved });
    }
  });

  test('synonyms reach the results and set understoodAs', async () => {
    const res = await get('/api/products?q=dikki%20spoiler');
    assert.equal(res.status, 200);
    assert.equal(res.body.understoodAs, 'boot spoiler');
    assert.deepEqual(ids(res.body.items), [P.universal.id]);
    const plain = await get('/api/products?q=spoilers');
    assert.equal(plain.body.understoodAs, null);
    assert.ok(plain.body.total >= 3);
  });

  test('matches across name, brand, category, tags, SKU and description', async () => {
    assert.deepEqual(new Set(ids((await get('/api/products?q=forge')).body.items)), new Set([P.wheel.id, P.outOfStock.id]));
    assert.deepEqual(ids((await get('/api/products?q=T-WHL-001')).body.items)[0], P.wheel.id);
    const byCategory = await get('/api/products?q=wings');
    assert.ok(ids(byCategory.body.items).includes(P.showPlate.id), 'show plate lives in Spoilers & Wings');
    setProduct(P.showPlate.id, { tags: JSON.stringify(['vanity']) });
    assert.deepEqual(ids((await get('/api/products?q=vanity')).body.items), [P.showPlate.id]);
    setProduct(P.universal.id, { short_description: 'Sticks on with 3M tape.' });
    assert.deepEqual(ids((await get('/api/products?q=tape')).body.items), [P.universal.id]);
    assert.equal((await get('/api/products?q=hovercraft')).body.total, 0);
  });

  test('relevance: name matches rank above tag matches above description matches', async () => {
    setProduct(P.wheel.id, { short_description: 'Looks right on a hatchback.' });
    setProduct(P.universal.id, { tags: JSON.stringify(['hatchback']) });
    const res = await get('/api/products?q=hatchback');
    assert.deepEqual(ids(res.body.items), [P.bodyType.id, P.universal.id, P.wheel.id]);
  });

  test('every word must match; out of stock still sorts last', async () => {
    assert.deepEqual(ids((await get('/api/products?q=forge%20locking')).body.items), [P.outOfStock.id]);
    assert.equal((await get('/api/products?q=forge%20spoiler')).body.total, 0);
    // Equal relevance and far better sales, but out of stock: still after the wheel.
    setProduct(P.outOfStock.id, { sold_count: 999 });
    assert.deepEqual(ids((await get('/api/products?q=forge')).body.items), [P.wheel.id, P.outOfStock.id]);
  });

  test('tolerates one typo in words of 5 or more letters only', async () => {
    const typo = await get('/api/products?q=spoilr');
    assert.ok(typo.body.total >= 3);
    assert.ok(ids(typo.body.items).includes(P.universal.id));
    const swapped = await get('/api/products?q=alloi');
    assert.ok(ids(swapped.body.items).includes(P.wheel.id));
    // "whels" is five letters as typed, even though its singular is four.
    assert.deepEqual(ids((await get('/api/products?q=forge%20whels')).body.items), [P.wheel.id, P.outOfStock.id]);
    assert.equal((await get('/api/products?q=spolir%20xx')).body.total, 0);
    assert.equal((await get('/api/products?q=nutz')).body.total, 0, 'short words must be right');
  });

  test('a car word is a hint: parts that fit come first, the word is not required', async () => {
    // "creta" is in no product text, yet spoilers are found; the one that suits any car comes first.
    const creta = await get('/api/products?q=creta%20spoiler');
    assert.equal(creta.status, 200);
    const cretaIds = ids(creta.body.items);
    assert.ok(cretaIds.length >= 3);
    assert.equal(cretaIds[0], P.universal.id);
    assert.ok(cretaIds.indexOf(P.bodyType.id) > cretaIds.indexOf(P.universal.id), 'hatchback-only spoiler ranks lower');

    // The Swift spoiler is listed for the Swift: it leads a Swift search.
    const swift = await get('/api/products?q=swift%20spoiler');
    assert.equal(ids(swift.body.items)[0], P.spoiler.id);

    // A car on its own: the parts listed for it or naming it.
    const only = await get('/api/products?q=maruti%20swift');
    assert.deepEqual(ids(only.body.items), [P.spoiler.id]);

    // A row for that car wins over the name: give the hatchback spoiler a verified Creta fit.
    t.ctx.db.run("INSERT INTO product_fitments (product_id, vehicle_id, fit_type, is_verified) VALUES (?, ?, 'direct', 1)", [P.bodyType.id, V.creta.id]);
    try {
      assert.equal(ids((await get('/api/products?q=creta%20spoiler')).body.items)[0], P.bodyType.id);
      assert.deepEqual(ids((await get('/api/products?q=creta')).body.items), [P.bodyType.id]);
    } finally {
      t.ctx.db.run('DELETE FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [P.bodyType.id, V.creta.id]);
    }
  });

  test('q combines with filters, facets and other sorts', async () => {
    const res = await get(`/api/products?q=spoiler&vehicleId=${V.creta.id}&fitOnly=1&sort=price_asc`);
    // The show plate matches through its category, Spoilers & Wings; the hatchback spoiler does not fit a Creta.
    assert.deepEqual(ids(res.body.items), [P.showPlate.id, P.universal.id, P.spoiler.id]);
    assert.equal(res.body.facets.fitsCount, 2);
    assert.equal(res.body.facets.categories.find((entry) => entry.slug === 'spoilers-wings').count, 3);
    const paged = await get('/api/products?q=addon&limit=2&page=2');
    assert.equal(paged.body.total, 6);
    assert.equal(paged.body.items.length, 2);
  });

  test('page-1 searches are logged with the result count; later pages and suggest are not', async () => {
    await get(`/api/products?q=Dikki%20Spoiler&vehicleId=${V.creta.id}`);
    await get('/api/products?q=hovercraft');
    await get('/api/products?q=addon&page=2&limit=2');
    await get('/api/products?category=alloy-wheels');
    await get('/api/search/suggest?q=spoiler');
    const rows = t.ctx.db.all('SELECT query, result_count, vehicle_id FROM search_log ORDER BY id');
    assert.deepEqual(rows, [
      { query: 'dikki spoiler', result_count: 1, vehicle_id: V.creta.id },
      { query: 'hovercraft', result_count: 0, vehicle_id: null },
    ]);
  });

  test('the search index notices catalogue changes', async () => {
    assert.equal((await get('/api/products?q=zanzibar')).body.total, 0);
    setProduct(P.universal.id, { name: 'Addon Zanzibar Lip' });
    assert.deepEqual(ids((await get('/api/products?q=zanzibar')).body.items), [P.universal.id]);
    setProduct(P.universal.id, { is_active: 0 });
    assert.equal((await get('/api/products?q=zanzibar')).body.total, 0);
    setProduct(P.universal.id, { name: 'Addon Aero Universal Boot Lip Spoiler' });
  });
});

// ---------------------------------------------------------------------------
describe('GET /products/:slug', () => {
  test('returns the detail with a fit verdict for the car', async () => {
    const res = await get(`/api/products/${P.spoiler.slug}?vehicleId=${V.swiftOld.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, P.spoiler.id);
    assert.equal(res.body.fit, 'direct');
    assert.equal(res.body.fitVerified, true);
    assert.ok(Array.isArray(res.body.variants));
    assert.equal('costPrice' in res.body, false);
    const wheel = await get(`/api/products/${P.wheel.slug}`);
    assert.equal(wheel.body.variants.length, 2);
    assert.equal(wheel.body.fit, null);
  });

  test('404 for unknown and inactive products, 400 for a bad vehicleId', async () => {
    assert.equal((await get('/api/products/no-such-part')).status, 404);
    setProduct(P.universal.id, { is_active: 0 });
    const inactive = await get(`/api/products/${P.universal.slug}`);
    assert.equal(inactive.status, 404);
    assert.equal(inactive.body.error.code, 'not_found');
    assert.equal((await get(`/api/products/${P.spoiler.slug}?vehicleId=abc`)).status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('GET /search/suggest', () => {
  test('products, categories, vehicles and understoodAs', async () => {
    const res = await get(`/api/search/suggest?q=dikki%20spoiler&vehicleId=${V.creta.id}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['categories', 'products', 'understoodAs', 'vehicles']);
    assert.equal(res.body.understoodAs, 'boot spoiler');
    assert.deepEqual(ids(res.body.products), [P.universal.id]);
    assert.equal(res.body.products[0].fit, 'universal');
    assert.deepEqual(res.body.categories, [
      { slug: 'spoilers-wings', name: 'Spoilers & Wings', parentName: 'Exterior Styling', parentSlug: 'exterior-styling' },
    ]);
  });

  test('vehicles by make or model start, at most 6 products', async () => {
    const res = await get('/api/search/suggest?q=swi');
    assert.deepEqual(new Set(ids(res.body.vehicles)), new Set([V.swiftOld.id, V.swiftNew.id]));
    const maruti = await get('/api/search/suggest?q=maruti');
    assert.equal(maruti.body.vehicles.length, 2);
    for (let i = 0; i < 6; i += 1) {
      t.ctx.db.run(
        "INSERT INTO products (slug, sku, name, category_id, price, mrp, stock) VALUES (?, ?, ?, ?, 500, 600, 3)",
        [`extra-mat-${i}`, `T-MAT-${i}`, `Addon Floor Mat ${i}`, C.spoilers.id],
      );
    }
    try {
      const mats = await get('/api/search/suggest?q=mat');
      assert.equal(mats.body.products.length, 6);
    } finally {
      t.ctx.db.exec("DELETE FROM products WHERE sku LIKE 'T-MAT-%'");
    }
    const vehicles = await get('/api/search/suggest?q=hyundai');
    assert.deepEqual(ids(vehicles.body.vehicles), [V.creta.id]);
  });

  test('a blank query is empty, not an error', async () => {
    const res = await get('/api/search/suggest');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { products: [], categories: [], vehicles: [], understoodAs: null });
    assert.equal((await get('/api/search/suggest?q=x&vehicleId=-1')).status, 400);
  });
});

// ---------------------------------------------------------------------------
describe('drops', () => {
  test('no drop: null, and nothing is in a drop', async () => {
    const res = await get('/api/drops/current');
    assert.equal(res.status, 200);
    assert.equal(res.body, null);
    assert.equal((await get('/api/products?inDrop=1')).body.total, 0);
  });

  test('a live drop changes prices and inDrop / onSale results', async () => {
    setProduct(P.showPlate.id, { mrp: 799 }); // not on sale until the drop
    startDrop([
      [P.showPlate.id, 20, 'Clearing old stock'],
      [P.universal.id, 10, 'Friday price'],
    ]);
    const drop = await get(`/api/drops/current?vehicleId=${V.creta.id}`);
    assert.equal(drop.status, 200);
    assert.equal(drop.body.title, 'Friday Five');
    assert.deepEqual(
      drop.body.items.map((item) => [item.product.id, item.percentOff, item.reason]),
      [
        [P.showPlate.id, 20, 'Clearing old stock'],
        [P.universal.id, 10, 'Friday price'],
      ],
    );
    const plate = drop.body.items[0].product;
    assert.equal(plate.price, 639);
    assert.equal(plate.regularPrice, 799);
    assert.equal(plate.drop.percentOff, 20);
    assert.equal(drop.body.items[1].product.fit, 'universal');

    const inDrop = await get('/api/products?inDrop=1');
    assert.deepEqual(new Set(ids(inDrop.body.items)), new Set([P.showPlate.id, P.universal.id]));
    const onSale = await get('/api/products?onSale=1');
    assert.ok(ids(onSale.body.items).includes(P.showPlate.id), 'a drop puts it on sale');
    assert.equal(onSale.body.facets.onSaleCount, 6);

    const detail = await get(`/api/products/${P.universal.slug}`);
    assert.equal(detail.body.price, 1169);
  });

  test('ended, future and inactive drops are not live', async () => {
    startDrop([[P.universal.id, 10]], { startsAgoMs: 7_200_000, endsInMs: -3_600_000 });
    startDrop([[P.universal.id, 10]], { startsAgoMs: -3_600_000, endsInMs: 7_200_000 });
    const off = startDrop([[P.universal.id, 10]]);
    t.ctx.db.run('UPDATE drops SET is_active = 0 WHERE id = ?', [off]);
    assert.equal((await get('/api/drops/current')).body, null);
    assert.equal((await get('/api/products?inDrop=1')).body.total, 0);
  });
});

// ---------------------------------------------------------------------------
describe('GET /home', () => {
  test('the payload shape and its lists', async () => {
    setProduct(P.universal.id, { is_featured: 1 });
    setProduct(P.bodyType.id, { sold_count: 40 });
    setProduct(P.wheel.id, { is_new: 1, created_at: '2026-11-15T00:00:00Z' });
    startDrop([[P.wheel.id, 15, 'Wheel week']]);

    const insertBuild = (slug, isHouse, status, productIds, createdAt) =>
      t.ctx.db.run(
        'INSERT INTO builds (slug, title, author_name, vehicle_label, state, product_ids, status, is_house, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [slug, `Build ${slug}`, 'Tester', 'Maruti Suzuki Swift', '{}', JSON.stringify(productIds), status, isHouse ? 1 : 0, createdAt],
      );
    insertBuild('customer-new', false, 'approved', [P.universal.id], '2026-11-10T00:00:00Z');
    insertBuild('house-old', true, 'approved', [P.spoiler.id, P.wheel.id, 99999], '2026-10-01T00:00:00Z');
    insertBuild('pending-one', false, 'pending', [P.spoiler.id], '2026-11-12T00:00:00Z');
    insertBuild('private-one', false, 'private', [P.spoiler.id], '2026-11-12T00:00:00Z');

    const res = await get('/api/home');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), [
      'bestSellers',
      'builds',
      'categories',
      'drop',
      'featured',
      'forYourCar',
      'newArrivals',
      'popularVehicles',
    ]);
    assert.equal(res.body.categories.length, 2);
    assert.deepEqual(ids(res.body.featured), [P.universal.id]);
    assert.equal(res.body.newArrivals[0].id, P.wheel.id);
    assert.equal(res.body.bestSellers[0].id, P.bodyType.id);
    assert.equal(res.body.bestSellers.at(-1).id, P.outOfStock.id);
    assert.equal(res.body.drop.items[0].product.id, P.wheel.id);
    assert.equal(res.body.popularVehicles.length, 3);
    assert.deepEqual(res.body.builds.map((b) => b.slug), ['house-old', 'customer-new']);
    assert.deepEqual(ids(res.body.builds[0].products), [P.spoiler.id, P.wheel.id]);
    assert.equal(res.body.builds[0].total, 3499 + res.body.builds[0].products[1].price);
    assert.deepEqual(res.body.forYourCar, []);
  });

  test('forYourCar: best-selling parts that fit, direct fits first', async () => {
    setProduct(P.universal.id, { sold_count: 100 });
    setProduct(P.wheel.id, { sold_count: 50 });
    const res = await get(`/api/home?vehicleId=${V.swiftOld.id}`);
    const forYou = res.body.forYourCar;
    assert.equal(forYou[0].id, P.spoiler.id);
    assert.equal(forYou[0].fit, 'direct');
    assert.equal(forYou[1].id, P.universal.id);
    assert.ok(forYou.every((item) => ['direct', 'with_work', 'universal'].includes(item.fit)));
    assert.equal(forYou.at(-1).id, P.outOfStock.id);
    assert.equal(res.body.featured.every((item) => item.fit !== null), true);

    const creta = await get(`/api/home?vehicleId=${V.creta.id}`);
    const cretaIds = ids(creta.body.forYourCar);
    assert.ok(!cretaIds.includes(P.wheel.id) && !cretaIds.includes(P.bodyType.id) && !cretaIds.includes(P.spoiler.id));
    assert.equal((await get('/api/home?vehicleId=zero')).status, 400);
  });
});
