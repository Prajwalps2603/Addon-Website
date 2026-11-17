import { ADMIN_PASSWORD, startTestApp } from './helpers.js';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import * as z from 'zod';

import { errorHandler } from '../src/app.js';
import { DEFAULT_ADMIN_PASSWORD, loadConfig } from '../src/config.js';
import { openDb, toIso } from '../src/db/index.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  hashPassword,
  optionalAuth,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSession,
  verifyPassword,
} from '../src/lib/auth.js';
import { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } from '../src/lib/errors.js';
import { financialYear, invoiceNumber, orderNumber, randomToken, slugify, ticketNumber, uniqueSlug } from '../src/lib/ids.js';
import { STATES, findState, isValidGstin, isValidPincode, normalizePhone, stateCode, stateFromPincode } from '../src/lib/india.js';
import { applyDrop, formatINR, isInterState, percentOff, taxBreakdown, taxByRate } from '../src/lib/money.js';
import { createLimiter, limiters } from '../src/lib/rateLimit.js';
import { DEFAULT_SETTINGS } from '../src/lib/settings.js';
import { imageUpload, saveImages } from '../src/lib/uploads.js';
import {
  addressSchema,
  emailSchema,
  gstinSchema,
  idParam,
  paginated,
  pagination,
  paginationOf,
  parse,
  passwordSchema,
  phoneSchema,
  pincodeSchema,
} from '../src/lib/validate.js';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A small Express app wired like the real one (context, cookies, JSON, the shared error handler)
// so helpers can be exercised through routes that belong to this test alone.
async function startMiniApp(ctx, register) {
  const app = express();
  app.locals.ctx = ctx;
  app.use(cookieParser());
  app.use(express.json());
  register(app);
  app.use(errorHandler);
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve(listening)));
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  async function call(pathname, { method = 'GET', body, cookie } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let payload = body;
    if (body !== undefined && !(body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(url + pathname, { method, headers, body: payload });
    const text = await response.text();
    return {
      status: response.status,
      body: (response.headers.get('content-type') ?? '').includes('json') ? JSON.parse(text) : text,
      setCookie: response.headers.getSetCookie(),
    };
  }

  async function close() {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }

  return { url, call, close };
}

function insertOrder(ctx, orderNo, invoiceNo = '') {
  return ctx.db.run(
    `INSERT INTO orders (order_number, invoice_number, access_token, payment_method, customer_name, phone,
       ship_name, ship_phone, ship_line1, ship_city, ship_state, ship_pincode, subtotal, total)
     VALUES (?, ?, 'token', 'cod', 'Test Buyer', '9876543210', 'Test Buyer', '9876543210', '1 Test Street', 'Pune', 'Maharashtra', '411001', 1000, 1000)`,
    [orderNo, invoiceNo],
  ).lastInsertRowid;
}

let t;
before(async () => {
  t = await startTestApp();
});
after(async () => {
  await t.close();
});

describe('config', () => {
  test('development works with nothing set, with paths inside the server folder', () => {
    const config = loadConfig({});
    assert.equal(config.env, 'development');
    assert.equal(config.isProd, false);
    assert.equal(config.port, 4000);
    assert.ok(config.jwtSecret.length >= 32);
    assert.equal(config.dbPath, path.join(SERVER_DIR, 'data', 'addon.db'));
    assert.equal(config.uploadsDir, path.join(SERVER_DIR, 'uploads'));
    assert.equal(config.clientDist, path.resolve(SERVER_DIR, '..', 'client', 'dist'));
    assert.equal(config.publicUrl, 'http://localhost:5173');
    assert.deepEqual(config.razorpay, { keyId: '', keySecret: '', webhookSecret: '' });
    assert.equal(config.smtp.host, '');
    assert.equal(config.admin.password, DEFAULT_ADMIN_PASSWORD);
  });

  test('reads every variable and resolves a relative DB_PATH against the server folder', () => {
    const config = loadConfig({
      PORT: '4100',
      JWT_SECRET: 'a-real-secret',
      DB_PATH: 'data/other.db',
      PUBLIC_URL: 'https://addon.example/',
      ADMIN_EMAIL: 'Owner@Addon.Example',
      ADMIN_PASSWORD: 'Str0ng!pass',
      RAZORPAY_KEY_ID: 'rzp_test_1',
      RAZORPAY_KEY_SECRET: 'secret',
      RAZORPAY_WEBHOOK_SECRET: 'hook',
      SMTP_HOST: 'smtp.example',
      SMTP_PORT: '465',
      SMTP_USER: 'mailer',
      SMTP_PASS: 'pw',
      MAIL_FROM: 'Addon <orders@addon.example>',
    });
    assert.equal(config.port, 4100);
    assert.equal(config.jwtSecret, 'a-real-secret');
    assert.equal(config.dbPath, path.join(SERVER_DIR, 'data', 'other.db'));
    assert.equal(config.publicUrl, 'https://addon.example');
    assert.deepEqual(config.admin, { email: 'owner@addon.example', password: 'Str0ng!pass' });
    assert.deepEqual(config.razorpay, { keyId: 'rzp_test_1', keySecret: 'secret', webhookSecret: 'hook' });
    assert.deepEqual(config.smtp, {
      host: 'smtp.example',
      port: 465,
      secure: true,
      user: 'mailer',
      pass: 'pw',
      from: 'Addon <orders@addon.example>',
    });
    assert.equal(loadConfig({ DB_PATH: ':memory:' }).dbPath, ':memory:');
  });

  test('production refuses a missing JWT secret or the default admin password', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production', ADMIN_PASSWORD: 'Str0ng!pass' }), /JWT_SECRET/);
    assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40) }), /ADMIN_PASSWORD/);
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD }),
      /ADMIN_PASSWORD/,
    );
    const config = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), ADMIN_PASSWORD: 'Str0ng!pass' });
    assert.equal(config.isProd, true);
  });
});

