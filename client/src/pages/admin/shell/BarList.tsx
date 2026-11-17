import type { ReactNode } from 'react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';

export interface BarListRow {
  key: string;
  label: ReactNode;
  /** What the bar measures. */
  amount: number;
  /** The figure shown on the right, already formatted. */
  value: ReactNode;
  /** A quieter second figure under the value. */
  note?: ReactNode;
  to?: To;
}

export interface BarListProps {
  label: string;
  rows: readonly BarListRow[];
  className?: string;
}

/**
 * A short ranked list where each row carries a thin bar for its share of the largest row.
 * The figures are always written out: the bar only helps the eye compare.
 */
export function BarList({ label, rows, className }: BarListProps) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <ul aria-label={label} className={cn('grid', className)}>
      {rows.map((row) => {
        const width = `${Math.max(2, Math.round((row.amount / max) * 100))}%`;
        const name = row.to ? (
          <Link to={row.to} className="truncate font-bold after:absolute after:inset-0 focus-ring-inset">
            {row.label}
          </Link>
        ) : (
          <span className="truncate font-bold">{row.label}</span>
        );
        return (
          <li
            key={row.key}
            className={cn('relative grid gap-1.5 border-b border-line py-2.5', row.to && 'transition-colors dur-quick hover:bg-surface')}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex min-w-0">{name}</span>
              <span className="tnum shrink-0 text-right font-bold">
                {row.value}
                {row.note && <span className="type-small ml-2 font-normal text-muted">{row.note}</span>}
              </span>
            </div>
            <span aria-hidden className="block h-1 w-full bg-surface-2">
              <span className="block h-full bg-ink" style={{ width }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
