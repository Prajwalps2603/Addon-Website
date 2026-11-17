import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useProductsByIds } from '@/hooks/useProducts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ApiError } from '@/lib/api';
import type { BuildSlot, ProductQuery, ProductSummary } from '@/types/api';
import { BUILD_SLOTS } from '@/features/buildbay/contract';

export type ProductsBySlot = Partial<Record<BuildSlot, ProductSummary[]>>;

export interface BuildCatalogue {
  /** Catalogue products mapped to each slot, with fit for the active car. */
  bySlot: ProductsBySlot;
  /** Every product seen, by id: the slot lists plus any part named in the build that is not in them. */
  byId: Map<number, ProductSummary>;
  isPending: boolean;
  /** Slots whose listing has not arrived yet. */
  pendingSlots: ReadonlySet<BuildSlot>;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * The catalogue products that stand for Build Bay parts, one listing per slot, with the fit verdict
 * for the active garage car. `extraIds` are products already on the build (from a shared link) so
 * the build sheet can price them even if they have left the slot listing.
 */
export function useBuildCatalogue(extraIds: readonly number[] = []): BuildCatalogue {
  const vehicle = useActiveVehicle();
  const vehicleId = vehicle?.id;

  const results = useQueries({
    queries: BUILD_SLOTS.map((slot) => {
      const query: ProductQuery = { buildSlot: slot, limit: 60, ...(vehicleId === undefined ? {} : { vehicleId }) };
      return {
        queryKey: queryKeys.products.list(query),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.products.list(query, { signal }),
        staleTime: 60_000,
      };
    }),
  });

  const listed = new Set<number>();
  for (const result of results) for (const product of result.data?.items ?? []) listed.add(product.id);
  const missing = extraIds.filter((id) => !listed.has(id));
  const extra = useProductsByIds(missing, { enabled: missing.length > 0 && results.every((r) => !r.isPending) });

  const dataStamp = results.map((r) => r.dataUpdatedAt).join(',');
  const extraStamp = extra.dataUpdatedAt;

  const { bySlot, byId } = useMemo(() => {
    const slots: ProductsBySlot = {};
    const ids = new Map<number, ProductSummary>();
    BUILD_SLOTS.forEach((slot, index) => {
      const items = results[index]?.data?.items ?? [];
      slots[slot] = items.filter((product) => product.buildSlot === slot && product.buildStyle);
      for (const product of items) ids.set(product.id, product);
    });
    for (const product of extra.data ?? []) if (!ids.has(product.id)) ids.set(product.id, product);
    return { bySlot: slots, byId: ids };
    // The stamps change exactly when any listing's data does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStamp, extraStamp, vehicleId]);

  const failed = results.find((r) => r.error);
  return {
    bySlot,
    byId,
    isPending: results.some((r) => r.isPending),
    pendingSlots: new Set(BUILD_SLOTS.filter((_, index) => results[index]?.isPending)),
    error: (failed?.error as ApiError | undefined) ?? null,
    refetch: () => {
      for (const r of results) if (r.error) void r.refetch();
    },
  };
}