describe('db wrapper', () => {
  let db;
  before(() => {
    db = openDb(':memory:');
    db.exec('CREATE TABLE scratch (id INTEGER PRIMARY KEY, label TEXT, flag INTEGER, amount INTEGER, at TEXT, data TEXT)');
  });
  after(() => db.close());

  test('applies the schema, including the products view', () => {
    const names = db.all("SELECT name FROM sqlite_master WHERE type IN ('table', 'view')").map((row) => row.name);
    for (const name of ['settings', 'users', 'products', 'orders', 'order_items', 'v_products']) {
      assert.ok(names.includes(name), `${name} should exist`);
    }
  });

  test('binds booleans, undefined, dates, whole numbers and objects', () => {
    const when = new Date('2026-11-17T09:30:45.678Z');
    const { changes, lastInsertRowid } = db.run('INSERT INTO scratch (label, flag, amount, at, data) VALUES (?, ?, ?, ?, ?)', [
      560001,
      true,
      undefined,
      when,
      { tags: ['a', 'b'] },
    ]);
    assert.equal(changes, 1);
    assert.equal(typeof lastInsertRowid, 'number');

    const row = db.get('SELECT * FROM scratch WHERE id = ?', [lastInsertRowid]);
    assert.deepStrictEqual(row, {
      id: lastInsertRowid,
      label: '560001',
      flag: 1,
      amount: null,
      at: '2026-11-17T09:30:45Z',
      data: '{"tags":["a","b"]}',
    });
    assert.equal(db.get('SELECT ? AS flag', [false]).flag, 0);
    assert.equal(db.get("SELECT 'ADN-' || ? AS code", [7]).code, 'ADN-7');
    assert.equal(db.get('SELECT ? AS half', [2.5]).half, 2.5);
    assert.equal(db.get('SELECT ? AS big', [12345678901234n]).big, 12345678901234);
    assert.throws(() => db.get('SELECT ? AS bad', [Number.NaN]), TypeError);
  });

  test('takes named parameters, a single bare value, or none', () => {
    db.run('INSERT INTO scratch (label, flag, amount) VALUES (:label, :flag, :amount)', { label: 'named', flag: false, amount: 250 });
    assert.deepEqual(db.get('SELECT label, flag, amount FROM scratch WHERE label = :label', { label: 'named' }), {
      label: 'named',
      flag: 0,
      amount: 250,
    });
    assert.equal(db.get('SELECT label FROM scratch WHERE label = ?', 'named').label, 'named');
    assert.ok(db.all('SELECT * FROM scratch').length >= 2);
    assert.equal(db.get('SELECT * FROM scratch WHERE label = ?', ['nobody']), undefined);
    assert.deepEqual(db.all('SELECT * FROM scratch WHERE label = ?', ['nobody']), []);
    assert.throws(() => db.run('INSERT INTO scratch (label) VALUES (:label)', { label: 'x', extra: 1 }), /Unknown named parameter/);
  });

  test('tx commits on return and rolls back on throw', () => {
    const result = db.tx(() => {
      db.run("INSERT INTO scratch (label) VALUES ('kept')");
      return 'done';
    });
    assert.equal(result, 'done');
    assert.equal(db.get("SELECT COUNT(*) AS n FROM scratch WHERE label = 'kept'").n, 1);

    assert.throws(
      () =>
        db.tx(() => {
          db.run("INSERT INTO scratch (label) VALUES ('lost')");
          throw new Error('stop');
        }),
      /stop/,
    );
    assert.equal(db.get("SELECT COUNT(*) AS n FROM scratch WHERE label = 'lost'").n, 0);
    assert.equal(db.inTransaction, false);
  });

  test('nested tx: a failed inner block undoes only itself', () => {
    db.tx(() => {
      db.run("INSERT INTO scratch (label) VALUES ('outer')");
      assert.throws(
        () =>
          db.tx(() => {
            db.run("INSERT INTO scratch (label) VALUES ('inner-lost')");
            throw new Error('inner');
          }),
        /inner/,
      );
      db.tx(() => {
        db.run("INSERT INTO scratch (label) VALUES ('inner-kept')");
      });
    });
    const labels = db.all("SELECT label FROM scratch WHERE label IN ('outer', 'inner-lost', 'inner-kept') ORDER BY label").map((row) => row.label);
    assert.deepEqual(labels, ['inner-kept', 'outer']);
  });

  test('nested tx: an inner error that reaches the outer block rolls everything back', () => {
    assert.throws(
      () =>
        db.tx(() => {
          db.run("INSERT INTO scratch (label) VALUES ('all-or-nothing')");
          db.tx(() => {
            db.run("INSERT INTO scratch (label) VALUES ('all-or-nothing')");
            throw new Error('abort');
          });
        }),
      /abort/,
    );
    assert.equal(db.get("SELECT COUNT(*) AS n FROM scratch WHERE label = 'all-or-nothing'").n, 0);
    assert.equal(db.inTransaction, false);
  });

  test('tx refuses an async callback and rolls back', () => {
    assert.throws(
      () =>
        db.tx(async () => {
          db.run("INSERT INTO scratch (label) VALUES ('async')");
        }),
      /synchronous/,
    );
    assert.equal(db.get("SELECT COUNT(*) AS n FROM scratch WHERE label = 'async'").n, 0);
  });

  test('enforces foreign keys', () => {
    assert.throws(
      () => db.run("INSERT INTO addresses (user_id, name, phone, line1, city, state, pincode) VALUES (999, 'A', '9', 'L', 'C', 'S', '560001')"),
      /FOREIGN KEY/,
    );
  });

  test('a file database uses WAL, keeps its data and reapplies the schema on reopen', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addon-test-db-'));
    const file = path.join(dir, 'nested', 'store.db');
    try {
      const first = openDb(file);
      assert.equal(first.get('PRAGMA journal_mode').journal_mode, 'wal');
      assert.equal(first.get('PRAGMA foreign_keys').foreign_keys, 1);
      first.run("INSERT INTO newsletter_subscribers (email) VALUES ('kept@example.com')");
      first.close();

      const second = openDb(file);
      assert.equal(second.get('SELECT COUNT(*) AS n FROM newsletter_subscribers').n, 1);
      second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  test('toIso drops milliseconds to match the schema timestamps', () => {
    assert.equal(toIso(new Date('2026-04-01T00:00:00.999Z')), '2026-04-01T00:00:00Z');
    assert.equal(toIso('2026-11-17T10:00:00+05:30'), '2026-11-17T04:30:00Z');
    assert.match(t.ctx.now(), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe('settings', () => {
  test("defaults: Addon's own details (docs/COMPANY.md), blank unknowns, safe commerce rules", () => {
    const settings = t.ctx.settings.get();
    assert.equal(settings.storeName, 'Addon Automotive');
    assert.equal(settings.tagline, 'Upgrade your ride. Elevate your style.');
    assert.equal(settings.phone, '+91 89211 68071');
    assert.deepEqual(settings.phones, ['+91 80752 43040']);
    assert.equal(settings.whatsapp, '918921168071');
    assert.equal(settings.social.instagram, 'https://www.instagram.com/addonautomotive');
    assert.equal(settings.businessHours, 'Monday to Saturday 9:30 am to 8 pm; Sunday 10 am to 2 pm');
    // Not known yet: the owner fills these in.
    for (const blank of [settings.legalName, settings.email, settings.gstin]) {
      assert.equal(blank, '');
    }
    assert.deepEqual(settings.address, { line1: '', line2: '', city: '', state: '', pincode: '' });
    assert.deepEqual(settings.grievanceOfficer, { name: '', designation: '', email: '', phone: '' });
    assert.deepEqual(settings.shipping, {
      freeShippingThreshold: 999,
      flatFee: 79,
      bulkySurcharge: 199,
      freightSurcharge: 499,
      originPincode: '',
      dispatchDays: 1,
    });
    assert.deepEqual(settings.cod, { enabled: true, fee: 49, minOrder: 0, maxOrder: 25000, advancePercent: 0 });
    assert.equal(settings.prepaidDiscountPercent, 2);
    assert.equal(settings.returns.windowDays, 7);
    assert.equal(settings.fitPromise.enabled, true);
    assert.deepEqual(settings.invoice, { prefix: 'ADN', footerNote: '' });
    assert.deepEqual(
      settings.promos.map((promo) => promo.ctaHref),
      ['/build-bay', '/new-car', '/friday-five'],
    );
    assert.ok(settings.promos.every((promo) => promo.image === ''));
    assert.ok(settings.searchSynonyms.length >= 45);
    assert.ok(settings.searchSynonyms.some((entry) => entry.says === 'dikki' && entry.means === 'boot'));
    assert.ok(settings.searchSynonyms.some((entry) => entry.says === 'stepney' && entry.means === 'spare wheel'));
  });

  test('defaults: the studio, its fitting services, EMI and recent work', () => {
    const settings = t.ctx.settings.get();
    assert.deepEqual(settings.studio, {
      enabled: true,
      address: '',
      mapUrl: '',
      slots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
      carsPerSlot: 2,
      sundayLastSlot: '13:00',
      closedWeekdays: [],
      minNoticeMinutes: 60,
      maxDaysAhead: 60,
    });
    assert.deepEqual(
      settings.services.map(({ id, charge, minutes }) => [id, charge, minutes]),
      [
        ['stereo-install', 799, 90],
        ['speaker-install', 599, 60],
        ['lighting', 499, 60],
        ['body-kit', 999, 120],
        ['seat-cover', 399, 90],
        ['cool-film', 0, 120],
        ['wheels', 699, 60],
        ['consult', 0, 30],
      ],
    );
    for (const service of settings.services) {
      assert.ok(service.name && service.blurb, service.id);
      assert.ok(Array.isArray(service.subcategorySlugs), service.id);
    }
    assert.ok(settings.services.find((service) => service.id === 'stereo-install').subcategorySlugs.includes('head-units'));
    assert.deepEqual(settings.services.find((service) => service.id === 'consult').subcategorySlugs, []);
    assert.deepEqual(settings.emi, { enabled: true, partner: 'Bajaj Finserv', minAmount: 3000, note: settings.emi.note });
    assert.ok(settings.emi.note.includes('Bajaj Finserv'));
    assert.equal(settings.studioWork.length, 12);
    assert.deepEqual(Object.keys(settings.studioWork[0]).sort(), ['car', 'id', 'kind', 'poster', 'title', 'url', 'video']);
    assert.ok(settings.studioWork.every((item) => item.url === 'https://www.instagram.com/addonautomotive/reels/' && item.video === '' && item.poster === ''));
    assert.equal(new Set(settings.studioWork.map((item) => item.id)).size, 12);
    assert.ok(settings.studioWork.some((item) => item.car === 'BMW X5' && item.kind === 'Electronics'));
  });

  test('the fitting services name only real catalogue subcategories', async () => {
    const { readFile } = await import('node:fs/promises');
    const catalog = JSON.parse(await readFile(new URL('../src/seed/data/catalog.json', import.meta.url), 'utf8'));
    const subcategories = new Set(catalog.categories.flatMap((category) => category.subcategories.map((sub) => sub.slug)));
    for (const service of t.ctx.settings.get().services) {
      for (const slug of service.subcategorySlugs) assert.ok(subcategories.has(slug), `${service.id}: ${slug}`);
    }
  });

  test('a value already saved in the database wins over the new defaults', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      app.ctx.db.run("INSERT INTO settings (key, value) VALUES ('storeName', '\"Old Name\"'), ('studio', '{\"carsPerSlot\":3}')");
      app.ctx.settings.invalidate();
      const settings = app.ctx.settings.get();
      assert.equal(settings.storeName, 'Old Name');
      assert.equal(settings.studio.carsPerSlot, 3);
      assert.deepEqual(settings.studio.slots, DEFAULT_SETTINGS.studio.slots, 'the rest of the studio keeps its defaults');
      assert.equal(settings.phone, '+91 89211 68071');
    } finally {
      await app.close();
    }
  });

  test('studio, services, EMI and work updates are validated field by field', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { settings } = app.ctx;
      assert.throws(
        () =>
          settings.update({
            phones: ['call me'],
            studio: { slots: ['25:00'], carsPerSlot: 0, sundayLastSlot: '1pm', closedWeekdays: [7], mapUrl: 'maps' },
            services: [
              { id: 'same', name: 'A', charge: 1, minutes: 1, blurb: '', subcategorySlugs: [] },
              { id: 'same', name: 'B', charge: -1, minutes: 1, blurb: '', subcategorySlugs: [] },
            ],
            emi: { minAmount: -1 },
            studioWork: [{ title: '', url: 'not a link' }],
          }),
        (err) => {
          assert.equal(err.status, 400);
          assert.deepEqual(Object.keys(err.fields).sort(), [
            'emi.minAmount',
            'phones.0',
            'services.1.charge',
            'services.1.id',
            'studio.carsPerSlot',
            'studio.closedWeekdays.0',
            'studio.mapUrl',
            'studio.slots.0',
            'studio.sundayLastSlot',
            'studioWork.0.title',
            'studioWork.0.url',
          ]);
          return true;
        },
      );
      const next = settings.update({
        studio: { slots: ['16:00', '10:00', '10:00'], closedWeekdays: [1, 1], carsPerSlot: 3 },
        studioWork: [{ title: 'Seat covers', car: 'Kia Seltos', kind: 'Interior', url: '', video: '/uploads/a.mp4', poster: '' }],
      });
      assert.deepEqual(next.studio.slots, ['10:00', '16:00'], 'sorted, repeats removed');
      assert.deepEqual(next.studio.closedWeekdays, [1]);
      assert.equal(next.studio.minNoticeMinutes, 60, 'untouched keys keep their values');
      assert.equal(next.studioWork[0].id, 'work-1');
      assert.equal(settings.public().studio.carsPerSlot, 3);
    } finally {
      await app.close();
    }
  });

  test('default copy has no hype: no exclamation marks, no emoji', () => {
    const copy = JSON.stringify(DEFAULT_SETTINGS);
    assert.ok(!copy.includes('!'));
    assert.ok(!/\p{Extended_Pictographic}/u.test(copy));
  });

  test('get() hands out a copy, so callers cannot corrupt the cache', () => {
    const first = t.ctx.settings.get();
    first.shipping.flatFee = 1;
    first.promos.length = 0;
    assert.equal(t.ctx.settings.get().shipping.flatFee, 79);
    assert.equal(t.ctx.settings.get().promos.length, 3);
  });

  test('public() has exactly the PublicSettings keys and admin() adds the private ones', () => {
    const publicKeys = [
      'storeName', 'legalName', 'tagline', 'phone', 'phones', 'whatsapp', 'email', 'address', 'gstin', 'businessHours',
      'grievanceOfficer', 'social', 'announcements', 'promos', 'shipping', 'cod', 'prepaidDiscountPercent',
      'payments', 'returns', 'fitPromise', 'studio', 'services', 'emi', 'studioWork', 'invoice', 'hasDemoData',
    ];
    const pub = t.ctx.settings.public();
    assert.deepEqual(Object.keys(pub).sort(), [...publicKeys].sort());
    assert.deepEqual(pub.payments, { razorpay: false, razorpayKeyId: '', upi: false, upiId: '', upiPayeeName: '' });
    assert.equal(pub.hasDemoData, false);

    const admin = t.ctx.settings.admin();
    assert.deepEqual(Object.keys(admin).sort(), [...publicKeys, 'notifications', 'searchSynonyms', 'allPromos'].sort());
    assert.deepEqual(pub.invoice, { prefix: 'ADN', footerNote: '' });
    assert.deepEqual(admin.notifications, { orderEmail: '', smtpConfigured: false, razorpayConfigured: false });
    assert.equal(admin.allPromos.length, 3);
  });

  test('update deep-merges, validates, stores only what changed and survives a restart of the cache', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { settings, db } = app.ctx;
      const updated = settings.update({
        phone: '+91 98765 43210',
        whatsapp: '98765 43210',
        shipping: { flatFee: 99 },
        address: { state: 'karnataka', pincode: '560001' },
        gstin: '29aapfu0939f1zv',
        payments: { upiId: 'addon@okhdfcbank', upiPayeeName: 'Addon Auto Motive', razorpay: true, razorpayKeyId: 'forged' },
        hasDemoData: true,
        notifications: { orderEmail: 'Orders@Addon.Example', smtpConfigured: true },
      });
      assert.equal(updated.whatsapp, '919876543210');
      assert.deepEqual(updated.shipping, { ...DEFAULT_SETTINGS.shipping, flatFee: 99 });
      assert.equal(updated.address.state, 'Karnataka');
      assert.equal(updated.gstin, '29AAPFU0939F1ZV');
      assert.equal(updated.notifications.orderEmail, 'orders@addon.example');

      // Razorpay state comes from the environment and is never stored, whatever the client sends.
      assert.deepEqual(updated.payments, {
        razorpay: false,
        razorpayKeyId: '',
        upi: true,
        upiId: 'addon@okhdfcbank',
        upiPayeeName: 'Addon Auto Motive',
      });
      assert.deepEqual(JSON.parse(db.get("SELECT value FROM settings WHERE key = 'payments'").value), {
        upiId: 'addon@okhdfcbank',
        upiPayeeName: 'Addon Auto Motive',
      });
      assert.deepEqual(
        db.all('SELECT key FROM settings ORDER BY key').map((row) => row.key),
        ['address', 'gstin', 'notifications', 'payments', 'phone', 'shipping', 'whatsapp'],
      );

      settings.invalidate();
      assert.equal(settings.get().shipping.flatFee, 99);
      assert.equal(settings.get().cod.fee, 49);
      assert.equal(settings.public().payments.upi, true);
      assert.equal(settings.admin().notifications.smtpConfigured, false);
    } finally {
      await app.close();
    }
  });

  test('an invalid update is refused as a whole, with a message per field', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { settings, db } = app.ctx;
      assert.throws(
        () =>
          settings.update({
            storeName: 'Renamed Store',
            email: 'not-an-email',
            shipping: { originPincode: '12', flatFee: -5 },
            cod: { minOrder: 500, maxOrder: 100 },
            invoice: { prefix: 'TOOLONG' },
            allPromos: [{ title: '', ctaHref: 'https://elsewhere.example' }],
          }),
        (err) => {
          assert.ok(err instanceof HttpError);
          assert.equal(err.status, 400);
          assert.equal(err.code, 'validation_error');
          assert.deepEqual(Object.keys(err.fields).sort(), [
            'allPromos.0.ctaHref',
            'allPromos.0.title',
            'cod.maxOrder',
            'email',
            'invoice.prefix',
            'shipping.flatFee',
            'shipping.originPincode',
          ]);
          return true;
        },
      );
      assert.equal(db.get('SELECT COUNT(*) AS n FROM settings').n, 0);
      assert.equal(settings.get().storeName, 'Addon Automotive');
      assert.throws(() => settings.update('nope'), (err) => err.status === 400);
    } finally {
      await app.close();
    }
  });

  test('public() shows only promos that are live now, admin() lists them all', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { ctx } = app;
      ctx.now = () => '2026-11-17T12:00:00Z';
      const banner = (id, startsAt, endsAt) => ({ id, title: `Banner ${id}`, ctaHref: '/shop', startsAt, endsAt });
      ctx.settings.update({
        allPromos: [
          banner('always', null, null),
          banner('live', '2026-11-17T00:00:00Z', '2026-11-18T00:00:00Z'),
          banner('ended', '2026-11-01T00:00:00Z', '2026-11-17T12:00:00Z'),
          banner('upcoming', '2026-11-17T12:00:01Z', null),
          banner('ist-live', '2026-11-17T17:00:00+05:30', ''),
        ],
      });
      assert.deepEqual(ctx.settings.public().promos.map((promo) => promo.id), ['always', 'live', 'ist-live']);
      assert.deepEqual(ctx.settings.admin().promos.map((promo) => promo.id), ['always', 'live', 'ist-live']);
      assert.deepEqual(ctx.settings.admin().allPromos.map((promo) => promo.id), ['always', 'live', 'ended', 'upcoming', 'ist-live']);
      assert.equal(ctx.settings.get().promos[4].startsAt, '2026-11-17T11:30:00Z');

      ctx.now = () => '2026-11-18T09:00:00Z';
      assert.deepEqual(ctx.settings.public().promos.map((promo) => promo.id), ['always', 'upcoming', 'ist-live']);
    } finally {
      await app.close();
    }
  });

  test('an update inside a transaction that rolls back leaves no trace', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { settings, db } = app.ctx;
      assert.throws(() =>
        db.tx(() => {
          settings.update({ shipping: { flatFee: 500 } });
          assert.equal(settings.get().shipping.flatFee, 500);
          throw new Error('the rest of the job failed');
        }),
      );
      assert.equal(settings.get().shipping.flatFee, 79);
      assert.equal(db.get('SELECT COUNT(*) AS n FROM settings').n, 0);
    } finally {
      await app.close();
    }
  });

  test('hasDemoData follows the is_demo flag on products', async () => {
    const app = await startTestApp();
    try {
      assert.equal(app.ctx.settings.public().hasDemoData, false);
      app.ctx.db.run('UPDATE products SET is_demo = 1 WHERE id = ?', [app.fixtures.products.universal.id]);
      assert.equal(app.ctx.settings.public().hasDemoData, true);
    } finally {
      await app.close();
    }
  });

  test('Razorpay and SMTP flags come from the config', async () => {
    const app = await startTestApp({
      fixtures: false,
      config: {
        razorpay: { keyId: 'rzp_test_abc', keySecret: 'secret', webhookSecret: '' },
        smtp: { host: 'smtp.example', port: 587, secure: false, user: '', pass: '', from: '' },
      },
    });
    try {
      assert.equal(app.ctx.settings.public().payments.razorpay, true);
      assert.equal(app.ctx.settings.public().payments.razorpayKeyId, 'rzp_test_abc');
      assert.deepEqual(app.ctx.settings.admin().notifications, { orderEmail: '', smtpConfigured: true, razorpayConfigured: true });
      assert.ok(!JSON.stringify(app.ctx.settings.admin()).includes('secret'));
    } finally {
      await app.close();
    }
  });
});

