import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';

let t;
let orderSeq = 0;

before(async () => {
  t = await startTestApp();
});
after(() => t?.close());

// Inserts an order with one line per product id and returns its order number.
function insertOrder({ productIds, status = 'delivered', userId = null, phone = '9876501234', createdAt = '2026-11-01T10:00:00Z' }) {
  orderSeq += 1;
  const orderNumber = `ADN-261101-T${String(orderSeq).padStart(3, '0')}`;
  const { db } = t.ctx;
  const orderId = db.run(
    `INSERT INTO orders (order_number, access_token, user_id, status, payment_method, customer_name, phone, ship_name, ship_phone,
       ship_line1, ship_city, ship_state, ship_pincode, subtotal, total, created_at, updated_at)
     VALUES (?, 'tok', ?, ?, 'cod', 'Test Buyer', ?, 'Test Buyer', ?, '1 Main Road', 'Bengaluru', 'Karnataka', '560001', 1000, 1000, ?, ?)`,
    [orderNumber, userId, status, phone, phone, createdAt, createdAt],
  ).lastInsertRowid;
  for (const productId of productIds) {
    db.run("INSERT INTO order_items (order_id, product_id, name, price, mrp, qty) VALUES (?, ?, 'Part', 1000, 1200, 1)", [orderId, productId]);
  }
  return orderNumber;
}

function newUser(name, email, phone) {
  return t.ctx.db.run("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, 'x', 'customer')", [name, email, phone]).lastInsertRowid;
}

const report = (overrides = {}) => ({
  authorName: 'Ravi',
  vehicle: 'Maruti Swift 2020',
  rating: 5,
  fittedBy: 'self',
  timeMinutes: 30,
  difficulty: 2,
  fittedOk: true,
  issues: '',
  body: 'Went on in half an hour.',
  ...overrides,
});

function insertReview(productId, fields) {
  const row = {
    product_id: productId,
    order_number: '',
    author_name: 'Seed',
    vehicle: 'Car',
    rating: 4,
    fitted_by: 'self',
    time_minutes: null,
    difficulty: null,
    fitted_ok: 1,
    status: 'approved',
    is_demo: 0,
    created_at: '2026-10-01T10:00:00Z',
    ...fields,
  };
  t.ctx.db.run(
    `INSERT INTO reviews (product_id, order_number, author_name, vehicle, rating, fitted_by, time_minutes, difficulty, fitted_ok, status, is_demo, created_at)
     VALUES (:product_id, :order_number, :author_name, :vehicle, :rating, :fitted_by, :time_minutes, :difficulty, :fitted_ok, :status, :is_demo, :created_at)`,
    row,
  );
}

async function pngBlob() {
  const buffer = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 30, b: 30 } } }).png().toBuffer();
  return new Blob([buffer], { type: 'image/png' });
}

