import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyPassword } from '../src/lib/auth.js';
import { categoryTree, fitVerdictsFor, getProductDetail, getVehicleRow } from '../src/lib/catalog.js';
import { runSeed } from '../src/seed/index.js';
import { PICKS } from '../src/seed/content/extras.js';
import { assignPhotos } from '../src/seed/products.js';
import { loadCatalog } from '../src/seed/shared.js';
import { SPEC_SKUS } from '../src/seed/specs.js';
import { VARIANT_SKUS } from '../src/seed/variants.js';

const PHOTOS_FILE = fileURLToPath(new URL('../src/seed/photos.json', import.meta.url));
const CLIENT_PUBLIC = fileURLToPath(new URL('../../client/public', import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;
const quiet = () => {};

const BUILD_STYLES = {
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
const KIT_GOALS = ['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection'];

const catalog = loadCatalog();
const subcategories = catalog.categories.flatMap((category) => category.subcategories);
const generationCount = catalog.vehicles.makes.flatMap((make) => make.models).reduce((sum, model) => sum + model.generations.length, 0);

// Every row of every table, so two snapshots are equal only if nothing at all changed.
function snapshot(db) {
  const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return Object.fromEntries(tables.map(({ name }) => [name, db.all(`SELECT * FROM ${name} ORDER BY rowid`)]));
}

describe('the seeded store', () => {
  let t;
  let db;
  let result;
  let products;

  before(async () => {
    t = await startTestApp({ fixtures: false });
    db = t.ctx.db;
    result = await runSeed(t.ctx, { log: quiet });
    products = db.all('SELECT * FROM products ORDER BY id');
  });
  after(() => t.close());

  test('reports what it wrote', () => {
    assert.equal(result.skipped, false);
    assert.equal(result.removed, 0);
    assert.deepEqual(
      { categories: result.categories, subcategories: result.subcategories, vehicles: result.vehicles, products: result.products },
      { categories: 9, subcategories: 63, vehicles: generationCount, products: 146 },
    );
    for (const [table, key] of [
      ['product_variants', 'variants'],
      ['product_fitments', 'fitments'],
      ['price_history', 'priceHistory'],
      ['product_relations', 'relations'],
      ['category_picks', 'picks'],
      ['drop_items', 'dropItems'],
      ['reviews', 'reports'],
      ['product_questions', 'questions'],
      ['coupons', 'coupons'],
      ['builds', 'builds'],
    ]) {
      assert.equal(result[key], db.get(`SELECT COUNT(*) AS total FROM ${table}`).total, `${key} matches the ${table} table`);
    }
  });

  test('creates the admin account from the configuration, once', async () => {
    const admins = db.all("SELECT * FROM users WHERE role = 'admin'");
    assert.equal(admins.length, 1);
    assert.equal(result.admin, 1);
    assert.equal(admins[0].email, t.ctx.config.admin.email);
    assert.equal(await verifyPassword(t.ctx.config.admin.password, admins[0].password_hash), true);
  });

  test('has the 9 categories and 63 subcategories of the catalogue, in order', () => {
    const top = db.all('SELECT * FROM categories WHERE parent_id IS NULL ORDER BY sort_order');
    assert.deepEqual(top.map((row) => row.slug), catalog.categories.map((category) => category.slug));
    assert.equal(db.get('SELECT COUNT(*) AS total FROM categories WHERE parent_id IS NOT NULL').total, 63);

    for (const [index, category] of catalog.categories.entries()) {
      const children = db.all('SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order', [top[index].id]);
      assert.deepEqual(children.map((row) => row.slug), category.subcategories.map((sub) => sub.slug));
      for (const [subIndex, sub] of category.subcategories.entries()) {
        assert.equal(children[subIndex].name, sub.name);
        assert.equal(children[subIndex].blurb, sub.blurb);
        assert.equal(children[subIndex].art_kind, sub.artKind);
        assert.equal(children[subIndex].is_active, 1);
      }
    }
  });

  test('has one vehicle per generation, with bolt patterns where the catalogue is sure of them', () => {
    assert.equal(db.get('SELECT COUNT(*) AS total FROM vehicles').total, generationCount);
    assert.equal(generationCount, 132);

    const popularGenerations = catalog.vehicles.makes
      .flatMap((make) => make.models)
      .filter((model) => model.popular)
      .reduce((sum, model) => sum + model.generations.length, 0);
    assert.equal(db.get('SELECT COUNT(*) AS total FROM vehicles WHERE is_popular = 1').total, popularGenerations);

    const pcdOf = (makeSlug, modelSlug, yearFrom) =>
      db.get('SELECT pcd FROM vehicles WHERE make_slug = ? AND model_slug = ? AND year_from = ?', [makeSlug, modelSlug, yearFrom]).pcd;
    assert.equal(pcdOf('maruti-suzuki', 'swift', 2018), '4x100');
    assert.equal(pcdOf('maruti-suzuki', 'swift', 2024), '4x100');
    assert.equal(pcdOf('hyundai', 'creta', 2020), '5x114.3');
    assert.equal(pcdOf('kia', 'carens', 2022), '5x114.3');
    assert.equal(pcdOf('toyota', 'fortuner', 2016), '6x139.7');
    assert.equal(pcdOf('bmw', '3-series', 2019), '5x112', 'the G20 is listed by generation');
    assert.equal(pcdOf('bmw', '3-series', 2012), '', 'the F30 is not');
    assert.equal(pcdOf('mahindra', 'thar', 2020), '');

    const brezza = db.get("SELECT * FROM vehicles WHERE model_slug = 'brezza' AND year_from = 2016");
    assert.equal(brezza.generation, '1st gen, sold as Vitara Brezza');
    assert.equal(brezza.body_type, 'suv');
    assert.equal(brezza.year_to, 2022);

    // Inside a model the newest generation sorts first.
    const swift = db.all("SELECT year_from FROM vehicles WHERE model_slug = 'swift' ORDER BY sort_order");
    assert.deepEqual(swift.map((row) => row.year_from), [2024, 2018, 2011]);
  });

  test('has all 146 products, active, sample-marked and in a leaf category', () => {
    assert.equal(products.length, 146);
    assert.deepEqual(products.map((row) => row.sku), catalog.seedProducts.map((product) => product.sku));
    assert.equal(new Set(products.map((row) => row.slug)).size, 146);

    const leaves = new Map(
      db
        .all('SELECT c.id, c.slug FROM categories c WHERE c.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM categories k WHERE k.parent_id = c.id)')
        .map((row) => [row.id, row.slug]),
    );
    for (const [index, row] of products.entries()) {
      const source = catalog.seedProducts[index];
      assert.equal(row.is_active, 1, `${row.sku} is active`);
      assert.equal(row.is_demo, 1, `${row.sku} is marked as sample data`);
      assert.equal(leaves.get(row.category_id), source.subcategory, `${row.sku} is in its subcategory`);
      assert.equal(row.name, source.title);
      assert.match(row.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(row.slug.length <= 80, `${row.sku} slug fits in 80 characters`);
      assert.equal(row.manufacturer, '');
      assert.equal(row.country_of_origin, 'India');
      assert.equal(row.ship_class, source.shipClass);
      assert.equal(row.gst_rate, source.gstRatePct);
      assert.match(row.hsn_code, /^\d{4,8}$/);
      assert.ok(row.mrp >= row.price && row.price > 0, `${row.sku} is priced at or under its MRP`);
      assert.ok(row.cost_price >= row.price * 0.545 && row.cost_price <= row.price * 0.685, `${row.sku} cost is 55 to 68 percent of its price`);
      assert.ok(row.weight_grams > 0);
      assert.match(row.supplier, /^Sample supplier [A-E] \(/);
      assert.notEqual(row.net_quantity, '');
    }
    assert.equal(new Set(products.map((row) => row.supplier)).size, 5);
    assert.equal(t.ctx.settings.public().hasDemoData, true);
  });

  test('keeps the catalogue price as the price of every product, also as the lowest variant price', () => {
    for (const [index, row] of products.entries()) {
      assert.equal(row.price, catalog.seedProducts[index].sell, `${row.sku} price`);
      assert.equal(row.mrp, catalog.seedProducts[index].mrp, `${row.sku} MRP`);
    }
  });

  test('stores valid JSON in every JSON column', () => {
    const lists = ['images', 'highlights', 'specs', 'box_contents', 'tags', 'body_types', 'fitting_tools', 'fitting_steps', 'goals'];
    for (const row of products) {
      for (const column of lists) assert.ok(Array.isArray(JSON.parse(row[column])), `${row.sku}.${column} is a JSON list`);

      const specs = JSON.parse(row.specs);
      assert.ok(specs.length >= 3, `${row.sku} has a spec table`);
      for (const spec of specs) {
        assert.deepEqual(Object.keys(spec), ['label', 'value']);
        assert.ok(spec.label.trim() !== '' && spec.value.trim() !== '', `${row.sku} spec "${spec.label}" has a value`);
      }
      assert.equal(new Set(specs.map((spec) => spec.label)).size, specs.length, `${row.sku} spec labels do not repeat`);

      const steps = JSON.parse(row.fitting_steps);
      assert.ok(steps.length >= 1);
      for (const step of steps) assert.ok(step.en && step.hi, `${row.sku} fitting steps are in English and Hindi`);
      assert.ok(JSON.parse(row.highlights).length >= 4);
      assert.ok(JSON.parse(row.box_contents).length >= 1);
      assert.ok(JSON.parse(row.tags).length >= 3);
      for (const image of JSON.parse(row.images)) assert.match(image, /^\/catalog\/.+\.webp$/);
    }
    for (const variant of db.all('SELECT sku, attributes FROM product_variants')) {
      const attributes = JSON.parse(variant.attributes);
      assert.equal(Object.keys(attributes).length, 1, `${variant.sku} varies one thing`);
    }
    for (const build of db.all('SELECT title, state, product_ids FROM builds')) {
      assert.equal(typeof JSON.parse(build.state).parts, 'object');
      assert.ok(Array.isArray(JSON.parse(build.product_ids)));
    }
    for (const review of db.all('SELECT photos FROM reviews')) assert.deepEqual(JSON.parse(review.photos), []);
  });

  test('uses only values the schema and the client know', () => {
    const allowed = {
      fitment_type: ['vehicle', 'body_type', 'pcd', 'universal', 'none'],
      legality: ['road_legal', 'check_rules', 'off_road_only'],
      warranty_impact: ['none', 'possible', 'likely'],
      wiring: ['none', 'plug_and_play', 'splice'],
      ship_class: ['small', 'medium', 'bulky', 'freight'],
    };
    const bodyTypes = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'];
    for (const row of products) {
      for (const [column, values] of Object.entries(allowed)) assert.ok(values.includes(row[column]), `${row.sku}.${column} = ${row[column]}`);
      assert.ok(row.install_difficulty >= 1 && row.install_difficulty <= 5);
      assert.ok(row.install_time_min >= 0 && row.install_time_max >= row.install_time_min);
      assert.ok(row.fitting_cost_min >= 0 && row.fitting_cost_max >= row.fitting_cost_min);
      for (const flag of ['reversible', 'pro_install', 'returnable', 'cod_eligible', 'is_featured', 'is_new']) assert.ok([0, 1].includes(row[flag]), `${row.sku}.${flag}`);
      for (const goal of JSON.parse(row.goals)) assert.ok(KIT_GOALS.includes(goal), `${row.sku} goal ${goal}`);
      for (const bodyType of JSON.parse(row.body_types)) assert.ok(bodyTypes.includes(bodyType));
      assert.equal(row.fitment_type === 'body_type', JSON.parse(row.body_types).length > 0, `${row.sku} body types go with fitment_type body_type`);
      assert.equal(row.fitment_type === 'pcd', row.pcd !== '', `${row.sku} pcd goes with fitment_type pcd`);
      assert.equal(row.build_slot === null, row.build_style === null);
      if (row.build_slot) {
        assert.ok(BUILD_STYLES[row.build_slot]?.includes(row.build_style), `${row.sku} ${row.build_slot}/${row.build_style} is a Build Bay style`);
        assert.match(row.finish_color, /^#[0-9a-f]{6}$/i);
      }
      if (row.legality !== 'road_legal') assert.notEqual(row.legality_note, '', `${row.sku} says why it is not plainly road legal`);
      assert.match(row.skip_if, /^Skip this if /);
    }
    for (const vehicle of db.all('SELECT body_type FROM vehicles')) assert.ok(bodyTypes.includes(vehicle.body_type));
    for (const row of db.all('SELECT fit_type FROM product_fitments')) assert.ok(['direct', 'with_work', 'no'].includes(row.fit_type));
    for (const row of db.all('SELECT kind FROM product_relations')) assert.ok(['requires', 'pairs_with'].includes(row.kind));
    for (const row of db.all('SELECT tier FROM category_picks')) assert.ok(['sensible', 'sweet_spot', 'all_out'].includes(row.tier));
    for (const row of db.all('SELECT status, fitted_by, rating, is_demo FROM reviews')) {
      assert.equal(row.status, 'approved');
      assert.equal(row.is_demo, 1);
      assert.ok(['self', 'local_garage', 'dealer', 'not_fitted'].includes(row.fitted_by));
      assert.ok(row.rating >= 1 && row.rating <= 5);
    }
    for (const row of db.all('SELECT type, is_demo FROM coupons')) {
      assert.ok(['percent', 'flat', 'free_shipping'].includes(row.type));
      assert.equal(row.is_demo, 1);
    }
  });

  test('marks the show plate as a display piece, not a universal fit', () => {
    const plate = products.find((row) => row.custom_kind === 'show-plate');
    assert.equal(plate.sku, 'ADN-EXT-020');
    assert.equal(plate.fitment_type, 'none');
    assert.equal(plate.legality, 'off_road_only');
    assert.equal(plate.cod_eligible, 0);
    assert.equal(products.filter((row) => row.custom_kind !== null).length, 1);

    // The designer shapes its preview from the 'NNN x NNN mm' size in each variant name.
    const sizes = db.all('SELECT name, price FROM product_variants WHERE product_id = ? ORDER BY sort_order', [plate.id]);
    assert.deepEqual(
      sizes.map((variant) => variant.name),
      ['520 x 111 mm acrylic', '340 x 200 mm acrylic', '520 x 111 mm brushed aluminium'],
    );
    assert.equal(sizes[0].price, plate.price);
  });

  test('sells the lines the shop added: sun control films and wheel covers', () => {
    const inSub = (slug) =>
      db.all('SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id WHERE c.slug = ? ORDER BY p.price', [slug]);
    const parentOf = (slug) => db.get('SELECT parent.slug FROM categories c JOIN categories parent ON parent.id = c.parent_id WHERE c.slug = ?', [slug]).slug;
    assert.equal(parentOf('sun-control-films'), 'exterior-styling');
    assert.equal(parentOf('wheel-covers'), 'wheels-tyres');

    const films = inSub('sun-control-films');
    assert.deepEqual(films.map((row) => row.sku), ['ADN-EXT-023', 'ADN-EXT-024', 'ADN-EXT-025']);
    for (const row of films) {
      // Legal only inside the light limits, and the label says so in plain words.
      assert.equal(row.legality, 'check_rules', `${row.sku} is not sold as plainly road legal`);
      assert.match(row.legality_note, /70 percent/);
      assert.match(row.legality_note, /50 percent/);
      assert.match(row.legality_note, /Supreme Court/);
      assert.equal(row.fitment_type, 'body_type');
      assert.equal(row.pro_install, 1);
      assert.ok(row.fitting_cost_max > 0);
      assert.deepEqual(JSON.parse(row.images), [], 'no photo rather than a wrong one');
      assert.match(row.description, /application at our studio/);
      const specs = Object.fromEntries(JSON.parse(row.specs).map((spec) => [spec.label, spec.value]));
      assert.match(specs['Light through windscreen and rear window'], /^70 percent or more/);
      assert.match(specs['Light through side windows'], /^50 percent or more/);
      assert.doesNotMatch(`${row.name} ${row.description}`, /\b(black|dark|privacy|mirror) (film|tint)/i, `${row.sku} is not a dark film`);
    }

    const covers = inSub('wheel-covers');
    assert.deepEqual(covers.map((row) => row.sku), ['ADN-WHL-013', 'ADN-WHL-014', 'ADN-WHL-015']);
    assert.deepEqual(
      covers.map((row) => JSON.parse(row.specs).find((spec) => spec.label === 'Wheel size').value),
      ['13 inch', '14 inch', '15 inch'],
    );
    for (const row of covers) {
      assert.equal(row.legality, 'road_legal');
      assert.equal(row.fitment_type, 'universal');
      assert.match(JSON.parse(row.specs).find((spec) => spec.label === 'Fits').value, /^Steel wheels only/);
      assert.ok(JSON.parse(row.tags).includes('wheel cups'), 'found by the name the shop uses');
    }
  });

  test('seeds the owner\'s own coupon codes as samples', () => {
    const coupons = db.all('SELECT code, type, value, min_order, max_discount, is_active, is_demo FROM coupons ORDER BY code');
    assert.deepEqual(
      coupons.map((row) => [row.code, row.type, row.value, row.min_order, row.max_discount, row.is_active, row.is_demo]),
      [
        ['ADDON10', 'percent', 10, 2999, 2000, 1, 1],
        ['FIRSTRIDE', 'flat', 500, 3999, null, 1, 1],
        ['SOUND1500', 'flat', 1500, 9999, null, 1, 1],
        ['WHEELS30', 'percent', 5, 15000, 3000, 1, 1],
      ],
    );
  });

  test('writes copy in the house voice: three paragraphs, one-sentence summary, no hype', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const row of products) {
      const paragraphs = row.description.split('\n\n');
      assert.equal(paragraphs.length, 3, `${row.sku} description has three paragraphs`);
      for (const paragraph of paragraphs) assert.ok(paragraph.trim().length > 15 && paragraph.endsWith('.'), `${row.sku} paragraph reads as a sentence`);

      assert.ok(row.short_description.endsWith('.'), `${row.sku} summary ends with a full stop`);
      assert.doesNotMatch(row.short_description, /[.?!]\s/, `${row.sku} summary is one sentence`);

      const written = [row.short_description, row.description, ...JSON.parse(row.specs).flatMap((spec) => [spec.label, spec.value])];
      for (const text of written) {
        assert.ok(!text.includes('!'), `${row.sku}: no exclamation marks`);
        assert.doesNotMatch(text, emoji, `${row.sku}: no emoji`);
        assert.doesNotMatch(text, /undefined|null|NaN|\[object/, `${row.sku}: nothing unfilled in "${text.slice(0, 40)}"`);
        assert.doesNotMatch(text, /\bRs\.?\s?\d/, `${row.sku}: rupees are written with the ₹ sign`);
      }
    }
  });

  test('builds spec tables that agree with the title', () => {
    const specsOf = (sku) => Object.fromEntries(JSON.parse(products.find((row) => row.sku === sku).specs).map((spec) => [spec.label, spec.value]));

    const wheel = specsOf('ADN-WHL-001');
    assert.equal(wheel.Diameter, '15 inch');
    assert.equal(wheel['Bolt pattern (PCD)'], '4x100');
    assert.equal(wheel.Finish, 'Gloss black machined');
    assert.equal(wheel.Quantity, 'Set of 4');

    assert.equal(specsOf('ADN-EXT-002').Finish, 'Carbon-look');
    assert.equal(specsOf('ADN-EXT-002').Pieces, '3');
    assert.equal(specsOf('ADN-LGT-008').Socket, 'H11');
    assert.equal(specsOf('ADN-AUD-002').Memory, '8 GB RAM, 128 GB storage');
    assert.equal(specsOf('ADN-TRL-009').Power, '240 W');
    assert.equal(specsOf('ADN-PRF-006')['Inlet diameter'], '51 mm');

    // Rows that describe the other kind of product in a mixed subcategory are left out.
    assert.equal(specsOf('ADN-INT-002').Airbag, undefined, 'a steering cover has no airbag row');
    assert.equal(specsOf('ADN-WHL-006')['Spacer thickness'], undefined, 'lug nuts have no spacer rows');

    // The warranty row never contradicts the product's own warranty.
    assert.equal(specsOf('ADN-INT-002').Warranty, '6 months');
    assert.equal(specsOf('ADN-INT-001').Warranty, '1 year on stitching and trim');
    assert.equal(specsOf('ADN-CAR-008').Warranty, undefined, 'a perfume has no warranty row');
    for (const row of products) {
      const warranty = JSON.parse(row.specs).find((spec) => spec.label === 'Warranty');
      if (row.warranty_months === 0) assert.equal(warranty, undefined, `${row.sku} has no warranty to state`);
    }

    // A product sold in variants lists the choices in its spec table.
    assert.equal(specsOf('ADN-EXT-004').Finish, 'Gloss Black, Carbon-Look or Paint-Matched (adds 7 days)');
    assert.equal(specsOf('ADN-MER-001').Size, 'S, M, L or XL');

    const skus = new Set(products.map((row) => row.sku));
    for (const sku of [...SPEC_SKUS, ...VARIANT_SKUS]) assert.ok(skus.has(sku), `${sku} in the seed tables is a catalogue product`);
  });

  test('takes fitting effort from the catalogue, corrected for the easy half of mixed subcategories', () => {
    const bySku = new Map(products.map((row) => [row.sku, row]));
    const wheels = bySku.get('ADN-WHL-001');
    const info = catalog.installInfo['alloy-wheels'];
    assert.deepEqual(
      [wheels.install_difficulty, wheels.pro_install, wheels.install_time_min, wheels.install_time_max],
      [info.difficulty, 1, info.timeMinutes[0], info.timeMinutes[1]],
    );

    const cover = bySku.get('ADN-INT-004');
    assert.deepEqual([cover.install_difficulty, cover.pro_install, cover.install_time_max], [1, 0, 10], 'a slip-on steering cover is not a fitter job');

    // No product advises a fitter while saying fitting costs nothing.
    for (const row of products) {
      assert.ok(!(row.pro_install === 1 && row.fitting_cost_max === 0), `${row.sku} advises a fitter and gives a fair labour charge`);
    }
  });

  test('gives a third of the products variants and keeps price and stock in sync', () => {
    const groups = new Map();
    for (const variant of db.all('SELECT * FROM product_variants ORDER BY product_id, sort_order')) {
      groups.set(variant.product_id, [...(groups.get(variant.product_id) ?? []), variant]);
    }
    assert.ok(groups.size >= 35 && groups.size <= 55, `${groups.size} products have variants`);
    assert.equal(groups.size, VARIANT_SKUS.length);

    const variantSkus = new Set();
    for (const [productId, variants] of groups) {
      const product = products.find((row) => row.id === productId);
      assert.ok(variants.length >= 2 && variants.length <= 4, `${product.sku} has 2 to 4 variants`);

      const cheapest = variants.reduce((low, variant) => (variant.price < low.price ? variant : low));
      assert.equal(product.price, cheapest.price, `${product.sku} price is its lowest variant price`);
      assert.equal(product.mrp, cheapest.mrp, `${product.sku} MRP is that variant's MRP`);
      assert.equal(product.stock, variants.reduce((sum, variant) => sum + variant.stock, 0), `${product.sku} stock is the sum of its variants`);

      for (const variant of variants) {
        assert.ok(variant.sku.startsWith(`${product.sku}-`), `${variant.sku} carries the product SKU`);
        assert.ok(!variantSkus.has(variant.sku));
        variantSkus.add(variant.sku);
        assert.ok(variant.mrp >= variant.price && variant.price >= product.price);
        assert.equal(variant.is_active, 1);
        assert.equal(JSON.parse(variant.attributes)[Object.keys(JSON.parse(variant.attributes))[0]], variant.name);
      }
      assert.equal(new Set(variants.map((variant) => variant.name)).size, variants.length);
    }
  });

  test('varies stock: most parts well stocked, a few nearly gone, a few sold out', () => {
    const soldOut = products.filter((row) => row.stock === 0);
    const lastFew = products.filter((row) => row.stock >= 1 && row.stock <= 4);
    const stocked = products.filter((row) => row.stock >= 8);
    assert.equal(soldOut.length, 6);
    assert.equal(lastFew.length, 8);
    assert.equal(stocked.length, 132);
    assert.ok(Math.max(...products.map((row) => row.stock)) <= 60);
    assert.ok(new Set(stocked.map((row) => row.stock)).size >= 20, 'stock levels are varied');

    // The parts the home page and the drop lean on can be bought.
    const liveDrop = db.all('SELECT p.sku, p.stock FROM drop_items di JOIN products p ON p.id = di.product_id');
    for (const item of liveDrop) assert.ok(item.stock >= 8, `${item.sku} in the drop is in stock`);
    for (const row of products.filter((product) => product.is_featured === 1)) assert.ok(row.stock >= 8, `${row.sku} is featured and in stock`);
    assert.ok(db.get('SELECT COUNT(*) AS total FROM product_variants WHERE stock = 0').total >= 1, 'some variant is sold out');
  });

  test('points every fitment row at a real product and a real vehicle', () => {
    const orphans = db.get(
      `SELECT COUNT(*) AS total FROM product_fitments pf
       LEFT JOIN products p ON p.id = pf.product_id
       LEFT JOIN vehicles v ON v.id = pf.vehicle_id
       WHERE p.id IS NULL OR v.id IS NULL`,
    );
    assert.equal(orphans.total, 0);

    // Every product made for named cars lists exactly the generations its title covers.
    for (const [index, row] of products.entries()) {
      const source = catalog.seedProducts[index];
      const direct = db.all(
        `SELECT v.make_slug, v.model_slug, v.year_from, v.year_to FROM product_fitments pf JOIN vehicles v ON v.id = pf.vehicle_id
         WHERE pf.product_id = ? AND pf.fit_type = 'direct' ORDER BY v.id`,
        [row.id],
      );
      if (source.fitment.type !== 'vehicle') continue;
      assert.equal(row.fitment_type, 'vehicle');
      for (const car of source.fitment.vehicles) {
        const match = direct.find((fit) => fit.make_slug === car.make && fit.model_slug === car.model && fit.year_from === car.yearFrom);
        assert.ok(match, `${row.sku} fits the ${car.make} ${car.model} from ${car.yearFrom}`);
        assert.equal(match.year_to, car.yearTo);
      }
    }

    const directRows = db.all("SELECT is_verified FROM product_fitments WHERE fit_type = 'direct'");
    const verifiedShare = directRows.filter((row) => row.is_verified === 1).length / directRows.length;
    assert.ok(verifiedShare > 0.35 && verifiedShare < 0.65, `about half of the direct fits are verified (${Math.round(verifiedShare * 100)}%)`);

    for (const fitType of ['with_work', 'no']) {
      const rows = db.all('SELECT note FROM product_fitments WHERE fit_type = ?', [fitType]);
      assert.ok(rows.length >= 3, `there are ${fitType} rows`);
      for (const row of rows) assert.ok(row.note.length > 20, `a ${fitType} row says why`);
    }
  });

  test('shows every fit verdict somewhere in the catalogue', () => {
    const productRow = (sku) => db.get('SELECT * FROM v_products WHERE sku = ?', [sku]);
    const vehicleRow = (makeSlug, modelSlug, yearFrom) =>
      getVehicleRow(t.ctx, db.get('SELECT id FROM vehicles WHERE make_slug = ? AND model_slug = ? AND year_from = ?', [makeSlug, modelSlug, yearFrom]).id);
    const verdict = (sku, car) => {
      const row = productRow(sku);
      return fitVerdictsFor(t.ctx, [row], vehicleRow(...car)).get(row.id);
    };

    assert.equal(verdict('ADN-EXT-013', ['maruti-suzuki', 'swift', 2018]).fit, 'direct');
    assert.equal(verdict('ADN-LGT-010', ['maruti-suzuki', 'dzire', 2017]).fit, 'with_work');
    assert.equal(verdict('ADN-EXT-013', ['maruti-suzuki', 'swift', 2024]).fit, 'no');
    assert.match(verdict('ADN-EXT-013', ['maruti-suzuki', 'swift', 2024]).fitNote, /2024 Swift/);
    assert.equal(verdict('ADN-EXT-013', ['maruti-suzuki', 'swift', 2011]).fit, 'no', 'another generation of the same model is ruled out');
    assert.equal(verdict('ADN-EXT-013', ['hyundai', 'creta', 2020]).fit, 'unknown');
    assert.equal(verdict('ADN-WHL-001', ['maruti-suzuki', 'swift', 2018]).fit, 'universal', 'a 4x100 wheel on a 4x100 car');
    assert.equal(verdict('ADN-WHL-001', ['hyundai', 'creta', 2020]).fit, 'no');
    assert.equal(verdict('ADN-WHL-001', ['mahindra', 'thar', 2020]).fit, 'unknown', 'no bolt pattern on file for the Thar');
    assert.equal(verdict('ADN-EXT-010', ['honda', 'city', 2020]).fit, 'universal', 'a kit for hatchbacks and sedans on a sedan');
    assert.equal(verdict('ADN-EXT-010', ['hyundai', 'creta', 2020]).fit, 'no');
    assert.equal(verdict('ADN-CAR-001', ['hyundai', 'creta', 2020]).fit, 'universal');

    const verified = db.get("SELECT product_id, vehicle_id FROM product_fitments WHERE fit_type = 'direct' AND is_verified = 1 LIMIT 1");
    const row = db.get('SELECT * FROM v_products WHERE id = ?', [verified.product_id]);
    assert.equal(fitVerdictsFor(t.ctx, [row], getVehicleRow(t.ctx, verified.vehicle_id)).get(row.id).fitVerified, true);
  });

  test('gives every product a price history that ends at today\'s price', () => {
    const now = Date.parse(t.ctx.now());
    let steady = 0;
    let cameDown = 0;
    let wentUp = 0;
    for (const row of products) {
      const history = db.all('SELECT price, mrp, recorded_at FROM price_history WHERE product_id = ? ORDER BY recorded_at, id', [row.id]);
      assert.ok(history.length >= 3 && history.length <= 5, `${row.sku} has 3 to 5 price rows`);
      assert.equal(history.at(-1).price, row.price, `${row.sku} history ends at the current price`);
      assert.equal(history[0].recorded_at, row.created_at, `${row.sku} was first priced when it was listed`);
      for (const entry of history) {
        const age = now - Date.parse(entry.recorded_at);
        assert.ok(age > 0 && age <= 90 * DAY_MS, `${row.sku} price row is from the last 90 days`);
        assert.ok(entry.price > 0 && entry.price <= entry.mrp, `${row.sku} was never priced above its MRP`);
      }
      const first = history[0].price;
      if (history.every((entry) => entry.price === row.price)) steady += 1;
      else if (first > row.price) cameDown += 1;
      else wentUp += 1;
    }
    assert.ok(steady >= 105, `most products have stayed at their usual price (${steady})`);
    assert.ok(cameDown >= 3 && wentUp >= 3, `a few came down (${cameDown}) and a few went up (${wentUp})`);

    const dropProducts = db.all('SELECT product_id FROM drop_items');
    for (const { product_id: productId } of dropProducts) {
      const prices = db.all('SELECT DISTINCT price FROM price_history WHERE product_id = ?', [productId]);
      assert.equal(prices.length, 1, 'a part in the drop was at its usual price before it');
    }
  });

  test('returns 146 rows from v_products, exactly 5 of them in the live drop', () => {
    const rows = db.all('SELECT sku, price, sale_price, drop_percent, drop_reason, drop_ends_at FROM v_products');
    assert.equal(rows.length, 146);
    const dropped = rows.filter((row) => row.drop_percent > 0);
    assert.equal(dropped.length, 5);
    for (const row of dropped) {
      assert.ok(row.sale_price < row.price, `${row.sku} is cheaper while the drop runs`);
      assert.notEqual(row.drop_reason, '');
      assert.ok(Date.parse(row.drop_ends_at) > Date.now());
    }
    for (const row of rows.filter((entry) => entry.drop_percent === 0)) assert.equal(row.sale_price, row.price);

    const drops = db.all('SELECT * FROM drops');
    assert.equal(drops.length, 1);
    assert.equal(drops[0].is_active, 1);
    assert.equal(drops[0].is_demo, 1);
    const now = Date.parse(t.ctx.now());
    assert.ok(Math.abs(now - Date.parse(drops[0].starts_at) - DAY_MS) < 60_000, 'the drop started a day ago');
    assert.ok(Math.abs(Date.parse(drops[0].ends_at) - now - 3 * DAY_MS) < 60_000, 'and ends in three days');
  });

  test('has a Pick of Three for every subcategory with three or more products', () => {
    for (const sub of subcategories) {
      const category = db.get('SELECT id FROM categories WHERE slug = ?', [sub.slug]);
      const count = db.get('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [category.id]).total;
      const picks = db.all('SELECT cp.tier, cp.reason, p.category_id, p.sku FROM category_picks cp JOIN products p ON p.id = cp.product_id WHERE cp.category_id = ?', [
        category.id,
      ]);
      assert.equal(count, catalog.seedPlan[sub.slug], `${sub.slug} has the planned number of products`);
      if (count < 3) {
        assert.equal(picks.length, 0);
        continue;
      }
      assert.deepEqual(picks.map((pick) => pick.tier).sort(), ['all_out', 'sensible', 'sweet_spot'], `${sub.slug} has all three picks`);
      assert.equal(new Set(picks.map((pick) => pick.sku)).size, 3);
      for (const pick of picks) {
        assert.equal(pick.category_id, category.id, `${pick.sku} is picked in its own subcategory`);
        assert.equal(pick.reason, PICKS[sub.slug][pick.tier].reason);
      }
    }
  });

  test('relates products that exist, never a product to itself', () => {
    const relations = db.all(
      `SELECT pr.product_id, pr.related_id, pr.note, a.id AS a_id, b.id AS b_id
       FROM product_relations pr LEFT JOIN products a ON a.id = pr.product_id LEFT JOIN products b ON b.id = pr.related_id`,
    );
    assert.ok(relations.length >= 35);
    for (const relation of relations) {
      assert.ok(relation.a_id && relation.b_id);
      assert.notEqual(relation.product_id, relation.related_id);
      assert.notEqual(relation.note, '');
    }
  });

  test('stores sample fitted reports and the ratings worked out from them', () => {
    const reports = db.all('SELECT * FROM reviews');
    assert.ok(reports.length >= 40);
    const now = Date.parse(t.ctx.now());
    for (const report of reports) {
      const age = now - Date.parse(report.created_at);
      assert.ok(age > 0 && age <= 60 * DAY_MS, 'reports were filed over the last 60 days');
      assert.equal(report.is_verified_purchase, 0, 'no order stands behind a sample report');
      assert.equal(report.order_number, '');
    }
    assert.ok(new Set(reports.map((report) => report.created_at.slice(0, 10))).size >= 20, 'on many different days');

    for (const row of products) {
      const own = reports.filter((report) => report.product_id === row.id);
      assert.equal(row.rating_count, own.length, `${row.sku} rating count`);
      const average = own.length === 0 ? 0 : own.reduce((sum, report) => sum + report.rating, 0) / own.length;
      assert.ok(Math.abs(row.rating_avg - average) < 0.006, `${row.sku} rating average`);
    }
    assert.ok(products.filter((row) => row.rating_count > 0).length >= 20);
  });

  test('stores sample questions, and fitment answers also answer that car from then on', () => {
    const questions = db.all('SELECT * FROM product_questions');
    assert.ok(questions.length >= 20);
    for (const question of questions) {
      assert.equal(question.status, 'published');
      assert.equal(question.is_demo, 1);
      assert.equal(question.phone, '', 'no phone number is invented');
      assert.ok(question.answer && question.answered_at);
      assert.ok(Date.parse(question.answered_at) > Date.parse(question.created_at), 'answered after it was asked');
      assert.ok(Date.parse(question.answered_at) < Date.parse(t.ctx.now()));

      if (question.kind === 'general') {
        assert.equal(question.vehicle_id, null);
        assert.equal(question.answer_fit_type, null);
        continue;
      }
      const vehicle = db.get('SELECT * FROM vehicles WHERE id = ?', [question.vehicle_id]);
      assert.ok(vehicle, 'a fitment question names a real vehicle');
      assert.ok(question.vehicle_label.startsWith(`${vehicle.make} ${vehicle.model} (`));
      const fitment = db.get('SELECT * FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [question.product_id, question.vehicle_id]);
      assert.equal(fitment.fit_type, question.answer_fit_type);
      assert.doesNotMatch(fitment.note, /^(Yes|No)\./);
      assert.equal(fitment.is_verified, question.answer_fit_type === 'direct' ? 1 : 0);
    }
    const answered = new Set(questions.filter((question) => question.kind === 'fitment').map((question) => question.answer_fit_type));
    assert.deepEqual([...answered].sort(), ['direct', 'no', 'with_work']);
  });

  test('stores house builds that point at real, matching products', () => {
    const builds = db.all('SELECT * FROM builds ORDER BY id');
    assert.equal(builds.length, 5);
    assert.equal(new Set(builds.map((build) => build.slug)).size, 5);
    const byId = new Map(products.map((row) => [row.id, row]));

    for (const build of builds) {
      assert.equal(build.status, 'approved');
      assert.equal(build.is_house, 1);
      assert.equal(build.is_demo, 1);
      assert.equal(build.author_name, t.ctx.settings.get().storeName, 'house builds carry the store name');
      assert.notEqual(build.vehicle_label, '');

      const state = JSON.parse(build.state);
      const productIds = JSON.parse(build.product_ids);
      assert.ok(productIds.length >= 3);
      for (const id of productIds) assert.equal(byId.get(id)?.is_active, 1, `"${build.title}" lists a real, active product`);

      const partIds = [];
      for (const [slot, part] of Object.entries(state.parts)) {
        assert.equal(part.sku, undefined, 'the SKU was replaced by the product id');
        const product = byId.get(part.productId);
        assert.ok(product, `"${build.title}" ${slot} points at a real product`);
        assert.equal(product.build_slot, slot);
        assert.equal(product.build_style, part.style);
        partIds.push(part.productId);
      }
      assert.deepEqual([...partIds].sort(), [...productIds].sort(), 'product_ids lists exactly the parts on the car');
    }
  });

  test('getProductDetail works for products across the catalogue', () => {
    const sampled = products.filter((_, index) => index % 14 === 3);
    assert.equal(sampled.length, 11);
    for (const row of sampled) {
      const detail = getProductDetail(t.ctx, row.slug);
      assert.ok(detail, `${row.slug} loads`);
      assert.equal(detail.id, row.id);
      assert.equal(detail.sku, row.sku);
      assert.equal(detail.isDemo, true);
      assert.equal(detail.regularPrice, row.price);
      assert.ok(detail.price <= detail.regularPrice);
      assert.equal(detail.fit, null, 'no vehicle was named');
      assert.ok(detail.specs.length >= 3);
      assert.ok(detail.highlights.length >= 4);
      assert.ok(detail.fittingSteps.length >= 1);
      assert.match(detail.label.skipIf, /^Skip this if /);
      assert.equal(detail.hasVariants, detail.variants.length > 0);
      assert.ok(detail.priceHistory.length >= 1);
      assert.equal(detail.priceHistory.at(-1).price, detail.price);
      assert.ok(detail.similar.every((product) => product.categoryId === detail.categoryId && product.id !== detail.id));
      assert.equal(detail.image, detail.images[0] ?? null);
      assert.equal('costPrice' in detail || 'supplier' in detail, false, 'owner-only fields stay out');
    }

    // With a car named, a part made for it says so, and its variants and relations come along.
    const mats = db.get("SELECT id, slug FROM products WHERE sku = 'ADN-INT-007'");
    const creta = db.get("SELECT id FROM vehicles WHERE model_slug = 'creta' AND year_from = 2020");
    const detail = getProductDetail(t.ctx, mats.slug, { vehicleId: creta.id });
    assert.equal(detail.fit, 'direct');
    assert.equal(detail.variants.length, 4);
    assert.ok(detail.fitments.some((fitment) => fitment.fitType === 'no'), 'the earlier Creta is listed as not fitting');
    assert.ok(detail.ratingCount >= 1);

    const wheels = getProductDetail(t.ctx, db.get("SELECT slug FROM products WHERE sku = 'ADN-WHL-002'").slug);
    assert.ok(wheels.relations.length >= 1);
    assert.equal(wheels.pcd, '4x100');
    assert.equal(wheels.buildSlot, 'wheels');

    const dropped = getProductDetail(t.ctx, db.get("SELECT p.slug FROM drop_items di JOIN products p ON p.id = di.product_id LIMIT 1").slug);
    assert.ok(dropped.drop && dropped.price < dropped.regularPrice);
    assert.equal(dropped.lowest30Days, dropped.regularPrice, 'the price before the drop is the lowest of the last 30 days');
  });

  test('serves the seeded catalogue through the category tree', () => {
    const tree = categoryTree(t.ctx);
    assert.equal(tree.length, 9);
    assert.equal(tree.reduce((sum, category) => sum + category.children.length, 0), 63);
    assert.equal(tree.reduce((sum, category) => sum + category.productCount, 0), 146);
    assert.ok(tree.every((category) => category.children.every((child) => child.productCount >= 1)), 'no subcategory is empty');
  });

  test('changes nothing when it runs a second time', async () => {
    const before = snapshot(db);
    const again = await runSeed(t.ctx, { log: quiet });
    assert.equal(again.skipped, true);
    assert.equal(again.products, 0);
    assert.deepEqual(snapshot(db), before);
  });

  test('gives at least 80% of products a photo that exists, when the photo library has been built', { skip: !fs.existsSync(PHOTOS_FILE) && 'server/src/seed/photos.json has not been generated yet' }, () => {
    const withImage = products.filter((row) => JSON.parse(row.images).length > 0);
    assert.ok(withImage.length >= 0.8 * products.length, `${withImage.length} of ${products.length} products have a photo`);

    const urls = [
      ...products.flatMap((row) => JSON.parse(row.images)),
      ...db.all("SELECT image FROM categories WHERE image <> ''").map((row) => row.image),
      ...t.ctx.settings.get().promos.map((promo) => promo.image).filter((image) => image.startsWith('/')),
    ];
    assert.ok(urls.length > 0);
    for (const url of new Set(urls)) {
      assert.ok(fs.existsSync(`${CLIENT_PUBLIC}${url}`), `${url} is a file under client/public`);
    }
  });
});

describe('seeding with a photo library', () => {
  const wheelPhotos = [
    { url: '/catalog/alloy-wheel/wheel-01.webp', shows: 'Bright silver 20-spoke alloy wheel on a dark green car', tone: 'mixed' },
    { url: '/catalog/alloy-wheel/wheel-02.webp', shows: 'Gunmetal mesh alloy wheel with chrome lug nuts, close-up', tone: 'dark' },
    { url: '/catalog/alloy-wheel/wheel-03.webp', shows: 'Hyper silver deep-concave wheel standing on a white plinth', tone: 'light' },
    { url: '/catalog/alloy-wheel/wheel-04.webp', shows: 'Matte black off-road wheel on a lifted pickup', tone: 'dark' },
    { url: '/catalog/alloy-wheel/wheel-05.webp', shows: 'Two-tone wheel with machined silver faces and gloss black insets', tone: 'mixed' },
  ];
  const library = {
    catalog: {
      'alloy-wheel': wheelPhotos,
      underglow: [{ url: '/catalog/underglow/underglow-01.webp', shows: 'Green underglow under a show truck at night', tone: 'dark' }],
      'broken-pool': 'not a list',
    },
    editorial: [
      { url: '/editorial/night-city-01.webp', shows: 'A white hatchback in a panning shot on a city street at night', tone: 'dark' },
      { url: '/editorial/open-road-01.webp', shows: 'An overhead night view of a divided expressway', tone: 'dark' },
      { url: '/editorial/open-road-02.webp', shows: 'An aerial view of a narrow road running over scrub-covered hills', tone: 'light' },
      { url: '/editorial/wheel-closeup-01.webp', shows: 'A close-up of a brushed alloy wheel with a yellow brake caliper', tone: 'light' },
      { url: '/editorial/modified-car-01.webp', shows: 'A lowered black coupe with a front splitter and dark alloy wheels', tone: 'mixed' },
    ],
  };

  let t;
  let db;
  let result;
  const imagesOf = (sku) => JSON.parse(db.get('SELECT images FROM products WHERE sku = ?', [sku]).images);

  before(async () => {
    t = await startTestApp({ fixtures: false });
    db = t.ctx.db;
    result = await runSeed(t.ctx, { log: quiet, photos: library });
  });
  after(() => t.close());

  test('leads each product with the photo that matches its title', () => {
    assert.equal(imagesOf('ADN-WHL-002')[0], '/catalog/alloy-wheel/wheel-02.webp', 'the gunmetal mesh wheel');
    assert.equal(imagesOf('ADN-WHL-004')[0], '/catalog/alloy-wheel/wheel-03.webp', 'the hyper silver deep-concave wheel');
    assert.equal(imagesOf('ADN-WHL-005')[0], '/catalog/alloy-wheel/wheel-04.webp', 'the matte black off-road wheel');
    assert.equal(imagesOf('ADN-WHL-001')[0], '/catalog/alloy-wheel/wheel-05.webp', 'the gloss black machined wheel');
  });

  test('spreads the photos: different lead pictures, two or three per product, none repeated', () => {
    const wheels = ['ADN-WHL-001', 'ADN-WHL-002', 'ADN-WHL-003', 'ADN-WHL-004', 'ADN-WHL-005'].map(imagesOf);
    assert.equal(new Set(wheels.map((images) => images[0])).size, 5, 'five wheels lead with five different photos');
    for (const images of wheels) {
      assert.ok(images.length === 2 || images.length === 3);
      assert.equal(new Set(images).size, images.length);
    }
    const uses = new Map();
    for (const url of wheels.flat()) uses.set(url, (uses.get(url) ?? 0) + 1);
    assert.equal(uses.size, wheelPhotos.length, 'every photo of the pool is used');
    assert.ok(Math.max(...uses.values()) - Math.min(...uses.values()) <= 2, 'and none is leaned on much more than the rest');
  });

  test('copes with a small pool and with no pool at all', () => {
    assert.deepEqual(imagesOf('ADN-LGT-017'), ['/catalog/underglow/underglow-01.webp']);
    assert.deepEqual(imagesOf('ADN-LGT-018'), ['/catalog/underglow/underglow-01.webp']);
    assert.deepEqual(imagesOf('ADN-EXT-001'), [], 'no splitter photos in this library');
    assert.equal(result.productsWithPhotos, 7);
  });

  test('gives category tiles a photo from their art kind', () => {
    const imageOf = (slug) => db.get('SELECT image FROM categories WHERE slug = ?', [slug]).image;
    assert.equal(imageOf('alloy-wheels'), '/catalog/alloy-wheel/wheel-01.webp');
    assert.equal(imageOf('wheels-tyres'), '/catalog/alloy-wheel/wheel-02.webp', 'the top-level tile takes another photo of its lead subcategory');
    assert.equal(imageOf('accent-underbody'), '/catalog/underglow/underglow-01.webp');
    assert.equal(imageOf('lighting'), '/catalog/underglow/underglow-01.webp', 'falls back to a subcategory that has a photo');
    assert.equal(imageOf('front-splitters'), '');
    assert.equal(imageOf('exterior-styling'), '');
  });

  test('sets the three default promo photos through the settings', () => {
    assert.equal(result.promoImages, 3);
    const promos = Object.fromEntries(t.ctx.settings.get().promos.map((promo) => [promo.id, promo.image]));
    assert.equal(promos['build-bay'], '/editorial/modified-car-01.webp');
    assert.equal(promos['new-car'], '/editorial/open-road-02.webp');
    assert.equal(promos['friday-five'], '/editorial/wheel-closeup-01.webp');
    assert.equal(t.ctx.settings.public().promos.length, 3);
  });

  test('assignPhotos is the same every time', () => {
    const first = assignPhotos(catalog.seedProducts, { catalog: { 'alloy-wheel': wheelPhotos }, editorial: [] });
    const second = assignPhotos(catalog.seedProducts, { catalog: { 'alloy-wheel': wheelPhotos }, editorial: [] });
    assert.deepEqual([...first], [...second]);
    assert.equal(first.size, 5);
  });
});

describe('seeding a database that is not empty', () => {
  test('leaves an existing catalogue alone', async () => {
    const t = await startTestApp();
    try {
      const before = snapshot(t.ctx.db);
      const lines = [];
      const result = await runSeed(t.ctx, { log: (line) => lines.push(line) });
      assert.equal(result.skipped, true);
      assert.deepEqual(snapshot(t.ctx.db), before);
      assert.match(lines.join('\n'), /--reset/);
    } finally {
      await t.close();
    }
  });

  test('with reset, replaces the catalogue and sample rows but keeps settings, users and real coupons', async () => {
    const t = await startTestApp();
    try {
      const { db } = t.ctx;
      t.ctx.settings.update({ storeName: 'Addon Auto Motive Pune', phone: '+91 98200 12345' });
      const settingsBefore = db.all('SELECT key, value FROM settings ORDER BY key');
      const usersBefore = db.all('SELECT * FROM users ORDER BY id');

      const result = await runSeed(t.ctx, { reset: true, log: quiet, photos: { catalog: {}, editorial: [] } });
      assert.equal(result.skipped, false);
      assert.ok(result.removed > 0);
      assert.equal(result.admin, 0, 'the store already had an admin');
      assert.equal(result.products, 146);

      assert.deepEqual(db.all('SELECT key, value FROM settings ORDER BY key'), settingsBefore);
      assert.deepEqual(db.all('SELECT * FROM users ORDER BY id'), usersBefore);
      assert.equal(db.get('SELECT COUNT(*) AS total FROM products').total, 146);
      assert.equal(db.get("SELECT COUNT(*) AS total FROM products WHERE sku LIKE 'T-%'").total, 0, 'the old catalogue is gone');
      assert.equal(db.get('SELECT COUNT(*) AS total FROM categories').total, 72);
      assert.equal(db.get('SELECT COUNT(*) AS total FROM vehicles').total, generationCount);
      assert.equal(db.get("SELECT COUNT(*) AS total FROM coupons WHERE code = 'FIT10' AND is_demo = 0").total, 1, 'a real coupon is kept');
      assert.equal(db.get('SELECT COUNT(*) AS total FROM coupons WHERE is_demo = 1').total, 4);
      assert.equal(db.get('SELECT author_name FROM builds LIMIT 1').author_name, 'Addon Auto Motive Pune', 'house builds carry the store name');

      // A second reset gives the same store again, not a second copy of it.
      const counts = () =>
        Object.fromEntries(
          ['categories', 'vehicles', 'products', 'product_variants', 'product_fitments', 'price_history', 'category_picks', 'drops', 'drop_items', 'reviews', 'product_questions', 'coupons', 'builds', 'users'].map(
            (table) => [table, db.get(`SELECT COUNT(*) AS total FROM ${table}`).total],
          ),
        );
      const once = counts();
      await runSeed(t.ctx, { reset: true, log: quiet, photos: { catalog: {}, editorial: [] } });
      assert.deepEqual(counts(), once);
      assert.equal(db.get('SELECT COUNT(*) AS total FROM v_products WHERE drop_percent > 0').total, 5);
    } finally {
      await t.close();
    }
  });

  test('rolls everything back when a step fails', async () => {
    const t = await startTestApp({ fixtures: false });
    try {
      // House builds are among the last rows written, so by then nearly the whole store is in the open transaction.
      t.ctx.db.exec("CREATE TRIGGER fail_builds BEFORE INSERT ON builds BEGIN SELECT RAISE(ABORT, 'builds are closed'); END;");
      await assert.rejects(runSeed(t.ctx, { log: quiet }), /builds are closed/);
      for (const table of ['users', 'categories', 'vehicles', 'products', 'product_variants', 'product_fitments', 'price_history', 'drops', 'reviews', 'coupons']) {
        assert.equal(t.ctx.db.get(`SELECT COUNT(*) AS total FROM ${table}`).total, 0, `${table} is empty again`);
      }

      // With the cause gone, the same database seeds cleanly.
      t.ctx.db.exec('DROP TRIGGER fail_builds');
      const result = await runSeed(t.ctx, { log: quiet });
      assert.equal(result.products, 146);
      assert.equal(result.admin, 1);
    } finally {
      await t.close();
    }
  });
});
