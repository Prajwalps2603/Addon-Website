/**
 * Status words and tones for orders, payments, quotes and coupons in the admin.
 * Wording comes from '@/lib/labels' so the storefront, the admin and WhatsApp agree.
 */
import { Ban, CircleCheck, CircleDashed, Clock, PackageCheck, RotateCcw, Truck, Wallet, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, type BadgeToneName } from '@/components/ui';
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/labels';
import type { AdminQuote, Coupon, OrderStatus, PaymentMethod, PaymentStatus } from '@/types/api';

export const ORDER_TONES: Record<OrderStatus, BadgeToneName> = {
  pending_payment: 'warn',
  placed: 'brand',
  confirmed: 'info',
  packed: 'info',
  shipped: 'info',
  out_for_delivery: 'info',
  delivered: 'fit',
  cancelled: 'neutral',
  returned: 'neutral',
};

const ORDER_ICONS: Record<OrderStatus, ReactNode> = {
  pending_payment: <Clock aria-hidden />,
  placed: <CircleDashed aria-hidden />,
  confirmed: <CircleCheck aria-hidden />,
  packed: <PackageCheck aria-hidden />,
  shipped: <Truck aria-hidden />,
  out_for_delivery: <Truck aria-hidden />,
  delivered: <CircleCheck aria-hidden />,
  cancelled: <Ban aria-hidden />,
  returned: <RotateCcw aria-hidden />,
};

export const PAYMENT_TONES: Record<PaymentStatus, BadgeToneName> = {
  pending: 'warn',
  advance_paid: 'info',
  paid: 'fit',
  failed: 'stop',
  refunded: 'neutral',
};

const PAYMENT_ICONS: Record<PaymentStatus, ReactNode> = {
  pending: <Clock aria-hidden />,
  advance_paid: <Wallet aria-hidden />,
  paid: <CircleCheck aria-hidden />,
  failed: <XCircle aria-hidden />,
  refunded: <RotateCcw aria-hidden />,
};

/** Short method names for tight rows. */
export const METHOD_SHORT: Record<PaymentMethod, string> = {
  cod: 'COD',
  razorpay: 'Razorpay',
  upi: 'Direct UPI',
};

export { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS };

export function OrderStatusBadge({ status, size }: { status: OrderStatus; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={ORDER_TONES[status]} icon={ORDER_ICONS[status]} size={size}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, size }: { status: PaymentStatus; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={PAYMENT_TONES[status]} icon={PAYMENT_ICONS[status]} size={size}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export const QUOTE_STATUS_LABELS: Record<AdminQuote['status'], string> = {
  open: 'Open',
  ordered: 'Ordered',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

const QUOTE_TONES: Record<AdminQuote['status'], BadgeToneName> = {
  open: 'brand',
  ordered: 'fit',
  cancelled: 'neutral',
  expired: 'neutral',
};

const QUOTE_ICONS: Record<AdminQuote['status'], ReactNode> = {
  open: <CircleDashed aria-hidden />,
  ordered: <CircleCheck aria-hidden />,
  cancelled: <Ban aria-hidden />,
  expired: <Clock aria-hidden />,
};

export function QuoteStatusBadge({ status }: { status: AdminQuote['status'] }) {
  return (
    <Badge tone={QUOTE_TONES[status]} icon={QUOTE_ICONS[status]}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}

export type CouponState = 'live' | 'scheduled' | 'ended' | 'off' | 'used_up';

export function couponState(coupon: Coupon, now = Date.now()): CouponState {
  if (!coupon.isActive) return 'off';
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 'used_up';
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) return 'scheduled';
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) return 'ended';
  return 'live';
}

const COUPON_BADGE: Record<CouponState, { label: string; tone: BadgeToneName; icon: ReactNode }> = {
  live: { label: 'Live', tone: 'fit', icon: <CircleCheck aria-hidden /> },
  scheduled: { label: 'Scheduled', tone: 'info', icon: <Clock aria-hidden /> },
  ended: { label: 'Ended', tone: 'neutral', icon: <Clock aria-hidden /> },
  off: { label: 'Switched off', tone: 'neutral', icon: <Ban aria-hidden /> },
  used_up: { label: 'Used up', tone: 'warn', icon: <CircleDashed aria-hidden /> },
};

export function CouponStateBadge({ coupon }: { coupon: Coupon }) {
  const badge = COUPON_BADGE[couponState(coupon)];
  return (
    <Badge tone={badge.tone} icon={badge.icon}>
      {badge.label}
    </Badge>
  );
}
