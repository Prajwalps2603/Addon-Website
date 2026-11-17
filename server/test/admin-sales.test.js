import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { SESSION_COOKIE, signSession } from '../src/lib/auth.js';

let t;
let P;
let admin;

before(async () => {
  t = await startTestApp();
  P = t.fixtures.products;
  admin = t.asAdmin();
  t.ctx.settings.update({ address: { line1: '1 Shop Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' } });
});
after(() => t.close());

const KARNATAKA = { name: 'Ravi Kumar', phone: '9123456780', line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };
const MAHARASHTRA = { name: 'Meera Shah', phone: '9123456781', line1: '4 Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' };

async function placeOrder({ items, address = KARNATAKA, contactName = address.name, client = t.newClient() } = {}) {
  const res = await client('/api/orders', {
    method: 'POST',
    body: {
      items: items ?? [{ productId: P.universal.id, variantId: null, qty: 1 }],
      contact: { name: contactName, email: 'buyer@example.com', phone: address.phone },
      shippingAddress: address,
      paymentMethod: 'cod',
      idempotencyKey: randomUUID(),
    },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.order;
}

const setCreatedAt = (orderNumber, iso) => t.ctx.db.run('UPDATE orders SET created_at = ? WHERE order_number = ?', [iso, orderNumber]);
const stockOf = (id) => t.ctx.db.get('SELECT stock FROM products WHERE id = ?', [id]).stock;
const soldOf = (id) => t.ctx.db.get('SELECT sold_count FROM products WHERE id = ?', [id]).sold_count;
const noBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const futureIso =(days) => new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');

describe('permissions', () => {
  const endpoints = [
    ['GET', '/api/admin/orders'],
    ['GET', '/api/admin/orders/export'],
    ['GET', '/api/admin/orders/ADN-000000-AAAA'],
    ['PUT', '/api/admin/orders/ADN-000000-AAAA'],
    ['GET', '/api/admin/quotes'],
    ['GET', '/api/admin/quotes/1'],
    ['POST', '/api/admin/quotes'],
    ['PUT', '/api/admin/quotes/1'],
    ['DELETE', '/api/admin/quotes/1'],
    ['GET', '/api/admin/coupons'],
    ['POST', '/api/admin/coupons'],
    ['PUT', '/api/admin/coupons/1'],
    ['DELETE', '/api/admin/coupons/1'],
    ['GET', '/api/admin/customers'],
  ];
  test('401 signed out, 403 for a customer', async () => {
    const customer = t.asCustomer();
    for (const [method, path] of endpoints) {
      const body = method === 'GET' || method === 'DELETE' ? undefined : {};
      const out = await t.newClient()(path, { method, body });
      assert.equal(out.status, 401, `${method} ${path} signed out`);
      const cust = await customer(path, { method, body });
      assert.equal(cust.status, 403, `${method} ${path} as customer`);
    }
    // Nothing was written by the refused calls.
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM coupons').n, 1);
  });
});

describe('admin orders', () => {
  let a; // Karnataka, 2 units
  let b; // Maharashtra
  let c; // customer account, spoiler

  before(async () => {
    a = await placeOrder({ items: [{ productId: P.universal.id, variantId: null, qty: 2 }] });
    b = await placeOrder({ address: MAHARASHTRA, items: [{ productId: P.universal.id, variantId: null, qty: 1 }, { productId: P.bodyType.id, variantId: null, qty: 1 }] });
    c = await placeOrder({ items: [{ productId: P.spoiler.id, variantId: null, qty: 1 }], contactName: 'Kiran Customer', client: t.asCustomer() });
    setCreatedAt(a.orderNumber, '2026-10-01T06:00:00Z');
    setCreatedAt(b.orderNumber, '2026-10-15T06:00:00Z');
    setCreatedAt(c.orderNumber, '2026-11-01T06:00:00Z');
  });

  test('lists newest first with item counts and paging', async () => {
    const res = await admin('/api/admin/orders');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.deepEqual(res.body.items.map((o) => o.orderNumber), [c.orderNumber, b.orderNumber, a.orderNumber]);
    const first = res.body.items.find((o) => o.orderNumber === a.orderNumber);
    assert.equal(first.itemCount, 2);
    assert.equal(first.city, 'Bengaluru');
    assert.equal(first.amountDue, a.total);
    assert.equal('accessToken' in first, false);

    const paged = await admin('/api/admin/orders?limit=2&page=2');
    assert.equal(paged.body.items.length, 1);
    assert.equal(paged.body.pages, 2);
    assert.equal(paged.body.items[0].orderNumber, a.orderNumber);
  });

  test('filters by q, status, payment status and dates', async () => {
    const byNumber = await admin(`/api/admin/orders?q=${encodeURIComponent(b.orderNumber.slice(-4))}`);
    assert.ok(byNumber.body.items.some((o) => o.orderNumber === b.orderNumber));
    const byName = await admin('/api/admin/orders?q=meera');
    assert.deepEqual(byName.body.items.map((o) => o.orderNumber), [b.orderNumber]);
    const byPhone = await admin(`/api/admin/orders?q=${encodeURIComponent('+91 91234 56781')}`);
    assert.deepEqual(byPhone.body.items.map((o) => o.orderNumber), [b.orderNumber]);
    const wildcard = await admin('/api/admin/orders?q=%25');
    assert.equal(wildcard.body.total, 0);

    const placed = await admin('/api/admin/orders?status=placed');
    assert.equal(placed.body.total, 3);
    const delivered = await admin('/api/admin/orders?status=delivered');
    assert.equal(delivered.body.total, 0);
    const pending = await admin('/api/admin/orders?paymentStatus=pending');
    assert.equal(pending.body.total, 3);
    // Counts per status ignore the status filter but follow the others, for the status tabs.
    assert.deepEqual(delivered.body.counts, { placed: 3 });
    assert.deepEqual((await admin('/api/admin/orders?q=meera&status=delivered')).body.counts, { placed: 1 });

    const october = await admin('/api/admin/orders?from=2026-10-01&to=2026-10-31');
    assert.deepEqual(october.body.items.map((o) => o.orderNumber), [b.orderNumber, a.orderNumber]);
    const oneDay = await admin('/api/admin/orders?from=2026-10-15&to=2026-10-15');
    assert.deepEqual(oneDay.body.items.map((o) => o.orderNumber), [b.orderNumber]);

    const bad = await admin('/api/admin/orders?status=lost');
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.status);
    const badDate = await admin('/api/admin/orders?from=yesterday');
    assert.equal(badDate.status, 400);
    const backwards = await admin('/api/admin/orders?from=2026-10-31&to=2026-10-01');
    assert.equal(backwards.status, 400);
  });

  test('GET one returns the full order with its access token', async () => {
    const res = await admin(`/api/admin/orders/${a.orderNumber}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.orderNumber, a.orderNumber);
    assert.equal(typeof res.body.accessToken, 'string');
    assert.equal(res.body.items.length, 1);
    assert.equal((await admin('/api/admin/orders/ADN-000000-NONE')).status, 404);
  });

  test('status changes write events, restore stock on cancel and count sales on delivery', async () => {
    // Confirm with tracking and a note.
    const confirm = await admin(`/api/admin/orders/${c.orderNumber}`, {
      method: 'PUT',
      body: { status: 'confirmed', note: 'Called the customer.', trackingCarrier: 'Delhivery', trackingNumber: 'DL123' },
    });
    assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
    assert.equal(confirm.body.status, 'confirmed');
    assert.equal(confirm.body.tracking.number, 'DL123');
    const last = confirm.body.events.at(-1);
    assert.equal(last.actor, 'admin');
    assert.match(last.note, /Called the customer/);

    // Backwards is refused.
    const back = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { status: 'placed' } });
    assert.equal(back.status, 409);
    const invalid = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { status: 'teleported' } });
    assert.equal(invalid.status, 400);
    const badPhoto = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { packPhoto: 'javascript:alert(1)' } });
    assert.equal(badPhoto.status, 400);
    const tooMuch = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { amountPaid: c.total + 1 } });
    assert.equal(tooMuch.status, 400);
    assert.equal((await admin('/api/admin/orders/ADN-000000-NONE', { method: 'PUT', body: { status: 'confirmed' } })).status, 404);

    // Pack photo, then delivered: COD collected, sold_count bumped.
    const soldBefore = soldOf(P.spoiler.id);
    const packed = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { status: 'packed', packPhoto: '/uploads/abc123.webp' } });
    assert.equal(packed.body.packPhoto, '/uploads/abc123.webp');
    const delivered = await admin(`/api/admin/orders/${c.orderNumber}`, { method: 'PUT', body: { status: 'delivered' } });
    assert.equal(delivered.body.status, 'delivered');
    assert.equal(delivered.body.paymentStatus, 'paid');
    assert.equal(delivered.body.amountDue, 0);
    assert.equal(soldOf(P.spoiler.id), soldBefore + 1);

    // Cancel restores stock and notes it.
    const stockBefore = stockOf(P.universal.id);
    const cancelled = await admin(`/api/admin/orders/${a.orderNumber}`, { method: 'PUT', body: { status: 'cancelled', note: 'Customer changed mind' } });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(stockOf(P.universal.id), stockBefore + 2);
    assert.match(cancelled.body.events.at(-1).note, /Customer changed mind/);
    const again = await admin(`/api/admin/orders/${a.orderNumber}`, { method: 'PUT', body: { status: 'cancelled' } });
    assert.equal(again.status, 200); // same status is no change
    assert.equal(stockOf(P.universal.id), stockBefore + 2);
    const revive = await admin(`/api/admin/orders/${a.orderNumber}`, { method: 'PUT', body: { status: 'confirmed' } });
    assert.equal(revive.status, 409);
  });

  test('payment updates: amount received and paid', async () => {
    const part = await admin(`/api/admin/orders/${b.orderNumber}`, { method: 'PUT', body: { paymentStatus: 'advance_paid', amountPaid: 500 } });
    assert.equal(part.status, 200, JSON.stringify(part.body));
    assert.equal(part.body.amountPaid, 500);
    assert.equal(part.body.amountDue, b.total - 500);
    const paid = await admin(`/api/admin/orders/${b.orderNumber}`, { method: 'PUT', body: { paymentStatus: 'paid' } });
    assert.equal(paid.body.paymentStatus, 'paid');
    assert.equal(paid.body.amountDue, 0);
    const filtered = await admin('/api/admin/orders?paymentStatus=paid');
    assert.deepEqual(filtered.body.items.map((o) => o.orderNumber).sort(), [b.orderNumber, c.orderNumber].sort());
  });

  test('CSV export: BOM, one row per line, CGST + SGST inside the State, IGST outside', async () => {
    const res = await admin('/api/admin/orders/export');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="addon-orders.*\.csv"/);
    // fetch's text() drops a leading BOM, so check the raw bytes.
    const raw = await fetch(t.url + '/api/admin/orders/export', { headers: { cookie: SESSION_COOKIE + '=' + signSession(t.ctx, t.fixtures.admin.id) } });
    const bytes = new Uint8Array(await raw.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    const rows = noBom(res.body).trim().split('\r\n').map((line) => line.split(','));
    const header = rows[0];
    assert.deepEqual(header, [
      'Invoice number', 'Order number', 'Date', 'Customer', 'GSTIN', 'State', 'HSN', 'Item', 'Qty', 'Taxable value',
      'GST rate', 'CGST', 'SGST', 'IGST', 'Line total', 'Payment method', 'Order status',
    ]);
    const col = Object.fromEntries(header.map((name, index) => [name, index]));
    const body = rows.slice(1);
    const of = (orderNumber) => body.filter((row) => row[col['Order number']] === orderNumber);

    for (const order of [a, b, c]) {
      const lines = of(order.orderNumber);
      const goods = lines.filter((row) => !['Delivery charge', 'Cash on delivery fee'].includes(row[col.Item]));
      assert.equal(goods.length, order.items.length, `one row per item for ${order.orderNumber}`);
      const sum = lines.reduce((s, row) => s + Number(row[col['Line total']]), 0);
      assert.equal(Math.round(sum * 100) / 100, order.total, `lines add up to the total for ${order.orderNumber}`);
      for (const row of lines) {
        const taxes = Number(row[col.CGST]) + Number(row[col.SGST]) + Number(row[col.IGST]);
        assert.equal(Math.round((Number(row[col['Taxable value']]) + taxes) * 100) / 100, Number(row[col['Line total']]));
        assert.equal(row[col['GST rate']], '18');
        assert.equal(row[col['Payment method']], 'Cash on delivery');
        assert.ok(row[col['Invoice number']].length > 0);
      }
    }

    // Order a: inside Karnataka.
    const intra = of(a.orderNumber)[0];
    assert.equal(intra[col.State], 'Karnataka');
    assert.equal(intra[col.Qty], '2');
    assert.equal(intra[col.Date], '2026-10-01');
    assert.equal(intra[col['Order status']], 'cancelled');
    assert.ok(Number(intra[col.CGST]) > 0);
    assert.equal(intra[col.CGST], intra[col.SGST]);
    assert.equal(Number(intra[col.IGST]), 0);

    // Order b: Maharashtra, so IGST only.
    for (const row of of(b.orderNumber)) {
      assert.equal(row[col.State], 'Maharashtra');
      assert.equal(Number(row[col.CGST]), 0);
      assert.equal(Number(row[col.SGST]), 0);
      assert.ok(Number(row[col.IGST]) > 0);
    }
    assert.ok(of(b.orderNumber).some((row) => row[col.Item] === 'Cash on delivery fee'));

    // Date filter.
    const october = await admin('/api/admin/orders/export?from=2026-10-01&to=2026-10-14');
    const octRows = noBom(october.body).trim().split('\r\n').slice(1);
    assert.ok(octRows.length > 0);
    assert.ok(octRows.every((line) => line.includes(a.orderNumber)));
    const none = await admin('/api/admin/orders/export?from=2020-01-01&to=2020-01-31');
    assert.equal(noBom(none.body).trim().split('\r\n').length, 1);
    assert.equal((await admin('/api/admin/orders/export?to=nope')).status, 400);
  });

  test('CSV export quotes commas and defuses formulas', async () => {
    const odd = await placeOrder({ contactName: '=HYPERLINK("x"), Ltd' });
    const res = await admin('/api/admin/orders/export');
    const line = res.body.split('\r\n').find((l) => l.includes(odd.orderNumber));
    assert.ok(line.includes('"\'=HYPERLINK(""x""), Ltd"'), line);
  });
});

describe('admin quotes', () => {
  const base = () => ({
    customerName: 'Arjun Rao',
    phone: '9123456782',
    note: 'Discussed on call',
    items: [
      { productId: P.spoiler.id, variantId: null, qty: 1, unitPrice: 3200 },
      { productId: P.wheel.id, variantId: P.wheel.variants[1].id, qty: 1, unitPrice: 21000 },
    ],
    shippingFee: 0,
    validUntil: futureIso(3),
  });

  test('creates a quote with live item details, total and margin', async () => {
    const res = await admin('/api/admin/quotes', { method: 'POST', body: base() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const q = res.body;
    assert.equal(q.status, 'open');
    assert.equal(q.token.length, 32);
    assert.equal(q.total, 24200);
    assert.equal(q.margin, 24200 - 2100 - 16000);
    assert.equal(q.items[1].variantName, '15 inch / Gunmetal');
    assert.equal(q.items[1].sku, 'T-WHL-001-GUN');
    assert.equal(q.items[1].regularPrice, 23999);
    assert.equal(q.items[1].costPrice, 16000);
    assert.equal(q.items[0].name, P.spoiler.name);
    assert.equal(q.phone, '9123456782');
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM quotes WHERE token = ?', [q.token]).n, 1);
  });

  test('margin guard: below cost is refused naming the item, unless allowed', async () => {
    const body = base();
    body.items[1].unitPrice = 15000;
    const refused = await admin('/api/admin/quotes', { method: 'POST', body });
    assert.equal(refused.status, 400);
    assert.match(refused.body.error.message, /Gunmetal/);
    assert.ok(refused.body.error.fields['items.1.unitPrice']);

    const allowed = await admin('/api/admin/quotes?allowBelowCost=1', { method: 'POST', body });
    assert.equal(allowed.status, 201);
    assert.equal(allowed.body.margin, 3200 + 15000 - 2100 - 16000);

    // No cost price known: no guard, margin null.
    t.ctx.db.run('UPDATE products SET cost_price = NULL WHERE id = ?', [P.universal.id]);
    const unknown = await admin('/api/admin/quotes', {
      method: 'POST',
      body: { ...base(), items: [{ productId: P.universal.id, variantId: null, qty: 2, unitPrice: 1 }] },
    });
    assert.equal(unknown.status, 201);
    assert.equal(unknown.body.margin, null);
    t.ctx.db.run('UPDATE products SET cost_price = 700 WHERE id = ?', [P.universal.id]);
  });

  test('items must be real, active, with the right variant', async () => {
    const cases = [
      [{ productId: 999999, variantId: null, qty: 1, unitPrice: 100 }, 'items.0.productId'],
      [{ productId: P.wheel.id, variantId: null, qty: 1, unitPrice: 22000 }, 'items.0.variantId'],
      [{ productId: P.spoiler.id, variantId: P.wheel.variants[0].id, qty: 1, unitPrice: 3400 }, 'items.0.variantId'],
      [{ productId: P.showPlate.id, variantId: null, qty: 1, unitPrice: 799 }, 'items.0.productId'],
      [{ productId: P.spoiler.id, variantId: null, qty: 0, unitPrice: 3400 }, 'items.0.qty'],
      [{ productId: P.spoiler.id, variantId: null, qty: 1, unitPrice: -5 }, 'items.0.unitPrice'],
    ];
    for (const [item, field] of cases) {
      const res = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), items: [item] } });
      assert.equal(res.status, 400, JSON.stringify(item));
      assert.ok(res.body.error.fields[field], `${field}: ${JSON.stringify(res.body.error)}`);
    }
    t.ctx.db.run('UPDATE products SET is_active = 0 WHERE id = ?', [P.bodyType.id]);
    const inactive = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), items: [{ productId: P.bodyType.id, variantId: null, qty: 1, unitPrice: 2400 }] } });
    assert.equal(inactive.status, 400);
    t.ctx.db.run('UPDATE products SET is_active = 1 WHERE id = ?', [P.bodyType.id]);

    const dup = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), items: [base().items[0], base().items[0]] } });
    assert.equal(dup.status, 400);
    const empty = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), items: [] } });
    assert.equal(empty.status, 400);
    const past = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), validUntil: '2020-01-01T00:00:00Z' } });
    assert.equal(past.status, 400);
    assert.ok(past.body.error.fields.validUntil);
    const noName = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), customerName: '' } });
    assert.ok(noName.body.error.fields.customerName);
    const badPhone = await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), phone: '123' } });
    assert.ok(badPhone.body.error.fields.phone);
  });

  test('lifecycle: list with computed expiry, update while open, cancel, no edits after', async () => {
    const created = (await admin('/api/admin/quotes', { method: 'POST', body: base() })).body;
    const stale = (await admin('/api/admin/quotes', { method: 'POST', body: { ...base(), customerName: 'Stale Quote' } })).body;
    t.ctx.db.run("UPDATE quotes SET valid_until = '2026-01-01T00:00:00Z' WHERE id = ?", [stale.id]);

    const expired = await admin('/api/admin/quotes?status=expired');
    assert.deepEqual(expired.body.items.map((q) => q.id), [stale.id]);
    assert.equal(expired.body.items[0].status, 'expired');
    const open = await admin('/api/admin/quotes?status=open');
    assert.ok(open.body.items.every((q) => q.status === 'open'));
    assert.ok(open.body.items.some((q) => q.id === created.id));
    assert.ok(!open.body.items.some((q) => q.id === stale.id));
    const all = await admin('/api/admin/quotes');
    assert.equal(all.body.items[0].id, stale.id); // newest first
    assert.equal((await admin('/api/admin/quotes?status=bogus')).status, 400);

    // One quote by id, the same shape as in the list.
    const one = await admin(`/api/admin/quotes/${stale.id}`);
    assert.equal(one.status, 200);
    assert.deepEqual(one.body, all.body.items.find((q) => q.id === stale.id));
    assert.equal((await admin('/api/admin/quotes/999999')).status, 404);
    assert.equal((await admin('/api/admin/quotes/abc')).status, 400);

    const updated = await admin(`/api/admin/quotes/${created.id}`, {
      method: 'PUT',
      body: { ...base(), note: 'Revised', items: [{ productId: P.spoiler.id, variantId: null, qty: 2, unitPrice: 3300 }] },
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.note, 'Revised');
    assert.equal(updated.body.total, 6600);
    assert.equal(updated.body.token, created.token);
    const guarded = await admin(`/api/admin/quotes/${created.id}`, {
      method: 'PUT',
      body: { ...base(), items: [{ productId: P.spoiler.id, variantId: null, qty: 1, unitPrice: 2000 }] },
    });
    assert.equal(guarded.status, 400);

    const del = await admin(`/api/admin/quotes/${created.id}`, { method: 'DELETE' });
    assert.deepEqual(del.body, { ok: true });
    const after = await admin('/api/admin/quotes?status=cancelled');
    assert.ok(after.body.items.some((q) => q.id === created.id && q.status === 'cancelled'));
    const edit = await admin(`/api/admin/quotes/${created.id}`, { method: 'PUT', body: base() });
    assert.equal(edit.status, 409);

    t.ctx.db.run("UPDATE quotes SET status = 'ordered', order_number = 'ADN-1' WHERE id = ?", [stale.id]);
    assert.equal((await admin(`/api/admin/quotes/${stale.id}`, { method: 'DELETE' })).status, 409);
    assert.equal((await admin('/api/admin/quotes/99999', { method: 'DELETE' })).status, 404);
    assert.equal((await admin('/api/admin/quotes/99999', { method: 'PUT', body: base() })).status, 404);
    assert.equal((await admin('/api/admin/quotes/abc', { method: 'DELETE' })).status, 400);
  });
});

describe('admin coupons', () => {
  const coupon = (overrides = {}) => ({
    code: 'monsoon15',
    description: 'Monsoon offer',
    type: 'percent',
    value: 15,
    minOrder: 1500,
    maxDiscount: 750,
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-12-01T00:00:00Z',
    usageLimit: 100,
    isActive: true,
    ...overrides,
  });

  test('lists the fixture coupon', async () => {
    const res = await admin('/api/admin/coupons');
    assert.equal(res.status, 200);
    assert.ok(res.body.some((c) => c.code === 'FIT10' && c.type === 'percent'));
  });

  test('create, update, delete with uppercase unique codes', async () => {
    const created = await admin('/api/admin/coupons', { method: 'POST', body: coupon() });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.code, 'MONSOON15');
    assert.equal(created.body.usedCount, 0);
    assert.equal(created.body.maxDiscount, 750);

    const dup = await admin('/api/admin/coupons', { method: 'POST', body: coupon({ code: 'Monsoon15' }) });
    assert.equal(dup.status, 409);
    const dupFixture = await admin('/api/admin/coupons', { method: 'POST', body: coupon({ code: 'fit10' }) });
    assert.equal(dupFixture.status, 409);

    const updated = await admin(`/api/admin/coupons/${created.body.id}`, {
      method: 'PUT',
      body: coupon({ code: 'monsoon200', type: 'flat', value: 200, maxDiscount: 999, isActive: false }),
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.code, 'MONSOON200');
    assert.equal(updated.body.type, 'flat');
    assert.equal(updated.body.maxDiscount, null);
    assert.equal(updated.body.isActive, false);
    const clash = await admin(`/api/admin/coupons/${created.body.id}`, { method: 'PUT', body: coupon({ code: 'FIT10' }) });
    assert.equal(clash.status, 409);
    const same = await admin(`/api/admin/coupons/${created.body.id}`, { method: 'PUT', body: coupon({ code: 'monsoon200' }) });
    assert.equal(same.status, 200);

    const ship = await admin('/api/admin/coupons', { method: 'POST', body: coupon({ code: 'FREESHIP', type: 'free_shipping', value: 50, startsAt: null, endsAt: '', usageLimit: null }) });
    assert.equal(ship.status, 201, JSON.stringify(ship.body));
    assert.equal(ship.body.value, 0);
    assert.equal(ship.body.startsAt, null);
    assert.equal(ship.body.endsAt, null);

    assert.deepEqual((await admin(`/api/admin/coupons/${created.body.id}`, { method: 'DELETE' })).body, { ok: true });
    assert.equal((await admin(`/api/admin/coupons/${created.body.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await admin(`/api/admin/coupons/${created.body.id}`, { method: 'PUT', body: coupon() })).status, 404);
  });

  test('validates type, value ranges, codes and dates', async () => {
    const cases = [
      [coupon({ value: 150 }), 'value'],
      [coupon({ value: 0 }), 'value'],
      [coupon({ type: 'flat', value: 2000, minOrder: 1500 }), 'value'],
      [coupon({ type: 'bogof' }), 'type'],
      [coupon({ code: 'a b' }), 'code'],
      [coupon({ code: 'X' }), 'code'],
      [coupon({ endsAt: '2026-10-01T00:00:00Z' }), 'endsAt'],
      [coupon({ startsAt: 'someday' }), 'startsAt'],
      [coupon({ usageLimit: 0 }), 'usageLimit'],
      [coupon({ minOrder: -1 }), 'minOrder'],
    ];
    for (const [body, field] of cases) {
      const res = await admin('/api/admin/coupons', { method: 'POST', body });
      assert.equal(res.status, 400, `${field}: ${JSON.stringify(body)}`);
      assert.ok(res.body.error.fields[field], `${field}: ${JSON.stringify(res.body.error)}`);
    }
    const nothing = await admin('/api/admin/coupons', { method: 'POST' });
    assert.equal(nothing.status, 400);
    assert.ok(nothing.body.error.fields.code);

    // A usage limit below what has been used already is refused.
    t.ctx.db.run('UPDATE coupons SET used_count = 5 WHERE code = ?', ['FIT10']);
    const id = t.fixtures.coupon.id;
    const low = await admin(`/api/admin/coupons/${id}`, { method: 'PUT', body: coupon({ code: 'FIT10', usageLimit: 3 }) });
    assert.equal(low.status, 400);
    assert.ok(low.body.error.fields.usageLimit);
    t.ctx.db.run('UPDATE coupons SET used_count = 0 WHERE code = ?', ['FIT10']);
  });
});

describe('admin customers', () => {
  test('lists customers with order count, total spent and last order', async () => {
    const extra = Number(
      t.ctx.db.run("INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ('Nisha Nair', 'nisha@example.com', '9123456789', 'x', 'customer', '2026-11-10T00:00:00Z')").lastInsertRowid,
    );
    const customerId = t.fixtures.customer.id;
    const rows = t.ctx.db.all('SELECT total, status, payment_status, created_at FROM orders WHERE user_id = ?', [customerId]);
    const expectedSpent = rows
      .filter((r) => !['cancelled', 'returned'].includes(r.status) && (r.status === 'delivered' || r.payment_status === 'paid'))
      .reduce((s, r) => s + r.total, 0);
    assert.ok(rows.length >= 1);

    // A cancelled paid order does not count as spent.
    const extraOrder = await placeOrder({ client: t.asUser(extra), address: { ...KARNATAKA, name: 'Nisha Nair', phone: '9123456789' } });
    await admin(`/api/admin/orders/${extraOrder.orderNumber}`, { method: 'PUT', body: { paymentStatus: 'paid' } });
    await admin(`/api/admin/orders/${extraOrder.orderNumber}`, { method: 'PUT', body: { status: 'cancelled' } });

    const res = await admin('/api/admin/customers');
    assert.equal(res.status, 200);
    assert.ok(res.body.items.every((c) => c.role === 'customer'));
    assert.ok(!res.body.items.some((c) => c.email === t.fixtures.admin.email));
    const kiran = res.body.items.find((c) => c.id === customerId);
    assert.equal(kiran.orderCount, rows.length);
    assert.equal(kiran.totalSpent, expectedSpent);
    assert.ok(kiran.totalSpent > 0);
    assert.equal(kiran.lastOrderAt, rows.map((r) => r.created_at).sort().at(-1));
    assert.equal('password_hash' in kiran || 'passwordHash' in kiran, false);
    const nisha = res.body.items.find((c) => c.id === extra);
    assert.equal(nisha.orderCount, 1);
    assert.equal(nisha.totalSpent, 0);

    const search = await admin('/api/admin/customers?q=nisha');
    assert.deepEqual(search.body.items.map((c) => c.id), [extra]);
    const byPhone = await admin('/api/admin/customers?q=98765%2043210');
    assert.deepEqual(byPhone.body.items.map((c) => c.id), [customerId]);
    const byEmail = await admin('/api/admin/customers?q=KIRAN@');
    assert.deepEqual(byEmail.body.items.map((c) => c.id), [customerId]);
    const paged = await admin('/api/admin/customers?limit=1');
    assert.equal(paged.body.items.length, 1);
    assert.equal(paged.body.total, 2);
    assert.equal((await admin('/api/admin/customers?limit=500')).status, 400);
  });
});
