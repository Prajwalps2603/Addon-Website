/**
 * The cart pricing engine: CartLineInput[] in, PricedCart of api.ts out.
 *
 * The server is the only source of truth for money. Nothing the browser sends about price,
 * total or discount is read: only product ids, variant ids, quantities, designer output,
 * a coupon code, a PIN code, a payment method, a car, a quote token, the fulfilment wanted and which
 * lines to fit at the studio. Fulfilment and fitting rules are in docs/API.md ("Fulfilment and studio fitting").
 *
 *   priceCart(ctx, request, { user })          PricedCart
 *   priceCartDetailed(ctx, request, { user })  { cart, rows, paymentMethod, quoteRow }
 *       rows[i] = { line, product, variant } for cart.lines[i]: product is the v_products row
 *       (with has_variants), variant the product_variants row or null. paymentMethod is the
 *       method the totals were worked out for (null when no method is available at all).
 *
 * Synchronous on purpose: callers may run it inside ctx.db.tx.
 */
import { createHash } from 'node:crypto';
import * as z from 'zod';
import { fitVerdictsFor, getProductRowsByIds, getVehicleRow } from './catalog.js';
import { orderTaxLines, quoteItems, stringList } from './mappers.js';
import { applyDrop, formatINR, taxBreakdown } from './money.js';
import { pincodeSchema } from './validate.js';
import { isValidPincode } from './india.js';
import { estimateShipping } from './shipping.js';
import { serviceForProduct } from './studio.js';

// ---------------------------------------------------------------------------
// Request schema (also for the orders route, which takes the same lines)
// ---------------------------------------------------------------------------

const MAX_LINES = 50;
const MAX_QTY = 99;
const MAX_CUSTOM_JSON = 2000;

const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

export const cartLineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  variantId: z.preprocess((value) => (value === undefined || value === '' ? null : value), z.coerce.number().int().positive().nullable()),
  qty: z.coerce.number().int().min(1, { error: 'Quantity must be at least 1.' }).max(MAX_QTY, { error: `At most ${MAX_QTY} of one part.` }),
  custom: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional()
    .refine((value) => value == null || JSON.stringify(value).length <= MAX_CUSTOM_JSON, { error: 'That design is too large.' }),
  // Ask for Addon to fit this part at the studio (adds the part's fitting charge).
  fitAtStudio: z.preprocess((value) => (value === null || value === undefined ? false : value), z.boolean()),
});

export const cartItemsSchema = z.array(cartLineSchema).max(MAX_LINES, { error: `A cart can hold up to ${MAX_LINES} lines.` });

export const FULFILMENTS = ['delivery', 'pickup', 'studio'];
export const fulfilmentSchema = z.preprocess(blankToUndefined, z.enum(FULFILMENTS, { error: 'Choose delivery, pickup or studio fitting.' }).optional());

