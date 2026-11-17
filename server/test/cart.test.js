import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { lineKey, priceCart, priceCartDetailed } from '../src/lib/pricing.js';
import { addWorkingDays, estimateShipping } from '../src/lib/shipping.js';

let t;
let P; // fixture products
let V; // fixture vehicles

before(async () => {
  t = await startTestApp();
  P = t.fixtures.products;
  V = t.fixtures.vehicles;
});
after(() => t.close());

const price = (body) => t.api('/api/cart/price', { method: 'POST', body });
const line = (product, qty = 1, extra = {}) => ({ productId: product.id, variantId: null, qty, ...extra });
const wheelLine = (index = 0, qty = 1) => ({ productId: P.wheel.id, variantId: P.wheel.variants[index].id, qty });
const plate = (custom = { text: 'ADDON 01', acknowledged: true }, qty = 1) => ({ productId: P.showPlate.id, variantId: null, qty, custom });

/** Applies a settings patch for the duration of fn, then puts the touched keys back. */
async function withSettings(patch, fn) {
  const before = t.ctx.settings.get();
  t.ctx.settings.update(patch);
  try {
    return await fn();
  } finally {
    const restore = {};
    for (const key of Object.keys(patch)) restore[key] = before[key];
    t.ctx.settings.update(restore);
  }
}

/** Switches Razorpay and UPI on for the duration of fn. */
async function withOnlinePayments(fn) {
  const saved = t.ctx.config.razorpay;
  t.ctx.config.razorpay = { keyId: 'rzp_test_key', keySecret: 'secret', webhookSecret: 'hook' };
  try {
    return await withSettings({ payments: { upiId: 'addon@okhdfcbank', upiPayeeName: 'Addon Auto Motive' } }, fn);
  } finally {
    t.ctx.config.razorpay = saved;
  }
}

/** Runs SQL now and its undo afterwards. */
async function withSql(doSql, undoSql, fn) {
  for (const [sql, params] of doSql) t.ctx.db.run(sql, params);
  try {
    return await fn();
  } finally {
    for (const [sql, params] of undoSql) t.ctx.db.run(sql, params);
  }
}

