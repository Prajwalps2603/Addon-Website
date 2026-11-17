import { useLocation } from 'react-router';
import { PackageSearch } from 'lucide-react';
import { Button, EmptyState, Skeleton, SkeletonText } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { loginPath } from '@/lib/urls';

/** Laid out like the order view, so nothing jumps when it arrives. */
export function OrderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the order" className="grid gap-8 pt-4 pb-16 md:gap-10 md:pt-6">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div className="grid content-start gap-8">
          <Skeleton className="h-36 w-full" />
          <div className="grid gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 md:flex-col md:items-start">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1fr)]">
                <Skeleton className="aspect-square w-full" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-6">
          <SkeletonText lines={3} />
          <SkeletonText lines={5} />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * One state for "not found", "not yours" and "sign in": it never says whether an order with that
 * number exists. It offers the two honest ways in: look it up with the phone, or sign in.
 */
export function OrderUnavailable({ orderNumber }: { orderNumber?: string }) {
  const location = useLocation();
  const { isSignedIn } = useMe();
  const track = orderNumber ? `/track?orderNumber=${encodeURIComponent(orderNumber)}` : '/track';
  return (
    <div role="alert" className="py-10">
      <EmptyState
        title="We cannot show this order"
        description="The link may be incomplete, or the order belongs to another account. Look it up with the order number and the phone number used to order it."
        art={<PackageSearch aria-hidden strokeWidth={1.5} className="size-14 text-line-strong" />}
        actions={
          <>
            <Button variant="dark" to={track}>
              Find it with your phone
            </Button>
            {!isSignedIn && (
              <Button variant="outline" to={loginPath(location.pathname + location.search)}>
                Sign in
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
