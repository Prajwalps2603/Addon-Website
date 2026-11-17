/**
 * Orders: creation, payment, status changes, cancellation and loading. Routes (storefront and admin)
 * call these; nothing else writes the orders tables.
 *
 *   createOrder(ctx, request, { user })                       { order, payment, created }
 *   paymentInstructionFor(ctx, orderRow)                       PaymentInstruction (async: may create a Razorpay order)
 *   markPaid(ctx, orderNumber, { amount, method, reference })  Order, idempotent
 *   changeStatus(ctx, orderNumber, update, { actor })          Order (admin)
 *   cancelOrder(ctx, orderNumber, { actor, reason })           Order
 *   loadOrder(ctx, orderNumber, { includeToken })              Order | null
 *   ordersFromRows(ctx, rows, { includeToken })                Order[] in two queries (lists)
 *   expireStaleOrders(ctx)                                     number of orders cancelled
 *
 * Money is integer rupees; paise appear only in the Razorpay instruction.
 */
import crypto from 'node:crypto';
import * as z from 'zod';
import { getVehicleRow } from './catalog.js';
import { HttpError, badRequest, conflict, notFound } from './errors.js';
import { invoiceNumber, orderNumber as newOrderNumber, randomToken } from './ids.js';
import { stringList, toOrder, vehicleLabel } from './mappers.js';
import { formatINR } from './money.js';
import * as notify from './notify.js';
import { cartItemsSchema, fulfilmentSchema, priceCartDetailed } from './pricing.js';
import { getRazorpay, toPaise } from './razorpay.js';
import { addWorkingDays, estimateShipping } from './shipping.js';
import { assertSlotFree, formatDay, formatSlot, insertBooking, registrationSchema, slotChoiceSchema } from './studio.js';
import { addressSchema, emailSchema, gstinSchema, parse, phoneSchema, validationError } from './validate.js';

/** Unpaid online orders are cancelled, and their stock released, after this long. */
export const PAYMENT_WINDOW_MINUTES = 60;

const rs = (amount) => formatINR(amount);
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

// ---------------------------------------------------------------------------
// Status rules
// ---------------------------------------------------------------------------

/** The forward path of an order. A status may move to any later one on this path. */
const FLOW = ['pending_payment', 'placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
const CANCELLABLE_BY_ADMIN = new Set(['pending_payment', 'placed', 'confirmed', 'packed']);
const CANCELLABLE_BY_CUSTOMER = new Set(['pending_payment', 'placed', 'confirmed']);
const RETURNABLE = new Set(['shipped', 'out_for_delivery', 'delivered']);
const TERMINAL = new Set(['cancelled', 'returned']);

export const ORDER_STATUSES = [...FLOW, 'cancelled', 'returned'];
export const PAYMENT_STATUSES = ['pending', 'advance_paid', 'paid', 'failed', 'refunded'];

/** True when an admin may move an order from `from` to `to`. Moving to the same status is not a transition. */
export function canTransition(from, to) {
  if (from === to) return false;
  if (TERMINAL.has(from)) return false;
  if (to === 'cancelled') return CANCELLABLE_BY_ADMIN.has(from);
  if (to === 'returned') return RETURNABLE.has(from);
  const a = FLOW.indexOf(from);
  const b = FLOW.indexOf(to);
  return a >= 0 && b > a && to !== 'pending_payment';
}

/** Statuses an admin may move this order to, in path order. */
export function nextStatuses(from) {
  return ORDER_STATUSES.filter((to) => canTransition(from, to));
}

const STATUS_LABEL = {
  pending_payment: 'Waiting for payment',
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const contactSchema = z.object({
  name: z.string({ error: 'Enter your name' }).trim().min(2, { error: 'Enter your name' }).max(80),
  email: z.preprocess((value) => (value === null || value === undefined ? '' : value), z.union([z.literal(''), emailSchema])),
  phone: phoneSchema,
});

// An address form left empty (every field blank) counts as no address.
const ADDRESS_FIELDS = ['name', 'phone', 'line1', 'line2', 'landmark', 'city', 'state', 'pincode'];
function blankAddressToUndefined(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && !Array.isArray(value) && ADDRESS_FIELDS.every((key) => String(value[key] ?? '').trim() === '')) return undefined;
  return value;
}

export const createOrderSchema = z
  .object({
    items: cartItemsSchema.default([]),
    couponCode: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
    contact: contactSchema,
    // Required for delivery. Optional for pickup and studio orders; when given it is validated and kept.
    shippingAddress: z.preprocess(blankAddressToUndefined, addressSchema.optional()),
    fulfilment: fulfilmentSchema,
    studioSlot: z.preprocess((value) => (value === null ? undefined : value), slotChoiceSchema.optional()),
    paymentMethod: z.enum(['cod', 'razorpay', 'upi'], { error: 'Choose how you want to pay' }),
    notes: z.preprocess((value) => value ?? '', z.string().trim().max(500)),
    gstin: z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : (value ?? undefined)), gstinSchema.optional()),
    vehicleId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
    vehicleLabel: z.preprocess((value) => value ?? '', z.string().trim().max(80)),
    registrationNumber: registrationSchema,
    quoteToken: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    leadToken: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    saveAddress: z.boolean().optional().default(false),
    idempotencyKey: z
      .string({ error: 'Missing checkout key. Refresh the page and try again.' })
      .trim()
      .min(8, { error: 'Missing checkout key. Refresh the page and try again.' })
      .max(100),
  })
  .superRefine((value, check) => {
    if (!value.quoteToken && value.items.length === 0) {
      check.addIssue({ code: 'custom', path: ['items'], message: 'Your cart is empty.' });
    }
  });

