/**
 * Follow-ups marked "Done" are hidden for the rest of the day (Indian time) on this device.
 * Stored as { date, ids }; a new day starts with an empty list.
 */
import { useCallback, useState } from 'react';
import { readJSON, writeJSON } from '@/lib/storage';

const KEY = 'addon-admin-followups-done-v1';

interface Stored {
  date: string;
  ids: string[];
}

/** 'YYYY-MM-DD' in India. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function load(): string[] {
  const stored = readJSON<Stored | null>(KEY, null);
  if (!stored || stored.date !== todayInIndia() || !Array.isArray(stored.ids)) return [];
  return stored.ids.filter((id): id is string => typeof id === 'string');
}

export function useDoneToday() {
  const [ids, setIds] = useState<string[]>(load);

  const save = useCallback((next: string[]) => {
    setIds(next);
    writeJSON(KEY, { date: todayInIndia(), ids: next } satisfies Stored);
  }, []);

  const markDone = useCallback((id: string) => save([...load().filter((x) => x !== id), id]), [save]);
  const undo = useCallback((id: string) => save(load().filter((x) => x !== id)), [save]);
  const reset = useCallback(() => save([]), [save]);

  return { done: new Set(ids), markDone, undo, reset };
}
