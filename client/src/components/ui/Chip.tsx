import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Whether the filter is on. Announced as a pressed toggle button. */
  selected?: boolean;
  /** Result count shown after the label, from real data. */
  count?: number;
  icon?: ReactNode;
  /**
   * Shows a cross after the label: for an applied filter that one press takes away. A removable chip is a
   * remove button, not a toggle, so it is not announced as pressed; screen readers hear "remove" after the label.
   */
  removable?: boolean;
  size?: 'sm' | 'md';
}

/**
 * A filter chip: a toggle the shopper presses to narrow a list ("In stock", "Fits my car", "Under ₹2,000").
 * Selected chips turn to ink. For a status that cannot be pressed, use Badge.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, count, icon, removable = false, size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      aria-pressed={removable ? undefined : selected}
      className={cn(
        'tap-44 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent font-semibold whitespace-nowrap select-none',
        'transition-colors dur-quick active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        size === 'sm' ? 'h-8 px-3 text-[0.8125rem]' : 'h-9 px-3.5 text-sm',
        selected ? 'bg-ink text-page' : 'bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {icon}
      {children}
      {count !== undefined && <span className={cn('font-normal tnum', selected ? 'opacity-75' : 'text-muted')}>{count}</span>}
      {removable && (
        <>
          <span className="sr-only">, remove</span>
          <X aria-hidden />
        </>
      )}
    </button>
  );
});
