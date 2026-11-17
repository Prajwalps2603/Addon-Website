import type { QueryClient } from '@tanstack/react-query';

const AFFECTED = new Set(['home', 'drop', 'products']);

/**
 * When a drop's real end time passes, every price shown from it is out of date:
 * refetch the home page, the drop and every product list or detail.
 */
export function refreshAfterDrop(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ predicate: (query) => AFFECTED.has(String(query.queryKey[0])) });
}