function insertProduct(fields) {
  const row = {
    slug: `test-${Math.random().toString(36).slice(2, 10)}`,
    sku: `T-X-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Extra Part',
    category_id: t.fixtures.categories.spoilers.id,
    price: 999,
    mrp: 1299,
    stock: 10,
    is_active: 1,
    ...fields,
  };
  const { lastInsertRowid } = t.ctx.db.run(
    'INSERT INTO products (slug, sku, name, category_id, price, mrp, stock, is_active) VALUES (:slug, :sku, :name, :category_id, :price, :mrp, :stock, :is_active)',
    row,
  );
  return { ...row, id: Number(lastInsertRowid) };
}

const advice = (cart, code) => cart.advice.filter((entry) => entry.code === code);

// ---------------------------------------------------------------------------
// Line pricing
// ---------------------------------------------------------------------------

describe('line pricing', () => {
  test('prices a simple line from the catalogue and fills every PricedLine field', async () => {
    const res = await price({ items: [line(P.universal, 2)] });
    assert.equal(res.status, 200);
    const cart = res.body;
    assert.equal(cart.lines.length, 1);
    const [first] = cart.lines;
    assert.deepEqual(Object.keys(first).sort(), [
      'artKind', 'codEligible', 'custom', 'fit', 'fitAtStudio', 'fitNote', 'fittingCharge', 'fittingService', 'fittingServiceName',
      'image', 'issue', 'key', 'legality', 'lineTotal', 'maxQty',
      'name', 'productId', 'qty', 'shipClass', 'slug', 'unitMrp', 'unitPrice', 'variantId', 'variantName',
    ]);
    // A spoiler: the studio can fit it, but nobody asked.
    assert.deepEqual(first.fittingService, { id: 'body-kit', name: 'Spoiler, skirts and body kit fitting', charge: 999, minutes: 120 });
    assert.equal(first.fitAtStudio, false);
    assert.equal(first.fittingCharge, 0);
    assert.equal(first.fittingServiceName, '');
    assert.equal(cart.fulfilment, 'delivery');
    assert.equal(cart.fittingTotal, 0);
    assert.equal(cart.needsSlot, false);
    assert.equal(first.unitPrice, 1299);
    assert.equal(first.unitMrp, 1999);
    assert.equal(first.qty, 2);
    assert.equal(first.lineTotal, 2598);
    assert.equal(first.maxQty, 40);
    assert.equal(first.issue, null);
    assert.equal(first.fit, null);
    assert.equal(first.key, `${P.universal.id}:0:`);
    assert.equal(cart.itemCount, 2);
    assert.equal(cart.subtotal, 2598);
    assert.equal(cart.mrpTotal, 3998);
    assert.equal(cart.savings, 1400);
    assert.equal(cart.canCheckout, true);
    assert.deepEqual(cart.messages, []);
  });

  test('ignores prices, totals and discounts sent by the client', async () => {
    const res = await price({
      items: [{ ...line(P.universal), price: 1, unitPrice: 1, lineTotal: 1 }],
      subtotal: 1,
      total: 1,
      discount: 5000,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.lines[0].unitPrice, 1299);
    assert.equal(res.body.subtotal, 1299);
    assert.equal(res.body.discount, 0);
    assert.ok(res.body.total > 1000);
  });

  test('variant lines use the variant price and key', async () => {
    const { body } = await price({ items: [wheelLine(1)] });
    const [first] = body.lines;
    assert.equal(first.variantId, P.wheel.variants[1].id);
    assert.equal(first.variantName, '15 inch / Gunmetal');
    assert.equal(first.unitPrice, 23999);
    assert.equal(first.unitMrp, 29999);
    assert.equal(first.maxQty, 2);
    assert.equal(first.key, `${P.wheel.id}:${P.wheel.variants[1].id}:`);
  });

  test('a live drop applies to variant prices with the money helper rounding', async () => {
    const { lastInsertRowid: dropId } = t.ctx.db.run(
      "INSERT INTO drops (title, starts_at, ends_at, is_active) VALUES ('Test drop', '2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z', 1)",
    );
    t.ctx.db.run('INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, 10, ?)', [dropId, P.wheel.id, 'Test']);
    try {
      const { body } = await price({ items: [wheelLine(0), wheelLine(1)] });
      assert.equal(body.lines[0].unitPrice, 19799); // round(21999 * 0.9)
      assert.equal(body.lines[1].unitPrice, 21599); // round(23999 * 0.9)
      assert.equal(body.lines[1].unitMrp, 29999);
      assert.equal(body.subtotal, 19799 + 21599);
    } finally {
      t.ctx.db.run('DELETE FROM drop_items WHERE drop_id = ?', [dropId]);
      t.ctx.db.run('DELETE FROM drops WHERE id = ?', [dropId]);
    }
  });

  test('a product with variants needs a valid variant of its own', async () => {
    const missing = (await price({ items: [line(P.wheel)] })).body;
    assert.equal(missing.lines[0].issue, 'unavailable');
    assert.equal(missing.lines[0].lineTotal, 0);
    assert.equal(missing.subtotal, 0);
    assert.equal(missing.canCheckout, false);
    assert.match(missing.messages[0], /Choose a size or finish/);

    const wrong = (await price({ items: [{ productId: P.wheel.id, variantId: 999999, qty: 1 }] })).body;
    assert.equal(wrong.lines[0].issue, 'unavailable');

    const foreign = (await price({ items: [{ productId: P.universal.id, variantId: P.wheel.variants[0].id, qty: 1 }] })).body;
    assert.equal(foreign.lines[0].issue, 'unavailable');
    assert.equal(foreign.canCheckout, false);
  });

  test('quantity is clamped to stock with a message, and blocks checkout until accepted', async () => {
    const { body } = await price({ items: [wheelLine(1, 5)] });
    assert.equal(body.lines[0].issue, 'insufficient_stock');
    assert.equal(body.lines[0].qty, 2);
    assert.equal(body.lines[0].lineTotal, 2 * 23999);
    assert.equal(body.subtotal, 2 * 23999);
    assert.equal(body.canCheckout, false);
    assert.ok(body.messages.some((message) => /Only 2 left of .*quantity updated/.test(message)));
  });

  test('out of stock lines are reported and left out of the totals', async () => {
    const { body } = await price({ items: [line(P.outOfStock), line(P.universal)] });
    const out = body.lines.find((entry) => entry.productId === P.outOfStock.id);
    assert.equal(out.issue, 'out_of_stock');
    assert.equal(out.qty, 0);
    assert.equal(out.lineTotal, 0);
    assert.equal(body.subtotal, 1299);
    assert.equal(body.itemCount, 1);
    assert.equal(body.canCheckout, false);
    assert.ok(body.messages.some((message) => /out of stock/.test(message)));
  });

  test('inactive products are unavailable and unknown ones are taken out', async () => {
    await withSql(
      [['UPDATE products SET is_active = 0 WHERE id = ?', [P.bodyType.id]]],
      [['UPDATE products SET is_active = 1 WHERE id = ?', [P.bodyType.id]]],
      async () => {
        const { body } = await price({ items: [line(P.bodyType), line(P.universal), { productId: 987654, variantId: null, qty: 1 }] });
        assert.equal(body.lines.length, 2);
        assert.equal(body.lines[0].issue, 'unavailable');
        assert.equal(body.lines[0].lineTotal, 0);
        assert.equal(body.subtotal, 1299);
        assert.equal(body.canCheckout, false);
        assert.match(body.messages[0], /no longer listed/);
        assert.ok(body.messages.some((message) => /no longer sold/.test(message)));
      },
    );
  });

  test('repeated lines are merged into one', async () => {
    const { body } = await price({ items: [line(P.universal, 1), line(P.universal, 2)] });
    assert.equal(body.lines.length, 1);
    assert.equal(body.lines[0].qty, 3);
  });

  test('an empty cart cannot check out', async () => {
    const { body } = await price({ items: [] });
    assert.equal(body.lines.length, 0);
    assert.equal(body.total, 0);
    assert.equal(body.shippingFee, 0);
    assert.equal(body.canCheckout, false);
  });

  test('line keys are stable for the same design whatever the key order', () => {
    const a = lineKey(5, null, { text: 'ADDON', acknowledged: true, style: 'euro' });
    const b = lineKey(5, null, { style: 'euro', acknowledged: true, text: 'ADDON' });
    const c = lineKey(5, null, { style: 'jdm', acknowledged: true, text: 'ADDON' });
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^5:0:[0-9a-f]{10}$/);
    assert.equal(lineKey(5, 7, null), '5:7:');
  });
});

// ---------------------------------------------------------------------------
// Show plates
// ---------------------------------------------------------------------------

describe('custom show plates', () => {
  test('a valid design is priced and kept on the line', async () => {
    const custom = { text: 'ADDON-01', acknowledged: true, style: 'euro' };
    const { body } = await price({ items: [plate(custom)] });
    assert.equal(body.lines[0].issue, null);
    assert.deepEqual(body.lines[0].custom, custom);
    assert.equal(body.lines[0].key, lineKey(P.showPlate.id, null, custom));
    assert.equal(body.subtotal, 799);
  });

  for (const [label, custom] of [
    ['no design', null],
    ['blank text', { text: '', acknowledged: true }],
    ['more than 12 characters', { text: 'ADDON MOTIVE 1', acknowledged: true }],
    ['lower-case letters', { text: 'addon', acknowledged: true }],
    ['symbols', { text: 'ADDON!', acknowledged: true }],
    ['only spaces and hyphens', { text: ' - ', acknowledged: true }],
    ['no acknowledgement', { text: 'ADDON 01' }],
    ['acknowledgement not exactly true', { text: 'ADDON 01', acknowledged: 'yes' }],
  ]) {
    test(`is unavailable with ${label}`, async () => {
      const { body } = await price({ items: [plate(custom)] });
      assert.equal(body.lines[0].issue, 'unavailable');
      assert.equal(body.lines[0].lineTotal, 0);
      assert.equal(body.canCheckout, false);
      assert.ok(body.messages.length > 0);
    });
  }

  test('designer output on an ordinary product is dropped', async () => {
    const { body } = await price({ items: [line(P.universal, 1, { custom: { text: 'HELLO' } })] });
    assert.equal(body.lines[0].custom, null);
    assert.equal(body.lines[0].key, `${P.universal.id}:0:`);
  });
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

describe('coupons', () => {
  test('a percent coupon applies, case-insensitively', async () => {
    const { body } = await price({ items: [line(P.universal)], couponCode: ' fit10 ' });
    assert.equal(body.couponError, null);
    assert.deepEqual(body.coupon, { code: 'FIT10', description: '10% off orders above ₹999', discount: 130 });
    assert.equal(body.discount, 130); // round(129.9)
  });

  test('a percent coupon is capped by max_discount', async () => {
    const { body } = await price({ items: [wheelLine(0)], couponCode: 'FIT10' });
    assert.equal(body.discount, 500);
  });

  test('below the minimum order the coupon is refused with the gap in rupees', async () => {
    const { body } = await price({ items: [plate()], couponCode: 'FIT10' });
    assert.equal(body.coupon, null);
    assert.equal(body.discount, 0);
    assert.match(body.couponError, /₹999/);
    assert.match(body.couponError, /₹200 more/);
  });

  test('unknown, inactive, early, expired and used-up codes are refused', async () => {
    const insert = (code, fields) =>
      t.ctx.db.run(
        `INSERT INTO coupons (code, description, type, value, is_active, starts_at, ends_at, usage_limit, used_count)
         VALUES (:code, '', 'flat', 100, :is_active, :starts_at, :ends_at, :usage_limit, :used_count)`,
        { code, is_active: 1, starts_at: null, ends_at: null, usage_limit: null, used_count: 0, ...fields },
      );
    insert('OFFNOW', { is_active: 0 });
    insert('SOON', { starts_at: '2999-01-01T00:00:00Z' });
    insert('GONE', { ends_at: '2001-01-01T00:00:00Z' });
    insert('USEDUP', { usage_limit: 5, used_count: 5 });
    insert('ONEMORE', { usage_limit: 5, used_count: 4 });
    const cases = [
      ['NOPE', /do not recognise/],
      ['OFFNOW', /no longer active/],
      ['SOON', /starts on/],
      ['GONE', /ended on/],
      ['USEDUP', /fully used/],
    ];
    for (const [code, pattern] of cases) {
      const { body } = await price({ items: [line(P.universal)], couponCode: code });
      assert.equal(body.discount, 0, code);
      assert.equal(body.coupon, null, code);
      assert.match(body.couponError, pattern, code);
    }
    const ok = (await price({ items: [line(P.universal)], couponCode: 'ONEMORE' })).body;
    assert.equal(ok.discount, 100);
  });

  test('a flat coupon never takes more than the subtotal', async () => {
    t.ctx.db.run("INSERT INTO coupons (code, type, value) VALUES ('BIGFLAT', 'flat', 5000)");
    const { body } = await price({ items: [line(P.universal)], couponCode: 'BIGFLAT' });
    assert.equal(body.discount, 1299);
    assert.equal(body.coupon.discount, 1299);
  });

  test('a free shipping coupon removes the flat fee but not the surcharges', async () => {
    t.ctx.db.run("INSERT INTO coupons (code, type, value) VALUES ('FREESHIP', 'free_shipping', 0)");
    const small = (await price({ items: [plate()] })).body;
    assert.equal(small.shippingFee, 79);
    const free = (await price({ items: [plate()], couponCode: 'FREESHIP' })).body;
    assert.equal(free.couponError, null);
    assert.equal(free.discount, 0);
    assert.equal(free.shippingFee, 0);
    assert.equal(free.amountToFreeShipping, 0);
    await withSettings({ shipping: { freeShippingThreshold: 100000 } }, async () => {
      const bulky = (await price({ items: [line(P.spoiler)], couponCode: 'FREESHIP' })).body;
      assert.equal(bulky.shippingFee, 199);
    });
  });

  test('the discount counts toward the free shipping threshold', async () => {
    t.ctx.db.run("INSERT INTO coupons (code, type, value) VALUES ('FLAT400', 'flat', 400)");
    const { body } = await price({ items: [line(P.universal)], couponCode: 'FLAT400' });
    assert.equal(body.discount, 400);
    assert.equal(body.shippingFee, 79); // 1299 - 400 = 899 < 999
    assert.equal(body.amountToFreeShipping, 100);
  });
});

// ---------------------------------------------------------------------------
// Delivery fee
// ---------------------------------------------------------------------------

describe('shipping fee', () => {
  test('flat fee below the threshold, free at or above it', async () => {
    const below = (await price({ items: [plate()] })).body;
    assert.equal(below.shippingFee, 79);
    assert.equal(below.freeShippingThreshold, 999);
    assert.equal(below.amountToFreeShipping, 200);
    const above = (await price({ items: [line(P.universal)] })).body;
    assert.equal(above.shippingFee, 0);
    assert.equal(above.amountToFreeShipping, 0);
  });

  test('bulky and freight surcharges are added once each', async () => {
    const bulky = (await price({ items: [line(P.spoiler, 2)] })).body;
    assert.equal(bulky.shippingFee, 199);
    const freight = (await price({ items: [wheelLine(0), wheelLine(1)] })).body;
    assert.equal(freight.shippingFee, 499);
    const both = (await price({ items: [line(P.spoiler), wheelLine(0)] })).body;
    assert.equal(both.shippingFee, 199 + 499);
  });

  test('surcharges stack on the flat fee below the threshold', async () => {
    await withSettings({ shipping: { freeShippingThreshold: 50000 } }, async () => {
      const { body } = await price({ items: [line(P.spoiler)] });
      assert.equal(body.shippingFee, 79 + 199);
      assert.equal(body.amountToFreeShipping, 50000 - 3499);
    });
  });

  test('lines left out of the totals do not add surcharges', async () => {
    const { body } = await price({ items: [line(P.universal), line(P.wheel)] }); // wheel without a variant
    assert.equal(body.shippingFee, 0);
  });
});

// ---------------------------------------------------------------------------
// Payment options
// ---------------------------------------------------------------------------

describe('payment options', () => {
  test('always upi, razorpay, cod; online ones unavailable until set up', async () => {
    const { body } = await price({ items: [line(P.universal)] });
    assert.deepEqual(body.paymentOptions.map((option) => option.method), ['upi', 'razorpay', 'cod']);
    const [upi, razorpay, cod] = body.paymentOptions;
    assert.equal(upi.available, false);
    assert.ok(upi.reason);
    assert.equal(razorpay.available, false);
    assert.ok(razorpay.reason);
    assert.equal(cod.available, true);
    assert.equal(cod.reason, null);
    assert.equal(cod.total, 1299 + 49);
    assert.equal(cod.payNow, 0);
    assert.equal(cod.dueOnDelivery, 1348);
    assert.match(cod.note, /₹1,348/);
    assert.match(cod.note, /₹49/);
    for (const option of body.paymentOptions) {
      assert.deepEqual(Object.keys(option).sort(), ['available', 'dueOnDelivery', 'label', 'method', 'note', 'payNow', 'reason', 'saving', 'total']);
    }
    // No online option: the cart is priced for COD.
    assert.equal(body.total, 1348);
    assert.equal(body.codFee, 49);
    assert.equal(body.prepaidDiscount, 0);
    assert.equal(body.dueOnDelivery, 1348);
  });

  test('prepaid discount, savings against the dearest option, and the default choice', async () => {
    await withOnlinePayments(async () => {
      const { body } = await price({ items: [line(P.universal)] });
      const [upi, razorpay, cod] = body.paymentOptions;
      assert.equal(upi.available, true);
      assert.equal(razorpay.available, true);
      // 2% of 1299 = 25.98 -> 26
      assert.equal(upi.total, 1273);
      assert.equal(upi.payNow, 1273);
      assert.equal(upi.dueOnDelivery, 0);
      assert.equal(razorpay.total, 1273);
      assert.equal(cod.total, 1348);
      assert.equal(upi.saving, 75);
      assert.equal(razorpay.saving, 75);
      assert.equal(cod.saving, 0);
      assert.match(upi.note, /₹1,273/);
      assert.match(upi.note, /₹26 off/);
      // Without a method, the cheapest online option.
      assert.equal(body.total, 1273);
      assert.equal(body.prepaidDiscount, 26);
      assert.equal(body.codFee, 0);
      assert.equal(body.payNow, 1273);

      const asCod = (await price({ items: [line(P.universal)], paymentMethod: 'cod' })).body;
      assert.equal(asCod.total, 1348);
      assert.equal(asCod.codFee, 49);
      assert.equal(asCod.prepaidDiscount, 0);
      assert.equal(asCod.payNow, 0);
      assert.equal(asCod.dueOnDelivery, 1348);

      const asCard = (await price({ items: [line(P.universal)], paymentMethod: 'razorpay' })).body;
      assert.equal(asCard.total, 1273);

      const detailed = priceCartDetailed(t.ctx, { items: [line(P.universal)], paymentMethod: 'razorpay' });
      assert.equal(detailed.paymentMethod, 'razorpay');
    });
  });

  test('the prepaid discount is worked out after the coupon', async () => {
    await withOnlinePayments(async () => {
      const { body } = await price({ items: [line(P.universal)], couponCode: 'FIT10' });
      // (1299 - 130) * 2% = 23.38 -> 23
      assert.equal(body.prepaidDiscount, 23);
      assert.equal(body.total, 1299 - 130 - 23);
    });
  });

  test('a requested method that is not available falls back with a message', async () => {
    const { body } = await price({ items: [line(P.universal)], paymentMethod: 'upi' });
    assert.equal(body.total, 1348);
    assert.ok(body.messages.some((message) => /UPI is not available/.test(message)));
    const detailed = priceCartDetailed(t.ctx, { items: [line(P.universal)], paymentMethod: 'upi' });
    assert.equal(detailed.paymentMethod, 'cod');
  });

  test('with no method available at all the cart shows the plain total', async () => {
    const { body } = await price({ items: [plate()] }); // show plates are prepaid only, and online is off
    assert.equal(body.paymentOptions.every((option) => !option.available), true);
    assert.equal(body.total, 799 + 79);
    assert.equal(body.payNow, 799 + 79);
    assert.equal(body.codFee, 0);
    assert.equal(body.paymentOptions.every((option) => option.saving === 0), true);
  });

  test('COD is refused for non-COD and freight lines', async () => {
    const custom = (await price({ items: [plate(), line(P.universal)] })).body;
    assert.equal(custom.paymentOptions[2].available, false);
    assert.match(custom.paymentOptions[2].reason, /Addon Custom Show Plate/);

    await withSql(
      [['UPDATE products SET cod_eligible = 0 WHERE id = ?', [P.bodyType.id]]],
      [['UPDATE products SET cod_eligible = 1 WHERE id = ?', [P.bodyType.id]]],
      async () => {
        const plain = (await price({ items: [line(P.bodyType)] })).body;
        assert.equal(plain.paymentOptions[2].available, false);
        assert.match(plain.paymentOptions[2].reason, /cannot be paid for on delivery/);
      },
    );

    const freight = (await price({ items: [wheelLine(0)] })).body;
    assert.equal(freight.paymentOptions[2].available, false);
    assert.match(freight.paymentOptions[2].reason, /freight/);
  });

  test('COD is refused when switched off, below the minimum or above the maximum', async () => {
    await withSettings({ cod: { enabled: false } }, async () => {
      const { body } = await price({ items: [line(P.universal)] });
      assert.equal(body.paymentOptions[2].available, false);
      assert.match(body.paymentOptions[2].reason, /switched off/);
    });
    await withSettings({ cod: { minOrder: 2000 } }, async () => {
      const { body } = await price({ items: [line(P.universal)] });
      assert.equal(body.paymentOptions[2].available, false);
      assert.match(body.paymentOptions[2].reason, /₹2,000/);
    });
    // 8 x 3499 + 199 + 49 = 28240 > 25000
    const big = (await price({ items: [line(P.spoiler, 8)] })).body;
    assert.equal(big.paymentOptions[2].available, false);
    assert.match(big.paymentOptions[2].reason, /up to ₹25,000/);
    await withSettings({ cod: { maxOrder: 0 } }, async () => {
      const { body } = await price({ items: [line(P.spoiler, 8)] });
      assert.equal(body.paymentOptions[2].available, true);
    });
  });

  test('COD is refused where the courier does not collect cash', async () => {
    const { body } = await price({ items: [line(P.universal)], pincode: '781001' }); // Assam
    assert.equal(body.paymentOptions[2].available, false);
    assert.match(body.paymentOptions[2].reason, /PIN code/);
    const metro = (await price({ items: [line(P.universal)], pincode: '560001' })).body;
    assert.equal(metro.paymentOptions[2].available, true);
  });

  test('COD with an advance splits the total, rounding the advance up', async () => {
    await withSettings({ cod: { advancePercent: 10 } }, async () => {
      const { body } = await price({ items: [line(P.universal)], paymentMethod: 'cod' });
      const cod = body.paymentOptions[2];
      assert.equal(cod.total, 1348);
      assert.equal(cod.payNow, 135); // ceil(134.8)
      assert.equal(cod.dueOnDelivery, 1213);
      assert.match(cod.label, /advance/);
      assert.match(cod.note, /₹135 now, ₹1,213 to the courier/);
      assert.equal(body.payNow, 135);
      assert.equal(body.dueOnDelivery, 1213);
      assert.equal(body.total, 1348);
    });
  });
});

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------

describe('tax', () => {
  test('CGST + SGST inside the store State, IGST outside it', async () => {
    await withSettings({ address: { state: 'Karnataka' } }, async () => {
      const local = (await price({ items: [line(P.universal)], pincode: '560001' })).body;
      assert.equal(local.tax.isInterState, false);
      assert.equal(local.tax.igst, 0);
      assert.equal(local.tax.cgst, local.tax.sgst);
      assert.ok(Math.abs(local.tax.gst - (1348 * 18) / 118) < 0.02);
      assert.ok(Math.abs(local.tax.taxableValue + local.tax.gst - local.total) < 0.001);

      const delhi = (await price({ items: [line(P.universal)], pincode: '110001' })).body;
      assert.equal(delhi.tax.isInterState, true);
      assert.equal(delhi.tax.cgst, 0);
      assert.equal(delhi.tax.sgst, 0);
      assert.ok(delhi.tax.igst > 0);
      assert.ok(Math.abs(delhi.tax.taxableValue + delhi.tax.gst - delhi.total) < 0.001);

      const noPin = (await price({ items: [line(P.universal)] })).body;
      assert.equal(noPin.tax.isInterState, false);
    });
  });

  test('tax follows the final amount after coupon and prepaid discount, with shipping included', async () => {
    await withOnlinePayments(async () => {
      const { body } = await price({ items: [plate()], couponCode: 'FREESHIP' });
      assert.ok(Math.abs(body.tax.taxableValue + body.tax.gst - body.total) < 0.001);
      const withShipping = (await price({ items: [plate()] })).body;
      assert.equal(withShipping.shippingFee, 79);
      assert.ok(Math.abs(withShipping.tax.taxableValue + withShipping.tax.gst - withShipping.total) < 0.001);
    });
  });
});

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

describe('quotes', () => {
  const insertQuote = (fields = {}) => {
    const row = {
      token: `q${Math.random().toString(36).slice(2, 14)}`,
      customer_name: 'Ravi',
      phone: '9876501234',
      note: 'Price as discussed on the call.',
      items: [{ productId: P.universal.id, variantId: null, qty: 2, unitPrice: 1000 }],
      shipping_fee: null,
      valid_until: '2999-01-01T00:00:00Z',
      status: 'open',
      ...fields,
    };
    t.ctx.db.run(
      `INSERT INTO quotes (token, customer_name, phone, note, items, shipping_fee, valid_until, status)
       VALUES (:token, :customer_name, :phone, :note, :items, :shipping_fee, :valid_until, :status)`,
      row,
    );
    return row;
  };

  test('lines and prices come from the quote, never from the request or a coupon', async () => {
    const quote = insertQuote({ shipping_fee: 150 });
    await withOnlinePayments(async () => {
      const { body } = await price({ items: [wheelLine(0)], quoteToken: quote.token, couponCode: 'FIT10' });
      assert.equal(body.lines.length, 1);
      assert.equal(body.lines[0].productId, P.universal.id);
      assert.equal(body.lines[0].unitPrice, 1000);
      assert.equal(body.lines[0].unitMrp, 1999);
      assert.equal(body.subtotal, 2000);
      assert.equal(body.discount, 0);
      assert.match(body.couponError, /quoted prices/);
      assert.equal(body.shippingFee, 150);
      assert.equal(body.amountToFreeShipping, 0);
      assert.equal(body.prepaidDiscount, 0);
      assert.equal(body.total, 2150);
      assert.deepEqual(body.quote, {
        token: quote.token,
        customerName: 'Ravi',
        validUntil: '2999-01-01T00:00:00Z',
        note: 'Price as discussed on the call.',
      });
      assert.equal(body.canCheckout, true);
    });
  });

  test('a quote without a delivery fee uses the normal rules', async () => {
    const quote = insertQuote({ items: [{ productId: P.universal.id, variantId: null, qty: 1, unitPrice: 500 }] });
    const { body } = await price({ quoteToken: quote.token });
    assert.equal(body.shippingFee, 79);
    assert.equal(body.amountToFreeShipping, 499);
  });

  test('expired, ordered, cancelled and unknown quotes cannot check out', async () => {
    const expired = insertQuote({ valid_until: '2001-01-01T00:00:00Z' });
    const ordered = insertQuote({ status: 'ordered' });
    const cancelled = insertQuote({ status: 'cancelled' });
    for (const [quote, pattern] of [
      [expired, /expired/],
      [ordered, /already been ordered/],
      [cancelled, /withdrawn/],
    ]) {
      const { body } = await price({ quoteToken: quote.token });
      assert.equal(body.canCheckout, false);
      assert.ok(body.quote);
      assert.ok(body.messages.some((message) => pattern.test(message)));
    }
    const unknown = (await price({ quoteToken: 'no-such-quote', items: [line(P.universal)] })).body;
    assert.equal(unknown.lines.length, 0);
    assert.equal(unknown.canCheckout, false);
    assert.equal(unknown.quote, null);
  });

  test('expiry follows ctx.now()', async () => {
    const quote = insertQuote({ valid_until: '2026-11-20T00:00:00Z' });
    const saved = t.ctx.now;
    try {
      t.ctx.now = () => '2026-11-17T10:00:00Z';
      assert.equal((await price({ quoteToken: quote.token })).body.canCheckout, true);
      t.ctx.now = () => '2026-11-20T00:00:00Z';
      assert.equal((await price({ quoteToken: quote.token })).body.canCheckout, false);
    } finally {
      t.ctx.now = saved;
    }
  });

  test('GET /quotes/:token returns the QuoteView', async () => {
    const quote = insertQuote();
    const res = await t.api(`/api/quotes/${quote.token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['cart', 'customerName', 'items', 'note', 'status', 'token', 'validUntil']);
    assert.equal(res.body.status, 'open');
    assert.deepEqual(res.body.items, [{ productId: P.universal.id, variantId: null, qty: 2 }]);
    assert.equal(res.body.cart.subtotal, 2000);
    assert.equal('phone' in res.body, false);

    const expired = insertQuote({ valid_until: '2001-01-01T00:00:00Z' });
    const expiredRes = await t.api(`/api/quotes/${expired.token}`);
    assert.equal(expiredRes.body.status, 'expired');
    assert.equal(expiredRes.body.cart.canCheckout, false);

    assert.equal((await t.api('/api/quotes/unknown-token')).status, 404);
    assert.equal((await t.api('/api/quotes/bad%20token')).status, 404);
  });
});

