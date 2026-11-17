/**
 * The typed API client. One function per endpoint in docs/API.md.
 * Pages never call fetch: they call these and catch ApiError.
 */
import type {
  Address,
  AddressInput,
  AdminCustomer,
  AdminBooking,
  AdminBookingUpdate,
  AdminDrop,
  AdminOrderListItem,
  AdminOrderUpdate,
  AdminProduct,
  AdminProductInput,
  AdminQuestion,
  AdminQuestionAnswer,
  AdminQuote,
  AdminReport,
  AdminSettings,
  AdminStats,
  ApiErrorBody,
  AuthResponse,
  Booking,
  BookingRequest,
  BookingStatus,
  Build,
  Category,
  CategoryPick,
  CategoryPicksInput,
  CheckoutLead,
  CheckoutLeadRequest,
  CheckoutLeadResponse,
  Coupon,
  CouponInput,
  CreateOrderRequest,
  CreateOrderResponse,
  DemandReport,
  Drop,
  DropInput,
  Enquiry,
  EnquiryInput,
  EnquiryKind,
  EnquiryReceipt,
  FittedReportInput,
  FittedReportsResponse,
  FollowUp,
  GarageEntry,
  GarageVehicle,
  HomeResponse,
  KitRequest,
  KitResponse,
  LoginRequest,
  MeResponse,
  OkResponse,
  Order,
  OrderStatus,
  Paginated,
  PaymentInstruction,
  PaymentStatus,
  PriceCartRequest,
  PricedCart,
  ProductDetail,
  ProductListResponse,
  ProductQuery,
  ProductSummary,
  PublicSettings,
  Question,
  QuestionInput,
  QuoteInput,
  QuoteView,
  RazorpayVerifyRequest,
  RegisterRequest,
  SaveBuildRequest,
  SaveKitRequest,
  SavedKit,
  SearchSuggestResponse,
  ShippingEstimate,
  StockAlert,
  StockAlertInput,
  StudioDay,
  StudioService,
  UpiConfirmRequest,
  Vehicle,
  VehicleMake,
} from '@/types/api';

const API_BASE = '/api';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const NETWORK_MESSAGE = 'Could not reach the store. Check your connection and try again.';
const BAD_RESPONSE_MESSAGE = 'The store sent a reply we could not read. Try again in a moment.';

