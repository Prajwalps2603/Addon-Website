/**
 * Addon Auto Motive: the API contract.
 *
 * This file is the single source of truth for every JSON shape that crosses the
 * wire between the Express API (server/) and the React client (client/).
 * The server builds exactly these shapes (see server/src/lib/mappers.js) and the
 * client consumes exactly these shapes. Endpoints are listed in docs/API.md.
 *
 * Conventions
 *  - Money is an integer number of rupees (INR). Never paise, never floats,
 *    except TaxBreakdown which is informational and uses 2-decimal numbers.
 *  - Timestamps are ISO-8601 UTC strings. Plain dates are 'YYYY-MM-DD'.
 *  - Success responses are the bare resource (no envelope).
 *  - Error responses are ApiErrorBody with a non-2xx status.
 */

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    /** 'validation_error' | 'not_found' | 'unauthorized' | 'forbidden' | 'conflict' | 'out_of_stock' | 'slot_unavailable' | 'duplicate_booking' | 'rate_limited' | 'payment_failed' | 'server_error' */
    code: string;
    /** Human readable, safe to show to the shopper. */
    message: string;
    /** Per-field messages for validation errors, keyed by dotted field path. */
    fields?: Record<string, string>;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface OkResponse {
  ok: true;
}

export type BodyType = 'hatchback' | 'sedan' | 'suv' | 'muv' | 'pickup' | 'coupe';

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

export interface PromoBanner {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  /** Client route, e.g. '/shop/lighting' or '/new-car'. */
  ctaHref: string;
  /** Wide photo URL (from /editorial/...), may be ''. */
  image: string;
  tone: 'yellow' | 'dark' | 'light';
  /** Optional window: the banner only shows between these instants. */
  startsAt: string | null;
  endsAt: string | null;
}

/** How an order reaches the customer: delivered by courier, collected at the studio, or fitted at the studio in a booked slot. */
export type Fulfilment = 'delivery' | 'pickup' | 'studio';

/** A fitting service the studio offers (settings.services, GET /api/studio/services). */
export interface StudioService {
  /** Stable id, e.g. 'stereo-install'. 'consult' is the free consultation, never charged on a part. */
  id: string;
  name: string;
  /** Rupees per unit fitted, GST inclusive. 0 = no charge (e.g. film application, included with the film). */
  charge: number;
  minutes: number;
  blurb: string;
  /** Catalogue subcategory slugs this service fits: a part in one of them can be fitted at the studio. */
  subcategorySlugs: string[];
}

/** The studio's booking rules. Times are 'HH:MM' in India time. */
export interface StudioSettings {
  /** false pauses studio bookings, pickup and fitting at checkout. */
  enabled: boolean;
  /** Studio address as one block of text. '' until the owner fills it in. */
  address: string;
  /** Map link, '' when not set. */
  mapUrl: string;
  /** Start times of the slots, sorted, e.g. ['10:00', '11:30', ...]. */
  slots: string[];
  /** Cars the studio can take in one slot. */
  carsPerSlot: number;
  /** Sunday is a half day: no slot starts after this time. '' = Sundays run every slot. */
  sundayLastSlot: string;
  /** Weekdays the studio is closed, 0 = Sunday ... 6 = Saturday. */
  closedWeekdays: number[];
  /** Same-day slots need this much notice. */
  minNoticeMinutes: number;
  /** Bookings open this many days ahead. */
  maxDaysAhead: number;
}

/** EMI through a finance partner. */
export interface EmiSettings {
  enabled: boolean;
  /** e.g. 'Bajaj Finserv'. */
  partner: string;
  /** Orders from this total (rupees) can be offered EMI. */
  minAmount: number;
  /** One plain line to show beside prices and at checkout. */
  note: string;
}

/** One job from the studio, shown as recent work (from the store's Instagram reels). */
export interface StudioWorkItem {
  id: string;
  title: string;
  /** e.g. 'Maruti Fronx'. '' when the post is not about one car (an offer). */
  car: string;
  /** e.g. 'Full build', 'Lighting', 'Audio'. */
  kind: string;
  /** Link to the post or the reels page. */
  url: string;
  /** Uploaded or https video file, '' when none. */
  video: string;
  /** Still image for the video, '' when none. */
  poster: string;
}

/** Everything the storefront may know about the store. GET /api/settings. */
export interface PublicSettings {
  storeName: string;
  legalName: string;
  tagline: string;
  /** Main phone number, as written for display. */
  phone: string;
  /** Further phone numbers shown beside `phone` (not repeating it). */
  phones: string[];
  /** Digits only with country code, e.g. '919876543210'. '' hides every WhatsApp feature. */
  whatsapp: string;
  email: string;
  address: { line1: string; line2: string; city: string; state: string; pincode: string };
  gstin: string;
  businessHours: string;
  grievanceOfficer: { name: string; designation: string; email: string; phone: string };
  social: { instagram: string; facebook: string; youtube: string };
  /** Short messages for the ticker at the very top of the site. */
  announcements: string[];
  /** Already filtered to banners that are live right now. */
  promos: PromoBanner[];
  shipping: {
    freeShippingThreshold: number;
    flatFee: number;
    /** Added once when the cart has any 'bulky' item. */
    bulkySurcharge: number;
    /** Added once when the cart has any 'freight' item. */
    freightSurcharge: number;
    originPincode: string;
    /** Working days before an order leaves the warehouse. */
    dispatchDays: number;
  };
  cod: {
    enabled: boolean;
    /** Shown up front, never revealed late. */
    fee: number;
    minOrder: number;
    /** 0 = no upper limit. */
    maxOrder: number;
    /** 0 = plain COD. Otherwise this percent of the total is paid online up front and the rest on delivery. */
    advancePercent: number;
  };
  /** Percent off the items total for paying online in full (Razorpay or UPI). 0 = none. */
  prepaidDiscountPercent: number;
  payments: {
    razorpay: boolean;
    razorpayKeyId: string;
    upi: boolean;
    upiId: string;
    upiPayeeName: string;
  };
  returns: { windowDays: number; summary: string };
  /** "It fits, or it is on us": free return when a verified direct-fit part does not fit. */
  fitPromise: { enabled: boolean; summary: string };
  /** The fitting studio's booking rules. */
  studio: StudioSettings;
  /** Fitting services, in the order to show them. */
  services: StudioService[];
  emi: EmiSettings;
  /** Recent studio jobs, in the order to show them. */
  studioWork: StudioWorkItem[];
  /** Printed on every invoice. */
  invoice: {
    /** Prefix of invoice numbers, e.g. 'ADN'. */
    prefix: string;
    footerNote: string;
  };
  /** True while the catalogue still contains seeded sample data. */
  hasDemoData: boolean;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  createdAt: string;
}