describe('money', () => {
  test('intra-state: GST splits into equal CGST and SGST', () => {
    assert.deepEqual(taxBreakdown([{ amount: 1180, gstRate: 18 }], { storeState: 'Karnataka', shipState: 'Karnataka' }), {
      taxableValue: 1000,
      gst: 180,
      cgst: 90,
      sgst: 90,
      igst: 0,
      isInterState: false,
    });
  });

  test('inter-state: the same GST is charged as IGST', () => {
    assert.deepEqual(taxBreakdown([{ amount: 1180, gstRate: 18 }], { storeState: 'Karnataka', shipState: 'Maharashtra' }), {
      taxableValue: 1000,
      gst: 180,
      cgst: 0,
      sgst: 0,
      igst: 180,
      isInterState: true,
    });
  });

  test('a blank store or delivery State is treated as intra-state', () => {
    assert.equal(taxBreakdown([{ amount: 1180, gstRate: 18 }], { storeState: '', shipState: 'Goa' }).isInterState, false);
    assert.equal(taxBreakdown([{ amount: 1180, gstRate: 18 }], { storeState: 'Goa', shipState: '' }).isInterState, false);
    assert.equal(taxBreakdown([{ amount: 1180, gstRate: 18 }]).cgst, 90);
  });

  test('States match by name in any case, by old name and by GST code', () => {
    assert.equal(isInterState('karnataka', 'KARNATAKA'), false);
    assert.equal(isInterState('29', 'Karnataka'), false);
    assert.equal(isInterState('Orissa', 'Odisha'), false);
    assert.equal(isInterState('Delhi', 'Haryana'), true);
  });

  test('mixed rates are back-calculated per rate and always add up to the amount charged', () => {
    const lines = [
      { amount: 1180, gstRate: 18 },
      { amount: 2360, gstRate: 18 },
      { amount: 1120, gstRate: 12 },
      { amount: 999, gstRate: 28 },
      { amount: 105, gstRate: 5 },
      { amount: 200, gstRate: 0 },
    ];
    const total = lines.reduce((sum, line) => sum + line.amount, 0);

    const rows = taxByRate(lines, { storeState: 'Delhi', shipState: 'Delhi' });
    assert.deepEqual(rows.map((row) => row.gstRate), [0, 5, 12, 18, 28]);
    assert.deepEqual(rows.find((row) => row.gstRate === 18), {
      gstRate: 18,
      amount: 3540,
      taxableValue: 3000,
      cgst: 270,
      sgst: 270,
      igst: 0,
      gst: 540,
    });
    assert.deepEqual(rows.find((row) => row.gstRate === 28), {
      gstRate: 28,
      amount: 999,
      taxableValue: 780.46,
      cgst: 109.27,
      sgst: 109.27,
      igst: 0,
      gst: 218.54,
    });
    assert.deepEqual(rows.find((row) => row.gstRate === 0), { gstRate: 0, amount: 200, taxableValue: 200, cgst: 0, sgst: 0, igst: 0, gst: 0 });

    for (const shipState of ['Delhi', 'Kerala']) {
      const tax = taxBreakdown(lines, { storeState: 'Delhi', shipState });
      assert.equal(Math.round((tax.taxableValue + tax.gst) * 100), total * 100);
      assert.equal(Math.round((tax.cgst + tax.sgst + tax.igst) * 100), Math.round(tax.gst * 100));
      assert.equal(tax.cgst, tax.sgst);
    }
    const inter = taxBreakdown(lines, { storeState: 'Delhi', shipState: 'Kerala' });
    assert.equal(inter.igst, 883.53);
    assert.equal(inter.taxableValue, 5080.47);
  });

  test('percentOff never overstates a discount', () => {
    assert.equal(percentOff(1899, 2499), 24);
    assert.equal(percentOff(500, 1000), 50);
    assert.equal(percentOff(2, 3), 33);
    assert.equal(percentOff(1000, 1000), 0);
    assert.equal(percentOff(1200, 1000), 0);
    assert.equal(percentOff(100, 0), 0);
  });

  test('applyDrop matches the sale_price the products view computes', () => {
    assert.equal(applyDrop(3499, 0), 3499);
    assert.equal(applyDrop(3499, 15), 2974);
    for (const [price, percent] of [[3499, 15], [1299, 33], [21999, 7], [999, 50], [1, 90]]) {
      const fromSql = t.ctx.db.get('SELECT CAST(ROUND(? * (100 - ?) / 100.0) AS INTEGER) AS sale', [price, percent]).sale;
      assert.equal(applyDrop(price, percent), fromSql);
    }
  });

  test('formatINR uses the rupee sign and lakh grouping', () => {
    assert.equal(formatINR(119999), '₹1,19,999');
    assert.equal(formatINR(999), '₹999');
    assert.equal(formatINR(12345678), '₹1,23,45,678');
    assert.equal(formatINR(1180.5, { paise: true }), '₹1,180.50');
    assert.equal(formatINR(0), '₹0');
  });
});

