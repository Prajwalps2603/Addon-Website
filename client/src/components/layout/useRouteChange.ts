import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useUi } from '@/stores/ui';

const GIVE_UP_MS = 5000;

/**
 * Puts keyboard and screen-reader focus on the new page's <h1>, so the page is announced by its
 * name and Tab continues from the top of it. Pages load lazily and may draw their heading after
 * their data arrives, so it waits for the heading to appear. It never takes focus away from a
 * field the page focused itself or from an open dialog.
 */
function focusPageHeading(): () => void {
  let observer: MutationObserver | null = null;
  let timer = 0;
  let frame = 0;

  const tryFocus = (): boolean => {
    const main = document.getElementById('main');
    if (!main) return false;
    // A dialog that is open (not one still playing its closing animation) keeps focus.
    if (document.querySelector('[aria-modal="true"]:not([data-state="closed"])')) return true;
    const current = document.activeElement;
    if (current instanceof HTMLElement && current !== document.body && main.contains(current) && current !== main) return true;
    const heading = main.querySelector<HTMLElement>('h1');
    if (!heading) return false;
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    // The heading is a landing point, not a control: no ring while it holds focus.
    heading.style.outline = 'none';
    heading.addEventListener('blur', () => heading.style.removeProperty('outline'), { once: true });
    heading.focus({ preventScroll: true });
    return true;
  };

  const stop = () => {
    observer?.disconnect();
    observer = null;
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
  };

  // A frame later, so a closing overlay has handed focus back first.
  frame = window.requestAnimationFrame(() => {
    if (tryFocus()) return;
    const main = document.getElementById('main');
    if (!main) return;
    observer = new MutationObserver(() => {
      if (tryFocus()) stop();
    });
    observer.observe(main, { childList: true, subtree: true });
    timer = window.setTimeout(stop, GIVE_UP_MS);
  });

  return stop;
}

/** On every new page: close any open overlay and move focus to the page heading. Not on the first load. */
export function useRouteChange(): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    useUi.getState().closeAll();
    return focusPageHeading();
  }, [pathname]);
}
