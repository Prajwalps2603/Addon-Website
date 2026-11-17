/** One wording for each order and payment state, shared by the storefront, the admin and WhatsApp messages. */
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/api';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

/** The steps a normal order moves through, in order. Cancelled and returned sit outside it. */
export const ORDER_PROGRESS: readonly OrderStatus[] = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  razorpay: 'Card, UPI or netbanking',
  upi: 'UPI to the store',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  advance_paid: 'Advance paid',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};
