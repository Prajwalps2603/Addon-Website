import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface ProductCardSkeletonProps {
  className?: string;
}

/** The shape of a ProductCard while its data loads: the square frame, then name, price and fit lines. */
export function ProductCardSkeleton({ className }: ProductCardSkeletonProps) {
  return (
    <div aria-hidden className={cn('flex min-w-0 flex-col', className)}>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="grid gap-2 pt-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-1 h-5 w-24" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}
