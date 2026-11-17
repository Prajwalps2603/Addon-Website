import { formatINR } from '@/lib/format';
import type { BadgeTone } from '@/components/ui';
import type { Order } from '@/types/api';
import { atStudio, methodLabel } from './fulfilment';

export interface PaymentWords {
  /** Two or three words for a badge. */
  short: string;
  tone: BadgeTone;
  /** One or two plain sentences. */
  detail: string;
}

/** The payment state of an order in words: paid, advance paid, awaiting UPI check, cash on delivery. */
export function describePayment(order: Order): PaymentWords {
  const method = methodLabel(order);
  const studio = atStudio(order);
  const closed = order.status === 'cancelled' || order.status === 'returned';

  switch (order.paymentStatus) {
    case 'paid':
      return {
        short: 'Paid',
        tone: 'fit',
        detail: studio && order.paymentMethod === 'cod' ? `${formatINR(order.amountPaid || order.total)} paid at the studio.` : `${formatINR(order.amountPaid || order.total)} paid by ${method.toLowerCase()}.`,
      };
    case 'advance_paid':
      return {
        short: 'Advance paid',
        tone: 'fit',
        detail: closed
          ? `Advance of ${formatINR(order.amountPaid)} paid online.`
          : `Advance of ${formatINR(order.amountPaid)} paid online. Pay ${formatINR(order.amountDue)} ${studio ? 'at the studio' : 'in cash to the courier on delivery'}.`,
      };
    case 'refunded':
      return {
        short: 'Refunded',
        tone: 'info',
        detail: order.amountPaid > 0 ? `${formatINR(order.amountPaid)} refunded to the account you paid from.` : 'Refunded to the account you paid from.',
      };
    case 'failed':
      return {
        short: 'Payment failed',
        tone: 'stop',
        detail: 'The payment did not go through. If money left your account anyway, message us with the order number.',
      };
    case 'pending':
    default:
      break;
  }

  if (order.status === 'pending_payment') {
    const toPay = order.paymentMethod === 'cod' ? Math.max(0, order.advanceAmount - order.amountPaid) : order.amountDue;
    return {
      short: 'Not paid yet',
      tone: 'warn',
      detail:
        order.paymentMethod === 'cod'
          ? `The advance of ${formatINR(toPay)} has not been paid yet. The rest, ${formatINR(order.total - order.advanceAmount)}, is paid ${studio ? 'at the studio' : 'on delivery'}.`
          : `${formatINR(toPay)} still to pay. We pack the order once the payment goes through.`,
    };
  }

  if (closed) {
    return {
      short: 'Not collected',
      tone: 'neutral',
      detail: order.upiReference
        ? `You reported UPI reference (UTR) ${order.upiReference}. If that payment went through, we refund it to the account it came from: message us with the order number.`
        : 'Nothing was collected for this order.',
    };
  }

  if (order.paymentMethod === 'upi') {
    return {
      short: 'Checking UPI payment',
      tone: 'info',
      detail: order.upiReference
        ? `You reported UPI reference (UTR) ${order.upiReference}. We match it with our bank statement and then mark the order paid.`
        : 'We are matching your UPI payment with our bank statement.',
    };
  }

  if (order.paymentMethod === 'cod' && studio) {
    return {
      short: 'Pay at the studio',
      tone: 'neutral',
      detail: `Pay ${formatINR(order.amountDue)} at the studio${order.fulfilment === 'studio' ? ' on the day of the fitting' : ' when you collect'}.`,
    };
  }

  if (order.paymentMethod === 'cod') {
    return {
      short: 'Cash on delivery',
      tone: 'neutral',
      detail: closed ? 'Cash on delivery: nothing was paid.' : `Pay ${formatINR(order.amountDue)} in cash to the courier on delivery.`,
    };
  }

  return { short: 'Payment pending', tone: 'warn', detail: `${formatINR(order.amountDue)} still to pay.` };
}
