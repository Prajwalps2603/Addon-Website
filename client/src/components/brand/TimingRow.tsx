import type { ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';
import { Roundel } from './Roundel';

const DELTA_TONES = {
  /** Better for the shopper: a price drop, a climb. */
  gain: 'text-fit',
  /** Worse: a price rise, a fall. */
  loss: 'text-stop',
  /** A genuine best: lowest price in 30 days, top seller this week. */
  best: 'bg-best text-best-ink px-1.5',
  none: 'text-muted',
} as const;

export interface TimingTowerProps {
  /** What the ranking is and what it is based on, e.g. "Best sellers this week, by units". Read by screen readers. */
  label: string;
  children: ReactNode;
  className?: string;
}

/** The list that holds TimingRows. Only for lists ranked by real data. */
export function TimingTower({ label, children, className }: TimingTowerProps) {
  return (
    <ol aria-label={label} className={cn('', className)}>
      {children}
    </ol>
  );
}

export interface TimingRowProps {
  /** Rank from real data, starting at 1. */
  position: number;
  title: ReactNode;
  /** Second line under the title: the car it fits, the SKU. */
  subtitle?: ReactNode;
  /** A small square thumbnail. */
  media?: ReactNode;
  /** The figure the list is ranked on or the price, right aligned in tabular figures. */
  value: ReactNode;
  /** The change beside the value. Always words or figures, e.g. "-₹400" or "Lowest in 30 days". */
  delta?: { label: ReactNode; tone?: keyof typeof DELTA_TONES };
  /** Makes the whole row a link. */
  to?: To;
  className?: string;
}

/** One row of a timing tower: position roundel, name, figure, change. */
export function TimingRow({ position, title, subtitle, media, value, delta, to, className }: TimingRowProps) {
  const leader = position === 1;
  return (
    <li
      className={cn(
        'relative grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line py-2.5',
        to && 'transition-colors dur-quick hover:bg-surface',
        className,
      )}
    >
      <span className="flex items-center gap-3">
        <span className="sr-only">Position </span>
        <Roundel tone={leader ? 'brand' : 'paper'}>{position}</Roundel>
        {media && <span className="size-11 shrink-0 overflow-hidden bg-frame">{media}</span>}
      </span>
      <span className="min-w-0">
        {to ? (
          <Link to={to} className="block truncate font-bold after:absolute after:inset-0 focus-ring-inset">
            {title}
          </Link>
        ) : (
          <span className="block truncate font-bold">{title}</span>
        )}
        {subtitle && <span className="type-small block truncate text-muted">{subtitle}</span>}
      </span>
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span className="type-price">{value}</span>
        {delta && (
          <span className={cn('type-label tnum', DELTA_TONES[delta.tone ?? 'none'])}>{delta.label}</span>
        )}
      </span>
    </li>
  );
}