export const priceCartRequestSchema = z.object({
  items: cartItemsSchema.default([]),
  fulfilment: fulfilmentSchema,
  couponCode: z.preprocess(blankToUndefined, z.string().trim().max(40).optional()),
  pincode: z.preprocess(blankToUndefined, pincodeSchema.optional()),
  paymentMethod: z.preprocess(blankToUndefined, z.enum(['cod', 'razorpay', 'upi']).optional()),
  vehicleId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
  quoteToken: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const toInt = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};
const positiveIdOrNull = (value) => {
  const id = toInt(value);
  return id > 0 ? id : null;
};
const rupees = (amount) => formatINR(amount);

const longDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const formatDate = (iso) => {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? longDate.format(new Date(ms)) : String(iso ?? '');
};

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The PricedLine key: `${productId}:${variantId ?? 0}:${short hash of custom, or ''}`. */
export function lineKey(productId, variantId, custom) {
  const hash = isPlainObject(custom) ? createHash('sha1').update(stableStringify(custom)).digest('hex').slice(0, 10) : '';
  return `${productId}:${variantId ?? 0}:${hash}`;
}

// Show plates: decorative text only, and the buyer must have ticked the acknowledgement.
const PLATE_TEXT = /^[A-Z0-9 -]{1,12}$/;

/** null when a show-plate design is acceptable, else the reason in plain words. */
export function showPlateProblem(custom, productName) {
  if (!isPlainObject(custom)) return `Design your ${productName} before checkout.`;
  const text = typeof custom.text === 'string' ? custom.text.trim() : '';
  if (!PLATE_TEXT.test(text) || !/[A-Z0-9]/.test(text)) {
    return `The text on ${productName} must be 1 to 12 capital letters, numbers, spaces or hyphens.`;
  }
  if (custom.acknowledged !== true) return `Tick the show plate acknowledgement for ${productName} before checkout.`;
  return null;
}

// Subcategories where two different products in one cart almost always means one too many.
const SAME_JOB = {
  'alloy-wheels': 'one set of wheels',
  'head-units': 'one head unit',
  headlights: 'one pair of headlights',
  'tail-lights': 'one pair of tail lights',
  'seat-covers': 'one set of seat covers',
  'floor-mats': 'one set of floor mats',
};

const PAYMENT_LABELS = {
  upi: 'UPI',
  razorpay: 'Card, netbanking or wallet',
  cod: 'Cash on delivery',
};

// ---------------------------------------------------------------------------
// Pieces of the engine
// ---------------------------------------------------------------------------

function loadQuote(ctx, token, messages) {
  const row = ctx.db.get('SELECT * FROM quotes WHERE token = ?', [token]);
  if (!row) {
    messages.push('That quote link is not valid. Message us for a fresh one.');
    return { row: null, problem: true };
  }
  let problem = null;
  if (row.status === 'ordered') problem = 'This quote has already been ordered.';
  else if (row.status === 'cancelled') problem = 'This quote was withdrawn. Message us for a fresh one.';
  else if (Date.parse(row.valid_until) <= Date.parse(ctx.now())) {
    problem = `This quote expired on ${formatDate(row.valid_until)}. Message us for a fresh one.`;
  }
  if (problem) messages.push(problem);
  return { row, problem: Boolean(problem) };
}

// Same product, variant and design twice: one line with the quantities added.
function mergeInputs(inputs) {
  const merged = new Map();
  for (const input of inputs) {
    const productId = positiveIdOrNull(input?.productId);
    if (!productId) continue;
    const variantId = positiveIdOrNull(input.variantId);
    const custom = isPlainObject(input.custom) ? input.custom : null;
    const qty = Math.max(1, toInt(input.qty) || 1);
    const key = lineKey(productId, variantId, custom);
    const fitAtStudio = input.fitAtStudio === true;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += qty;
      // The same part twice is one line: fitted at the studio if either asked for it.
      existing.fitAtStudio ||= fitAtStudio;
    } else merged.set(key, { key, productId, variantId, custom, qty, unitPrice: input.unitPrice, fitAtStudio });
  }
  return [...merged.values()];
}

function loadVariants(ctx, ids) {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const rows = ctx.db.all('SELECT * FROM product_variants WHERE id IN (SELECT value FROM json_each(?))', [wanted]);
  return new Map(rows.map((row) => [row.id, row]));
}

