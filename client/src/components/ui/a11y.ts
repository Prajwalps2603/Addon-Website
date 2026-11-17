import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';

/** Behaviour shared by the overlays in this folder: Modal, Drawer, Popover, Tooltip. */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[inert]') && el.getClientRects().length > 0,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/* ---- focus trap ---- */

// Only the trap opened last pulls focus back, so a modal opened from a drawer behaves.
const trapStack: HTMLElement[] = [];

/**
 * Keeps keyboard focus inside `ref` while `active`, and returns it to where it was afterwards.
 * Focus starts on `initialFocus`, else on a `[data-autofocus]` element, else on the container.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocus?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    trapStack.push(node);
    const target = initialFocus?.current ?? node.querySelector<HTMLElement>('[data-autofocus]') ?? node;
    target.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = getFocusable(node);
      if (items.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === node)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    // Focus that lands outside (a click on the page behind, a browser shortcut) comes back,
    // unless it went into a floating layer such as a popover opened from inside the dialog.
    const onFocusIn = (event: FocusEvent) => {
      if (trapStack[trapStack.length - 1] !== node) return;
      const to = event.target;
      if (!(to instanceof HTMLElement) || node.contains(to) || to.closest('[data-floating]')) return;
      (getFocusable(node)[0] ?? node).focus({ preventScroll: true });
    };

    node.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const index = trapStack.lastIndexOf(node);
      if (index >= 0) trapStack.splice(index, 1);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, ref, initialFocus]);
}

/* ---- scroll lock ---- */

let scrollLocks = 0;
let restoreScroll: (() => void) | null = null;

/** Stops the page behind an overlay from scrolling. Counted, so stacked overlays release it together. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    if (scrollLocks === 0) {
      const root = document.documentElement;
      const { overflow, paddingRight } = root.style;
      const scrollbar = window.innerWidth - root.clientWidth;
      root.style.overflow = 'hidden';
      // Reserve the scrollbar's width so the page does not shift sideways.
      if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
      restoreScroll = () => {
        root.style.overflow = overflow;
        root.style.paddingRight = paddingRight;
      };
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        restoreScroll?.();
        restoreScroll = null;
      }
    };
  }, [active]);
}

/* ---- Escape ---- */

const escapeStack: Array<{ current: () => void }> = [];

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return;
  event.preventDefault();
  top.current();
}

/** Calls `onEscape` when Escape is pressed. With several layers open, only the top one closes. */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    if (escapeStack.length === 0) document.addEventListener('keydown', onDocumentKeyDown);
    escapeStack.push(handler);
    return () => {
      const index = escapeStack.lastIndexOf(handler);
      if (index >= 0) escapeStack.splice(index, 1);
      if (escapeStack.length === 0) document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [active]);
}

/* ---- presence ---- */

/**
 * Keeps an overlay mounted for `exitMs` after it closes so its leaving animation can play.
 * `state` is what the overlay puts on `data-state`.
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; state: 'open' | 'closed' } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);
  return { mounted: open || mounted, state: open ? 'open' : 'closed' };
}

/* ---- dialog ---- */

export interface DialogOptions {
  open: boolean;
  onClose: () => void;
  /** Escape and a press on the backdrop close it. Turn off only while an action cannot be interrupted. */
  dismissible: boolean;
  initialFocus?: RefObject<HTMLElement | null> | undefined;
  /** How long the leaving animation runs. */
  exitMs: number;
}

/** Everything Modal and Drawer share: presence, scroll lock, focus trap, Escape, and the ids that name the dialog. */
export function useDialog({ open, onClose, dismissible, initialFocus, exitMs }: DialogOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(open, exitMs);
  const id = useId();
  useScrollLock(mounted);
  useFocusTrap(panelRef, open, initialFocus);
  useEscapeKey(open && dismissible, onClose);
  return {
    mounted,
    state,
    panelRef,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
    onBackdrop: dismissible ? onClose : undefined,
  };
}

/* ---- outside press ---- */

/** Calls `onOutside` for a press that lands outside every one of `refs`. */
export function useOutsidePress(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  active: boolean,
  onOutside: () => void,
): void {
  const handler = useRef(onOutside);
  const targets = useRef(refs);
  useEffect(() => {
    handler.current = onOutside;
    targets.current = refs;
  });

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      const to = event.target;
      if (!(to instanceof Node)) return;
      if (targets.current.some((ref) => ref.current?.contains(to))) return;
      handler.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}

/* ---- floating position ---- */

export type Placement = 'bottom-start' | 'bottom' | 'bottom-end' | 'top-start' | 'top' | 'top-end';

const VIEWPORT_MARGIN = 8;

/**
 * Places a fixed-position layer next to its anchor. Flips above or below when there is no room,
 * stays inside the viewport, and follows the anchor on scroll and resize.
 */
export function useFloatingPosition(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement = 'bottom-start',
  gap = 8,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const a = anchor.current?.getBoundingClientRect();
      const node = floating.current;
      if (!a || !node) return;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const [side, align = 'center'] = placement.split('-') as ['top' | 'bottom', ('start' | 'end')?];

      const roomBelow = window.innerHeight - a.bottom - gap - VIEWPORT_MARGIN;
      const roomAbove = a.top - gap - VIEWPORT_MARGIN;
      const below = side === 'bottom' ? roomBelow >= height || roomBelow >= roomAbove : roomAbove < height && roomBelow > roomAbove;
      const top = below ? a.bottom + gap : a.top - gap - height;

      const wanted = align === 'start' ? a.left : align === 'end' ? a.right - width : a.left + a.width / 2 - width / 2;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(wanted, window.innerWidth - width - VIEWPORT_MARGIN));

      setStyle({ position: 'fixed', top: Math.round(top), left: Math.round(left) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchor, floating, placement, gap]);

  return style;
}