const STATUS_FALLBACK: Record<number, { code: string; message: string }> = {
  400: { code: 'validation_error', message: 'Some details are not right. Check them and try again.' },
  401: { code: 'unauthorized', message: 'Sign in to continue.' },
  403: { code: 'forbidden', message: 'You do not have access to this.' },
  404: { code: 'not_found', message: 'We could not find that.' },
  409: { code: 'conflict', message: 'That could not be done as things stand. Refresh and try again.' },
  413: { code: 'too_large', message: 'That file is too large.' },
  429: { code: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' },
};
const SERVER_FALLBACK = { code: 'server_error', message: 'Something went wrong on our side. Try again in a moment.' };

/** Every failed API call throws this. `status` is 0 when the request never reached the server. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field messages keyed by dotted field path. Empty when the error is not about fields. */
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** The request never got an answer (offline, server down). */
  get isNetwork(): boolean {
    return this.status === 0;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get hasFields(): boolean {
    return Object.keys(this.fields).length > 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** A message that is safe to show for anything a query or mutation can throw. */
export function errorMessage(error: unknown, fallback = SERVER_FALLBACK.message): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string';
}

async function errorFromResponse(response: Response): Promise<ApiError> {
  const fallback = STATUS_FALLBACK[response.status] ?? SERVER_FALLBACK;
  let body: unknown = null;
  try {
    body = JSON.parse(await response.text());
  } catch {
    // Not JSON (a proxy error page, an empty reply): the fallback message stands.
  }
  if (!isErrorBody(body)) return new ApiError(response.status, fallback.code, fallback.message);
  const { code, message, fields } = body.error;
  return new ApiError(response.status, code || fallback.code, message || fallback.message, fields ?? {});
}

// ---------------------------------------------------------------------------
// Request core
// ---------------------------------------------------------------------------

/** Optional last argument of every read: pass the query function's `signal` to make it cancellable. */
export interface RequestOptions {
  signal?: AbortSignal;
}

interface SendInit extends RequestOptions {
  query?: object | null;
  /** A plain value is sent as JSON, a FormData as multipart. */
  body?: unknown;
  accept?: string;
}

/**
 * Builds '?a=1&b=2'. Drops undefined, null, '' and false; true becomes '1';
 * arrays are joined with commas. Returns '' when nothing is left.
 */
export function buildQuery(params?: object | null): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, value === true ? '1' : String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function send(method: string, path: string, init: SendInit = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: init.accept ?? 'application/json' };
  let body: BodyInit | undefined;
  if (init.body instanceof FormData) {
    body = init.body;
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery(init.query)}`, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: init.signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE);
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

async function request<T>(method: string, path: string, init?: SendInit): Promise<T> {
  const response = await send(method, path, init);
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError(0, 'network_error', NETWORK_MESSAGE);
  }
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, 'bad_response', BAD_RESPONSE_MESSAGE);
  }
}

const get = <T>(path: string, query?: object | null, options?: RequestOptions) =>
  request<T>('GET', path, { query, signal: options?.signal });
const post = <T>(path: string, body?: unknown, options?: RequestOptions & { query?: object }) =>
  request<T>('POST', path, { body: body ?? {}, query: options?.query, signal: options?.signal });
const put = <T>(path: string, body: unknown, query?: object) => request<T>('PUT', path, { body, query });
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, { body });
const del = <T>(path: string) => request<T>('DELETE', path);

/** Escapes one path segment (slugs, tokens, order numbers). */
const seg = (value: string | number) => encodeURIComponent(String(value));

function filesForm(field: string, files: readonly File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append(field, file);
  return form;
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

export interface DownloadedFile {
  blob: Blob;
  filename: string;
}

function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return encoded[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() || null;
}

async function download(path: string, query: object | null, fallbackName: string): Promise<DownloadedFile> {
  const response = await send('GET', path, { query, accept: 'text/csv' });
  const blob = await response.blob();
  return { blob, filename: filenameFrom(response.headers.get('Content-Disposition')) ?? fallbackName };
}

/** Hands a downloaded file to the browser's save dialog. */
export function saveFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Request shapes that docs/API.md describes inline. Each is derived from a type in '@/types/api'.
// ---------------------------------------------------------------------------

export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export interface PageQuery {
  page?: number;
  limit?: number;
}

/** Admin lists all take page, limit and a free-text q. */
export interface ListQuery extends PageQuery {
  q?: string;
}

export interface VehicleScope {
  vehicleId?: number;
}

export type StatsRange = 7 | 30 | 90 | 365;
export type AdminProductStatus = 'active' | 'inactive' | 'low_stock' | 'out_of_stock';

export interface AdminProductQuery extends ListQuery {
  /** A category slug. */
  category?: string;
  status?: AdminProductStatus;
}

export type AdminProductPatch = Partial<Pick<AdminProduct, 'stock' | 'price' | 'mrp' | 'isActive' | 'isFeatured'>>;

export type AdminCategoryInput = Pick<Category, 'name' | 'parentId' | 'blurb' | 'artKind' | 'image' | 'sortOrder' | 'isActive'> & {
  /** Omit to derive from the name. */
  slug?: string;
};

export interface AdminOrderQuery extends ListQuery {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** 'YYYY-MM-DD' */
  from?: string;
  /** 'YYYY-MM-DD' */
  to?: string;
}

export interface OrderExportQuery {
  from?: string;
  to?: string;
}

export interface AdminQuoteQuery extends ListQuery {
  status?: AdminQuote['status'];
}

export interface QuoteSaveOptions {
  /** Skip the margin guard for this save. */
  allowBelowCost?: boolean;
}

export interface AdminReportQuery extends ListQuery {
  status?: AdminReport['status'];
}

export interface AdminQuestionQuery extends ListQuery {
  status?: AdminQuestion['status'];
  kind?: Question['kind'];
}

export interface AdminEnquiryQuery extends ListQuery {
  status?: Enquiry['status'];
  kind?: EnquiryKind;
}

export type AdminEnquiryUpdate = Partial<Pick<Enquiry, 'status' | 'adminNote'>>;

export interface AdminLeadQuery extends ListQuery {
  status?: CheckoutLead['status'];
}

export interface AdminKitQuery extends ListQuery {
  status?: SavedKit['status'];
}

export interface AdminStockAlertQuery extends ListQuery {
  status?: StockAlert['status'];
}

export interface AdminBuildQuery extends ListQuery {
  status?: Build['status'];
}

export interface AdminBookingQuery extends ListQuery {
  /** 'YYYY-MM-DD'. Without from and to the diary lists today (India) onwards. */
  from?: string;
  /** 'YYYY-MM-DD' */
  to?: string;
  status?: BookingStatus;
}

export interface StudioCalendarQuery {
  /** 'YYYY-MM-DD', default today in India. */
  from?: string;
  /** Default 14, at most 62. */
  days?: number;
}

export type AdminBuildUpdate = Partial<Pick<Build, 'status' | 'isHouse' | 'title'>>;

export interface WishlistIds {
  productIds: number[];
}

export interface UploadedUrls {
  urls: string[];
}

/** The server caps `limit` at 60, so longer id lists are fetched in batches. */
const IDS_PER_REQUEST = 60;

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  settings: {
    get: (options?: RequestOptions) => get<PublicSettings>('/settings', null, options),
    health: (options?: RequestOptions) => get<{ ok: true; time: string }>('/health', null, options),
  },

  auth: {
    register: (body: RegisterRequest) => post<AuthResponse>('/auth/register', body),
    login: (body: LoginRequest) => post<AuthResponse>('/auth/login', body),
    logout: () => post<OkResponse>('/auth/logout'),
    /** `{ user: null }` when signed out. Never throws a 401. */
    me: (options?: RequestOptions) => get<MeResponse>('/auth/me', null, options),
    forgotPassword: (body: { email: string }) => post<OkResponse>('/auth/forgot-password', body),
    resetPassword: (body: { token: string; password: string }) => post<OkResponse>('/auth/reset-password', body),
  },

  catalog: {
    categories: (options?: RequestOptions) => get<Category[]>('/categories', null, options),
    vehicles: (options?: RequestOptions) => get<VehicleMake[]>('/vehicles', null, options),
    vehicle: (id: number, options?: RequestOptions) => get<Vehicle>(`/vehicles/${seg(id)}`, null, options),
    suggest: (query: { q: string } & VehicleScope, options?: RequestOptions) =>
      get<SearchSuggestResponse>('/search/suggest', query, options),
    home: (query: VehicleScope = {}, options?: RequestOptions) => get<HomeResponse>('/home', query, options),
    /** The live Friday Five, or null between drops. */
    currentDrop: (query: VehicleScope = {}, options?: RequestOptions) => get<Drop | null>('/drops/current', query, options),
  },

  products: {
    list: (query: ProductQuery = {}, options?: RequestOptions) => get<ProductListResponse>('/products', query, options),
    get: (slug: string, query: VehicleScope = {}, options?: RequestOptions) =>
      get<ProductDetail>(`/products/${seg(slug)}`, query, options),
    /** Exactly these products, in the order asked for. Ids the catalogue no longer has are left out. */
    byIds: async (ids: readonly number[], query: VehicleScope = {}, options?: RequestOptions): Promise<ProductSummary[]> => {
      const wanted = [...new Set(ids)];
      if (wanted.length === 0) return [];
      const batches: number[][] = [];
      for (let i = 0; i < wanted.length; i += IDS_PER_REQUEST) batches.push(wanted.slice(i, i + IDS_PER_REQUEST));
      const pages = await Promise.all(
        batches.map((batch) =>
          get<ProductListResponse>('/products', { ...query, ids: batch.join(','), limit: IDS_PER_REQUEST }, options),
        ),
      );
      const found = new Map(pages.flatMap((page) => page.items).map((product) => [product.id, product]));
      return wanted.flatMap((id) => found.get(id) ?? []);
    },
  },

  reports: {
    list: (slug: string, query: PageQuery = {}, options?: RequestOptions) =>
      get<FittedReportsResponse>(`/products/${seg(slug)}/reports`, query, options),
    create: (slug: string, body: FittedReportInput) =>
      post<{ ok: true; status: 'pending' }>(`/products/${seg(slug)}/reports`, body),
    /** Up to 3 photos (jpg, png, webp; 5 MB each). Put the returned URLs in FittedReportInput.photos. */
    uploadPhotos: (files: readonly File[]) => post<UploadedUrls>('/reports/photos', filesForm('photos', files)),
  },

  questions: {
    list: (slug: string, options?: RequestOptions) => get<Question[]>(`/products/${seg(slug)}/questions`, null, options),
    create: (slug: string, body: QuestionInput) => post<OkResponse>(`/products/${seg(slug)}/questions`, body),
  },

  cart: {
    /** The only source of totals. Stock problems come back per line in `issue`, not as an error. */
    price: (body: PriceCartRequest, options?: RequestOptions) => post<PricedCart>('/cart/price', body, options),
  },

  shipping: {
    estimate: (pincode: string, options?: RequestOptions) => get<ShippingEstimate>('/shipping/estimate', { pincode }, options),
  },

  checkout: {
    lead: (body: CheckoutLeadRequest) => post<CheckoutLeadResponse>('/checkout/lead', body),
  },

  quotes: {
    get: (token: string, options?: RequestOptions) => get<QuoteView>(`/quotes/${seg(token)}`, null, options),
  },

  orders: {
    create: (body: CreateOrderRequest) => post<CreateOrderResponse>('/orders', body),
    track: (query: { orderNumber: string; phone: string }, options?: RequestOptions) => get<Order>('/orders/track', query, options),
    /** `token` is the order's access token, for guests. */
    get: (orderNumber: string, token?: string, options?: RequestOptions) =>
      get<Order>(`/orders/${seg(orderNumber)}`, { token }, options),
    cancel: (orderNumber: string, body: { token?: string; reason?: string } = {}) =>
      post<Order>(`/orders/${seg(orderNumber)}/cancel`, body),
  },

  payments: {
    razorpayVerify: (body: RazorpayVerifyRequest) => post<Order>('/payments/razorpay/verify', body),
    razorpayRetry: (body: { orderNumber: string; token?: string }) => post<PaymentInstruction>('/payments/razorpay/retry', body),
    upiConfirm: (body: UpiConfirmRequest) => post<Order>('/payments/upi/confirm', body),
  },

  account: {
    updateProfile: (body: { name: string; phone: string }) => put<AuthResponse>('/account/profile', body),
    changePassword: (body: { currentPassword: string; newPassword: string }) => put<OkResponse>('/account/password', body),
    orders: (options?: RequestOptions) => get<Order[]>('/account/orders', null, options),
    addresses: {
      list: (options?: RequestOptions) => get<Address[]>('/account/addresses', null, options),
      create: (body: AddressInput) => post<Address>('/account/addresses', body),
      update: (id: number, body: AddressInput) => put<Address>(`/account/addresses/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/account/addresses/${seg(id)}`),
    },
    wishlist: {
      get: (options?: RequestOptions) => get<WishlistIds>('/account/wishlist', null, options),
      /** Replaces the whole list. */
      set: (productIds: number[]) => put<WishlistIds>('/account/wishlist', { productIds }),
    },
    garage: {
      get: (options?: RequestOptions) => get<GarageEntry[]>('/account/garage', null, options),
      /** Replaces the whole list. */
      set: (vehicles: GarageVehicle[]) => put<GarageEntry[]>('/account/garage', { vehicles }),
    },
  },

  studio: {
    /** One day of the diary: every slot with available, reason and places left. */
    slots: (date: string, options?: RequestOptions) => get<StudioDay>('/studio/slots', { date }, options),
    calendar: (query: StudioCalendarQuery = {}, options?: RequestOptions) => get<StudioDay[]>('/studio/calendar', query, options),
    services: (options?: RequestOptions) => get<StudioService[]>('/studio/services', null, options),
    /** 409 slot_unavailable when the slot has just filled, 409 duplicate_booking when this phone already holds it. */
    book: (body: BookingRequest) => post<Booking>('/studio/bookings', body),
    /** The phone must match the booking (last 10 digits), else 404. */
    booking: (bookingNumber: string, phone: string, options?: RequestOptions) =>
      get<Booking>(`/studio/bookings/${seg(bookingNumber)}`, { phone }, options),
  },

  kits: {
    build: (body: KitRequest, options?: RequestOptions) => post<KitResponse>('/kits/build', body, options),
    save: (body: SaveKitRequest) => post<{ token: string }>('/kits/save', body),
  },

  builds: {
    list: (query: PageQuery = {}, options?: RequestOptions) => get<Paginated<Build>>('/builds', query, options),
    get: (slug: string, options?: RequestOptions) => get<Build>(`/builds/${seg(slug)}`, null, options),
    create: (body: SaveBuildRequest) => post<Build>('/builds', body),
  },

  inbound: {
    enquiry: (body: EnquiryInput) => post<EnquiryReceipt>('/enquiries', body),
    stockAlert: (body: StockAlertInput) => post<OkResponse>('/stock-alerts', body),
  },

  admin: {
    stats: (days: StatsRange = 30, options?: RequestOptions) => get<AdminStats>('/admin/stats', { days }, options),
    demand: (days: StatsRange = 30, options?: RequestOptions) => get<DemandReport>('/admin/demand', { days }, options),
    followups: (options?: RequestOptions) => get<FollowUp[]>('/admin/followups', null, options),

    products: {
      list: (query: AdminProductQuery = {}, options?: RequestOptions) =>
        get<Paginated<AdminProduct>>('/admin/products', query, options),
      get: (id: number, options?: RequestOptions) => get<AdminProduct>(`/admin/products/${seg(id)}`, null, options),
      create: (body: AdminProductInput) => post<AdminProduct>('/admin/products', body),
      update: (id: number, body: AdminProductInput) => put<AdminProduct>(`/admin/products/${seg(id)}`, body),
      /** Quick edits from the list: stock, price, MRP, active, featured. */
      patch: (id: number, body: AdminProductPatch) => patch<AdminProduct>(`/admin/products/${seg(id)}`, body),
      /** Deletes when never ordered, otherwise deactivates. */
      remove: (id: number) => del<OkResponse>(`/admin/products/${seg(id)}`),
    },

    uploads: {
      /** Up to 8 images (jpg, png, webp; 8 MB each). Returns /uploads/ URLs. */
      images: (files: readonly File[]) => post<UploadedUrls>('/admin/uploads', filesForm('images', files)),
      /** One MP4 or WebM clip (60 MB at most), stored as is. Returns its /uploads/ URL. */
      video: (file: File) => post<{ url: string }>('/admin/uploads/video', filesForm('video', [file])),
    },

    categories: {
      /** Includes inactive categories. */
      list: (options?: RequestOptions) => get<Category[]>('/admin/categories', null, options),
      create: (body: AdminCategoryInput) => post<Category>('/admin/categories', body),
      update: (id: number, body: AdminCategoryInput) => put<Category>(`/admin/categories/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/admin/categories/${seg(id)}`),
      picks: (id: number, options?: RequestOptions) =>
        get<CategoryPick[]>(`/admin/categories/${seg(id)}/picks`, null, options),
      setPicks: (id: number, body: CategoryPicksInput) => put<CategoryPick[]>(`/admin/categories/${seg(id)}/picks`, body),
    },

    drops: {
      list: (options?: RequestOptions) => get<AdminDrop[]>('/admin/drops', null, options),
      create: (body: DropInput) => post<AdminDrop>('/admin/drops', body),
      update: (id: number, body: DropInput) => put<AdminDrop>(`/admin/drops/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/admin/drops/${seg(id)}`),
    },

    orders: {
      list: (query: AdminOrderQuery = {}, options?: RequestOptions) =>
        get<Paginated<AdminOrderListItem>>('/admin/orders', query, options),
      get: (orderNumber: string, options?: RequestOptions) => get<Order>(`/admin/orders/${seg(orderNumber)}`, null, options),
      update: (orderNumber: string, body: AdminOrderUpdate) => put<Order>(`/admin/orders/${seg(orderNumber)}`, body),
      /** One row per order line with the GST split. Pass the result to saveFile(). */
      exportCsv: (query: OrderExportQuery = {}) => download('/admin/orders/export', query, 'orders.csv'),
    },

    bookings: {
      /** The studio diary, by date then slot. */
      list: (query: AdminBookingQuery = {}, options?: RequestOptions) =>
        get<Paginated<AdminBooking>>('/admin/bookings', query, options),
      get: (bookingNumber: string, options?: RequestOptions) =>
        get<AdminBooking>(`/admin/bookings/${seg(bookingNumber)}`, null, options),
      /** Status, a move to another date or slot (409 slot_unavailable when full), and the studio's note. */
      update: (bookingNumber: string, body: AdminBookingUpdate) =>
        put<AdminBooking>(`/admin/bookings/${seg(bookingNumber)}`, body),
    },

    quotes: {
      list: (query: AdminQuoteQuery = {}, options?: RequestOptions) => get<Paginated<AdminQuote>>('/admin/quotes', query, options),
      /** 400 when a unit price is below cost, unless `allowBelowCost` is set. */
      create: (body: QuoteInput, options: QuoteSaveOptions = {}) => post<AdminQuote>('/admin/quotes', body, { query: options }),
      update: (id: number, body: QuoteInput, options: QuoteSaveOptions = {}) =>
        put<AdminQuote>(`/admin/quotes/${seg(id)}`, body, options),
      /** Cancels the quote. */
      remove: (id: number) => del<OkResponse>(`/admin/quotes/${seg(id)}`),
    },

    coupons: {
      list: (options?: RequestOptions) => get<Coupon[]>('/admin/coupons', null, options),
      create: (body: CouponInput) => post<Coupon>('/admin/coupons', body),
      update: (id: number, body: CouponInput) => put<Coupon>(`/admin/coupons/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/admin/coupons/${seg(id)}`),
    },

    customers: {
      list: (query: ListQuery = {}, options?: RequestOptions) => get<Paginated<AdminCustomer>>('/admin/customers', query, options),
    },

    reports: {
      list: (query: AdminReportQuery = {}, options?: RequestOptions) => get<Paginated<AdminReport>>('/admin/reports', query, options),
      update: (id: number, body: Pick<AdminReport, 'status'>) => put<AdminReport>(`/admin/reports/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/admin/reports/${seg(id)}`),
    },

    questions: {
      /** The Fitment Desk: fitment questions first, most-asked first. */
      list: (query: AdminQuestionQuery = {}, options?: RequestOptions) =>
        get<Paginated<AdminQuestion>>('/admin/questions', query, options),
      answer: (id: number, body: AdminQuestionAnswer) => put<AdminQuestion>(`/admin/questions/${seg(id)}`, body),
      remove: (id: number) => del<OkResponse>(`/admin/questions/${seg(id)}`),
    },

    enquiries: {
      list: (query: AdminEnquiryQuery = {}, options?: RequestOptions) => get<Paginated<Enquiry>>('/admin/enquiries', query, options),
      update: (id: number, body: AdminEnquiryUpdate) => put<Enquiry>(`/admin/enquiries/${seg(id)}`, body),
    },

    leads: {
      list: (query: AdminLeadQuery = {}, options?: RequestOptions) => get<Paginated<CheckoutLead>>('/admin/leads', query, options),
      update: (id: number, body: Pick<CheckoutLead, 'status'>) => put<CheckoutLead>(`/admin/leads/${seg(id)}`, body),
    },

    kits: {
      list: (query: AdminKitQuery = {}, options?: RequestOptions) => get<Paginated<SavedKit>>('/admin/kits', query, options),
      update: (id: number, body: Pick<SavedKit, 'status'>) => put<SavedKit>(`/admin/kits/${seg(id)}`, body),
    },

    stockAlerts: {
      list: (query: AdminStockAlertQuery = {}, options?: RequestOptions) =>
        get<Paginated<StockAlert>>('/admin/stock-alerts', query, options),
      update: (id: number, body: Pick<StockAlert, 'status'>) => put<StockAlert>(`/admin/stock-alerts/${seg(id)}`, body),
    },

    builds: {
      list: (query: AdminBuildQuery = {}, options?: RequestOptions) => get<Paginated<Build>>('/admin/builds', query, options),
      update: (slug: string, body: AdminBuildUpdate) => put<Build>(`/admin/builds/${seg(slug)}`, body),
      remove: (slug: string) => del<OkResponse>(`/admin/builds/${seg(slug)}`),
    },

    settings: {
      get: (options?: RequestOptions) => get<AdminSettings>('/admin/settings', null, options),
      /** Deep-merged on the server: send only what changed. Arrays are replaced whole. */
      update: (body: DeepPartial<AdminSettings>) => put<AdminSettings>('/admin/settings', body),
    },

    demo: {
      /** Deletes every seeded sample row. Returns how many rows went from each table. */
      clear: () => post<{ removed: Record<string, number> }>('/admin/demo/clear'),
    },
  },
};