function couponFor(ctx, code, subtotal, now) {
  const row = ctx.db.get('SELECT * FROM coupons WHERE code = ?', [code]);
  if (!row) return { error: `We do not recognise the code ${code.toUpperCase()}.` };
  const label = row.code;
  if (!row.is_active) return { error: `The code ${label} is no longer active.` };
  if (row.starts_at && Date.parse(row.starts_at) > Date.parse(now)) {
    return { error: `The code ${label} starts on ${formatDate(row.starts_at)}.` };
  }
  if (row.ends_at && Date.parse(row.ends_at) <= Date.parse(now)) {
    return { error: `The code ${label} ended on ${formatDate(row.ends_at)}.` };
  }
  if (row.usage_limit !== null && row.usage_limit !== undefined && toInt(row.used_count) >= toInt(row.usage_limit)) {
    return { error: `The code ${label} has been fully used.` };
  }
  if (subtotal <= 0) return { error: `Add a part to use ${label}.` };
  const minOrder = toInt(row.min_order);
  if (subtotal < minOrder) {
    return { error: `${label} needs an order of ${rupees(minOrder)}. Add ${rupees(minOrder - subtotal)} more to use it.` };
  }

  let discount = 0;
  let freeShipping = false;
  const value = Math.max(0, toInt(row.value));
  if (row.type === 'percent') {
    discount = Math.round((subtotal * Math.min(100, value)) / 100);
    if (row.max_discount !== null && row.max_discount !== undefined) discount = Math.min(discount, Math.max(0, toInt(row.max_discount)));
  } else if (row.type === 'flat') {
    discount = value;
  } else if (row.type === 'free_shipping') {
    freeShipping = true;
  }
  discount = Math.min(discount, subtotal);
  return { row, discount, freeShipping, coupon: { code: label, description: String(row.description ?? ''), discount } };
}

// Paying at the studio when the car or the parts are collected: no courier, so no COD fee, no advance
// and none of the courier limits. Only made-to-order parts still have to be paid for online.
function studioPayProblem({ rows }) {
  const custom = rows.find((row) => row.included && row.product.custom_kind);
  if (custom) return `${custom.line.name} is made to order, so it has to be paid for online.`;
  return null;
}

function codProblem(settings, { rows, total, estimate }) {
  const { cod } = settings;
  if (!cod.enabled) return 'Cash on delivery is switched off for now.';
  const included = rows.filter((row) => row.included).map((row) => ({ line: row.line, row }));
  const custom = included.find(({ row }) => row.product.custom_kind);
  if (custom) return `${custom.line.name} is made to order, so it has to be paid for online.`;
  const freight = included.find(({ line }) => line.shipClass === 'freight');
  if (freight) return `${freight.line.name} ships by freight, so it has to be paid for online.`;
  const notEligible = included.find(({ line }) => !line.codEligible);
  if (notEligible) return `${notEligible.line.name} cannot be paid for on delivery.`;
  if (total < toInt(cod.minOrder)) return `Cash on delivery starts at orders of ${rupees(cod.minOrder)}.`;
  if (toInt(cod.maxOrder) > 0 && total > toInt(cod.maxOrder)) return `Cash on delivery is for orders up to ${rupees(cod.maxOrder)}.`;
  if (estimate && !estimate.codAvailable) return 'Cash on delivery does not reach this PIN code.';
  return null;
}

