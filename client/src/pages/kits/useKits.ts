import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { KitRequest } from '@/types/api';

/** The kits for a request, keeping the last answer on screen while a swap or a new budget loads. */
export function useKitBuild(request: KitRequest | null, options: { keepPrevious?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.kits(request ?? { goal: 'new_car', budget: 0 }),
    queryFn: ({ signal }) => api.kits.build(request as KitRequest, { signal }),
    enabled: request !== null,
    placeholderData: options.keepPrevious === false ? undefined : keepPreviousData,
    staleTime: 60_000,
  });
}

export interface LowestBudgetRange {
  /** The largest budget the page offers. */
  max: number;
  /** Answers are rounded up to this many rupees. */
  step: number;
}

/**
 * When a budget is too small for any kit, finds the smallest budget (to the step) that gives one,
 * by asking the planner itself: once at the top of the range, then halving the gap.
 * `null` means nothing in stock matches at any budget the page offers.
 */
export function useLowestBudget(request: KitRequest | null, range: LowestBudgetRange) {
  return useQuery({
    queryKey: [...queryKeys.kits(request ?? { goal: 'new_car', budget: 0 }), 'lowest', range.max, range.step] as const,
    enabled: request !== null && request.budget < range.max,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }): Promise<number | null> => {
      const base = request as KitRequest;
      const works = async (budget: number) => (await api.kits.build({ ...base, budget }, { signal })).kits.length > 0;
      if (!(await works(range.max))) return null;
      let low = Math.ceil(base.budget / range.step); // in steps; known not to work
      let high = Math.ceil(range.max / range.step); // known to work
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (await works(mid * range.step)) high = mid;
        else low = mid;
      }
      return high * range.step;
    },
  });
}
