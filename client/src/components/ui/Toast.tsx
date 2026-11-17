import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CircleCheck, Info, OctagonAlert, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { prefersReducedMotion } from './a11y';
import { Portal } from './Portal';
import { useToastStore, type ToastItem, type ToastTone } from './toastStore';

const TONES: Record<ToastTone, { Icon: LucideIcon; colour: string }> = {
  success: { Icon: CircleCheck, colour: 'text-fit' },
  error: { Icon: OctagonAlert, colour: 'text-stop' },
  info: { Icon: Info, colour: 'text-info' },
};

const EXIT_MS = 120;

// Only the Toaster mounted first shows toasts, so a second one mounted by mistake cannot double them.
const mountedToasters: symbol[] = [];
const toasterListeners = new Set<() => void>();

function subscribeToasters(listener: () => void): () => void {
  toasterListeners.add(listener);
  return () => toasterListeners.delete(listener);
}

function announceToasters(): void {
  toasterListeners.forEach((listener) => listener());
}

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const exit = useRef<number | undefined>(undefined);
  const { Icon, colour } = TONES[item.tone];

  const close = () => {
    if (prefersReducedMotion()) {
      dismiss(item.id);
      return;
    }
    setLeaving(true);
    exit.current = window.setTimeout(() => dismiss(item.id), EXIT_MS);
  };

  const closeLatest = useRef(close);
  useEffect(() => {
    closeLatest.current = close;
  });

  useEffect(() => () => window.clearTimeout(exit.current), []);

  // The clock stops while the pointer or keyboard focus is on the toast, so it cannot vanish mid-read.
  useEffect(() => {
    if (paused || leaving || item.duration <= 0) return;
    const timer = window.setTimeout(() => closeLatest.current(), item.duration);
    return () => window.clearTimeout(timer);
  }, [paused, leaving, item.duration]);

  return (
    <li
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'plane-board pointer-events-auto flex items-start gap-3 py-3 pr-2 pl-3 shadow-pop',
        leaving ? 'animate-lean-out' : 'animate-lean-in',
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', colour)} />
      <div className="grid min-w-0 flex-1 gap-0.5 py-0.5">
        <p className="leading-snug font-bold">{item.message}</p>
        {item.description && <p className="type-small text-muted">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              close();
            }}
            className="type-small mt-1 justify-self-start font-bold underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={close}
        className="tap-44 grid size-8 shrink-0 place-items-center rounded-control text-muted transition-colors dur-quick hover:bg-surface-2 hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/**
 * Shows the toasts raised with `toast.success / error / info`. Mount it once, near the root of the app.
 * On a phone toasts sit above the bottom bar; from 768 px they sit in the bottom right corner.
 * Each toast is a small board: it leans in, waits, and leaves.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const [self] = useState(() => Symbol('toaster'));

  useEffect(() => {
    mountedToasters.push(self);
    announceToasters();
    return () => {
      mountedToasters.splice(mountedToasters.indexOf(self), 1);
      announceToasters();
    };
  }, [self]);

  const active = useSyncExternalStore(
    subscribeToasters,
    () => mountedToasters[0] === self,
    () => false,
  );
  if (!active) return null;
  return (
    <Portal>
      <ol
        aria-label="Notifications"
        data-floating
        data-print="hide"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom)+0.75rem)] z-toast flex flex-col gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:w-96 md:px-0"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </ol>
    </Portal>
  );
}