function paymentOptionsFor(settings, { goods, fittingTotal = 0, shippingFee, prepaidAllowed, codContext, atStudio = false }) {
  // The prepaid discount is on the parts only; fitting charges and delivery are never discounted.
  const base = goods + fittingTotal + shippingFee;
  const prepaidDiscount = prepaidAllowed ? Math.max(0, Math.round((goods * (Number(settings.prepaidDiscountPercent) || 0)) / 100)) : 0;
  const onlineTotal = Math.max(0, base - prepaidDiscount);

  const online = (method, enabled, reason, how) => {
    const note = enabled
      ? `Pay ${rupees(onlineTotal)} now ${how}.${prepaidDiscount > 0 ? ` ${rupees(prepaidDiscount)} off for paying in advance.` : ''}`
      : reason;
    return {
      method,
      label: PAYMENT_LABELS[method],
      note,
      available: enabled,
      reason: enabled ? null : reason,
      total: onlineTotal,
      payNow: onlineTotal,
      dueOnDelivery: 0,
      saving: 0,
      prepaidDiscount,
      codFee: 0,
    };
  };

  // Nothing to deliver, nothing to charge for collecting. Paid at the studio: no courier, no fee, no advance.
  const codFee = codContext.empty || atStudio ? 0 : Math.max(0, toInt(settings.cod.fee));
  const codTotal = base + codFee;
  const advancePercent = atStudio ? 0 : Math.max(0, toInt(settings.cod.advancePercent));
  const codPayNow = advancePercent > 0 ? Math.ceil((codTotal * advancePercent) / 100) : 0;
  const codDue = codTotal - codPayNow;
  const codReason = atStudio ? studioPayProblem(codContext) : codProblem(settings, { ...codContext, total: codTotal });
  const feeText = codFee > 0 ? ` Includes the ${rupees(codFee)} COD fee.` : '';
  const codNote = codReason
    ? codReason
    : atStudio
      ? `Pay ${rupees(codTotal)} in cash or UPI at the studio.`
      : codPayNow > 0
        ? `Pay ${rupees(codPayNow)} now, ${rupees(codDue)} to the courier.${feeText}`
        : `Pay ${rupees(codTotal)} in cash or UPI to the courier.${feeText}`;
  const codLabel = atStudio ? 'Pay at the studio' : codPayNow > 0 ? 'Cash on delivery with a small advance' : PAYMENT_LABELS.cod;

  const options = [
    online('upi', Boolean(settings.payments.upi), 'UPI payments are not set up yet.', 'from any UPI app'),
    online('razorpay', Boolean(settings.payments.razorpay), 'Card and netbanking payments are not set up yet.', 'by card, netbanking or wallet'),
    {
      method: 'cod',
      label: codLabel,
      note: codNote,
      available: !codReason,
      reason: codReason,
      total: codTotal,
      payNow: codPayNow,
      dueOnDelivery: codDue,
      saving: 0,
      prepaidDiscount: 0,
      codFee,
    },
  ];
  const available = options.filter((option) => option.available);
  const dearest = available.reduce((max, option) => Math.max(max, option.total), 0);
  for (const option of available) option.saving = dearest - option.total;
  return { options, onlineFallback: { total: base, payNow: base, dueOnDelivery: 0, prepaidDiscount: 0, codFee: 0 } };
}

function chooseMethod(options, requested, messages) {
  const byMethod = new Map(options.map((option) => [option.method, option]));
  if (requested) {
    const wanted = byMethod.get(requested);
    if (wanted?.available) return wanted;
    if (wanted) messages.push(`${wanted.label} is not available for this cart: ${wanted.reason}`);
  }
  const online = options.filter((option) => option.method !== 'cod' && option.available);
  if (online.length > 0) return online.reduce((best, option) => (option.total < best.total ? option : best));
  return byMethod.get('cod')?.available ? byMethod.get('cod') : null;
}

