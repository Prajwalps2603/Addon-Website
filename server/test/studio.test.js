import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, beforeEach, describe, test } from 'node:test';
import { ADDED_COLUMNS, openDb } from '../src/db/index.js';
import { availableSlots, formatSlot, serviceForProduct, studioDay } from '../src/lib/studio.js';

let t;
let P;
let V;

// Tuesday 17 Nov 2026, 10:00 in India.
const TUESDAY_10AM = '2026-11-17T04:30:00Z';
const TODAY = '2026-11-17';
const WEDNESDAY = '2026-11-18';
const SUNDAY = '2026-11-22';
const MONDAY = '2026-11-23';

before(async () => {
  t = await startTestApp();
  P = t.fixtures.products;
  V = t.fixtures.vehicles;
  t.ctx.settings.update({ notifications: { orderEmail: 'orders@addon.test' } });
});
after(() => t.close());
beforeEach(() => {
  t.ctx.now = () => TUESDAY_10AM;
  t.ctx.db.run('DELETE FROM bookings');
});

const reasons = (date) => Object.fromEntries(availableSlots(t.ctx, date).map((entry) => [entry.slot, entry.reason]));

/** Applies a settings patch for the duration of fn, then puts the touched keys back. */
async function withSettings(patch, fn) {
  const saved = t.ctx.settings.get();
  t.ctx.settings.update(patch);
  try {
    return await fn();
  } finally {
    const restore = {};
    for (const key of Object.keys(patch)) restore[key] = saved[key];
    t.ctx.settings.update(restore);
  }
}

function addBooking(date, slot, extra = {}) {
  const n = t.ctx.db.get('SELECT COUNT(*) AS n FROM bookings').n + 1;
  t.ctx.db.run(
    `INSERT INTO bookings (booking_number, service_id, service_name, date, slot, name, phone, status)
     VALUES (?, 'lighting', 'LED, fog and headlamp fitting', ?, ?, 'Test Car', ?, ?)`,
    [`ADN-B-9${String(n).padStart(5, '0')}`, date, slot, extra.phone ?? `98450${String(n).padStart(5, '0')}`, extra.status ?? 'confirmed'],
  );
}

