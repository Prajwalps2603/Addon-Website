/**
 * Database rows to the JSON shapes of client/src/types/api.ts. One pure function per shape.
 *
 * Rows are snake_case, JSON columns arrive as TEXT and booleans as 0/1. Every mapper returns
 * exactly the keys of its interface, so anything the type does not name (cost price, supplier,
 * password hash, payment gateway ids, tokens) never leaves the server by accident.
 * JSON columns are parsed defensively: bad JSON becomes an empty value, never a throw.
 *
 * Product rows must come from the helpers in catalog.js (the v_products view plus `has_variants`).
 */
import { applyDrop, percentOff, taxBreakdown } from './money.js';

const BODY_TYPES = new Set(['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe']);
const KIT_GOALS = new Set(['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection']);
const CANCELLABLE_STATUSES = new Set(['pending_payment', 'placed', 'confirmed']);
// Delivery and COD charges are taxed at the rate of the goods they travel with (the highest one in a mixed order).
const DEFAULT_GST_RATE = 18;

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const text = (value) => (value === null || value === undefined ? '' : String(value));
const textOrNull = (value) => (text(value) === '' ? null : text(value));
const scalarText = (value) => (['string', 'number', 'boolean'].includes(typeof value) ? String(value) : '');

function int(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}
const intOrNull = (value) => (value === null || value === undefined || value === '' ? null : int(value));
const flag = (value) => value === true || (Number(value) || 0) !== 0;

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** A JSON column that should hold an array: the array, or [] when it is missing, malformed or something else. */
export function jsonArray(value) {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? parsed : [];
}

/** A JSON column that should hold an object: the object, or {} when it is missing, malformed or something else. */
export function jsonObject(value) {
  const parsed = parseJson(value);
  return isPlainObject(parsed) ? parsed : {};
}

/** A JSON string[] column. Entries that are not text are dropped. */
export function stringList(value) {
  return jsonArray(value)
    .filter((entry) => typeof entry === 'string' || typeof entry === 'number')
    .map((entry) => String(entry).trim())
    .filter((entry) => entry !== '');
}

/** A JSON number[] column of row ids (builds.product_ids, saved_kits.product_ids): positive whole numbers, no repeats. */
export function idList(value) {
  const ids = jsonArray(value)
    .map((entry) => (typeof entry === 'number' || typeof entry === 'string' ? Number(entry) : Number.NaN))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)];
}

function specRows(value) {
  return jsonArray(value)
    .filter(isPlainObject)
    .map((entry) => ({ label: scalarText(entry.label).trim(), value: scalarText(entry.value).trim() }))
    .filter((row) => row.label !== '');
}

function fittingSteps(value) {
  return jsonArray(value)
    .map((entry) => {
      if (typeof entry === 'string') return { en: entry.trim(), hi: '' };
      if (!isPlainObject(entry)) return { en: '', hi: '' };
      return { en: scalarText(entry.en).trim(), hi: scalarText(entry.hi).trim() };
    })
    .filter((step) => step.en !== '' || step.hi !== '');
}

function stringRecord(value) {
  const record = {};
  for (const [key, entry] of Object.entries(jsonObject(value))) {
    if (scalarText(entry) !== '') record[key] = scalarText(entry);
  }
  return record;
}

