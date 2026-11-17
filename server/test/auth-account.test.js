import { CUSTOMER_PASSWORD, startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { loadOrder } from '../src/lib/orders.js';

let t;
before(async () => {
  t = await startTestApp();
});
after(() => t?.close());

let counter = 0;
function uniqueEmail(prefix = 'shopper') {
  counter += 1;
  return `${prefix}${counter}.${crypto.randomBytes(3).toString('hex')}@example.com`;
}

/** Registers a fresh user through the API and returns a client signed in as them. */
async function newUser({ password = 'Garage@2026', phone = '9123456780' } = {}) {
  const client = t.newClient();
  const email = uniqueEmail();
  const res = await client('/api/auth/register', { method: 'POST', body: { name: 'Test Shopper', email, phone, password } });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { client, email, password, id: res.body.user.id };
}

const ADDRESS = {
  label: 'Home',
  name: 'Ravi Kumar',
  phone: '+91 98450 12345',
  line1: '12, 4th Cross, Indiranagar',
  city: 'Bengaluru',
  state: 'karnataka',
  pincode: '560038',
};

function lastMailTo(email) {
  return [...t.ctx.mailer.outbox].reverse().find((message) => message.to === email);
}

function tokenFromMail(message) {
  const match = /reset-password\?token=([A-Za-z0-9_%-]+)/.exec(message.text);
  assert.ok(match, 'the email carries a reset link');
  return decodeURIComponent(match[1]);
}

describe('auth', () => {
  test('register, me, logout, login cycle with cookies', async () => {
    const client = t.newClient();
    const email = uniqueEmail('Cycle');

    const me0 = await client('/api/auth/me');
    assert.equal(me0.status, 200);
    assert.deepEqual(me0.body, { user: null });

    const reg = await client('/api/auth/register', {
      method: 'POST',
      body: { name: '  Meera Iyer ', email: `  ${email.toUpperCase()} `, phone: '098450 12345', password: 'Swift@2018', role: 'admin' },
    });
    assert.equal(reg.status, 201);
    assert.deepEqual(Object.keys(reg.body.user).sort(), ['createdAt', 'email', 'id', 'name', 'phone', 'role']);
    assert.equal(reg.body.user.name, 'Meera Iyer');
    assert.equal(reg.body.user.email, email.toLowerCase());
    assert.equal(reg.body.user.phone, '9845012345');
    assert.equal(reg.body.user.role, 'customer', 'a client-sent role is ignored');
    const cookie = reg.headers.getSetCookie().join('\n');
    assert.match(cookie, /addon_session=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);

    const me1 = await client('/api/auth/me');
    assert.equal(me1.body.user.email, email.toLowerCase());

    const out = await client('/api/auth/logout', { method: 'POST' });
    assert.deepEqual(out.body, { ok: true });
    assert.deepEqual((await client('/api/auth/me')).body, { user: null });
    assert.equal((await client('/api/account/addresses')).status, 401);

    const login = await client('/api/auth/login', { method: 'POST', body: { email: email.toUpperCase(), password: 'Swift@2018' } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.id, reg.body.user.id);
    assert.equal((await client('/api/auth/me')).body.user.id, reg.body.user.id);

    const row = t.ctx.db.get('SELECT password_hash FROM users WHERE id = ?', [reg.body.user.id]);
    assert.notEqual(row.password_hash, 'Swift@2018');
    assert.match(row.password_hash, /^\$2[aby]\$/);
  });

  test('the fixture customer can log in through the real route', async () => {
    const client = t.newClient();
    const res = await client('/api/auth/login', { method: 'POST', body: { email: t.fixtures.customer.email, password: CUSTOMER_PASSWORD } });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, t.fixtures.customer.id);
    assert.equal(res.body.user.password_hash, undefined);
  });

  test('duplicate email is a 409, whatever the case', async () => {
    const email = uniqueEmail();
    const first = await t.newClient()('/api/auth/register', {
      method: 'POST',
      body: { name: 'First', email, phone: '9123456780', password: 'Password123' },
    });
    assert.equal(first.status, 201);
    const second = await t.newClient()('/api/auth/register', {
      method: 'POST',
      body: { name: 'Second', email: email.toUpperCase(), phone: '9123456781', password: 'Password123' },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, 'conflict');
    assert.equal(second.headers.getSetCookie().length, 0);
  });

  test('weak or missing register inputs are 400 with fields', async () => {
    const res = await t.newClient()('/api/auth/register', {
      method: 'POST',
      body: { name: 'A', email: 'not-an-email', phone: '12345', password: 'short' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['email', 'name', 'password', 'phone']);

    const empty = await t.newClient()('/api/auth/register', { method: 'POST' });
    assert.equal(empty.status, 400);
    assert.deepEqual(Object.keys(empty.body.error.fields).sort(), ['email', 'name', 'password', 'phone']);

    const repeated = await t.newClient()('/api/auth/register', {
      method: 'POST',
      body: { name: 'Same Digits', email: uniqueEmail(), phone: '9999999999', password: 'Password123' },
    });
    assert.equal(repeated.status, 400);
    assert.ok(repeated.body.error.fields.phone);
  });

  test('login answers the same 401 for an unknown email and a wrong password', async () => {
    const unknown = await t.newClient()('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'Whatever123' } });
    const wrong = await t.newClient()('/api/auth/login', {
      method: 'POST',
      body: { email: t.fixtures.customer.email, password: 'Wrong-password-1' },
    });
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(unknown.body, wrong.body);
    assert.equal(unknown.headers.getSetCookie().length, 0);

    const missing = await t.newClient()('/api/auth/login', { method: 'POST', body: { email: t.fixtures.customer.email } });
    assert.equal(missing.status, 400);
    assert.ok(missing.body.error.fields.password);
  });

  test('forgot and reset password, end to end', async () => {
    const { email } = await newUser({ password: 'OldPassword1' });
    const before = t.ctx.mailer.outbox.length;

    const unknown = await t.api('/api/auth/forgot-password', { method: 'POST', body: { email: 'ghost@example.com' } });
    assert.deepEqual(unknown.body, { ok: true });
    assert.equal(t.ctx.mailer.outbox.length, before, 'no email for an unknown address');

    const forgot = await t.api('/api/auth/forgot-password', { method: 'POST', body: { email: email.toUpperCase() } });
    assert.equal(forgot.status, 200);
    assert.deepEqual(forgot.body, { ok: true });
    const mail = lastMailTo(email);
    assert.ok(mail, 'a reset email was sent');
    assert.ok(mail.text.includes(`${t.ctx.config.publicUrl}/reset-password?token=`));
    const token = tokenFromMail(mail);

    const row = t.ctx.db.get('SELECT reset_token_hash, reset_token_expires FROM users WHERE email = ?', [email]);
    assert.notEqual(row.reset_token_hash, token, 'only a hash is stored');
    assert.equal(row.reset_token_hash, crypto.createHash('sha256').update(token).digest('hex'));
    const minutes = (Date.parse(row.reset_token_expires) - Date.parse(t.ctx.now())) / 60_000;
    assert.ok(minutes > 59 && minutes <= 60, `expires in 60 minutes, got ${minutes}`);

    const weak = await t.api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'short' } });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.error.fields.password);

    const bad = await t.api('/api/auth/reset-password', { method: 'POST', body: { token: 'not-the-token', password: 'NewPassword1' } });
    assert.equal(bad.status, 400);

    const reset = await t.api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'NewPassword1' } });
    assert.equal(reset.status, 200);
    assert.deepEqual(reset.body, { ok: true });
    const cleared = t.ctx.db.get('SELECT reset_token_hash, reset_token_expires FROM users WHERE email = ?', [email]);
    assert.equal(cleared.reset_token_hash, null);
    assert.equal(cleared.reset_token_expires, null);

    const again = await t.api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'Another123' } });
    assert.equal(again.status, 400, 'the token works once');

    const client = t.newClient();
    assert.equal((await client('/api/auth/login', { method: 'POST', body: { email, password: 'OldPassword1' } })).status, 401);
    assert.equal((await client('/api/auth/login', { method: 'POST', body: { email, password: 'NewPassword1' } })).status, 200);
  });

  test('an expired reset token is refused', async () => {
    const { email } = await newUser();
    const realNow = t.ctx.now;
    try {
      t.ctx.now = () => '2026-11-17T10:00:00Z';
      await t.api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      const token = tokenFromMail(lastMailTo(email));

      t.ctx.now = () => '2026-11-17T11:00:01Z';
      const late = await t.api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'NewPassword1' } });
      assert.equal(late.status, 400);
      assert.equal(late.body.error.code, 'validation_error');

      t.ctx.now = () => '2026-11-17T10:59:00Z';
      const inTime = await t.api('/api/auth/reset-password', { method: 'POST', body: { token, password: 'NewPassword1' } });
      assert.equal(inTime.status, 200);
    } finally {
      t.ctx.now = realNow;
    }
  });

  test('forgot-password validates the email shape', async () => {
    const res = await t.api('/api/auth/forgot-password', { method: 'POST', body: { email: 'nope' } });
    assert.equal(res.status, 400);
  });
});

