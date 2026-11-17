import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { suggestReorderQty } from '../src/routes/admin/demand.js';
import { cartLink, waNumber } from '../src/routes/admin/followups.js';
import { istRange } from '../src/routes/admin/stats.js';

const NOW = '2026-11-17T10:00:00Z'; // 15:30 on 17 November in India
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(Date.parse(NOW) - ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const ahead = (ms) => new Date(Date.parse(NOW) + ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

let orderSeq = 0;
function insertOrder(t, o) {
  orderSeq += 1;
  const number = o.number ?? `ADN-TEST-${String(orderSeq).padStart(4, '0')}`;
  const items = o.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const shipping = o.shipping ?? 0;
  const id = t.ctx.db.run(
    `INSERT INTO orders (order_number, access_token, status, payment_method, payment_status, upi_reference, customer_name, phone,
       ship_name, ship_phone, ship_line1, ship_city, ship_state, ship_pincode, vehicle, subtotal, shipping_fee, total, amount_paid,
       created_at, updated_at)
     VALUES (:number, :token, :status, :method, :paymentStatus, :upi, :name, :phone, :name, :phone, '1 Test Road', 'Bengaluru', :state,
       '560001', :vehicle, :subtotal, :shipping, :total, :paid, :createdAt, :updatedAt)`,
    {
      number,
      token: `tok-${number}`,
      status: o.status ?? 'placed',
      method: o.method ?? 'cod',
      paymentStatus: o.paymentStatus ?? 'pending',
      upi: o.upi ?? '',
      name: o.name ?? 'Test Buyer',
      phone: o.phone ?? '9845000001',
      state: o.state ?? 'Karnataka',
      vehicle: o.vehicle ?? '',
      subtotal,
      shipping,
      total: o.total ?? subtotal + shipping,
      paid: o.paid ?? 0,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt ?? o.createdAt,
    },
  ).lastInsertRowid;
  for (const item of items) {
    t.ctx.db.run(
      'INSERT INTO order_items (order_id, product_id, variant_id, slug, name, variant_name, sku, price, mrp, qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, item.product.id, item.variantId ?? null, item.product.slug, item.product.name, item.variantName ?? '', item.product.sku, item.price, item.price, item.qty],
    );
  }
  if (o.deliveredAt) {
    t.ctx.db.run("INSERT INTO order_events (order_id, status, created_at) VALUES (?, 'delivered', ?)", [id, o.deliveredAt]);
  }
  return { id, number };
}

test('istRange covers whole India days and ends now', () => {
  const range = istRange(NOW, 7);
  assert.equal(range.from, '2026-11-10T18:30:00Z');
  assert.equal(range.to, NOW);
  assert.deepEqual(range.dates, ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17']);
  // 20:00 UTC is already the next day in India.
  assert.equal(istRange('2026-11-17T20:00:00Z', 1).dates[0], '2026-11-18');
});

test('waNumber and cartLink', () => {
  assert.equal(waNumber('+91 98450 22222'), '919845022222');
  assert.equal(waNumber('098450 22222'), '919845022222');
  assert.equal(waNumber('12345'), '');
  assert.equal(waNumber(''), '');
  assert.equal(
    cartLink('https://shop.test', [
      { productId: 3, variantId: null, qty: 2 },
      { productId: 4, variantId: 7, qty: 1, custom: { text: 'KA' } },
      { productId: 'x', qty: 1 },
    ]),
    `https://shop.test/cart?c=3x2.4v7x1-${Buffer.from('{"text":"KA"}').toString('base64url')}`,
  );
});

test('suggestReorderQty covers 30 days of sales, minimum 5', () => {
  assert.equal(suggestReorderQty({ stock: 2, threshold: 5, soldLast30: 40 }), 43);
  assert.equal(suggestReorderQty({ stock: 0, threshold: 5, soldLast30: 0 }), 5);
  assert.equal(suggestReorderQty({ stock: 4, threshold: 5, soldLast30: 0 }), 5);
  assert.equal(suggestReorderQty({ stock: -1, threshold: 2, soldLast30: 10 }), 12);
});

describe('GET /api/admin/stats', () => {
  let t;
  before(async () => {
    t = await startTestApp();
    t.ctx.now = () => NOW;
    const { spoiler, universal, bodyType, wheel, outOfStock } = t.fixtures.products;
    const db = t.ctx.db;
    db.run("UPDATE users SET created_at = '2026-01-01T00:00:00Z'");
    db.run("INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ('New One', 'new@example.com', '', 'x', 'customer', '2026-11-12T00:00:00Z')");
    db.run("INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ('Staff', 'staff@example.com', '', 'x', 'admin', '2026-11-12T00:00:00Z')");

    // In range for 7 days (from 2026-11-10T18:30:00Z).
    insertOrder(t, {
      status: 'delivered', method: 'cod', vehicle: 'Swift 2020', state: 'Karnataka', shipping: 100,
      items: [{ product: spoiler, price: 3499, qty: 2 }], createdAt: '2026-11-16T19:00:00Z',
    });
    insertOrder(t, {
      status: 'placed', method: 'upi', upi: 'UTR123', vehicle: ' swift 2020 ', state: 'Kerala',
      items: [{ product: universal, price: 1299, qty: 1 }], createdAt: '2026-11-16T18:00:00Z',
    });
    insertOrder(t, {
      status: 'cancelled', method: 'razorpay', paymentStatus: 'refunded', paid: 21999,
      items: [{ product: wheel, variantId: wheel.variants[0].id, price: 21999, qty: 1 }], createdAt: '2026-11-15T08:00:00Z',
    });
    insertOrder(t, { status: 'pending_payment', method: 'razorpay', items: [{ product: outOfStock, price: 899, qty: 1 }], createdAt: '2026-11-15T09:00:00Z' });
    insertOrder(t, {
      status: 'delivered', method: 'razorpay', paymentStatus: 'paid', paid: 2499, vehicle: 'Creta', state: 'Karnataka',
      items: [{ product: bodyType, price: 2499, qty: 1 }], createdAt: '2026-11-10T18:30:00Z',
    });
    // 23:59 on 10 November in India: outside the 7-day range, inside 30 days.
    insertOrder(t, {
      status: 'shipped', method: 'razorpay', paymentStatus: 'paid', paid: 2499, state: 'Goa',
      items: [{ product: bodyType, price: 2499, qty: 1 }], createdAt: '2026-11-10T18:29:59Z',
    });

    db.run('UPDATE products SET stock = 5 WHERE id = ?', [universal.id]);
    db.run('UPDATE products SET supplier = ? WHERE id = ?', ['Forge Supplies', outOfStock.id]);
    db.run('UPDATE products SET is_active = 0, stock = 1 WHERE id = ?', [t.fixtures.products.showPlate.id]);

    db.run("INSERT INTO enquiries (ticket_number, name, message, status) VALUES ('ADN-T-000001', 'A', 'Hello', 'new')");
    db.run("INSERT INTO enquiries (ticket_number, name, message, status) VALUES ('ADN-T-000002', 'B', 'Hello', 'resolved')");
    db.run("INSERT INTO stock_alerts (product_id, phone) VALUES (?, '9845012345')", [outOfStock.id]);
    db.run("INSERT INTO product_questions (product_id, author_name, question) VALUES (?, 'Q', 'Does it fit?')", [spoiler.id]);
    db.run("INSERT INTO checkout_leads (token, phone) VALUES ('lead-a', '9845012345')");
    db.run("INSERT INTO reviews (product_id, author_name, rating) VALUES (?, 'R', 5)", [spoiler.id]);
    db.run("INSERT INTO builds (slug, title, state, status) VALUES ('b1', 'B', '{}', 'pending')");
  });
  after(() => t.close());

  test('every number for 7 days', async () => {
    const { spoiler, universal, bodyType, outOfStock } = t.fixtures.products;
    const res = await t.asAdmin()('/api/admin/stats?days=7');
    assert.equal(res.status, 200);
    const s = res.body;
    assert.equal(s.rangeDays, 7);
    assert.equal(s.revenue, 7098 + 1299 + 2499);
    assert.equal(s.orders, 3);
    assert.equal(s.averageOrderValue, Math.round(10896 / 3));
    assert.equal(s.unitsSold, 4);
    assert.equal(s.newCustomers, 1);
    assert.equal(s.pendingOrders, 1);
    assert.equal(s.collected, 2499); // the refunded cancellation does not count
    assert.equal(s.codOutstanding, 7098);
    // goods (6998 + 1299 + 2499) minus cost (2 x 2100 + 700 + 1500)
    assert.equal(s.margin, 10796 - 6400);

    assert.equal(s.series.length, 7);
    assert.deepEqual(s.series[0], { date: '2026-11-11', revenue: 2499, orders: 1 });
    assert.deepEqual(s.series[5], { date: '2026-11-16', revenue: 1299, orders: 1 });
    assert.deepEqual(s.series[6], { date: '2026-11-17', revenue: 7098, orders: 1 });
    assert.deepEqual(s.series.slice(1, 5).map((p) => p.revenue), [0, 0, 0, 0]);

    assert.deepEqual(s.byStatus, [
      { status: 'pending_payment', count: 1 },
      { status: 'placed', count: 1 },
      { status: 'delivered', count: 2 },
      { status: 'cancelled', count: 1 },
    ]);
    assert.deepEqual(s.byPaymentMethod, [
      { method: 'upi', count: 1, revenue: 1299 },
      { method: 'razorpay', count: 1, revenue: 2499 },
      { method: 'cod', count: 1, revenue: 7098 },
    ]);
    assert.deepEqual(
      s.topProducts.map((p) => [p.productId, p.units, p.revenue]),
      [
        [spoiler.id, 2, 6998],
        [bodyType.id, 1, 2499],
        [universal.id, 1, 1299],
      ],
    );
    assert.equal(s.topProducts[0].slug, spoiler.slug);
    assert.deepEqual(s.topCategories, [{ name: 'Spoilers & Wings', units: 4, revenue: 10796 }]);
    assert.deepEqual(s.topStates, [
      { state: 'Karnataka', orders: 2, revenue: 9597 },
      { state: 'Kerala', orders: 1, revenue: 1299 },
    ]);
    assert.deepEqual(s.topVehicles, [
      { vehicle: 'Swift 2020', orders: 2 },
      { vehicle: 'Creta', orders: 1 },
    ]);
    assert.deepEqual(
      s.lowStock.map((p) => [p.productId, p.stock, p.threshold, p.supplier]),
      [
        [outOfStock.id, 0, 5, 'Forge Supplies'],
        [universal.id, 5, 5, ''],
      ],
    );
    assert.equal(s.lowStock[0].sku, outOfStock.sku);

    const followUps = await t.asAdmin()('/api/admin/followups');
    assert.deepEqual(s.openCounts, {
      followUps: followUps.body.length,
      enquiries: 1,
      reports: 1,
      questions: 1,
      leads: 1,
      stockAlerts: 1,
      builds: 1,
    });
    assert.ok(s.openCounts.followUps >= 2); // at least the UPI check and the report request for the order delivered on 11 November
  });

  test('30 days is the default and reaches the earlier order', async () => {
    const res = await t.asAdmin()('/api/admin/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.rangeDays, 30);
    assert.equal(res.body.series.length, 30);
    assert.equal(res.body.series.at(-1).date, '2026-11-17');
    assert.equal(res.body.revenue, 10896 + 2499);
    assert.deepEqual(res.body.series.find((p) => p.date === '2026-11-10'), { date: '2026-11-10', revenue: 2499, orders: 1 });
  });

  test('margin is null when any sold line has no cost price', async () => {
    const { universal } = t.fixtures.products;
    t.ctx.db.run('UPDATE products SET cost_price = NULL WHERE id = ?', [universal.id]);
    try {
      const res = await t.asAdmin()('/api/admin/stats?days=7');
      assert.equal(res.body.margin, null);
    } finally {
      t.ctx.db.run('UPDATE products SET cost_price = 700 WHERE id = ?', [universal.id]);
    }
  });

  test('an empty range has zeros everywhere', async () => {
    t.ctx.now = () => '2027-06-01T10:00:00Z';
    try {
      const res = await t.asAdmin()('/api/admin/stats?days=7');
      assert.equal(res.body.revenue, 0);
      assert.equal(res.body.averageOrderValue, 0);
      assert.equal(res.body.margin, 0);
      assert.equal(res.body.series.length, 7);
      assert.ok(res.body.series.every((p) => p.revenue === 0 && p.orders === 0));
      assert.deepEqual(res.body.byStatus, []);
    } finally {
      t.ctx.now = () => NOW;
    }
  });

  test('validation and permissions', async () => {
    for (const days of ['10', 'abc', '0', '-7']) {
      const res = await t.asAdmin()(`/api/admin/stats?days=${days}`);
      assert.equal(res.status, 400, days);
      assert.equal(res.body.error.code, 'validation_error');
      assert.ok(res.body.error.fields.days);
    }
    assert.equal((await t.api('/api/admin/stats')).status, 401);
    assert.equal((await t.asCustomer()('/api/admin/stats')).status, 403);
  });
});

describe('GET /api/admin/demand', () => {
  let t;
  before(async () => {
    t = await startTestApp();
    t.ctx.now = () => NOW;
    const db = t.ctx.db;
    const { spoiler, universal, bodyType, wheel, outOfStock, showPlate } = t.fixtures.products;
    const search = (query, results, createdAt) =>
      db.run('INSERT INTO search_log (query, result_count, created_at) VALUES (?, ?, ?)', [query, results, createdAt]);
    search('Dikki Light', 0, '2026-11-16T10:00:00Z');
    search('dikki light ', 0, '2026-11-17T09:00:00Z');
    search('DIKKI LIGHT', 0, '2026-11-15T10:00:00Z');
    search('spoiler', 3, '2026-11-16T11:00:00Z');
    search('Spoiler', 4, '2026-11-16T12:00:00Z');
    search('stepney cover', 0, '2026-11-14T12:00:00Z');
    search('old query', 0, '2026-10-01T12:00:00Z');

    db.run("INSERT INTO stock_alerts (product_id, phone, status) VALUES (?, '9845012345', 'waiting')", [outOfStock.id]);
    db.run("INSERT INTO stock_alerts (product_id, email, status) VALUES (?, 'a@example.com', 'waiting')", [outOfStock.id]);
    db.run("INSERT INTO stock_alerts (product_id, phone, status) VALUES (?, '9845012346', 'notified')", [outOfStock.id]);
    db.run("INSERT INTO stock_alerts (product_id, variant_id, phone, status) VALUES (?, ?, '9845012347', 'waiting')", [wheel.id, wheel.variants[1].id]);

    const question = (fields) =>
      db.run(
        'INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, question, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [spoiler.id, fields.kind ?? 'fitment', fields.vehicleId ?? null, fields.label ?? '', 'Asker', 'Will it fit?', fields.status ?? 'pending'],
      );
    question({ label: 'Hyundai i20 (2020 onwards)' });
    question({ label: 'hyundai i20 (2020 onwards) ' });
    question({ vehicleId: t.fixtures.vehicles.creta.id });
    question({ label: 'Tata Nexon', status: 'published' });
    question({ label: 'Kia Seltos', kind: 'general' });

    db.run("UPDATE products SET supplier = 'Forge Supplies' WHERE id = ?", [outOfStock.id]);
    db.run("UPDATE products SET supplier = 'Aero Parts', stock = 2 WHERE id = ?", [universal.id]);
    db.run("UPDATE products SET supplier = '  ', stock = 4 WHERE id = ?", [bodyType.id]);
    db.run('UPDATE products SET is_active = 0, stock = 0 WHERE id = ?', [showPlate.id]);

    insertOrder(t, { status: 'delivered', items: [{ product: universal, price: 1299, qty: 40 }], createdAt: '2026-11-01T10:00:00Z' });
    insertOrder(t, { status: 'cancelled', items: [{ product: bodyType, price: 2499, qty: 1 }], createdAt: '2026-11-02T10:00:00Z' });
    insertOrder(t, { status: 'delivered', items: [{ product: bodyType, price: 2499, qty: 3 }], createdAt: '2026-10-08T10:00:00Z' });
  });
  after(() => t.close());

  test('searches, waits, cars and the reorder list', async () => {
    const { universal, bodyType, wheel, outOfStock } = t.fixtures.products;
    const res = await t.asAdmin()('/api/admin/demand?days=7');
    assert.equal(res.status, 200);
    const d = res.body;
    assert.equal(d.rangeDays, 7);
    assert.deepEqual(d.topSearches, [
      { query: 'dikki light', count: 3, avgResults: 0 },
      { query: 'spoiler', count: 2, avgResults: 3.5 },
      { query: 'stepney cover', count: 1, avgResults: 0 },
    ]);
    assert.deepEqual(d.missedSearches, [
      { query: 'dikki light', count: 3, lastSeen: '2026-11-17T09:00:00Z' },
      { query: 'stepney cover', count: 1, lastSeen: '2026-11-14T12:00:00Z' },
    ]);
    assert.deepEqual(d.mostWaitedFor, [
      { productId: outOfStock.id, name: outOfStock.name, slug: outOfStock.slug, waiting: 2, stock: 0 },
      { productId: wheel.id, name: wheel.name, slug: wheel.slug, waiting: 1, stock: 6 },
    ]);
    assert.deepEqual(d.unansweredCars, [
      { vehicleLabel: 'Hyundai i20 (2020 onwards)', questions: 2 },
      { vehicleLabel: 'Hyundai Creta (2020 onwards)', questions: 1 },
    ]);

    assert.deepEqual(
      d.reorder.map((group) => [group.supplier, group.items.map((item) => [item.productId, item.stock, item.suggestedQty])]),
      [
        ['Aero Parts', [[universal.id, 2, 43]]],
        ['Forge Supplies', [[outOfStock.id, 0, 5]]],
        ['No supplier set', [[bodyType.id, 4, 5]]],
      ],
    );
    const aero = d.reorder[0];
    assert.equal(aero.items[0].sku, universal.sku);
    assert.equal(aero.items[0].name, universal.name);
    assert.match(aero.message, /^Hello Aero Parts,/);
    assert.ok(aero.message.includes(t.ctx.settings.get().storeName), 'the purchase order names the store');
    assert.ok(aero.message.includes(`1. ${universal.sku}: ${universal.name}, qty 43`));
    assert.match(d.reorder[2].message, /^Hello,\n/);
  });

  test('30 days reaches older searches only when they fit', async () => {
    const res = await t.asAdmin()('/api/admin/demand?days=90');
    assert.ok(res.body.missedSearches.some((m) => m.query === 'old query'));
    const short = await t.asAdmin()('/api/admin/demand?days=30');
    assert.ok(!short.body.missedSearches.some((m) => m.query === 'old query'));
  });

  test('validation and permissions', async () => {
    assert.equal((await t.asAdmin()('/api/admin/demand?days=14')).status, 400);
    assert.equal((await t.api('/api/admin/demand')).status, 401);
    assert.equal((await t.asCustomer()('/api/admin/demand')).status, 403);
  });
});

describe('GET /api/admin/followups', () => {
  let t;
  before(async () => {
    t = await startTestApp();
    t.ctx.now = () => NOW;
    t.ctx.settings.update({ storeName: 'Addon Test Garage' });
    const db = t.ctx.db;
    const { spoiler, universal, wheel, outOfStock } = t.fixtures.products;

    const lead = (fields) =>
      db.run(
        'INSERT INTO checkout_leads (token, name, phone, cart, cart_total, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [fields.token, fields.name ?? '', fields.phone, fields.cart ?? [], fields.total ?? 0, fields.status ?? 'open', fields.updatedAt, fields.updatedAt],
      ).lastInsertRowid;
    const cart = [
      { productId: spoiler.id, variantId: null, qty: 1, name: 'Roof Spoiler', variantName: '' },
      { productId: wheel.id, variantId: wheel.variants[0].id, qty: 1, name: 'Alloy Wheels', variantName: '15 inch / Gloss Black' },
    ];
    lead({ token: 'l1', name: 'Ravi Kumar', phone: '9845012345', cart, total: 25498, updatedAt: ago(2 * HOUR) });
    lead({ token: 'l2', name: 'Too Fresh', phone: '9845012346', cart, updatedAt: ago(10 * 60 * 1000) });
    lead({ token: 'l3', name: 'Too Old', phone: '9845012347', cart, updatedAt: ago(8 * DAY) });
    lead({ token: 'l4', name: 'Recovered', phone: '9845012348', cart, status: 'recovered', updatedAt: ago(3 * HOUR) });
    lead({ token: 'l5', name: 'Ordered Since', phone: '9845011112', cart, updatedAt: ago(3 * HOUR) });
    insertOrder(t, { status: 'confirmed', method: 'razorpay', paymentStatus: 'paid', phone: '9845011112', items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(2 * HOUR) });

    insertOrder(t, {
      number: 'ADN-COD-1', status: 'placed', method: 'cod', name: 'Meera Shah', phone: '+91 98450 22222',
      items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(1 * HOUR),
    });
    insertOrder(t, { status: 'confirmed', method: 'cod', items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(5 * HOUR) });
    insertOrder(t, {
      number: 'ADN-UPI-1', status: 'placed', method: 'upi', upi: 'UTR998877', name: 'Sunil Rao', phone: '9845033331',
      items: [{ product: universal, price: 1299, qty: 1 }], createdAt: ago(30 * 60 * 1000),
    });
    insertOrder(t, { status: 'placed', method: 'upi', upi: 'UTR111', paymentStatus: 'paid', items: [{ product: universal, price: 1299, qty: 1 }], createdAt: ago(HOUR) });

    insertOrder(t, {
      number: 'ADN-DEL-1', status: 'delivered', method: 'razorpay', paymentStatus: 'paid', name: 'Divya', phone: '9845055551',
      items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(9 * DAY), deliveredAt: ago(5 * DAY),
    });
    const reviewed = insertOrder(t, {
      status: 'delivered', method: 'razorpay', paymentStatus: 'paid', items: [{ product: spoiler, price: 3499, qty: 1 }],
      createdAt: ago(9 * DAY), deliveredAt: ago(5 * DAY),
    });
    db.run("INSERT INTO reviews (product_id, order_number, author_name, rating) VALUES (?, ?, 'R', 5)", [spoiler.id, reviewed.number]);
    insertOrder(t, { status: 'delivered', method: 'razorpay', items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(3 * DAY), deliveredAt: ago(1 * DAY) });
    insertOrder(t, { status: 'delivered', method: 'razorpay', items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(25 * DAY), deliveredAt: ago(20 * DAY) });

    const question = (fields) =>
      db.run(
        `INSERT INTO product_questions (product_id, kind, vehicle_label, author_name, phone, question, answer, answer_fit_type, answered_at, status, created_at)
         VALUES (?, 'fitment', 'Hyundai i20 (2020 onwards)', ?, ?, 'Will it fit?', 'Needs two holes drilled.', 'with_work', ?, 'published', ?)`,
        [spoiler.id, fields.name, fields.phone, fields.answeredAt, ago(4 * DAY)],
      );
    question({ name: 'Farhan Ali', phone: '9845066661', answeredAt: ago(DAY) });
    question({ name: 'Late Answer', phone: '9845066662', answeredAt: ago(5 * DAY) });
    question({ name: 'No Phone', phone: '', answeredAt: ago(DAY) });

    db.run('UPDATE product_variants SET stock = 0 WHERE id = ?', [wheel.variants[1].id]);
    const alert = (productId, variantId, phone, email, status, createdAt) =>
      db.run('INSERT INTO stock_alerts (product_id, variant_id, phone, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        productId, variantId, phone, email, status, createdAt,
      ]);
    alert(universal.id, null, '9845077771', '', 'waiting', ago(6 * DAY));
    alert(outOfStock.id, null, '9845077772', '', 'waiting', ago(6 * DAY));
    alert(wheel.id, wheel.variants[1].id, '9845077773', '', 'waiting', ago(5 * DAY));
    alert(wheel.id, wheel.variants[0].id, '9845077774', '', 'waiting', ago(4 * DAY));
    alert(universal.id, null, '9845077775', '', 'notified', ago(3 * DAY));
    alert(universal.id, null, '', 'mail@example.com', 'waiting', ago(2 * DAY));

    db.run(
      `INSERT INTO saved_kits (token, name, phone, vehicle_label, goal, delivery_date, product_ids, total, status, created_at)
       VALUES ('k1', 'Arjun Mehta', '9845044441', 'Hyundai Creta (2020 onwards)', 'new_car', '2026-12-05', ?, 4798, 'open', ?)`,
      [[spoiler.id, universal.id], ago(2 * DAY)],
    );
    db.run(
      "INSERT INTO saved_kits (token, name, phone, product_ids, status) VALUES ('k2', 'Done', '9845044442', '[]', 'contacted')",
    );

    const quote = (token, name, validUntil, status = 'open') =>
      db.run('INSERT INTO quotes (token, customer_name, phone, items, valid_until, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        token, name, '9845088881', [{ productId: spoiler.id, variantId: null, qty: 2, unitPrice: 3300 }], validUntil, status, ago(DAY),
      ]).lastInsertRowid;
    t.quoteId = quote('q-soon', 'Neha Gupta', ahead(24 * HOUR));
    quote('q-later', 'Later', ahead(72 * HOUR));
    quote('q-gone', 'Gone', ago(HOUR));

    const enquiry = (ticket, status, createdAt, phone = '') =>
      db.run('INSERT INTO enquiries (ticket_number, name, phone, email, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        ticket, 'Pooja Iyer', phone, 'pooja@example.com', 'Bulk order', 'Need 10 sets', status, createdAt,
      ]);
    enquiry('ADN-T-000010', 'new', ago(3 * HOUR));
    enquiry('ADN-T-000011', 'new', ago(HOUR));
    enquiry('ADN-T-000012', 'acknowledged', ago(5 * HOUR));
  });
  after(() => t.close());

  test('each type, in order of urgency, with a ready message', async () => {
    const { spoiler, universal, wheel } = t.fixtures.products;
    const res = await t.asAdmin()('/api/admin/followups');
    assert.equal(res.status, 200);
    const list = res.body;
    assert.deepEqual(
      list.map((f) => f.type),
      [
        'upi_verify',
        'cod_confirm',
        'new_enquiry',
        'quote_expiring',
        'abandoned_checkout',
        'back_in_stock',
        'back_in_stock',
        'back_in_stock',
        'fitment_answered',
        'saved_kit',
        'review_request',
      ],
    );
    for (const f of list) {
      assert.deepEqual(Object.keys(f).sort(), ['createdAt', 'detail', 'href', 'id', 'message', 'name', 'phone', 'title', 'type', 'waLink']);
      assert.ok(f.message.includes('Addon Test Garage'), f.type);
      assert.ok(!/!/.test(f.message), `no exclamation marks: ${f.type}`);
      if (f.waLink) assert.ok(f.waLink.startsWith('https://wa.me/91') && f.waLink.includes(`?text=${encodeURIComponent(f.message)}`));
    }
    const byType = (type) => list.filter((f) => f.type === type);

    const [upi] = byType('upi_verify');
    assert.match(upi.message, /^Hi Sunil,/);
    assert.ok(upi.message.includes('UTR998877'));
    assert.equal(upi.href, '/admin/orders/ADN-UPI-1');
    assert.equal(upi.waLink.split('?')[0], 'https://wa.me/919845033331');

    const [cod] = byType('cod_confirm');
    assert.match(cod.message, /^Hi Meera,/);
    assert.ok(cod.message.includes('ADN-COD-1'));
    assert.ok(cod.message.includes('1 x Addon Aero Roof Spoiler'));
    assert.ok(cod.message.includes('₹3,499'));
    assert.equal(cod.waLink.split('?')[0], 'https://wa.me/919845022222');
    assert.equal(cod.href, '/admin/orders/ADN-COD-1');

    const [enquiry] = byType('new_enquiry');
    assert.ok(enquiry.message.includes('ADN-T-000010'));
    assert.match(enquiry.message, /^Hi Pooja,/);
    assert.equal(enquiry.waLink, ''); // no phone on the enquiry
    assert.match(enquiry.detail, /Acknowledge within 45 hours/);
    assert.equal(enquiry.href, '/admin/enquiries');

    const [quote] = byType('quote_expiring');
    assert.match(quote.message, /^Hi Neha,/);
    assert.ok(quote.message.includes('http://localhost:5173/quote/q-soon'));
    assert.ok(quote.message.includes('18 Nov'));
    assert.equal(quote.href, `/admin/quotes/${t.quoteId}`);
    assert.match(quote.detail, /₹6,600/);

    const [lead] = byType('abandoned_checkout');
    assert.equal(lead.name, 'Ravi Kumar');
    assert.match(lead.message, /^Hi Ravi,/);
    assert.ok(lead.message.includes('1 x Roof Spoiler'));
    assert.ok(lead.message.includes('1 x Alloy Wheels (15 inch / Gloss Black)'));
    assert.ok(lead.message.includes('₹25,498'));
    assert.ok(lead.message.includes(`http://localhost:5173/cart?c=${spoiler.id}x1.${wheel.id}v${wheel.variants[0].id}x1`));
    assert.equal(lead.waLink.split('?')[0], 'https://wa.me/919845012345');
    assert.equal(lead.href, '/admin/leads');

    const stock = byType('back_in_stock');
    assert.deepEqual(
      stock.map((f) => f.phone),
      ['9845077771', '9845077774', ''],
    );
    assert.ok(stock[1].message.includes('(15 inch / Gloss Black)'));
    assert.ok(stock[0].message.includes(`http://localhost:5173/p/${universal.slug}`));
    assert.equal(stock[2].waLink, '');
    assert.match(stock[2].detail, /mail@example\.com/);

    const [fit] = byType('fitment_answered');
    assert.match(fit.message, /^Hi Farhan,/);
    assert.ok(fit.message.includes('fits your car with some work'));
    assert.ok(fit.message.includes('Needs two holes drilled.'));
    assert.ok(fit.message.includes('Hyundai i20 (2020 onwards)'));
    assert.equal(fit.href, '/admin/fitment-desk');

    const [kit] = byType('saved_kit');
    assert.match(kit.message, /^Hi Arjun,/);
    assert.ok(kit.message.includes('5 December 2026'));
    assert.ok(kit.message.includes('2 parts'));
    assert.ok(kit.message.includes('₹4,798'));
    // The studio and EMI lines follow the settings: studio on, EMI from ₹3,000 by default.
    assert.equal(kit.message.includes('fit them at our studio'), Boolean(t.ctx.settings.get().studio?.enabled));
    const emi = t.ctx.settings.get().emi;
    assert.equal(kit.message.includes('EMI is available'), Boolean(emi?.enabled && 4798 >= emi.minAmount));

    const [review] = byType('review_request');
    assert.match(review.message, /^Hi Divya,/);
    assert.ok(review.message.includes(`http://localhost:5173/p/${spoiler.slug}?report=ADN-DEL-1`));
    assert.equal(review.href, '/admin/orders/ADN-DEL-1');
    assert.equal(review.createdAt, ago(5 * DAY));

    assert.equal(new Set(list.map((f) => f.id)).size, list.length);
  });

  test('the list moves with the clock', async () => {
    // 30 hours on: the first quote has lapsed, the 72-hour one is now inside 48 hours, and the newer enquiry is due too.
    t.ctx.now = () => ahead(30 * HOUR);
    try {
      const res = await t.asAdmin()('/api/admin/followups');
      const quotes = res.body.filter((f) => f.type === 'quote_expiring');
      assert.deepEqual(quotes.map((f) => f.name), ['Later']);
      assert.equal(res.body.filter((f) => f.type === 'new_enquiry').length, 2);
      // The lead that was too fresh at NOW is now old enough to chase.
      assert.deepEqual(res.body.filter((f) => f.type === 'abandoned_checkout').map((f) => f.name), ['Too Fresh', 'Ravi Kumar']);
    } finally {
      t.ctx.now = () => NOW;
    }
    // 80 hours on: no quote left, and the first enquiry is past its 48 hours.
    t.ctx.now = () => ahead(80 * HOUR);
    try {
      const res = await t.asAdmin()('/api/admin/followups');
      assert.ok(!res.body.some((f) => f.type === 'quote_expiring'));
      assert.ok(!res.body.some((f) => f.type === 'fitment_answered')); // answered more than 3 days ago now
      const overdue = res.body.find((f) => f.type === 'new_enquiry' && f.detail.includes('Past the 48-hour'));
      assert.ok(overdue);
      assert.equal(res.body.filter((f) => f.type === 'new_enquiry')[0].title, 'Reply to ADN-T-000010');
    } finally {
      t.ctx.now = () => NOW;
    }
  });

  test('a COD order with a UTR waiting gets both jobs', async () => {
    insertOrder(t, {
      number: 'ADN-BOTH-1', status: 'placed', method: 'cod', upi: 'UTR5555', phone: '9845099991',
      items: [{ product: t.fixtures.products.spoiler, price: 3499, qty: 1 }], createdAt: ago(10 * 60 * 1000),
    });
    const res = await t.asAdmin()('/api/admin/followups');
    const jobs = res.body.filter((f) => f.href === '/admin/orders/ADN-BOTH-1').map((f) => f.type);
    assert.deepEqual(jobs, ['upi_verify', 'cod_confirm']);
  });

  test('studio orders: the COD and report messages speak of the studio, not a courier', async () => {
    const { spoiler } = t.fixtures.products;
    insertOrder(t, {
      number: 'ADN-STU-1', status: 'placed', method: 'cod', name: 'Kabir Das', phone: '9845011991',
      items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(20 * 60 * 1000),
    });
    insertOrder(t, {
      number: 'ADN-STU-2', status: 'delivered', method: 'razorpay', paymentStatus: 'paid', name: 'Lata Iyer', phone: '9845011992',
      items: [{ product: spoiler, price: 3499, qty: 1 }], createdAt: ago(9 * DAY), deliveredAt: ago(4 * DAY),
    });
    t.ctx.db.run("UPDATE orders SET fulfilment = 'studio' WHERE order_number IN ('ADN-STU-1', 'ADN-STU-2')");

    const res = await t.asAdmin()('/api/admin/followups');
    const cod = res.body.find((f) => f.type === 'cod_confirm' && f.href === '/admin/orders/ADN-STU-1');
    assert.ok(cod.message.includes('to pay at the studio'));
    assert.ok(cod.message.includes('fitting slot'));
    assert.ok(!cod.message.includes('cash on delivery'));
    const review = res.body.find((f) => f.type === 'review_request' && f.href === '/admin/orders/ADN-STU-2');
    assert.ok(review.message.includes('fitted at our studio'));
    assert.match(review.detail, /Fitted at the studio/);
  });

  test('permissions', async () => {
    assert.equal((await t.api('/api/admin/followups')).status, 401);
    assert.equal((await t.asCustomer()('/api/admin/followups')).status, 403);
  });
});
