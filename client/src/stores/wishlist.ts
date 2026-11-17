import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, syncAcrossTabs } from '@/lib/storage';
import { cleanIds } from '@/stores/ids';

const STORAGE_KEY = 'addon-wishlist-v1';

export const MAX_WISHLIST = 200;

interface WishlistState {
  /** Product ids, most recently saved first. */
  ids: number[];
  /** Saves or un-saves a product. Returns true when it is now saved. */
  toggle: (id: number) => boolean;
  /** A one-off check. In a component use useIsWishlisted(id) so it re-renders. */
  has: (id: number) => boolean;
  remove: (id: number) => void;
  /** Replaces the list (account sync). */
  setAll: (ids: number[]) => void;
  clear: () => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const saved = get().ids.includes(id);
        set({ ids: saved ? get().ids.filter((other) => other !== id) : cleanIds([id, ...get().ids], MAX_WISHLIST) });
        return !saved;
      },
      has: (id) => get().ids.includes(id),
      remove: (id) => set({ ids: get().ids.filter((other) => other !== id) }),
      setAll: (ids) => set({ ids: cleanIds(ids, MAX_WISHLIST) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state) => ({ ids: state.ids }),
      merge: (persisted, current) => ({
        ...current,
        ids: cleanIds((persisted as Partial<WishlistState> | null)?.ids, MAX_WISHLIST),
      }),
    },
  ),
);

syncAcrossTabs(useWishlist, STORAGE_KEY);

export function useIsWishlisted(id: number): boolean {
  return useWishlist((state) => state.ids.includes(id));
}