// ---------------------------------------------------------------------------
// The Sanity Check
// ---------------------------------------------------------------------------

describe('advice', () => {
  test('a good word when a car is chosen and everything fits', async () => {
    const { body } = await price({ items: [line(P.spoiler), line(P.universal)], vehicleId: V.swiftOld.id });
    assert.equal(body.lines[0].fit, 'direct');
    assert.equal(body.lines[1].fit, 'universal');
    const good = advice(body, 'fits_all');
    assert.equal(good.length, 1);
    assert.equal(good[0].severity, 'good');
    assert.match(good[0].message, /Swift/);
    // No car, no fit advice.
    const noCar = (await price({ items: [line(P.spoiler), line(P.universal)] })).body;
    assert.equal(noCar.advice.length, 0);
  });

  test('a part that does not fit is a problem with a remove action', async () => {
    const { body } = await price({ items: [wheelLine(0), line(P.bodyType)], vehicleId: V.creta.id });
    const problems = advice(body, 'does_not_fit');
    assert.equal(problems.length, 2);
    assert.equal(problems[0].severity, 'problem');
    assert.deepEqual(problems[0].action, { type: 'remove', productId: P.wheel.id, label: 'Remove it' });
    assert.match(problems[0].message, /5x114.3/);
    assert.equal(advice(body, 'fits_all').length, 0);
  });

  test('fits with work is a warning carrying the note', async () => {
    await withSql(
      [["INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note) VALUES (?, ?, 'with_work', 'Needs two holes drilled in the tailgate.')", [P.spoiler.id, V.creta.id]]],
      [['DELETE FROM product_fitments WHERE product_id = ? AND vehicle_id = ?', [P.spoiler.id, V.creta.id]]],
      async () => {
        const { body } = await price({ items: [line(P.spoiler)], vehicleId: V.creta.id });
        const [warning] = advice(body, 'needs_work');
        assert.equal(warning.severity, 'warning');
        assert.match(warning.message, /two holes drilled/);
      },
    );
  });

  test('an unchecked vehicle-specific part is a warning, a universal one is not', async () => {
    const { body } = await price({ items: [line(P.spoiler), line(P.universal)], vehicleId: V.creta.id });
    const warnings = advice(body, 'fit_unchecked');
    assert.equal(warnings.length, 1);
    assert.deepEqual(warnings[0].productIds, [P.spoiler.id]);
    assert.equal(advice(body, 'fits_all').length, 0);
  });

  test('two products that do the same job are flagged', async () => {
    const wheel2 = insertProduct({ name: 'Second Alloy Set', category_id: t.fixtures.categories.alloys.id, price: 15999, mrp: 19999 });
    try {
      const { body } = await price({ items: [wheelLine(0), line(wheel2)] });
      const [duplicate] = advice(body, 'duplicate_purpose');
      assert.equal(duplicate.severity, 'warning');
      assert.deepEqual(duplicate.productIds.sort(), [P.wheel.id, wheel2.id].sort());
      // Two variants of the same product are not a duplicate.
      const same = (await price({ items: [wheelLine(0), wheelLine(1)] })).body;
      assert.equal(advice(same, 'duplicate_purpose').length, 0);
      // Spoilers are not a same-job category.
      const spoilers = (await price({ items: [line(P.spoiler), line(P.universal)] })).body;
      assert.equal(advice(spoilers, 'duplicate_purpose').length, 0);
    } finally {
      t.ctx.db.run('DELETE FROM products WHERE id = ?', [wheel2.id]);
    }
  });

  test('off-road and check-the-rules parts are warnings with the legality note', async () => {
    const plateCart = (await price({ items: [plate()] })).body;
    const [offRoad] = advice(plateCart, 'off_road_only');
    assert.equal(offRoad.severity, 'warning');
    assert.match(offRoad.message, /not a registration plate/);

    await withSql(
      [["UPDATE products SET legality = 'check_rules', legality_note = 'Tint above 30% blocks light.' WHERE id = ?", [P.universal.id]]],
      [["UPDATE products SET legality = 'road_legal', legality_note = '' WHERE id = ?", [P.universal.id]]],
      async () => {
        const { body } = await price({ items: [line(P.universal)] });
        const [rules] = advice(body, 'check_rules');
        assert.equal(rules.severity, 'warning');
        assert.match(rules.message, /Tint above 30%/);
      },
    );
  });

  test('pro-install parts point at the fitting card', async () => {
    await withSql(
      [['UPDATE products SET pro_install = 1 WHERE id = ?', [P.spoiler.id]]],
      [['UPDATE products SET pro_install = 0 WHERE id = ?', [P.spoiler.id]]],
      async () => {
        const { body } = await price({ items: [line(P.spoiler)] });
        const [tip] = advice(body, 'pro_install');
        assert.equal(tip.severity, 'tip');
        assert.match(tip.message, new RegExp(`/fitting/${P.spoiler.slug}`));
        assert.equal(tip.action, null);
      },
    );
  });

  test('a required part that is missing is a tip with an add action when it can be bought', async () => {
    await withSql(
      [
        ["INSERT INTO product_relations (product_id, related_id, kind, note) VALUES (?, ?, 'requires', 'You need the lip to mount it.')", [P.spoiler.id, P.universal.id]],
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'requires')", [P.wheel.id, P.outOfStock.id]],
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'requires')", [P.bodyType.id, P.spoiler.id]],
      ],
      [['DELETE FROM product_relations WHERE product_id IN (?, ?, ?)', [P.spoiler.id, P.wheel.id, P.bodyType.id]]],
      async () => {
        const { body } = await price({ items: [line(P.spoiler), wheelLine(0)] });
        const tips = advice(body, 'missing_required');
        assert.equal(tips.length, 2);
        const lip = tips.find((tip) => tip.productIds[0] === P.spoiler.id);
        assert.deepEqual(lip.action, { type: 'add', productId: P.universal.id, label: `Add ${P.universal.name}` });
        assert.match(lip.message, /mount it/);
        const nuts = tips.find((tip) => tip.productIds[0] === P.wheel.id);
        assert.equal(nuts.action, null);
        assert.match(nuts.message, /out of stock/);

        // Already in the cart: nothing to say.
        const complete = (await price({ items: [line(P.spoiler), line(P.universal)] })).body;
        assert.equal(advice(complete, 'missing_required').length, 0);

        // An inactive required part is not suggested.
        await withSql(
          [['UPDATE products SET is_active = 0 WHERE id = ?', [P.universal.id]]],
          [['UPDATE products SET is_active = 1 WHERE id = ?', [P.universal.id]]],
          async () => {
            const inactive = (await price({ items: [line(P.spoiler)] })).body;
            assert.equal(advice(inactive, 'missing_required').length, 0);
          },
        );
      },
    );
  });

  test('works-well-with tips stop at two', async () => {
    await withSql(
      [
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'pairs_with')", [P.universal.id, P.spoiler.id]],
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'pairs_with')", [P.universal.id, P.bodyType.id]],
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'pairs_with')", [P.universal.id, P.showPlate.id]],
      ],
      [['DELETE FROM product_relations WHERE product_id = ?', [P.universal.id]]],
      async () => {
        const { body } = await price({ items: [line(P.universal)] });
        const tips = advice(body, 'pairs_with');
        assert.equal(tips.length, 2);
        for (const tip of tips) {
          assert.equal(tip.severity, 'tip');
          assert.equal(tip.action.type, 'add');
        }
      },
    );
  });

  test('advice is ordered problems, warnings, tips, good', async () => {
    await withSql(
      [
        ['UPDATE products SET pro_install = 1 WHERE id = ?', [P.bodyType.id]],
        ["INSERT INTO product_relations (product_id, related_id, kind) VALUES (?, ?, 'requires')", [P.spoiler.id, P.universal.id]],
      ],
      [
        ['UPDATE products SET pro_install = 0 WHERE id = ?', [P.bodyType.id]],
        ['DELETE FROM product_relations WHERE product_id = ?', [P.spoiler.id]],
      ],
      async () => {
        const { body } = await price({ items: [line(P.bodyType), line(P.spoiler), plate()], vehicleId: V.creta.id });
        const rank = { problem: 0, warning: 1, tip: 2, good: 3 };
        const severities = body.advice.map((entry) => rank[entry.severity]);
        assert.deepEqual(severities, [...severities].sort((a, b) => a - b));
        assert.ok(body.advice.some((entry) => entry.severity === 'problem'));
        assert.ok(body.advice.some((entry) => entry.severity === 'warning'));
        assert.ok(body.advice.some((entry) => entry.severity === 'tip'));
        for (const entry of body.advice) {
          assert.deepEqual(Object.keys(entry).sort(), ['action', 'code', 'message', 'productIds', 'severity']);
          assert.doesNotMatch(entry.message, /!/);
        }
      },
    );
  });
});

