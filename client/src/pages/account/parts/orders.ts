import type { BadgeTone } from '@/components/ui';
import { readJSON, writeJSON } from '@/lib/storage';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import { formatDate, formatTime } from '@/lib/format';
import type { Order, OrderStatus, StudioSlotChoice } from '@/types/api';

/**
 * Order number → access token, the same key and shape checkout writes
 * (pages/checkout/parts/orderTokens.ts), so the order page can open any order listed here.
 */
const ORDER_TOKENS_KEY = 'addon-order-tokens';
const MAX_TOKENS = 30;

function readTokens(): Record<string, string> {
  const stored = readJSON<unknown>(ORDER_TOKENS_KEY, {});
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  const tokens: Record<string, string> = {};
  for (const [orderNumber, token] of Object.entries(stored)) {
    if (typeof token === 'string' && token) tokens[orderNumber] = token;
  }
  return tokens;
}

/**
 * Remembers the access token of each order (newest kept last, as checkout does). Writes only
 * when something is new, and keeps the list to the most recent 30.
 */
export function rememberOrderTokens(orders: readonly Order[]): void {
  const tokens = readTokens();
  let changed = false;
  // Oldest first, so the newest orders end up last and survive the trim.
  for (const order of [...orders].reverse()) {
    if (!order.accessToken || tokens[order.orderNumber] === order.accessToken) continue;
    delete tokens[order.orderNumber];
    tokens[order.orderNumber] = order.accessToken;
    changed = true;
  }
  if (!changed) return;
  const entries = Object.entries(tokens);
  writeJSON(ORDER_TOKENS_KEY, Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_TOKENS))));
}

/**
 * The order page for an order this account owns. The owner may open it signed in; the token kept by
 * rememberOrderTokens lets it open on this device after signing out too, without putting it in the address bar.
 */
export function orderHref(order: Order): string {
  return `/order/${encodeURIComponent(order.orderNumber)}`;
}

const STATUS_TONES: Record<OrderStatus, BadgeTone> = {
  pending_payment: 'warn',
  placed: 'neutral',
  confirmed: 'neutral',
  packed: 'neutral',
  shipped: 'info',
  out_for_delivery: 'info',
  delivered: 'fit',
  cancelled: 'neutral',
  returned: 'neutral',
};

export function statusTone(status: OrderStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

/** How the money stands, in the shopper's words. Cash on delivery is not "pending": it is the plan. */
export function paymentWords(order: Order): { text: string; tone: 'muted' | 'warn' | 'stop' | 'fit' } {
  if (order.status === 'cancelled' && order.paymentStatus !== 'refunded') {
    return { text: order.amountPaid > 0 ? 'Refund due' : 'Nothing charged', tone: 'muted' };
  }
  if (order.paymentStatus === 'failed') return { text: PAYMENT_STATUS_LABELS.failed, tone: 'stop' };
  if (order.paymentStatus === 'paid') return { text: 'Paid', tone: 'fit' };
  if (order.paymentStatus === 'refunded') return { text: PAYMENT_STATUS_LABELS.refunded, tone: 'muted' };
  if (order.paymentMethod === 'cod') {
    // For pickup and studio orders 'cod' is paying at the studio: no courier, no advance.
    if (order.fulfilment !== 'delivery') return { text: 'Pay at the studio', tone: 'muted' };
    return { text: order.paymentStatus === 'advance_paid' ? 'Advance paid, rest on delivery' : 'Cash on delivery', tone: 'muted' };
  }
  if (order.paymentMethod === 'upi' && order.upiReference) return { text: 'UPI payment being checked', tone: 'muted' };
  return { text: PAYMENT_STATUS_LABELS[order.paymentStatus], tone: 'warn' };
}

export const PAYMENT_TONE_CLASS = { muted: 'text-muted', warn: 'text-warn', stop: 'text-stop', fit: 'text-fit' } as const;

/** The instant a studio slot starts: the date and time are India time. */
export function slotInstant(choice: StudioSlotChoice): string {
  return `${choice.date}T${choice.slot}:00+05:30`;
}

/** 'Tue, 18 Nov 2026, 11:30 am' */
export function slotWords(choice: StudioSlotChoice): string {
  return `${formatDate(choice.date, { weekday: true })}, ${formatTime(slotInstant(choice))}`;
}

/** How the order reaches the shopper, in a few words; '' for a plain delivery. */
export function fulfilmentWords(order: Order): string {
  if (order.fulfilment === 'studio') return order.studioSlot ? `Fitting at the studio, ${slotWords(order.studioSlot)}` : 'Fitting at the studio';
  if (order.fulfilment === 'pickup') return 'Collect at the studio';
  return '';
}

const FITTING_DONE: readonly OrderStatus[] = ['delivered', 'cancelled', 'returned'];

/**
 * Studio orders whose fitting slot is still ahead (or under way: a slot counts until three hours after it starts),
 * soonest first. These are the signed-in shopper's own studio bookings: GET /account/orders carries the slot.
 */
export function upcomingFittings(orders: readonly Order[], now = Date.now()): Order[] {
  return orders
    .filter((order) => {
      if (order.fulfilment !== 'studio' || !order.studioSlot || FITTING_DONE.includes(order.status)) return false;
      const start = Date.parse(slotInstant(order.studioSlot));
      return Number.isFinite(start) && start + 3 * 60 * 60_000 > now;
    })
    .sort((a, b) => Date.parse(slotInstant(a.studioSlot!)) - Date.parse(slotInstant(b.studioSlot!)));
}
