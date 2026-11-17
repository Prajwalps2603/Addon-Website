import { cn } from '@/lib/cn';
import { TyreGlyph } from './tyre';

export interface RollingTyreProps {
  /** Diameter in px. */
  size?: number;
  /**
   * `spin` is the loading indicator (0.8 s a turn). `scroll` turns with the page's scroll progress
   * and is decorative. `still` is the tyre at rest, for empty states.
   */
  mode?: 'spin' | 'scroll' | 'still';
  /**
   * What is loading, read to screen readers and shown as text when motion is reduced. Only used by `spin`.
   * Pass '' inside a control that already announces itself as busy.
   */
  label?: string;
  className?: string;
}

/**
 * The tyre from the logo as the store's only loading indicator and scroll mark.
 * For page and list loading prefer skeletons; use the tyre for a button that is working or a route that is loading.
 */
export function RollingTyre({ size = 24, mode = 'spin', label = 'Loading', className }: RollingTyreProps) {
  const svg = (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      aria-hidden
      className={cn(
        'shrink-0',
        mode === 'spin' && 'animate-roll motion-reduce:animate-none',
        mode === 'scroll' && 'roll-scroll',
        (mode !== 'spin' || !label) && className,
      )}
    >
      <TyreGlyph />
    </svg>
  );

  // Decorative: a still or scroll-driven tyre, or a spinner whose surroundings already say what is happening.
  if (mode !== 'spin' || !label) return svg;

  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      {svg}
      {/* With motion reduced the tyre stands still, so the word does the work. */}
      <span className="sr-only type-small font-medium motion-reduce:not-sr-only">{label}</span>
    </span>
  );
}