describe('ids', () => {
  test('slugify and uniqueSlug', () => {
    assert.equal(slugify('Addon Aero Spoiler, Gloss Black (Swift)'), 'addon-aero-spoiler-gloss-black-swift');
    assert.equal(slugify("  Wheels & Tyres: 15'' Alloys  "), 'wheels-tyres-15-alloys');
    assert.equal(slugify('Café Racer'), 'cafe-racer');
    assert.equal(slugify('!!!'), '');
    assert.ok(slugify('x'.repeat(200)).length <= 80);

    const taken = t.fixtures.products.spoiler.slug;
    assert.equal(uniqueSlug(t.ctx, 'products', 'A Brand New Part'), 'a-brand-new-part');
    assert.equal(uniqueSlug(t.ctx, 'products', taken), `${taken}-2`);
    assert.equal(uniqueSlug(t.ctx, 'products', taken, { excludeId: t.fixtures.products.spoiler.id }), taken);
    assert.equal(uniqueSlug(t.ctx, 'categories', 'Alloy Wheels'), 'alloy-wheels-2');
    assert.equal(uniqueSlug(t.ctx, 'builds', '???'), 'item');
    assert.throws(() => uniqueSlug(t.ctx, 'products; DROP TABLE users', 'x'), /not a table name/);
  });

  test('randomToken is URL-safe and does not repeat', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    assert.equal(tokens.size, 200);
    for (const token of tokens) assert.match(token, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(randomToken(8).length, 11);
  });

  test('orderNumber: ADN-YYMMDD-XXXX with the date in India and unambiguous characters', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      assert.match(orderNumber(), /^ADN-\d{6}-[A-HJKMNP-Z2-9]{4}$/);

      // 20:00 UTC on the 17th is already the 18th in India.
      app.ctx.now = () => '2026-11-17T20:00:00Z';
      const seen = new Set();
      for (let i = 0; i < 300; i += 1) {
        const number = orderNumber(app.ctx);
        assert.match(number, /^ADN-261118-[A-HJKMNP-Z2-9]{4}$/);
        assert.ok(!seen.has(number), 'a number already given to an order must not come back');
        seen.add(number);
        insertOrder(app.ctx, number);
      }
    } finally {
      await app.close();
    }
  });

  test('ticketNumber counts up from ADN-T-000001', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { ctx } = app;
      const file = () => {
        const ticket = ticketNumber(ctx);
        ctx.db.run("INSERT INTO enquiries (ticket_number, name, message) VALUES (?, 'Someone', 'Hello')", [ticket]);
        return ticket;
      };
      assert.deepEqual([file(), file(), file()], ['ADN-T-000001', 'ADN-T-000002', 'ADN-T-000003']);
      ctx.db.run("UPDATE enquiries SET ticket_number = 'ADN-T-000123' WHERE ticket_number = 'ADN-T-000003'");
      assert.equal(ticketNumber(ctx), 'ADN-T-000124');
    } finally {
      await app.close();
    }
  });

  test('financialYear runs from 1 April to 31 March, on India time', () => {
    assert.deepEqual(financialYear('2026-11-17T10:00:00Z'), { startYear: 2026, label: '26-27' });
    assert.deepEqual(financialYear('2027-02-01T00:00:00Z'), { startYear: 2026, label: '26-27' });
    assert.deepEqual(financialYear('2027-03-31T18:29:59Z'), { startYear: 2026, label: '26-27' });
    assert.deepEqual(financialYear('2027-03-31T18:30:00Z'), { startYear: 2027, label: '27-28' });
    assert.deepEqual(financialYear(new Date('2099-12-31T00:00:00Z')), { startYear: 2099, label: '99-00' });
  });

  test('invoiceNumber is gapless within a financial year and restarts on 1 April', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      const { ctx } = app;
      ctx.now = () => '2026-11-17T10:00:00Z';
      const place = (date) =>
        ctx.db.tx(() => {
          const invoice = invoiceNumber(ctx, date);
          insertOrder(ctx, `ADN-TEST-${randomToken(6)}`, invoice);
          return invoice;
        });

      assert.equal(place(), 'ADN/26-27/0001');
      assert.equal(place(), 'ADN/26-27/0002');

      // An order that fails after taking a number gives the number back.
      assert.throws(() =>
        ctx.db.tx(() => {
          insertOrder(ctx, 'ADN-TEST-FAILED', invoiceNumber(ctx));
          throw new Error('payment setup failed');
        }),
      );
      assert.equal(place(), 'ADN/26-27/0003');

      // Orders without an invoice number (pending payment) do not disturb the sequence.
      insertOrder(ctx, 'ADN-TEST-PENDING', '');
      assert.equal(place(new Date('2027-03-31T18:00:00Z')), 'ADN/26-27/0004');

      assert.equal(place('2027-03-31T18:30:00Z'), 'ADN/27-28/0001');
      assert.equal(place('2027-06-01T00:00:00Z'), 'ADN/27-28/0002');
      assert.equal(invoiceNumber(ctx), 'ADN/26-27/0005');

      ctx.settings.update({ invoice: { prefix: 'ab12' } });
      const renamed = place();
      assert.equal(renamed, 'AB12/26-27/0001');
      assert.ok(renamed.length <= 16);
      assert.match(renamed, /^[A-Z0-9/-]+$/);
    } finally {
      await app.close();
    }
  });
});