/** GET /api/auth/me */
export interface MeResponse {
  user: User | null;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

export interface AddressInput {
  label?: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface Address {
  id: number;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Catalogue: categories and vehicles
// ---------------------------------------------------------------------------

export interface Category {
  id: number;
  slug: string;
  name: string;
  blurb: string;
  /** Photo pool / icon key, e.g. 'alloy-wheel'. */
  artKind: string;
  /** Tile photo URL, may be ''. */
  image: string;
  parentId: number | null;
  sortOrder: number;
  isActive: boolean;
  /** Active products in this category (for a top-level category: in all its children). */
  productCount: number;
  /** Subcategories. Empty for subcategories themselves. */
  children: Category[];
}

/** One model generation, e.g. Maruti Suzuki Swift (2018 to 2024). */
export interface Vehicle {
  id: number;
  make: string;
  makeSlug: string;
  model: string;
  modelSlug: string;
  generation: string;
  bodyType: BodyType;
  yearFrom: number;
  /** null = still on sale */
  yearTo: number | null;
  /** Wheel bolt pattern when known, else ''. */
  pcd: string;
  isPopular: boolean;
  /** Ready to print, e.g. 'Maruti Suzuki Swift (2018-2024)' or 'Hyundai Creta (2024 onwards)'. */
  label: string;
}

export interface VehicleModelGroup {
  name: string;
  slug: string;
  bodyType: BodyType;
  isPopular: boolean;
  generations: Vehicle[];
}

/** GET /api/vehicles returns VehicleMake[] */
export interface VehicleMake {
  name: string;
  slug: string;
  isPopular: boolean;
  models: VehicleModelGroup[];
}

// ---------------------------------------------------------------------------
// Catalogue: products
// ---------------------------------------------------------------------------

/**
 * The fit verdict for the vehicle named by the request's vehicleId.
 *  'direct'    listed as fitting that car with no modification
 *  'with_work' fits that car but needs work (see fitNote)
 *  'universal' a universal part, or one made for that body type / bolt pattern
 *  'no'        does not fit that car
 *  'unknown'   we have not checked this part on that car yet: the shopper can ask
 *  null        no vehicle was named
 */
export type FitStatus = 'direct' | 'with_work' | 'universal' | 'no' | 'unknown' | null;

/** How a part stands with Indian road rules. */
export type Legality = 'road_legal' | 'check_rules' | 'off_road_only';
export type WarrantyImpact = 'none' | 'possible' | 'likely';
export type Wiring = 'none' | 'plug_and_play' | 'splice';
export type ShipClass = 'small' | 'medium' | 'bulky' | 'freight';
export type FitmentType = 'vehicle' | 'body_type' | 'pcd' | 'universal' | 'none';

/** A live price drop on this product (The Friday Five). */
export interface ProductDrop {
  percentOff: number;
  /** The owner's one-line reason for the drop. */
  reason: string;
  endsAt: string;
}

export type BuildSlot =
  | 'wheels'
  | 'spoiler'
  | 'splitter'
  | 'skirts'
  | 'diffuser'
  | 'exhaust'
  | 'roofRack'
  | 'lightBar'
  | 'underglow'
  | 'decal'
  | 'bullBar'
  | 'sideStep'
  | 'snorkel'
  | 'lowering';

export type KitGoal = 'new_car' | 'sporty' | 'comfort' | 'sound' | 'night' | 'offroad' | 'protection';

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  /** House line, e.g. 'Addon Aero'. */
  brand: string;
  /** The subcategory. */
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  parentCategorySlug: string;
  parentCategoryName: string;
  shortDescription: string;
  /** What the shopper pays now, GST included, after any live drop. For products with variants: the lowest variant price. */
  price: number;
  /** The regular selling price before a drop. Equals `price` when no drop is live. */
  regularPrice: number;
  mrp: number;
  /** Whole-number percent that `price` is below MRP, 0 when price >= mrp. */
  discountPercent: number;
  drop: ProductDrop | null;
  stock: number;
  inStock: boolean;
  /** True when in stock but at or under the product's low-stock threshold. Real stock only. */
  lowStock: boolean;
  /** Main photo URL, or null: then the client shows the placeholder frame for artKind. Thumbnails: see imageVariant() in client/src/lib/images.ts. */
  image: string | null;
  artKind: string;
  ratingAvg: number;
  /** Number of approved fitted reports. */
  ratingCount: number;
  isNew: boolean;
  isFeatured: boolean;
  hasVariants: boolean;
  fitmentType: FitmentType;
  fit: FitStatus;
  /** Why, for 'with_work' and 'no' (e.g. 'Needs two holes drilled'). '' otherwise. */
  fitNote: string;
  /** True when the 'direct' verdict was confirmed by the shop and the Fit Promise applies. */
  fitVerified: boolean;
  legality: Legality;
  warrantyImpact: WarrantyImpact;
  installDifficulty: 1 | 2 | 3 | 4 | 5;
  proInstall: boolean;
  shipClass: ShipClass;
  codEligible: boolean;
  tags: string[];
  /** Non-null for products configured in a designer before buying, e.g. 'show-plate'. */
  customKind: string | null;
  buildSlot: BuildSlot | null;
  buildStyle: string | null;
  finishColor: string;
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string;
  /** After any live drop. */
  price: number;
  regularPrice: number;
  mrp: number;
  stock: number;
  inStock: boolean;
  attributes: Record<string, string>;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface ProductFitment {
  vehicle: Vehicle;
  fitType: 'direct' | 'with_work' | 'no';
  note: string;
  isVerified: boolean;
}

export interface FittingStep {
  en: string;
  hi: string;
}

/** The Straight Label: the honest facts panel on every product page. */
export interface StraightLabel {
  legality: Legality;
  legalityNote: string;
  warrantyImpact: WarrantyImpact;
  warrantyNote: string;
  wiring: Wiring;
  reversible: boolean;
  /** "Skip this if ..." one honest line. May be ''. */
  skipIf: string;
  installDifficulty: 1 | 2 | 3 | 4 | 5;
  installTimeMin: number;
  installTimeMax: number;
  proInstall: boolean;
  /** Fair local labour charge in rupees. Both 0 = no fitter needed. */
  fittingCostMin: number;
  fittingCostMax: number;
}

export interface RelatedProduct {
  kind: 'requires' | 'pairs_with';
  note: string;
  product: ProductSummary;
}

/** GET /api/products/:slug */
export interface ProductDetail extends ProductSummary {
  sku: string;
  description: string;
  images: string[];
  highlights: string[];
  specs: SpecRow[];
  boxContents: string[];
  variants: ProductVariant[];
  /** Every car we hold a verdict for. */
  fitments: ProductFitment[];
  /** For fitmentType 'body_type'. */
  bodyTypes: BodyType[];
  /** For fitmentType 'pcd'. */
  pcd: string;
  label: StraightLabel;
  fittingTools: string[];
  fittingSteps: FittingStep[];
  warrantyMonths: number;
  returnable: boolean;
  netQuantity: string;
  manufacturer: string;
  countryOfOrigin: string;
  hsnCode: string;
  gstRate: number;
  weightGrams: number;
  /** Lowest price charged in the 30 days before the current price took effect, or null when there is no history. */
  lowest30Days: number | null;
  /** Oldest first. Used for the small price-history chart. */
  priceHistory: { date: string; price: number }[];
  goals: KitGoal[];
  isDemo: boolean;
  /** "You will also need" and "works well with". */
  relations: RelatedProduct[];
  /** Same subcategory, up to 8. */
  similar: ProductSummary[];
}

export type ProductSort = 'relevance' | 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'discount';

/** Query string of GET /api/products. Every field optional. */
export interface ProductQuery {
  q?: string;
  /** A top-level or subcategory slug. */
  category?: string;
  vehicleId?: number;
  /** '1' with vehicleId: hide parts whose verdict is 'no'. */
  fitOnly?: '1';
  bodyType?: BodyType;
  minPrice?: number;
  maxPrice?: number;
  /** '1' = only in stock */
  inStock?: '1';
  /** '1' = only products priced below MRP or in a live drop */
  onSale?: '1';
  /** '1' = only products in the live drop */
  inDrop?: '1';
  isNew?: '1';
  featured?: '1';
  legality?: Legality;
  /** Max install difficulty 1 to 5 ("I can fit it myself"). */
  maxDifficulty?: number;
  /** Comma separated. */
  tags?: string;
  buildSlot?: BuildSlot;
  /** Comma separated product ids: fetch exactly these (wishlist, compare, recently viewed). */
  ids?: string;
  sort?: ProductSort;
  page?: number;
  /** Default 24, max 60. */
  limit?: number;
}

export interface ProductFacets {
  categories: { slug: string; name: string; parentSlug: string | null; count: number }[];
  price: { min: number; max: number };
  tags: { tag: string; count: number }[];
  legality: { value: Legality; count: number }[];
  inStockCount: number;
  onSaleCount: number;
  /** Only meaningful with vehicleId: how many results fit (direct, with_work or universal). */
  fitsCount: number;
}

export interface CategoryPick {
  tier: 'sensible' | 'sweet_spot' | 'all_out';
  /** The shop's one-line reason. */
  reason: string;
  product: ProductSummary;
}

/** GET /api/products */
export interface ProductListResponse extends Paginated<ProductSummary> {
  facets: ProductFacets;
  /** The vehicle that vehicleId resolved to, if any. */
  vehicle: Vehicle | null;
  /** The category that `category` resolved to, if any. */
  category: Category | null;
  /** Pick of Three for that category (subcategories only). Empty otherwise. */
  picks: CategoryPick[];
  /** With q: the canonical words the search understood, e.g. 'dikki' was read as 'boot'. */
  understoodAs: string | null;
}

/** GET /api/search/suggest?q= */
export interface SearchSuggestResponse {
  products: ProductSummary[];
  categories: { slug: string; name: string; parentName: string | null }[];
  vehicles: Vehicle[];
  understoodAs: string | null;
}

/** The live drop with its products. */
export interface Drop {
  id: number;
  title: string;
  note: string;
  startsAt: string;
  endsAt: string;
  items: { product: ProductSummary; percentOff: number; reason: string }[];
}

/** GET /api/home */
export interface HomeResponse {
  categories: Category[];
  featured: ProductSummary[];
  newArrivals: ProductSummary[];
  bestSellers: ProductSummary[];
  /** The live Friday Five, or null between drops. */
  drop: Drop | null;
  popularVehicles: Vehicle[];
  /** Approved Build Bay builds for the gallery strip. */
  builds: Build[];
  /** With vehicleId: top parts that fit that car. Empty otherwise. */
  forYourCar: ProductSummary[];
}

// ---------------------------------------------------------------------------
// Fitted reports and questions
// ---------------------------------------------------------------------------

export type FittedBy = 'self' | 'local_garage' | 'dealer' | 'not_fitted';

export interface FittedReport {
  id: number;
  productId: number;
  authorName: string;
  vehicle: string;
  rating: number;
  fittedBy: FittedBy;
  timeMinutes: number | null;
  difficulty: number | null;
  fittedOk: boolean;
  issues: string;
  body: string;
  photos: string[];
  isVerifiedPurchase: boolean;
  /** Seeded sample: the UI must label it "Sample". */
  isDemo: boolean;
  createdAt: string;
}

/** GET /api/products/:slug/reports */
export interface FittedReportsResponse {
  items: FittedReport[];
  total: number;
  average: number;
  /** Percent of reports where the part fitted without problems. null when there are no reports. */
  fittedOkPercent: number | null;
  medianTimeMinutes: number | null;
  averageDifficulty: number | null;
  byFitter: Record<FittedBy, number>;
}

/** POST /api/products/:slug/reports. Guests must prove the purchase with orderNumber + phone. */
export interface FittedReportInput {
  authorName: string;
  vehicle: string;
  rating: number;
  fittedBy: FittedBy;
  timeMinutes?: number | null;
  difficulty?: number | null;
  fittedOk: boolean;
  issues?: string;
  body?: string;
  photos?: string[];
  orderNumber?: string;
  phone?: string;
}

export interface Question {
  id: number;
  kind: 'general' | 'fitment';
  vehicleLabel: string;
  authorName: string;
  question: string;
  answer: string | null;
  answerFitType: 'direct' | 'with_work' | 'no' | null;
  answeredAt: string | null;
  isDemo: boolean;
  createdAt: string;
}

/** POST /api/products/:slug/questions */
export interface QuestionInput {
  kind: 'general' | 'fitment';
  authorName: string;
  /** Required for kind 'fitment' so the shop can reply on WhatsApp. */
  phone?: string;
  /** For kind 'fitment'. */
  vehicleId?: number;
  question: string;
}

// ---------------------------------------------------------------------------
// Cart and checkout
// ---------------------------------------------------------------------------

/** What the browser keeps for each cart line. Prices always come back from the server. */
export interface CartLineInput {
  productId: number;
  variantId: number | null;
  qty: number;
  /** Designer output for customised products (e.g. show-plate text and style). */
  custom?: Record<string, unknown> | null;
  /** Ask Addon to fit this part at the studio. Only parts with a fitting service (PricedLine.fittingService) can be; any such line makes the order a studio order. */
  fitAtStudio?: boolean;
}

export type CartLineIssue = null | 'unavailable' | 'out_of_stock' | 'insufficient_stock';

/** The fitting service that fits a cart line's part. */
export interface LineFittingService {
  id: string;
  name: string;
  /** Rupees per unit, GST inclusive. 0 = no charge. */
  charge: number;
  minutes: number;
}

export interface PricedLine {
  /** `${productId}:${variantId ?? 0}:${short hash of custom, or ''}`; stable for the same input. */
  key: string;
  productId: number;
  variantId: number | null;
  slug: string;
  name: string;
  variantName: string;
  image: string | null;
  artKind: string;
  unitPrice: number;
  unitMrp: number;
  /** The qty actually priced (clamped to stock). */
  qty: number;
  lineTotal: number;
  /** Stock available for this line. */
  maxQty: number;
  issue: CartLineIssue;
  fit: FitStatus;
  fitNote: string;
  legality: Legality;
  shipClass: ShipClass;
  codEligible: boolean;
  custom: Record<string, unknown> | null;
  /** The studio service that can fit this part, whether chosen or not. null when the studio does not fit it or studio bookings are paused. */
  fittingService: LineFittingService | null;
  /** True when this line will be fitted at the studio. */
  fitAtStudio: boolean;
  /** Fitting charge for the whole line (service charge x qty), 0 when not fitted or the service has no charge. */
  fittingCharge: number;
  /** Name of the service charged, '' when not fitted. */
  fittingServiceName: string;
}

export interface TaxBreakdown {
  /** Total before GST, 2 decimals. */
  taxableValue: number;
  /** Total GST contained in the order total, 2 decimals. */
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** True when the delivery state differs from the store's state: IGST applies instead of CGST+SGST. */
  isInterState: boolean;
}

export type PaymentMethod = 'cod' | 'razorpay' | 'upi';
export type PaymentStatus = 'pending' | 'advance_paid' | 'paid' | 'failed' | 'refunded';

/**
 * One way to pay, priced in rupees so the shopper can compare honestly.
 * For pickup and studio orders the 'cod' method means paying at the studio: its label is
 * 'Pay at the studio', it has no COD fee and no advance, and dueOnDelivery is paid there.
 */
export interface PaymentOption {
  method: PaymentMethod;
  label: string;
  /** One plain line, e.g. 'Pay Rs 200 now, Rs 1,799 to the courier'. */
  note: string;
  available: boolean;
  /** Why not, when unavailable. */
  reason: string | null;
  /** Order total if this method is chosen (includes COD fee or prepaid discount). */
  total: number;
  /** To pay online right now. */
  payNow: number;
  /** To pay the courier on delivery (or at the studio for pickup and studio orders). */
  dueOnDelivery: number;
  /** Rupees saved versus the dearest available option. */
  saving: number;
}

/** The Sanity Check: a mechanic's eye over the cart. */
export interface CartAdvice {
  severity: 'problem' | 'warning' | 'tip' | 'good';
  /** e.g. 'does_not_fit' | 'needs_work' | 'missing_required' | 'duplicate_purpose' | 'off_road_only' | 'pro_install' | 'fits_all' */
  code: string;
  message: string;
  /** Cart product ids this is about. */
  productIds: number[];
  /** A one-tap fix, when there is one. */
  action: null | { type: 'remove' | 'add'; productId: number; label: string };
}

/** POST /api/cart/price request */
export interface PriceCartRequest {
  items: CartLineInput[];
  couponCode?: string;
  pincode?: string;
  paymentMethod?: PaymentMethod;
  /** The shopper's active garage car, for fit verdicts and the Sanity Check. */
  vehicleId?: number;
  /** Price the lines from this quote instead of the catalogue. */
  quoteToken?: string;
  /**
   * How the shopper wants the order. Default 'delivery'. Any line with fitAtStudio makes it 'studio';
   * 'studio' with nothing to fit is priced as 'pickup'. Pickup and studio have no shipping fee.
   */
  fulfilment?: Fulfilment;
}

/** POST /api/cart/price response: the server is the only source of truth for totals. */
export interface PricedCart {
  lines: PricedLine[];
  itemCount: number;
  subtotal: number;
  mrpTotal: number;
  /** mrpTotal - subtotal */
  savings: number;
  coupon: { code: string; description: string; discount: number } | null;
  /** Why the supplied coupon was not applied, ready to show. */
  couponError: string | null;
  /** Coupon discount in rupees. */
  discount: number;
  /** Applied only when paymentMethod is razorpay or upi. */
  prepaidDiscount: number;
  shippingFee: number;
  codFee: number;
  /** For the chosen paymentMethod (or for full online payment when none is chosen). */
  total: number;
  payNow: number;
  dueOnDelivery: number;
  freeShippingThreshold: number;
  /** 0 when shipping is already free, and for pickup and studio orders. */
  amountToFreeShipping: number;
  /** Includes the fitting charges as a service at 18%. */
  tax: TaxBreakdown;
  /** How the order will reach the customer, as priced (see PriceCartRequest.fulfilment). */
  fulfilment: Fulfilment;
  /** Sum of the lines' fitting charges, included in total. Never discounted. */
  fittingTotal: number;
  /** True for studio orders: checkout must ask for a slot (CreateOrderRequest.studioSlot). */
  needsSlot: boolean;
  /** Every method, each fully priced. */
  paymentOptions: PaymentOption[];
  advice: CartAdvice[];
  /** Set when the cart is priced from a quote. */
  quote: { token: string; customerName: string; validUntil: string; note: string } | null;
  /** True when every line is purchasable as priced. */
  canCheckout: boolean;
  /** Plain notices, e.g. 'Only 2 left of Addon Aero Spoiler: quantity updated.' */
  messages: string[];
}

/** GET /api/shipping/estimate?pincode= */
export interface ShippingEstimate {
  pincode: string;
  serviceable: boolean;
  state: string;
  /** Working days from order to delivery. */
  minDays: number;
  maxDays: number;
  /** 'YYYY-MM-DD' */
  earliest: string;
  latest: string;
  codAvailable: boolean;
  message: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface OrderItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  slug: string;
  name: string;
  variantName: string;
  sku: string;
  image: string | null;
  price: number;
  mrp: number;
  qty: number;
  lineTotal: number;
  gstRate: number;
  hsnCode: string;
  custom: Record<string, unknown> | null;
  /** Fitted at the studio as part of this order. */
  fitAtStudio: boolean;
  /** Fitting charge for the whole line, 0 when not fitted. Not part of lineTotal. */
  fittingCharge: number;
  /** '' when not fitted. */
  fittingServiceName: string;
}

export interface OrderEvent {
  status: string;
  note: string;
  actor: 'system' | 'customer' | 'admin';
  createdAt: string;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  orderNumber: string;
  invoiceNumber: string;
  /** Present for the buyer (on creation and on their own order views). Lets a guest reopen the order page. */
  accessToken?: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  email: string;
  phone: string;
  /** Every field is '' for pickup and studio orders placed without an address. */
  shippingAddress: ShippingAddress;
  gstin: string;
  vehicle: string;
  fulfilment: Fulfilment;
  /** The booked studio slot (India time) for studio orders, else null. */
  studioSlot: StudioSlotChoice | null;
  /** Studio fitting charges included in total. */
  fittingTotal: number;
  /** The studio booking made for this order (ADN-B-000123), '' when there is none. */
  bookingNumber: string;
  subtotal: number;
  discount: number;
  couponCode: string;
  prepaidDiscount: number;
  shippingFee: number;
  codFee: number;
  total: number;
  /** COD orders with an advance: the part paid online up front. 0 otherwise. */
  advanceAmount: number;
  amountPaid: number;
  /** total - amountPaid, never below 0. */
  amountDue: number;
  /** UTR the buyer reported for a direct UPI payment, '' otherwise. */
  upiReference: string;
  notes: string;
  tracking: { carrier: string; number: string; url: string };
  /** Photo of the packed items, '' until packed. */
  packPhoto: string;
  items: OrderItem[];
  events: OrderEvent[];
  tax: TaxBreakdown;
  /** True while the buyer may still cancel (before it is packed). */
  canCancel: boolean;
  /** Delivery orders only; null for pickup and studio. */
  estimatedDelivery: { earliest: string; latest: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/orders request */
export interface CreateOrderRequest {
  items: CartLineInput[];
  couponCode?: string;
  contact: { name: string; email: string; phone: string };
  /** Required for delivery. Optional for pickup and studio orders (send null or leave it out); when given it is validated and printed on the invoice. */
  shippingAddress?: AddressInput | null;
  /** Default 'delivery'. The server decides the final value as /cart/price does (any fitAtStudio line makes it 'studio'). */
  fulfilment?: Fulfilment;
  /** Required when the order is a studio order. Re-checked when the order is placed: 409 'slot_unavailable' if it has just filled. */
  studioSlot?: StudioSlotChoice | null;
  /** 'cod' means pay at the studio for pickup and studio orders. */
  paymentMethod: PaymentMethod;
  notes?: string;
  gstin?: string;
  /** The active garage car, for the order record and fit checks. */
  vehicleId?: number;
  /** The car typed in when it is not in the catalogue. Studio orders need vehicleId or vehicleLabel. */
  vehicleLabel?: string;
  /** Studio orders: the car's registration number, e.g. 'KA 01 AB 1234'. */
  registrationNumber?: string;
  quoteToken?: string;
  /** Token from POST /api/checkout/lead so the lead is marked recovered. */
  leadToken?: string;
  /** Logged-in shoppers: also save this address to the account. */
  saveAddress?: boolean;
  /** A UUID the browser makes once per checkout attempt. Retrying with the same key returns the same order. */
  idempotencyKey: string;
}

export type PaymentInstruction =
  | null
  | {
      provider: 'razorpay';
      /** 'full' or the COD 'advance'. */
      purpose: 'full' | 'advance';
      keyId: string;
      razorpayOrderId: string;
      amountPaise: number;
      currency: 'INR';
      prefill: { name: string; email: string; contact: string };
    }
  | {
      provider: 'upi';
      purpose: 'full' | 'advance';
      /** upi://pay?... deep link, also rendered as a QR code. */
      upiUri: string;
      upiId: string;
      payeeName: string;
      amount: number;
    };

/** POST /api/orders response */
export interface CreateOrderResponse {
  order: Order;
  /** What the client must do next to collect payment. null for plain cash on delivery. */
  payment: PaymentInstruction;
}

/** POST /api/payments/razorpay/verify request */
export interface RazorpayVerifyRequest {
  orderNumber: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** POST /api/payments/upi/confirm request: the shopper reports the 12-digit UTR after paying. */
export interface UpiConfirmRequest {
  orderNumber: string;
  accessToken: string;
  upiReference: string;
}

/** POST /api/checkout/lead request: sent once the shopper has typed a valid phone number at checkout. */
export interface CheckoutLeadRequest {
  token?: string;
  name?: string;
  phone: string;
  email?: string;
  items: CartLineInput[];
}

export interface CheckoutLeadResponse {
  token: string;
}

/** GET /api/quotes/:token: a quote as the customer sees it. */
export interface QuoteView {
  token: string;
  customerName: string;
  note: string;
  validUntil: string;
  status: 'open' | 'ordered' | 'cancelled' | 'expired';
  /** The cart lines to load. */
  items: CartLineInput[];
  /** The quote priced as a cart. */
  cart: PricedCart;
}

// ---------------------------------------------------------------------------
// Fitting studio
// ---------------------------------------------------------------------------

/** A day and a slot start time, both India time. */
export interface StudioSlotChoice {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM', one of settings.studio.slots */
  slot: string;
}

/**
 * Why a slot cannot be booked: 'past' (already started, or the day has gone), 'closed' (studio paused,
 * a closed weekday, beyond the booking horizon, or after the Sunday half day), 'notice' (starts sooner than
 * settings.studio.minNoticeMinutes from now), 'full' (carsPerSlot cars already booked). null = bookable.
 */
export type StudioSlotReason = null | 'full' | 'past' | 'closed' | 'notice';

export interface StudioSlot {
  /** 'HH:MM' India time. */
  slot: string;
  available: boolean;
  reason: StudioSlotReason;
  /** Places still free; 0 when not available. */
  left: number;
}

/** GET /api/studio/slots?date= : one day of the studio diary as the shopper sees it. */
export interface StudioDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** True when at least one slot is available. */
  open: boolean;
  /** One plain line about the day, e.g. 'The studio is closed on Mondays.' or the Sunday half-day note; '' when nothing to say. */
  message: string;
  slots: StudioSlot[];
}

export type BookingStatus = 'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

/** A car booked into a studio slot. */
export interface Booking {
  /** e.g. 'ADN-B-000123'. */
  bookingNumber: string;
  /** settings.services id, or 'order' when it comes from a studio order. */
  serviceId: string;
  /** Snapshot at booking time. */
  serviceName: string;
  /** Rupees, GST inclusive; for an order, the order's fitting total. */
  serviceCharge: number;
  serviceMinutes: number;
  /** 'YYYY-MM-DD' India time. */
  date: string;
  /** 'HH:MM' India time. */
  slot: string;
  name: string;
  /** 10 digits. */
  phone: string;
  email: string;
  /** Car label, e.g. 'Honda City (2020 onwards)'. */
  vehicle: string;
  vehicleId: number | null;
  registrationNumber: string;
  notes: string;
  /** The studio order this booking belongs to, '' for a service booked on its own. */
  orderNumber: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/studio/bookings request: a fitting service booked on its own. */
export interface BookingRequest {
  serviceId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' */
  slot: string;
  name: string;
  phone: string;
  /** Optional: a confirmation is emailed when given. */
  email?: string;
  /** vehicleId or vehicleLabel is required. */
  vehicleId?: number;
  vehicleLabel?: string;
  registrationNumber?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export interface GarageVehicle {
  vehicleId: number;
  year: number | null;
  nickname: string;
  isActive: boolean;
}

/** GET /api/account/garage returns GarageEntry[] */
export interface GarageEntry extends GarageVehicle {
  vehicle: Vehicle;
}

// ---------------------------------------------------------------------------
// Kits (New Car planner and Pocket Builds)
// ---------------------------------------------------------------------------

/** POST /api/kits/build request */
export interface KitRequest {
  goal: KitGoal;
  /** Rupees. */
  budget: number;
  vehicleId?: number;
  bodyType?: BodyType;
  /** Product ids the shopper already has or removed. */
  exclude?: number[];
}

export interface KitItem {
  product: ProductSummary;
  /** Why this part is in the kit, one line. */
  reason: string;
}

export interface Kit {
  tier: 'essential' | 'smart' | 'full';
  title: string;
  blurb: string;
  items: KitItem[];
  total: number;
  mrpTotal: number;
}

/** POST /api/kits/build response: up to three kits, each within the budget. */
export interface KitResponse {
  goal: KitGoal;
  budget: number;
  vehicle: Vehicle | null;
  kits: Kit[];
}

/** POST /api/kits/save request */
export interface SaveKitRequest {
  name: string;
  phone: string;
  vehicleLabel: string;
  goal: KitGoal;
  budget: number;
  /** What the dealer quoted for accessories, if the shopper typed it. */
  dealerQuote?: number;
  /** 'YYYY-MM-DD' the new car arrives, if known. */
  deliveryDate?: string;
  productIds: number[];
}

// ---------------------------------------------------------------------------
// Build Bay
// ---------------------------------------------------------------------------

export interface BuildPart {
  /** Art style inside the slot, e.g. 'mesh' for wheels. */
  style: string;
  /** Hex colour for parts that take one (wheel finish, underglow, decal). */
  color?: string;
  /** The catalogue product this part stands for, when one is chosen. */
  productId?: number | null;
}

export interface BuildState {
  bodyType: 'hatchback' | 'sedan' | 'suv';
  /** Paint hex. */
  paint: string;
  /** -2 (slammed) to 2 (lifted); 0 = stock. */
  rideHeight: number;
  /** Wheel diameter step: 0 = stock, 1 = +1 inch, 2 = +2 inches. */
  wheelSize: number;
  night: boolean;
  /** 0 to 60, percent darkness of window tint. */
  tint: number;
  parts: Partial<Record<BuildSlot, BuildPart>>;
}

export interface Build {
  slug: string;
  title: string;
  authorName: string;
  vehicleLabel: string;
  state: BuildState;
  products: ProductSummary[];
  /** Sum of the products' current prices. */
  total: number;
  isHouse: boolean;
  status: 'private' | 'pending' | 'approved' | 'rejected';
  isDemo: boolean;
  createdAt: string;
}

/** POST /api/builds request */
export interface SaveBuildRequest {
  title: string;
  authorName?: string;
  vehicleLabel?: string;
  state: BuildState;
  productIds: number[];
  /** True = also ask for it to be shown in the public gallery (goes to moderation). */
  submitToGallery?: boolean;
}

// ---------------------------------------------------------------------------
// Inbound messages
// ---------------------------------------------------------------------------

export type EnquiryKind = 'contact' | 'complaint' | 'bulk' | 'install' | 'return';

export interface EnquiryInput {
  kind?: EnquiryKind;
  name: string;
  phone?: string;
  email?: string;
  subject?: string;
  message: string;
  productId?: number;
  orderNumber?: string;
  vehicle?: string;
}

/** POST /api/enquiries response */
export interface EnquiryReceipt {
  ticketNumber: string;
}

export interface StockAlertInput {
  productId: number;
  variantId?: number | null;
  phone?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminVariantInput {
  /** Omit to create a new variant. */
  id?: number;
  name: string;
  sku: string;
  price: number;
  mrp: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface AdminFitmentInput {
  vehicleId: number;
  fitType: 'direct' | 'with_work' | 'no';
  note: string;
  isVerified: boolean;
}

/** POST /api/admin/products and PUT /api/admin/products/:id body */
export interface AdminProductInput {
  name: string;
  /** Omit to derive from the name. */
  slug?: string;
  sku: string;
  brand: string;
  categoryId: number;
  shortDescription: string;
  description: string;
  price: number;
  mrp: number;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  supplier: string;
  hsnCode: string;
  gstRate: number;
  weightGrams: number;
  shipClass: ShipClass;
  netQuantity: string;
  manufacturer: string;
  countryOfOrigin: string;
  images: string[];
  artKind: string | null;
  finishColor: string;
  highlights: string[];
  specs: SpecRow[];
  boxContents: string[];
  tags: string[];
  fitmentType: FitmentType;
  bodyTypes: BodyType[];
  pcd: string;
  fitments: AdminFitmentInput[];
  label: StraightLabel;
  fittingTools: string[];
  fittingSteps: FittingStep[];
  warrantyMonths: number;
  returnable: boolean;
  codEligible: boolean;
  goals: KitGoal[];
  essentialRank: number;
  buildSlot: BuildSlot | null;
  buildStyle: string | null;
  customKind: string | null;
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  variants: AdminVariantInput[];
  /** Product ids. */
  requiresIds: number[];
  pairsWithIds: number[];
}

/** What admin product endpoints return. */
export interface AdminProduct extends ProductDetail {
  costPrice: number | null;
  supplier: string;
  lowStockThreshold: number;
  essentialRank: number;
  isActive: boolean;
  soldCount: number;
  requiresIds: number[];
  pairsWithIds: number[];
  createdAt: string;
  updatedAt: string;
}

/** DELETE /api/admin/products/:id: deleted when it was never ordered, otherwise hidden (deactivated). */
export interface AdminProductDeleteResponse extends OkResponse {
  deleted: boolean;
  deactivated: boolean;
  /** Plain sentence to show, e.g. why it was hidden rather than deleted. */
  message: string;
}

export interface AdminOrderListItem {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  customerName: string;
  phone: string;
  city: string;
  state: string;
  itemCount: number;
  total: number;
  amountDue: number;
  fulfilment: Fulfilment;
  studioSlot: StudioSlotChoice | null;
  createdAt: string;
}

/** A booking in the admin studio diary. */
export interface AdminBooking extends Booking {
  id: number;
  /** The studio's own note, never shown to the customer. */
  adminNote: string;
  isDemo: boolean;
}

/** PUT /api/admin/bookings/:bookingNumber body. Every field optional. A new date or slot is checked for a free place. */
export interface AdminBookingUpdate {
  status?: BookingStatus;
  date?: string;
  slot?: string;
  adminNote?: string;
}

/** PUT /api/admin/orders/:orderNumber body. Every field optional. */
export interface AdminOrderUpdate {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Set together with paymentStatus when money was received (COD cash, verified UPI). */
  amountPaid?: number;
  note?: string;
  trackingCarrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  /** URL returned by POST /api/admin/uploads. */
  packPhoto?: string;
}

export interface Coupon {
  id: number;
  code: string;
  description: string;
  type: 'percent' | 'flat' | 'free_shipping';
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount' | 'createdAt'>;

export interface AdminCustomer extends User {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface AdminReport extends FittedReport {
  status: 'pending' | 'approved' | 'rejected';
  orderNumber: string;
  productName: string;
  productSlug: string;
}

export interface AdminQuestion extends Question {
  status: 'pending' | 'published' | 'rejected';
  phone: string;
  vehicleId: number | null;
  productId: number;
  productName: string;
  productSlug: string;
  /** For fitment questions: how many shoppers asked about this same product and car. */
  sameAskCount: number;
}

/** PUT /api/admin/questions/:id body */
export interface AdminQuestionAnswer {
  answer?: string;
  /** For fitment questions: the verdict. Saved to the product's fitment table so the store answers this car from now on. */
  fitType?: 'direct' | 'with_work' | 'no';
  isVerified?: boolean;
  status?: 'pending' | 'published' | 'rejected';
}

export interface Enquiry {
  id: number;
  ticketNumber: string;
  kind: EnquiryKind;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  productId: number | null;
  productName: string | null;
  orderNumber: string;
  vehicle: string;
  status: 'new' | 'acknowledged' | 'resolved';
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutLead {
  id: number;
  name: string;
  phone: string;
  email: string;
  cart: PricedLine[];
  cartTotal: number;
  status: 'open' | 'contacted' | 'recovered' | 'dismissed';
  orderNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedKit {
  id: number;
  token: string;
  name: string;
  phone: string;
  vehicleLabel: string;
  goal: string;
  budget: number;
  dealerQuote: number;
  deliveryDate: string;
  productIds: number[];
  total: number;
  status: 'open' | 'contacted' | 'ordered' | 'dismissed';
  createdAt: string;
}

export interface StockAlert {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  /** Current stock, so staff can see which alerts can be answered now. */
  stock: number;
  variantId: number | null;
  phone: string;
  email: string;
  status: 'waiting' | 'notified';
  createdAt: string;
}

export interface QuoteItemInput {
  productId: number;
  variantId: number | null;
  qty: number;
  /** The price offered per unit. */
  unitPrice: number;
}

/** POST /api/admin/quotes and PUT /api/admin/quotes/:id body */
export interface QuoteInput {
  customerName: string;
  phone: string;
  note: string;
  items: QuoteItemInput[];
  /** null = normal shipping rules. */
  shippingFee: number | null;
  /** ISO timestamp. */
  validUntil: string;
}

export interface AdminQuote {
  id: number;
  token: string;
  customerName: string;
  phone: string;
  note: string;
  items: (QuoteItemInput & { name: string; variantName: string; sku: string; regularPrice: number; costPrice: number | null })[];
  shippingFee: number | null;
  validUntil: string;
  status: 'open' | 'ordered' | 'cancelled' | 'expired';
  orderNumber: string;
  total: number;
  /** total minus known cost; null when any cost price is missing. */
  margin: number | null;
  createdAt: string;
}

export interface DropInput {
  title: string;
  note: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  items: { productId: number; percentOff: number; reason: string }[];
}

export interface AdminDrop extends Drop {
  isActive: boolean;
  /** 'scheduled' | 'live' | 'ended' | 'off' */
  state: string;
  /** POST and PUT /admin/drops only: the other active drops this save switched off. */
  deactivatedDropIds?: number[];
}

/** PUT /api/admin/categories/:id/picks body */
export interface CategoryPicksInput {
  picks: { tier: 'sensible' | 'sweet_spot' | 'all_out'; productId: number; reason: string }[];
}

/** One person worth a WhatsApp message today, with the message already written. */
export interface FollowUp {
  /** Stable id, e.g. 'lead:12'. */
  id: string;
  type:
    | 'abandoned_checkout'
    | 'cod_confirm'
    | 'upi_verify'
    | 'fitment_answered'
    | 'back_in_stock'
    | 'review_request'
    | 'saved_kit'
    | 'quote_expiring'
    | 'new_enquiry';
  title: string;
  detail: string;
  name: string;
  phone: string;
  /** Ready to send. */
  message: string;
  /** https://wa.me/<phone>?text=<message>, or '' when there is no phone. */
  waLink: string;
  /** Admin route to open for context, e.g. '/admin/orders/ADN-261117-4F7K'. */
  href: string;
  createdAt: string;
}

/** GET /api/admin/stats?days=30 */
export interface AdminStats {
  rangeDays: number;
  revenue: number;
  orders: number;
  averageOrderValue: number;
  unitsSold: number;
  newCustomers: number;
  pendingOrders: number;
  /** Money confirmed received in range. */
  collected: number;
  /** Cash still to come from couriers for COD orders in range. */
  codOutstanding: number;
  /** Gross margin in range where cost prices are known, else null. */
  margin: number | null;
  /** One point per day, oldest first, every day present. */
  series: { date: string; revenue: number; orders: number }[];
  byStatus: { status: OrderStatus; count: number }[];
  byPaymentMethod: { method: PaymentMethod; count: number; revenue: number }[];
  topProducts: { productId: number; name: string; slug: string; units: number; revenue: number }[];
  topCategories: { name: string; units: number; revenue: number }[];
  topStates: { state: string; orders: number; revenue: number }[];
  topVehicles: { vehicle: string; orders: number }[];
  lowStock: { productId: number; name: string; slug: string; sku: string; stock: number; threshold: number; supplier: string }[];
  openCounts: { followUps: number; enquiries: number; reports: number; questions: number; leads: number; stockAlerts: number; builds: number };
}

/** GET /api/admin/demand: the sales the shop could not make. */
export interface DemandReport {
  rangeDays: number;
  topSearches: { query: string; count: number; avgResults: number }[];
  /** Searches that found nothing: stock these next. */
  missedSearches: { query: string; count: number; lastSeen: string }[];
  mostWaitedFor: { productId: number; name: string; slug: string; waiting: number; stock: number }[];
  /** Cars people asked about that we have no verdict or parts for. */
  unansweredCars: { vehicleLabel: string; questions: number }[];
  /** Low and out-of-stock products grouped by supplier, with a ready WhatsApp purchase-order message. */
  reorder: { supplier: string; items: { productId: number; name: string; sku: string; stock: number; suggestedQty: number }[]; message: string }[];
}

/** Admin settings = public settings plus private ones. PUT accepts a deep partial of this. */
export interface AdminSettings extends PublicSettings {
  notifications: {
    /** Where new-order emails go. */
    orderEmail: string;
    smtpConfigured: boolean;
    razorpayConfigured: boolean;
  };
  invoice: {
    /** Prefix of invoice numbers, e.g. 'ADN'. */
    prefix: string;
    footerNote: string;
  };
  /** Extra search words: how shoppers say it -> what the catalogue calls it. */
  searchSynonyms: { says: string; means: string }[];
  /** Every promo, including ones outside their window. */
  allPromos: PromoBanner[];
}
