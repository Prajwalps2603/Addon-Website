import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { cancelOrder, canTransition, changeStatus, expireStaleOrders, loadOrder, markPaid } from '../src/lib/orders.js';
import { priceCart } from '../src/lib/pricing.js';

let t;
let P;
const UPI_ID = 'addonauto@okaxis';

before(async () => {
  t = await startTestApp();
  P = t.fixtures.products;
  t.ctx.settings.update({
    payments: { upiId: UPI_ID, upiPayeeName: 'Addon Auto Motive' },
    notifications: { orderEmail: 'orders@addon.test' },
  });
});
after(() => t.close());

const address = {
  name: 'Ravi Kumar',
  phone: '9123456780',
  line1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
};

function orderBody(overrides = {}) {
  return {
    items: [{ productId: P.universal.id, variantId: null, qty: 1 }],
    contact: { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9123456780' },
    shippingAddress: address,
    paymentMethod: 'cod',
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

const stockOf = (id) => t.ctx.db.get('SELECT stock FROM products WHERE id = ?', [id]).stock;
const variantStock = (id) => t.ctx.db.get('SELECT stock FROM product_variants WHERE id = ?', [id]).stock;
const setStock = (id, stock) => t.ctx.db.run('UPDATE products SET stock = ? WHERE id = ?', [stock, id]);

async function place(overrides = {}, client = t.newClient()) {
  const res = await client('/api/orders', { method: 'POST', body: orderBody(overrides) });
  return res;
}

describe('creating orders', () => {
  test('plain COD order: placed, totals from the pricing engine, stock taken, first event, emails', async () => {
    const before = stockOf(P.universal.id);
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outboxBefore = 0;
    const body = orderBody({ items: [{ productId: P.universal.id, variantId: null, qty: 2 }], notes: 'Leave with the guard' });
    const priced = priceCart(t.ctx, { items: body.items, pincode: address.pincode, paymentMethod: 'cod' });

    const res = await t.api('/api/orders', { method: 'POST', body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order, payment } = res.body;
    assert.equal(payment, null);
    assert.equal(order.status, 'placed');
    assert.equal(order.paymentMethod, 'cod');
    assert.equal(order.paymentStatus, 'pending');
    assert.equal(order.total, priced.total);
    assert.equal(order.subtotal, priced.subtotal);
    assert.equal(order.codFee, priced.codFee);
    assert.equal(order.shippingFee, priced.shippingFee);
    assert.equal(order.prepaidDiscount, 0);
    assert.equal(order.amountDue, priced.total);
    assert.equal(order.advanceAmount, 0);
    assert.match(order.orderNumber, /^ADN-\d{6}-[A-Z0-9]{4}$/);
    assert.match(order.invoiceNumber, /^ADN\/\d{2}-\d{2}\/\d{4}$/);
    assert.equal(typeof order.accessToken, 'string');
    assert.equal(order.accessToken.length, 32);
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].name, P.universal.name);
    assert.equal(order.items[0].sku, P.universal.sku);
    assert.equal(order.items[0].price, P.universal.price);
    assert.equal(order.items[0].mrp, P.universal.mrp);
    assert.equal(order.items[0].gstRate, 18);
    assert.equal(order.events.length, 1);
    assert.equal(order.events[0].status, 'placed');
    assert.equal(order.notes, 'Leave with the guard');
    assert.equal(order.canCancel, true);
    assert.ok(order.estimatedDelivery?.earliest);
    assert.equal(order.tax.isInterState, false);
    assert.equal(stockOf(P.universal.id), before - 2);

    const sent = t.ctx.mailer.outbox.slice(outboxBefore);
    const customer = sent.find((mail) => mail.to === 'ravi@example.com');
    const store = sent.find((mail) => mail.to === 'orders@addon.test');
    assert.ok(customer, 'customer email sent');
    assert.ok(store, 'store email sent');
    assert.match(customer.subject, new RegExp(order.orderNumber));
    assert.ok(customer.text.includes(`http://localhost:5173/order/${order.orderNumber}?token=${order.accessToken}`));
    assert.ok(customer.html.includes(P.universal.name));
    assert.ok(customer.text.includes('Bengaluru, Karnataka 560001'));
  });

  test('the same idempotency key returns the same order and takes stock once', async () => {
    const before = stockOf(P.universal.id);
    const body = orderBody();
    const first = await t.api('/api/orders', { method: 'POST', body });
    const second = await t.api('/api/orders', { method: 'POST', body });
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.order.orderNumber, first.body.order.orderNumber);
    assert.equal(second.body.order.accessToken, first.body.order.accessToken);
    assert.equal(stockOf(P.universal.id), before - 1);
    const count = t.ctx.db.get('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?', [body.idempotencyKey]).n;
    assert.equal(count, 1);
  });

  test('validation errors name the fields', async () => {
    const res = await t.api('/api/orders', {
      method: 'POST',
      body: orderBody({
        contact: { name: 'R', email: 'not-an-email', phone: '12345' },
        shippingAddress: { ...address, pincode: '12', state: 'Atlantis' },
        paymentMethod: 'cheque',
      }),
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
    for (const field of ['contact.name', 'contact.email', 'contact.phone', 'shippingAddress.pincode', 'shippingAddress.state', 'paymentMethod']) {
      assert.ok(res.body.error.fields[field], `field ${field} reported`);
    }

    const empty = await t.api('/api/orders', { method: 'POST', body: orderBody({ items: [] }) });
    assert.equal(empty.status, 400);
    assert.ok(empty.body.error.fields.items);

    const noKey = await t.api('/api/orders', { method: 'POST', body: orderBody({ idempotencyKey: undefined }) });
    assert.equal(noKey.status, 400);
    assert.ok(noKey.body.error.fields.idempotencyKey);

    const nothing = await t.api('/api/orders', { method: 'POST' });
    assert.equal(nothing.status, 400);
  });

  test('email is optional; a blank email is accepted', async () => {
    const res = await place({ contact: { name: 'No Mail', email: '', phone: '9123456780' } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.order.email, '');
  });

  test('client-sent prices and totals are ignored', async () => {
    const res = await place({ items: [{ productId: P.universal.id, variantId: null, qty: 1, unitPrice: 1, price: 1 }], total: 1, subtotal: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.order.items[0].price, P.universal.price);
    assert.ok(res.body.order.total >= P.universal.price);
  });

  test('an out-of-stock item is refused with 409 out_of_stock naming it', async () => {
    const res = await place({ items: [{ productId: P.outOfStock.id, variantId: null, qty: 1 }] });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'out_of_stock');
    assert.ok(res.body.error.message.includes(P.outOfStock.name));
  });

  test('asking for more than is left is refused, and nothing is taken', async () => {
    setStock(P.bodyType.id, 3);
    const res = await place({ items: [{ productId: P.bodyType.id, variantId: null, qty: 5 }] });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'out_of_stock');
    assert.match(res.body.error.message, /Only 3 left/);
    assert.equal(stockOf(P.bodyType.id), 3);
  });

  test('two buyers racing for the last units: one order, one out_of_stock, variant and product stock in sync', async () => {
    const variant = P.wheel.variants[1];
    const productBefore = stockOf(P.wheel.id);
    const left = variantStock(variant.id);
    assert.ok(left >= 1);
    const lines = [{ productId: P.wheel.id, variantId: variant.id, qty: left }];
    const [a, b] = await Promise.all([
      place({ items: lines, paymentMethod: 'upi' }),
      place({ items: lines, paymentMethod: 'upi' }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    const loser = a.status === 409 ? a : b;
    assert.equal(loser.body.error.code, 'out_of_stock');
    assert.equal(variantStock(variant.id), 0);
    assert.equal(stockOf(P.wheel.id), productBefore - left);
    const winner = a.status === 201 ? a : b;
    assert.equal(winner.body.order.items[0].variantName, variant.name);
    assert.equal(winner.body.order.items[0].sku, variant.sku);
  });

  test('UPI order: waits for payment, prepaid price, upi:// link with the order number', async () => {
    const items = [{ productId: P.universal.id, variantId: null, qty: 1 }];
    const priced = priceCart(t.ctx, { items, pincode: address.pincode, paymentMethod: 'upi' });
    const res = await place({ items, paymentMethod: 'upi' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order, payment } = res.body;
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.total, priced.total);
    assert.equal(order.prepaidDiscount, priced.prepaidDiscount);
    assert.ok(order.prepaidDiscount > 0);
    assert.equal(payment.provider, 'upi');
    assert.equal(payment.purpose, 'full');
    assert.equal(payment.amount, order.total);
    assert.equal(payment.upiId, UPI_ID);
    const uri = new URL(payment.upiUri);
    assert.equal(uri.protocol, 'upi:');
    assert.ok(payment.upiUri.startsWith(`upi://pay?pa=${UPI_ID}&`));
    const params = new URLSearchParams(payment.upiUri.split('?')[1]);
    assert.equal(params.get('pn'), 'Addon Auto Motive');
    assert.equal(params.get('am'), `${order.total}.00`);
    assert.equal(params.get('cu'), 'INR');
    assert.equal(params.get('tr'), order.orderNumber);
    assert.equal(params.get('tn'), `Order ${order.orderNumber}`);
  });

  test('Razorpay is refused when it is not configured', async () => {
    const res = await place({ paymentMethod: 'razorpay' });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /not set up/);
  });

  test('a show plate cannot be paid on delivery', async () => {
    const res = await place({
      items: [{ productId: P.showPlate.id, variantId: null, qty: 1, custom: { text: 'ADDON 1', acknowledged: true } }],
      paymentMethod: 'cod',
    });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /Cash on delivery/);
    const upi = await place({
      items: [{ productId: P.showPlate.id, variantId: null, qty: 1, custom: { text: 'ADDON 1', acknowledged: true } }],
      paymentMethod: 'upi',
    });
    assert.equal(upi.status, 201, JSON.stringify(upi.body));
    assert.deepEqual(upi.body.order.items[0].custom, { text: 'ADDON 1', acknowledged: true });
  });

  test('a coupon is applied, counted once, and a bad code is refused', async () => {
    const usedBefore = t.ctx.db.get('SELECT used_count FROM coupons WHERE code = ?', ['FIT10']).used_count;
    const items = [{ productId: P.universal.id, variantId: null, qty: 1 }];
    const priced = priceCart(t.ctx, { items, couponCode: 'fit10', pincode: address.pincode, paymentMethod: 'cod' });
    const body = orderBody({ items, couponCode: 'fit10' });
    const res = await t.api('/api/orders', { method: 'POST', body });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.order.couponCode, 'FIT10');
    assert.equal(res.body.order.discount, priced.discount);
    assert.equal(res.body.order.discount, Math.round(P.universal.price * 0.1));
    assert.equal(res.body.order.total, priced.total);
    await t.api('/api/orders', { method: 'POST', body });
    assert.equal(t.ctx.db.get('SELECT used_count FROM coupons WHERE code = ?', ['FIT10']).used_count, usedBefore + 1);

    const bad = await place({ couponCode: 'NOPE' });
    assert.equal(bad.status, 409);
    assert.match(bad.body.error.message, /NOPE/);

    t.ctx.db.run('UPDATE coupons SET usage_limit = used_count WHERE code = ?', ['FIT10']);
    const full = await place({ couponCode: 'FIT10' });
    assert.equal(full.status, 409);
    t.ctx.db.run('UPDATE coupons SET usage_limit = NULL WHERE code = ?', ['FIT10']);
  });

  test('a quote is ordered at its own prices and only once', async () => {
    t.ctx.db.run(
      `INSERT INTO quotes (token, customer_name, phone, items, valid_until, status) VALUES (?, ?, ?, ?, ?, 'open')`,
      ['quote-token-1', 'Ravi', '9123456780', [{ productId: P.universal.id, variantId: null, qty: 2, unitPrice: 1000 }], '2099-01-01T00:00:00Z'],
    );
    const res = await place({ items: [], quoteToken: 'quote-token-1', couponCode: 'FIT10' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order } = res.body;
    assert.equal(order.subtotal, 2000);
    assert.equal(order.items[0].price, 1000);
    assert.equal(order.items[0].qty, 2);
    assert.equal(order.discount, 0);
    const quote = t.ctx.db.get('SELECT * FROM quotes WHERE token = ?', ['quote-token-1']);
    assert.equal(quote.status, 'ordered');
    assert.equal(quote.order_number, order.orderNumber);
    assert.equal(t.ctx.db.get('SELECT quote_token FROM orders WHERE order_number = ?', [order.orderNumber]).quote_token, 'quote-token-1');

    const again = await place({ items: [], quoteToken: 'quote-token-1' });
    assert.equal(again.status, 409);
    assert.match(again.body.error.message, /already been ordered/);
  });

  test('the checkout lead is marked recovered', async () => {
    t.ctx.db.run("INSERT INTO checkout_leads (token, name, phone) VALUES ('lead-token-1', 'Ravi', '9123456780')");
    const res = await place({ leadToken: 'lead-token-1' });
    assert.equal(res.status, 201);
    const lead = t.ctx.db.get('SELECT * FROM checkout_leads WHERE token = ?', ['lead-token-1']);
    assert.equal(lead.status, 'recovered');
    assert.equal(lead.order_number, res.body.order.orderNumber);
  });

  test('invoice numbers are consecutive', async () => {
    const a = await place();
    const b = await place();
    const seq = (order) => Number(order.invoiceNumber.split('/').pop());
    assert.equal(seq(b.body.order), seq(a.body.order) + 1);
  });

  test('vehicle label, GSTIN and saved address for a signed-in buyer', async () => {
    const customer = t.asCustomer();
    const res = await place(
      {
        vehicleId: t.fixtures.vehicles.swiftOld.id,
        gstin: '29abcde1234f1z5',
        saveAddress: true,
        shippingAddress: { ...address, line1: '45 Brigade Road' },
      },
      customer,
    );
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.order.vehicle, t.fixtures.vehicles.swiftOld.label);
    assert.equal(res.body.order.gstin, '29ABCDE1234F1Z5');
    const userId = t.fixtures.customer.id;
    assert.equal(t.ctx.db.get('SELECT user_id FROM orders WHERE order_number = ?', [res.body.order.orderNumber]).user_id, userId);
    const saved = t.ctx.db.all('SELECT * FROM addresses WHERE user_id = ? AND line1 = ?', [userId, '45 Brigade Road']);
    assert.equal(saved.length, 1);
    // Ordering again to the same address does not save a duplicate.
    await place({ saveAddress: true, shippingAddress: { ...address, line1: '45 Brigade Road' } }, customer);
    assert.equal(t.ctx.db.all('SELECT * FROM addresses WHERE user_id = ? AND line1 = ?', [userId, '45 Brigade Road']).length, 1);

    const badGstin = await place({ gstin: 'NOTAGSTIN' });
    assert.equal(badGstin.status, 400);
    assert.ok(badGstin.body.error.fields.gstin);
  });

  test('COD with an advance waits for the advance, paid by UPI when Razorpay is off', async () => {
    t.ctx.settings.update({ cod: { advancePercent: 10 } });
    try {
      const items = [{ productId: P.universal.id, variantId: null, qty: 1 }];
      const priced = priceCart(t.ctx, { items, pincode: address.pincode, paymentMethod: 'cod' });
      const res = await place({ items });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      const { order, payment } = res.body;
      assert.equal(order.status, 'pending_payment');
      assert.equal(order.advanceAmount, priced.payNow);
      assert.ok(order.advanceAmount > 0);
      assert.equal(payment.provider, 'upi');
      assert.equal(payment.purpose, 'advance');
      assert.equal(payment.amount, order.advanceAmount);

      const paid = markPaid(t.ctx, order.orderNumber, { amount: order.advanceAmount, method: 'upi', reference: '123456789012' });
      assert.equal(paid.status, 'placed');
      assert.equal(paid.paymentStatus, 'advance_paid');
      assert.equal(paid.amountPaid, order.advanceAmount);
      assert.equal(paid.amountDue, order.total - order.advanceAmount);
    } finally {
      t.ctx.settings.update({ cod: { advancePercent: 0 } });
    }
  });
});

describe('reading orders', () => {
  let order;
  before(async () => {
    const res = await place({}, t.asCustomer());
    order = res.body.order;
  });

  test('the access token opens the order; nothing else does for a stranger', async () => {
    const guest = t.newClient();
    const ok = await guest(`/api/orders/${order.orderNumber}?token=${order.accessToken}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.orderNumber, order.orderNumber);
    assert.equal(ok.body.accessToken, order.accessToken);

    assert.equal((await guest(`/api/orders/${order.orderNumber}`)).status, 404);
    const wrong = await guest(`/api/orders/${order.orderNumber}?token=${'x'.repeat(32)}`);
    assert.equal(wrong.status, 404);
    assert.equal(wrong.body.error.code, 'not_found');
    assert.equal((await guest('/api/orders/ADN-000000-ZZZZ')).status, 404);
    assert.equal((await guest('/api/orders/%3Cscript%3E')).status, 404);
  });

  test('the owner and an admin can open it; another customer gets 404, not 403', async () => {
    const own = await t.asCustomer()(`/api/orders/${order.orderNumber}`);
    assert.equal(own.status, 200);
    assert.equal(own.body.accessToken, order.accessToken);

    const admin = await t.asAdmin()(`/api/orders/${order.orderNumber}`);
    assert.equal(admin.status, 200);
    assert.equal(admin.body.accessToken, undefined);

    const otherId = t.ctx.db.run("INSERT INTO users (name, email, phone, password_hash) VALUES ('Other', 'other@example.com', '9000000001', 'x')").lastInsertRowid;
    const other = await t.asUser(otherId)(`/api/orders/${order.orderNumber}`);
    assert.equal(other.status, 404);
  });

  test('track by order number and phone (last 10 digits)', async () => {
    const ok = await t.api(`/api/orders/track?orderNumber=${order.orderNumber.toLowerCase()}&phone=${encodeURIComponent('+91 91234 56780')}`);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.orderNumber, order.orderNumber);
    assert.equal(ok.body.accessToken, undefined);

    const wrong = await t.api(`/api/orders/track?orderNumber=${order.orderNumber}&phone=9876501234`);
    assert.equal(wrong.status, 404);
    const missing = await t.api('/api/orders/track?orderNumber=ADN-000000-ZZZZ&phone=9123456780');
    assert.equal(missing.status, 404);
    const bad = await t.api(`/api/orders/track?orderNumber=${order.orderNumber}`);
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.phone);
  });
});

describe('cancelling', () => {
  test('the buyer cancels with the token; stock comes back once', async () => {
    const before = stockOf(P.universal.id);
    const { order } = (await place({ items: [{ productId: P.universal.id, variantId: null, qty: 3 }] })).body;
    assert.equal(stockOf(P.universal.id), before - 3);

    const noToken = await t.api(`/api/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { reason: 'Changed my mind' } });
    assert.equal(noToken.status, 404);

    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    const res = await t.api(`/api/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { token: order.accessToken, reason: 'Changed my mind' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'cancelled');
    assert.equal(res.body.canCancel, false);
    assert.equal(res.body.estimatedDelivery, null);
    const last = res.body.events.at(-1);
    assert.equal(last.status, 'cancelled');
    assert.equal(last.actor, 'customer');
    assert.match(last.note, /Changed my mind/);
    assert.equal(stockOf(P.universal.id), before);
    assert.ok(t.ctx.mailer.outbox.slice(outbox).some((mail) => mail.to === 'ravi@example.com' && /Cancelled/.test(mail.subject)));

    const again = await t.api(`/api/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { token: order.accessToken } });
    assert.equal(again.status, 409);
    assert.equal(stockOf(P.universal.id), before);
  });

  test('a packed order cannot be cancelled by the buyer', async () => {
    const { order } = (await place()).body;
    changeStatus(t.ctx, order.orderNumber, { status: 'packed' });
    const res = await t.api(`/api/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { token: order.accessToken } });
    assert.equal(res.status, 409);
    // The admin can still cancel it from the admin panel.
    const cancelled = cancelOrder(t.ctx, order.orderNumber, { actor: 'admin', reason: 'Customer called' });
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.events.at(-1).actor, 'admin');
  });

  test('variant stock is restored too', async () => {
    t.ctx.db.run('UPDATE product_variants SET stock = 4 WHERE id = ?', [P.wheel.variants[0].id]);
    const productBefore = stockOf(P.wheel.id);
    const { order } = (await place({ items: [{ productId: P.wheel.id, variantId: P.wheel.variants[0].id, qty: 2 }], paymentMethod: 'upi' })).body;
    assert.equal(variantStock(P.wheel.variants[0].id), 2);
    assert.equal(stockOf(P.wheel.id), productBefore - 2);
    cancelOrder(t.ctx, order.orderNumber, { actor: 'customer' });
    assert.equal(variantStock(P.wheel.variants[0].id), 4);
    assert.equal(stockOf(P.wheel.id), productBefore);
  });
});

describe('stale orders', () => {
  const realNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  beforeEach(() => {
    t.ctx.now = realNow;
  });
  after(() => {
    t.ctx.now = realNow;
  });

  test('unpaid online orders older than 60 minutes are cancelled and their stock restored', async () => {
    // Two days ahead, so every earlier unpaid order in this file is already stale before we start counting.
    const start = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
    t.ctx.now = () => iso(start);
    expireStaleOrders(t.ctx);
    const before = stockOf(P.universal.id);
    const unpaid = (await place({ paymentMethod: 'upi', items: [{ productId: P.universal.id, variantId: null, qty: 2 }] })).body.order;
    const cod = (await place({ paymentMethod: 'cod' })).body.order;
    assert.equal(stockOf(P.universal.id), before - 3);

    t.ctx.now = () => iso(start + 59 * 60 * 1000);
    assert.equal(expireStaleOrders(t.ctx), 0);

    t.ctx.now = () => iso(start + 61 * 60 * 1000);
    // Placing any order runs the expiry first.
    const next = await place({ paymentMethod: 'cod' });
    assert.equal(next.status, 201);
    const expired = loadOrder(t.ctx, unpaid.orderNumber);
    assert.equal(expired.status, 'cancelled');
    assert.match(expired.events.at(-1).note, /not received within 60 minutes/);
    assert.equal(loadOrder(t.ctx, cod.orderNumber).status, 'placed');
    assert.equal(stockOf(P.universal.id), before - 2);
    assert.equal(expireStaleOrders(t.ctx), 0);
  });
});

describe('admin status changes', () => {
  test('the transition rules', () => {
    assert.equal(canTransition('placed', 'confirmed'), true);
    assert.equal(canTransition('placed', 'shipped'), true);
    assert.equal(canTransition('packed', 'cancelled'), true);
    assert.equal(canTransition('shipped', 'cancelled'), false);
    assert.equal(canTransition('delivered', 'shipped'), false);
    assert.equal(canTransition('delivered', 'returned'), true);
    assert.equal(canTransition('placed', 'returned'), false);
    assert.equal(canTransition('cancelled', 'placed'), false);
    assert.equal(canTransition('returned', 'delivered'), false);
    assert.equal(canTransition('placed', 'pending_payment'), false);
  });

  test('through to delivery: tracking, pack photo, sold count once, COD collected, emails; then a return', async () => {
    const qty = 2;
    const { order } = (await place({ items: [{ productId: P.universal.id, variantId: null, qty }] })).body;
    const soldBefore = t.ctx.db.get('SELECT sold_count FROM products WHERE id = ?', [P.universal.id]).sold_count;
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;

    let o = changeStatus(t.ctx, order.orderNumber, { status: 'confirmed', note: 'Called the customer' });
    assert.equal(o.status, 'confirmed');
    assert.equal(o.events.at(-1).actor, 'admin');
    assert.match(o.events.at(-1).note, /Called the customer/);

    o = changeStatus(t.ctx, order.orderNumber, { status: 'packed', packPhoto: '/uploads/abc123.webp' });
    assert.equal(o.packPhoto, '/uploads/abc123.webp');
    assert.throws(() => changeStatus(t.ctx, order.orderNumber, { packPhoto: 'javascript:alert(1)' }), { status: 400 });

    o = changeStatus(t.ctx, order.orderNumber, {
      status: 'shipped',
      trackingCarrier: 'Delhivery',
      trackingNumber: 'DLV123456',
      trackingUrl: 'https://www.delhivery.com/track/package/DLV123456',
    });
    assert.deepEqual(o.tracking, { carrier: 'Delhivery', number: 'DLV123456', url: 'https://www.delhivery.com/track/package/DLV123456' });
    assert.equal(o.canCancel, false);

    o = changeStatus(t.ctx, order.orderNumber, { status: 'delivered' });
    assert.equal(o.status, 'delivered');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.amountPaid, o.total);
    assert.equal(o.amountDue, 0);
    assert.equal(t.ctx.db.get('SELECT sold_count FROM products WHERE id = ?', [P.universal.id]).sold_count, soldBefore + qty);

    // No un-delivering, and saving the same status again changes nothing.
    assert.throws(() => changeStatus(t.ctx, order.orderNumber, { status: 'shipped' }), { status: 409 });
    changeStatus(t.ctx, order.orderNumber, { status: 'delivered' });
    assert.equal(t.ctx.db.get('SELECT sold_count FROM products WHERE id = ?', [P.universal.id]).sold_count, soldBefore + qty);

    const mails = t.ctx.mailer.outbox.slice(outbox).filter((mail) => mail.to === 'ravi@example.com');
    const subjects = mails.map((mail) => mail.subject);
    for (const label of ['Confirmed', 'Packed', 'Shipped', 'Delivered']) {
      assert.equal(subjects.filter((s) => s.endsWith(label)).length, 1, `one ${label} email`);
    }
    assert.ok(mails.find((mail) => mail.subject.endsWith('Shipped')).text.includes('DLV123456'));

    const stockBefore = stockOf(P.universal.id);
    o = changeStatus(t.ctx, order.orderNumber, { status: 'returned', paymentStatus: 'refunded' });
    assert.equal(o.status, 'returned');
    assert.equal(o.paymentStatus, 'refunded');
    assert.equal(stockOf(P.universal.id), stockBefore + qty);
    assert.throws(() => changeStatus(t.ctx, order.orderNumber, { status: 'cancelled' }), { status: 409 });
    assert.equal(stockOf(P.universal.id), stockBefore + qty);
  });

  test('cancelling from admin restores stock; a verified payment moves a waiting order on', async () => {
    const before = stockOf(P.universal.id);
    const { order } = (await place()).body;
    const o = changeStatus(t.ctx, order.orderNumber, { status: 'cancelled', note: 'Duplicate order' });
    assert.equal(o.status, 'cancelled');
    assert.equal(stockOf(P.universal.id), before);

    const upi = (await place({ paymentMethod: 'upi' })).body.order;
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    const paid = changeStatus(t.ctx, upi.orderNumber, { paymentStatus: 'paid' });
    assert.equal(paid.status, 'placed');
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.amountPaid, upi.total);
    assert.ok(t.ctx.mailer.outbox.slice(outbox).some((mail) => mail.to === 'orders@addon.test'));

    assert.throws(() => changeStatus(t.ctx, upi.orderNumber, { amountPaid: upi.total + 1 }), { status: 400 });
    assert.throws(() => changeStatus(t.ctx, 'ADN-000000-ZZZZ', { status: 'confirmed' }), { status: 404 });
    assert.throws(() => changeStatus(t.ctx, upi.orderNumber, { status: 'teleported' }), { status: 400 });
  });
});

describe('notifications', () => {
  test('enquiryReceived sends the customer a copy and tells the store, with the text escaped', async () => {
    const { enquiryReceived } = await import('../src/lib/notify.js');
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    await enquiryReceived(t.ctx, {
      id: 1,
      ticketNumber: 'ADN-T-000042',
      kind: 'complaint',
      name: 'Sunil <b>Rao</b>',
      phone: '9123456780',
      email: 'sunil@example.com',
      subject: 'Wrong colour',
      message: 'The spoiler came in red <script>alert(1)</script>',
      productId: null,
      productName: null,
      orderNumber: 'ADN-261117-ABCD',
      vehicle: '',
      status: 'new',
      adminNote: '',
      createdAt: '2026-11-17T10:00:00Z',
      updatedAt: '2026-11-17T10:00:00Z',
    });
    const sent = t.ctx.mailer.outbox.slice(outbox);
    const customer = sent.find((mail) => mail.to === 'sunil@example.com');
    const store = sent.find((mail) => mail.to === 'orders@addon.test');
    assert.ok(customer && store);
    assert.match(customer.subject, /ADN-T-000042/);
    assert.ok(customer.text.includes('The spoiler came in red'));
    assert.ok(!customer.html.includes('<script>'));
    assert.ok(customer.html.includes('&lt;script&gt;'));
    assert.equal(store.replyTo, 'sunil@example.com');
  });

  test('a failing mailer never fails the order', async () => {
    const { orderPlaced, orderStatusChanged } = await import('../src/lib/notify.js');
    const realSend = t.ctx.mailer.send;
    t.ctx.mailer.send = () => {
      throw new Error('SMTP exploded');
    };
    const errors = console.error;
    console.error = () => {};
    try {
      const res = await place();
      assert.equal(res.status, 201);
      const order = loadOrder(t.ctx, res.body.order.orderNumber);
      await orderPlaced(t.ctx, order);
      await orderStatusChanged(t.ctx, order);
      await orderPlaced(t.ctx, null);
    } finally {
      t.ctx.mailer.send = realSend;
      console.error = errors;
    }
  });
});

// ---------------------------------------------------------------------------
// Fulfilment: delivery, pickup and studio fitting
// ---------------------------------------------------------------------------

describe('pickup and studio orders', () => {
  const NOW = '2026-11-17T04:30:00Z'; // Tuesday 10:00 in India
  const SLOT = { date: '2026-11-19', slot: '11:30' };
  let savedNow;
  before(() => {
    savedNow = t.ctx.now;
    t.ctx.now = () => NOW;
  });
  after(() => {
    t.ctx.now = savedNow;
  });

  const studioBody = (overrides = {}) =>
    orderBody({
      items: [{ productId: P.spoiler.id, variantId: null, qty: 1, fitAtStudio: true }],
      shippingAddress: null,
      fulfilment: 'studio',
      studioSlot: SLOT,
      vehicleId: t.fixtures.vehicles.swiftOld.id,
      registrationNumber: 'MH 12 AB 1234',
      ...overrides,
    });

  test('a studio order: no address, no shipping, fitting charged and taxed, pay at the studio, booking in the diary', async () => {
    const before = stockOf(P.spoiler.id);
    t.ctx.mailer.outbox.length = 0;
    const res = await t.api('/api/orders', { method: 'POST', body: studioBody({ notes: 'Please keep the old spoiler' }) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order, payment } = res.body;
    assert.equal(payment, null);
    assert.equal(order.status, 'placed');
    assert.equal(order.fulfilment, 'studio');
    assert.deepEqual(order.studioSlot, SLOT);
    assert.equal(order.fittingTotal, 999);
    assert.equal(order.shippingFee, 0);
    assert.equal(order.codFee, 0);
    assert.equal(order.subtotal, 3499);
    assert.equal(order.total, 3499 + 999);
    assert.equal(order.estimatedDelivery, null);
    assert.equal(order.vehicle, 'Maruti Suzuki Swift (2018-2024)');
    assert.deepEqual(order.shippingAddress, { name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '' });
    assert.equal(order.items[0].fitAtStudio, true);
    assert.equal(order.items[0].fittingCharge, 999);
    assert.equal(order.items[0].fittingServiceName, 'Spoiler, skirts and body kit fitting');
    assert.equal(order.items[0].lineTotal, 3499);
    assert.ok(Math.abs(order.tax.gst - (4498 * 18) / 118) < 0.02, `${order.tax.gst}`);
    assert.equal(order.tax.isInterState, false);
    assert.match(order.events[0].note, /Pay ₹4,498 at the studio\. Fitting at the studio on Thu, 19 Nov 2026 at 11:30 am\./);
    assert.equal(stockOf(P.spoiler.id), before - 1);

    const booking = t.ctx.db.get('SELECT * FROM bookings WHERE order_number = ?', [order.orderNumber]);
    assert.equal(order.bookingNumber, booking.booking_number);
    assert.equal(booking.date, SLOT.date);
    assert.equal(booking.slot, SLOT.slot);
    assert.equal(booking.status, 'confirmed');
    assert.equal(booking.registration_number, 'MH 12 AB 1234');
    assert.equal(booking.notes, 'Please keep the old spoiler');

    // The buyer's own view and the public lookup carry the same fields.
    const tracked = await t.api(`/api/orders/track?orderNumber=${order.orderNumber}&phone=9123456780`);
    assert.equal(tracked.status, 200);
    assert.equal(tracked.body.fulfilment, 'studio');
    assert.deepEqual(tracked.body.studioSlot, SLOT);

    // Cancelling frees the place in the diary.
    const cancelled = await t.api(`/api/orders/${order.orderNumber}/cancel`, { method: 'POST', body: { token: order.accessToken } });
    assert.equal(cancelled.status, 200);
    assert.equal(t.ctx.db.get('SELECT status FROM bookings WHERE order_number = ?', [order.orderNumber]).status, 'cancelled');
    assert.equal(stockOf(P.spoiler.id), before);
  });

  test('a studio order needs a slot and a car; an unknown car is refused', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: null, vehicleId: undefined }) });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['studioSlot', 'vehicleLabel']);
    const typed = await t.api('/api/orders', { method: 'POST', body: studioBody({ vehicleId: undefined, vehicleLabel: 'Honda City 2019', studioSlot: { date: SLOT.date, slot: '13:00' } }) });
    assert.equal(typed.status, 201, JSON.stringify(typed.body));
    assert.equal(typed.body.order.vehicle, 'Honda City 2019');
    const badSlot = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: 'Thursday', slot: '1pm' } }) });
    assert.equal(badSlot.status, 400);
    assert.ok(badSlot.body.error.fields['studioSlot.date']);
    assert.ok(badSlot.body.error.fields['studioSlot.slot']);
  });

  test('a slot that is full, closed or past is a 409 and nothing is written', async () => {
    const before = stockOf(P.spoiler.id);
    const orders = t.ctx.db.get('SELECT COUNT(*) AS n FROM orders').n;
    const sunday = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: '2026-11-22', slot: '16:00' } }) });
    assert.equal(sunday.status, 409);
    assert.equal(sunday.body.error.code, 'slot_unavailable');
    const past = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: '2026-11-16', slot: '16:00' } }) });
    assert.equal(past.status, 409);
    const full = SLOT.date;
    await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: full, slot: '16:00' } }) });
    await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: full, slot: '16:00' } }) });
    const third = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: full, slot: '16:00' } }) });
    assert.equal(third.status, 409);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM orders').n, orders + 2);
    assert.equal(stockOf(P.spoiler.id), before - 2);
  });

  test('a studio order paid online waits for payment with the booking requested, then confirms it', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: studioBody({ paymentMethod: 'upi', studioSlot: { date: SLOT.date, slot: '14:30' } }) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order, payment } = res.body;
    assert.equal(order.status, 'pending_payment');
    assert.equal(payment.provider, 'upi');
    assert.equal(order.prepaidDiscount, Math.round(3499 * 0.02), 'on the part only');
    assert.equal(order.total, 3499 + 999 - order.prepaidDiscount);
    assert.equal(t.ctx.db.get('SELECT status FROM bookings WHERE order_number = ?', [order.orderNumber]).status, 'requested');
    const confirmed = await t.api('/api/payments/upi/confirm', {
      method: 'POST',
      body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '123456789012' },
    });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(t.ctx.db.get('SELECT status FROM bookings WHERE order_number = ?', [order.orderNumber]).status, 'confirmed');
  });

  test('an unpaid studio order that expires gives its slot back', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: studioBody({ paymentMethod: 'upi', studioSlot: { date: SLOT.date, slot: '17:30' } }) });
    assert.equal(res.status, 201);
    t.ctx.now = () => '2026-11-17T06:00:00Z';
    try {
      assert.ok(expireStaleOrders(t.ctx) >= 1);
    } finally {
      t.ctx.now = () => NOW;
    }
    assert.equal(t.ctx.db.get('SELECT status FROM bookings WHERE order_number = ?', [res.body.order.orderNumber]).status, 'cancelled');
  });

  test('delivering a studio order completes its booking', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: studioBody({ studioSlot: { date: '2026-11-20', slot: '10:00' } }) });
    assert.equal(res.status, 201);
    changeStatus(t.ctx, res.body.order.orderNumber, { status: 'delivered' });
    assert.equal(t.ctx.db.get('SELECT status FROM bookings WHERE order_number = ?', [res.body.order.orderNumber]).status, 'completed');
  });

  test('a pickup order: no address needed, no shipping, no COD fee, paid at the studio', async () => {
    const res = await t.api('/api/orders', {
      method: 'POST',
      body: orderBody({ items: [{ productId: P.spoiler.id, variantId: null, qty: 1 }], shippingAddress: undefined, fulfilment: 'pickup' }),
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order } = res.body;
    assert.equal(order.fulfilment, 'pickup');
    assert.equal(order.studioSlot, null);
    assert.equal(order.bookingNumber, '');
    assert.equal(order.shippingFee, 0);
    assert.equal(order.codFee, 0);
    assert.equal(order.total, 3499);
    assert.equal(order.estimatedDelivery, null);
    assert.match(order.events[0].note, /Pay ₹3,499 at the studio when you collect it\./);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM bookings WHERE order_number = ?', [order.orderNumber]).n, 0);
  });

  test('a pickup order may carry a billing address; a half-filled one is checked', async () => {
    const withAddress = await t.api('/api/orders', { method: 'POST', body: orderBody({ fulfilment: 'pickup' }) });
    assert.equal(withAddress.status, 201);
    assert.equal(withAddress.body.order.shippingAddress.city, 'Bengaluru');
    const blankForm = await t.api('/api/orders', {
      method: 'POST',
      body: orderBody({ fulfilment: 'pickup', shippingAddress: { name: '', phone: '', line1: '', city: '', state: '', pincode: '' } }),
    });
    assert.equal(blankForm.status, 201, 'an empty form counts as no address');
    const half = await t.api('/api/orders', { method: 'POST', body: orderBody({ fulfilment: 'pickup', shippingAddress: { name: 'Ravi', line1: '12 MG Road' } }) });
    assert.equal(half.status, 400);
    assert.ok(half.body.error.fields['shippingAddress.pincode']);
  });

  test('delivery still needs the address, including when the studio is paused', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: orderBody({ shippingAddress: undefined }) });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields), ['shippingAddress']);
    t.ctx.settings.update({ studio: { enabled: false } });
    try {
      const paused = await t.api('/api/orders', { method: 'POST', body: orderBody({ shippingAddress: null, fulfilment: 'pickup' }) });
      assert.equal(paused.status, 400);
      assert.match(paused.body.error.fields.shippingAddress, /paused/);
    } finally {
      t.ctx.settings.update({ studio: { enabled: true } });
    }
  });

  test('a delivery order says so and keeps its delivery estimate', async () => {
    const res = await place();
    assert.equal(res.status, 201);
    assert.equal(res.body.order.fulfilment, 'delivery');
    assert.equal(res.body.order.studioSlot, null);
    assert.equal(res.body.order.fittingTotal, 0);
    assert.ok(res.body.order.estimatedDelivery);
  });
});
