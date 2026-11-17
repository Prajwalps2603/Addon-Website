import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { To } from 'react-router';
import { prefersReducedMotion } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/types/api';
import { ProductCard, type ProductCardProps } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';
import { ScrollDots } from './ScrollDots';
import { SectionHeading } from './SectionHeading';

export interface ProductRailProps {
  title: string;
  /** The products. With none, and not loading, the rail renders nothing at all. */
  products?: readonly ProductSummary[] | undefined;
  /** True while the products are on their way: draws skeleton cards. */
  loading?: boolean;
  description?: ReactNode;
  /** The full list this rail is a taste of. */
  seeAll?: { to: To; label?: string };
  /** Passed to every card: see ProductCard. */
  vehicle?: ProductCardProps['vehicle'];
  compare?: boolean;
  /** The heading element, to suit the page outline. */
  as?: 'h2' | 'h3';
  className?: string;
}

const SKELETONS = 5;

/** Two cards and a peek of the third at 360 px, up to five and a peek on a desktop. */
const ITEM = 'w-[46%] min-w-0 shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[calc((100%-4*1.25rem)/4.4)] xl:w-[calc((100%-4*1.25rem)/4.6)]';

/**
 * A single row of products that scrolls sideways and snaps card by card: a swipe on a phone,
 * the arrow buttons or the Tab key on a desktop. The next card always peeks in, so it is clear
 * there is more. For "recently viewed", "works well with", "more in this category".
 */
export function ProductRail({ title, products, loading = false, description, seeAll, vehicle, compare = false, as = 'h2', className }: ProductRailProps) {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const items = products ?? [];
  const waiting = loading && items.length === 0;
  const count = waiting ? SKELETONS : items.length;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      const start = el.scrollLeft <= 2;
      const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2;
      setEdges((now) => (now.start === start && now.end === end ? now : { start, end }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const late = window.setTimeout(measure, 800);
    resize?.observe(el);
    if (el.firstElementChild) resize?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', measure);
      resize?.disconnect();
      window.clearTimeout(late);
    };
  }, [count]);

  if (count === 0) return null;

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  const arrowClass =
    'grid size-10 place-items-center rounded-full border border-line-strong bg-surface text-ink transition-colors dur-quick hover:border-ink hover:bg-ink hover:text-page disabled:pointer-events-none disabled:opacity-35';
  const arrows = (
    <div className="hidden gap-2 md:flex">
      <button type="button" aria-label={`Earlier in ${title}`} disabled={edges.start} onClick={() => page(-1)} className={arrowClass}>
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <button type="button" aria-label={`More of ${title}`} disabled={edges.end} onClick={() => page(1)} className={arrowClass}>
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  );

  return (
    <section aria-labelledby={headingId} className={cn('grid min-w-0 gap-5', className)}>
      <SectionHeading id={headingId} as={as} title={title} description={description} seeAll={seeAll} action={arrows} />
      <div className="relative min-w-0">
      <ul
        ref={scroller}
        aria-busy={waiting || undefined}
        // Padding (taken back by the margin) leaves room for the focus ring and the hover lift inside the clipped scroller.
        className="no-scrollbar -mx-1 -my-2 flex min-w-0 snap-x snap-mandatory scroll-p-1 gap-3 overflow-x-auto overscroll-x-contain px-1 py-2 md:gap-5"
      >
        {waiting
          ? Array.from({ length: SKELETONS }, (_, index) => (
              <li key={index} aria-hidden className={ITEM}>
                <ProductCardSkeleton />
              </li>
            ))
          : items.map((product) => (
              <li key={product.id} className={ITEM}>
                <ProductCard product={product} vehicle={vehicle} compare={compare} />
              </li>
            ))}
      </ul>
      </div>
      <ScrollDots target={scroller} label={title} className="-mt-2" />
    </section>
  );
}