describe('india', () => {
  test('lists 28 States and 8 Union Territories with unique GST codes', () => {
    assert.equal(STATES.length, 36);
    assert.equal(STATES.filter((state) => state.type === 'state').length, 28);
    assert.equal(STATES.filter((state) => state.type === 'ut').length, 8);
    assert.equal(new Set(STATES.map((state) => state.code)).size, 36);
    assert.equal(new Set(STATES.map((state) => state.name)).size, 36);
    assert.ok(STATES.every((state) => /^\d{2}$/.test(state.code)));
    assert.equal(stateCode('Karnataka'), '29');
    assert.equal(stateCode('Maharashtra'), '27');
    assert.equal(stateCode('Delhi'), '07');
    assert.equal(stateCode('Ladakh'), '38');
    assert.equal(stateCode('Atlantis'), '');
    assert.equal(findState('tamil nadu').name, 'Tamil Nadu');
    assert.equal(findState('33').name, 'Tamil Nadu');
    assert.equal(findState('7').name, 'Delhi');
    assert.equal(findState('Pondicherry').name, 'Puducherry');
    assert.equal(findState('Jammu & Kashmir').code, '01');
    assert.equal(findState(''), null);
  });

  test('stateFromPincode covers the regions and the carve-outs inside them', () => {
    const expected = {
      110001: 'Delhi',
      122001: 'Haryana',
      141001: 'Punjab',
      160017: 'Chandigarh',
      171001: 'Himachal Pradesh',
      190001: 'Jammu and Kashmir',
      194101: 'Ladakh',
      226001: 'Uttar Pradesh',
      201301: 'Uttar Pradesh',
      246701: 'Uttar Pradesh',
      248001: 'Uttarakhand',
      263001: 'Uttarakhand',
      302001: 'Rajasthan',
      380001: 'Gujarat',
      396191: 'Gujarat',
      396210: 'Dadra and Nagar Haveli and Daman and Diu',
      400001: 'Maharashtra',
      411001: 'Maharashtra',
      403001: 'Goa',
      462001: 'Madhya Pradesh',
      492001: 'Chhattisgarh',
      500001: 'Telangana',
      520001: 'Andhra Pradesh',
      560001: 'Karnataka',
      600001: 'Tamil Nadu',
      605001: 'Puducherry',
      682001: 'Kerala',
      682555: 'Lakshadweep',
      695001: 'Kerala',
      700001: 'West Bengal',
      737101: 'Sikkim',
      744101: 'Andaman and Nicobar Islands',
      751001: 'Odisha',
      781001: 'Assam',
      791111: 'Arunachal Pradesh',
      793001: 'Meghalaya',
      795001: 'Manipur',
      796001: 'Mizoram',
      797001: 'Nagaland',
      799001: 'Tripura',
      800001: 'Bihar',
      823001: 'Bihar',
      826001: 'Jharkhand',
      834001: 'Jharkhand',
    };
    for (const [pincode, state] of Object.entries(expected)) {
      assert.equal(stateFromPincode(pincode), state, `PIN ${pincode}`);
    }
    assert.ok(Object.values(expected).every((name) => STATES.some((state) => state.name === name)));
    assert.equal(stateFromPincode(560001), 'Karnataka');
    assert.equal(stateFromPincode(' 560001 '), 'Karnataka');
    for (const bad of ['900001', '012345', '56000', '5600011', 'abcdef', '', null, undefined]) {
      assert.equal(stateFromPincode(bad), null, `PIN ${bad}`);
    }
    assert.equal(isValidPincode('560001'), true);
    assert.equal(isValidPincode('056001'), false);
    assert.equal(isValidPincode('5600'), false);
  });

  test('normalizePhone returns ten digits or null', () => {
    for (const input of ['9876543210', '+91 98765 43210', '+91-98765-43210', '919876543210', '09876543210', '(98765) 43210', 9876543210]) {
      assert.equal(normalizePhone(input), '9876543210', String(input));
    }
    assert.equal(normalizePhone('9123456789'), '9123456789');
    for (const input of ['5876543210', '98765432', '98765432101', '9999999999', '+1 415 555 0100', 'phone', '', null, undefined, {}]) {
      assert.equal(normalizePhone(input), null, String(input));
    }
  });

  test('isValidGstin checks the layout and the State code', () => {
    assert.equal(isValidGstin('27AAPFU0939F1ZV'), true);
    assert.equal(isValidGstin(' 29aagcb7383j1z4 '), true);
    assert.equal(isValidGstin('97AAPFU0939F1ZV'), true);
    assert.equal(isValidGstin('28AAPFU0939F1ZV'), false, '28 is a retired code');
    assert.equal(isValidGstin('00AAPFU0939F1ZV'), false);
    assert.equal(isValidGstin('99AAPFU0939F1ZV'), false);
    assert.equal(isValidGstin('27AAPFU0939F1YV'), false, 'the 14th character must be Z');
    assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
    assert.equal(isValidGstin('27AAPFU0939F0ZV'), false);
    assert.equal(isValidGstin(''), false);
    assert.equal(isValidGstin(null), false);
  });
});

describe('validate', () => {
  test('common schemas normalise good input', () => {
    assert.equal(parse(phoneSchema, '+91 98765 43210'), '9876543210');
    assert.equal(parse(pincodeSchema, ' 560001 '), '560001');
    assert.equal(parse(emailSchema, '  Kiran@Example.COM '), 'kiran@example.com');
    assert.equal(parse(gstinSchema, '27aapfu0939f1zv'), '27AAPFU0939F1ZV');
    assert.equal(parse(passwordSchema, 'longenough'), 'longenough');
    assert.equal(parse(idParam, '42'), 42);
    assert.deepEqual(parse(pagination, { q: 'spoiler' }), { page: 1, limit: 20 });
    assert.deepEqual(parse(pagination, { page: '3', limit: '50' }), { page: 3, limit: 50 });
    assert.deepEqual(parse(paginationOf({ defaultLimit: 24, maxLimit: 60 }), {}), { page: 1, limit: 24 });
    assert.deepEqual(paginated(['a', 'b'], 41, { page: 2, limit: 20 }), { items: ['a', 'b'], total: 41, page: 2, pages: 3, limit: 20 });
    assert.equal(paginated([], 0, { page: 1, limit: 20 }).pages, 1);
    assert.deepEqual(
      parse(addressSchema, { name: 'Kiran Rao', phone: '09876543210', line1: '12 MG Road', city: 'Bengaluru', state: 'karnataka', pincode: '560001' }),
      {
        label: 'Home',
        name: 'Kiran Rao',
        phone: '9876543210',
        line1: '12 MG Road',
        line2: '',
        landmark: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        isDefault: false,
      },
    );
  });

  test('parse throws a 400 with a plain message per field', () => {
    const schema = z.object({
      name: z.string().trim().min(2),
      qty: z.int().min(1).max(10),
      contact: z.object({ phone: phoneSchema, email: emailSchema }),
      tags: z.array(z.string()).max(2),
      method: z.enum(['cod', 'upi']),
    });
    assert.throws(
      () => parse(schema, { name: 'A', qty: 50, contact: { phone: '12345' }, tags: ['a', 'b', 'c'], method: 'cheque' }),
      (err) => {
        assert.ok(err instanceof HttpError);
        assert.equal(err.status, 400);
        assert.equal(err.code, 'validation_error');
        assert.deepEqual(err.fields, {
          name: 'Use at least 2 characters.',
          qty: 'Must be 10 or less.',
          'contact.phone': 'Enter a 10 digit mobile number',
          'contact.email': 'Enter a valid email address',
          tags: 'No more than 2 allowed.',
          method: 'Choose one of the listed options.',
        });
        return true;
      },
    );
  });

  test('a missing body reports each required field, and a bare value reports in the message', () => {
    assert.throws(
      () => parse(z.object({ email: emailSchema, name: z.string() }), undefined),
      (err) => err.status === 400 && err.fields.name === 'This is required.' && 'email' in err.fields,
    );
    assert.throws(() => parse(idParam, 'abc'), (err) => err.status === 400 && err.message === 'That id is not valid' && err.fields === undefined);
    for (const bad of ['0', '-3', '1.5', '', undefined]) assert.throws(() => parse(idParam, bad), HttpError);
    assert.throws(() => parse(pagination, { page: '0' }), HttpError);
    assert.throws(() => parse(pagination, { limit: '500' }), HttpError);
    assert.throws(() => parse(passwordSchema, 'short'), HttpError);
    assert.throws(() => parse(passwordSchema, 'x'.repeat(73)), HttpError);
    assert.equal(parse(z.string().optional(), undefined), undefined);
  });
});

