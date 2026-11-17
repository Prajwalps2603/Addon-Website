import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { KitRequest, ProductSummary } from '@/types/api';
import { joinIds, parseIds, pickTier, showKits, type KitTier } from './kitShared';
import { useKitBuild } from './useKits';

export type ParamPatch = Record<string, string | number | null | undefined>;

/** Merges a patch into the query string. null, undefined and '' remove a key. */
export function useParamPatch() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (patch: ParamPatch, options: { push?: boolean } = {}) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: !options.push, preventScrollReset: true },
      );
    },
    [setParams],
  );
}

/**
 * The part of a planner both pages share, all of it kept in the URL so a result can be shared:
 *   x    parts swapped out: left out of the request, so the next option in the range comes in
 *   rm   parts removed: taken out of the kits on this page, the budget they free stays unspent
 *   kit  the kit the shopper picked
 */
export function useKitPlanner(base: Omit<KitRequest, 'exclude'> | null) {
  const [params] = useSearchParams();
  const patch = useParamPatch();
  const xParam = params.get('x');
  const rmParam = params.get('rm');
  const excluded = useMemo(() => parseIds(xParam), [xParam]);
  const removed = useMemo(() => parseIds(rmParam), [rmParam]);

  // The page rebuilds `base` on every render, so the request is keyed on its fields.
  const goal = base?.goal;
  const budget = base?.budget;
  const vehicleId = base?.vehicleId;
  const bodyType = base?.bodyType;
  const request = useMemo<KitRequest | null>(() => {
    if (!goal || budget === undefined) return null;
    const next: KitRequest = { goal, budget };
    if (vehicleId) next.vehicleId = vehicleId;
    else if (bodyType) next.bodyType = bodyType;
    if (excluded.length > 0) next.exclude = excluded;
    return next;
  }, [goal, budget, vehicleId, bodyType, excluded]);

  const query = useKitBuild(request);
  const [swappingId, setSwappingId] = useState<number | null>(null);
  useEffect(() => {
    if (!query.isFetching) setSwappingId(null);
  }, [query.isFetching]);

  const data = query.data;
  const shown = useMemo(() => (data ? showKits(data.kits, removed) : []), [data, removed]);
  const selected = pickTier(shown, params.get('kit'));

  const onSwap = (product: ProductSummary) => {
    setSwappingId(product.id);
    patch({ x: joinIds([...excluded, product.id]), rm: joinIds(removed.filter((id) => id !== product.id)) });
  };
  const onRemove = (product: ProductSummary) => patch({ rm: joinIds([...removed, product.id]) });
  const onRestore = (ids: number[]) => patch({ rm: joinIds(removed.filter((id) => !ids.includes(id))) });
  const onUnswap = (ids: number[]) => patch({ x: joinIds(excluded.filter((id) => !ids.includes(id))) });
  const onSelect = (tier: KitTier) => patch({ kit: tier });

  return {
    request,
    query,
    data,
    shown,
    selected,
    chosen: shown.find((entry) => entry.kit.tier === selected) ?? null,
    excluded,
    removed,
    swappingId,
    /** Old kits on screen while new ones load. */
    updating: query.isPlaceholderData || (query.isFetching && swappingId !== null),
    onSwap,
    onRemove,
    onRestore,
    onUnswap,
    onSelect,
    patch,
  };
}

/** The planner keys to clear when the car, the goal or the vibe changes: old swaps no longer mean anything. */
export const RESET_PLANNER: ParamPatch = { x: null, rm: null, kit: null };
