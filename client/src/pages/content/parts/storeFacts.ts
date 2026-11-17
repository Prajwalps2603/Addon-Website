import type { PublicSettings } from '@/types/api';
import { formatINR } from '@/lib/format';
import { formatPhone } from '@/lib/india';

/** Trimmed text, or '' for anything blank. Settings use '' to mean "not set". */
export function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** The name the business trades under on legal pages: the legal name when set, else the store name. */
export function businessName(settings: PublicSettings): string {
  return clean(settings.legalName) || clean(settings.storeName) || 'Addon Automotive';
}

/** The postal address as lines, leaving out anything blank. Empty when no address is set. */
export function addressLines(settings: PublicSettings): string[] {
  const { line1, line2, city, state, pincode } = settings.address;
  const place = [clean(city), [clean(state), clean(pincode)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [clean(line1), clean(line2), place].filter(Boolean);
}

/** A phone number as people read it ('98765 43210'), and the tel: link for it. */
export function phoneParts(phone: string): { label: string; href: string } | null {
  const value = clean(phone);
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, '');
  return { label: formatPhone(value), href: `tel:${digits.startsWith('+') ? digits : digits.length === 10 ? `+91${digits}` : digits}` };
}

/** "₹49" or "free" for a fee that can be zero. */
export function feeLabel(amount: number): string {
  return amount > 0 ? formatINR(amount) : 'free';
}

/** Payment methods the store has switched on, in the words the checkout uses. */
export function paymentMethods(settings: PublicSettings): string[] {
  const methods: string[] = [];
  if (settings.payments.upi && clean(settings.payments.upiId)) methods.push('UPI transfer straight to the shop');
  if (settings.payments.razorpay) methods.push('Razorpay (cards, UPI, net banking and wallets)');
  if (settings.cod.enabled) methods.push('cash on delivery');
  return methods;
}

/** Plain English list: "a, b and c". */
export function listJoin(items: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/** "1 working day", "2 working days". */
export function workingDays(count: number): string {
  return `${count} working ${count === 1 ? 'day' : 'days'}`;
}

/** The COD rules in one sentence, or null when COD is off. */
export function codSentence(settings: PublicSettings): string | null {
  const { cod } = settings;
  if (!cod.enabled) return null;
  const parts: string[] = [];
  parts.push(cod.fee > 0 ? `Cash on delivery costs ${formatINR(cod.fee)} extra, shown beside the option before you pay` : 'Cash on delivery has no extra fee');
  if (cod.minOrder > 0 && cod.maxOrder > 0) parts.push(`it is open to orders from ${formatINR(cod.minOrder)} to ${formatINR(cod.maxOrder)}`);
  else if (cod.minOrder > 0) parts.push(`it is open to orders of ${formatINR(cod.minOrder)} or more`);
  else if (cod.maxOrder > 0) parts.push(`it is open to orders up to ${formatINR(cod.maxOrder)}`);
  return `${parts.join(', and ')}.`;
}

/** Delivery fee rule in one sentence. */
export function deliveryFeeSentence(settings: PublicSettings): string {
  const { flatFee, freeShippingThreshold } = settings.shipping;
  if (flatFee <= 0) return 'Delivery is free on every order.';
  if (freeShippingThreshold <= 0) return `Delivery costs a flat ${formatINR(flatFee)}.`;
  return `Delivery is free on orders of ${formatINR(freeShippingThreshold)} or more. Below that it costs a flat ${formatINR(flatFee)}.`;
}

/** Bulky and freight surcharges in one sentence, or null when neither applies. */
export function surchargeSentence(settings: PublicSettings): string | null {
  const { bulkySurcharge, freightSurcharge } = settings.shipping;
  const parts: string[] = [];
  if (bulkySurcharge > 0) parts.push(`${formatINR(bulkySurcharge)} once per order for bulky parts such as spoilers, subwoofers and floor mats`);
  if (freightSurcharge > 0) parts.push(`${formatINR(freightSurcharge)} once per order for parts that travel by freight, such as alloy wheels, body kits and roof racks`);
  if (parts.length === 0) return null;
  return `Large items add a handling charge, even above the free-delivery amount: ${parts.join('; ')}. The product page says which class a part is in, and the cart shows the charge before you pay.`;
}
