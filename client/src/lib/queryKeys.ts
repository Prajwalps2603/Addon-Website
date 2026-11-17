/**
 * One key factory per resource, so every page reads and invalidates the same cache entries.
 * Keys nest: invalidating `queryKeys.products.all()` refreshes every product list and detail.
 */
import type {
  AdminBookingQuery,
  AdminBuildQuery,
  AdminEnquiryQuery,
  AdminKitQuery,
  AdminLeadQuery,
  AdminOrderQuery,
  AdminProductQuery,
  AdminQuestionQuery,
  AdminQuoteQuery,
  AdminReportQuery,
  AdminStockAlertQuery,
  ListQuery,
  PageQuery,
  StudioCalendarQuery,
} from '@/lib/api';
import type { KitRequest, PriceCartRequest, ProductQuery } from '@/types/api';

type VehicleId = number | null | undefined;

function adminList<Q extends object>(name: string) {
  return {
    all: () => ['admin', name] as const,
    list: (query?: Q) => ['admin', name, 'list', query ?? {}] as const,
  };
}

export const queryKeys = {
  settings: () => ['settings'] as const,
  me: () => ['me'] as const,
  categories: () => ['categories'] as const,

  vehicles: {
    all: () => ['vehicles'] as const,
    tree: () => ['vehicles', 'tree'] as const,
    detail: (id: number) => ['vehicles', 'detail', id] as const,
  },

  products: {
    all: () => ['products'] as const,
    list: (query: ProductQuery = {}) => ['products', 'list', query] as const,
    detail: (slug: string, vehicleId?: VehicleId) => ['products', 'detail', slug, vehicleId ?? null] as const,
    byIds: (ids: readonly number[], vehicleId?: VehicleId) => ['products', 'ids', [...ids], vehicleId ?? null] as const,
    suggest: (q: string, vehicleId?: VehicleId) => ['products', 'suggest', q, vehicleId ?? null] as const,
  },

  reports: {
    all: (slug: string) => ['reports', slug] as const,
    list: (slug: string, query: PageQuery = {}) => ['reports', slug, query] as const,
  },
  questions: (slug: string) => ['questions', slug] as const,

  home: (vehicleId?: VehicleId) => ['home', vehicleId ?? null] as const,
  drop: (vehicleId?: VehicleId) => ['drop', vehicleId ?? null] as const,

  cart: {
    all: () => ['cart'] as const,
    price: (request: PriceCartRequest) => ['cart', 'price', request] as const,
  },
  shipping: (pincode: string) => ['shipping', pincode] as const,
  quote: (token: string) => ['quote', token] as const,

  orders: {
    all: () => ['orders'] as const,
    detail: (orderNumber: string, token?: string | null) => ['orders', 'detail', orderNumber, token ?? null] as const,
    track: (orderNumber: string, phone: string) => ['orders', 'track', orderNumber, phone] as const,
  },

  account: {
    all: () => ['account'] as const,
    orders: () => ['account', 'orders'] as const,
    addresses: () => ['account', 'addresses'] as const,
    wishlist: () => ['account', 'wishlist'] as const,
    garage: () => ['account', 'garage'] as const,
  },

  studio: {
    all: () => ['studio'] as const,
    /** Every slot and calendar read: invalidate after a booking or a slot_unavailable answer. */
    diary: () => ['studio', 'diary'] as const,
    slots: (date: string) => ['studio', 'diary', 'slots', date] as const,
    calendar: (query: StudioCalendarQuery = {}) => ['studio', 'diary', 'calendar', query] as const,
    services: () => ['studio', 'services'] as const,
    booking: (bookingNumber: string, phone: string) => ['studio', 'booking', bookingNumber, phone] as const,
  },

  kits: (request: KitRequest) => ['kits', request] as const,

  builds: {
    all: () => ['builds'] as const,
    list: (query: PageQuery = {}) => ['builds', 'list', query] as const,
    detail: (slug: string) => ['builds', 'detail', slug] as const,
  },

  admin: {
    all: () => ['admin'] as const,
    stats: (days: number) => ['admin', 'stats', days] as const,
    demand: (days: number) => ['admin', 'demand', days] as const,
    followups: () => ['admin', 'followups'] as const,
    products: {
      ...adminList<AdminProductQuery>('products'),
      detail: (id: number) => ['admin', 'products', 'detail', id] as const,
    },
    categories: {
      all: () => ['admin', 'categories'] as const,
      list: () => ['admin', 'categories', 'list'] as const,
      picks: (id: number) => ['admin', 'categories', 'picks', id] as const,
    },
    drops: () => ['admin', 'drops'] as const,
    orders: {
      ...adminList<AdminOrderQuery>('orders'),
      detail: (orderNumber: string) => ['admin', 'orders', 'detail', orderNumber] as const,
    },
    bookings: {
      ...adminList<AdminBookingQuery>('bookings'),
      detail: (bookingNumber: string) => ['admin', 'bookings', 'detail', bookingNumber] as const,
    },
    quotes: adminList<AdminQuoteQuery>('quotes'),
    coupons: () => ['admin', 'coupons'] as const,
    customers: adminList<ListQuery>('customers'),
    reports: adminList<AdminReportQuery>('reports'),
    questions: adminList<AdminQuestionQuery>('questions'),
    enquiries: adminList<AdminEnquiryQuery>('enquiries'),
    leads: adminList<AdminLeadQuery>('leads'),
    kits: adminList<AdminKitQuery>('kits'),
    stockAlerts: adminList<AdminStockAlertQuery>('stock-alerts'),
    builds: adminList<AdminBuildQuery>('builds'),
    settings: () => ['admin', 'settings'] as const,
  },
};
