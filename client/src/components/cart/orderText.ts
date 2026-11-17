import { cartShareUrl } from '@/lib/cartLink';
import { formatINR } from '@/lib/format';
import type { CartLineInput, PricedCart, Vehicle } from '@/types/api';

export interface WhatsAppOrderInput {
  cart: PricedCart;
  lines: readonly CartLineInput[];
  couponCode?: string;
  pincode?: string;
  vehicle?: Pick<Vehicle, 'label'> | null;
}

/** "Order on WhatsApp": the cart as a message to the store, with a link that opens the same cart. */
export function whatsAppOrder({ cart, lines, couponCode, pincode, vehicle }: WhatsAppOrderInput): string {
  const items = cart.lines
    .filter((line) => line.issue === null || line.issue === 'insufficient_stock')
    .map((line) => {
      const fitted = line.fitAtStudio ? `, fitted at your studio${line.fittingCharge > 0 ? ` (+${formatINR(line.fittingCharge)})` : ''}` : '';
      return `${line.qty} x ${line.name}${line.variantName ? ` (${line.variantName})` : ''}, ${formatINR(line.lineTotal)}${fitted}`;
    });
  const parts: string[] = [
    cart.fulfilment === 'studio' ? 'Hi, I would like to order these parts and have them fitted at your studio.' : 'Hi, I would like to order these parts.',
    '',
    ...items,
    '',
    `Items: ${formatINR(cart.subtotal)}`,
  ];
  if (cart.coupon) parts.push(`Coupon ${cart.coupon.code}: -${formatINR(cart.coupon.discount)}`);
  if (cart.fittingTotal > 0) parts.push(`Studio fitting: ${formatINR(cart.fittingTotal)}`);
  if (cart.fulfilment === 'delivery') {
    parts.push(`Delivery: ${cart.shippingFee > 0 ? formatINR(cart.shippingFee) : 'Free'}`);
    if (pincode) parts.push(`Delivery PIN code: ${pincode}`);
  } else {
    parts.push(cart.fulfilment === 'studio' ? 'Please suggest a day and time for the fitting.' : 'I will collect from the studio.');
  }
  if (vehicle) parts.push(`My car: ${vehicle.label}`);
  parts.push('', `Cart: ${cartShareUrl(lines, { couponCode })}`);
  return parts.join('\n');
}
