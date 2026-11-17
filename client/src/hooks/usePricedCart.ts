import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useDebounce } from '@/hooks/useDebounce';
import { api, type ApiError } from '@/lib/api';
import { isValidPincode } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useCart } from '@/stores/cart';
import type { CartLineInput, PaymentMethod, PriceCartRequest, PricedCart } from '@/types/api';

export interface PricedCartOptions {
  /** Price for this payment method (COD fee, prepaid discount). Leave out for full online payment. */
  paymentMethod?: PaymentMethod;
  /** Price these lines instead of the cart store (a quote, a kit preview). */
  items?: CartLineInput[];
  /** Use this pincode instead of the one in the cart store (the checkout address). */
  pincode?: string;
  /** Price from a quote. The cart's coupon is not sent with a quote. */
  quoteToken?: string;
  /** False pauses pricing. */
  enabled?: boolean;
  /** How long the cart must sit still before it is priced. */
  debounceMs?: number;
}

export interface PricedCartResult {
  /** The server's pricing. Undefined while empty or before the first answer; stays on the last answer while a new one loads. */
  cart: PricedCart | undefined;
  /** No lines to price: show the empty-cart state. */
  isEmpty: boolean;
  /** Waiting for the first answer. */
  isPending: boolean;
  /** A newer price is on its way: dim the totals. */
  isUpdating: boolean;
  isError: boolean;
  error: ApiError | null;
  refetch: () => void;
}

function sharesAProduct(cart: PricedCart, items: readonly CartLineInput[]): boolean {
  return items.some((item) => cart.lines.some((line) => line.productId === item.productId));
}

/**
 * The cart, priced by the server with the coupon, the pincode and the active car.
 * Every component that calls this with the same options shares one request.
 */
export function usePricedCart(options: PricedCartOptions = {}): PricedCartResult {
  const storeLines = useCart((state) => state.lines);
  const couponCode = useCart((state) => state.couponCode);
  const storePincode = useCart((state) => state.pincode);
  const vehicle = useActiveVehicle();

  const items = options.items ?? storeLines;
  const pincode = options.pincode ?? storePincode;

  // Serialised so that a caller passing a fresh `items` array on every render does not restart the debounce.
  const body: PriceCartRequest = {
    items,
    couponCode: options.quoteToken ? undefined : couponCode || undefined,
    pincode: isValidPincode(pincode) ? pincode.trim() : undefined,
    paymentMethod: options.paymentMethod,
    vehicleId: vehicle?.id,
    quoteToken: options.quoteToken || undefined,
  };
  const serialised = JSON.stringify(body);
  const request = useMemo(() => JSON.parse(serialised) as PriceCartRequest, [serialised]);
  const settled = useDebounce(request, options.debounceMs ?? 250);

  const isEmpty = items.length === 0;
  const query = useQuery({
    queryKey: queryKeys.cart.price(settled),
    queryFn: ({ signal }) => api.cart.price(settled, { signal }),
    enabled: (options.enabled ?? true) && settled.items.length > 0,
    // The last answer stays up while the next one loads, but only while it is still about this cart:
    // a cart emptied and refilled with other parts starts from a clean loading state.
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
