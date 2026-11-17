import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useDebounce } from '@/hooks/useDebounce';
import type { PricedCartResult } from '@/hooks/usePricedCart';
import { api } from '@/lib/api';
import { isValidPincode } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useCart } from '@/stores/cart';
import type { CartLineInput, Fulfilment, PaymentMethod, PriceCartRequest, PricedCart } from '@/types/api';

export interface CheckoutPriceOptions {
  items: CartLineInput[];
  paymentMethod?: PaymentMethod;
  pincode?: string;
  quoteToken?: string;
  fulfilment: Fulfilment;
}

function sharesAProduct(cart: PricedCart, items: readonly CartLineInput[]): boolean {
  return items.some((item) => cart.lines.some((line) => line.productId === item.productId));
}

/**
 * The checkout's own pricing call. It is usePricedCart plus `fulfilment` (the shared hook does not
 * send it yet), so collection and studio fitting are priced by the server like everything else.
 */
export function useCheckoutPrice({ items, paymentMethod, pincode, quoteToken, fulfilment }: CheckoutPriceOptions): PricedCartResult {
  const couponCode = useCart((state) => state.couponCode);
  const vehicle = useActiveVehicle();

  const body: PriceCartRequest = {
    items,
    couponCode: quoteToken ? undefined : couponCode || undefined,
    // The PIN code only matters for delivery; leaving it out elsewhere keeps the request stable.
    pincode: fulfilment === 'delivery' && pincode && isValidPincode(pincode) ? pincode.trim() : undefined,
    paymentMethod,
    vehicleId: vehicle?.id,
    quoteToken: quoteToken || undefined,
    fulfilment,
  };
  const serialised = JSON.stringify(body);
  const request = useMemo(() => JSON.parse(serialised) as PriceCartRequest, [serialised]);
  const settled = useDebounce(request, 250);

  const isEmpty = items.length === 0;
  const query = useQuery({
    queryKey: queryKeys.cart.price(settled),
    queryFn: ({ signal }) => api.cart.price(settled, { signal }),
    enabled: settled.items.length > 0,
    placeholderData: (previous) => (previous && sharesAProduct(previous, settled.items) ? previous : undefined),
    staleTime: 15_000,
    gcTime: 60_000,
  });

  return {
    cart: isEmpty ? undefined : query.data,
    isEmpty,
    isPending: !isEmpty && query.data === undefined && !query.isError,
    isUpdating: !isEmpty && (query.isFetching || settled !== request),
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
