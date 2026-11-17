import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

declare module '@tanstack/react-query' {
  interface Register {
    /** Everything lib/api.ts throws is an ApiError, so `error` is typed in every query and mutation. */
    defaultError: ApiError;
  }
}

const MAX_RETRIES = 2;

/** A 4xx answer will not change by asking again. Only network and server failures are retried. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < MAX_RETRIES;
}

/** A 401 anywhere means the session has ended: re-read who is signed in so guards and menus follow. */
function recheckSession(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== queryKeys.me()[0]) recheckSession(error);
    },
  }),
  mutationCache: new MutationCache({ onError: recheckSession }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
    mutations: { retry: false },
  },
});
