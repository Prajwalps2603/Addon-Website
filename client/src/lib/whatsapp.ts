/**
 * WhatsApp links and the messages that go in them. Every builder returns plain text;
 * wrap it with waLink(settings.whatsapp, text) to message the store, or waShareLink(text)
 * to let the shopper pick their own contact. waLink returns '' when there is no number:
 * hide the control in that case.
 */
import { cartShareUrl } from '@/lib/cartLink';
import { formatINR } from '@/lib/format';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { siteUrl } from '@/lib/urls';
import type { CartLineInput, Order, PricedCart, ProductSummary, Vehicle } from '@/types/api';

/** Digits with the country code, as wa.me wants them. Ten-digit Indian numbers get 91. '' when unusable. */
export function waNumber(phone: string | null | undefined): string {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

/** https://wa.me/<number>?text=... or '' when the number is blank or unusable. */
export function waLink(phone: string | null | undefined, text = ''): string {
  const number = waNumber(phone);
  if (!number) return '';
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Opens WhatsApp with the text ready and lets the sender choose who gets it. */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function lines(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string').join('\n');
}

export interface AskAboutProductInput {
  product: Pick<ProductSummary, 'name' | 'slug'> & { sku?: string };
  variantName?: string;
  /** The shopper's active car, so the shop can answer for it. */
  vehicle?: Pick<Vehicle, 'label'> | null;
}

/** "Ask about this part": product, SKU, the shopper's car and the link, ready to send to the store. */
export function askAboutProduct({ product, variantName, vehicle }: AskAboutProductInput): string {
  return lines(
    'Hi, I have a question about this part.',
    '',
    variantName ? `${product.name} (${variantName})` : product.name,
    product.sku ? `SKU: ${product.sku}` : null,
    vehicle ? `My car: ${vehicle.label}` : null,
    siteUrl(`/p/${product.slug}`),
  );
}

export interface ShareProductInput {
  product: Pick<ProductSummary, 'name' | 'slug' | 'price'>;
  vehicle?: Pick<Vehicle, 'model'> | null;
}

/** "Ask the gang" for one product. */
export function shareProduct({ product, vehicle }: ShareProductInput): string {
  return lines(
    vehicle ? `What do you think of this for my ${vehicle.model}?` : 'What do you think of this?',
    `${product.name}, ${formatINR(product.price)}`,
    siteUrl(`/p/${product.slug}`),
  );
}

/** "Ask the gang" for a comparison. The link opens /compare with the same products (`ids` query). */
export function shareCompare(products: readonly Pick<ProductSummary, 'id' | 'name' | 'price'>[]): string {
  return lines(
    'Help me pick one:',
    ...products.map((product, index) => `${index + 1}. ${product.name}, ${formatINR(product.price)}`),
    siteUrl(`/compare?ids=${products.map((product) => product.id).join(',')}`),
  );
}

export interface ShareCartInput {
  lines: readonly CartLineInput[];
  /** The priced cart, when it has loaded: adds item names and the total to the message. */
  cart?: PricedCart | null;
  couponCode?: string;
}

/** "Send cart to payer": the items, the total and a link that opens the same cart on another phone. */
export function shareCart({ lines: cartLines, cart, couponCode }: ShareCartInput): string {
  const items = (cart?.lines ?? []).map(
    (line) => `${line.qty} x ${line.name}${line.variantName ? ` (${line.variantName})` : ''}`,
  );
  return lines(
    'Could you pay for this cart for me?',
    items.length > 0 && '',
    ...items,
    cart ? `Total: ${formatINR(cart.total)}` : null,
    '',
    `Open the cart: ${cartShareUrl(cartLines, { couponCode })}`,
  );
}

/** An order in a few lines, for a message to or from the store. The link opens /track with the number filled in. */
export function orderSummary(order: Order): string {
  return lines(
    `Order ${order.orderNumber}`,
    `Status: ${ORDER_STATUS_LABELS[order.status]}`,
    ...order.items.map((item) => `${item.qty} x ${item.name}${item.variantName ? ` (${item.variantName})` : ''}`),
    `Total: ${formatINR(order.total)}`,
    `Payment: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
    order.amountDue > 0 && order.amountDue < order.total ? `Still to pay: ${formatINR(order.amountDue)}` : null,
    siteUrl(`/track?orderNumber=${encodeURIComponent(order.orderNumber)}`),
  );
}
