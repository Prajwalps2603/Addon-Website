import { Link } from 'react-router';
import { DemoBadge } from '@/components/commerce';
import { Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import type { Build } from '@/types/api';
import { BODY_LABELS } from './CarControls';
import { fittedSlots } from './codec';
import { StageFrame } from './StageFrame';

export interface BuildCardProps {
  build: Build;
  /** The lead build of the gallery: the title set larger. */
  lead?: boolean;
  className?: string;
}

/** A build in the gallery: the car drawn from its state, the name, the car, parts and total. One link. */
export function BuildCard({ build, lead = false, className }: BuildCardProps) {
  const parts = fittedSlots(build.state).length;
  const car = build.vehicleLabel || BODY_LABELS[build.state.bodyType] || 'Car';
  return (
    <article className={cn('group relative grid content-start gap-3', className)}>
      <StageFrame
        state={build.state}
        static
        corner={
          (build.isHouse || build.isDemo) && (
            <>
              {build.isHouse && (
                <Badge tone="brand" variant="solid" size="sm">
                  Built by Addon
                </Badge>
              )}
              {build.isDemo && <DemoBadge variant="solid" />}
            </>
          )
        }
        className="transition-opacity dur-quick group-hover:opacity-90"
      />
      <div className="grid gap-1">
        <h2 className={cn(lead ? 'type-title' : 'type-h3', 'leading-tight')}>
          <Link to={`/builds/${build.slug}`} className="focus-ring after:absolute after:inset-0 hover:underline hover:decoration-2 hover:underline-offset-4">
            {build.title}
          </Link>
        </h2>
        <p className="type-small text-muted">
          {car}
          {build.authorName && <> · by {build.authorName}</>}
        </p>
      </div>
      <dl className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <div className="flex items-baseline gap-1.5">
          <dt className="sr-only">Parts</dt>
          <dd className="type-small tnum">{parts ? pluralize(parts, 'part') : 'Stock'}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="type-small text-muted">Total</dt>
          <dd className="type-price tnum">{formatINR(build.total)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function BuildCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('grid content-start gap-3', className)}>
      <Skeleton className="aspect-[1200/620] w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-6 w-full" />
    </div>
  );
}