const bookingBody = (overrides = {}) => ({
  serviceId: 'lighting',
  date: WEDNESDAY,
  slot: '11:30',
  name: 'Meera Nair',
  phone: '9845012345',
  email: 'meera@example.com',
  vehicleId: V.creta.id,
  registrationNumber: 'ka 01 ab 1234',
  notes: 'Fog lamps bought elsewhere',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Slot rules
// ---------------------------------------------------------------------------

describe('slot rules', () => {
  test('a normal day lists every slot with the places left', () => {
    const slots = availableSlots(t.ctx, WEDNESDAY);
    assert.deepEqual(
      slots.map((entry) => entry.slot),
      ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    );
    assert.ok(slots.every((entry) => entry.available && entry.reason === null && entry.left === 2));
    const day = studioDay(t.ctx, WEDNESDAY);
    assert.equal(day.open, true);
    assert.equal(day.message, '');
  });

  test('today: started slots are past, slots within the notice period are refused', () => {
    assert.deepEqual(reasons(TODAY), { '10:00': 'past', '11:30': null, '13:00': null, '14:30': null, '16:00': null, '17:30': null });
    t.ctx.now = () => '2026-11-17T05:15:00Z'; // 10:45 in India: 11:30 is 45 minutes away
    assert.equal(reasons(TODAY)['11:30'], 'notice');
    assert.equal(reasons(TODAY)['13:00'], null);
    t.ctx.now = () => '2026-11-17T05:30:00Z'; // 11:00: exactly the hour's notice is enough
    assert.equal(reasons(TODAY)['11:30'], 'notice');
    t.ctx.now = () => '2026-11-17T04:59:00Z'; // 10:29: 61 minutes
    assert.equal(reasons(TODAY)['11:30'], null);
  });

  test('India time decides the day: 00:15 IST is already tomorrow', () => {
    t.ctx.now = () => '2026-11-17T18:45:00Z'; // 00:15 on 18 Nov in India, still 17 Nov in UTC
    assert.ok(availableSlots(t.ctx, TODAY).every((entry) => entry.reason === 'past'));
    assert.equal(studioDay(t.ctx, TODAY).message, 'That day has passed. Choose today or a later date.');
    assert.ok(availableSlots(t.ctx, WEDNESDAY).every((entry) => entry.available), 'all of the new day is open');
  });

  test('Sunday is a half day', () => {
    assert.deepEqual(reasons(SUNDAY), { '10:00': null, '11:30': null, '13:00': null, '14:30': 'closed', '16:00': 'closed', '17:30': 'closed' });
    assert.equal(studioDay(t.ctx, SUNDAY).message, 'Sunday is a half day: the last slot starts at 1:00 pm.');
  });

  test('closed weekdays and a paused studio close the whole day', async () => {
    await withSettings({ studio: { closedWeekdays: [1] } }, () => {
      assert.ok(availableSlots(t.ctx, MONDAY).every((entry) => entry.reason === 'closed'));
      assert.equal(studioDay(t.ctx, MONDAY).message, 'The studio is closed on Mondays.');
      assert.equal(studioDay(t.ctx, MONDAY).open, false);
    });
    await withSettings({ studio: { enabled: false } }, () => {
      assert.ok(availableSlots(t.ctx, WEDNESDAY).every((entry) => entry.reason === 'closed'));
      assert.match(studioDay(t.ctx, WEDNESDAY).message, /paused/);
    });
  });

  test('bookings open 60 days ahead', () => {
    assert.ok(availableSlots(t.ctx, '2027-01-16').every((entry) => entry.available), 'day 60');
    assert.ok(availableSlots(t.ctx, '2027-01-17').every((entry) => entry.reason === 'closed'), 'day 61');
    assert.match(studioDay(t.ctx, '2027-01-17').message, /Bookings open 60 days ahead\. Choose a date up to Sat, 16 Jan 2027\./);
  });

  test('a slot is full at carsPerSlot active bookings; cancelled ones and no-shows do not count', () => {
    addBooking(WEDNESDAY, '13:00');
    let slot = availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '13:00');
    assert.deepEqual(slot, { slot: '13:00', available: true, reason: null, left: 1 });
    addBooking(WEDNESDAY, '13:00', { status: 'cancelled' });
    addBooking(WEDNESDAY, '13:00', { status: 'no_show' });
    assert.equal(availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '13:00').left, 1);
    addBooking(WEDNESDAY, '13:00', { status: 'requested' });
    slot = availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '13:00');
    assert.deepEqual(slot, { slot: '13:00', available: false, reason: 'full', left: 0 });
    assert.equal(availableSlots(t.ctx, WEDNESDAY, { excludeBookingId: t.ctx.db.get("SELECT id FROM bookings WHERE status = 'requested'").id }).find((entry) => entry.slot === '13:00').left, 1);
  });

  test('a studio order without a booking row also takes a place', () => {
    addBooking(WEDNESDAY, '14:30');
    t.ctx.db.run(
      `INSERT INTO orders (order_number, access_token, payment_method, customer_name, phone, ship_name, ship_phone, ship_line1, ship_city,
         ship_state, ship_pincode, subtotal, total, fulfilment, studio_date, studio_slot, status)
       VALUES ('ADN-261117-ZZZZ', 'x', 'cod', 'A', '9845000000', '', '', '', '', '', '', 100, 100, 'studio', ?, '14:30', 'placed')`,
      [WEDNESDAY],
    );
    try {
      assert.equal(availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '14:30').reason, 'full');
      t.ctx.db.run("UPDATE orders SET status = 'cancelled' WHERE order_number = 'ADN-261117-ZZZZ'");
      assert.equal(availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '14:30').left, 1);
    } finally {
      t.ctx.db.run("DELETE FROM orders WHERE order_number = 'ADN-261117-ZZZZ'");
    }
  });

  test('a day with every slot taken says so', async () => {
    await withSettings({ studio: { carsPerSlot: 1, slots: ['10:00', '11:30'] } }, () => {
      addBooking(WEDNESDAY, '10:00');
      addBooking(WEDNESDAY, '11:30');
      const day = studioDay(t.ctx, WEDNESDAY);
      assert.equal(day.open, false);
      assert.equal(day.message, 'Every slot on this day is taken. Try another day.');
    });
  });

  test('a date that is not a real day is a 400', () => {
    assert.throws(() => availableSlots(t.ctx, '2026-02-30'), (err) => err.status === 400);
    assert.throws(() => availableSlots(t.ctx, '17-11-2026'), (err) => err.status === 400);
  });

  test('slot times read as clock times', () => {
    assert.equal(formatSlot('10:00'), '10:00 am');
    assert.equal(formatSlot('13:00'), '1:00 pm');
    assert.equal(formatSlot('12:30'), '12:30 pm');
  });

  test('serviceForProduct finds the service by the part subcategory', () => {
    const spoiler = t.ctx.db.get('SELECT * FROM v_products WHERE id = ?', [P.spoiler.id]);
    const wheel = t.ctx.db.get('SELECT * FROM v_products WHERE id = ?', [P.wheel.id]);
    assert.equal(serviceForProduct(t.ctx, spoiler).id, 'body-kit');
    assert.equal(serviceForProduct(t.ctx, wheel).id, 'wheels');
    assert.equal(serviceForProduct(t.ctx, { category_slug: 'detailing' }), null);
    assert.equal(serviceForProduct(t.ctx, null), null);
  });
});

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

