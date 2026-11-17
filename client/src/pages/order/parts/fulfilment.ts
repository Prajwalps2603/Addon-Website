/**
 * Words for how an order reaches the customer: delivered by courier, collected from the studio, or
 * fitted at the studio in a booked slot. 'cod' on a studio or pickup order means paying at the studio.
 */
import { longDate, slotLabel } from '@/components/studio';
import { ORDER_PROGRESS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels';
import type { Order, OrderStatus, StudioSlotChoice } from '@/types/api';

export function atStudio(order: Pick<Order, 'fulfilment'>): boolean {
  return order.fulfilment === 'pickup' || order.fulfilment === 'studio';
}

/** 'Cash on delivery', or 'Pay at the studio' for a studio or pickup order. */
export function methodLabel(order: Pick<Order, 'paymentMethod' | 'fulfilment'>): string {
  if (order.paymentMethod === 'cod' && atStudio(order)) return 'Pay at the studio';
  return PAYMENT_METHOD_LABELS[order.paymentMethod];
}

/** 'Wednesday 18 November 2026, 11:30 am'. */
export function slotWords(slot: StudioSlotChoice): string {
  return `${longDate(slot.date)}, ${slotLabel(slot.slot)}`;
}

/** 'Fitted at our studio', 'Collect from our studio' or 'Delivered by courier'. */
export function fulfilmentTitle(order: Pick<Order, 'fulfilment'>): string {
  if (order.fulfilment === 'studio') return 'Fitted at our studio';
  if (order.fulfilment === 'pickup') return 'Collect from our studio';
  return 'Delivered by courier';
}

const STUDIO_PROGRESS: readonly OrderStatus[] = ['placed', 'confirmed', 'packed', 'delivered'];

/** The stops an order of this kind moves through. A studio order has no courier legs. */
export function progressFor(order: Pick<Order, 'fulfilment'>): readonly OrderStatus[] {
  return atStudio(order) ? STUDIO_PROGRESS : ORDER_PROGRESS;
}

/** A status in the words that fit the order: a studio order is 'Fitted', not 'Delivered'. */
export function statusLabel(order: Pick<Order, 'fulfilment'>, status: OrderStatus): string {
  if (order.fulfilment === 'studio') {
    if (status === 'packed') return 'Parts ready';
    if (status === 'delivered') return 'Fitted';
  }
  if (order.fulfilment === 'pickup') {
    if (status === 'packed') return 'Ready to collect';
    if (status === 'delivered') return 'Collected';
  }
  return ORDER_STATUS_LABELS[status];
}