describe('fitted report eligibility', () => {
  test('a signed-in buyer with a delivered order can report once', async () => {
    const { spoiler } = t.fixtures.products;
    const customer = t.fixtures.customer;
    const orderNumber = insertOrder({ productIds: [spoiler.id], userId: customer.id });
    const client = t.asCustomer();

    const res = await client(`/api/products/${spoiler.slug}/reports`, { method: 'POST', body: report() });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { ok: true, status: 'pending' });

    const row = t.ctx.db.get('SELECT * FROM reviews WHERE order_number = ?', [orderNumber]);
    assert.equal(row.user_id, customer.id);
    assert.equal(row.is_verified_purchase, 1);
    assert.equal(row.status, 'pending');
    assert.equal(row.product_id, spoiler.id);

    const again = await client(`/api/products/${spoiler.slug}/reports`, { method: 'POST', body: report() });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'conflict');

    // Pending reports are not public.
    const list = await t.api(`/api/products/${spoiler.slug}/reports`);
    assert.equal(list.body.items.some((item) => item.body === 'Went on in half an hour.'), false);
  });

  test('a guest proves the purchase with order number and phone (last 10 digits)', async () => {
    const { universal } = t.fixtures.products;
    const orderNumber = insertOrder({ productIds: [universal.id], phone: '+91 98765 01111' });
    const guest = t.newClient();
    const path = `/api/products/${universal.slug}/reports`;

    const wrongPhone = await guest(path, { method: 'POST', body: report({ orderNumber, phone: '9876509999' }) });
    assert.equal(wrongPhone.status, 403);
    assert.match(wrongPhone.body.error.message, /order/i);

    const unknownOrder = await guest(path, { method: 'POST', body: report({ orderNumber: 'ADN-000000-ZZZZ', phone: '9876501111' }) });
    assert.equal(unknownOrder.status, 403);

    const ok = await guest(path, { method: 'POST', body: report({ orderNumber: orderNumber.toLowerCase(), phone: '09876501111' }) });
    assert.equal(ok.status, 201);
    const row = t.ctx.db.get('SELECT * FROM reviews WHERE order_number = ?', [orderNumber]);
    assert.equal(row.user_id, null);
    assert.equal(row.is_verified_purchase, 1);

    const dup = await guest(path, { method: 'POST', body: report({ orderNumber, phone: '9876501111' }) });
    assert.equal(dup.status, 409);
  });

  test('order number without phone (and the reverse) is a validation error', async () => {
    const { universal } = t.fixtures.products;
    const path = `/api/products/${universal.slug}/reports`;
    const a = await t.newClient()(path, { method: 'POST', body: report({ orderNumber: 'ADN-1' }) });
    assert.equal(a.status, 400);
    assert.ok(a.body.error.fields.phone);
    const b = await t.newClient()(path, { method: 'POST', body: report({ phone: '9876501111' }) });
    assert.equal(b.status, 400);
    assert.ok(b.body.error.fields.orderNumber);
  });

  test('a guest without proof and a signed-in non-buyer are refused', async () => {
    const { bodyType } = t.fixtures.products;
    const path = `/api/products/${bodyType.slug}/reports`;
    const guest = await t.newClient()(path, { method: 'POST', body: report() });
    assert.equal(guest.status, 403);
    assert.match(guest.body.error.message, /sign in/i);

    const userId = newUser('No Buyer', 'nobuyer@example.com', '9876502222');
    const signedIn = await t.asUser(userId)(path, { method: 'POST', body: report() });
    assert.equal(signedIn.status, 403);
    assert.match(signedIn.body.error.message, /bought/i);
  });

  test('an order that does not contain the product is refused', async () => {
    const { bodyType, universal } = t.fixtures.products;
    const orderNumber = insertOrder({ productIds: [universal.id], phone: '9876503333' });
    const res = await t.newClient()(`/api/products/${bodyType.slug}/reports`, {
      method: 'POST',
      body: report({ orderNumber, phone: '9876503333' }),
    });
    assert.equal(res.status, 403);
    assert.match(res.body.error.message, /does not include/);
  });

  test('an undelivered order is refused, for guests and signed-in buyers', async () => {
    const { wheel } = t.fixtures.products;
    const userId = newUser('Waiting Buyer', 'waiting@example.com', '9876504444');
    const orderNumber = insertOrder({ productIds: [wheel.id], userId, status: 'shipped', phone: '9876504444' });
    const path = `/api/products/${wheel.slug}/reports`;

    const signedIn = await t.asUser(userId)(path, { method: 'POST', body: report() });
    assert.equal(signedIn.status, 403);
    assert.match(signedIn.body.error.message, /not been delivered/);

    const guest = await t.newClient()(path, { method: 'POST', body: report({ orderNumber, phone: '9876504444' }) });
    assert.equal(guest.status, 403);
    assert.match(guest.body.error.message, /not been delivered/);
  });

  test('a buyer with two delivered orders can report once per order', async () => {
    const { showPlate } = t.fixtures.products;
    const userId = newUser('Repeat Buyer', 'repeat@example.com', '9876505555');
    insertOrder({ productIds: [showPlate.id], userId, createdAt: '2026-10-01T10:00:00Z' });
    insertOrder({ productIds: [showPlate.id], userId, createdAt: '2026-11-01T10:00:00Z' });
    const client = t.asUser(userId);
    const path = `/api/products/${showPlate.slug}/reports`;
    assert.equal((await client(path, { method: 'POST', body: report() })).status, 201);
    assert.equal((await client(path, { method: 'POST', body: report() })).status, 201);
    assert.equal((await client(path, { method: 'POST', body: report() })).status, 409);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM reviews WHERE user_id = ?', [userId]).n, 2);
  });

  test('report fields are validated and unknown products are 404', async () => {
    const { universal } = t.fixtures.products;
    const res = await t.api(`/api/products/${universal.slug}/reports`, {
      method: 'POST',
      body: { authorName: '', rating: 9, fittedBy: 'robot', difficulty: 7, photos: ['https://evil.example/x.jpg'] },
    });
    assert.equal(res.status, 400);
    for (const field of ['authorName', 'vehicle', 'rating', 'fittedBy', 'difficulty', 'fittedOk', 'photos.0']) {
      assert.ok(res.body.error.fields[field], `expected an error for ${field}`);
    }
    assert.equal((await t.api('/api/products/no-such-part/reports')).status, 404);
    assert.equal((await t.api('/api/products/no-such-part/reports', { method: 'POST', body: report() })).status, 404);
  });
});

