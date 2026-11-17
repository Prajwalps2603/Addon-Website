import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

export interface OnScreenOptions {
  /** Grow or shrink the viewport edge, for example '200px' to start loading just before it scrolls in. */
  rootMargin?: string;
  /** How much of the element must be visible, 0 to 1. */
  threshold?: number;
  /** Stay true after the first sighting (lazy loading, one-time reveals). */
  once?: boolean;
}

/**
 * Tells whether an element is in view.
 *   const [ref, visible] = useOnScreen<HTMLDivElement>({ once: true, rootMargin: '200px' });
 *   <div ref={ref}>{visible && <Heavy />}</div>
 */
export function useOnScreen<T extends Element>(options: OnScreenOptions = {}): [RefCallback<T>, boolean] {
  const { rootMargin = '0px', threshold = 0, once = false } = options;
  const [visible, setVisible] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  const ref = useCallback<RefCallback<T>>(
    (node) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node) return;
      if (typeof IntersectionObserver === 'undefined') {
        setVisible(true);
        return;
      }
      observer.current = new IntersectionObserver(
        (entries) => {
          const seen = entries.some((entry) => entry.isIntersecting);
          if (seen && once) observer.current?.disconnect();
          setVisible((before) => (once ? before || seen : seen));
        },
        { rootMargin, threshold },
      );
      observer.current.observe(node);
    },
    [rootMargin, threshold, once],
  );

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, visible];
}
