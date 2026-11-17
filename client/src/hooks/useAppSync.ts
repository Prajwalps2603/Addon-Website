import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useMe } from '@/hooks/useMe';
import { resetAccountSync, syncAccount, watchAccountStores } from '@/lib/accountSync';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useGarage } from '@/stores/garage';

/** Wishlist and garage follow the account while someone is signed in. See lib/accountSync.ts. */
function useAccountSync(): void {
  const { user, isPending } = useMe();
  const userId = user?.id ?? null;
  /** A sign-in during this visit merges; a session that was already there adopts the account's lists. */
  const sawSignedOut = useRef(false);

  useEffect(() => watchAccountStores(), []);

  useEffect(() => {
    if (isPending) return;
    if (userId === null) {
      sawSignedOut.current = true;
      resetAccountSync();
      return;
    }
    void syncAccount(userId, sawSignedOut.current ? 'merge' : 'adopt');
  }, [userId, isPending]);
}

/**
 * Checks the active garage car against the catalogue once per visit: refreshes its saved
 * details, and drops it if the catalogue no longer has it, so no page asks for fit against a dead id.
 */
function useGarageCheck(): void {
  const activeVehicleId = useGarage((state) => state.activeVehicleId);
  const { data, error } = useQuery({
    queryKey: queryKeys.vehicles.detail(activeVehicleId ?? 0),
    queryFn: ({ signal }) => api.catalog.vehicle(activeVehicleId as number, { signal }),
    enabled: activeVehicleId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (activeVehicleId === null) return;
    if (data && data.id === activeVehicleId) useGarage.getState().refresh(data);
    else if (error?.status === 404) useGarage.getState().remove(activeVehicleId);
  }, [activeVehicleId, data, error]);
}

/** Background upkeep that runs once for the whole app. App.tsx mounts it; pages never call it. */
export function useAppSync(): void {
  useAccountSync();
  useGarageCheck();
}