// ---------------------------------------------------------------------------
// Reading orders
// ---------------------------------------------------------------------------

/** The orders row for an order number, or null. */
export function getOrderRow(ctx, orderNumber) {
  if (typeof orderNumber !== 'string' || orderNumber.length === 0 || orderNumber.length > 40) return null;
  return ctx.db.get('SELECT * FROM orders WHERE order_number = ?', [orderNumber]) ?? null;
}

/** True when `token` is the order's access token (constant-time compare). */
export function tokenMatches(orderRow, token) {
  if (!orderRow || typeof token !== 'string' || token.length === 0) return false;
  const a = Buffer.from(String(orderRow.access_token));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function deliveryEstimator(ctx) {
  const cache = new Map();
  return (row) => {
    if (TERMINAL.has(row.status) || row.status === 'delivered') return null;
    const pin = String(row.ship_pincode ?? '');
    if (!cache.has(pin)) {
      let estimate = null;
      try {
        estimate = estimateShipping(ctx, pin);
      } catch {
        estimate = null;
      }
      cache.set(pin, estimate);
    }
    const estimate = cache.get(pin);
    if (!estimate?.serviceable) return null;
    // Counted from the day the order was placed, so the promise does not drift each day it is viewed.
    const from = row.created_at || ctx.now();
    return { earliest: addWorkingDays(from, estimate.minDays), latest: addWorkingDays(from, estimate.maxDays) };
  };
}

/** Orders (api.ts) for many orders rows: items and events in one query each. Keeps the order of `rows`. */
export function ordersFromRows(ctx, rows, { includeToken = false } = {}) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const items = ctx.db.all('SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, id', [ids]);
  const events = ctx.db.all('SELECT * FROM order_events WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, created_at, id', [ids]);
  const group = (list) => {
    const map = new Map();
    for (const row of list) {
      if (!map.has(row.order_id)) map.set(row.order_id, []);
      map.get(row.order_id).push(row);
    }
    return map;
  };
  const itemsBy = group(items);
  const eventsBy = group(events);
  const studioNumbers = rows.filter((row) => row.fulfilment === 'studio').map((row) => row.order_number);
  const bookingBy = new Map();
  if (studioNumbers.length > 0) {
    for (const booking of ctx.db.all(
      'SELECT order_number, booking_number FROM bookings WHERE order_number IN (SELECT value FROM json_each(?)) ORDER BY id',
      [studioNumbers],
    )) {
      if (!bookingBy.has(booking.order_number)) bookingBy.set(booking.order_number, booking.booking_number);
    }
  }
  const settings = ctx.settings.get();
  const estimate = deliveryEstimator(ctx);
  return rows.map((row) =>
    toOrder(row, {
      items: itemsBy.get(row.id) ?? [],
      events: eventsBy.get(row.id) ?? [],
      settings,
      includeToken,
      estimatedDelivery: (row.fulfilment ?? 'delivery') === 'delivery' ? estimate(row) : null,
      bookingNumber: bookingBy.get(row.order_number) ?? '',
    }),
  );
}

/** The Order (api.ts) for an order number, or null. `includeToken` only for the buyer's own views. */
export function loadOrder(ctx, orderNumber, { includeToken = false } = {}) {
  const row = getOrderRow(ctx, orderNumber);
  return row ? ordersFromRows(ctx, [row], { includeToken })[0] : null;
}

function orderFromRow(ctx, row, options) {
  return ordersFromRows(ctx, [row], options)[0];
}

// ---------------------------------------------------------------------------
// Small writers
// ---------------------------------------------------------------------------

function addEvent(ctx, orderId, status, note, actor = 'system') {
  ctx.db.run('INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, ?, ?)', [
    orderId,
    status,
    note,
    ['customer', 'admin'].includes(actor) ? actor : 'system',
    ctx.now(),
  ]);
}

/** Puts an order's items back on the shelf: variants and their products. Call inside a tx. */
function restoreStock(ctx, orderId) {
  const items = ctx.db.all('SELECT product_id, variant_id, qty FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    if (item.variant_id) {
      ctx.db.run('UPDATE product_variants SET stock = stock + ? WHERE id = ?', [item.qty, item.variant_id]);
    }
    if (item.product_id) {
      ctx.db.run('UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?', [item.qty, ctx.now(), item.product_id]);
    }
  }
}

/**
 * Keeps the studio diary in step with an order: 'placed' confirms a requested booking, 'cancelled'
 * and 'returned' cancel it, 'delivered' (handed over at the studio) completes it. Call inside a tx.
 */
function syncStudioBooking(ctx, orderRow, status) {
  if (!orderRow || orderRow.fulfilment !== 'studio') return;
  const now = ctx.now();
  const number = orderRow.order_number;
  if (status === 'placed') {
    ctx.db.run("UPDATE bookings SET status = 'confirmed', updated_at = ? WHERE order_number = ? AND status = 'requested'", [now, number]);
  } else if (status === 'cancelled' || status === 'returned') {
    ctx.db.run(
      "UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE order_number = ? AND status IN ('requested', 'confirmed', 'in_progress')",
      [now, number],
    );
  } else if (status === 'delivered') {
    ctx.db.run(
      "UPDATE bookings SET status = 'completed', updated_at = ? WHERE order_number = ? AND status IN ('requested', 'confirmed', 'in_progress')",
      [now, number],
    );
  }
}

