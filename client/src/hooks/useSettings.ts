import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * The store's public settings (name, WhatsApp number, shipping and COD rules, payment methods).
 * Blank values mean "not set": hide whatever depends on them.
 */
export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings(),
    queryFn: ({ signal }) => api.settings.get({ signal }),
    staleTime: 5 * 60_000,
  });
}
