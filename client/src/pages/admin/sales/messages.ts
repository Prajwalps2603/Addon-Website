/**
 * WhatsApp messages the shop sends a customer about an order, one for each step.
 * Plain text, short lines, no emoji. The owner can edit before sending.
 */
import { longDate, slotLabel } from '@/components/studio';
import { formatDateRange, formatINR } from '@/lib/format';
import { siteUrl } from '@/lib/urls';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import type { AdminQuote, Order } from '@/types/api';

function join(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string').join('\n');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** Absolute URL for a site path or an uploaded file. */
export function absoluteUrl(path: string): string {
  if (!path) return '';
  return /^https?:\/\//i.test(path) ? path : siteUrl(path);
}

function itemsLine(order: Order): string {
  return order.items.map((item) => `${item.qty} x ${item.name}${item.variantName ? ` (${item.variantName})` : ''}`).join('\n');
}

export interface OrderMessageContext {
  storeName: string;
  /** Working days before dispatch, from settings. */
  dispatchDays?: number;
  /** The studio address and map link, for orders collected or fitted there. */
  studio?: { address: string; mapUrl: string };
}

function studioWhere(studio: OrderMessageContext['studio']): string | null {
  if (!studio) return null;
  const address = studio.address.trim().replace(/\s*\n\s*/g, ', ');
  const parts = [address ? `Studio: ${address}` : null, studio.mapUrl ? `Map: ${studio.mapUrl}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : null;
}

/** The message for an order the customer collects or has fitted at the studio, or null to use the delivery wording. */
function studioOrderMessage(order: Order, hello: string, sign: string, context: OrderMessageContext): string | null {
  if (order.fulfilment === 'delivery') return null;
  const fitting = order.fulfilment === 'studio';
  const slot = order.studioSlot ? `${longDate(order.studioSlot.date)} at ${slotLabel(order.studioSlot.slot)}` : null;
  const pay = order.amountDue > 0 ? `To pay at the studio: ${formatINR(order.amountDue)}` : null;
  const where = studioWhere(context.studio);
  switch (order.status) {
    case 'placed':
    case 'confirmed':
      return join(
        hello,
        order.status === 'confirmed' ? `Your order ${order.orderNumber} is confirmed.` : `Thank you for order ${order.orderNumber}.`,
        itemsLine(order),
        fitting ? (slot ? `Please bring your car to the studio on ${slot}. We fit the parts there.` : 'We will fix a time to fit the parts at the studio.') : 'We will tell you when it is ready to collect from the studio.',
        pay,
        where,
        order.status === 'placed' ? 'Please reply YES to confirm.' : 'Reply here if you need another time.',
        sign,
      );
    case 'packed':
    case 'shipped':
    case 'out_for_delivery':
      return join(
        hello,
        fitting ? `The parts for order ${order.orderNumber} are ready for your fitting${slot ? ` on ${slot}` : ''}.` : `Your order ${order.orderNumber} is ready to collect from the studio.`,
        pay,
        where,
        sign,
      );
    case 'delivered': {
      const first = order.items.find((item) => item.slug);
      return join(
        hello,
        fitting ? `Thank you for bringing your car in. Order ${order.orderNumber} is fitted.` : `Thank you for collecting order ${order.orderNumber}.`,
        'Could you file a short fitted report? It takes about a minute and tells the next buyer how the part went on your car.',
        first ? absoluteUrl(`/p/${first.slug}`) : null,
        `Use order number ${order.orderNumber} and this phone number.`,
        sign,
      );
    }
    default:
      return null;
  }
}

/** The message that fits where the order is now. */
export function orderMessage(order: Order, context: OrderMessageContext): string {
  const { storeName, dispatchDays } = context;
  const hello = `Hello ${firstName(order.customerName) || 'there'},`;
  const sign = storeName ? `${storeName}` : '';
  const atStudio = studioOrderMessage(order, hello, sign, context);
  if (atStudio !== null) return atStudio;
  const track = siteUrl(`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`);
  const due = order.amountDue > 0 ? `Amount to pay on delivery: ${formatINR(order.amountDue)}` : null;

  switch (order.status) {
    case 'pending_payment':
      return join(
        hello,
        `Your order ${order.orderNumber} for ${formatINR(order.total)} is waiting for payment.`,
        itemsLine(order),
        'If the payment did not go through, you can try again from the order page:',
        track,
        sign,
      );
    case 'placed':
      if (order.paymentMethod === 'cod') {
        return join(
          hello,
          `Thank you for order ${order.orderNumber}.`,
          itemsLine(order),
          `Total ${formatINR(order.total)}, cash on delivery.`,
          'Please reply YES to confirm, and we will pack it.',
          sign,
        );
      }
      return join(hello, `We have your order ${order.orderNumber}.`, itemsLine(order), 'We will confirm it shortly.', track, sign);
    case 'confirmed':
      return join(
        hello,
        `Your order ${order.orderNumber} is confirmed.`,
        dispatchDays ? `We pack and dispatch it within ${dispatchDays} working ${dispatchDays === 1 ? 'day' : 'days'}.` : 'We are packing it next.',
        `Payment: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}.`,
        due,
        track,
        sign,
      );
    case 'packed':
      return join(
        hello,
        `Your order ${order.orderNumber} is packed.`,
        order.packPhoto ? `Photo of your parts before we sealed the box: ${absoluteUrl(order.packPhoto)}` : null,
        'We will send the tracking number once the courier collects it.',
        sign,
      );
    case 'shipped':
    case 'out_for_delivery': {
      const out = order.status === 'out_for_delivery';
      return join(
        hello,
        out ? `Your order ${order.orderNumber} is out for delivery today.` : `Your order ${order.orderNumber} has shipped.`,
        order.tracking.carrier ? `Courier: ${order.tracking.carrier}` : null,
        order.tracking.number ? `Tracking number: ${order.tracking.number}` : null,
        order.tracking.url ? `Track it: ${order.tracking.url}` : null,
        !out && order.estimatedDelivery ? `Expected ${formatDateRange(order.estimatedDelivery.earliest, order.estimatedDelivery.latest)}.` : null,
        due,
        sign,
      );
    }
    case 'delivered': {
      const first = order.items.find((item) => item.slug);
      return join(
        hello,
        `Your order ${order.orderNumber} was delivered.`,
        'Once it is fitted, could you file a short fitted report? It takes about a minute and tells the next buyer how the fitting went on your car.',
        first ? absoluteUrl(`/p/${first.slug}`) : null,
        `Use order number ${order.orderNumber} and this phone number.`,
        sign,
      );
    }
    case 'cancelled':
      return join(
        hello,
        `Your order ${order.orderNumber} has been cancelled.`,
        order.amountPaid > 0 ? `The ${formatINR(order.amountPaid)} you paid will be refunded to the same payment method.` : null,
        'Reply here if you have any questions.',
        sign,
      );
    case 'returned':
      return join(
        hello,
        `We have received the return for order ${order.orderNumber}.`,
        order.amountPaid > 0 ? 'Your refund goes to the same payment method.' : null,
        sign,
      );
  }
}

/** The quote link, ready to send. */
export function quoteMessage(quote: Pick<AdminQuote, 'customerName' | 'token' | 'total' | 'validUntil'>, storeName: string, validLabel: string): string {
  return join(
    `Hello ${firstName(quote.customerName) || 'there'},`,
    `Here is the price we discussed: ${formatINR(quote.total)}.`,
    'Open this link to see the parts and pay:',
    quoteUrl(quote.token),
    `The price holds until ${validLabel}.`,
    storeName || null,
  );
}

export function quoteUrl(token: string): string {
  return siteUrl(`/quote/${encodeURIComponent(token)}`);
}
