import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductQuery } from '@/types/api';

export interface ProductsOptions {
  enabled?: boolean;
  /** False stops the active garage car being added to the query (no fit verdicts). */
  withVehicle?: boolean;
}

/** The vehicle a product query is scoped to: its own, else the active garage car. */
function useVehicleScope(vehicleId: number | undefined, withVehicle: boolean): number | undefined {
  const active = useActiveVehicle();
  if (vehicleId !== undefined) return vehicleId;
  return withVehicle ? active?.id : undefined;
}

/**
 * A product listing (GET /products) with fit verdicts for the active garage car.
 * The previous page stays on screen while the next one loads: check `isPlaceholderData` to dim it.
 */
export function useProducts(query: ProductQuery = {}, options: ProductsOptions = {}) {
  const vehicleId = useVehicleScope(query.vehicleId, options.withVehicle ?? true);
  const scoped: ProductQuery = vehicleId === undefined ? query : { ...query, vehicleId };

  return useQuery({
    queryKey: queryKeys.products.list(scoped),
    queryFn: ({ signal }) => api.products.list(scoped, { signal }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/**
 * Exactly these products, in the order given: the wishlist, compare and recently viewed lists.
 * Products that no longer exist are left out. An empty list makes no request.
 */
export function useProductsByIds(ids: readonly number[], options: ProductsOptions = {}) {
  const vehicleId = useVehicleScope(undefined, options.withVehicle ?? true);

  return useQuery({
    queryKey: queryKeys.products.byIds(ids, vehicleId),
    queryFn: ({ signal }) => api.products.byIds(ids, { vehicleId }, { signal }),
    enabled: (options.enabled ?? true) && ids.length > 0,
    placeholderData: keepPreviousData,
  });
}