describe('report photos', () => {
  test('uploads up to three images and the URLs can be attached to a report', async () => {
    const form = new FormData();
    form.append('photos', await pngBlob(), 'a.png');
    form.append('photos', await pngBlob(), 'b.png');
    const res = await t.api('/api/reports/photos', { method: 'POST', body: form });
    assert.equal(res.status, 200);
    assert.equal(res.body.urls.length, 2);
    for (const url of res.body.urls) assert.match(url, /^\/uploads\/[a-f0-9]{24}\.webp$/);

    const { universal } = t.fixtures.products;
    const userId = newUser('Photo Buyer', 'photo@example.com', '9876506666');
    const orderNumber = insertOrder({ productIds: [universal.id], userId });
    const created = await t.asUser(userId)(`/api/products/${universal.slug}/reports`, {
      method: 'POST',
      body: report({ photos: res.body.urls }),
    });
    assert.equal(created.status, 201);
    const row = t.ctx.db.get('SELECT photos FROM reviews WHERE order_number = ?', [orderNumber]);
    assert.deepEqual(JSON.parse(row.photos), res.body.urls);
  });

  test('refuses a fourth image, a non-image, and a well-formed URL that was never uploaded', async () => {
    const four = new FormData();
    for (let i = 0; i < 4; i += 1) four.append('photos', await pngBlob(), `${i}.png`);
    assert.equal((await t.api('/api/reports/photos', { method: 'POST', body: four })).status, 400);

    const text = new FormData();
    text.append('photos', new Blob(['not an image'], { type: 'image/png' }), 'x.png');
    assert.equal((await t.api('/api/reports/photos', { method: 'POST', body: text })).status, 400);

    const { universal } = t.fixtures.products;
    const res = await t.api(`/api/products/${universal.slug}/reports`, {
      method: 'POST',
      body: report({ photos: [`/uploads/${'a'.repeat(24)}.webp`] }),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields['photos.0']);
  });
});

describe('fitted report summary', () => {
  test('summary maths over approved reports only, newest first, paged', async () => {
    const { db } = t.ctx;
    const productId = db.run(
      `INSERT INTO products (slug, sku, name, category_id, price, mrp, stock)
       VALUES ('summary-part', 'T-SUM-1', 'Summary Part', ?, 500, 600, 5)`,
      [t.fixtures.categories.spoilers.id],
    ).lastInsertRowid;

    const empty = await t.api('/api/products/summary-part/reports');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, {
      items: [],
      total: 0,
      average: 0,
      fittedOkPercent: null,
      medianTimeMinutes: null,
      averageDifficulty: null,
      byFitter: { self: 0, local_garage: 0, dealer: 0, not_fitted: 0 },
    });

    insertReview(productId, { rating: 5, fitted_by: 'self', time_minutes: 20, difficulty: 1, fitted_ok: 1, created_at: '2026-10-01T10:00:00Z' });
    insertReview(productId, { rating: 4, fitted_by: 'self', time_minutes: 40, difficulty: 2, fitted_ok: 1, created_at: '2026-10-02T10:00:00Z' });
    insertReview(productId, { rating: 2, fitted_by: 'local_garage', time_minutes: 90, difficulty: 4, fitted_ok: 0, created_at: '2026-10-03T10:00:00Z' });
    insertReview(productId, { rating: 4, fitted_by: 'dealer', time_minutes: 60, difficulty: null, fitted_ok: 1, created_at: '2026-10-04T10:00:00Z', is_demo: 1 });
    insertReview(productId, { rating: 3, fitted_by: 'not_fitted', time_minutes: null, difficulty: null, fitted_ok: 0, created_at: '2026-10-05T10:00:00Z' });
    // Not public: pending and rejected.
    insertReview(productId, { rating: 1, fitted_by: 'self', time_minutes: 500, difficulty: 5, fitted_ok: 0, status: 'pending' });
    insertReview(productId, { rating: 1, fitted_by: 'self', time_minutes: 500, difficulty: 5, fitted_ok: 0, status: 'rejected' });

    const res = await t.api('/api/products/summary-part/reports?limit=2');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 5);
    assert.equal(res.body.average, 3.6); // (5+4+2+4+3)/5
    assert.equal(res.body.fittedOkPercent, 75); // 3 of the 4 actually fitted
    assert.equal(res.body.medianTimeMinutes, 50); // 20, 40, 60, 90
    assert.equal(res.body.averageDifficulty, 2.3); // (1+2+4)/3
    assert.deepEqual(res.body.byFitter, { self: 2, local_garage: 1, dealer: 1, not_fitted: 1 });
    assert.equal(res.body.items.length, 2);
    assert.deepEqual(
      res.body.items.map((item) => item.createdAt),
      ['2026-10-05T10:00:00Z', '2026-10-04T10:00:00Z'],
    );
    assert.equal(res.body.items[1].isDemo, true);
    assert.equal('orderNumber' in res.body.items[0], false);
    assert.equal('status' in res.body.items[0], false);

    const page3 = await t.api('/api/products/summary-part/reports?limit=2&page=3');
    assert.equal(page3.body.items.length, 1);
    assert.equal(page3.body.items[0].createdAt, '2026-10-01T10:00:00Z');
    assert.equal(page3.body.total, 5);

    assert.equal((await t.api('/api/products/summary-part/reports?limit=500')).status, 400);
  });

  test('odd count median', async () => {
    const productId = t.ctx.db.run(
      `INSERT INTO products (slug, sku, name, category_id, price, mrp, stock) VALUES ('median-part', 'T-SUM-2', 'Median Part', ?, 500, 600, 5)`,
      [t.fixtures.categories.spoilers.id],
    ).lastInsertRowid;
    for (const minutes of [15, 45, 30]) insertReview(productId, { time_minutes: minutes });
    const res = await t.api('/api/products/median-part/reports');
    assert.equal(res.body.medianTimeMinutes, 30);
    assert.equal(res.body.fittedOkPercent, 100);
  });

  test('inactive products are 404', async () => {
    t.ctx.db.run(
      `INSERT INTO products (slug, sku, name, category_id, price, mrp, stock, is_active) VALUES ('hidden-part', 'T-HID-1', 'Hidden', ?, 500, 600, 5, 0)`,
      [t.fixtures.categories.spoilers.id],
    );
    assert.equal((await t.api('/api/products/hidden-part/reports')).status, 404);
    assert.equal((await t.api('/api/products/hidden-part/questions')).status, 404);
  });
});

