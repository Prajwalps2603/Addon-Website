import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Every make with its models and generations, popular ones first. The list rarely changes, so it is kept for the visit. */
export function useVehicles() {
  return useQuery({
    queryKey: queryKeys.vehicles.tree(),
    queryFn: ({ signal }) => api.catalog.vehicles({ signal }),
    staleTime: 60 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/** One vehicle by id (a shared link, a build, a kit). Pass null to skip. */
export function useVehicle(id: number | null | undefined) {
  return useQuery({
    queryKey: queryKeys.vehicles.detail(id ?? 0),
    queryFn: ({ signal }) => api.catalog.vehicle(id as number, { signal }),
    enabled: typeof id === 'number' && id > 0,
    staleTime: 60 * 60_000,
  });
}