/** What an order still expects online, whatever its status: the COD advance, or the full total. Rupees. */
export function amountOwedOnline(orderRow) {
  if (!orderRow) return 0;
  const paid = Number(orderRow.amount_paid) || 0;
  if (orderRow.payment_method === 'cod') return Math.max(0, (Number(orderRow.advance_amount) || 0) - paid);
  return Math.max(0, (Number(orderRow.total) || 0) - paid);
}

/** What the buyer has to pay online right now, in rupees: 0 unless the order is waiting for payment. */
export function amountDueNow(orderRow) {
  return orderRow?.status === 'pending_payment' ? amountOwedOnline(orderRow) : 0;
}

function onlineProviders(ctx) {
  const { payments } = ctx.settings.get();
  return {
    razorpay: Boolean(payments.razorpay && getRazorpay(ctx)),
    upi: Boolean(payments.upi && payments.upiId),
  };
}

// ---------------------------------------------------------------------------
// Stale orders
// ---------------------------------------------------------------------------

/** Cancels 'pending_payment' orders older than the payment window and restores their stock. Returns how many. */
export function expireStaleOrders(ctx) {
  const cutoffMs = Date.parse(ctx.now()) - PAYMENT_WINDOW_MINUTES * 60 * 1000;
  if (!Number.isFinite(cutoffMs)) return 0;
  const cutoff = new Date(cutoffMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const stale = ctx.db.all(
    "SELECT id, order_number, fulfilment FROM orders WHERE status = 'pending_payment' AND created_at < ? ORDER BY id",
    [cutoff],
  );
  if (stale.length === 0) return 0;
  let expired = 0;
  ctx.db.tx(() => {
    for (const row of stale) {
      const { id } = row;
      const { changes } = ctx.db.run(
        "UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending_payment' AND amount_paid = 0",
        [ctx.now(), id],
      );
      if (changes === 0) continue;
      restoreStock(ctx, id);
      syncStudioBooking(ctx, row, 'cancelled');
      addEvent(ctx, id, 'cancelled', `Payment was not received within ${PAYMENT_WINDOW_MINUTES} minutes, so the order was cancelled and the parts went back into stock.`);
      expired += 1;
    }
  });
  return expired;
}

// ---------------------------------------------------------------------------
// Creating an order
// ---------------------------------------------------------------------------

function outOfStockError(line, available) {
  const name = `${line.name}${line.variantName ? ` (${line.variantName})` : ''}`;
  const message = available > 0 ? `Only ${available} left of ${name}. Update the quantity and try again.` : `${name} has just sold out. Remove it and try again.`;
  return conflict(message, 'out_of_stock');
}

/** Turns a cart that cannot be checked out into the 409 to throw. */
function checkoutRefusal(detailed) {
  const { cart, rows } = detailed;
  const stockLine = cart.lines.find((line) => line.issue === 'out_of_stock' || line.issue === 'insufficient_stock');
  if (stockLine) return outOfStockError(stockLine, stockLine.maxQty);
  const problem = cart.messages[0] ?? (rows.length === 0 ? 'Your cart is empty.' : 'Your cart has changed. Check it and try again.');
  return conflict(problem);
}

function insertOrder(ctx, values) {
  const columns = Object.keys(values);
  const sql = `INSERT INTO orders (${columns.join(', ')}) VALUES (${columns.map((key) => `:${key}`).join(', ')})`;
  return Number(ctx.db.run(sql, values).lastInsertRowid);
}

function saveAddressFor(ctx, userId, address) {
  const same = ctx.db.get(
    'SELECT id FROM addresses WHERE user_id = ? AND line1 = ? AND pincode = ? AND name = ? AND phone = ?',
    [userId, address.line1, address.pincode, address.name, address.phone],
  );
  if (same) return;
  const count = ctx.db.get('SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?', [userId]).n;
  const isDefault = Boolean(address.isDefault) || count === 0;
  if (isDefault) ctx.db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
  ctx.db.run(
    `INSERT INTO addresses (user_id, label, name, phone, line1, line2, landmark, city, state, pincode, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, address.label, address.name, address.phone, address.line1, address.line2, address.landmark, address.city, address.state, address.pincode, isDefault, ctx.now()],
  );
}

/**
 * Places an order from a CreateOrderRequest. Validates, re-prices on the server, then in one
 * transaction checks and takes the stock, writes the order, its items and first event, and
 * updates the coupon, quote, lead and address book. Returns { order, payment, created }:
 * `created` is false when the idempotency key matched an existing order, which is returned as it is.
 */
export async function createOrder(ctx, request, { user = null } = {}) {
  const input = parse(createOrderSchema, request);
  expireStaleOrders(ctx);

  const existing = ctx.db.get('SELECT * FROM orders WHERE idempotency_key = ?', [input.idempotencyKey]);
  if (existing) {
    return { order: orderFromRow(ctx, existing, { includeToken: true }), payment: await paymentInstructionFor(ctx, existing), created: false };
  }

  let orderId;
  try {
    orderId = ctx.db.tx(() => placeOrder(ctx, input, user));
  } catch (err) {
    // Two requests with the same key at once: the loser returns the winner's order.
    if (err?.errcode === 2067 && String(err.message).includes('idempotency_key')) {
      const winner = ctx.db.get('SELECT * FROM orders WHERE idempotency_key = ?', [input.idempotencyKey]);
      if (winner) return { order: orderFromRow(ctx, winner, { includeToken: true }), payment: await paymentInstructionFor(ctx, winner), created: false };
    }
    throw err;
  }

  const row = ctx.db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
  const payment = await paymentInstructionFor(ctx, row);
  const order = orderFromRow(ctx, ctx.db.get('SELECT * FROM orders WHERE id = ?', [orderId]), { includeToken: true });
  if (order.status === 'placed') notify.orderPlaced(ctx, order);
  return { order, payment, created: true };
}

// The synchronous heart of createOrder, run inside ctx.db.tx. Returns the new order id.
// Field errors for a request that does not suit how the order will be fulfilled. Thrown inside the tx.
function fulfilmentProblems(ctx, input, cart, vehicleRow) {
  const issues = [];
  const add = (path, message) => issues.push({ code: 'custom', path, message });
  if (cart.fulfilment === 'delivery' && !input.shippingAddress) {
    add(['shippingAddress'], input.fulfilment && input.fulfilment !== 'delivery'
      ? 'Collection at the studio is paused right now. Enter a delivery address.'
      : 'Enter the delivery address.');
  }
  if (cart.fulfilment === 'studio') {
    if (!input.studioSlot) add(['studioSlot'], 'Choose a day and time to bring your car to the studio.');
    if (!vehicleRow && !input.vehicleLabel) add(['vehicleLabel'], 'Tell us which car we are fitting the parts to.');
  }
  if (input.vehicleId && !vehicleRow) add(['vehicleId'], 'We could not find that car. Choose it again.');
  if (issues.length > 0) throw validationError(issues);
}

function placeOrder(ctx, input, user) {
  const now = ctx.now();
  const vehicleRow = input.vehicleId ? getVehicleRow(ctx, input.vehicleId) : null;

  // 1. Price it again, here, with the catalogue as it is inside this transaction.
  const detailed = priceCartDetailed(
    ctx,
    {
      items: input.quoteToken ? [] : input.items,
      couponCode: input.quoteToken ? undefined : input.couponCode,
      pincode: input.shippingAddress?.pincode,
      paymentMethod: input.paymentMethod,
      vehicleId: vehicleRow ? vehicleRow.id : undefined,
      quoteToken: input.quoteToken,
      fulfilment: input.fulfilment,
    },
    { user },
  );
  const { cart, rows, quoteRow } = detailed;
  fulfilmentProblems(ctx, input, cart, vehicleRow);
  if (!cart.canCheckout) throw checkoutRefusal(detailed);
  const fulfilment = cart.fulfilment;
  const address = input.shippingAddress ?? null;
  const studioSlot = fulfilment === 'studio' ? input.studioSlot : null;
  // The last place in a slot goes to one car only: this check and the booking below share the transaction.
  if (studioSlot) assertSlotFree(ctx, studioSlot.date, studioSlot.slot);
  const carLabel = vehicleRow ? vehicleLabel(vehicleRow) : input.vehicleLabel;

  const option = cart.paymentOptions.find((entry) => entry.method === input.paymentMethod);
  if (!option?.available || detailed.paymentMethod !== input.paymentMethod) {
    throw conflict(option?.reason ? `${option.label} is not available for this order: ${option.reason}` : 'That payment option is not available for this order.');
  }
  if (input.couponCode && !input.quoteToken && cart.couponError) throw conflict(cart.couponError);

  const advance = input.paymentMethod === 'cod' ? cart.payNow : 0;
  const providers = onlineProviders(ctx);
  if (advance > 0 && !providers.razorpay && !providers.upi) {
    throw conflict('Cash on delivery here needs a small advance paid online, and online payment is not set up yet. Message us to order.');
  }
  if (input.paymentMethod === 'razorpay' && !providers.razorpay) throw conflict('Card and netbanking payments are not set up yet.');
  const needsMoneyNow = input.paymentMethod !== 'cod' || advance > 0;
  const status = needsMoneyNow ? 'pending_payment' : 'placed';

  // 2. Take the stock, guarded so a sale that happened a moment ago cannot be sold twice.
  for (const { line, product, variant } of rows) {
    if (variant) {
      const taken = ctx.db.run('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?', [line.qty, variant.id, line.qty]);
      if (taken.changes === 0) {
        const left = ctx.db.get('SELECT stock FROM product_variants WHERE id = ?', [variant.id])?.stock ?? 0;
        throw outOfStockError(line, Math.max(0, left));
      }
      // products.stock is the sum of its variants: take the same quantity off it.
      ctx.db.run('UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?', [line.qty, now, product.id]);
    } else {
      const taken = ctx.db.run('UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock >= ?', [line.qty, now, product.id, line.qty]);
      if (taken.changes === 0) {
        const left = ctx.db.get('SELECT stock FROM products WHERE id = ?', [product.id])?.stock ?? 0;
        throw outOfStockError(line, Math.max(0, left));
      }
    }
  }

  // 3. The coupon is counted once per order, never past its limit.
  if (cart.coupon) {
    const used = ctx.db.run(
      'UPDATE coupons SET used_count = used_count + 1 WHERE code = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
      [cart.coupon.code],
    );
    if (used.changes === 0) throw conflict(`The code ${cart.coupon.code} has been fully used.`);
  }

  // 4. The order itself.
  const number = newOrderNumber(ctx);
  const orderId = insertOrder(ctx, {
    order_number: number,
    invoice_number: invoiceNumber(ctx, now),
    access_token: randomToken(),
    idempotency_key: input.idempotencyKey,
    user_id: user?.id ?? null,
    status,
    payment_method: input.paymentMethod,
    payment_status: 'pending',
    customer_name: input.contact.name,
    email: input.contact.email || (user?.email ?? ''),
    phone: input.contact.phone,
    ship_name: address?.name ?? '',
    ship_phone: address?.phone ?? '',
    ship_line1: address?.line1 ?? '',
    ship_line2: address?.line2 ?? '',
    ship_landmark: address?.landmark ?? '',
    ship_city: address?.city ?? '',
    ship_state: address?.state ?? '',
    ship_pincode: address?.pincode ?? '',
    gstin: input.gstin ?? '',
    vehicle: carLabel,
    fulfilment,
    studio_date: studioSlot?.date ?? '',
    studio_slot: studioSlot?.slot ?? '',
    fitting_total: cart.fittingTotal,
    subtotal: cart.subtotal,
    discount: cart.discount,
    coupon_code: cart.coupon?.code ?? '',
    prepaid_discount: cart.prepaidDiscount,
    shipping_fee: cart.shippingFee,
    cod_fee: cart.codFee,
    total: cart.total,
    advance_amount: advance,
    amount_paid: 0,
    quote_token: quoteRow ? String(quoteRow.token) : '',
    notes: input.notes,
    created_at: now,
    updated_at: now,
  });

  for (const { line, product, variant } of rows) {
    ctx.db.run(
      `INSERT INTO order_items (order_id, product_id, variant_id, slug, name, variant_name, sku, image, price, mrp, qty, gst_rate, hsn_code, custom,
         fit_at_studio, fitting_charge, fitting_service)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        product.id,
        variant ? variant.id : null,
        String(product.slug ?? ''),
        String(product.name ?? ''),
        variant ? String(variant.name ?? '') : '',
        String((variant ? variant.sku : product.sku) ?? ''),
        stringList(product.images)[0] ?? '',
        line.unitPrice,
        line.unitMrp,
        line.qty,
        Number(product.gst_rate ?? 18),
        String(product.hsn_code ?? ''),
        line.custom ? line.custom : null,
        line.fitAtStudio,
        line.fittingCharge,
        line.fittingServiceName,
      ],
    );
  }

  // The studio diary gets the car, so the slot shows as taken there and staff see what to fit.
  if (studioSlot) {
    const fitted = rows.filter(({ line }) => line.fitAtStudio);
    const serviceNames = [...new Set(fitted.map(({ line }) => line.fittingServiceName))];
    insertBooking(ctx, {
      service_id: 'order',
      service_name: `${serviceNames.join(', ')} (order ${number})`,
      service_charge: cart.fittingTotal,
      service_minutes: fitted.reduce((sum, { line }) => sum + (line.fittingService?.minutes ?? 0), 0),
      date: studioSlot.date,
      slot: studioSlot.slot,
      name: input.contact.name,
      phone: input.contact.phone,
      email: input.contact.email || (user?.email ?? ''),
      vehicle: carLabel,
      vehicle_id: vehicleRow ? vehicleRow.id : null,
      registration_number: input.registrationNumber,
      notes: input.notes,
      order_number: number,
      status: status === 'placed' ? 'confirmed' : 'requested',
    });
  }

  // 5. What this order closes: the quote it was priced from and the abandoned checkout it recovers.
  if (quoteRow) {
    const ordered = ctx.db.run("UPDATE quotes SET status = 'ordered', order_number = ? WHERE id = ? AND status = 'open'", [number, quoteRow.id]);
    if (ordered.changes === 0) throw conflict('This quote has already been ordered.');
  }
  if (input.leadToken) {
    ctx.db.run("UPDATE checkout_leads SET status = 'recovered', order_number = ?, updated_at = ? WHERE token = ?", [number, now, input.leadToken]);
  }
  if (input.saveAddress && user?.id && address) saveAddressFor(ctx, user.id, address);

  // 6. The first line of the order's story.
  const when = studioSlot ? ` Fitting at the studio on ${formatDay(studioSlot.date)} at ${formatSlot(studioSlot.slot)}.` : '';
  let note;
  if (status === 'placed' && fulfilment === 'studio') note = `Order placed. Pay ${rs(cart.total)} at the studio.${when}`;
  else if (status === 'placed' && fulfilment === 'pickup') note = `Order placed. Pay ${rs(cart.total)} at the studio when you collect it.`;
  else if (status === 'placed') note = `Order placed. Pay ${rs(cart.total)} on delivery.`;
  else if (input.paymentMethod === 'cod') note = `Order created. Waiting for the ${rs(advance)} advance; ${rs(cart.total - advance)} is due on delivery.`;
  else note = `Order created. Waiting for the payment of ${rs(cart.total)}.${when}`;
  addEvent(ctx, orderId, status, note, 'customer');

  return orderId;
}

