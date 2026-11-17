import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/storage';
import { cleanIds } from '@/stores/ids';

const STORAGE_KEY = 'addon-recent-v1';

export const MAX_RECENTLY_VIEWED = 12;

interface RecentlyViewedState {
  /** Product ids, most recent first. Never more than MAX_RECENTLY_VIEWED. */
  ids: number[];
  /** Records a product view: moves the id to the front. */
  push: (id: number) => void;
  clear: () => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      ids: [],
      push: (id) => {
        if (get().ids[0] === id) return;
        set({ ids: cleanIds([id, ...get().ids], MAX_RECENTLY_VIEWED) });
      },
      clear: () => set({ ids: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state) => ({ ids: state.ids }),
      merge: (persisted, current) => ({
        ...current,
        ids: cleanIds((persisted as Partial<RecentlyViewedState> | null)?.ids, MAX_RECENTLY_VIEWED),
      }),
    },
  ),
);
