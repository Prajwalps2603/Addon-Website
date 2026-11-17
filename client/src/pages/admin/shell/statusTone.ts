/**
 * Badge tones for order states, used until a shared '@/lib/orderStatus' exists.
 * Labels always come from '@/lib/labels' so the wording matches the rest of the store.
 */
import type { BadgeToneName } from '@/components/ui';
import type { OrderStatus } from '@/types/api';

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeToneName> = {
  pending_payment: 'warn',
  placed: 'brand',
  confirmed: 'info',
  packed: 'info',
  shipped: 'ink',
  out_for_delivery: 'ink',
  delivered: 'fit',
  cancelled: 'neutral',
  returned: 'neutral',
};
