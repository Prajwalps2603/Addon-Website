import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface StockNoteProps {
  /** A product or a variant. `lowStock` is only on products; without it no "few left" claim is made. */
  stock: number;
  inStock: boolean;
  lowStock?: boolean;
  /** `compact` says nothing while stock is healthy (cards). `full` also confirms "In stock" (product page). */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Stock in words, from real stock only: "Sold out", "Only 3 left", or "In stock".
 * There is no invented urgency here: the low-stock line appears only when the API says so.
 */
export function StockNote({ stock, inStock, lowStock = false, variant = 'compact', className }: StockNoteProps) {
  const text = cn('flex items-center gap-1.5 font-bold', variant === 'compact' ? 'text-[0.8125rem] leading-snug' : 'type-small', className);

  if (!inStock) {
    return (
      <p className={cn(text, 'text-stop')}>
        <CircleX aria-hidden className="size-4 shrink-0" />
        Sold out
      </p>
    );
  }
  if (lowStock && stock > 0) {
    return (
      <p className={cn(text, 'text-warn')}>
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        <span className="tnum">Only {formatNumber(stock)} left</span>
      </p>
    );
  }
  if (variant === 'compact') return null;
  return (
    <p className={cn(text, 'text-fit')}>
      <CircleCheck aria-hidden className="size-4 shrink-0" />
      In stock
    </p>
  );
}