// ---------------------------------------------------------------------------
// priceCartDetailed (used by the order engine)
// ---------------------------------------------------------------------------

describe('priceCartDetailed', () => {
  test('rows line up with the cart lines and carry the product and variant rows', () => {
    const { cart, rows } = priceCartDetailed(t.ctx, { items: [line(P.universal), wheelLine(1), line(P.outOfStock)] }, { user: null });
    assert.equal(rows.length, cart.lines.length);
    rows.forEach((row, index) => assert.equal(row.line, cart.lines[index]));
    assert.equal(rows[0].product.id, P.universal.id);
    assert.equal(rows[0].product.sale_price, 1299);
    assert.equal(rows[0].variant, null);
    assert.equal(rows[1].variant.id, P.wheel.variants[1].id);
    assert.equal(rows[1].product.gst_rate, 18);
    assert.deepEqual(priceCart(t.ctx, { items: [line(P.universal)] }).subtotal, 1299);
  });
});

// ---------------------------------------------------------------------------
// Validation of POST /cart/price
// ---------------------------------------------------------------------------

describe('POST /cart/price validation', () => {
  test('bad lines, PIN codes and methods are 400s with fields', async () => {
    const zeroQty = await price({ items: [line(P.universal, 0)] });
    assert.equal(zeroQty.status, 400);
    assert.equal(zeroQty.body.error.code, 'validation_error');
    assert.ok(zeroQty.body.error.fields['items.0.qty']);

    const hugeQty = await price({ items: [line(P.universal, 1000)] });
    assert.equal(hugeQty.status, 400);

    const badPin = await price({ items: [line(P.universal)], pincode: '1234' });
    assert.equal(badPin.status, 400);
    assert.ok(badPin.body.error.fields.pincode);

    const badMethod = await price({ items: [line(P.universal)], paymentMethod: 'bitcoin' });
    assert.equal(badMethod.status, 400);
    assert.ok(badMethod.body.error.fields.paymentMethod);

    const notArray = await price({ items: 'lots' });
    assert.equal(notArray.status, 400);

    const badId = await price({ items: [{ productId: -3, variantId: null, qty: 1 }] });
    assert.equal(badId.status, 400);

    const tooMany = await price({ items: Array.from({ length: 51 }, () => line(P.universal)) });
    assert.equal(tooMany.status, 400);
  });

  test('blank optional fields are accepted, and no body is an empty cart', async () => {
    const blank = await price({ items: [line(P.universal)], pincode: '', couponCode: '', quoteToken: '', vehicleId: null });
    assert.equal(blank.status, 200);
    const none = await t.api('/api/cart/price', { method: 'POST' });
    assert.equal(none.status, 200);
    assert.equal(none.body.lines.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Shipping estimate
// ---------------------------------------------------------------------------

describe('shipping estimate', () => {
  test('400 for a PIN that is not six digits', async () => {
    assert.equal((await t.api('/api/shipping/estimate?pincode=1234')).status, 400);
    assert.equal((await t.api('/api/shipping/estimate?pincode=abcdef')).status, 400);
    assert.equal((await t.api('/api/shipping/estimate')).status, 400);
    assert.throws(() => estimateShipping(t.ctx, '01234'), { status: 400 });
  });

  test('with no origin PIN every ordinary destination is 3 to 7 days plus dispatch', async () => {
    const saved = t.ctx.now;
    t.ctx.now = () => '2026-11-17T04:00:00Z'; // Tuesday in India
    try {
      const res = await t.api('/api/shipping/estimate?pincode=560001');
      assert.equal(res.status, 200);
      assert.deepEqual(Object.keys(res.body).sort(), ['codAvailable', 'earliest', 'latest', 'maxDays', 'message', 'minDays', 'pincode', 'serviceable', 'state']);
      assert.equal(res.body.state, 'Karnataka');
      assert.equal(res.body.serviceable, true);
      assert.equal(res.body.minDays, 4);
      assert.equal(res.body.maxDays, 8);
      assert.equal(res.body.codAvailable, true);
      // Tue + 4 working days (Sunday skipped) = Sat 21; + 8 = Thu 26.
      assert.equal(res.body.earliest, '2026-11-21');
      assert.equal(res.body.latest, '2026-11-26');
      assert.match(res.body.message, /Karnataka/);
    } finally {
      t.ctx.now = saved;
    }
  });

  test('transit by distance from the origin PIN, and no COD in remote areas', async () => {
    await withSettings({ shipping: { originPincode: '560001', dispatchDays: 1 } }, async () => {
      const days = (pin) => {
        const estimate = estimateShipping(t.ctx, pin);
        return [estimate.minDays, estimate.maxDays, estimate.codAvailable];
      };
      assert.deepEqual(days('560034'), [2, 4, true]); // same State
      assert.deepEqual(days('600001'), [4, 6, true]); // Tamil Nadu, same region
      assert.deepEqual(days('110001'), [5, 8, true]); // Delhi, rest of India
      assert.deepEqual(days('781001'), [7, 11, false]); // Assam
      assert.deepEqual(days('190001'), [7, 11, false]); // Srinagar
      assert.deepEqual(days('194101'), [7, 11, false]); // Ladakh
      assert.deepEqual(days('744101'), [7, 11, false]); // Port Blair
      assert.match(estimateShipping(t.ctx, '781001').message, /Cash on delivery does not reach/);
    });
    await withSettings({ shipping: { originPincode: '', dispatchDays: 2 } }, async () => {
      const estimate = estimateShipping(t.ctx, '781001');
      assert.equal(estimate.minDays, 8);
      assert.equal(estimate.codAvailable, false);
    });
  });

  test('an unknown PIN prefix is not serviceable, with a helpful message', async () => {
    const res = await t.api('/api/shipping/estimate?pincode=990001');
    assert.equal(res.status, 200);
    assert.equal(res.body.serviceable, false);
    assert.equal(res.body.codAvailable, false);
    assert.equal(res.body.state, '');
    assert.match(res.body.message, /message us/);
  });

  test('working days skip Sundays and count from the India date', () => {
    assert.equal(addWorkingDays('2026-11-21T06:00:00Z', 1), '2026-11-23'); // Sat -> Mon
    assert.equal(addWorkingDays('2026-11-21T06:00:00Z', 2), '2026-11-24');
    assert.equal(addWorkingDays('2026-11-21T20:00:00Z', 1), '2026-11-23'); // already Sunday 01:30 in India
    assert.equal(addWorkingDays('2026-11-17T10:00:00Z', 0), '2026-11-17');
  });
});

// ---------------------------------------------------------------------------
// Checkout leads
// ---------------------------------------------------------------------------

describe('checkout leads', () => {
  const postLead = (body) => t.api('/api/checkout/lead', { method: 'POST', body });

  test('stores the priced cart and total, then updates the same lead by token', async () => {
    const first = await postLead({ name: 'Meera', phone: '+91 98450 12345', email: 'Meera@Example.com', items: [line(P.universal, 2)] });
    assert.equal(first.status, 200);
    assert.match(first.body.token, /^[A-Za-z0-9_-]{20,}$/);
    let row = t.ctx.db.get('SELECT * FROM checkout_leads WHERE token = ?', [first.body.token]);
    assert.equal(row.phone, '9845012345');
    assert.equal(row.email, 'meera@example.com');
    assert.equal(row.name, 'Meera');
    assert.equal(row.cart_total, 2598 + 49);
    const cart = JSON.parse(row.cart);
    assert.equal(cart[0].unitPrice, 1299);
    assert.equal(cart[0].qty, 2);

    const second = await postLead({ token: first.body.token, phone: '9845012345', items: [line(P.universal, 1)] });
    assert.equal(second.body.token, first.body.token);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM checkout_leads WHERE phone = ?', ['9845012345']).n, 1);
    row = t.ctx.db.get('SELECT * FROM checkout_leads WHERE token = ?', [first.body.token]);
    assert.equal(row.cart_total, 1299 + 49);
    assert.equal(row.name, 'Meera'); // not wiped by a blank name
  });

  test('a recovered lead is not reused, and an unknown token starts a new lead', async () => {
    const first = await postLead({ phone: '9845098765', items: [line(P.universal)] });
    t.ctx.db.run("UPDATE checkout_leads SET status = 'recovered' WHERE token = ?", [first.body.token]);
    const again = await postLead({ token: first.body.token, phone: '9845098765', items: [line(P.universal)] });
    assert.notEqual(again.body.token, first.body.token);
    const unknown = await postLead({ token: 'not-a-real-lead-token', phone: '9845098765', items: [] });
    assert.equal(unknown.status, 200);
    assert.notEqual(unknown.body.token, 'not-a-real-lead-token');
  });

  test('never fails the shopper over a broken cart or email, but needs a phone', async () => {
    const junk = await postLead({ phone: '9845011111', email: 'not an email', items: [{ productId: 'x', qty: -4 }, 7] });
    assert.equal(junk.status, 200);
    const row = t.ctx.db.get('SELECT * FROM checkout_leads WHERE token = ?', [junk.body.token]);
    assert.equal(row.email, '');
    assert.equal(row.cart, '[]');
    assert.equal(row.cart_total, 0);

    const noItems = await postLead({ phone: '9845011112' });
    assert.equal(noItems.status, 200);

    const badPhone = await postLead({ phone: '12345', items: [] });
    assert.equal(badPhone.status, 400);
    assert.ok(badPhone.body.error.fields.phone);
  });
});

// ---------------------------------------------------------------------------
// Studio fitting and fulfilment
// ---------------------------------------------------------------------------

describe('studio fitting in the cart', () => {
  const fitted = (product, qty = 1) => line(product, qty, { fitAtStudio: true });
  const gstIn = (amount) => (amount * 18) / 118;

  test('a fitted line carries its service charge times the quantity and makes the order a studio order', async () => {
    const res = await price({ items: [fitted(P.universal, 2)] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const cart = res.body;
    const [first] = cart.lines;
    assert.equal(first.fitAtStudio, true);
    assert.equal(first.fittingCharge, 999 * 2);
    assert.equal(first.fittingServiceName, 'Spoiler, skirts and body kit fitting');
    assert.equal(first.lineTotal, 1299 * 2, 'the part price is unchanged');
    assert.equal(cart.fulfilment, 'studio');
    assert.equal(cart.needsSlot, true);
    assert.equal(cart.fittingTotal, 1998);
    assert.equal(cart.shippingFee, 0);
    assert.equal(cart.amountToFreeShipping, 0);
    assert.equal(cart.subtotal, 2598);
  });

  test('studio orders pay no shipping, even for bulky and freight parts, and paying at the studio has no COD fee', async () => {
    const delivered = (await price({ items: [line(P.spoiler)], paymentMethod: 'cod' })).body;
    assert.equal(delivered.shippingFee, 199, 'bulky surcharge on delivery');
    assert.equal(delivered.codFee, 49);

    const studio = (await price({ items: [fitted(P.spoiler), { ...wheelLine(0), fitAtStudio: true }], paymentMethod: 'cod' })).body;
    assert.equal(studio.fulfilment, 'studio');
    assert.equal(studio.shippingFee, 0);
    assert.equal(studio.codFee, 0);
    assert.equal(studio.fittingTotal, 999 + 699);
    assert.equal(studio.total, 3499 + 21999 + 999 + 699);
    const cod = studio.paymentOptions.find((option) => option.method === 'cod');
    assert.equal(cod.available, true, 'freight does not block paying at the studio');
    assert.equal(cod.label, 'Pay at the studio');
    assert.match(cod.note, /at the studio/);
    assert.equal(cod.payNow, 0);
    assert.equal(cod.dueOnDelivery, studio.total);
    assert.equal(studio.canCheckout, true);
  });

  test('the tax breakdown includes fitting charges at 18%', async () => {
    const plain = (await price({ items: [line(P.spoiler)], fulfilment: 'pickup', paymentMethod: 'cod' })).body;
    const studio = (await price({ items: [fitted(P.spoiler)], paymentMethod: 'cod' })).body;
    assert.equal(plain.total, 3499);
    assert.equal(studio.total, 3499 + 999);
    assert.ok(Math.abs(plain.tax.gst - gstIn(3499)) < 0.02, `${plain.tax.gst}`);
    assert.ok(Math.abs(studio.tax.gst - gstIn(3499 + 999)) < 0.02, `${studio.tax.gst}`);
    assert.ok(Math.abs(studio.tax.taxableValue + studio.tax.gst - studio.total) < 0.01);
    assert.equal(studio.tax.isInterState, false);
  });

  test('the prepaid discount is on the parts only, never on fitting', async () => {
    await withOnlinePayments(async () => {
      const cart = (await price({ items: [fitted(P.spoiler)], paymentMethod: 'upi' })).body;
      const discount = Math.round(3499 * 0.02);
      assert.equal(cart.prepaidDiscount, discount);
      assert.equal(cart.total, 3499 + 999 - discount);
      const upi = cart.paymentOptions.find((option) => option.method === 'upi');
      assert.equal(upi.total, cart.total);
      const cod = cart.paymentOptions.find((option) => option.method === 'cod');
      assert.equal(cod.total, 3499 + 999);
      assert.equal(cod.saving, 0);
      assert.equal(upi.saving, discount);
    });
  });

  test('a part no service fits is priced without fitting and says so', async () => {
    const bare = insertProduct({ name: 'Plain Trim Clip', category_id: t.fixtures.categories.exterior.id });
    const cart = (await price({ items: [line(bare, 1, { fitAtStudio: true })] })).body;
    assert.equal(cart.lines[0].fittingService, null);
    assert.equal(cart.lines[0].fitAtStudio, false);
    assert.equal(cart.lines[0].fittingCharge, 0);
    assert.equal(cart.fulfilment, 'delivery');
    assert.ok(cart.messages.some((message) => message.includes('We do not fit Plain Trim Clip at the studio')));
    t.ctx.db.run('DELETE FROM products WHERE id = ?', [bare.id]);
  });

  test('a service with no charge adds nothing, and the free consultation never applies to a part', async () => {
    const services = t.ctx.settings.get().services.map((service) =>
      service.id === 'consult' ? { ...service, subcategorySlugs: ['alloy-wheels'] } : service.id === 'wheels' ? { ...service, charge: 0 } : service,
    );
    // Put the consultation first so it would win if it were allowed to.
    services.unshift(services.splice(services.findIndex((service) => service.id === 'consult'), 1)[0]);
    await withSettings({ services }, async () => {
      const cart = (await price({ items: [{ ...wheelLine(0), fitAtStudio: true }] })).body;
      assert.equal(cart.lines[0].fittingService.id, 'wheels');
      assert.equal(cart.lines[0].fitAtStudio, true);
      assert.equal(cart.lines[0].fittingCharge, 0);
      assert.equal(cart.fittingTotal, 0);
      assert.equal(cart.fulfilment, 'studio', 'still fitted at the studio');
      assert.equal(cart.total, 21999);
    });
  });

  test('pickup: no shipping, pay at the studio without fee or advance, and the PIN code does not matter', async () => {
    await withSettings({ cod: { advancePercent: 20 } }, async () => {
      const remoteDelivery = (await price({ items: [line(P.universal)], pincode: '793001', paymentMethod: 'cod' })).body;
      const remoteCod = remoteDelivery.paymentOptions.find((option) => option.method === 'cod');
      assert.equal(remoteCod.available, false, 'COD does not reach the North-East');

      const pickup = (await price({ items: [line(P.spoiler)], fulfilment: 'pickup', pincode: '793001', paymentMethod: 'cod' })).body;
      assert.equal(pickup.fulfilment, 'pickup');
      assert.equal(pickup.needsSlot, false);
      assert.equal(pickup.shippingFee, 0);
      assert.equal(pickup.codFee, 0);
      assert.equal(pickup.payNow, 0);
      assert.equal(pickup.total, 3499);
      const cod = pickup.paymentOptions.find((option) => option.method === 'cod');
      assert.equal(cod.available, true);
      assert.equal(cod.label, 'Pay at the studio');
    });
  });

  test('made-to-order parts still have to be paid online at the studio', async () => {
    const cart = (await price({ items: [plate()], fulfilment: 'pickup' })).body;
    const cod = cart.paymentOptions.find((option) => option.method === 'cod');
    assert.equal(cod.available, false);
    assert.match(cod.reason, /made to order/);
  });

  test("'studio' with nothing to fit is priced as a pickup", async () => {
    const cart = (await price({ items: [line(P.universal)], fulfilment: 'studio' })).body;
    assert.equal(cart.fulfilment, 'pickup');
    assert.equal(cart.needsSlot, false);
    assert.ok(cart.messages.some((message) => message.includes('pickup')));
  });

  test('while the studio is paused, fitting and pickup fall back to delivery with a note', async () => {
    await withSettings({ studio: { enabled: false } }, async () => {
      const cart = (await price({ items: [fitted(P.spoiler)], fulfilment: 'pickup' })).body;
      assert.equal(cart.fulfilment, 'delivery');
      assert.equal(cart.lines[0].fitAtStudio, false);
      assert.equal(cart.lines[0].fittingService, null);
      assert.equal(cart.fittingTotal, 0);
      assert.equal(cart.shippingFee, 199);
      assert.ok(cart.messages.some((message) => message.includes('paused')));
    });
  });

  test('the same part twice is one line, fitted if either asked', async () => {
    const cart = (await price({ items: [line(P.universal, 1), fitted(P.universal, 2)] })).body;
    assert.equal(cart.lines.length, 1);
    assert.equal(cart.lines[0].qty, 3);
    assert.equal(cart.lines[0].fittingCharge, 999 * 3);
  });

  test('the fitter tip offers the studio, and goes quiet once the part is fitted there', async () => {
    t.ctx.db.run('UPDATE products SET pro_install = 1 WHERE id = ?', [P.spoiler.id]);
    try {
      const plain = (await price({ items: [line(P.spoiler)] })).body;
      const [tip] = advice(plain, 'pro_install');
      assert.match(tip.message, /fitting at our studio \(Spoiler, skirts and body kit fitting, ₹999 each\)/);
      const studio = (await price({ items: [fitted(P.spoiler)] })).body;
      assert.equal(advice(studio, 'pro_install').length, 0);
    } finally {
      t.ctx.db.run('UPDATE products SET pro_install = 0 WHERE id = ?', [P.spoiler.id]);
    }
  });

  test('fulfilment is validated', async () => {
    const res = await price({ items: [line(P.universal)], fulfilment: 'drone' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.fulfilment);
  });
});
