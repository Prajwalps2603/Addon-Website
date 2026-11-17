import { create } from 'zustand';
import { safeStorage } from '@/lib/storage';

export type Theme = 'light' | 'dark';

/**
 * Holds the plain word 'light' or 'dark' (not JSON): public/theme-init.js reads the same key
 * before first paint. No stored choice means light.
 */
const STORAGE_KEY = 'addon-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The shopper's stored choice, else whatever theme-init.js already painted, else light. */
function initialTheme(): Theme {
  const stored = safeStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) return stored;
  const painted = typeof document === 'undefined' ? null : document.documentElement.dataset.theme;
  return isTheme(painted) ? painted : 'light';
}

function paint(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  /** Switches the theme (sets data-theme on <html>) and remembers the choice on this device. */
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    paint(theme);
    safeStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

paint(useTheme.getState().theme);
