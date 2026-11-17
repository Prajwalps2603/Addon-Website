import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const SIZES = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-base',
} as const;

const TONES = {
  /** White disc, black numeral: the race number. */
  paper: 'border-frame-ink bg-frame text-frame-ink',
  /** The step or position that is live right now: Tread Red. */
  brand: 'border-brand bg-brand text-brand-ink',
  /** Deprecated name of `brand`. */
  pit: 'border-brand bg-brand text-brand-ink',
  /** Done, or the leader. */
  ink: 'border-ink bg-ink text-page',
  /** Not reached yet. */
  ghost: 'border-line-strong bg-transparent text-muted',
} as const;

export interface RoundelProps {
  /** A position or step number, or a tick icon for a finished step. */
  children: ReactNode;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * The race-number roundel. Only where order is real: a position in a ranked list or a step in a process.
 * Never as decoration beside a heading.
 */
export function Roundel({ children, tone = 'paper', size = 'md', className }: RoundelProps) {
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full border font-extrabold italic leading-none tnum',
        SIZES[size],
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
