import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { getOrderRow, loadOrder, markPaid } from '../src/lib/orders.js';
import { priceCart } from '../src/lib/pricing.js';
import { getRazorpay, signPayment, signWebhook, verifyPaymentSignature, verifyWebhookSignature } from '../src/lib/razorpay.js';

const KEYS = { keyId: 'rzp_test_KEY123', keySecret: 'test_key_secret', webhookSecret: 'test_webhook_secret' };
const UPI_ID = 'addonauto@okaxis';

let t;
let P;
let created;
let failCreate = false;

before(async () => {
  t = await startTestApp({ config: { razorpay: KEYS } });
  P = t.fixtures.products;
  t.ctx.settings.update({
    payments: { upiId: UPI_ID, upiPayeeName: 'Addon Auto Motive' },
    notifications: { orderEmail: 'orders@addon.test' },
  });
  created = [];
  t.ctx.razorpayClient = {
    orders: {
      async create(params) {
        if (failCreate) throw new Error('gateway down');
        created.push(params);
        return { id: `order_TEST${String(created.length).padStart(4, '0')}`, amount: params.amount, currency: params.currency, status: 'created' };
      },
    },
  };
});
after(() => t.close());

const address = { name: 'Meera Nair', phone: '9123456781', line1: '7 Marine Drive', city: 'Kochi', state: 'Kerala', pincode: '682001' };

function orderBody(overrides = {}) {
  return {
    items: [{ productId: P.universal.id, variantId: null, qty: 1 }],
    contact: { name: 'Meera Nair', email: 'meera@example.com', phone: '9123456781' },
    shippingAddress: address,
    paymentMethod: 'razorpay',
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function place(overrides = {}) {
  const res = await t.newClient()('/api/orders', { method: 'POST', body: orderBody(overrides) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

function verifyBody(order, payment, paymentId = `pay_${randomUUID().slice(0, 12)}`) {
  return {
    orderNumber: order.orderNumber,
    razorpay_order_id: payment.razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signPayment(KEYS.keySecret, payment.razorpayOrderId, paymentId),
  };
}

function webhook(event, { eventId = `evt_${randomUUID()}`, secret = KEYS.webhookSecret } = {}) {
  const raw = JSON.stringify(event);
  return t.api('/api/payments/razorpay/webhook', {
    method: 'POST',
    body: raw,
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': signWebhook(secret, raw),
      'x-razorpay-event-id': eventId,
    },
  });
}

const capturedEvent = (razorpayOrderId, paymentId, amountPaise) => ({
  entity: 'event',
  event: 'payment.captured',
  contains: ['payment'],
  payload: { payment: { entity: { id: paymentId, entity: 'payment', amount: amountPaise, currency: 'INR', status: 'captured', order_id: razorpayOrderId, method: 'upi' } } },
  created_at: 1795000000,
});

const mailsTo = (address, since = 0) => t.ctx.mailer.outbox.slice(since).filter((mail) => mail.to === address);

describe('the Razorpay module', () => {
  test('getRazorpay returns the injected client, the SDK client from config, or null', async () => {
    assert.equal(getRazorpay(t.ctx), t.ctx.razorpayClient);
    const real = getRazorpay({ config: { razorpay: KEYS } });
    assert.equal(typeof real.orders.create, 'function');
    assert.equal(getRazorpay({ config: { razorpay: { keyId: '', keySecret: '' } } }), null);
  });

  test('payment signatures: good, tampered, wrong order id, not hex', () => {
    const signature = signPayment(KEYS.keySecret, 'order_A', 'pay_B');
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_B', signature }), true);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_B', signature: signature.toUpperCase() }), true);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_X', paymentId: 'pay_B', signature }), false);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_C', signature }), false);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_B', signature: `${signature.slice(0, -1)}0` === signature ? `${signature.slice(0, -1)}1` : `${signature.slice(0, -1)}0` }), false);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_B', signature: 'zz' }), false);
    assert.equal(verifyPaymentSignature(t.ctx, { orderId: 'order_A', paymentId: 'pay_B', signature: '' }), false);
    assert.equal(verifyPaymentSignature({ config: { razorpay: {} } }, { orderId: 'order_A', paymentId: 'pay_B', signature }), false);
  });

  test('webhook signatures are over the raw bytes', () => {
    const raw = Buffer.from('{"event":"order.paid", "spacing":"kept"}');
    const signature = signWebhook(KEYS.webhookSecret, raw);
    assert.equal(verifyWebhookSignature(t.ctx, raw, signature), true);
    const reserialised = Buffer.from(JSON.stringify(JSON.parse(raw.toString())));
    assert.equal(verifyWebhookSignature(t.ctx, reserialised, signature), false);
    assert.equal(verifyWebhookSignature(t.ctx, raw, signWebhook(KEYS.keySecret, raw)), false);
  });
});

