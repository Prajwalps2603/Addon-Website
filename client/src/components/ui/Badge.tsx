import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The tones a page may key a lookup on. `pit` is the old name of the Tread Red badge and still works;
 * new code passes `tone="brand"` (see BadgeToneName). `brand` joins this union once pages that build a
 * Record<BadgeTone, ...> have added it.
 */
export type BadgeTone = 'neutral' | 'ink' | 'pit' | 'fit' | 'warn' | 'stop' | 'info' | 'best';
/** Every tone Badge accepts. */
export type BadgeToneName = BadgeTone | 'brand';
export type BadgeVariant = 'solid' | 'soft' | 'outline';

const BRAND = {
  solid: 'bg-brand text-brand-ink',
  soft: 'bg-brand-soft text-ink',
  outline: 'border border-ink bg-brand-soft text-ink',
} as const;

const STYLES: Record<BadgeVariant, Record<BadgeToneName, string>> = {
  solid: {
    neutral: 'bg-surface-2 text-ink',
    ink: 'bg-ink text-page',
    brand: BRAND.solid,
    pit: BRAND.solid,
    fit: 'bg-fit text-fit-ink',
    warn: 'bg-warn text-warn-ink',
    // Danger is never a plain red fill: a keyline sets it apart from the brand badge.
    stop: 'bg-stop text-stop-ink outline-1 -outline-offset-[3px] outline-stop-ink/50',
    info: 'bg-info text-info-ink',
    best: 'bg-best text-best-ink',
  },
  soft: {
    neutral: 'bg-surface text-muted',
    ink: 'bg-surface-2 text-ink',
    brand: BRAND.soft,
    pit: BRAND.soft,
    fit: 'bg-fit-soft text-fit',
    warn: 'bg-warn-soft text-warn',
    stop: 'border border-stop bg-stop-soft text-stop',
    info: 'bg-info-soft text-info',
    best: 'bg-best-soft text-best',
  },
  outline: {
    neutral: 'border border-line-strong text-muted',
    ink: 'border border-ink text-ink',
    brand: BRAND.outline,
    pit: BRAND.outline,
    fit: 'border border-fit text-fit',
    warn: 'border border-warn text-warn',
    stop: 'border border-stop text-stop',
    info: 'border border-info text-info',
    best: 'border border-best text-best',
  },
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * What the badge means. `fit` in stock, fits, price drop. `warn` low stock, needs a workshop.
   * `stop` sold out, does not fit, errors: always with an icon. `best` a genuine best only.
   * `brand` the store's own highlight in Tread Red (an offer, a live drop). `pit` is its old name.
   */
  tone?: BadgeToneName;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  /** A small icon before the text. State badges should carry one: colour is never the only signal. */
  icon?: ReactNode;
}

/** A short status label beside the thing it describes. Two or three words, from real data. */
export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-control type-label whitespace-nowrap tnum [&_svg]:size-3.5 [&_svg]:shrink-0',
        size === 'sm' ? 'h-5 px-1.5 text-[0.6875rem]' : 'h-6 px-2',
        STYLES[variant][tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