describe('product questions', () => {
  test('a general question needs a name and a question, and is stored pending', async () => {
    const { universal } = t.fixtures.products;
    const path = `/api/products/${universal.slug}/questions`;
    const bad = await t.api(path, { method: 'POST', body: { kind: 'general', authorName: '', question: '' } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.authorName);
    assert.ok(bad.body.error.fields.question);

    const badKind = await t.api(path, { method: 'POST', body: { kind: 'gossip', authorName: 'Meera', question: 'Is it ABS plastic?' } });
    assert.equal(badKind.status, 400);
    assert.ok(badKind.body.error.fields.kind);

    const ok = await t.api(path, { method: 'POST', body: { kind: 'general', authorName: 'Meera', question: 'Is it ABS plastic?' } });
    assert.equal(ok.status, 201);
    assert.deepEqual(ok.body, { ok: true });
    const row = t.ctx.db.get("SELECT * FROM product_questions WHERE question = 'Is it ABS plastic?'");
    assert.equal(row.status, 'pending');
    assert.equal(row.kind, 'general');
    assert.equal(row.vehicle_label, '');
  });

  test('a fitment question needs a real car and a phone, and stores the car label', async () => {
    const { spoiler } = t.fixtures.products;
    const path = `/api/products/${spoiler.slug}/questions`;
    const missing = await t.api(path, { method: 'POST', body: { kind: 'fitment', authorName: 'Arjun', question: 'Will it fit my car?' } });
    assert.equal(missing.status, 400);
    assert.ok(missing.body.error.fields.vehicleId);
    assert.ok(missing.body.error.fields.phone);

    const badPhone = await t.api(path, {
      method: 'POST',
      body: { kind: 'fitment', authorName: 'Arjun', question: 'Will it fit my car?', vehicleId: t.fixtures.vehicles.creta.id, phone: '12345' },
    });
    assert.equal(badPhone.status, 400);
    assert.ok(badPhone.body.error.fields.phone);

    const unknownCar = await t.api(path, {
      method: 'POST',
      body: { kind: 'fitment', authorName: 'Arjun', question: 'Will it fit my car?', vehicleId: 99999, phone: '9876507777' },
    });
    assert.equal(unknownCar.status, 400);
    assert.ok(unknownCar.body.error.fields.vehicleId);

    const ok = await t.api(path, {
      method: 'POST',
      body: { kind: 'fitment', authorName: 'Arjun', question: 'Will it fit my Creta?', vehicleId: t.fixtures.vehicles.creta.id, phone: '+91 98765 07777' },
    });
    assert.equal(ok.status, 201);
    const row = t.ctx.db.get("SELECT * FROM product_questions WHERE question = 'Will it fit my Creta?'");
    assert.equal(row.kind, 'fitment');
    assert.equal(row.vehicle_id, t.fixtures.vehicles.creta.id);
    assert.equal(row.vehicle_label, t.fixtures.vehicles.creta.label);
    assert.equal(row.phone, '9876507777');
    assert.equal(row.status, 'pending');
  });

  test('only published questions are listed, without the phone', async () => {
    const { wheel } = t.fixtures.products;
    const { db } = t.ctx;
    db.run(
      `INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, phone, question, answer, answer_fit_type, answered_at, status, created_at)
       VALUES (?, 'fitment', ?, 'Hyundai Creta (2020 onwards)', 'Sana', '9876508888', 'Fits Creta?', 'No, wrong PCD.', 'no', '2026-11-02T10:00:00Z', 'published', '2026-11-01T10:00:00Z')`,
      [wheel.id, t.fixtures.vehicles.creta.id],
    );
    db.run(
      `INSERT INTO product_questions (product_id, kind, author_name, phone, question, status, created_at)
       VALUES (?, 'general', 'Hidden', '9876509876', 'Still pending?', 'pending', '2026-11-03T10:00:00Z')`,
      [wheel.id],
    );
    const res = await t.api(`/api/products/${wheel.slug}/questions`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].question, 'Fits Creta?');
    assert.equal(res.body[0].answerFitType, 'no');
    assert.equal(res.body[0].vehicleLabel, 'Hyundai Creta (2020 onwards)');
    const text = JSON.stringify(res.body);
    assert.equal(text.includes('9876508888'), false);
    assert.equal(text.includes('phone'), false);
  });
});