describe('account', () => {
  test('every account route is 401 when signed out', async () => {
    const client = t.newClient();
    const routes = [
      ['PUT', '/api/account/profile', { name: 'X Y', phone: '9123456780' }],
      ['PUT', '/api/account/password', { currentPassword: 'a', newPassword: 'abcdefgh' }],
      ['GET', '/api/account/orders'],
      ['GET', '/api/account/addresses'],
      ['POST', '/api/account/addresses', ADDRESS],
      ['PUT', '/api/account/addresses/1', ADDRESS],
      ['DELETE', '/api/account/addresses/1'],
      ['GET', '/api/account/wishlist'],
      ['PUT', '/api/account/wishlist', { productIds: [] }],
      ['GET', '/api/account/garage'],
      ['PUT', '/api/account/garage', { vehicles: [] }],
    ];
    for (const [method, path, body] of routes) {
      const res = await client(path, { method, body });
      assert.equal(res.status, 401, `${method} ${path}`);
      assert.equal(res.body.error.code, 'unauthorized');
    }
    const forged = await client('/api/account/addresses', { cookie: 'addon_session=not-a-real-token' });
    assert.equal(forged.status, 401);
  });

  test('profile update', async () => {
    const { client, email } = await newUser();
    const res = await client('/api/account/profile', { method: 'PUT', body: { name: ' Arjun Rao ', phone: '+91-98860-11223', email: 'x@y.z', role: 'admin' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, 'Arjun Rao');
    assert.equal(res.body.user.phone, '9886011223');
    assert.equal(res.body.user.email, email, 'email does not change here');
    assert.equal(res.body.user.role, 'customer');

    const bad = await client('/api/account/profile', { method: 'PUT', body: { name: '', phone: '123' } });
    assert.equal(bad.status, 400);
    assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['name', 'phone']);
  });

  test('password change needs the current password', async () => {
    const { client, email, password } = await newUser();
    const wrong = await client('/api/account/password', { method: 'PUT', body: { currentPassword: 'Nope12345', newPassword: 'Changed123' } });
    assert.equal(wrong.status, 400);
    assert.ok(wrong.body.error.fields.currentPassword);

    const weak = await client('/api/account/password', { method: 'PUT', body: { currentPassword: password, newPassword: 'short' } });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.error.fields.newPassword);

    const ok = await client('/api/account/password', { method: 'PUT', body: { currentPassword: password, newPassword: 'Changed123' } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { ok: true });

    const fresh = t.newClient();
    assert.equal((await fresh('/api/auth/login', { method: 'POST', body: { email, password } })).status, 401);
    assert.equal((await fresh('/api/auth/login', { method: 'POST', body: { email, password: 'Changed123' } })).status, 200);
  });

  test('addresses: create, default switching, update, delete', async () => {
    const { client } = await newUser();
    assert.deepEqual((await client('/api/account/addresses')).body, []);

    const first = await client('/api/account/addresses', { method: 'POST', body: ADDRESS });
    assert.equal(first.status, 201);
    assert.equal(first.body.state, 'Karnataka', 'State normalised');
    assert.equal(first.body.phone, '9845012345');
    assert.equal(first.body.line2, '');
    assert.equal(first.body.isDefault, true, 'the first address becomes the default');

    const second = await client('/api/account/addresses', { method: 'POST', body: { ...ADDRESS, label: 'Work', line1: 'MG Road, 5th floor' } });
    assert.equal(second.body.isDefault, false);

    const third = await client('/api/account/addresses', { method: 'POST', body: { ...ADDRESS, label: 'Parents', state: '27', pincode: '411001', city: 'Pune', isDefault: true } });
    assert.equal(third.body.isDefault, true);
    assert.equal(third.body.state, 'Maharashtra');

    let list = (await client('/api/account/addresses')).body;
    assert.equal(list.length, 3);
    assert.equal(list.filter((a) => a.isDefault).length, 1);
    assert.equal(list[0].id, third.body.id, 'the default comes first');

    const switched = await client(`/api/account/addresses/${second.body.id}`, { method: 'PUT', body: { ...ADDRESS, label: 'Office', isDefault: true } });
    assert.equal(switched.status, 200);
    assert.equal(switched.body.label, 'Office');
    assert.equal(switched.body.isDefault, true);
    list = (await client('/api/account/addresses')).body;
    assert.deepEqual(list.filter((a) => a.isDefault).map((a) => a.id), [second.body.id]);

    const del = await client(`/api/account/addresses/${second.body.id}`, { method: 'DELETE' });
    assert.deepEqual(del.body, { ok: true });
    list = (await client('/api/account/addresses')).body;
    assert.equal(list.length, 2);
    assert.equal(list.filter((a) => a.isDefault).length, 1, 'a default is handed on when the default is deleted');

    assert.equal((await client(`/api/account/addresses/${second.body.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await client('/api/account/addresses/abc', { method: 'DELETE' })).status, 400);
  });

  test('address validation: pincode, State and phone', async () => {
    const { client } = await newUser();
    const res = await client('/api/account/addresses', {
      method: 'POST',
      body: { ...ADDRESS, pincode: '012345', state: 'Atlantis', phone: '555' },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['phone', 'pincode', 'state']);
    const missing = await client('/api/account/addresses', { method: 'POST', body: {} });
    assert.equal(missing.status, 400);
    for (const key of ['name', 'phone', 'line1', 'city', 'state', 'pincode']) assert.ok(missing.body.error.fields[key], key);
  });

  test('a user cannot see or touch another user\'s address', async () => {
    const owner = await newUser();
    const other = await newUser();
    const created = await owner.client('/api/account/addresses', { method: 'POST', body: ADDRESS });
    const id = created.body.id;

    assert.deepEqual((await other.client('/api/account/addresses')).body, []);
    const put = await other.client(`/api/account/addresses/${id}`, { method: 'PUT', body: { ...ADDRESS, name: 'Intruder' } });
    assert.equal(put.status, 404);
    const del = await other.client(`/api/account/addresses/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 404);

    // Making one of mine the default must not clear someone else's default.
    await other.client('/api/account/addresses', { method: 'POST', body: { ...ADDRESS, isDefault: true } });
    const mine = (await owner.client('/api/account/addresses')).body;
    assert.equal(mine.length, 1);
    assert.equal(mine[0].name, 'Ravi Kumar');
    assert.equal(mine[0].isDefault, true);
  });

  test('wishlist replace ignores unknown ids and repeats', async () => {
    const { client } = await newUser();
    const { spoiler, wheel, universal } = t.fixtures.products;
    assert.deepEqual((await client('/api/account/wishlist')).body, { productIds: [] });

    const put = await client('/api/account/wishlist', { method: 'PUT', body: { productIds: [wheel.id, 999999, spoiler.id, wheel.id] } });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body, { productIds: [wheel.id, spoiler.id] });
    assert.deepEqual((await client('/api/account/wishlist')).body, { productIds: [wheel.id, spoiler.id] });

    const replaced = await client('/api/account/wishlist', { method: 'PUT', body: { productIds: [universal.id] } });
    assert.deepEqual(replaced.body, { productIds: [universal.id] });

    const cleared = await client('/api/account/wishlist', { method: 'PUT', body: { productIds: [] } });
    assert.deepEqual(cleared.body, { productIds: [] });

    const bad = await client('/api/account/wishlist', { method: 'PUT', body: { productIds: ['x', -1] } });
    assert.equal(bad.status, 400);
    const missing = await client('/api/account/wishlist', { method: 'PUT', body: {} });
    assert.equal(missing.status, 400);
  });

  test('garage replace ignores unknown vehicles and keeps exactly one active', async () => {
    const { client } = await newUser();
    const { swiftOld, swiftNew, creta } = t.fixtures.vehicles;
    assert.deepEqual((await client('/api/account/garage')).body, []);

    const none = await client('/api/account/garage', {
      method: 'PUT',
      body: { vehicles: [{ vehicleId: swiftOld.id, year: 2019, nickname: 'Daily', isActive: false }, { vehicleId: 424242, year: null, nickname: '', isActive: true }, { vehicleId: creta.id, year: null, nickname: '', isActive: false }] },
    });
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.map((g) => g.vehicleId), [swiftOld.id, creta.id]);
    assert.deepEqual(none.body.map((g) => g.isActive), [true, false], 'the first becomes active when none is');
    assert.equal(none.body[0].year, 2019);
    assert.equal(none.body[0].nickname, 'Daily');
    assert.equal(none.body[0].vehicle.id, swiftOld.id);
    assert.equal(none.body[0].vehicle.label, swiftOld.label);

    const two = await client('/api/account/garage', {
      method: 'PUT',
      body: { vehicles: [{ vehicleId: swiftNew.id, isActive: false }, { vehicleId: creta.id, isActive: true }, { vehicleId: swiftOld.id, isActive: true }] },
    });
    assert.deepEqual(two.body.map((g) => [g.vehicleId, g.isActive]), [
      [swiftNew.id, false],
      [creta.id, true],
      [swiftOld.id, false],
    ]);
    assert.equal(two.body[0].year, null);
    assert.deepEqual((await client('/api/account/garage')).body, two.body);

    const empty = await client('/api/account/garage', { method: 'PUT', body: { vehicles: [] } });
    assert.deepEqual(empty.body, []);

    const bad = await client('/api/account/garage', { method: 'PUT', body: { vehicles: [{ vehicleId: 'swift' }] } });
    assert.equal(bad.status, 400);
  });

  test('orders: only mine, newest first, with items, events and the access token', async () => {
    const { client, id: userId } = await newUser();
    const other = await newUser();
    const { db } = t.ctx;
    const insertOrder = (number, uid, createdAt) => {
      const orderId = db.run(
        `INSERT INTO orders (order_number, access_token, user_id, status, payment_method, customer_name, phone, ship_name, ship_phone,
           ship_line1, ship_city, ship_state, ship_pincode, subtotal, total, created_at, updated_at)
         VALUES (?, ?, ?, 'placed', 'cod', 'Test Shopper', '9123456780', 'Test Shopper', '9123456780', '1 Road', 'Bengaluru', 'Karnataka', '560001', 1299, 1299, ?, ?)`,
        [number, `tok-${number}`, uid, createdAt, createdAt],
      ).lastInsertRowid;
      db.run('INSERT INTO order_items (order_id, product_id, name, price, mrp, qty) VALUES (?, ?, ?, 1299, 1999, 1)', [
        orderId,
        t.fixtures.products.universal.id,
        'Boot Lip Spoiler',
      ]);
      db.run("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, 'placed', 'Order placed', ?)", [orderId, createdAt]);
      return orderId;
    };
    const older = insertOrder(`ADN-TEST-A${userId}`, userId, '2026-11-01T10:00:00Z');
    const newer = insertOrder(`ADN-TEST-B${userId}`, userId, '2026-11-10T10:00:00Z');
    db.run("INSERT INTO order_events (order_id, status, note, created_at) VALUES (?, 'confirmed', '', '2026-11-11T10:00:00Z')", [newer]);
    insertOrder(`ADN-TEST-C${other.id}`, other.id, '2026-11-12T10:00:00Z');
    assert.ok(older);

    const res = await client('/api/account/orders');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((o) => o.orderNumber), [`ADN-TEST-B${userId}`, `ADN-TEST-A${userId}`]);
    const [first, second] = res.body;
    assert.equal(first.accessToken, `tok-ADN-TEST-B${userId}`);
    assert.equal(first.items.length, 1);
    assert.equal(first.items[0].qty, 1);
    assert.equal(first.events.length, 2);
    assert.equal(second.events.length, 1);
    assert.equal(first.total, 1299);
    // The same Order the order page gets, delivery estimate included.
    assert.ok('estimatedDelivery' in first);
    assert.deepEqual(first, loadOrder(t.ctx, `ADN-TEST-B${userId}`, { includeToken: true }));

    assert.deepEqual((await (await newUser()).client('/api/account/orders')).body, []);
  });
});