// ---------------------------------------------------------------------------
// Payment instructions
// ---------------------------------------------------------------------------

/** The upi://pay link for a payment: pa, pn, am (two decimals), cu=INR, tr and tn. */
export function upiUri({ upiId, payeeName, amount, orderNumber }) {
  const parts = [
    `pa=${encodeURIComponent(upiId).replaceAll('%40', '@')}`,
    `pn=${encodeURIComponent(payeeName)}`,
    `am=${Number(amount).toFixed(2)}`,
    'cu=INR',
    `tr=${encodeURIComponent(orderNumber)}`,
    `tn=${encodeURIComponent(`Order ${orderNumber}`)}`,
  ];
  return `upi://pay?${parts.join('&')}`;
}

/** Creates the Razorpay order once and stores its id; later calls reuse the stored one. */
async function razorpayOrderFor(ctx, client, orderRow, amount) {
  if (orderRow.razorpay_order_id) return orderRow.razorpay_order_id;
  let created;
  try {
    created = await client.orders.create({
      amount: toPaise(amount),
      currency: 'INR',
      receipt: String(orderRow.order_number).slice(0, 40),
      notes: { orderNumber: String(orderRow.order_number) },
    });
  } catch (err) {
    console.error(`[razorpay] Could not create an order for ${orderRow.order_number}: ${err?.error?.description ?? err?.message ?? err}`);
    throw new HttpError(502, 'payment_unavailable', 'We could not reach the payment gateway. Your order is saved: try paying again in a minute.');
  }
  if (!created?.id) throw new HttpError(502, 'payment_unavailable', 'We could not reach the payment gateway. Your order is saved: try paying again in a minute.');
  const { changes } = ctx.db.run('UPDATE orders SET razorpay_order_id = ?, updated_at = ? WHERE id = ? AND razorpay_order_id IS NULL', [
    String(created.id),
    ctx.now(),
    orderRow.id,
  ]);
  if (changes === 0) {
    // Another request stored one first: use that, so there is only ever one Razorpay order per order.
    return ctx.db.get('SELECT razorpay_order_id FROM orders WHERE id = ?', [orderRow.id]).razorpay_order_id;
  }
  return String(created.id);
}

