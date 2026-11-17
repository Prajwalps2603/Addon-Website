import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/types/api';
import { ProductCard, type ProductCardProps } from './ProductCard';
import { ProductCardSkeleton } from './ProductCardSkeleton';

export interface ProductGridProps {
  /** The products to show. Leave undefined while the first request is running. */
  products?: readonly ProductSummary[] | undefined;
  /** True while there is nothing to show yet (the query's `isPending`): draws skeleton cards. */
  loading?: boolean;
  /** How many skeleton cards to draw. Match the page size so the page does not jump. */
  skeletons?: number;
  /** True while a new page or filter loads behind the old results (`isPlaceholderData`): dims the grid. */
  updating?: boolean;
  /** Columns on a wide desktop. Always two at 360 px and three at 768 px. */
  columns?: 4 | 5;
  /** How many photos to load at once, from the first card. Set it on the grid at the top of a page. */
  eagerCount?: number;
  /** Shown when there are no products. Say why and offer the way out (clear filters, change car). */
  empty?: ReactNode;
  /** Passed to every card: see ProductCard. */
  vehicle?: ProductCardProps['vehicle'];
  compare?: boolean;
  /** Names the list for screen readers, e.g. "Alloy wheels". */
  label?: string;
  className?: string;
}

const COLUMNS = {
  4: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
} as const;

/**
 * The product grid: two columns on a phone, up to four or five on a desktop.
 * It covers the three states of a list itself: skeleton cards while loading, the `empty` slot
 * when there is nothing, and the cards.
 */
export function ProductGrid({
  products,
  loading = false,
  skeletons = 8,
  updating = false,
  columns = 4,
  eagerCount = 0,
  empty,
  vehicle,
  compare = false,
  label = 'Products',
  className,
}: ProductGridProps) {
  const grid = cn('grid gap-x-3 gap-y-8 md:gap-x-4', COLUMNS[columns], className);
  const items = products ?? [];

  if (items.length === 0 && (loading || products === undefined)) {
    return (
      <div role="status" className={grid}>
        <span className="sr-only">Loading {label.toLowerCase()}</span>
        {Array.from({ length: skeletons }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <>{empty ?? <EmptyState size="sm" title="No parts to show" description="Nothing matches here yet. Try another category." />}</>;
  }

  return (
    <ul aria-label={label} aria-busy={updating || undefined} className={cn(grid, 'transition-opacity dur-base', updating && 'opacity-50')}>
      {items.map((product, index) => (
        <li key={product.id} className="min-w-0">
          <ProductCard product={product} eager={index < eagerCount} vehicle={vehicle} compare={compare} />
        </li>
      ))}
    </ul>
  );
}
