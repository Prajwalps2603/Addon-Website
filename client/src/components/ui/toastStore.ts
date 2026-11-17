import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  /** A second, quieter line. */
  description?: string;
  /** One follow-up, e.g. { label: 'View cart', onClick }. Pressing it also closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds on screen. Default 4000, 6000 for errors. Pass 0 to keep it until dismissed. */
  duration?: number;
  /** Reuse an id to replace a toast already showing instead of stacking a second one. */
  id?: string;
}

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  description: string | undefined;
  action: { label: string; onClick: () => void } | undefined;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (tone: ToastTone, message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/** At most this many at once; a new one pushes the oldest out. */
const MAX_VISIBLE = 3;
let sequence = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (tone, message, options = {}) => {
    sequence += 1;
    const id = options.id ?? `toast-${sequence}`;
    const item: ToastItem = {
      id,
      tone,
      message,
      description: options.description,
      action: options.action,
      duration: options.duration ?? (tone === 'error' ? 6000 : 4000),
    };
    set((state) => ({ toasts: [...state.toasts.filter((toast) => toast.id !== id), item].slice(-MAX_VISIBLE) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Brief feedback after an action, from anywhere (components, mutations, plain functions).
 *
 *   toast.success('Added to cart', { action: { label: 'View cart', onClick: openCart } });
 *   toast.error('Could not save the address', { description: error.message });
 *
 * Say what happened in a few words. Errors the shopper must act on belong in the page (Callout, Field), not here.
 */
export const toast = {
  success: (message: string, options?: ToastOptions): string => useToastStore.getState().push('success', message, options),
  error: (message: string, options?: ToastOptions): string => useToastStore.getState().push('error', message, options),
  info: (message: string, options?: ToastOptions): string => useToastStore.getState().push('info', message, options),
  dismiss: (id: string): void => useToastStore.getState().dismiss(id),
  clear: (): void => useToastStore.getState().clear(),
};
