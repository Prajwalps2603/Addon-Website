import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/lib/settings.js';

let t;
let admin;
let customer;

before(async () => {
  t = await startTestApp();
  t.ctx.now = () => '2026-11-17T10:00:00Z';
  admin = t.asAdmin();
  customer = t.asCustomer();
});
after(() => t.close());

const insert = (sql, params) => Number(t.ctx.db.run(sql, params).lastInsertRowid);
const count = (sql, params) => t.ctx.db.get(sql, params).n;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

describe('permissions', () => {
  const routes = [
    ['GET', '/api/admin/settings'],
    ['PUT', '/api/admin/settings', { storeName: 'Hacked' }],
    ['POST', '/api/admin/demo/clear'],
    ['GET', '/api/admin/demo'],
    ['GET', '/api/admin/enquiries'],
    ['PUT', '/api/admin/enquiries/1', { status: 'resolved' }],
    ['GET', '/api/admin/leads'],
    ['PUT', '/api/admin/leads/1', { status: 'contacted' }],
    ['GET', '/api/admin/kits'],
    ['PUT', '/api/admin/kits/1', { status: 'contacted' }],
    ['GET', '/api/admin/stock-alerts'],
    ['PUT', '/api/admin/stock-alerts/1', { status: 'notified' }],
  ];

  for (const [method, path, body] of routes) {
    test(`${method} ${path} needs an admin`, async () => {
      const anon = await t.newClient()(path, { method, body });
      assert.equal(anon.status, 401);
      assert.equal(anon.body.error.code, 'unauthorized');
      const asCustomer = await customer(path, { method, body });
      assert.equal(asCustomer.status, 403);
      assert.equal(asCustomer.body.error.code, 'forbidden');
    });
  }

  test('nothing changed after the refused calls', () => {
    assert.equal(t.ctx.settings.get().storeName, DEFAULT_SETTINGS.storeName);
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('settings', () => {
  test('GET returns AdminSettings', async () => {
    const res = await admin('/api/admin/settings');
    assert.equal(res.status, 200);
    const s = res.body;
    assert.equal(s.storeName, DEFAULT_SETTINGS.storeName);
    assert.ok(Array.isArray(s.allPromos));
    assert.ok(Array.isArray(s.searchSynonyms));
    assert.equal(typeof s.notifications.smtpConfigured, 'boolean');
    assert.equal(typeof s.notifications.razorpayConfigured, 'boolean');
    assert.equal(typeof s.hasDemoData, 'boolean');
    assert.equal(s.invoice.prefix, 'ADN');
    assert.equal(s.phone, DEFAULT_SETTINGS.phone);
    assert.ok(Array.isArray(s.services) && s.services.length > 0, 'the fitting services come with the settings');
    assert.equal(typeof s.studio.enabled, 'boolean');
  });

  test('PUT takes the studio, its services, EMI and the extra phone numbers', async () => {
    const current = (await admin('/api/admin/settings')).body;
    const services = current.services.map((service) =>
      service.id === 'wheels' ? { ...service, subcategorySlugs: ['alloy-wheels', 'wheel-hardware'] } : service,
    );
    const res = await admin('/api/admin/settings', {
      method: 'PUT',
      body: {
        phones: ['+91 80752 43040'],
        grievanceOfficer: { designation: 'Proprietor' },
        studio: { carsPerSlot: 3 },
        services,
        emi: { minAmount: 5000 },
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.phones, ['+91 80752 43040']);
    assert.equal(res.body.grievanceOfficer.designation, 'Proprietor');
    assert.equal(res.body.studio.carsPerSlot, 3);
    assert.equal(res.body.studio.slots.length, current.studio.slots.length, 'untouched studio fields kept');
    assert.deepEqual(res.body.services.find((service) => service.id === 'wheels').subcategorySlugs, ['alloy-wheels', 'wheel-hardware']);
    assert.equal(res.body.emi.minAmount, 5000);
    assert.equal(res.body.emi.partner, current.emi.partner);

    await rejects({ services: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] }, 'services.1.id');
    await rejects({ studio: { teleport: true } }, 'studio.teleport');
    await rejects({ emi: { minAmount: -1 } }, 'emi.minAmount');

    // Put back what the other tests expect.
    await admin('/api/admin/settings', { method: 'PUT', body: { studio: current.studio, services: current.services, emi: current.emi } });
  });

  test('PUT round-trips a deep partial and keeps everything else', async () => {
    const res = await admin('/api/admin/settings', {
      method: 'PUT',
      body: {
        phone: '+91 98765 43210',
        whatsapp: '919876543210',
        email: 'Shop@Example.com',
        address: { city: 'Bengaluru', pincode: '560001', state: 'Karnataka' },
        gstin: '29abcde1234f1z5',
        shipping: { flatFee: 99 },
        cod: { advancePercent: 20 },
        prepaidDiscountPercent: 3,
        payments: { upiId: 'addonauto@okhdfcbank', upiPayeeName: 'Addon Auto Motive' },
        invoice: { footerNote: 'Thank you.' },
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const s = res.body;
    assert.equal(s.phone, '+91 98765 43210');
    assert.equal(s.whatsapp, '919876543210');
    assert.equal(s.email, 'shop@example.com');
    assert.equal(s.address.city, 'Bengaluru');
    assert.equal(s.address.pincode, '560001');
    assert.equal(s.address.line1, '');
    assert.equal(s.gstin, '29ABCDE1234F1Z5');
    assert.equal(s.shipping.flatFee, 99);
    assert.equal(s.shipping.freeShippingThreshold, 999, 'untouched sibling kept');
    assert.equal(s.cod.advancePercent, 20);
    assert.equal(s.cod.fee, 49);
    assert.equal(s.prepaidDiscountPercent, 3);
    assert.equal(s.payments.upi, true);
    assert.equal(s.payments.upiId, 'addonauto@okhdfcbank');
    assert.equal(s.invoice.footerNote, 'Thank you.');
    assert.equal(s.invoice.prefix, 'ADN');

    const again = await admin('/api/admin/settings');
    assert.deepEqual(again.body, s);
  });

  test('the whole GET body can be sent back unchanged', async () => {
    const current = (await admin('/api/admin/settings')).body;
    const res = await admin('/api/admin/settings', { method: 'PUT', body: current });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, current);
  });

  test('public settings reflect an update', async () => {
    await admin('/api/admin/settings', {
      method: 'PUT',
      body: { tagline: 'Parts that fit.', fitPromise: { enabled: false }, announcements: ['One line only'] },
    });
    const pub = await t.api('/api/settings');
    assert.equal(pub.status, 200);
    assert.equal(pub.body.tagline, 'Parts that fit.');
    assert.equal(pub.body.fitPromise.enabled, false);
    assert.deepEqual(pub.body.announcements, ['One line only']);
    assert.equal(pub.body.payments.upiId, 'addonauto@okhdfcbank');
    assert.equal(pub.body.notifications, undefined, 'private settings stay private');
    assert.equal(pub.body.searchSynonyms, undefined);
  });

  test('derived fields cannot be set', async () => {
    const res = await admin('/api/admin/settings', {
      method: 'PUT',
      body: {
        hasDemoData: true,
        payments: { razorpay: true, razorpayKeyId: 'rzp_live_fake', upi: false },
        notifications: { smtpConfigured: true, razorpayConfigured: true, orderEmail: 'orders@example.com' },
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.hasDemoData, false);
    assert.equal(res.body.payments.razorpay, Boolean(t.ctx.config.razorpay.keyId && t.ctx.config.razorpay.keySecret));
    assert.notEqual(res.body.payments.razorpayKeyId, 'rzp_live_fake');
    assert.equal(res.body.payments.upi, true, 'upi follows upiId, not the request');
    assert.equal(res.body.notifications.smtpConfigured, Boolean(t.ctx.config.smtp.host));
    assert.equal(res.body.notifications.orderEmail, 'orders@example.com');
    const stored = t.ctx.db.all('SELECT key, value FROM settings');
    for (const row of stored) {
      assert.ok(!row.value.includes('rzp_live_fake'));
      assert.ok(!row.value.includes('smtpConfigured'));
      assert.notEqual(row.key, 'hasDemoData');
    }
  });

  async function rejects(body, field) {
    const before = (await admin('/api/admin/settings')).body;
    const res = await admin('/api/admin/settings', { method: 'PUT', body });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}, got ${res.status}`);
    assert.equal(res.body.error.code, 'validation_error');
    if (field) assert.ok(res.body.error.fields?.[field], `expected a message for ${field}: ${JSON.stringify(res.body.error)}`);
    assert.deepEqual((await admin('/api/admin/settings')).body, before, 'nothing stored');
    return res;
  }

  test('unknown keys are rejected with field-level errors', async () => {
    await rejects({ colour: 'red' }, 'colour');
    await rejects({ shipping: { teleport: 1 } }, 'shipping.teleport');
    await rejects({ searchSynonyms: [{ says: 'a', means: 'b', extra: 1 }] }, 'searchSynonyms.0.extra');
    await rejects({ allPromos: [{ title: 'x', ctaHref: '/x', colour: 'red' }] }, 'allPromos.0.colour');
  });

  test('wrong types are rejected', async () => {
    await rejects({ storeName: 42 }, 'storeName');
    await rejects({ cod: { enabled: 'yes' } }, 'cod.enabled');
    await rejects({ shipping: { flatFee: '99' } }, 'shipping.flatFee');
    await rejects({ address: 'Bengaluru' }, 'address');
    await rejects({ announcements: 'one' }, 'announcements');
    await rejects([1, 2]);
  });

  test('phone formats', async () => {
    await rejects({ phone: '12345' }, 'phone');
    await rejects({ phone: 'call me' }, 'phone');
    await rejects({ grievanceOfficer: { phone: '98765' } }, 'grievanceOfficer.phone');
    const ok = await admin('/api/admin/settings', { method: 'PUT', body: { phone: '080-2345 6789' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.phone, '080-2345 6789');
  });

  test('WhatsApp is digits with the country code', async () => {
    await rejects({ whatsapp: 'wa.me/919876543210' }, 'whatsapp');
    await rejects({ whatsapp: '12345' }, 'whatsapp');
    const ok = await admin('/api/admin/settings', { method: 'PUT', body: { whatsapp: '+91 98765-43210' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.whatsapp, '919876543210');
    const cleared = await admin('/api/admin/settings', { method: 'PUT', body: { whatsapp: '' } });
    assert.equal(cleared.body.whatsapp, '');
  });

  test('pincodes, GSTIN and UPI id', async () => {
    await rejects({ address: { pincode: '56001' } }, 'address.pincode');
    await rejects({ shipping: { originPincode: '012345' } }, 'shipping.originPincode');
    await rejects({ gstin: '29ABCDE1234F1Z' }, 'gstin');
    await rejects({ gstin: '99ABCDE1234F1Z5' }, 'gstin');
    await rejects({ payments: { upiId: 'addonauto' } }, 'payments.upiId');
    await rejects({ payments: { upiId: 'addon auto@ok' } }, 'payments.upiId');
  });

  test('percentages stay within 0 to 100 and money is never negative', async () => {
    await rejects({ prepaidDiscountPercent: -1 }, 'prepaidDiscountPercent');
    await rejects({ prepaidDiscountPercent: 101 }, 'prepaidDiscountPercent');
    await rejects({ cod: { advancePercent: 150 } }, 'cod.advancePercent');
    await rejects({ cod: { fee: -10 } }, 'cod.fee');
    await rejects({ shipping: { freeShippingThreshold: -1 } }, 'shipping.freeShippingThreshold');
    await rejects({ shipping: { flatFee: 9.5 } }, 'shipping.flatFee');
  });

  test('promo ids must be unique', async () => {
    const promo = (id) => ({ id, title: `Banner ${id}`, ctaHref: '/shop' });
    await rejects({ allPromos: [promo('a'), promo('b'), promo('a')] }, 'allPromos.2.id');
    const ok = await admin('/api/admin/settings', { method: 'PUT', body: { allPromos: [promo('a'), promo('b')] } });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual(
      ok.body.allPromos.map((p) => p.id),
      ['a', 'b'],
    );
  });

  test('promos outside their window are kept in allPromos but not shown publicly', async () => {
    const res = await admin('/api/admin/settings', {
      method: 'PUT',
      body: {
        allPromos: [
          { id: 'now', title: 'Live', ctaHref: '/shop' },
          { id: 'later', title: 'Later', ctaHref: '/shop', startsAt: '2027-01-01T00:00:00Z' },
        ],
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.allPromos.map((p) => p.id), ['now', 'later']);
    assert.deepEqual(res.body.promos.map((p) => p.id), ['now']);
    const pub = await t.api('/api/settings');
    assert.deepEqual(pub.body.promos.map((p) => p.id), ['now']);
  });

  test('synonym entries must not be empty', async () => {
    await rejects({ searchSynonyms: [{ says: '', means: 'boot' }] }, 'searchSynonyms.0.says');
    await rejects({ searchSynonyms: [{ says: 'dikki', means: '   ' }] }, 'searchSynonyms.0.means');
    await rejects({ searchSynonyms: [{ says: 'dikki' }] }, 'searchSynonyms.0.means');
    const ok = await admin('/api/admin/settings', {
      method: 'PUT',
      body: { searchSynonyms: [{ says: 'Dikki', means: 'boot' }] },
    });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.searchSynonyms, [{ says: 'dikki', means: 'boot' }]);
    assert.deepEqual(t.ctx.settings.get().searchSynonyms, [{ says: 'dikki', means: 'boot' }]);
  });
});

// ---------------------------------------------------------------------------
// Demo clear
// ---------------------------------------------------------------------------

describe('demo clear', () => {
  test('removes every demo row and leaves real rows alone', async () => {
    const f = t.fixtures;
    const db = t.ctx.db;
    const ids = db.tx(() => {
      const product = (slug, isDemo) =>
        insert('INSERT INTO products (slug, sku, name, category_id, price, mrp, stock, is_demo) VALUES (?, ?, ?, ?, 999, 1299, 5, ?)', [
          slug,
          slug.toUpperCase(),
          `Product ${slug}`,
          f.categories.spoilers.id,
          isDemo,
        ]);
      const demoProduct = product('demo-part', 1);
      const demoProduct2 = product('demo-part-2', 1);
      insert("INSERT INTO product_variants (product_id, name, sku, price, mrp, stock) VALUES (?, 'Black', 'DEMO-V1', 999, 1299, 2)", [demoProduct]);
      insert("INSERT INTO product_fitments (product_id, vehicle_id, fit_type) VALUES (?, ?, 'direct')", [demoProduct, f.vehicles.swiftOld.id]);
      insert("INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'requires')", [demoProduct, f.products.universal.id]);
      insert("INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'pairs_with')", [f.products.spoiler.id, demoProduct]);
      insert("INSERT INTO category_picks (category_id, tier, product_id) VALUES (?, 'sensible', ?)", [f.categories.spoilers.id, demoProduct]);
      insert("INSERT INTO category_picks (category_id, tier, product_id) VALUES (?, 'all_out', ?)", [f.categories.spoilers.id, f.products.spoiler.id]);
      insert('INSERT INTO price_history (product_id, price, mrp) VALUES (?, 999, 1299)', [demoProduct]);
      insert('INSERT INTO price_history (product_id, price, mrp) VALUES (?, 999, 1299)', [demoProduct2]);

      const realDrop = insert("INSERT INTO drops (title, starts_at, ends_at) VALUES ('Real drop', '2026-11-14T00:00:00Z', '2026-11-20T00:00:00Z')");
      const demoDrop = insert("INSERT INTO drops (title, starts_at, ends_at, is_demo) VALUES ('Demo drop', '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z', 1)");
      insert('INSERT INTO drop_items (drop_id, product_id, percent_off) VALUES (?, ?, 10)', [realDrop, demoProduct]);
      insert('INSERT INTO drop_items (drop_id, product_id, percent_off) VALUES (?, ?, 10)', [realDrop, f.products.universal.id]);
      insert('INSERT INTO drop_items (drop_id, product_id, percent_off) VALUES (?, ?, 10)', [demoDrop, f.products.spoiler.id]);

      const review = (productId, isDemo) =>
        insert("INSERT INTO reviews (product_id, author_name, rating, status, is_demo) VALUES (?, 'R', 5, 'approved', ?)", [productId, isDemo]);
      review(demoProduct, 1);
      review(f.products.spoiler.id, 1);
      const realReview = review(f.products.spoiler.id, 0);
      const question = (productId, isDemo) =>
        insert("INSERT INTO product_questions (product_id, author_name, question, is_demo) VALUES (?, 'Q', 'Fits?', ?)", [productId, isDemo]);
      question(demoProduct, 1);
      question(f.products.universal.id, 1);
      const realQuestion = question(f.products.universal.id, 0);

      insert('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [f.customer.id, demoProduct]);
      insert('INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [f.customer.id, f.products.spoiler.id]);

      const order = (number, isDemo, productId) => {
        const id = insert(
          `INSERT INTO orders (order_number, access_token, payment_method, customer_name, phone, ship_name, ship_phone, ship_line1,
             ship_city, ship_state, ship_pincode, subtotal, total, is_demo)
           VALUES (?, 'tok', 'cod', 'C', '9876543210', 'C', '9876543210', '1 Road', 'Pune', 'Maharashtra', '411001', 999, 999, ?)`,
          [number, isDemo],
        );
        insert("INSERT INTO order_items (order_id, product_id, name, price, mrp, qty) VALUES (?, ?, 'Line', 999, 1299, 1)", [id, productId]);
        insert("INSERT INTO order_events (order_id, status) VALUES (?, 'placed')", [id]);
        return id;
      };
      order('ADN-DEMO-1', 1, demoProduct);
      order('ADN-DEMO-2', 1, f.products.spoiler.id);
      const realOrder = order('ADN-REAL-1', 0, demoProduct);

      const enquiry = insert(
        "INSERT INTO enquiries (ticket_number, name, message, product_id) VALUES ('ADN-T-000900', 'E', 'Hello', ?)",
        [demoProduct],
      );
      insert("INSERT INTO stock_alerts (product_id, phone) VALUES (?, '9876543210')", [demoProduct]);
      const realAlert = insert("INSERT INTO stock_alerts (product_id, phone) VALUES (?, '9876543210')", [f.products.outOfStock.id]);

      insert("INSERT INTO builds (slug, title, state, is_demo) VALUES ('demo-build', 'Demo', '{}', 1)");
      const realBuild = insert("INSERT INTO builds (slug, title, state) VALUES ('real-build', 'Real', '{}')");
      insert("INSERT INTO coupons (code, type, value, is_demo) VALUES ('DEMO5', 'percent', 5, 1)");
      const booking = (number, isDemo) =>
        insert("INSERT INTO bookings (booking_number, date, slot, name, phone, is_demo) VALUES (?, '2026-11-20', '10:00', 'B', '9876543210', ?)", [
          number,
          isDemo,
        ]);
      booking('ADN-B-900001', 1);
      booking('ADN-B-900002', 0);

      return { demoProduct, realDrop, demoDrop, realReview, realQuestion, realOrder, enquiry, realAlert, realBuild };
    });

    const categoriesBefore = count('SELECT COUNT(*) AS n FROM categories');
    const vehiclesBefore = count('SELECT COUNT(*) AS n FROM vehicles');
    const settingsBefore = (await admin('/api/admin/settings')).body;
    assert.equal(settingsBefore.hasDemoData, true);
    const realProductsBefore = count('SELECT COUNT(*) AS n FROM products WHERE is_demo = 0');

    const counted = await admin('/api/admin/demo');
    assert.equal(counted.status, 200);
    assert.deepEqual(counted.body.counts, {
      products: 2,
      orders: 2,
      bookings: 1,
      reports: count('SELECT COUNT(*) AS n FROM reviews WHERE is_demo = 1'),
      questions: count('SELECT COUNT(*) AS n FROM product_questions WHERE is_demo = 1'),
      builds: 1,
      coupons: 1,
      drops: 1,
    });

    const res = await admin('/api/admin/demo/clear', { method: 'POST' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const r = res.body.removed;
    assert.equal(r.products, 2);
    assert.equal(r.variants, 1);
    assert.equal(r.fitments, 1);
    assert.equal(r.relations, 2);
    assert.equal(r.picks, 1);
    assert.equal(r.priceHistory, 2);
    assert.equal(r.drops, 1);
    assert.equal(r.dropItems, 2);
    assert.equal(r.reports, 2);
    assert.equal(r.questions, 2);
    assert.equal(r.orders, 2);
    assert.equal(r.orderItems, 2);
    assert.equal(r.orderEvents, 2);
    assert.equal(r.builds, 1);
    assert.equal(r.coupons, 1);
    assert.equal(r.wishlistItems, 1);
    assert.equal(r.stockAlerts, 1);
    assert.equal(r.bookings, 1);
    assert.equal(count("SELECT COUNT(*) AS n FROM bookings WHERE booking_number = 'ADN-B-900002'"), 1, 'a real booking stays');
    assert.ok(Object.values((await admin('/api/admin/demo')).body.counts).every((n) => n === 0));

    for (const table of ['products', 'drops', 'reviews', 'product_questions', 'orders', 'builds', 'coupons']) {
      assert.equal(count(`SELECT COUNT(*) AS n FROM ${table} WHERE is_demo = 1`), 0, table);
    }
    assert.equal(count('SELECT COUNT(*) AS n FROM products WHERE is_demo = 0'), realProductsBefore);
    assert.equal(count('SELECT COUNT(*) AS n FROM categories'), categoriesBefore);
    assert.equal(count('SELECT COUNT(*) AS n FROM vehicles'), vehiclesBefore);
    assert.equal(count('SELECT COUNT(*) AS n FROM drops WHERE id = ?', [ids.realDrop]), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM drop_items WHERE drop_id = ?', [ids.realDrop]), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM reviews WHERE id = ?', [ids.realReview]), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM product_questions WHERE id = ?', [ids.realQuestion]), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM builds WHERE id = ?', [ids.realBuild]), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM stock_alerts WHERE id = ?', [ids.realAlert]), 1);
    assert.equal(count("SELECT COUNT(*) AS n FROM coupons WHERE code = 'FIT10'"), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM category_picks'), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM wishlist_items'), 1);
    assert.equal(count('SELECT COUNT(*) AS n FROM product_relations'), 0);

    // The real order keeps its line (name and price) and only loses the link to the sample product.
    const realItems = t.ctx.db.all('SELECT * FROM order_items WHERE order_id = ?', [ids.realOrder]);
    assert.equal(realItems.length, 1);
    assert.equal(realItems[0].product_id, null);
    assert.equal(realItems[0].name, 'Line');
    assert.equal(count('SELECT COUNT(*) AS n FROM order_events WHERE order_id = ?', [ids.realOrder]), 1);
    assert.equal(t.ctx.db.get('SELECT product_id FROM enquiries WHERE id = ?', [ids.enquiry]).product_id, null);

    const settingsAfter = (await admin('/api/admin/settings')).body;
    assert.equal(settingsAfter.hasDemoData, false);
    assert.deepEqual({ ...settingsAfter, hasDemoData: true }, settingsBefore);

    const second = await admin('/api/admin/demo/clear', { method: 'POST' });
    assert.equal(second.status, 200);
    assert.ok(Object.values(second.body.removed).every((n) => n === 0), JSON.stringify(second.body));
  });
});

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

describe('enquiries', () => {
  let ids;
  before(() => {
    const e = (ticket, kind, status, name, created, productId = null) =>
      insert(
        'INSERT INTO enquiries (ticket_number, kind, name, phone, email, subject, message, status, product_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [ticket, kind, name, '9876543210', '', 'Subject', `Message from ${name}`, status, productId, created, created],
      );
    ids = {
      a: e('ADN-T-000001', 'contact', 'new', 'Anil', '2026-11-10T10:00:00Z', t.fixtures.products.spoiler.id),
      b: e('ADN-T-000002', 'complaint', 'new', 'Bina', '2026-11-12T10:00:00Z'),
      c: e('ADN-T-000003', 'bulk', 'resolved', 'Chetan 100%', '2026-11-11T10:00:00Z'),
    };
  });

  test('lists newest first with the product name', async () => {
    const res = await admin('/api/admin/enquiries?limit=50');
    assert.equal(res.status, 200);
    const mine = res.body.items.filter((item) => Object.values(ids).includes(item.id));
    assert.deepEqual(mine.map((item) => item.id), [ids.b, ids.c, ids.a]);
    const a = mine.find((item) => item.id === ids.a);
    assert.equal(a.productName, t.fixtures.products.spoiler.name);
    assert.equal(a.ticketNumber, 'ADN-T-000001');
    assert.equal(res.body.page, 1);
    assert.equal(typeof res.body.pages, 'number');
  });

  test('filters by status, kind and q', async () => {
    const byStatus = await admin('/api/admin/enquiries?status=resolved');
    assert.ok(byStatus.body.items.every((item) => item.status === 'resolved'));
    assert.ok(byStatus.body.items.some((item) => item.id === ids.c));
    const byKind = await admin('/api/admin/enquiries?kind=complaint');
    assert.deepEqual(byKind.body.items.map((item) => item.id), [ids.b]);
    assert.equal(byKind.body.total, 1);
    const byQ = await admin('/api/admin/enquiries?q=bina');
    assert.deepEqual(byQ.body.items.map((item) => item.id), [ids.b]);
    const byTicket = await admin('/api/admin/enquiries?q=T-000003');
    assert.deepEqual(byTicket.body.items.map((item) => item.id), [ids.c]);
    const literalPercent = await admin(`/api/admin/enquiries?q=${encodeURIComponent('100%')}`);
    assert.deepEqual(literalPercent.body.items.map((item) => item.id), [ids.c]);
    const paged = await admin('/api/admin/enquiries?limit=1&page=2');
    assert.equal(paged.body.items.length, 1);
    assert.equal(paged.body.limit, 1);
  });

  test('rejects bad filters', async () => {
    assert.equal((await admin('/api/admin/enquiries?status=lost')).status, 400);
    assert.equal((await admin('/api/admin/enquiries?kind=spam')).status, 400);
    assert.equal((await admin('/api/admin/enquiries?limit=0')).status, 400);
  });

  test('updates status and note, and bumps updated_at', async () => {
    t.ctx.now = () => '2026-11-17T11:30:00Z';
    const res = await admin(`/api/admin/enquiries/${ids.a}`, { method: 'PUT', body: { status: 'acknowledged', adminNote: ' Called back. ' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'acknowledged');
    assert.equal(res.body.adminNote, 'Called back.');
    assert.equal(res.body.updatedAt, '2026-11-17T11:30:00Z');
    assert.equal(res.body.createdAt, '2026-11-10T10:00:00Z');
    assert.equal(res.body.productName, t.fixtures.products.spoiler.name);

    const noteOnly = await admin(`/api/admin/enquiries/${ids.a}`, { method: 'PUT', body: { adminNote: 'Sent the part.' } });
    assert.equal(noteOnly.body.status, 'acknowledged');
    assert.equal(noteOnly.body.adminNote, 'Sent the part.');
    t.ctx.now = () => '2026-11-17T10:00:00Z';
  });

  test('update validation and missing rows', async () => {
    const empty = await admin(`/api/admin/enquiries/${ids.a}`, { method: 'PUT', body: {} });
    assert.equal(empty.status, 400);
    const badStatus = await admin(`/api/admin/enquiries/${ids.a}`, { method: 'PUT', body: { status: 'closed' } });
    assert.equal(badStatus.status, 400);
    assert.ok(badStatus.body.error.fields.status);
    assert.equal((await admin('/api/admin/enquiries/abc', { method: 'PUT', body: { status: 'new' } })).status, 400);
    assert.equal((await admin('/api/admin/enquiries/99999', { method: 'PUT', body: { status: 'new' } })).status, 404);
  });
});

describe('leads', () => {
  let ids;
  before(() => {
    const lead = (token, name, status, created) =>
      insert(
        "INSERT INTO checkout_leads (token, name, phone, cart, cart_total, status, created_at, updated_at) VALUES (?, ?, '9876543210', ?, 1999, ?, ?, ?)",
        [token, name, JSON.stringify([{ productId: 1, name: 'Spoiler', qty: 1 }]), status, created, created],
      );
    ids = {
      old: lead('tok-old', 'Old lead', 'open', '2026-11-01T10:00:00Z'),
      mid: lead('tok-mid', 'Mid lead', 'contacted', '2026-11-05T10:00:00Z'),
      recent: lead('tok-new', 'New lead', 'open', '2026-11-16T10:00:00Z'),
    };
  });

  test('lists newest first without the browser token', async () => {
    const res = await admin('/api/admin/leads');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((item) => item.id), [ids.recent, ids.mid, ids.old]);
    assert.equal(res.body.items[0].cartTotal, 1999);
    assert.equal(res.body.items[0].cart.length, 1);
    assert.equal(res.body.items[0].token, undefined);
    assert.ok(!JSON.stringify(res.body).includes('tok-new'));
  });

  test('filters by status', async () => {
    const res = await admin('/api/admin/leads?status=open');
    assert.deepEqual(res.body.items.map((item) => item.id), [ids.recent, ids.old]);
    assert.equal(res.body.total, 2);
    assert.equal((await admin('/api/admin/leads?status=lost')).status, 400);
  });

  test('updates status', async () => {
    t.ctx.now = () => '2026-11-17T12:00:00Z';
    const res = await admin(`/api/admin/leads/${ids.old}`, { method: 'PUT', body: { status: 'dismissed' } });
    t.ctx.now = () => '2026-11-17T10:00:00Z';
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'dismissed');
    assert.equal(res.body.updatedAt, '2026-11-17T12:00:00Z');
    assert.equal((await admin(`/api/admin/leads/${ids.old}`, { method: 'PUT', body: { status: 'won' } })).status, 400);
    assert.equal((await admin(`/api/admin/leads/${ids.old}`, { method: 'PUT' })).status, 400);
    assert.equal((await admin('/api/admin/leads/99999', { method: 'PUT', body: { status: 'open' } })).status, 404);
  });
});

describe('saved kits', () => {
  let ids;
  before(() => {
    const kit = (token, status, created) =>
      insert(
        "INSERT INTO saved_kits (token, name, phone, vehicle_label, goal, budget, product_ids, total, status, created_at) VALUES (?, 'Ravi', '9876543210', 'Swift', 'new_car', 15000, '[1,2]', 12000, ?, ?)",
        [token, status, created],
      );
    ids = { a: kit('kit-a', 'open', '2026-11-02T10:00:00Z'), b: kit('kit-b', 'ordered', '2026-11-03T10:00:00Z') };
  });

  test('lists and filters', async () => {
    const res = await admin('/api/admin/kits');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((item) => item.id), [ids.b, ids.a]);
    assert.deepEqual(res.body.items[1].productIds, [1, 2]);
    assert.equal(res.body.items[1].budget, 15000);
    const open = await admin('/api/admin/kits?status=open');
    assert.deepEqual(open.body.items.map((item) => item.id), [ids.a]);
    assert.equal((await admin('/api/admin/kits?status=nope')).status, 400);
  });

  test('updates status', async () => {
    const res = await admin(`/api/admin/kits/${ids.a}`, { method: 'PUT', body: { status: 'contacted' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'contacted');
    assert.equal((await admin(`/api/admin/kits/${ids.a}`, { method: 'PUT', body: { status: 'recovered' } })).status, 400);
    assert.equal((await admin('/api/admin/kits/99999', { method: 'PUT', body: { status: 'open' } })).status, 404);
  });
});

describe('stock alerts', () => {
  let ids;
  before(() => {
    const { wheel, outOfStock } = t.fixtures.products;
    const variantId = t.ctx.db.get('SELECT id, stock FROM product_variants WHERE product_id = ? ORDER BY sort_order, id LIMIT 1', [wheel.id]);
    const alert = (productId, variant, status, created) =>
      insert('INSERT INTO stock_alerts (product_id, variant_id, phone, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        productId,
        variant,
        '9876543210',
        'a@example.com',
        status,
        created,
      ]);
    ids = {
      plain: alert(outOfStock.id, null, 'waiting', '2026-11-10T10:00:00Z'),
      variant: alert(wheel.id, variantId?.id ?? null, 'waiting', '2026-11-11T10:00:00Z'),
      done: alert(outOfStock.id, null, 'notified', '2026-11-09T10:00:00Z'),
      variantStock: variantId?.stock ?? null,
    };
  });

  test('lists with product name, slug and current stock', async () => {
    const res = await admin('/api/admin/stock-alerts');
    assert.equal(res.status, 200);
    const byId = new Map(res.body.items.map((item) => [item.id, item]));
    const plain = byId.get(ids.plain);
    assert.equal(plain.productName, t.fixtures.products.outOfStock.name);
    assert.equal(plain.productSlug, t.fixtures.products.outOfStock.slug);
    assert.equal(plain.stock, 0);
    const variant = byId.get(ids.variant);
    assert.equal(variant.productSlug, t.fixtures.products.wheel.slug);
    if (ids.variantStock !== null) assert.equal(variant.stock, ids.variantStock);
    const mine = res.body.items.filter((item) => [ids.plain, ids.variant, ids.done].includes(item.id));
    assert.deepEqual(mine.map((item) => item.id), [ids.variant, ids.plain, ids.done], 'newest first');

    t.ctx.db.run('UPDATE products SET stock = 7 WHERE id = ?', [t.fixtures.products.outOfStock.id]);
    const later = await admin('/api/admin/stock-alerts?status=waiting');
    assert.equal(later.body.items.find((item) => item.id === ids.plain).stock, 7);
    assert.ok(later.body.items.every((item) => item.status === 'waiting'));
    assert.ok(!later.body.items.some((item) => item.id === ids.done));
    t.ctx.db.run('UPDATE products SET stock = 0 WHERE id = ?', [t.fixtures.products.outOfStock.id]);
  });

  test('updates status', async () => {
    const res = await admin(`/api/admin/stock-alerts/${ids.plain}`, { method: 'PUT', body: { status: 'notified' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'notified');
    assert.equal(res.body.productName, t.fixtures.products.outOfStock.name);
    assert.equal((await admin(`/api/admin/stock-alerts/${ids.plain}`, { method: 'PUT', body: { status: 'sent' } })).status, 400);
    assert.equal((await admin('/api/admin/stock-alerts/99999', { method: 'PUT', body: { status: 'waiting' } })).status, 404);
    assert.equal((await admin('/api/admin/stock-alerts?status=gone')).status, 400);
  });
});
