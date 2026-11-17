import { useCallback, useEffect, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ScrollDotsProps {
  /** The element that scrolls sideways. */
  target: RefObject<HTMLElement | null>;
  /** What the row holds, for screen readers: "Featured", "Builds". */
  label: string;
  /** `light` for rows on a dark background. */
  tone?: 'ink' | 'light';
  className?: string;
}

/**
 * Page dots under a sideways-scrolling row. One dot per screenful; the current one stretches into a
 * red pill that follows the scroll. Each dot jumps to its page. Renders nothing when the row fits.
 */
export function ScrollDots({ target, label, tone = 'ink', className }: ScrollDotsProps) {
  const [pages, setPages] = useState(1);
  const [current, setCurrent] = useState(0);

  const measure = useCallback(() => {
    const el = target.current;
    if (!el) return;
    const view = el.clientWidth || 1;
    const max = Math.max(0, el.scrollWidth - view);
    const count = max <= 4 ? 1 : Math.ceil(max / view) + 1;
    setPages(count);
    const at = max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (count - 1));
    setCurrent(Math.min(count - 1, Math.max(0, at)));
  }, [target]);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(el);
    if (el.firstElementChild) resize?.observe(el.firstElementChild);
    // Cards and photos arrive after the first paint; measure again once they have.
    const late = window.setTimeout(measure, 900);
    return () => {
      el.removeEventListener('scroll', measure);
      resize?.disconnect();
      window.clearTimeout(late);
    };
  }, [target, measure]);

  if (pages <= 1) return null;

  const goTo = (page: number) => {
    const el = target.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: (max * page) / (pages - 1), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const light = tone === 'light';

  return (
    <div role="group" aria-label={`${label}: page ${current + 1} of ${pages}`} className={cn('flex items-center justify-center gap-1.5 pt-1', className)}>
      {Array.from({ length: pages }, (_, page) => {
        const active = page === current;
        return (
          <button
            key={page}
            type="button"
            aria-label={`Show page ${page + 1} of ${label}`}
            aria-current={active ? 'true' : undefined}
            onClick={() => goTo(page)}
            // A 24 px tall hit area around a small dot.
            className="group/dot grid h-6 place-items-center"
          >
            <span
              className={cn(
                'block h-2 rounded-full transition-[width,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                active
                  ? 'w-7 bg-brand'
                  : cn('w-2', light ? 'bg-white/30 group-hover/dot:bg-white/60' : 'bg-line-strong group-hover/dot:bg-muted'),
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
