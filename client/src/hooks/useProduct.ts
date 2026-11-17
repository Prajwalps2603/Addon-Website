import { useQuery } from '@tanstack/react-query';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface ProductOptions {
  /** Check fit against this vehicle instead of the active garage car. null = no car. */
  vehicleId?: number | null;
  enabled?: boolean;
}

/**
 * One product by slug, with the fit verdict for the active garage car.
 * A missing or inactive product is an ApiError with status 404 (`error.isNotFound`).
 */
export function useProduct(slug: string | undefined, options: ProductOptions = {}) {
  const active = useActiveVehicle();
  const vehicleId = options.vehicleId === undefined ? (active?.id ?? null) : options.vehicleId;

  return useQuery({
    queryKey: queryKeys.products.detail(slug ?? '', vehicleId),
    queryFn: ({ signal }) => api.products.get(slug as string, { vehicleId: vehicleId ?? undefined }, { signal }),
    enabled: Boolean(slug) && (options.enabled ?? true),
  });
}