describe('studio routes', () => {
  test('GET /api/studio/slots returns the StudioDay', async () => {
    const res = await t.api(`/api/studio/slots?date=${SUNDAY}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['date', 'message', 'open', 'slots']);
    assert.deepEqual(Object.keys(res.body.slots[0]).sort(), ['available', 'left', 'reason', 'slot']);
    assert.equal(res.body.slots.filter((slot) => slot.available).length, 3);
    const bad = await t.api('/api/studio/slots?date=tomorrow');
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.date);
    assert.equal((await t.api('/api/studio/slots')).status, 400);
  });

  test('GET /api/studio/calendar returns a run of days from today', async () => {
    const res = await t.api('/api/studio/calendar?days=7');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((day) => day.date),
      ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'],
    );
    assert.equal((await t.api('/api/studio/calendar?days=100')).status, 400);
  });

  test('GET /api/studio/services lists the services', async () => {
    const res = await t.api('/api/studio/services');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 8);
    assert.deepEqual(Object.keys(res.body[0]).sort(), ['blurb', 'charge', 'id', 'minutes', 'name', 'subcategorySlugs']);
    assert.deepEqual(res.body[0], { ...res.body[0], id: 'stereo-install', charge: 799, minutes: 90 });
  });

  test('POST /api/studio/bookings books a service, numbers it in sequence and emails both sides', async () => {
    t.ctx.mailer.outbox.length = 0;
    const res = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const booking = res.body;
    assert.equal(booking.bookingNumber, 'ADN-B-000001');
    assert.equal(booking.status, 'requested');
    assert.equal(booking.serviceId, 'lighting');
    assert.equal(booking.serviceName, 'LED, fog and headlamp fitting');
    assert.equal(booking.serviceCharge, 499);
    assert.equal(booking.serviceMinutes, 60);
    assert.equal(booking.vehicle, V.creta.label);
    assert.equal(booking.vehicleId, V.creta.id);
    assert.equal(booking.registrationNumber, 'KA 01 AB 1234');
    assert.equal(booking.orderNumber, '');
    assert.ok(!('adminNote' in booking));
    const second = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ phone: '9845099999', vehicleId: undefined, vehicleLabel: 'Tata Nexon' }) });
    assert.equal(second.status, 201);
    assert.equal(second.body.bookingNumber, 'ADN-B-000002');
    assert.equal(second.body.vehicle, 'Tata Nexon');

    const customer = t.ctx.mailer.outbox.find((mail) => mail.to === 'meera@example.com');
    const store = t.ctx.mailer.outbox.find((mail) => mail.to === 'orders@addon.test' && mail.subject.includes('ADN-B-000001'));
    assert.ok(customer, 'customer copy');
    assert.ok(store, 'store note');
    assert.match(customer.subject, /ADN-B-000001: Wed, 18 Nov 2026, 11:30 am/);
    assert.ok(customer.text.includes('+91 89211 68071'), 'the store phone comes from settings');
    assert.ok(store.text.includes('9845012345'));
    assert.ok(!customer.text.includes('!'));
  });

  test('booking validation names the fields', async () => {
    const res = await t.api('/api/studio/bookings', {
      method: 'POST',
      body: { serviceId: '', date: '2026-13-01', slot: '9am', name: 'M', phone: '123', email: 'nope', registrationNumber: 'KA@01' },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['date', 'email', 'name', 'phone', 'registrationNumber', 'serviceId', 'slot']);
    const noCar = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ vehicleId: undefined, vehicleLabel: '  ' }) });
    assert.equal(noCar.status, 400);
    assert.deepEqual(Object.keys(noCar.body.error.fields), ['vehicleLabel']);
    const unknownCar = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ vehicleId: 99999 }) });
    assert.equal(unknownCar.status, 400);
    assert.ok(unknownCar.body.error.fields.vehicleId);
    const unknown = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ serviceId: 'teleport' }) });
    assert.equal(unknown.status, 400);
    assert.ok(unknown.body.error.fields.serviceId);
    const offList = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ slot: '12:00' }) });
    assert.equal(offList.status, 400);
    assert.ok(offList.body.error.fields.slot);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM bookings').n, 0);
  });

  test('closed, past, too-soon and full slots are refused with 409 slot_unavailable', async () => {
    const sundayLate = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ date: SUNDAY, slot: '16:00' }) });
    assert.equal(sundayLate.status, 409);
    assert.equal(sundayLate.body.error.code, 'slot_unavailable');
    const past = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ date: TODAY, slot: '10:00' }) });
    assert.equal(past.status, 409);
    t.ctx.now = () => '2026-11-17T05:15:00Z';
    const soon = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody({ date: TODAY, slot: '11:30' }) });
    assert.equal(soon.status, 409);
    assert.match(soon.body.error.message, /too soon/);
    addBooking(WEDNESDAY, '11:30');
    addBooking(WEDNESDAY, '11:30');
    const full = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody() });
    assert.equal(full.status, 409);
    assert.equal(full.body.error.code, 'slot_unavailable');
  });

  test('the same phone cannot book the same slot twice', async () => {
    assert.equal((await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody() })).status, 201);
    const again = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody() });
    assert.equal(again.status, 409);
    assert.equal(again.body.error.code, 'duplicate_booking');
    assert.match(again.body.error.message, /ADN-B-000001/);
  });

  test('two cars racing for the last place: one gets it, the other a 409', async () => {
    addBooking(WEDNESDAY, '16:00');
    const results = await Promise.all(
      ['9845011001', '9845011002', '9845011003'].map((phone) => t.newClient()('/api/studio/bookings', { method: 'POST', body: bookingBody({ slot: '16:00', phone }) })),
    );
    assert.deepEqual(results.map((res) => res.status).sort(), [201, 409, 409]);
    assert.equal(t.ctx.db.get("SELECT COUNT(*) AS n FROM bookings WHERE slot = '16:00' AND date = ?", [WEDNESDAY]).n, 2);
  });

  test('GET /api/studio/bookings/:number needs the phone it was booked with', async () => {
    const { body } = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody() });
    const found = await t.api(`/api/studio/bookings/${body.bookingNumber}?phone=+91%2098450%2012345`);
    assert.equal(found.status, 200);
    assert.equal(found.body.bookingNumber, body.bookingNumber);
    const lower = await t.api(`/api/studio/bookings/${body.bookingNumber.toLowerCase()}?phone=9845012345`);
    assert.equal(lower.status, 200);
    assert.equal((await t.api(`/api/studio/bookings/${body.bookingNumber}?phone=9845099999`)).status, 404);
    assert.equal((await t.api('/api/studio/bookings/ADN-B-999999?phone=9845012345')).status, 404);
    assert.equal((await t.api(`/api/studio/bookings/${body.bookingNumber}`)).status, 400);
  });
});

// ---------------------------------------------------------------------------
// Admin diary
// ---------------------------------------------------------------------------

describe('admin bookings', () => {
  async function book(overrides) {
    const res = await t.api('/api/studio/bookings', { method: 'POST', body: bookingBody(overrides) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body;
  }

  test('admin only', async () => {
    assert.equal((await t.api('/api/admin/bookings')).status, 401);
    assert.equal((await t.asCustomer()('/api/admin/bookings')).status, 403);
  });

  test('the list starts today, sorts by day and slot, and filters by date range, status and search', async () => {
    const admin = t.asAdmin();
    addBooking('2026-11-10', '10:00'); // last week
    await book({ date: '2026-11-20', slot: '10:00', phone: '9845020001', name: 'Later Customer' });
    await book({ date: WEDNESDAY, slot: '14:30', phone: '9845020002' });
    await book({ date: WEDNESDAY, slot: '10:00', phone: '9845020003', vehicleId: undefined, vehicleLabel: 'Kia Sonet' });

    const list = await admin('/api/admin/bookings');
    assert.equal(list.status, 200);
    assert.equal(list.body.total, 3, 'last week is left out by default');
    assert.deepEqual(
      list.body.items.map((item) => `${item.date} ${item.slot}`),
      [`${WEDNESDAY} 10:00`, `${WEDNESDAY} 14:30`, '2026-11-20 10:00'],
    );
    assert.deepEqual(Object.keys(list.body.items[0]).sort(), [
      'adminNote', 'bookingNumber', 'createdAt', 'date', 'email', 'id', 'isDemo', 'name', 'notes', 'orderNumber', 'phone',
      'registrationNumber', 'serviceCharge', 'serviceId', 'serviceMinutes', 'serviceName', 'slot', 'status', 'updatedAt', 'vehicle', 'vehicleId',
    ]);

    assert.equal((await admin('/api/admin/bookings?from=2026-11-01&to=2026-11-18')).body.total, 3);
    assert.equal((await admin('/api/admin/bookings?to=2026-11-12')).body.total, 1, 'only to: from the start');
    assert.equal((await admin('/api/admin/bookings?status=confirmed')).body.total, 0);
    assert.equal((await admin('/api/admin/bookings?q=sonet')).body.total, 1);
    assert.equal((await admin('/api/admin/bookings?q=20001')).body.total, 1, 'by phone digits');
    assert.equal((await admin('/api/admin/bookings?q=Later')).body.items[0].name, 'Later Customer');
    assert.equal((await admin('/api/admin/bookings?q=100%25')).body.total, 0, 'LIKE wildcards are literal');
    assert.equal((await admin('/api/admin/bookings?status=lost')).status, 400);
  });

  test('confirming, noting and cancelling a booking', async () => {
    const admin = t.asAdmin();
    const booking = await book();
    t.ctx.mailer.outbox.length = 0;
    const confirmed = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { status: 'confirmed', adminNote: 'Called, coming at 11:15' } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'confirmed');
    assert.equal(confirmed.body.adminNote, 'Called, coming at 11:15');
    assert.ok(t.ctx.mailer.outbox.some((mail) => mail.to === 'meera@example.com' && /confirmed/.test(mail.subject)));
    assert.equal((await t.api(`/api/studio/bookings/${booking.bookingNumber}?phone=9845012345`)).body.adminNote, undefined, 'never shown to the customer');

    const cancelled = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { status: 'cancelled' } });
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '11:30').left, 2, 'the place is free again');
    assert.equal((await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { slot: '13:00' } })).status, 400, 'reopen before moving');
    assert.equal((await admin('/api/admin/bookings/ADN-B-123456', { method: 'PUT', body: { status: 'confirmed' } })).status, 404);
    assert.equal((await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { colour: 'red' } })).status, 400);
  });

  test('moving checks the new slot; reopening checks the old one', async () => {
    const admin = t.asAdmin();
    const booking = await book();
    addBooking(WEDNESDAY, '13:00');
    addBooking(WEDNESDAY, '13:00');
    const toFull = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { slot: '13:00' } });
    assert.equal(toFull.status, 409);
    assert.equal(toFull.body.error.code, 'slot_unavailable');

    t.ctx.mailer.outbox.length = 0;
    const moved = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { date: '2026-11-19', slot: '14:30' } });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.date, '2026-11-19');
    assert.equal(moved.body.slot, '14:30');
    assert.ok(t.ctx.mailer.outbox.some((mail) => mail.to === 'meera@example.com' && /moved/.test(mail.subject)));
    // Moving within its own slot does not count the booking against itself.
    assert.equal((await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { date: '2026-11-19', slot: '14:30', status: 'confirmed' } })).status, 200);

    await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { status: 'cancelled' } });
    addBooking('2026-11-19', '14:30');
    addBooking('2026-11-19', '14:30');
    const reopen = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { status: 'requested' } });
    assert.equal(reopen.status, 409, 'its old slot has filled up meanwhile');
  });

  test('a booking can be marked done after its time has passed', async () => {
    const admin = t.asAdmin();
    const booking = await book({ date: TODAY, slot: '13:00' });
    t.ctx.now = () => '2026-11-17T12:00:00Z'; // 17:30 in India
    const done = await admin(`/api/admin/bookings/${booking.bookingNumber}`, { method: 'PUT', body: { status: 'completed' } });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.status, 'completed');
  });
});

// ---------------------------------------------------------------------------
// Studio orders and the diary
// ---------------------------------------------------------------------------

describe('studio orders in the diary', () => {
  const studioOrder = (overrides = {}) => ({
    items: [{ productId: P.universal.id, variantId: null, qty: 1, fitAtStudio: true }],
    contact: { name: 'Arjun Rao', email: 'arjun@example.com', phone: '9876501234' },
    fulfilment: 'studio',
    studioSlot: { date: WEDNESDAY, slot: '17:30' },
    vehicleId: V.swiftOld.id,
    registrationNumber: 'KA05MN4321',
    paymentMethod: 'cod',
    idempotencyKey: randomUUID(),
    ...overrides,
  });

  test('a studio order writes a linked booking, and moving it in the diary moves the order', async () => {
    const res = await t.api('/api/orders', { method: 'POST', body: studioOrder() });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { order } = res.body;
    assert.match(order.bookingNumber, /^ADN-B-\d{6}$/);
    const booking = t.ctx.db.get('SELECT * FROM bookings WHERE booking_number = ?', [order.bookingNumber]);
    assert.equal(booking.order_number, order.orderNumber);
    assert.equal(booking.status, 'confirmed');
    assert.equal(booking.service_charge, 999);
    assert.equal(booking.registration_number, 'KA05MN4321');
    assert.match(booking.service_name, /Spoiler, skirts and body kit fitting/);
    assert.equal(availableSlots(t.ctx, WEDNESDAY).find((entry) => entry.slot === '17:30').left, 1, 'counted once, not twice');

    const moved = await t.asAdmin()(`/api/admin/bookings/${order.bookingNumber}`, { method: 'PUT', body: { slot: '16:00' } });
    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    const after = t.ctx.db.get('SELECT studio_date, studio_slot FROM orders WHERE order_number = ?', [order.orderNumber]);
    assert.deepEqual(after, { studio_date: WEDNESDAY, studio_slot: '16:00' });
    const view = await t.asAdmin()(`/api/admin/orders/${order.orderNumber}`);
    if (view.status === 200) {
      assert.deepEqual(view.body.studioSlot, { date: WEDNESDAY, slot: '16:00' });
      assert.ok(view.body.events.some((event) => /moved to Wed, 18 Nov 2026 at 4:00 pm/.test(event.note)));
    }
  });

  test('two studio orders racing for the last place: one is placed, the other gets 409 and keeps the stock', async () => {
    addBooking(WEDNESDAY, '10:00');
    const stockBefore = t.ctx.db.get('SELECT stock FROM products WHERE id = ?', [P.universal.id]).stock;
    const results = await Promise.all([
      t.newClient()('/api/orders', { method: 'POST', body: studioOrder({ studioSlot: { date: WEDNESDAY, slot: '10:00' } }) }),
      t.newClient()('/api/orders', { method: 'POST', body: studioOrder({ studioSlot: { date: WEDNESDAY, slot: '10:00' }, contact: { name: 'Second Car', email: '', phone: '9876501299' } }) }),
    ]);
    assert.deepEqual(results.map((res) => res.status).sort(), [201, 409]);
    const loser = results.find((res) => res.status === 409);
    assert.equal(loser.body.error.code, 'slot_unavailable');
    assert.equal(t.ctx.db.get('SELECT stock FROM products WHERE id = ?', [P.universal.id]).stock, stockBefore - 1);
  });
});

// ---------------------------------------------------------------------------
// Upgrading a database made before studio fitting
// ---------------------------------------------------------------------------

describe('migration', () => {
  test('an old database gains the new columns and the bookings table, keeps its rows, and can be opened again', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addon-migrate-'));
    const file = path.join(dir, 'old.db');
    const old = new DatabaseSync(file);
    // The orders and order_items tables as the first release created them.
    old.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT NOT NULL UNIQUE, invoice_number TEXT NOT NULL DEFAULT '',
        access_token TEXT NOT NULL, idempotency_key TEXT UNIQUE, user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'placed', payment_method TEXT NOT NULL, payment_status TEXT NOT NULL DEFAULT 'pending',
        razorpay_order_id TEXT, razorpay_payment_id TEXT, upi_reference TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL,
        ship_name TEXT NOT NULL, ship_phone TEXT NOT NULL, ship_line1 TEXT NOT NULL, ship_line2 TEXT NOT NULL DEFAULT '',
        ship_landmark TEXT NOT NULL DEFAULT '', ship_city TEXT NOT NULL, ship_state TEXT NOT NULL, ship_pincode TEXT NOT NULL,
        gstin TEXT NOT NULL DEFAULT '', vehicle TEXT NOT NULL DEFAULT '', subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0,
        coupon_code TEXT NOT NULL DEFAULT '', prepaid_discount INTEGER NOT NULL DEFAULT 0, shipping_fee INTEGER NOT NULL DEFAULT 0,
        cod_fee INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, advance_amount INTEGER NOT NULL DEFAULT 0,
        amount_paid INTEGER NOT NULL DEFAULT 0, quote_token TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        tracking_carrier TEXT NOT NULL DEFAULT '', tracking_number TEXT NOT NULL DEFAULT '', tracking_url TEXT NOT NULL DEFAULT '',
        pack_photo TEXT NOT NULL DEFAULT '', is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
      );
      CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER,
        variant_id INTEGER, slug TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, variant_name TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL, mrp INTEGER NOT NULL,
        qty INTEGER NOT NULL CHECK (qty > 0), gst_rate INTEGER NOT NULL DEFAULT 18, hsn_code TEXT NOT NULL DEFAULT '', custom TEXT
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')));
      INSERT INTO settings (key, value) VALUES ('storeName', '"My Shop"');
      INSERT INTO orders (order_number, access_token, payment_method, customer_name, phone, ship_name, ship_phone, ship_line1, ship_city, ship_state, ship_pincode, subtotal, total)
        VALUES ('ADN-260101-AAAA', 'tok', 'cod', 'Old Buyer', '9876543210', 'Old Buyer', '9876543210', '1 Road', 'Pune', 'Maharashtra', '411001', 999, 1048);
      INSERT INTO order_items (order_id, name, price, mrp, qty) VALUES (1, 'Old Part', 999, 1299, 1);
    `);
    old.close();

    let db;
    try {
      db = openDb(file);
      const columns = (table) => new Set(db.all(`PRAGMA table_info(${table})`).map((row) => row.name));
      for (const [table, column] of ADDED_COLUMNS) assert.ok(columns(table).has(column), `${table}.${column}`);
      const order = db.get('SELECT * FROM orders WHERE order_number = ?', ['ADN-260101-AAAA']);
      assert.equal(order.total, 1048, 'the old row is kept');
      assert.equal(order.fulfilment, 'delivery');
      assert.equal(order.studio_date, '');
      assert.equal(order.fitting_total, 0);
      assert.equal(db.get('SELECT fit_at_studio, fitting_charge, fitting_service FROM order_items').fitting_service, '');
      assert.equal(db.get("SELECT value FROM settings WHERE key = 'storeName'").value, '"My Shop"', 'saved settings survive');
      assert.ok(db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bookings'"));
      assert.ok(db.get("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_studio'"));
      assert.throws(() => db.run("UPDATE orders SET fulfilment = 'teleport'"), /CHECK/);
      db.close();
      db = openDb(file); // a second start changes nothing
      assert.equal(db.get('SELECT COUNT(*) AS n FROM orders').n, 1);
    } finally {
      db?.close();
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });
});
