import { createJSONStorage } from 'zustand/middleware';

interface SyncStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * localStorage that never throws. Some browsers block storage (private mode,
 * in-app browsers, a full quota): writes then land in memory for this visit.
 */
const memory = new Map<string, string>();

function nativeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const safeStorage: SyncStorage = {
  getItem(key) {
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      return nativeStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      const storage = nativeStorage();
      if (!storage) throw new Error('storage unavailable');
      storage.setItem(key, value);
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key) {
    memory.delete(key);
    try {
      nativeStorage()?.removeItem(key);
    } catch {
      // Nothing left to remove.
    }
  },
};

/** Read a JSON value. Returns `fallback` when the key is missing or the value is not valid JSON. */
export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  safeStorage.setItem(key, JSON.stringify(value));
}

export function removeStored(key: string): void {
  safeStorage.removeItem(key);
}

/** The storage every persisted Zustand store uses. */
export function persistStorage<S>() {
  return createJSONStorage<S>(() => safeStorage);
}

interface RehydratableStore {
  persist: { rehydrate: () => Promise<void> | void };
}

/** Keep a persisted store in step with other tabs of the same browser. */
export function syncAcrossTabs(store: RehydratableStore, storageKey: string): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) void store.persist.rehydrate();
  });
}