describe('errors', () => {
  test('helpers build HttpErrors with the API codes', () => {
    const cases = [
      [badRequest('Bad', { a: 'b' }), 400, 'validation_error', 'Bad'],
      [unauthorized(), 401, 'unauthorized', 'Sign in to continue.'],
      [forbidden(), 403, 'forbidden', 'You do not have access to this.'],
      [notFound('Order'), 404, 'not_found', 'Order not found.'],
      [conflict('Email already registered.'), 409, 'conflict', 'Email already registered.'],
      [conflict('Only 2 left.', 'out_of_stock'), 409, 'out_of_stock', 'Only 2 left.'],
    ];
    for (const [err, status, code, message] of cases) {
      assert.ok(err instanceof HttpError && err instanceof Error);
      assert.equal(err.status, status);
      assert.equal(err.code, code);
      assert.equal(err.message, message);
    }
    assert.deepEqual(badRequest('Bad', { a: 'b' }).fields, { a: 'b' });
    assert.equal(badRequest('Bad').fields, undefined);
    assert.equal(badRequest('Bad', {}).fields, undefined);
  });
});

describe('error handler', () => {
  let mini;
  before(async () => {
    mini = await startMiniApp(t.ctx, (app) => {
      const schema = z.object({ contact: z.object({ phone: phoneSchema }), pincode: pincodeSchema, qty: z.int().min(1) });
      app.post('/validated', (req, res) => res.json(parse(schema, req.body)));
      app.post('/raw-zod', (req, res) => res.json(schema.parse(req.body)));
      app.get('/conflict', () => {
        throw conflict('Only 2 left of Addon Aero Spoiler.', 'out_of_stock');
      });
      app.get('/boom', () => {
        throw new Error('SQLITE_CONSTRAINT: secret table users.password_hash');
      });
      app.get('/async-boom', async () => {
        await Promise.resolve();
        throw new Error('connection string postgres://root:hunter2@db');
      });
    });
  });
  after(() => mini.close());

  test('an unknown /api path is a JSON 404', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = await t.api('/api/this-route-does-not-exist', { method });
      assert.equal(res.status, 404);
      assert.deepEqual(res.body, { error: { code: 'not_found', message: 'There is nothing at this address.' } });
    }
    const upload = await t.api('/uploads/missing.webp');
    assert.equal(upload.status, 404);
    assert.equal(upload.body.error.code, 'not_found');
  });

  test('malformed JSON is a 400 validation_error, before any route runs', async () => {
    const res = await t.api('/api/this-route-does-not-exist', {
      method: 'POST',
      body: '{"name": "broken',
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: { code: 'validation_error', message: 'The request body is not valid JSON.' } });
  });

  test('the Razorpay webhook path keeps its raw body away from the JSON parser', async () => {
    const res = await t.api('/api/payments/razorpay/webhook', {
      method: 'POST',
      body: '{"event": "payment.captured", broken',
      headers: { 'content-type': 'application/json' },
    });
    assert.notEqual(res.body?.error?.message, 'The request body is not valid JSON.');
  });

  test('a body over 1 MB is refused with 413', async () => {
    const res = await t.api('/api/this-route-does-not-exist', { method: 'POST', body: { blob: 'x'.repeat(1_100_000) } });
    assert.equal(res.status, 413);
    assert.equal(res.body.error.code, 'validation_error');
  });

  test('validation errors list every field by dotted path', async () => {
    const res = await mini.call('/validated', { method: 'POST', body: { contact: { phone: '123' }, pincode: '0', qty: 0 } });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, {
      error: {
        code: 'validation_error',
        message: 'Check the details and try again.',
        fields: {
          'contact.phone': 'Enter a 10 digit mobile number',
          pincode: 'Enter a 6 digit PIN code',
          qty: 'Must be 1 or more.',
        },
      },
    });

    const empty = await mini.call('/validated', { method: 'POST' });
    assert.equal(empty.status, 400);
    assert.deepEqual(Object.keys(empty.body.error.fields).sort(), ['contact', 'pincode', 'qty']);

    const ok = await mini.call('/validated', { method: 'POST', body: { contact: { phone: '98765 43210' }, pincode: '560001', qty: 2 } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { contact: { phone: '9876543210' }, pincode: '560001', qty: 2 });
  });

  test('a ZodError thrown by a route is also a 400 with fields', async () => {
    const res = await mini.call('/raw-zod', { method: 'POST', body: { contact: { phone: '9876543210' }, pincode: '560001', qty: 'two' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'validation_error');
    assert.deepEqual(Object.keys(res.body.error.fields), ['qty']);
  });

  test('an HttpError keeps its status, code and message', async () => {
    const res = await mini.call('/conflict');
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: { code: 'out_of_stock', message: 'Only 2 left of Addon Aero Spoiler.' } });
  });

  test('unexpected errors, sync or async, become a plain 500 and are logged, never leaked', async () => {
    const log = mock.method(console, 'error', () => {});
    try {
      for (const route of ['/boom', '/async-boom']) {
        const res = await mini.call(route);
        assert.equal(res.status, 500);
        assert.deepEqual(res.body, { error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } });
        const raw = JSON.stringify(res.body);
        assert.ok(!raw.includes('hunter2') && !raw.includes('password_hash') && !raw.includes('stack'));
      }
      assert.equal(log.mock.callCount(), 2);
      assert.match(String(log.mock.calls[0].arguments[0]), /GET \/boom/);
    } finally {
      log.mock.restore();
    }
  });
});

describe('auth', () => {
  let mini;
  let secureMini;
  const register = (app) => {
    app.get('/who', optionalAuth, (req, res) => res.json({ user: req.user }));
    app.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));
    app.get('/staff', requireAdmin, (req, res) => res.json({ user: req.user }));
    app.post('/login/:id', (req, res) => {
      setSessionCookie(res, { id: Number(req.params.id) });
      res.json({ ok: true });
    });
    app.post('/logout', (req, res) => {
      clearSessionCookie(res);
      res.json({ ok: true });
    });
  };
  const cookieFor = (userId) => `${SESSION_COOKIE}=${signSession(t.ctx, userId)}`;

  before(async () => {
    mini = await startMiniApp(t.ctx, register);
    secureMini = await startMiniApp({ ...t.ctx, config: { ...t.ctx.config, isProd: true } }, register);
  });
  after(async () => {
    await mini.close();
    await secureMini.close();
  });

  test('optionalAuth: null when signed out, the users row when signed in', async () => {
    assert.deepEqual((await mini.call('/who')).body, { user: null });

    const res = await mini.call('/who', { cookie: cookieFor(t.fixtures.customer.id) });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, t.fixtures.customer.id);
    assert.equal(res.body.user.email, t.fixtures.customer.email);
    assert.equal(res.body.user.role, 'customer');
    assert.deepEqual(Object.keys(res.body.user).sort(), ['created_at', 'email', 'id', 'name', 'phone', 'role', 'updated_at']);
  });

  test('requireAuth: 401 without a valid session', async () => {
    const signedOut = await mini.call('/me');
    assert.equal(signedOut.status, 401);
    assert.deepEqual(signedOut.body, { error: { code: 'unauthorized', message: 'Sign in to continue.' } });

    const signedIn = await mini.call('/me', { cookie: cookieFor(t.fixtures.customer.id) });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.body.user.id, t.fixtures.customer.id);
  });

  test('requireAdmin: 401 signed out, 403 for a customer, 200 for an admin', async () => {
    assert.equal((await mini.call('/staff')).status, 401);
    const customer = await mini.call('/staff', { cookie: cookieFor(t.fixtures.customer.id) });
    assert.equal(customer.status, 403);
    assert.equal(customer.body.error.code, 'forbidden');
    const admin = await mini.call('/staff', { cookie: cookieFor(t.fixtures.admin.id) });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.user.role, 'admin');
  });

  test('a forged, foreign, expired or orphaned session counts as signed out', async () => {
    const forged = `${SESSION_COOKIE}=not.a.token`;
    const foreign = `${SESSION_COOKIE}=${jwt.sign({ sub: String(t.fixtures.admin.id) }, 'another-secret')}`;
    const expired = `${SESSION_COOKIE}=${jwt.sign({ sub: String(t.fixtures.admin.id) }, t.ctx.config.jwtSecret, { expiresIn: -10 })}`;
    const unsigned = `${SESSION_COOKIE}=${jwt.sign({ sub: String(t.fixtures.admin.id) }, '', { algorithm: 'none' })}`;
    const ghost = cookieFor(987654);
    for (const cookie of [forged, foreign, expired, unsigned, ghost]) {
      assert.deepEqual((await mini.call('/who', { cookie })).body, { user: null });
      assert.equal((await mini.call('/staff', { cookie })).status, 401);
    }

    const { lastInsertRowid: id } = t.ctx.db.run("INSERT INTO users (name, email, password_hash) VALUES ('Gone', 'gone@example.com', 'x')");
    assert.equal((await mini.call('/me', { cookie: cookieFor(id) })).status, 200);
    t.ctx.db.run('DELETE FROM users WHERE id = ?', [id]);
    assert.equal((await mini.call('/me', { cookie: cookieFor(id) })).status, 401);
  });

  test('setSessionCookie: httpOnly, SameSite=Lax, 30 days, and a token that holds only the user id', async () => {
    const res = await mini.call(`/login/${t.fixtures.customer.id}`, { method: 'POST' });
    assert.equal(res.setCookie.length, 1);
    const [cookie] = res.setCookie;
    assert.match(cookie, /^addon_session=[^;]+;/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\//i);
    assert.match(cookie, /Max-Age=2592000/i);
    assert.doesNotMatch(cookie, /Secure/i);

    const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
    const payload = jwt.verify(token, t.ctx.config.jwtSecret);
    assert.deepEqual(Object.keys(payload).sort(), ['exp', 'iat', 'sub']);
    assert.equal(payload.sub, String(t.fixtures.customer.id));
    assert.equal(payload.exp - payload.iat, 30 * 24 * 60 * 60);

    const me = await mini.call('/me', { cookie: cookie.split(';')[0] });
    assert.equal(me.body.user.id, t.fixtures.customer.id);
  });

  test('the cookie is Secure in production, and clearSessionCookie expires it', async () => {
    const secure = await secureMini.call(`/login/${t.fixtures.customer.id}`, { method: 'POST' });
    assert.match(secure.setCookie[0], /; Secure/i);

    const out = await mini.call('/logout', { method: 'POST' });
    assert.match(out.setCookie[0], /^addon_session=;/);
    assert.match(out.setCookie[0], /Expires=Thu, 01 Jan 1970/i);
  });

  test('hashPassword and verifyPassword', async () => {
    const hash = await hashPassword('Corr3ct horse');
    assert.match(hash, /^\$2[aby]\$04\$/);
    assert.equal(await verifyPassword('Corr3ct horse', hash), true);
    assert.equal(await verifyPassword('wrong', hash), false);
    assert.equal(await verifyPassword('Corr3ct horse', null), false);
    assert.equal(await verifyPassword(undefined, hash), false);

    const stored = t.ctx.db.get('SELECT password_hash FROM users WHERE id = ?', [t.fixtures.admin.id]).password_hash;
    assert.equal(await verifyPassword(ADMIN_PASSWORD, stored), true);
  });

  test('the admin router is closed to everyone but admins', async () => {
    const path404 = '/api/admin/this-route-does-not-exist';
    assert.equal((await t.api(path404)).status, 401);
    assert.equal((await t.asCustomer()(path404)).status, 403);
    assert.equal((await t.asAdmin()(path404)).status, 404);
    assert.equal((await t.asUser(t.fixtures.admin.id)(path404)).status, 404);
  });
});

