/**
 * The WhatsApp messages the desk sends to customers. Plain text, short, in the shop's voice.
 * Each returns the text only: wrap it with useCustomerWa() / <CustomerWhatsApp>.
 */
import { cartShareUrl } from '@/lib/cartLink';
import { formatDate, formatINR } from '@/lib/format';
import { siteUrl } from '@/lib/urls';
import type { AdminQuestion, CheckoutLead, Enquiry, SavedKit, StockAlert } from '@/types/api';

type FitType = NonNullable<AdminQuestion['answerFitType']>;

const lines = (...parts: (string | false | null | undefined)[]) =>
  parts.filter((part): part is string => typeof part === 'string').join('\n');

const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

/** The reply to a shopper who asked whether a part fits their car. */
export function fitmentReply(
  question: Pick<AdminQuestion, 'authorName' | 'productName' | 'productSlug' | 'vehicleLabel'>,
  fitType: FitType,
  note: string,
  storeName: string,
): string {
  const car = question.vehicleLabel || 'your car';
  const verdict =
    fitType === 'direct'
      ? `Yes, it fits your ${car}.`
      : fitType === 'with_work'
        ? `It fits your ${car}, with some work.`
        : `No, it does not fit your ${car}.`;
  const extra = note.trim();
  return lines(
    `Hi ${firstName(question.authorName)}, this is ${storeName}. You asked whether ${question.productName} fits your ${car}.`,
    '',
    verdict,
    extra && extra !== verdict ? extra : null,
    '',
    siteUrl(`/p/${question.productSlug}`),
  );
}

/** A reply to a general product question that was just published. */
export function questionReply(question: Pick<AdminQuestion, 'authorName' | 'productName' | 'productSlug'>, answer: string, storeName: string): string {
  return lines(
    `Hi ${firstName(question.authorName)}, this is ${storeName} about your question on ${question.productName}.`,
    '',
    answer.trim(),
    '',
    siteUrl(`/p/${question.productSlug}`),
  );
}

/** A reminder about a checkout that was not finished, with a link that opens the same cart. */
export function leadReminder(lead: CheckoutLead, storeName: string): string {
  const cartLines = lead.cart.map((line) => ({ productId: line.productId, variantId: line.variantId, qty: line.qty, custom: line.custom ?? null }));
  const items = lead.cart.map((line) => `${line.qty} x ${line.name}${line.variantName ? ` (${line.variantName})` : ''}`);
  return lines(
    `Hi ${firstName(lead.name)}, this is ${storeName}. Your order was not completed, so these are still in your cart:`,
    '',
    ...items,
    lead.cartTotal > 0 ? `Total: ${formatINR(lead.cartTotal)}` : null,
    '',
    `Open your cart: ${cartShareUrl(cartLines)}`,
    '',
    'If something stopped you (fit, delivery, payment), reply here and we will sort it out.',
  );
}

export const KIT_GOAL_LABELS: Record<string, string> = {
  new_car: 'New car',
  sporty: 'Sporty',
  comfort: 'Comfort',
  sound: 'Sound',
  night: 'Night driving',
  offroad: 'Off-road',
  protection: 'Protection',
};

export const kitGoalLabel = (goal: string) => KIT_GOAL_LABELS[goal] ?? goal.replace(/_/g, ' ');

/** A follow-up on a saved kit, with a link that opens the kit's parts as a cart. */
export function kitFollowUp(kit: SavedKit, partNames: string[], storeName: string): string {
  const cartLines = kit.productIds.map((productId) => ({ productId, variantId: null, qty: 1 }));
  return lines(
    `Hi ${firstName(kit.name)}, this is ${storeName} about the ${kitGoalLabel(kit.goal).toLowerCase()} kit you saved${kit.vehicleLabel ? ` for your ${kit.vehicleLabel}` : ''}.`,
    '',
    ...partNames.map((name) => `- ${name}`),
    kit.total > 0 ? `Total: ${formatINR(kit.total)}` : null,
    kit.deliveryDate ? `Your car arrives on ${formatDate(kit.deliveryDate)}: order a few days before so the parts are here in time.` : null,
    '',
    `Open the kit as a cart: ${cartShareUrl(cartLines)}`,
    '',
    'Any question on fit or fitting, reply here.',
  );
}

/** "It is back in stock" to someone who asked to be told. */
export function backInStock(alert: Pick<StockAlert, 'productName' | 'productSlug'>, storeName: string): string {
  return lines(
    `Hi, this is ${storeName}. You asked us to tell you when ${alert.productName} was back in stock. It is back now.`,
    '',
    siteUrl(`/p/${alert.productSlug}`),
  );
}

/** The opening of a reply to an enquiry. */
export function enquiryReply(enquiry: Enquiry, storeName: string): string {
  return lines(
    `Hi ${firstName(enquiry.name)}, this is ${storeName} about your message (ticket ${enquiry.ticketNumber}${enquiry.subject ? `: ${enquiry.subject}` : ''}).`,
    '',
    '',
  );
}

/** mailto: link for an email reply to an enquiry, or '' with no address. */
export function enquiryMailto(enquiry: Enquiry, storeName: string): string {
  if (!enquiry.email) return '';
  const subject = `Re: ${enquiry.subject || 'Your message'} [${enquiry.ticketNumber}]`;
  const body = lines(
    `Hi ${firstName(enquiry.name)},`,
    '',
    '',
    '',
    storeName,
    '',
    '---',
    `You wrote on ${formatDate(enquiry.createdAt)}:`,
    enquiry.message,
  );
  return `mailto:${encodeURIComponent(enquiry.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