describe('inbound messages', () => {
  test('enquiries need a phone or email, issue increasing ticket numbers and send mail', async () => {
    t.ctx.settings.update({ notifications: { orderEmail: 'owner@addon.test' } });
    const outboxBefore = t.ctx.mailer.outbox.length;

    const noContact = await t.api('/api/enquiries', { method: 'POST', body: { name: 'Vik', message: 'Where is my parcel?' } });
    assert.equal(noContact.status, 400);
    assert.ok(noContact.body.error.fields.phone);

    const badEmail = await t.api('/api/enquiries', { method: 'POST', body: { name: 'Vik', email: 'x', message: 'Where is my parcel?' } });
    assert.equal(badEmail.status, 400);
    assert.ok(badEmail.body.error.fields.email);

    const first = await t.api('/api/enquiries', {
      method: 'POST',
      body: { kind: 'complaint', name: 'Vik', email: 'vik@example.com', phone: '', message: 'The clip arrived broken.', orderNumber: 'adn-261101-abcd' },
    });
    assert.equal(first.status, 201);
    assert.match(first.body.ticketNumber, /^ADN-T-\d{6}$/);

    const second = await t.api('/api/enquiries', { method: 'POST', body: { name: 'Neha', phone: '9876512345', message: 'Do you fit in Pune?' } });
    assert.equal(second.status, 201);
    const n1 = Number(first.body.ticketNumber.slice(-6));
    const n2 = Number(second.body.ticketNumber.slice(-6));
    assert.equal(n2, n1 + 1);

    const row = t.ctx.db.get('SELECT * FROM enquiries WHERE ticket_number = ?', [first.body.ticketNumber]);
    assert.equal(row.kind, 'complaint');
    assert.equal(row.status, 'new');
    assert.equal(row.order_number, 'ADN-261101-ABCD');
    assert.equal(t.ctx.db.get('SELECT kind FROM enquiries WHERE ticket_number = ?', [second.body.ticketNumber]).kind, 'contact');

    const sent = t.ctx.mailer.outbox.slice(outboxBefore);
    const toCustomer = sent.filter((m) => m.to === 'vik@example.com');
    assert.equal(toCustomer.length, 1);
    assert.ok(toCustomer[0].text.includes(first.body.ticketNumber));
    assert.ok(toCustomer[0].text.includes('The clip arrived broken.'));
    const toOwner = sent.filter((m) => m.to === 'owner@addon.test');
    assert.equal(toOwner.length, 2);
    assert.ok(toOwner.some((m) => m.text.includes('9876512345')));
    // The phone-only enquiry sends no customer mail.
    assert.equal(sent.length, 3);

    const badProduct = await t.api('/api/enquiries', { method: 'POST', body: { name: 'Vik', phone: '9876512345', message: 'About a part', productId: 99999 } });
    assert.equal(badProduct.status, 400);
    assert.ok(badProduct.body.error.fields.productId);
  });

  test('stock alerts need a contact and an existing product, and merge duplicates', async () => {
    const { outOfStock, wheel } = t.fixtures.products;
    const count = (productId) => t.ctx.db.get('SELECT COUNT(*) AS n FROM stock_alerts WHERE product_id = ?', [productId]).n;

    const noContact = await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id } });
    assert.equal(noContact.status, 400);
    assert.equal((await t.api('/api/stock-alerts', { method: 'POST', body: { productId: 99999, phone: '9876513579' } })).status, 404);
    assert.equal((await t.api('/api/stock-alerts', { method: 'POST', body: { productId: 'abc', phone: '9876513579' } })).status, 400);

    const first = await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, phone: '9876513579' } });
    assert.equal(first.status, 201);
    assert.deepEqual(first.body, { ok: true });
    await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, phone: '+91 98765 13579' } });
    assert.equal(count(outOfStock.id), 1);

    // Same phone with an email added: merged, email filled in.
    await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, phone: '9876513579', email: 'Alert@Example.com' } });
    assert.equal(count(outOfStock.id), 1);
    assert.equal(t.ctx.db.get('SELECT email FROM stock_alerts WHERE product_id = ?', [outOfStock.id]).email, 'alert@example.com');
    // Same email alone: merged too.
    await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, email: 'alert@example.com' } });
    assert.equal(count(outOfStock.id), 1);

    // A different person is a new request.
    await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, email: 'other@example.com' } });
    assert.equal(count(outOfStock.id), 2);

    // Variants: one must belong to the product, and each option is its own request.
    const wrongVariant = await t.api('/api/stock-alerts', { method: 'POST', body: { productId: outOfStock.id, variantId: wheel.variants[0].id, phone: '9876513579' } });
    assert.equal(wrongVariant.status, 400);
    for (const variant of wheel.variants) {
      const res = await t.api('/api/stock-alerts', { method: 'POST', body: { productId: wheel.id, variantId: variant.id, phone: '9876513579' } });
      assert.equal(res.status, 201);
    }
    await t.api('/api/stock-alerts', { method: 'POST', body: { productId: wheel.id, variantId: wheel.variants[0].id, phone: '9876513579' } });
    assert.equal(count(wheel.id), 2);
  });

  test('forms are not rate limited under test', async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        t.api('/api/enquiries', { method: 'POST', body: { name: 'Burst', email: `burst${i}@example.com`, message: 'Rate limit check' } }),
      ),
    );
    assert.ok(results.every((res) => res.status === 201));
  });
});
