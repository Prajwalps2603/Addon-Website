import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, syncAcrossTabs } from '@/lib/storage';
import { cleanIds } from '@/stores/ids';

const STORAGE_KEY = 'addon-compare-v1';

export const MAX_COMPARE = 4;

interface CompareState {
  /** Product ids in the order they were added. Never more than MAX_COMPARE. */
  ids: number[];
  /** Adds or removes a product. 'full' means nothing changed because four are already picked. */
  toggle: (id: number) => 'added' | 'removed' | 'full';
  has: (id: number) => boolean;
  remove: (id: number) => void;
  /** Replaces the list, for a shared comparison link. Extra ids beyond four are dropped. */
  setAll: (ids: number[]) => void;
  clear: () => void;
}

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const ids = get().ids;
        if (ids.includes(id)) {
          set({ ids: ids.filter((other) => other !== id) });
          return 'removed';
        }
        if (ids.length >= MAX_COMPARE) return 'full';
        set({ ids: [...ids, id] });
        return 'added';
      },
      has: (id) => get().ids.includes(id),
      remove: (id) => set({ ids: get().ids.filter((other) => other !== id) }),
      setAll: (ids) => set({ ids: cleanIds(ids, MAX_COMPARE) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state) => ({ ids: state.ids }),
      merge: (persisted, current) => ({
        ...current,
        ids: cleanIds((persisted as Partial<CompareState> | null)?.ids, MAX_COMPARE),
      }),
    },
  ),
);

syncAcrossTabs(useCompare, STORAGE_KEY);

export function useIsCompared(id: number): boolean {
  return useCompare((state) => state.ids.includes(id));
}
