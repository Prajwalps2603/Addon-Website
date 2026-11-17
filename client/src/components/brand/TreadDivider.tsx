import { cn } from '@/lib/cn';

const TONES = {
  ink: 'text-ink',
  /** The logo's own red tread: a brand moment, at most once a page. */
  brand: 'text-brand',
  muted: 'text-line-strong',
  line: 'text-line',
} as const;

const SIZES = {
  sm: 'h-2',
  md: 'h-2.5',
  lg: 'h-3',
} as const;

export interface TreadDividerProps {
  /** `ink` for the break between major sections, `brand` for the one red break on a page, `line` and `muted` for quieter ones. */
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  /**
   * 0 to 1. Turns the strip into a progress track: the travelled part is Tread Red, the rest is line.
   * Only for real progress (checkout steps, order status, the way to free shipping).
   */
  progress?: number;
  /** Required with `progress`: what the progress measures, e.g. "Checkout progress". */
  label?: string;
  className?: string;
}

/** The tread strip from the logo tyre: the section break, and the track that fills as an order advances. */
export function TreadDivider({ tone = 'ink', size = 'md', progress, label, className }: TreadDividerProps) {
  if (progress === undefined) {
    return <div aria-hidden className={cn('tread w-full', SIZES[size], TONES[tone], className)} />;
  }

  const done = Math.min(1, Math.max(0, progress));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(done * 100)}
      className={cn('relative w-full', SIZES[size], className)}
    >
      <div className="tread absolute inset-0 h-full text-line" />
      <div
        className="tread absolute inset-0 h-full text-brand transition-[clip-path] dur-slow ease-settle"
        style={{ clipPath: `inset(0 ${round(100 - done * 100)}% 0 0)` }}
      />
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