describe('paying by Razorpay', () => {
  beforeEach(() => {
    failCreate = false;
  });

  test('the order waits for payment and gets one Razorpay order for the amount in paise', async () => {
    const items = [{ productId: P.universal.id, variantId: null, qty: 2 }];
    const priced = priceCart(t.ctx, { items, pincode: address.pincode, paymentMethod: 'razorpay' });
    const before = created.length;
    const { order, payment } = await place({ items });
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.total, priced.total);
    assert.equal(order.tax.isInterState, false);
    assert.equal(payment.provider, 'razorpay');
    assert.equal(payment.purpose, 'full');
    assert.equal(payment.keyId, KEYS.keyId);
    assert.equal(payment.currency, 'INR');
    assert.equal(payment.amountPaise, order.total * 100);
    assert.deepEqual(payment.prefill, { name: 'Meera Nair', email: 'meera@example.com', contact: '+919123456781' });
    assert.equal(created.length, before + 1);
    assert.deepEqual(created.at(-1), { amount: order.total * 100, currency: 'INR', receipt: order.orderNumber, notes: { orderNumber: order.orderNumber } });
    assert.equal(getOrderRow(t.ctx, order.orderNumber).razorpay_order_id, payment.razorpayOrderId);
    // No order-placed email until the money arrives.
    assert.equal(mailsTo('meera@example.com').filter((mail) => mail.subject.includes(order.orderNumber)).length, 0);
  });

  test('verify with a good signature marks it paid and placed, once', async () => {
    const { order, payment } = await place();
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    const body = verifyBody(order, payment);
    const res = await t.api('/api/payments/razorpay/verify', { method: 'POST', body });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'placed');
    assert.equal(res.body.paymentStatus, 'paid');
    assert.equal(res.body.amountPaid, order.total);
    assert.equal(res.body.amountDue, 0);
    assert.equal(res.body.accessToken, order.accessToken);
    assert.equal(getOrderRow(t.ctx, order.orderNumber).razorpay_payment_id, body.razorpay_payment_id);
    assert.equal(res.body.events.length, 2);

    const again = await t.api('/api/payments/razorpay/verify', { method: 'POST', body });
    assert.equal(again.status, 200);
    assert.equal(again.body.events.length, 2);
    assert.equal(again.body.amountPaid, order.total);
    assert.equal(mailsTo('meera@example.com', outbox).length, 1);
    assert.equal(mailsTo('orders@addon.test', outbox).length, 1);
  });

  test('verify refuses a bad signature, a different Razorpay order id and an unknown order', async () => {
    const { order, payment } = await place();
    const good = verifyBody(order, payment);
    const bad = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: { ...good, razorpay_signature: 'a'.repeat(64) } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'payment_failed');

    // Signed correctly, but for another Razorpay order than the one we stored.
    const other = { ...good, razorpay_order_id: 'order_SOMEONEELSE', razorpay_signature: signPayment(KEYS.keySecret, 'order_SOMEONEELSE', good.razorpay_payment_id) };
    const mismatch = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: other });
    assert.equal(mismatch.status, 400);

    const unknown = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: { ...good, orderNumber: 'ADN-000000-ZZZZ' } });
    assert.equal(unknown.status, 404);
    const invalid = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: { orderNumber: order.orderNumber } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'validation_error');

    const row = getOrderRow(t.ctx, order.orderNumber);
    assert.equal(row.status, 'pending_payment');
    assert.equal(row.payment_status, 'pending');
    assert.equal(row.amount_paid, 0);
  });

  test('retry reuses the stored Razorpay order and needs access', async () => {
    const { order, payment } = await place();
    const before = created.length;
    const res = await t.api('/api/payments/razorpay/retry', { method: 'POST', body: { orderNumber: order.orderNumber, token: order.accessToken } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.razorpayOrderId, payment.razorpayOrderId);
    assert.equal(res.body.amountPaise, payment.amountPaise);
    assert.equal(created.length, before);

    const stranger = await t.api('/api/payments/razorpay/retry', { method: 'POST', body: { orderNumber: order.orderNumber } });
    assert.equal(stranger.status, 404);

    await t.api('/api/payments/razorpay/verify', { method: 'POST', body: verifyBody(order, payment) });
    const paid = await t.api('/api/payments/razorpay/retry', { method: 'POST', body: { orderNumber: order.orderNumber, token: order.accessToken } });
    assert.equal(paid.status, 409);
  });

  test('a gateway failure keeps the order; retrying the same checkout key creates the Razorpay order', async () => {
    failCreate = true;
    const body = orderBody();
    const first = await t.api('/api/orders', { method: 'POST', body });
    assert.equal(first.status, 502);
    assert.equal(first.body.error.code, 'payment_unavailable');
    const row = t.ctx.db.get('SELECT * FROM orders WHERE idempotency_key = ?', [body.idempotencyKey]);
    assert.equal(row.status, 'pending_payment');
    assert.equal(row.razorpay_order_id, null);

    failCreate = false;
    const second = await t.api('/api/orders', { method: 'POST', body });
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.equal(second.body.order.orderNumber, row.order_number);
    assert.equal(second.body.payment.provider, 'razorpay');
    assert.equal(getOrderRow(t.ctx, row.order_number).razorpay_order_id, second.body.payment.razorpayOrderId);
  });
});