function buildAdvice(ctx, { lines, rows, vehicle }) {
  const problems = [];
  const warnings = [];
  const tips = [];
  const good = [];
  const carName = vehicle ? String(vehicle.model || 'car') : '';

  // Every line whose product is still sold, including out-of-stock ones: a part that does not fit is worth saying either way.
  const live = lines.map((line, index) => ({ line, row: rows[index].product })).filter(({ row }) => row.is_active);
  const cartIds = new Set(lines.map((line) => line.productId));

  // Fit, line by line.
  if (vehicle) {
    for (const { line, row } of live) {
      if (line.fit === 'no') {
        problems.push({
          severity: 'problem',
          code: 'does_not_fit',
          message: `${line.name} does not fit your ${carName}.${line.fitNote ? ` ${line.fitNote}` : ''} Take it out unless it is for another car.`,
          productIds: [line.productId],
          action: { type: 'remove', productId: line.productId, label: 'Remove it' },
        });
      } else if (line.fit === 'with_work') {
        warnings.push({
          severity: 'warning',
          code: 'needs_work',
          message: `${line.name} fits your ${carName}, but not straight out of the box.${line.fitNote ? ` ${line.fitNote}` : ''} Budget for the work.`,
          productIds: [line.productId],
          action: null,
        });
      } else if (line.fit === 'unknown' && ['vehicle', 'pcd'].includes(row.fitment_type)) {
        warnings.push({
          severity: 'warning',
          code: 'fit_unchecked',
          message: `We have not checked ${line.name} on your ${carName} yet. Ask us before you order it.`,
          productIds: [line.productId],
          action: null,
        });
      }
    }
  }

  // Two parts that do the same job.
  const bySubcategory = new Map();
  for (const { line, row } of live) {
    if (!SAME_JOB[row.category_slug]) continue;
    const group = bySubcategory.get(row.category_slug) ?? [];
    if (!group.some((entry) => entry.productId === line.productId)) group.push(line);
    bySubcategory.set(row.category_slug, group);
  }
  for (const [slug, group] of bySubcategory) {
    if (group.length < 2) continue;
    warnings.push({
      severity: 'warning',
      code: 'duplicate_purpose',
      message: `${group.map((line) => line.name).join(' and ')} do the same job. A car only needs ${SAME_JOB[slug]}: keep the one you want.`,
      productIds: group.map((line) => line.productId),
      action: null,
    });
  }

  // Road rules.
  const seenLegality = new Set();
  for (const { line, row } of live) {
    if (seenLegality.has(line.productId)) continue;
    seenLegality.add(line.productId);
    const note = String(row.legality_note ?? '').trim();
    if (row.legality === 'off_road_only') {
      warnings.push({
        severity: 'warning',
        code: 'off_road_only',
        message: `${line.name} is for off-road, track or show use only, not for public roads.${note ? ` ${note}` : ''}`,
        productIds: [line.productId],
        action: null,
      });
    } else if (row.legality === 'check_rules') {
      warnings.push({
        severity: 'warning',
        code: 'check_rules',
        message: `Check your State's rules before you use ${line.name} on the road.${note ? ` ${note}` : ''}`,
        productIds: [line.productId],
        action: null,
      });
    }
  }

  // What else the cart needs, and what goes well with it: one query for the relations, one for the parts.
  const liveIds = [...new Set(live.map(({ line }) => line.productId))];
  if (liveIds.length > 0) {
    const relations = ctx.db.all(
      `SELECT product_id, related_id, kind, note FROM product_relations
       WHERE product_id IN (SELECT value FROM json_each(?)) ORDER BY kind DESC, product_id, related_id`,
      [liveIds],
    );
    const wanted = relations.filter((relation) => !cartIds.has(relation.related_id));
    const related = getProductRowsByIds(
      ctx,
      wanted.map((relation) => relation.related_id),
    );
    const order = new Map(liveIds.map((id, index) => [id, index]));
    wanted.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'requires' ? -1 : 1) || order.get(a.product_id) - order.get(b.product_id));
    const nameOf = new Map(live.map(({ line }) => [line.productId, line.name]));
    const suggested = new Set();
    let pairs = 0;
    for (const relation of wanted) {
      const part = related.get(relation.related_id);
      if (!part || !part.is_active || suggested.has(part.id)) continue;
      const inStock = toInt(part.stock) > 0;
      const note = String(relation.note ?? '').trim();
      if (relation.kind === 'requires') {
        suggested.add(part.id);
        tips.push({
          severity: 'tip',
          code: 'missing_required',
          message: `${nameOf.get(relation.product_id)} needs ${part.name}, and it is not in your cart.${note ? ` ${note}` : ''}${inStock ? '' : ' It is out of stock right now.'}`,
          productIds: [relation.product_id],
          action: inStock ? { type: 'add', productId: part.id, label: `Add ${part.name}` } : null,
        });
      } else if (relation.kind === 'pairs_with' && pairs < 2 && inStock) {
        suggested.add(part.id);
        pairs += 1;
        tips.push({
          severity: 'tip',
          code: 'pairs_with',
          message: `${part.name} goes well with ${nameOf.get(relation.product_id)}.${note ? ` ${note}` : ''}`,
          productIds: [relation.product_id],
          action: { type: 'add', productId: part.id, label: `Add ${part.name}` },
        });
      }
    }
  }

  // A fitter is advised: our studio when it fits this part, else the fitting card for a mechanic.
  const seenInstall = new Set();
  for (const { line, row } of live) {
    if (!row.pro_install || seenInstall.has(line.productId) || line.fitAtStudio) continue;
    seenInstall.add(line.productId);
    const service = line.fittingService;
    const charge = service ? (service.charge > 0 ? `${rupees(service.charge)} each` : 'at no extra charge') : '';
    tips.push({
      severity: 'tip',
      code: 'pro_install',
      message: service
        ? `${line.name} is a job for a fitter. Choose fitting at our studio (${service.name}, ${charge}), or print the fitting card at /fitting/${line.slug} for your mechanic.`
        : `${line.name} is a job for a fitter. Print the fitting card at /fitting/${line.slug} and take it to your mechanic.`,
      productIds: [line.productId],
      action: null,
    });
  }

  if (vehicle && live.length > 0 && live.every(({ line }) => line.fit === 'direct' || line.fit === 'universal')) {
    good.push({
      severity: 'good',
      code: 'fits_all',
      message: `Everything here fits your ${carName}.`,
      productIds: liveIds,
      action: null,
    });
  }

  return [...problems, ...warnings, ...tips, ...good];
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

