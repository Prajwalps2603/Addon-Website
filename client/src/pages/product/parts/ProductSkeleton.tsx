import { Skeleton, SkeletonText } from '@/components/ui';

/** The product page while it loads, laid out like the finished page so nothing jumps. */
export function ProductSkeleton() {
  return (
    <div className="container-page pt-4 pb-16" aria-busy="true" aria-label="Loading the part">
      <Skeleton className="mb-4 h-4 w-56 max-w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid content-start gap-3">
          <Skeleton className="aspect-square w-full" />
          <div className="hidden grid-cols-6 gap-2 md:grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>
        <div className="grid content-start gap-5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-9 w-11/12" />
          <Skeleton className="h-8 w-40" />
          <SkeletonText lines={2} />
          <div className="flex gap-3">
            <Skeleton className="h-13 w-32" />
            <Skeleton className="h-13 flex-1" />
          </div>
          <Skeleton className="h-13 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    </div>
  );
}