describe('the Razorpay webhook', () => {
  test('a bad signature is refused', async () => {
    const res = await webhook({ event: 'payment.captured', payload: {} }, { secret: 'wrong-secret' });
    assert.equal(res.status, 400);
    const unsigned = await t.api('/api/payments/razorpay/webhook', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    assert.equal(unsigned.status, 400);
  });

  test('payment.captured marks the order paid; a repeated delivery is ignored', async () => {
    const { order, payment } = await place();
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    const event = capturedEvent(payment.razorpayOrderId, 'pay_WEBHOOK001', payment.amountPaise);
    const res = await webhook(event, { eventId: 'evt_dup_1' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    let current = loadOrder(t.ctx, order.orderNumber);
    assert.equal(current.status, 'placed');
    assert.equal(current.paymentStatus, 'paid');
    assert.equal(current.amountPaid, order.total);
    const events = current.events.length;
    assert.ok(t.ctx.db.get('SELECT 1 AS seen FROM webhook_events WHERE event_id = ?', ['evt_dup_1']));

    const again = await webhook(event, { eventId: 'evt_dup_1' });
    assert.equal(again.status, 200);
    // A different event for the same payment (order.paid after payment.captured) is also harmless.
    const orderPaid = await webhook({
      event: 'order.paid',
      payload: {
        payment: event.payload.payment,
        order: { entity: { id: payment.razorpayOrderId, amount: payment.amountPaise, amount_paid: payment.amountPaise, status: 'paid' } },
      },
    });
    assert.equal(orderPaid.status, 200);
    current = loadOrder(t.ctx, order.orderNumber);
    assert.equal(current.events.length, events);
    assert.equal(current.amountPaid, order.total);
    assert.equal(mailsTo('meera@example.com', outbox).length, 1);

    // The browser's verify arriving after the webhook changes nothing either.
    const verify = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: verifyBody(order, payment, 'pay_WEBHOOK001') });
    assert.equal(verify.status, 200);
    assert.equal(verify.body.events.length, events);
  });

  test('order.paid on its own, unknown orders and other events still answer 200', async () => {
    const { order, payment } = await place();
    const res = await webhook({
      event: 'order.paid',
      payload: {
        payment: { entity: { id: 'pay_ORDERPAID1', amount: payment.amountPaise, order_id: payment.razorpayOrderId, status: 'captured' } },
        order: { entity: { id: payment.razorpayOrderId, amount_paid: payment.amountPaise, status: 'paid' } },
      },
    });
    assert.equal(res.status, 200);
    assert.equal(loadOrder(t.ctx, order.orderNumber).paymentStatus, 'paid');

    assert.equal((await webhook(capturedEvent('order_UNKNOWN', 'pay_X', 10000))).status, 200);
    assert.equal((await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_F', order_id: payment.razorpayOrderId } } } })).status, 200);
    const raw = 'not json';
    const garbage = await t.api('/api/payments/razorpay/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signWebhook(KEYS.webhookSecret, raw), 'x-razorpay-event-id': 'evt_garbage' },
    });
    assert.equal(garbage.status, 200);
  });
});

describe('markPaid', () => {
  test('is idempotent for the same reference and never pays twice', async () => {
    const { order } = await place();
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;
    const first = markPaid(t.ctx, order.orderNumber, { amount: order.total, method: 'razorpay', reference: 'pay_IDEM1' });
    const second = markPaid(t.ctx, order.orderNumber, { amount: order.total, method: 'razorpay', reference: 'pay_IDEM1' });
    const third = markPaid(t.ctx, order.orderNumber, { amount: order.total, method: 'razorpay', reference: 'pay_IDEM2' });
    assert.equal(first.paymentStatus, 'paid');
    assert.equal(third.amountPaid, order.total);
    assert.equal(second.events.length, first.events.length);
    assert.equal(third.events.length, first.events.length);
    assert.equal(mailsTo('meera@example.com', outbox).length, 1);
    assert.throws(() => markPaid(t.ctx, 'ADN-000000-ZZZZ', { amount: 1 }), { status: 404 });
  });

  test('money that arrives after the order expired is recorded and flagged', async () => {
    const { order } = await place();
    t.ctx.db.run("UPDATE orders SET status = 'cancelled' WHERE order_number = ?", [order.orderNumber]);
    const paid = markPaid(t.ctx, order.orderNumber, { amount: order.total, method: 'razorpay', reference: 'pay_LATE1' });
    assert.equal(paid.status, 'cancelled');
    assert.equal(paid.paymentStatus, 'paid');
    assert.match(paid.events.at(-1).note, /refund this payment or revive/);
  });
});

describe('COD with an advance', () => {
  before(() => t.ctx.settings.update({ cod: { advancePercent: 10 } }));
  after(() => t.ctx.settings.update({ cod: { advancePercent: 0 } }));

  test('the advance is taken through Razorpay, the rest is due on delivery', async () => {
    const items = [{ productId: P.universal.id, variantId: null, qty: 1 }];
    const priced = priceCart(t.ctx, { items, pincode: address.pincode, paymentMethod: 'cod' });
    const { order, payment } = await place({ items, paymentMethod: 'cod' });
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.total, priced.total);
    assert.equal(order.codFee, priced.codFee);
    assert.equal(order.advanceAmount, priced.payNow);
    assert.equal(payment.provider, 'razorpay');
    assert.equal(payment.purpose, 'advance');
    assert.equal(payment.amountPaise, order.advanceAmount * 100);
    assert.equal(created.at(-1).amount, order.advanceAmount * 100);

    const res = await t.api('/api/payments/razorpay/verify', { method: 'POST', body: verifyBody(order, payment) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'placed');
    assert.equal(res.body.paymentStatus, 'advance_paid');
    assert.equal(res.body.amountPaid, order.advanceAmount);
    assert.equal(res.body.amountDue, order.total - order.advanceAmount);
    assert.match(res.body.events.at(-1).note, /due on delivery/);
  });
});

describe('direct UPI', () => {
  test('the buyer reports the UTR: placed, payment still pending, awaiting verification', async () => {
    const { order, payment } = await place({ paymentMethod: 'upi' });
    assert.equal(payment.provider, 'upi');
    t.ctx.mailer.outbox.length = 0; // the outbox keeps 50 at most: start empty
    const outbox = 0;

    const badUtr = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '12345' } });
    assert.equal(badUtr.status, 400);
    assert.ok(badUtr.body.error.fields.upiReference);

    const noToken = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: 'wrong', upiReference: '123456789012' } });
    assert.equal(noToken.status, 404);

    const res = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '1234 5678 9012' } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'placed');
    assert.equal(res.body.paymentStatus, 'pending');
    assert.equal(res.body.amountPaid, 0);
    assert.equal(res.body.upiReference, '123456789012');
    const last = res.body.events.at(-1);
    assert.equal(last.actor, 'customer');
    assert.match(last.note, /Awaiting verification/);
    assert.equal(mailsTo('orders@addon.test', outbox).length, 1);

    const again = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '123456789012' } });
    assert.equal(again.status, 200);
    assert.equal(again.body.events.length, res.body.events.length);
    assert.equal(mailsTo('orders@addon.test', outbox).length, 1);

    const different = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '999999999999' } });
    assert.equal(different.status, 409);
  });

  test('a Razorpay order cannot be confirmed by UTR', async () => {
    const { order } = await place();
    const res = await t.api('/api/payments/upi/confirm', { method: 'POST', body: { orderNumber: order.orderNumber, accessToken: order.accessToken, upiReference: '123456789012' } });
    assert.equal(res.status, 409);
  });
});