/**
 * Prices a cart. `request` is a PriceCartRequest (validate it with priceCartRequestSchema first when
 * it comes from a browser). Returns { cart, rows, paymentMethod, quoteRow }; see the file header.
 */
export function priceCartDetailed(ctx, request = {}, { user = null } = {}) {
  void user;
  const settings = ctx.settings.get();
  const now = ctx.now();
  const messages = [];

  // 1. Where the lines come from: the browser, or a quote.
  let quoteRow = null;
  let quoteProblem = false;
  let inputs;
  if (request.quoteToken) {
    const quote = loadQuote(ctx, String(request.quoteToken), messages);
    quoteRow = quote.row;
    quoteProblem = quote.problem;
    inputs = quoteRow ? quoteItems(quoteRow).map((item) => ({ ...item, custom: null })) : [];
  } else {
    inputs = Array.isArray(request.items)
      ? request.items.map(({ productId, variantId, qty, custom, fitAtStudio }) => ({ productId, variantId, qty, custom, fitAtStudio }))
      : [];
  }
  const merged = mergeInputs(inputs);
  const studioOn = Boolean(settings.studio?.enabled);
  let fittingRefused = false;

  // 2. Catalogue rows: one query for products, one for variants, one for fit verdicts.
  const products = getProductRowsByIds(
    ctx,
    merged.map((input) => input.productId),
  );
  const variants = loadVariants(
    ctx,
    merged.map((input) => input.variantId),
  );
  const vehicle = getVehicleRow(ctx, request.vehicleId);
  const productRows = [...products.values()];
  const verdicts = fitVerdictsFor(ctx, productRows, vehicle);

  let missing = 0;
  const lines = [];
  const rows = [];
  for (const input of merged) {
    const product = products.get(input.productId);
    if (!product) {
      missing += 1;
      continue;
    }
    const name = String(product.name);
    let issue = null;
    let variant = null;
    let problem = null;

    const hasVariants = Boolean(product.has_variants);
    if (input.variantId) {
      const candidate = variants.get(input.variantId);
      if (candidate && candidate.product_id === product.id && candidate.is_active) variant = candidate;
      else problem = `That option of ${name} is no longer sold. Choose another.`;
    } else if (hasVariants) {
      problem = `Choose a size or finish for ${name}.`;
    }
    if (!product.is_active) problem = `${name} is no longer sold. Remove it to check out.`;

    const isCustom = Boolean(product.custom_kind);
    const custom = isCustom && isPlainObject(input.custom) ? input.custom : null;
    if (!problem && product.custom_kind === 'show-plate') problem = showPlateProblem(custom, name);

    const stock = Math.max(0, toInt(variant ? variant.stock : product.stock));
    const dropPercent = toInt(product.drop_percent);
    const catalogPrice = variant ? applyDrop(toInt(variant.price), dropPercent) : toInt(product.sale_price ?? product.price);
    const unitPrice = quoteRow ? Math.max(0, toInt(input.unitPrice)) : catalogPrice;
    const unitMrp = toInt(variant ? variant.mrp : product.mrp);

    let qty = input.qty;
    if (problem) {
      issue = 'unavailable';
      messages.push(problem);
    } else if (stock <= 0) {
      issue = 'out_of_stock';
      qty = 0;
      messages.push(`${name}${variant ? ` (${variant.name})` : ''} is out of stock, so it is not counted in your total.`);
    } else if (qty > stock) {
      issue = 'insufficient_stock';
      qty = stock;
      messages.push(`Only ${stock} left of ${name}${variant ? ` (${variant.name})` : ''}: quantity updated.`);
    }
    const included = issue === null || issue === 'insufficient_stock';
    const verdict = verdicts.get(product.id) ?? { fit: null, fitNote: '' };

    // Studio fitting: only for parts a service fits, and only while the studio takes bookings.
    const service = studioOn ? serviceForProduct(ctx, product, settings.services) : null;
    const fitAtStudio = Boolean(input.fitAtStudio && service);
    if (input.fitAtStudio && !service) {
      if (!studioOn) fittingRefused = true;
      else messages.push(`We do not fit ${name} at the studio, so it is priced without fitting.`);
    }
    const fittingCharge = fitAtStudio && included ? service.charge * qty : 0;

    const line = {
      key: lineKey(product.id, variant ? variant.id : input.variantId, custom),
      productId: product.id,
      variantId: variant ? variant.id : input.variantId,
      slug: String(product.slug),
      name,
      variantName: variant ? String(variant.name) : '',
      image: stringList(product.images)[0] ?? null,
      artKind: String(product.resolved_art_kind ?? product.art_kind ?? '') || 'generic',
      unitPrice,
      unitMrp,
      qty,
      lineTotal: included ? unitPrice * qty : 0,
      maxQty: stock,
      issue,
      fit: verdict.fit ?? null,
      fitNote: String(verdict.fitNote ?? ''),
      legality: String(product.legality || 'road_legal'),
      shipClass: String(product.ship_class || 'small'),
      codEligible: Boolean(product.cod_eligible),
      custom,
      fittingService: service ? { id: service.id, name: service.name, charge: service.charge, minutes: service.minutes } : null,
      fitAtStudio,
      fittingCharge,
      fittingServiceName: fitAtStudio ? service.name : '',
    };
    lines.push(line);
    rows.push({ line, product, variant, included });
  }
  if (missing > 0) {
    messages.unshift(missing === 1 ? 'A part in your cart is no longer listed and has been taken out.' : `${missing} parts in your cart are no longer listed and have been taken out.`);
  }

  // 3. Totals of the lines that can be bought.
  const includedRows = rows.filter((row) => row.included);
  const itemCount = includedRows.reduce((sum, row) => sum + row.line.qty, 0);
  const subtotal = includedRows.reduce((sum, row) => sum + row.line.lineTotal, 0);
  const mrpTotal = includedRows.reduce((sum, row) => sum + row.line.unitMrp * row.line.qty, 0);

  // 4. Coupon (never on quoted prices).
  let coupon = null;
  let couponError = null;
  let discount = 0;
  let freeShippingCoupon = false;
  const code = typeof request.couponCode === 'string' ? request.couponCode.trim() : '';
  if (code) {
    if (request.quoteToken) {
      couponError = 'Coupons do not apply to quoted prices.';
    } else {
      const result = couponFor(ctx, code, subtotal, now);
      if (result.error) couponError = result.error;
      else {
        coupon = result.coupon;
        discount = result.discount;
        freeShippingCoupon = result.freeShipping;
      }
    }
  }
  const goods = subtotal - discount;
  const fittingTotal = includedRows.reduce((sum, row) => sum + row.line.fittingCharge, 0);

  // 5. How the order reaches the customer. Any part fitted at the studio makes it a studio order;
  // 'studio' with nothing to fit is a pickup. Pickup and studio need the studio to be open.
  let fulfilment = FULFILMENTS.includes(request.fulfilment) ? request.fulfilment : 'delivery';
  if (lines.some((line) => line.fitAtStudio)) fulfilment = 'studio';
  else if (fulfilment === 'studio') {
    fulfilment = 'pickup';
    if (studioOn) messages.push('Nothing in the cart is marked for fitting at the studio, so this is a pickup from the studio.');
  }
  if (fulfilment !== 'delivery' && !studioOn) {
    fulfilment = 'delivery';
    fittingRefused = true;
  }
  if (fittingRefused) messages.push('Collection and fitting at the studio are paused right now, so this cart is priced for delivery.');
  const atStudio = fulfilment !== 'delivery';

  // 6. Delivery.
  const { shipping } = settings;
  const threshold = Math.max(0, toInt(shipping.freeShippingThreshold));
  let shippingFee = 0;
  let amountToFreeShipping = 0;
  if (includedRows.length > 0 && !atStudio) {
    if (quoteRow && quoteRow.shipping_fee !== null && quoteRow.shipping_fee !== undefined) {
      shippingFee = Math.max(0, toInt(quoteRow.shipping_fee));
    } else {
      const free = freeShippingCoupon || goods >= threshold;
      if (!free) {
        shippingFee = Math.max(0, toInt(shipping.flatFee));
        amountToFreeShipping = threshold - goods;
      }
      if (includedRows.some((row) => row.line.shipClass === 'bulky')) shippingFee += Math.max(0, toInt(shipping.bulkySurcharge));
      if (includedRows.some((row) => row.line.shipClass === 'freight')) shippingFee += Math.max(0, toInt(shipping.freightSurcharge));
    }
  }

  // 7. Payment options, each fully priced. A PIN code only matters for delivery.
  const estimate = !atStudio && request.pincode && isValidPincode(request.pincode) ? estimateShipping(ctx, request.pincode) : null;
  const { options, onlineFallback } = paymentOptionsFor(settings, {
    goods,
    fittingTotal,
    shippingFee,
    prepaidAllowed: !quoteRow,
    codContext: { rows, estimate, empty: includedRows.length === 0 },
    atStudio,
  });
  const chosen = chooseMethod(options, request.paymentMethod, messages);
  const priced = chosen ?? onlineFallback;

  // 8. Tax inside the final amounts. Collected at the studio, the place of supply is the store's State.
  const taxLines = orderTaxLines(
    { total: priced.total, shipping_fee: shippingFee, cod_fee: priced.codFee, fitting_total: fittingTotal },
    includedRows.map((row) => ({ price: row.line.unitPrice, qty: row.line.qty, gst_rate: row.product.gst_rate })),
  );
  const tax = taxBreakdown(taxLines, { storeState: settings.address?.state ?? '', shipState: estimate?.state ?? '' });

  // 9. The Sanity Check.
  const advice = buildAdvice(ctx, { lines, rows, vehicle });

  const canCheckout = includedRows.length > 0 && lines.every((line) => line.issue === null) && !quoteProblem;

  const cart = {
    lines,
    itemCount,
    subtotal,
    mrpTotal,
    savings: Math.max(0, mrpTotal - subtotal),
    coupon,
    couponError,
    discount,
    prepaidDiscount: priced.prepaidDiscount,
    shippingFee,
    codFee: priced.codFee,
    total: priced.total,
    payNow: priced.payNow,
    dueOnDelivery: priced.dueOnDelivery,
    freeShippingThreshold: threshold,
    amountToFreeShipping: Math.max(0, amountToFreeShipping),
    tax,
    fulfilment,
    fittingTotal,
    needsSlot: fulfilment === 'studio',
    paymentOptions: options.map(({ prepaidDiscount, codFee, ...option }) => option),
    advice,
    quote: quoteRow
      ? {
          token: String(quoteRow.token),
          customerName: String(quoteRow.customer_name ?? ''),
          validUntil: String(quoteRow.valid_until),
          note: String(quoteRow.note ?? ''),
        }
      : null,
    canCheckout,
    messages,
  };

  return {
    cart,
    rows: rows.map(({ line, product, variant }) => ({ line, product, variant })),
    paymentMethod: chosen ? chosen.method : null,
    quoteRow,
  };
}

/** PricedCart for a PriceCartRequest. See priceCartDetailed(). */
export function priceCart(ctx, request = {}, options = {}) {
  return priceCartDetailed(ctx, request, options).cart;
}