function customDesign(value) {
  const parsed = parseJson(value);
  return isPlainObject(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** users row to User. Works on req.user too. */
export function toUser(row) {
  return {
    id: int(row.id),
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    role: row.role === 'admin' ? 'admin' : 'customer',
    createdAt: text(row.created_at),
  };
}

/** users row with `order_count`, `total_spent` and `last_order_at` columns to AdminCustomer. */
export function toAdminCustomer(row) {
  return {
    ...toUser(row),
    orderCount: int(row.order_count),
    totalSpent: int(row.total_spent),
    lastOrderAt: textOrNull(row.last_order_at),
  };
}

/** addresses row to Address. */
export function toAddress(row) {
  return {
    id: int(row.id),
    label: text(row.label),
    name: text(row.name),
    phone: text(row.phone),
    line1: text(row.line1),
    line2: text(row.line2),
    landmark: text(row.landmark),
    city: text(row.city),
    state: text(row.state),
    pincode: text(row.pincode),
    isDefault: flag(row.is_default),
  };
}

// ---------------------------------------------------------------------------
// Categories and vehicles
// ---------------------------------------------------------------------------

/**
 * categories row to Category. `productCount` (or a `product_count` column) and `children`
 * (already mapped) come from the caller: see categoryTree() in catalog.js.
 */
export function toCategory(row, { productCount, children = [] } = {}) {
  return {
    id: int(row.id),
    slug: text(row.slug),
    name: text(row.name),
    blurb: text(row.blurb),
    artKind: text(row.art_kind) || 'generic',
    image: text(row.image),
    parentId: intOrNull(row.parent_id),
    sortOrder: int(row.sort_order),
    isActive: flag(row.is_active),
    productCount: int(productCount ?? row.product_count),
    children,
  };
}

/** 'Maruti Suzuki Swift (2018-2024)', or '(2024 onwards)' while the generation is still on sale. */
export function vehicleLabel(row) {
  const from = int(row.year_from);
  const to = intOrNull(row.year_to);
  let years = `${from}-${to}`;
  if (to === null) years = `${from} onwards`;
  else if (to === from) years = String(from);
  return `${text(row.make)} ${text(row.model)} (${years})`;
}

/** vehicles row to Vehicle, with the printable label. */
export function toVehicle(row) {
  return {
    id: int(row.id),
    make: text(row.make),
    makeSlug: text(row.make_slug),
    model: text(row.model),
    modelSlug: text(row.model_slug),
    generation: text(row.generation),
    bodyType: text(row.body_type),
    yearFrom: int(row.year_from),
    yearTo: intOrNull(row.year_to),
    pcd: text(row.pcd),
    isPopular: flag(row.is_popular),
    label: vehicleLabel(row),
  };
}

/**
 * user_vehicles row joined with its vehicle to GarageEntry. Select the vehicle's columns beside
 * `vehicle_id`, `year`, `nickname` and the garage row's `is_active`:
 *   SELECT uv.vehicle_id, uv.year, uv.nickname, uv.is_active, v.* FROM user_vehicles uv JOIN vehicles v ON v.id = uv.vehicle_id
 */
export function toGarageEntry(row) {
  return {
    vehicleId: int(row.vehicle_id),
    year: intOrNull(row.year),
    nickname: text(row.nickname),
    isActive: flag(row.is_active),
    vehicle: toVehicle({ ...row, id: row.vehicle_id }),
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function installDifficulty(value) {
  return Math.min(5, Math.max(1, int(value) || 1));
}

/**
 * v_products row to ProductSummary.
 * `fit` is the verdict from fitVerdict() / fitVerdictsFor() in catalog.js; leave it out when no car was named.
 * price is the view's sale_price (after any live drop), regularPrice is the price column.
 */
export function toProductSummary(row, fit) {
  const regularPrice = int(row.price);
  const price = row.sale_price === undefined || row.sale_price === null ? regularPrice : int(row.sale_price);
  const mrp = int(row.mrp);
  const stock = Math.max(0, int(row.stock));
  const dropPercent = int(row.drop_percent);
  return {
    id: int(row.id),
    slug: text(row.slug),
    name: text(row.name),
    brand: text(row.brand),
    categoryId: int(row.category_id),
    categorySlug: text(row.category_slug),
    categoryName: text(row.category_name),
    parentCategorySlug: text(row.parent_category_slug),
    parentCategoryName: text(row.parent_category_name),
    shortDescription: text(row.short_description),
    price,
    regularPrice,
    mrp,
    discountPercent: percentOff(price, mrp),
    drop: dropPercent > 0 ? { percentOff: dropPercent, reason: text(row.drop_reason), endsAt: text(row.drop_ends_at) } : null,
    stock,
    inStock: stock > 0,
    lowStock: stock > 0 && stock <= int(row.low_stock_threshold),
    image: stringList(row.images)[0] ?? null,
    artKind: text(row.resolved_art_kind ?? row.art_kind) || 'generic',
    ratingAvg: Math.round((Number(row.rating_avg) || 0) * 10) / 10,
    ratingCount: int(row.rating_count),
    isNew: flag(row.is_new),
    isFeatured: flag(row.is_featured),
    hasVariants: flag(row.has_variants),
    fitmentType: text(row.fitment_type) || 'universal',
    fit: fit?.fit ?? null,
    fitNote: text(fit?.fitNote),
    fitVerified: Boolean(fit?.fitVerified),
    legality: text(row.legality) || 'road_legal',
    warrantyImpact: text(row.warranty_impact) || 'none',
    installDifficulty: installDifficulty(row.install_difficulty),
    proInstall: flag(row.pro_install),
    shipClass: text(row.ship_class) || 'small',
    codEligible: flag(row.cod_eligible),
    tags: stringList(row.tags),
    customKind: textOrNull(row.custom_kind),
    buildSlot: textOrNull(row.build_slot),
    buildStyle: textOrNull(row.build_style),
    finishColor: text(row.finish_color),
  };
}

/** product_variants row to ProductVariant. `dropPercent` is the product row's drop_percent (0 when no drop is live). */
export function toVariant(row, dropPercent = 0) {
  const regularPrice = int(row.price);
  const stock = Math.max(0, int(row.stock));
  return {
    id: int(row.id),
    name: text(row.name),
    sku: text(row.sku),
    price: applyDrop(regularPrice, int(dropPercent)),
    regularPrice,
    mrp: int(row.mrp),
    stock,
    inStock: stock > 0,
    attributes: stringRecord(row.attributes),
  };
}

/**
 * product_fitments row joined with its vehicle to ProductFitment. Select the vehicle's columns beside the fitment's:
 *   SELECT pf.vehicle_id, pf.fit_type, pf.note, pf.is_verified, v.* FROM product_fitments pf JOIN vehicles v ON v.id = pf.vehicle_id
 */
export function toFitment(row) {
  return {
    vehicle: toVehicle({ ...row, id: row.vehicle_id ?? row.id }),
    fitType: text(row.fit_type) || 'direct',
    note: text(row.note),
    isVerified: flag(row.is_verified),
  };
}

/** The Straight Label columns of a product row to StraightLabel. */
export function toStraightLabel(row) {
  return {
    legality: text(row.legality) || 'road_legal',
    legalityNote: text(row.legality_note),
    warrantyImpact: text(row.warranty_impact) || 'none',
    warrantyNote: text(row.warranty_note),
    wiring: text(row.wiring) || 'none',
    reversible: flag(row.reversible),
    skipIf: text(row.skip_if),
    installDifficulty: installDifficulty(row.install_difficulty),
    installTimeMin: int(row.install_time_min),
    installTimeMax: int(row.install_time_max),
    proInstall: flag(row.pro_install),
    fittingCostMin: int(row.fitting_cost_min),
    fittingCostMax: int(row.fitting_cost_max),
  };
}

/** product_relations row plus the related product (already a ProductSummary) to RelatedProduct. */
export function toRelation(row, product) {
  return { kind: row.kind === 'requires' ? 'requires' : 'pairs_with', note: text(row.note), product };
}

/** category_picks row plus its product (already a ProductSummary) to CategoryPick. */
export function toCategoryPick(row, product) {
  return { tier: text(row.tier), reason: text(row.reason), product };
}

/**
 * v_products row to ProductDetail. `parts` holds what lives in other tables, already in API shape
 * (getProductDetail() in catalog.js loads them all):
 *   { fit, variants: ProductVariant[], fitments: ProductFitment[], relations: RelatedProduct[],
 *     similar: ProductSummary[], lowest30Days: number | null, priceHistory: { date, price }[] }
 * Anything left out is empty.
 */
export function toProductDetail(row, parts = {}) {
  const variants = parts.variants ?? [];
  return {
    ...toProductSummary(row, parts.fit),
    hasVariants: parts.variants ? variants.length > 0 : flag(row.has_variants),
    sku: text(row.sku),
    description: text(row.description),
    images: stringList(row.images),
    highlights: stringList(row.highlights),
    specs: specRows(row.specs),
    boxContents: stringList(row.box_contents),
    variants,
    fitments: parts.fitments ?? [],
    bodyTypes: stringList(row.body_types).filter((bodyType) => BODY_TYPES.has(bodyType)),
    pcd: text(row.pcd),
    label: toStraightLabel(row),
    fittingTools: stringList(row.fitting_tools),
    fittingSteps: fittingSteps(row.fitting_steps),
    warrantyMonths: int(row.warranty_months),
    returnable: flag(row.returnable),
    netQuantity: text(row.net_quantity),
    manufacturer: text(row.manufacturer),
    countryOfOrigin: text(row.country_of_origin),
    hsnCode: text(row.hsn_code),
    gstRate: int(row.gst_rate),
    weightGrams: int(row.weight_grams),
    lowest30Days: parts.lowest30Days ?? null,
    priceHistory: parts.priceHistory ?? [],
    goals: stringList(row.goals).filter((goal) => KIT_GOALS.has(goal)),
    isDemo: flag(row.is_demo),
    relations: parts.relations ?? [],
    similar: parts.similar ?? [],
  };
}

/**
 * v_products row to AdminProduct: the detail plus the owner-only columns. Same `parts` as toProductDetail.
 * requiresIds and pairsWithIds are read from parts.relations, so pass every relation, inactive products included
 * (getAdminProduct() in catalog.js does).
 */
export function toAdminProduct(row, parts = {}) {
  const detail = toProductDetail(row, parts);
  const relatedIds = (kind) => detail.relations.filter((relation) => relation.kind === kind).map((relation) => relation.product.id);
  return {
    ...detail,
    costPrice: intOrNull(row.cost_price),
    supplier: text(row.supplier),
    lowStockThreshold: int(row.low_stock_threshold),
    essentialRank: int(row.essential_rank),
    isActive: flag(row.is_active),
    soldCount: int(row.sold_count),
    requiresIds: relatedIds('requires'),
    pairsWithIds: relatedIds('pairs_with'),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

function dropItems(items) {
  return items
    .filter((item) => item && item.product)
    .map((item) => ({
      product: item.product,
      percentOff: int(item.percentOff ?? item.percent_off),
      reason: text(item.reason),
    }));
}

/**
 * drops row to Drop. `items` are the drop_items rows, each with its `product` (a ProductSummary) attached:
 *   itemRows.map((item) => ({ ...item, product: productsById.get(item.product_id) }))
 * Items whose product is missing are left out.
 */
export function toDrop(row, items = []) {
  return {
    id: int(row.id),
    title: text(row.title),
    note: text(row.note),
    startsAt: text(row.starts_at),
    endsAt: text(row.ends_at),
    items: dropItems(items),
  };
}

/** drops row to AdminDrop. `now` is ctx.now(); state is 'off', 'scheduled', 'live' or 'ended'. */
export function toAdminDrop(row, items = [], now = new Date().toISOString()) {
  const isActive = flag(row.is_active);
  const at = Date.parse(now);
  let state = 'live';
  if (!isActive) state = 'off';
  else if (at < Date.parse(row.starts_at)) state = 'scheduled';
  else if (at >= Date.parse(row.ends_at)) state = 'ended';
  return { ...toDrop(row, items), isActive, state };
}

// ---------------------------------------------------------------------------
// Fitted reports and questions
// ---------------------------------------------------------------------------

/** reviews row to FittedReport. */
export function toReport(row) {
  return {
    id: int(row.id),
    productId: int(row.product_id),
    authorName: text(row.author_name),
    vehicle: text(row.vehicle),
    rating: int(row.rating),
    fittedBy: text(row.fitted_by) || 'self',
    timeMinutes: intOrNull(row.time_minutes),
    difficulty: intOrNull(row.difficulty),
    fittedOk: flag(row.fitted_ok),
    issues: text(row.issues),
    body: text(row.body),
    photos: stringList(row.photos),
    isVerifiedPurchase: flag(row.is_verified_purchase),
    isDemo: flag(row.is_demo),
    createdAt: text(row.created_at),
  };
}

/** reviews row with `product_name` and `product_slug` columns to AdminReport. */
export function toAdminReport(row) {
  return {
    ...toReport(row),
    status: text(row.status) || 'pending',
    orderNumber: text(row.order_number),
    productName: text(row.product_name),
    productSlug: text(row.product_slug),
  };
}

/** product_questions row to Question. The asker's phone number is never included. */
export function toQuestion(row) {
  return {
    id: int(row.id),
    kind: row.kind === 'fitment' ? 'fitment' : 'general',
    vehicleLabel: text(row.vehicle_label),
    authorName: text(row.author_name),
    question: text(row.question),
    answer: row.answer === null || row.answer === undefined ? null : text(row.answer),
    answerFitType: textOrNull(row.answer_fit_type),
    answeredAt: textOrNull(row.answered_at),
    isDemo: flag(row.is_demo),
    createdAt: text(row.created_at),
  };
}

/**
 * product_questions row with `product_name`, `product_slug` and `same_ask_count` columns to AdminQuestion.
 * same_ask_count is how many shoppers asked about the same product and car, this one included (1 when the column is absent).
 */
export function toAdminQuestion(row) {
  return {
    ...toQuestion(row),
    status: text(row.status) || 'pending',
    phone: text(row.phone),
    vehicleId: intOrNull(row.vehicle_id),
    productId: int(row.product_id),
    productName: text(row.product_name),
    productSlug: text(row.product_slug),
    sameAskCount: Math.max(1, int(row.same_ask_count ?? 1)),
  };
}

// ---------------------------------------------------------------------------
// Coupons, orders, quotes
// ---------------------------------------------------------------------------

/** coupons row to Coupon. */
export function toCoupon(row) {
  return {
    id: int(row.id),
    code: text(row.code),
    description: text(row.description),
    type: text(row.type),
    value: int(row.value),
    minOrder: int(row.min_order),
    maxDiscount: intOrNull(row.max_discount),
    startsAt: textOrNull(row.starts_at),
    endsAt: textOrNull(row.ends_at),
    usageLimit: intOrNull(row.usage_limit),
    usedCount: int(row.used_count),
    isActive: flag(row.is_active),
    createdAt: text(row.created_at),
  };
}

/** order_items row to OrderItem. */
export function toOrderItem(row) {
  const price = int(row.price);
  const qty = int(row.qty);
  return {
    id: int(row.id),
    productId: intOrNull(row.product_id),
    variantId: intOrNull(row.variant_id),
    slug: text(row.slug),
    name: text(row.name),
    variantName: text(row.variant_name),
    sku: text(row.sku),
    image: textOrNull(row.image),
    price,
    mrp: int(row.mrp),
    qty,
    lineTotal: price * qty,
    gstRate: int(row.gst_rate),
    hsnCode: text(row.hsn_code),
    custom: customDesign(row.custom),
    fitAtStudio: flag(row.fit_at_studio),
    fittingCharge: int(row.fitting_charge),
    fittingServiceName: text(row.fitting_service),
  };
}

/** order_events row to OrderEvent. */
export function toOrderEvent(row) {
  return {
    status: text(row.status),
    note: text(row.note),
    actor: ['customer', 'admin'].includes(row.actor) ? row.actor : 'system',
    createdAt: text(row.created_at),
  };
}

/**
 * The { amount, gstRate } lines of an order for taxBreakdown() and taxByRate() in money.js.
 * What was charged for the goods (total minus delivery and COD fee, so after every discount) is
 * spread over the items in proportion to their value, to the paisa, and the lines always add up
 * to the order total. Delivery and the COD fee are lines of their own at the highest rate among the items.
 * Studio fitting charges (fitting_total) are a service line of their own at 18%.
 * `row` needs total, shipping_fee and cod_fee (and fitting_total when there is one); `items` need
 * price, qty and gst_rate (order_items rows).
 */
export function orderTaxLines(row, items = []) {
  const shippingFee = Math.max(0, int(row.shipping_fee));
  const codFee = Math.max(0, int(row.cod_fee));
  const fittingTotal = Math.max(0, int(row.fitting_total));
  const goodsPaise = Math.max(0, int(row.total) - shippingFee - codFee - fittingTotal) * 100;
  const values = items.map((item) => Math.max(0, int(item.price) * int(item.qty)));
  const gross = values.reduce((sum, value) => sum + value, 0);
  const feeRate = items.reduce((highest, item) => Math.max(highest, int(item.gst_rate)), 0) || DEFAULT_GST_RATE;

  const lines = [];
  if (gross > 0) {
    // Rounding the running total, not each share, keeps every line at zero or more and the sum exact.
    let running = 0;
    let allotted = 0;
    items.forEach((item, index) => {
      running += values[index];
      const upTo = Math.round((goodsPaise * running) / gross);
      lines.push({ amount: (upTo - allotted) / 100, gstRate: int(item.gst_rate) });
      allotted = upTo;
    });
  } else if (goodsPaise > 0) {
    lines.push({ amount: goodsPaise / 100, gstRate: feeRate });
  }
  if (fittingTotal > 0) lines.push({ amount: fittingTotal, gstRate: FITTING_GST_RATE });
  if (shippingFee > 0) lines.push({ amount: shippingFee, gstRate: feeRate });
  if (codFee > 0) lines.push({ amount: codFee, gstRate: feeRate });
  return lines;
}

/** GST on studio fitting work (installation services). */
export const FITTING_GST_RATE = 18;

const FULFILMENTS = new Set(['delivery', 'pickup', 'studio']);
const fulfilmentOf = (row) => (FULFILMENTS.has(row.fulfilment) ? row.fulfilment : 'delivery');
const studioSlotOf = (row) =>
  fulfilmentOf(row) === 'studio' && text(row.studio_date) && text(row.studio_slot) ? { date: text(row.studio_date), slot: text(row.studio_slot) } : null;

function deliveryWindow(value) {
  if (!isPlainObject(value) || !value.earliest || !value.latest) return null;
  return { earliest: text(value.earliest), latest: text(value.latest) };
}

/**
 * orders row to Order.
 *   items, events     order_items and order_events rows, in the order they should be shown
 *   settings          ctx.settings.get(): its address.state decides CGST + SGST or IGST
 *   includeToken      true adds accessToken: only for the buyer, on order creation and on their own order views
 *   estimatedDelivery { earliest, latest } as 'YYYY-MM-DD' when the caller has worked one out, else null
 *   bookingNumber     the studio booking linked to this order, '' when there is none
 */
export function toOrder(row, { items = [], events = [], settings, includeToken = false, estimatedDelivery = null, bookingNumber = '' } = {}) {
  const total = int(row.total);
  const amountPaid = int(row.amount_paid);
  return {
    orderNumber: text(row.order_number),
    invoiceNumber: text(row.invoice_number),
    ...(includeToken ? { accessToken: text(row.access_token) } : {}),
    status: text(row.status),
    paymentMethod: text(row.payment_method),
    paymentStatus: text(row.payment_status),
    customerName: text(row.customer_name),
    email: text(row.email),
    phone: text(row.phone),
    shippingAddress: {
      name: text(row.ship_name),
      phone: text(row.ship_phone),
      line1: text(row.ship_line1),
      line2: text(row.ship_line2),
      landmark: text(row.ship_landmark),
      city: text(row.ship_city),
      state: text(row.ship_state),
      pincode: text(row.ship_pincode),
    },
    gstin: text(row.gstin),
    vehicle: text(row.vehicle),
    subtotal: int(row.subtotal),
    discount: int(row.discount),
    couponCode: text(row.coupon_code),
    prepaidDiscount: int(row.prepaid_discount),
    shippingFee: int(row.shipping_fee),
    codFee: int(row.cod_fee),
    total,
    advanceAmount: int(row.advance_amount),
    amountPaid,
    amountDue: Math.max(0, total - amountPaid),
    upiReference: text(row.upi_reference),
    notes: text(row.notes),
    tracking: {
      carrier: text(row.tracking_carrier),
      number: text(row.tracking_number),
      url: text(row.tracking_url),
    },
    packPhoto: text(row.pack_photo),
    fulfilment: fulfilmentOf(row),
    studioSlot: studioSlotOf(row),
    fittingTotal: int(row.fitting_total),
    bookingNumber: text(bookingNumber),
    items: items.map(toOrderItem),
    events: events.map(toOrderEvent),
    tax: taxBreakdown(orderTaxLines(row, items), {
      storeState: text(settings?.address?.state),
      // Collected at the studio: the place of supply is the store's own State.
      shipState: fulfilmentOf(row) === 'delivery' ? text(row.ship_state) : '',
    }),
    canCancel: CANCELLABLE_STATUSES.has(row.status),
    estimatedDelivery: fulfilmentOf(row) === 'delivery' ? deliveryWindow(estimatedDelivery) : null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** orders row with an `item_count` column (units in the order) to AdminOrderListItem. */
export function toAdminOrderListItem(row) {
  const total = int(row.total);
  return {
    orderNumber: text(row.order_number),
    status: text(row.status),
    paymentMethod: text(row.payment_method),
    paymentStatus: text(row.payment_status),
    customerName: text(row.customer_name),
    phone: text(row.phone),
    city: text(row.ship_city),
    state: text(row.ship_state),
    itemCount: int(row.item_count),
    total,
    amountDue: Math.max(0, total - int(row.amount_paid)),
    fulfilment: fulfilmentOf(row),
    studioSlot: studioSlotOf(row),
    createdAt: text(row.created_at),
  };
}

/** bookings row to Booking (what the customer may see: no admin note). */
export function toBooking(row) {
  return {
    bookingNumber: text(row.booking_number),
    serviceId: text(row.service_id),
    serviceName: text(row.service_name),
    serviceCharge: int(row.service_charge),
    serviceMinutes: int(row.service_minutes),
    date: text(row.date),
    slot: text(row.slot),
    name: text(row.name),
    phone: text(row.phone),
    email: text(row.email),
    vehicle: text(row.vehicle),
    vehicleId: intOrNull(row.vehicle_id),
    registrationNumber: text(row.registration_number),
    notes: text(row.notes),
    orderNumber: text(row.order_number),
    status: text(row.status) || 'requested',
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** bookings row to AdminBooking: Booking plus the studio's own note and the sample flag. */
export function toAdminBooking(row) {
  return { ...toBooking(row), id: int(row.id), adminNote: text(row.admin_note), isDemo: flag(row.is_demo) };
}

/** The lines stored in quotes.items: [{ productId, variantId, qty, unitPrice }]. Malformed lines are dropped. */
export function quoteItems(row) {
  return jsonArray(row.items)
    .filter(isPlainObject)
    .map((item) => ({
      productId: int(item.productId),
      variantId: intOrNull(item.variantId),
      qty: int(item.qty),
      unitPrice: int(item.unitPrice),
    }))
    .filter((item) => item.productId > 0 && item.qty > 0);
}

function quoteStatus(row, now) {
  if (row.status === 'open' && Date.parse(row.valid_until) <= Date.parse(now)) return 'expired';
  return text(row.status) || 'open';
}

/**
 * quotes row to QuoteView, the quote as the customer sees it (no phone, no cost).
 * `cart` is the quote priced by priceCart(); `now` is ctx.now() and turns an open quote past its date into 'expired'.
 */
export function toQuote(row, { cart = null, now = new Date().toISOString() } = {}) {
  return {
    token: text(row.token),
    customerName: text(row.customer_name),
    note: text(row.note),
    validUntil: text(row.valid_until),
    status: quoteStatus(row, now),
    items: quoteItems(row).map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
    cart,
  };
}

/**
 * One stored quote line plus its product row (and variant row, when there is one) to a line of AdminQuote.items.
 * regularPrice is the normal selling price before any drop; costPrice is null when the owner has not entered one.
 */
export function toAdminQuoteItem(item, productRow, variantRow) {
  return {
    productId: int(item.productId),
    variantId: intOrNull(item.variantId),
    qty: int(item.qty),
    unitPrice: int(item.unitPrice),
    name: text(productRow?.name),
    variantName: text(variantRow?.name),
    sku: text(variantRow?.sku ?? productRow?.sku),
    regularPrice: int(variantRow?.price ?? productRow?.price),
    costPrice: productRow ? intOrNull(productRow.cost_price) : null,
  };
}

/**
 * quotes row to AdminQuote. `items` are lines from toAdminQuoteItem(); `now` is ctx.now().
 * total is the sum of unitPrice x qty (delivery is not part of it); margin is total minus cost,
 * or null when any line has no cost price.
 */
export function toAdminQuote(row, { items, now = new Date().toISOString() } = {}) {
  const lines = items ?? quoteItems(row).map((item) => toAdminQuoteItem(item));
  const total = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const costKnown = lines.every((line) => line.costPrice !== null && line.costPrice !== undefined);
  return {
    id: int(row.id),
    token: text(row.token),
    customerName: text(row.customer_name),
    phone: text(row.phone),
    note: text(row.note),
    items: lines,
    shippingFee: intOrNull(row.shipping_fee),
    validUntil: text(row.valid_until),
    status: quoteStatus(row, now),
    orderNumber: text(row.order_number),
    total,
    margin: costKnown ? total - lines.reduce((sum, line) => sum + line.costPrice * line.qty, 0) : null,
    createdAt: text(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Inbound messages and leads
// ---------------------------------------------------------------------------

/** enquiries row (with an optional `product_name` column from a join) to Enquiry. */
export function toEnquiry(row) {
  return {
    id: int(row.id),
    ticketNumber: text(row.ticket_number),
    kind: text(row.kind) || 'contact',
    name: text(row.name),
    phone: text(row.phone),
    email: text(row.email),
    subject: text(row.subject),
    message: text(row.message),
    productId: intOrNull(row.product_id),
    productName: textOrNull(row.product_name),
    orderNumber: text(row.order_number),
    vehicle: text(row.vehicle),
    status: text(row.status) || 'new',
    adminNote: text(row.admin_note),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** checkout_leads row to CheckoutLead. The browser's lead token is not included. */
export function toLead(row) {
  return {
    id: int(row.id),
    name: text(row.name),
    phone: text(row.phone),
    email: text(row.email),
    cart: jsonArray(row.cart).filter(isPlainObject),
    cartTotal: int(row.cart_total),
    status: text(row.status) || 'open',
    orderNumber: text(row.order_number),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

/** saved_kits row to SavedKit. */
export function toSavedKit(row) {
  return {
    id: int(row.id),
    token: text(row.token),
    name: text(row.name),
    phone: text(row.phone),
    vehicleLabel: text(row.vehicle_label),
    goal: text(row.goal),
    budget: int(row.budget),
    dealerQuote: int(row.dealer_quote),
    deliveryDate: text(row.delivery_date),
    productIds: idList(row.product_ids),
    total: int(row.total),
    status: text(row.status) || 'open',
    createdAt: text(row.created_at),
  };
}

/**
 * stock_alerts row with `product_name`, `product_slug` and `stock` columns to StockAlert.
 * `stock` is what is on the shelf now: the variant's stock when the alert names a variant, else the product's.
 */
export function toStockAlert(row) {
  return {
    id: int(row.id),
    productId: int(row.product_id),
    productName: text(row.product_name),
    productSlug: text(row.product_slug),
    stock: Math.max(0, int(row.stock)),
    variantId: intOrNull(row.variant_id),
    phone: text(row.phone),
    email: text(row.email),
    status: text(row.status) || 'waiting',
    createdAt: text(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Build Bay
// ---------------------------------------------------------------------------

const EMPTY_BUILD_STATE = Object.freeze({ bodyType: 'hatchback', paint: '#ffffff', rideHeight: 0, wheelSize: 0, night: false, tint: 0 });

// Fills in any key a stored state is missing, so the stage always has a complete BuildState to draw.
function toBuildState(value) {
  const stored = jsonObject(value);
  return { ...EMPTY_BUILD_STATE, ...stored, parts: isPlainObject(stored.parts) ? stored.parts : {} };
}

/**
 * builds row to Build. `products` are the build's parts as ProductSummary[], in the order of the
 * stored ids: getProductsByIds(ctx, idList(row.product_ids)). total is the sum of their current prices.
 */
export function toBuild(row, products = []) {
  return {
    slug: text(row.slug),
    title: text(row.title),
    authorName: text(row.author_name),
    vehicleLabel: text(row.vehicle_label),
    state: toBuildState(row.state),
    products,
    total: products.reduce((sum, product) => sum + int(product.price), 0),
    isHouse: flag(row.is_house),
    status: text(row.status) || 'private',
    isDemo: flag(row.is_demo),
    createdAt: text(row.created_at),
  };
}