describe('store endpoints', () => {
  test('GET /api/health', async () => {
    const res = await t.api('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.match(res.body.time, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.match(res.headers.get('content-security-policy'), /checkout\.razorpay\.com/);
  });

  test('GET /api/settings returns PublicSettings and nothing private', async () => {
    const res = await t.api('/api/settings');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, t.ctx.settings.public());
    assert.equal(res.body.storeName, 'Addon Automotive');
    assert.equal(res.body.promos.length, 3);
    assert.equal(res.body.hasDemoData, false);
    for (const privateKey of ['notifications', 'searchSynonyms', 'allPromos']) {
      assert.ok(!(privateKey in res.body), `${privateKey} must not be public`);
    }
  });

  test('GET /api/settings reflects an update straight away', async () => {
    const app = await startTestApp({ fixtures: false });
    try {
      app.ctx.settings.update({ whatsapp: '919876543210', announcements: ['Open on Sundays'] });
      const res = await app.api('/api/settings');
      assert.equal(res.body.whatsapp, '919876543210');
      assert.deepEqual(res.body.announcements, ['Open on Sundays']);
    } finally {
      await app.close();
    }
  });
});

describe('test helpers', () => {
  test('fixtures: the small catalogue every route test starts from', () => {
    const { db } = t.ctx;
    const { categories, vehicles, products, coupon, admin, customer } = t.fixtures;

    assert.equal(db.get('SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NULL').n, 2);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NOT NULL').n, 2);
    assert.equal(db.get('SELECT parent_id FROM categories WHERE slug = ?', [categories.spoilers.slug]).parent_id, categories.exterior.id);
    assert.equal(db.get('SELECT parent_id FROM categories WHERE slug = ?', [categories.alloys.slug]).parent_id, categories.wheels.id);

    assert.equal(db.get('SELECT COUNT(*) AS n FROM vehicles').n, 3);
    const swifts = db.all("SELECT id, pcd, body_type FROM vehicles WHERE model_slug = 'swift' ORDER BY year_from");
    assert.deepEqual(swifts.map((row) => row.id), [vehicles.swiftOld.id, vehicles.swiftNew.id]);
    assert.ok(swifts.every((row) => row.pcd === '4x100' && row.body_type === 'hatchback'));
    assert.equal(db.get('SELECT body_type FROM vehicles WHERE id = ?', [vehicles.creta.id]).body_type, 'suv');

    assert.equal(db.get('SELECT COUNT(*) AS n FROM products').n, 6);
    const row = (product) => db.get('SELECT * FROM v_products WHERE id = ? AND slug = ?', [product.id, product.slug]);
    assert.equal(row(products.spoiler).fitment_type, 'vehicle');
    assert.deepEqual(db.all('SELECT vehicle_id, fit_type, is_verified FROM product_fitments WHERE product_id = ?', [products.spoiler.id]), [
      { vehicle_id: vehicles.swiftOld.id, fit_type: 'direct', is_verified: 1 },
    ]);
    assert.equal(row(products.universal).fitment_type, 'universal');
    assert.equal(row(products.bodyType).fitment_type, 'body_type');
    assert.deepEqual(JSON.parse(row(products.bodyType).body_types), ['hatchback']);
    assert.equal(row(products.wheel).fitment_type, 'pcd');
    assert.equal(row(products.wheel).pcd, '4x100');
    assert.equal(row(products.outOfStock).stock, 0);
    assert.equal(row(products.showPlate).custom_kind, 'show-plate');
    assert.equal(row(products.showPlate).cod_eligible, 0);
    assert.equal(row(products.spoiler).sale_price, products.spoiler.price);
    assert.equal(row(products.spoiler).parent_category_slug, categories.exterior.slug);

    const variants = db.all('SELECT id, price, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order', [products.wheel.id]);
    assert.deepEqual(variants.map((variant) => variant.id), products.wheel.variants.map((variant) => variant.id));
    assert.equal(variants.length, 2);
    assert.equal(row(products.wheel).price, Math.min(...variants.map((variant) => variant.price)));
    assert.equal(row(products.wheel).stock, variants.reduce((sum, variant) => sum + variant.stock, 0));

    assert.deepEqual(db.get('SELECT type, value, is_active FROM coupons WHERE code = ?', [coupon.code]), { type: 'percent', value: 10, is_active: 1 });
    assert.equal(db.get('SELECT role FROM users WHERE id = ?', [admin.id]).role, 'admin');
    assert.equal(db.get('SELECT role FROM users WHERE id = ?', [customer.id]).role, 'customer');
    assert.equal(db.get('SELECT COUNT(*) AS n FROM products WHERE is_demo = 1').n, 0);
  });

  test('each client keeps its own cookies and every app has its own database', async () => {
    const other = await startTestApp();
    try {
      assert.notEqual(other.url, t.url);
      other.ctx.db.run('DELETE FROM products');
      assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM products').n, 6);
      assert.notEqual(other.ctx.config.uploadsDir, t.ctx.config.uploadsDir);
      assert.equal(other.ctx.config.isTest, true);
      assert.equal(other.ctx.config.dbPath, ':memory:');
    } finally {
      await other.close();
    }
    assert.equal(fs.existsSync(other.ctx.config.uploadsDir), false);
  });
});

