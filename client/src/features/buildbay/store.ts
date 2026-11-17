/**
 * The Build Bay's working state: the build on the stage and the steps that can be undone.
 * Not persisted here: the address (`?b=`) carries the build, so a refresh or a shared link restores it.
 */
import { create } from 'zustand';
import type { BuildPart, BuildSlot, BuildState } from '@/types/api';
import { LOWERING_RIDE_HEIGHT } from '@/features/buildbay/contract';
import type { BuildBodyType } from '@/features/buildbay/contract';
import { freshState, sameState, sanitizeState } from './codec';

const MAX_HISTORY = 40;
/** Changes to the same control closer together than this are one step for undo (dragging the tint slider). */
const MERGE_MS = 900;

interface HistoryEntry {
  state: BuildState;
  label: string;
}

export interface BuildBayState {
  build: BuildState;
  history: HistoryEntry[];
  /** What the last change did, for the undo button's name: "Undo: wheels". */
  lastKey: string | null;
  lastAt: number;

  /** Replaces the build without an undo step (loading a link). */
  load: (state: BuildState) => void;
  /** Applies a change. `label` names it for undo; the same label in quick succession merges into one step. */
  change: (label: string, update: (state: BuildState) => BuildState) => BuildSlot[];
  setBody: (bodyType: BuildBodyType) => BuildSlot[];
  setPart: (slot: BuildSlot, part: BuildPart | null, label?: string) => void;
  reset: () => void;
  undo: () => void;
}

export const useBuildBay = create<BuildBayState>()((set, get) => ({
  build: freshState(),
  history: [],
  lastKey: null,
  lastAt: 0,

  load: (state) => set({ build: sanitizeState(state).state, history: [], lastKey: null, lastAt: 0 }),

  change: (label, update) => {
    const { build, history, lastKey, lastAt } = get();
    const { state: next, removed } = sanitizeState(update(build));
    if (sameState(next, build)) return removed;
    const now = Date.now();
    const merge = lastKey === label && now - lastAt < MERGE_MS && history.length > 0;
    set({
      build: next,
      history: merge ? history : [...history, { state: build, label }].slice(-MAX_HISTORY),
      lastKey: label,
      lastAt: now,
    });
    return removed;
  },

  setBody: (bodyType) => get().change('body type', (state) => ({ ...state, bodyType })),

  setPart: (slot, part, label = slot) => {
    get().change(label, (state) => {
      const parts = { ...state.parts };
      let rideHeight = state.rideHeight;
      if (part) parts[slot] = part;
      else delete parts[slot];
      if (slot === 'lowering') {
        // Lowering parts set the ride height; taking them off puts the car back at stock height.
        if (part) rideHeight = LOWERING_RIDE_HEIGHT[part.style] ?? -1;
        else if (state.parts.lowering) rideHeight = 0;
      }
      return { ...state, parts, rideHeight };
    });
  },

  reset: () => get().change('reset', (state) => ({ ...freshState(state.bodyType), night: state.night })),

  undo: () => {
    const { history } = get();
    const last = history[history.length - 1];
    if (!last) return;
    set({ build: last.state, history: history.slice(0, -1), lastKey: null, lastAt: 0 });
  },
}));

/** The name of the step undo would take back, or null. */
export function useUndoLabel(): string | null {
  return useBuildBay((s) => s.history[s.history.length - 1]?.label ?? null);
}
