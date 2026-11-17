/**
 * The admin map: every admin page, grouped the way the owner works through a day.
 * Used by the side rail, the menu drawer, the bottom bar and the mobile top bar title.
 */
import {
  Boxes,
  CalendarClock,
  CarFront,
  ClipboardCheck,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  ListChecks,
  PackageOpen,
  Radar,
  Settings,
  Ticket,
  UserRoundPlus,
  Users,
  BellRing,
  CalendarCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AdminStats } from '@/types/api';

/** Where a link's pending number comes from. 'studioToday' is today's cars still to handle in the studio diary. */
export type CountSource = keyof AdminStats['openCounts'] | 'pendingOrders' | 'studioToday';

/** The numbers beside the links, gathered once by the shell. */
export type NavCounts = Partial<Record<CountSource, number>>;

/** Every count the nav shows, from the shared stats and today's studio diary. */
export function navCounts(stats: AdminStats | undefined, studioToday: number | undefined): NavCounts {
  return { ...(stats?.openCounts ?? {}), pendingOrders: stats?.pendingOrders, studioToday };
}

export interface AdminNavItem {
  to: string;
  label: string;
  /** Short name for the bottom bar. */
  short?: string;
  icon: LucideIcon;
  count?: CountSource;
  /** Matches only the exact path (the dashboard). */
  end?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: readonly AdminNavGroup[] = [
  {
    label: 'Today',
    items: [
      { to: '/admin', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/followups', label: 'Follow-ups', short: 'Follow-ups', icon: ListChecks, count: 'followUps' },
    ],
  },
  {
    label: 'Sell',
    items: [
      { to: '/admin/orders', label: 'Orders', short: 'Orders', icon: PackageOpen, count: 'pendingOrders' },
      { to: '/admin/bookings', label: 'Bookings', short: 'Bookings', icon: CalendarCheck, count: 'studioToday' },
      { to: '/admin/quotes', label: 'Quotes', icon: FileText },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin/products', label: 'Products', short: 'Products', icon: Boxes },
      { to: '/admin/categories', label: 'Categories and picks', icon: FolderTree },
      { to: '/admin/drops', label: 'Friday Five', icon: CalendarClock },
    ],
  },
  {
    label: 'Desk',
    items: [
      { to: '/admin/fitment-desk', label: 'Fitment Desk', icon: Wrench, count: 'questions' },
      { to: '/admin/reports', label: 'Fitted reports', icon: ClipboardCheck, count: 'reports' },
      { to: '/admin/enquiries', label: 'Enquiries', icon: Inbox, count: 'enquiries' },
      { to: '/admin/leads', label: 'Leads', icon: UserRoundPlus, count: 'leads' },
      { to: '/admin/stock-alerts', label: 'Stock alerts', icon: BellRing, count: 'stockAlerts' },
    ],
  },
  {
    label: 'Insight',
    items: [{ to: '/admin/demand', label: 'Demand radar', icon: Radar }],
  },
  {
    label: 'Setup',
    items: [
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

/** The five slots of the phone bottom bar, most used first. */
export const BOTTOM_BAR: readonly AdminNavItem[] = ['/admin', '/admin/followups', '/admin/orders', '/admin/bookings', '/admin/products'].map(
  (to) => ALL_ITEMS.find((item) => item.to === to) as AdminNavItem,
);

/** The nav item a path belongs to: the longest matching prefix. */
export function navItemFor(pathname: string): AdminNavItem | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best: AdminNavItem | undefined;
  for (const item of ALL_ITEMS) {
    const hit = item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`);
    if (hit && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}

/** The number to show beside a link, or 0. */
export function countFor(counts: NavCounts | undefined, source: CountSource | undefined): number {
  if (!counts || !source) return 0;
  return counts[source] ?? 0;
}

/** What the number means, for screen readers. */
export function countWords(source: CountSource | undefined): string {
  return source === 'studioToday' ? 'today' : 'waiting';
}