describe('uploads', () => {
  let mini;
  let png;
  const filesOnDisk = () => fs.readdirSync(t.ctx.config.uploadsDir).sort();
  // Read through a buffer: sharp keeps a file it opened by path locked on Windows.
  const metadataOf = (name) => sharp(fs.readFileSync(path.join(t.ctx.config.uploadsDir, name))).metadata();
  const form = (...parts) => {
    const data = new FormData();
    for (const [field, content, type, name] of parts) data.append(field, new Blob([content], { type }), name);
    return data;
  };

  before(async () => {
    png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#FFD500' } }).png().toBuffer();
    mini = await startMiniApp(t.ctx, (app) => {
      app.post('/photos', imageUpload({ field: 'photos', maxFiles: 2, maxSizeMb: 1 }), async (req, res) => {
        res.status(201).json({ urls: await saveImages(t.ctx, req.files) });
      });
      app.post('/tiny', imageUpload({ maxFiles: 1, maxSizeMb: 0.001 }), async (req, res) => {
        res.status(201).json({ urls: await saveImages(t.ctx, req.files) });
      });
    });
  });
  after(() => mini.close());

  test('a PNG goes in, a 1200px WebP and a 480px WebP come out, served from /uploads', async () => {
    assert.deepEqual(filesOnDisk(), []);
    const res = await mini.call('/photos', { method: 'POST', body: form(['photos', png, 'image/png', 'wheel.png']) });
    assert.equal(res.status, 201);
    assert.equal(res.body.urls.length, 1);
    const [url] = res.body.urls;
    assert.match(url, /^\/uploads\/[a-f0-9]{24}\.webp$/);

    const name = path.basename(url, '.webp');
    assert.deepEqual(filesOnDisk(), [`${name}-480.webp`, `${name}.webp`]);
    const large = await metadataOf(`${name}.webp`);
    const thumb = await metadataOf(`${name}-480.webp`);
    assert.deepEqual([large.format, large.width, large.height], ['webp', 1200, 675]);
    assert.deepEqual([thumb.format, thumb.width, thumb.height], ['webp', 480, 270]);

    for (const served of [url, url.replace('.webp', '-480.webp')]) {
      const response = await fetch(t.url + served);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/webp');
      assert.match(response.headers.get('cache-control'), /max-age=31536000, immutable/);
      await response.arrayBuffer();
    }
  });

  test('small images are not enlarged, and several files keep their order', async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 0.5 } } }).webp().toBuffer();
    const jpeg = await sharp({ create: { width: 2400, height: 600, channels: 3, background: '#111111' } }).jpeg().toBuffer();
    const res = await mini.call('/photos', {
      method: 'POST',
      body: form(['photos', small, 'image/webp', 'small.webp'], ['photos', jpeg, 'application/octet-stream', 'IMG_0001']),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.urls.length, 2);
    const widths = [];
    for (const url of res.body.urls) {
      const file = path.basename(url);
      widths.push((await metadataOf(file)).width, (await metadataOf(file.replace('.webp', '-480.webp'))).width);
    }
    assert.deepEqual(widths, [300, 300, 1200, 480]);
  });

  test('files are judged by content: a renamed script or an SVG is refused and nothing is written', async () => {
    const before = filesOnDisk();
    const fake = await mini.call('/photos', { method: 'POST', body: form(['photos', '<?php system($_GET["c"]); ?>', 'image/png', 'photo.png']) });
    assert.equal(fake.status, 400);
    assert.deepEqual(fake.body, { error: { code: 'validation_error', message: 'Only JPG, PNG and WebP images can be uploaded.' } });

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    const vector = await mini.call('/photos', { method: 'POST', body: form(['photos', svg, 'image/png', 'logo.png']) });
    assert.equal(vector.status, 400);

    const mixed = await mini.call('/photos', { method: 'POST', body: form(['photos', png, 'image/png', 'ok.png'], ['photos', 'plain text', 'image/jpeg', 'bad.jpg']) });
    assert.equal(mixed.status, 400);
    assert.deepEqual(filesOnDisk(), before);
  });

  test('limits: no file, too many files, the wrong field and an oversized file are all plain 400s', async () => {
    const none = await mini.call('/photos', { method: 'POST', body: {} });
    assert.equal(none.status, 400);
    assert.equal(none.body.error.message, 'Choose at least one image to upload.');

    const tooMany = await mini.call('/photos', {
      method: 'POST',
      body: form(['photos', png, 'image/png', 'a.png'], ['photos', png, 'image/png', 'b.png'], ['photos', png, 'image/png', 'c.png']),
    });
    assert.equal(tooMany.status, 400);
    assert.equal(tooMany.body.error.message, 'You can upload up to 2 images at a time.');

    const wrongField = await mini.call('/photos', { method: 'POST', body: form(['avatar', png, 'image/png', 'a.png']) });
    assert.equal(wrongField.status, 400);
    assert.equal(wrongField.body.error.message, 'Send the images in the "photos" field.');

    const tooBig = await mini.call('/tiny', { method: 'POST', body: form(['images', png, 'image/png', 'a.png']) });
    assert.equal(tooBig.status, 400);
    assert.equal(tooBig.body.error.message, 'Each image must be 0.001 MB or smaller.');
  });
});

describe('rate limits', () => {
  test('nothing is limited under test, and a limiter answers 429 with ApiErrorBody elsewhere', async () => {
    const limiter = createLimiter({ windowMs: 60_000, limit: 2, message: 'Slow down.' });
    const mini = await startMiniApp(t.ctx, (app) => {
      app.get('/limited', limiter, (req, res) => res.json({ ok: true }));
      app.post('/login', limiters.auth, (req, res) => res.json({ ok: true }));
    });
    try {
      for (let i = 0; i < 6; i += 1) assert.equal((await mini.call('/limited')).status, 200);
      for (let i = 0; i < 15; i += 1) {
        assert.equal((await mini.call('/login', { method: 'POST', body: { email: 'a@b.co' } })).status, 200);
      }

      process.env.NODE_ENV = 'production';
      assert.equal((await mini.call('/limited')).status, 200);
      assert.equal((await mini.call('/limited')).status, 200);
      const blocked = await mini.call('/limited');
      assert.equal(blocked.status, 429);
      assert.deepEqual(blocked.body, { error: { code: 'rate_limited', message: 'Slow down.' } });

      // Sign-in attempts are counted per email: ten tries, then that account is locked out for the window.
      const attempt = (email) => mini.call('/login', { method: 'POST', body: { email } });
      for (let i = 0; i < 10; i += 1) assert.equal((await attempt('Target@Example.com')).status, 200);
      const locked = await attempt(' target@example.com ');
      assert.equal(locked.status, 429);
      assert.equal(locked.body.error.code, 'rate_limited');
      assert.equal((await attempt('someone-else@example.com')).status, 200);
    } finally {
      process.env.NODE_ENV = 'test';
      await mini.close();
    }
    assert.deepEqual(Object.keys(limiters).sort(), ['auth', 'forms', 'lookup']);
  });
});

describe('mailer', () => {
  test('without SMTP a message is kept in the outbox and send never throws', async () => {
    const { mailer } = t.ctx;
    assert.equal(mailer.configured, false);
    const before = mailer.outbox.length;

    const result = await mailer.send({ to: 'kiran@example.com', subject: 'Your order ADN-261117-4F7K', text: 'Thank you.' });
    assert.deepEqual(result, { ok: true, logged: true });
    assert.equal(mailer.outbox.length, before + 1);
    const last = mailer.outbox.at(-1);
    assert.equal(last.to, 'kiran@example.com');
    assert.equal(last.subject, 'Your order ADN-261117-4F7K');
    assert.match(last.from, /^"Addon Automotive" <no-reply@localhost>$/);

    assert.deepEqual(await mailer.send({ subject: 'No recipient' }), { ok: false, reason: 'incomplete' });
    assert.deepEqual(await mailer.send(), { ok: false, reason: 'incomplete' });
    assert.equal(mailer.outbox.length, before + 1);
  });

  test('a mail server that fails is reported, not thrown', async () => {
    // Stands in for a broken SMTP server: it accepts the connection and hangs up at once.
    const broken = net.createServer((socket) => socket.destroy());
    await new Promise((resolve) => broken.listen(0, '127.0.0.1', resolve));
    const app = await startTestApp({
      fixtures: false,
      config: {
        smtp: { host: '127.0.0.1', port: broken.address().port, secure: false, user: '', pass: '', from: 'Addon <orders@addon.example>' },
      },
    });
    const log = mock.method(console, 'error', () => {});
    try {
      assert.equal(app.ctx.mailer.configured, true);
      const result = await app.ctx.mailer.send({ to: 'kiran@example.com', subject: 'Hello', text: 'Hi' });
      assert.deepEqual(result, { ok: false, reason: 'failed' });
      assert.equal(log.mock.callCount(), 1);
      assert.equal(app.ctx.mailer.outbox.length, 0);
    } finally {
      log.mock.restore();
      await app.close();
      await new Promise((resolve) => broken.close(resolve));
    }
  });
});

// Kept to what any version of routes/seo.js must do, so it stays green when sitemap and meta injection arrive.
describe('serving the built client', () => {
  test('in production: hashed assets, static files and index.html for page addresses', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'addon-test-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Addon Auto Motive</title><div id="root"></div>');
    fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
    fs.writeFileSync(path.join(dist, 'theme-init.js'), '// theme');

    // With the test catalogue, so the product and category addresses below are real pages.
    const app = await startTestApp({ config: { isProd: true, clientDist: dist } });
    try {
      for (const page of ['/', '/p/addon-aero-roof-spoiler-swift', '/shop/exterior-styling/spoilers-wings', '/admin/orders']) {
        const res = await app.api(page);
        assert.equal(res.status, 200, page);
        assert.match(res.headers.get('content-type'), /text\/html/);
        assert.doesNotMatch(res.headers.get('cache-control') ?? '', /immutable/);
        assert.match(res.body, /<div id="root">/);
      }

      // An address with nothing behind it still gets the app shell, so the client can draw its
      // not-found page, but with a 404 so search engines do not list it.
      for (const page of ['/p/no-such-part', '/shop/lighting/led-bulbs']) {
        const res = await app.api(page);
        assert.equal(res.status, 404, page);
        assert.match(res.headers.get('content-type'), /text\/html/);
        assert.match(res.body, /<div id="root">/);
      }

      const asset = await app.api('/assets/index-abc123.js');
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
      assert.match(asset.headers.get('cache-control'), /immutable/);

      const file = await app.api('/theme-init.js');
      assert.equal(file.status, 200);
      assert.doesNotMatch(file.headers.get('cache-control') ?? '', /immutable/);

      // A missing file is a 404, never the app shell with a 200.
      for (const missing of ['/assets/gone-000.js', '/catalog/spoiler/missing.webp']) {
        assert.equal((await app.api(missing)).status, 404, missing);
      }
      const api404 = await app.api('/api/this-route-does-not-exist');
      assert.equal(api404.status, 404);
      assert.equal(api404.body.error.code, 'not_found');
      assert.equal((await app.api('/api/health')).body.ok, true);
      assert.match((await app.api('/api/health')).headers.get('strict-transport-security'), /max-age/);
    } finally {
      await app.close();
      fs.rmSync(dist, { recursive: true, force: true });
    }
  });
});
