import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useCountdown, type Countdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductDrop } from '@/types/api';

export interface DropBadgeProps {
  /** `ProductSummary.drop`, or one item of a Drop with the drop's `endsAt`. */
  drop: Pick<ProductDrop, 'percentOff' | 'endsAt'> & Partial<Pick<ProductDrop, 'reason'>>;
  /** `compact` is the marker on a card. `full` adds seconds and the owner's reason: the product page, the drop page. */
  variant?: 'compact' | 'full';
  className?: string;
}

const two = (value: number): string => String(value).padStart(2, '0');

/** The two largest units: enough to judge the time left at a glance on a card. */
function shortLeft({ days, hours, minutes, seconds }: Countdown): string {
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${two(minutes)}m`;
  return `${minutes}m ${two(seconds)}s`;
}

function fullLeft({ days, hours, minutes, seconds }: Countdown): string {
  return `${days > 0 ? `${days}d ` : ''}${two(hours)}h ${two(minutes)}m ${two(seconds)}s`;
}

/** What a screen reader hears: it changes once a minute, not once a second. */
function spokenLeft({ days, hours, minutes }: Countdown): string {
  const parts = [days > 0 && pluralize(days, 'day'), (days > 0 || hours > 0) && pluralize(hours, 'hour'), pluralize(minutes, 'minute')];
  return `Ends in ${parts.filter(Boolean).join(' ')}`;
}

/**
 * Marks a product in a live drop (the Friday Five): the percent off and a clock counting down to
 * the drop's real end time. When the clock runs out the marker goes and prices are fetched again,
 * so an ended drop is never left on screen.
 */
export function DropBadge({ drop, variant = 'compact', className }: DropBadgeProps) {
  const queryClient = useQueryClient();
  const left = useCountdown(drop.endsAt);
  const wasLive = useRef(false);

  useEffect(() => {
    if (!left.isOver) {
      wasLive.current = true;
      return;
    }
    if (!wasLive.current) return;
    wasLive.current = false;
    // The drop ended while on screen: every price that carried it is now out of date.
    const stale = [queryKeys.products.all(), [queryKeys.home()[0]], [queryKeys.drop()[0]], queryKeys.cart.all()];
    for (const queryKey of stale) void queryClient.invalidateQueries({ queryKey });
  }, [left.isOver, queryClient]);

  if (left.isOver) return null;

  // On a card the marker shares a 160 px frame with the save button, so it carries the figure alone.
  const badge = (
    <Badge tone="brand" variant="solid" icon={<TrendingDown aria-hidden />}>
      <span className={variant === 'compact' ? 'sr-only' : undefined}>Drop </span>
      {drop.percentOff}% off
    </Badge>
  );
  const clock = (
    <span role="timer" className="tnum">
      <span className="sr-only">{spokenLeft(left)}</span>
      <span aria-hidden>{variant === 'compact' ? `${shortLeft(left)} left` : `Ends in ${fullLeft(left)}`}</span>
    </span>
  );

  if (variant === 'compact') {
    return (
      <span className={cn('inline-flex flex-col items-start gap-1', className)}>
        {badge}
        <span className="rounded-control bg-page px-1.5 py-0.5 text-[0.75rem] leading-tight font-bold text-ink">{clock}</span>
      </span>
    );
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {badge}
        <span className="type-small font-bold">{clock}</span>
      </div>
      {drop.reason && <p className="type-small max-w-prose">{drop.reason}</p>}
    </div>
  );
}
