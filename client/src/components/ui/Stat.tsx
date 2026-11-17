import { CountUp } from './CountUp';
import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface StatDelta {
  /** The change in words and figures: "+12% on last week", "3 fewer than yesterday". */
  label: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news. Up is good for revenue, bad for returns. Default: up is good. */
  good?: boolean;
}

export interface StatProps {
  /** What is counted, e.g. "Orders today". */
  label: string;
  /** The figure, already formatted: formatINR(48250), "37", "92%". */
  value: ReactNode;
  delta?: StatDelta;
  /** A quiet line under the figure: the period, the basis. */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Makes the tile a link to the list behind the number. */
  to?: To;
  loading?: boolean;
  className?: string;
}

/** A KPI tile for the admin dashboard: one real number, its change, and where it leads. */
export function Stat({ label, value, delta, hint, icon, to, loading = false, className }: StatProps) {
  const good = delta ? (delta.good ?? delta.direction === 'up') : false;
  const DeltaIcon = delta?.direction === 'up' ? ArrowUpRight : delta?.direction === 'down' ? ArrowDownRight : Minus;

  const body = (
    <>
      <div className="flex min-h-5 items-start justify-between gap-3">
        <p className="type-label text-muted">{label}</p>
        {icon && <span className="text-muted [&_svg]:size-5">{icon}</span>}
      </div>
      {loading ? <Skeleton className="mt-3 h-9 w-28" /> : <p className="type-stat mt-3">{typeof value === 'string' ? <CountUp value={value} /> : value}</p>}
      {(delta || hint) && !loading && (
        <div className="type-small mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-bold tnum',
                delta.direction === 'flat' ? 'text-muted' : good ? 'text-fit' : 'text-stop',
              )}
            >
              <DeltaIcon aria-hidden className="size-4 shrink-0" />
              {delta.label}
            </span>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </>
  );

  const box = cn('block min-w-0 rounded-[20px] bg-surface p-5', className);
  if (to !== undefined) {
    return (
      <Link to={to} className={cn(box, 'transition-colors duration-200 hover:bg-surface-2')}>
        {body}
      </Link>
    );
  }
  return <div className={box}>{body}</div>;
}
