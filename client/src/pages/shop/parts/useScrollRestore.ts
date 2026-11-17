import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

const PREFIX = 'addon-shop-scroll:';

function read(key: string): number | null {
  try {
    const value = window.sessionStorage.getItem(key);
    const y = value === null ? NaN : Number(value);
    return Number.isFinite(y) && y > 0 ? y : null;
  } catch {
    return null;
  }
}

function write(key: string, y: number): void {
  try {
    window.sessionStorage.setItem(key, String(Math.round(y)));
  } catch {
    // Storage blocked (private mode): Back simply lands at the top.
  }
}

/**
 * Puts the shopper back where they were in a long list when they come back to it with Back.
 * The position is remembered per history entry; it is restored once the list (every page that
 * "Show more" had loaded) is on screen again, which is what `ready` says.
 */
export function useScrollRestore(ready: boolean): void {
  const location = useLocation();
  const navigationType = useNavigationType();
  const key = PREFIX + location.key;
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => write(key, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [key]);

  useEffect(() => {
    if (!ready || navigationType !== 'POP' || restoredFor.current === key) return;
    restoredFor.current = key;
    const y = read(key);
    if (y === null) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [ready, navigationType, key]);
}