/**
 * What the buyer must do now to pay for this order (PaymentInstruction of api.ts), or null when
 * nothing is due online (plain COD, or already paid). COD advances use Razorpay when it is set up, else UPI.
 */
export async function paymentInstructionFor(ctx, orderRow) {
  const amount = amountDueNow(orderRow);
  if (amount <= 0) return null;
  const purpose = orderRow.payment_method === 'cod' ? 'advance' : 'full';
  const settings = ctx.settings.get();
  const providers = onlineProviders(ctx);

  let provider = orderRow.payment_method;
  if (provider === 'cod') provider = providers.razorpay ? 'razorpay' : providers.upi ? 'upi' : null;
  if (provider === 'razorpay' && !providers.razorpay) {
    throw conflict('Card and netbanking payments are switched off right now. Message us and we will help you pay another way.');
  }
  if (provider === 'upi' && !providers.upi) {
    throw conflict('UPI payments are switched off right now. Message us and we will help you pay another way.');
  }
  if (!provider) throw conflict('Online payment is not set up yet. Message us to complete this order.');

  if (provider === 'razorpay') {
    const client = getRazorpay(ctx);
    const razorpayOrderId = await razorpayOrderFor(ctx, client, orderRow, amount);
    return {
      provider: 'razorpay',
      purpose,
      keyId: settings.payments.razorpayKeyId || ctx.config.razorpay.keyId,
      razorpayOrderId,
      amountPaise: toPaise(amount),
      currency: 'INR',
      prefill: { name: String(orderRow.customer_name ?? ''), email: String(orderRow.email ?? ''), contact: orderRow.phone ? `+91${orderRow.phone}` : '' },
    };
  }

  const upiId = settings.payments.upiId;
  const payeeName = settings.payments.upiPayeeName || settings.storeName;
  return {
    provider: 'upi',
    purpose,
    upiUri: upiUri({ upiId, payeeName, amount, orderNumber: orderRow.order_number }),
    upiId,
    payeeName,
    amount,
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

const METHOD_TEXT = { razorpay: 'Razorpay', upi: 'UPI', cash: 'cash', cod: 'cash on delivery', bank: 'bank transfer' };

/**
 * Records money received for an order. Safe to call any number of times for the same payment
 * (verify, webhook and a retry can all arrive): a reference already recorded, or an order already
 * fully paid, changes nothing. Sets payment_status 'paid' (or 'advance_paid' for a COD advance),
 * moves 'pending_payment' to 'placed', writes an event and sends the order-placed emails once.
 * `amount` is in rupees; `method` is 'razorpay', 'upi' or 'cash'; `reference` the gateway payment id or UTR.
 */
export function markPaid(ctx, orderNumber, { amount, method = 'razorpay', reference = '' } = {}) {
  const ref = String(reference ?? '').trim();
  const rupees = Math.max(0, Math.trunc(Number(amount) || 0));
  let placedNow = false;

  const row = ctx.db.tx(() => {
    const order = getOrderRow(ctx, orderNumber);
    if (!order) throw notFound('Order');
    const already =
      (ref && method === 'razorpay' && order.razorpay_payment_id === ref) ||
      (ref && method === 'upi' && order.upi_reference === ref && order.payment_status !== 'pending') ||
      order.payment_status === 'paid' ||
      order.payment_status === 'refunded' ||
      rupees === 0;
    if (already) return order;

    const total = Number(order.total) || 0;
    const paid = Math.min(total, (Number(order.amount_paid) || 0) + rupees);
    const paymentStatus = paid >= total ? 'paid' : order.payment_method === 'cod' ? 'advance_paid' : 'pending';
    const status = order.status === 'pending_payment' && paymentStatus !== 'pending' ? 'placed' : order.status;
    const now = ctx.now();

    ctx.db.run(
      `UPDATE orders SET amount_paid = ?, payment_status = ?, status = ?,
         razorpay_payment_id = CASE WHEN ? = 'razorpay' AND ? <> '' THEN ? ELSE razorpay_payment_id END,
         upi_reference = CASE WHEN ? = 'upi' AND ? <> '' THEN ? ELSE upi_reference END,
         updated_at = ?
       WHERE id = ?`,
      [paid, paymentStatus, status, method, ref, ref, method, ref, ref, now, order.id],
    );

    const by = METHOD_TEXT[method] ?? method;
    let note;
    if (paymentStatus === 'paid') note = `Payment of ${rs(rupees)} received by ${by}.`;
    else if (paymentStatus === 'advance_paid') note = `Advance of ${rs(rupees)} received by ${by}. ${rs(total - paid)} is due on delivery.`;
    else note = `Part payment of ${rs(rupees)} received by ${by}. ${rs(total - paid)} still due.`;
    if (ref) note += ` Reference ${ref}.`;
    if (order.status === 'cancelled') note += ' The order had already been cancelled: refund this payment or revive the order.';
    addEvent(ctx, order.id, status, note);

    placedNow = order.status === 'pending_payment' && status === 'placed';
    if (placedNow) syncStudioBooking(ctx, order, 'placed');
    return ctx.db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
  });

  const order = orderFromRow(ctx, row, { includeToken: false });
  if (placedNow) notify.orderPlaced(ctx, order);
  return order;
}

/**
 * The buyer reports the UTR of a direct UPI payment. Stored, the order moves to 'placed' and the
 * payment stays 'pending' until an admin checks the bank statement. Sends the order-placed emails.
 */
export function confirmUpiPayment(ctx, orderRow, utr) {
  let placedNow = false;
  const row = ctx.db.tx(() => {
    const order = ctx.db.get('SELECT * FROM orders WHERE id = ?', [orderRow.id]);
    if (order.upi_reference === utr) return order;
    if (order.status !== 'pending_payment') {
      if (order.status === 'cancelled') throw conflict('This order was cancelled because the payment did not arrive in time. Message us with your UPI reference and we will sort it out.');
      throw conflict('This order is not waiting for a payment.');
    }
    const usesUpi = order.payment_method === 'upi' || (order.payment_method === 'cod' && !onlineProviders(ctx).razorpay);
    if (!usesUpi) throw conflict('This order is not paid by UPI.');
    ctx.db.run("UPDATE orders SET upi_reference = ?, status = 'placed', updated_at = ? WHERE id = ?", [utr, ctx.now(), order.id]);
    addEvent(ctx, order.id, 'placed', `UPI reference ${utr} sent by the customer for ${rs(amountDueNow(order))}. Awaiting verification against the bank statement.`, 'customer');
    syncStudioBooking(ctx, order, 'placed');
    placedNow = true;
    return ctx.db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
  });
  const order = orderFromRow(ctx, row, { includeToken: true });
  if (placedNow) notify.orderPlaced(ctx, order);
  return order;
}

// ---------------------------------------------------------------------------
// Status changes and cancellation
// ---------------------------------------------------------------------------

const PACK_PHOTO = /^(\/uploads\/[A-Za-z0-9._\-/]+|https:\/\/[^\s"'<>]+)$/;

export const adminOrderUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  amountPaid: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().max(1000).optional(),
  trackingCarrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(80).optional(),
  trackingUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Enter a full web address starting with https://' })]).optional(),
  packPhoto: z.union([z.literal(''), z.string().trim().max(500).regex(PACK_PHOTO, { error: 'Upload the photo first, then save.' })]).optional(),
});

/**
 * Admin update of an order (AdminOrderUpdate of api.ts). Only allowed transitions; restores stock when
 * an order is cancelled or returned, bumps sold_count when it is delivered, writes one event and
 * emails the customer when the status changes. `actor` is 'admin' unless said otherwise.
 */
export function changeStatus(ctx, orderNumber, update, { actor = 'admin' } = {}) {
  const input = parse(adminOrderUpdateSchema, update);
  let statusChanged = false;
  let placedNow = false;

  const row = ctx.db.tx(() => {
    const order = getOrderRow(ctx, orderNumber);
    if (!order) throw notFound('Order');
    const now = ctx.now();
    const total = Number(order.total) || 0;
    const set = {};
    const notes = [];

    // Payment first: a verified payment may itself move a waiting order on.
    let paymentStatus = order.payment_status;
    let amountPaid = Number(order.amount_paid) || 0;
    if (input.amountPaid !== undefined) {
      if (input.amountPaid > total) throw badRequest(`Amount paid cannot be more than the order total of ${rs(total)}.`, { amountPaid: `At most ${rs(total)}` });
      amountPaid = input.amountPaid;
    }
    if (input.paymentStatus !== undefined) {
      paymentStatus = input.paymentStatus;
      if (paymentStatus === 'paid' && input.amountPaid === undefined) amountPaid = total;
    }
    if (paymentStatus !== order.payment_status) {
      set.payment_status = paymentStatus;
      notes.push(`Payment marked ${paymentStatus.replace('_', ' ')}.`);
    }
    if (amountPaid !== (Number(order.amount_paid) || 0)) {
      set.amount_paid = amountPaid;
      notes.push(`Amount received ${rs(amountPaid)} of ${rs(total)}.`);
    }

    let status = order.status;
    if (input.status !== undefined && input.status !== order.status) {
      if (!canTransition(order.status, input.status)) {
        throw conflict(`An order that is ${STATUS_LABEL[order.status].toLowerCase()} cannot be moved to ${STATUS_LABEL[input.status].toLowerCase()}.`, 'invalid_transition');
      }
      status = input.status;
    } else if (order.status === 'pending_payment' && ['paid', 'advance_paid'].includes(paymentStatus) && paymentStatus !== order.payment_status) {
      status = 'placed';
    }

    for (const [key, column] of [
      ['trackingCarrier', 'tracking_carrier'],
      ['trackingNumber', 'tracking_number'],
      ['trackingUrl', 'tracking_url'],
      ['packPhoto', 'pack_photo'],
    ]) {
      if (input[key] !== undefined && input[key] !== order[column]) set[column] = input[key];
    }
    if (set.tracking_carrier !== undefined || set.tracking_number !== undefined || set.tracking_url !== undefined) {
      const carrier = set.tracking_carrier ?? order.tracking_carrier;
      const number = set.tracking_number ?? order.tracking_number;
      notes.push(`Tracking: ${[carrier, number].filter(Boolean).join(' ') || 'cleared'}.`);
    }
    if (set.pack_photo !== undefined) notes.push(set.pack_photo ? 'Pack photo added.' : 'Pack photo removed.');

    if (status !== order.status) {
      set.status = status;
      statusChanged = true;
      placedNow = order.status === 'pending_payment' && status === 'placed';
      if (status === 'cancelled' || status === 'returned') {
        // Cancelled and returned are final, so this runs at most once per order.
        restoreStock(ctx, order.id);
        notes.unshift(status === 'cancelled' ? 'Cancelled. Stock restored.' : 'Returned. Stock restored.');
      } else if (status === 'delivered') {
        // Delivered is reached once: nothing moves an order back out of it except a return.
        ctx.db.run(
          `UPDATE products SET sold_count = sold_count + (SELECT COALESCE(SUM(qty), 0) FROM order_items WHERE order_id = ? AND product_id = products.id)
           WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL)`,
          [order.id, order.id],
        );
        if (order.payment_method === 'cod' && set.payment_status === undefined && amountPaid < total) {
          set.payment_status = 'paid';
          set.amount_paid = total;
          notes.push(`${rs(total - amountPaid)} collected on delivery.`);
        }
      }
    }

    if (status !== order.status) syncStudioBooking(ctx, order, status);
    if (input.note) notes.push(input.note);
    if (Object.keys(set).length === 0 && !input.note) return order;

    if (Object.keys(set).length > 0) {
      const columns = Object.keys(set);
      ctx.db.run(`UPDATE orders SET ${columns.map((column) => `${column} = :${column}`).join(', ')}, updated_at = :updated_at WHERE id = :id`, {
        ...set,
        updated_at: now,
        id: order.id,
      });
    }
    addEvent(ctx, order.id, status, notes.join(' '), actor);
    return ctx.db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
  });

  const order = orderFromRow(ctx, row, { includeToken: false });
  if (placedNow) notify.orderPlaced(ctx, order);
  else if (statusChanged) notify.orderStatusChanged(ctx, order);
  return order;
}

/**
 * Cancels an order while it can still be cancelled (waiting for payment, placed or confirmed) and
 * puts its stock back. `actor` is 'customer', 'admin' or 'system'. 409 otherwise.
 * An admin may also cancel a packed order unless `rules: 'customer'` is passed (the storefront route does).
 */
export function cancelOrder(ctx, orderNumber, { actor = 'customer', reason = '', rules = actor === 'admin' ? 'admin' : 'customer' } = {}) {
  const why = String(reason ?? '').trim().slice(0, 300);
  const row = ctx.db.tx(() => {
    const order = getOrderRow(ctx, orderNumber);
    if (!order) throw notFound('Order');
    const allowed = rules === 'admin' ? CANCELLABLE_BY_ADMIN : CANCELLABLE_BY_CUSTOMER;
    if (!allowed.has(order.status)) {
      if (order.status === 'cancelled') throw conflict('This order is already cancelled.');
      throw conflict('This order is already packed, so it can no longer be cancelled here. Message us and we will help.');
    }
    ctx.db.run("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?", [ctx.now(), order.id]);
    restoreStock(ctx, order.id);
    syncStudioBooking(ctx, order, 'cancelled');
    const who = actor === 'customer' ? 'by the customer' : actor === 'admin' ? 'by the store' : '';
    let note = `Cancelled${who ? ` ${who}` : ''}.${why ? ` Reason: ${why}` : ''}`;
    if ((Number(order.amount_paid) || 0) > 0) note += ` ${rs(order.amount_paid)} was paid and is due a refund.`;
    addEvent(ctx, order.id, 'cancelled', note, actor);
    return ctx.db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
  });
  const order = orderFromRow(ctx, row, { includeToken: false });
  notify.orderStatusChanged(ctx, order);
  return order;
}
