import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Active top-level categories, each with its `children`. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: ({ signal }) => api.catalog.categories({ signal }),
    staleTime: 5 * 60_000,
  });
}
