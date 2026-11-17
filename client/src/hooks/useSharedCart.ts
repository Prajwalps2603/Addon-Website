import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CART_COUPON_PARAM, CART_LINK_PARAM, readCartLink } from '@/lib/cartLink';
import { useCart } from '@/stores/cart';
import type { CartLineInput } from '@/types/api';

export interface SharedCart {
  /** The cart carried by the page's URL ("send cart to payer"), or null when there is none. */
  shared: { lines: CartLineInput[]; couponCode: string } | null;
  /** Replaces this device's cart with the shared one and removes it from the URL. */
  accept: () => void;
  /** Leaves this device's cart alone and removes the shared one from the URL. */
  dismiss: () => void;
}

/**
 * For the cart page: reads a shared cart link (see lib/cartLink.ts). When the device's own
 * cart is empty, call accept() straight away; otherwise ask before replacing it.
 */
export function useSharedCart(): SharedCart {
  const [params, setParams] = useSearchParams();
  const shared = useMemo(() => readCartLink(params), [params]);

  const dismiss = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(CART_LINK_PARAM);
        next.delete(CART_COUPON_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  const accept = useCallback(() => {
    if (shared) {
      useCart.getState().replaceAll(shared.lines, shared.couponCode ? { couponCode: shared.couponCode } : undefined);
    }
    dismiss();
  }, [shared, dismiss]);

  return { shared, accept, dismiss };
}
