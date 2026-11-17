import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { useEscapeKey, useOutsidePress } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Drop } from '@/types/api';

/** The Friday Five while it is live, else null. Shares its cache with the Friday Five page. */
export function useLiveDrop(): Drop | null {
  const vehicleId = useActiveVehicle()?.id;
  const { data } = useQuery({
    queryKey: queryKeys.drop(vehicleId),
    queryFn: ({ signal }) => api.catalog.currentDrop({ vehicleId }, { signal }),
    staleTime: 5 * 60_000,
  });
  const [now, setNow] = useState(() => Date.now());
  const endsAt = data ? Date.parse(data.endsAt) : NaN;

  // Take the link down the moment the drop ends, without waiting for a refetch.
  useEffect(() => {
    if (!Number.isFinite(endsAt)) return;
    const wait = endsAt - Date.now();
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const timer = window.setTimeout(() => setNow(Date.now()), wait + 500);
    return () => window.clearTimeout(timer);
  }, [endsAt]);

  if (!data || !Number.isFinite(endsAt) || endsAt <= now) return null;
  return data;
}

/** True once the page has scrolled past `threshold` px. One passive listener, read in an animation frame. */
export function useScrolledPast(threshold = 8): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setPast(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return past;
}

/**
 * A header disclosure (Shop, Tools, Account): a button that shows a panel of links.
 * Closes on Escape (focus back on the button), on a press outside, when focus leaves, and on navigation.
 */
export function useDisclosure<T extends HTMLElement = HTMLButtonElement>() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<T | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { pathname } = useLocation();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEscapeKey(open, () => close(true));
  useOutsidePress([triggerRef, panelRef], open, () => close());

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /** Put on the element that wraps both the trigger and the panel. */
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
  };

  /** Put on the panel: a link to the page already showing changes no route, so close here as well. */
  const onPanelClick = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) setOpen(false);
  };

  return { open, setOpen, close, triggerRef, panelRef, onBlur, onPanelClick };
}

/** Moves focus between the links of a panel with the arrow keys, Home and End. Returns true when it handled the key. */
export function moveFocusWithin(container: HTMLElement | null, key: string, selector = 'a[href],button:not([disabled])'): boolean {
  if (!container) return false;
  const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return false;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: HTMLElement | undefined;
  if (key === 'ArrowDown') next = items[index < 0 ? 0 : (index + 1) % items.length];
  else if (key === 'ArrowUp') next = items[index <= 0 ? items.length - 1 : index - 1];
  else if (key === 'Home') next = items[0];
  else if (key === 'End') next = items[items.length - 1];
  if (!next) return false;
  next.focus();
  return true;
}
