import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const VARIANTS = {
  /** A 1 px rule around content on the page. The default. */
  outline: 'border border-line bg-page',
  /** A grey plane with no border, for quieter grouped content. */
  surface: 'bg-surface',
  /** The lifted ground used by sheets and menus, with a rule. */
  raised: 'border border-line bg-raised',
  /** The pit board: black in the light theme, paper in the dark theme. Tokens inside re-scope themselves. */
  board: 'plane-board',
  /** The red plane, for the one thing on the page that must be seen. White ink; a primary Button on it turns black. */
  brand: 'plane-brand',
  /** Deprecated name of `brand`. */
  pit: 'plane-brand',
} as const;

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-8',
} as const;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  variant?: keyof typeof VARIANTS;
  padding?: keyof typeof PADDING;
  /** The whole card responds to hover: use when the card contains one stretched link. */
  interactive?: boolean;
}

/**
 * A flat, square-cornered region. No shadow, no rounding: separation comes from a 1 px rule
 * or a change of plane. Do not put a Card inside a Card; use a Divider or spacing instead.
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { as: Tag = 'div', variant = 'outline', padding = 'md', interactive = false, className, ...rest },
  ref,
) {
  return (
    <Tag
      {...rest}
      // The tag is chosen by the caller, so the ref's element type is the common base.
      ref={ref as never}
      className={cn(
        'relative min-w-0 rounded-[20px]',
        VARIANTS[variant],
        PADDING[padding],
        interactive && 'transition-colors duration-200 hover:border-line-strong',
        className,
      )}
    />
  );
});

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Title row of a card with `padding="none"`: sits above a rule. */
export function CardHeader({ className, ...rest }: CardSectionProps) {
  return <div {...rest} className={cn('flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5', className)} />;
}

export function CardBody({ className, ...rest }: CardSectionProps) {
  return <div {...rest} className={cn('p-4 md:p-5', className)} />;
}

/** Action row of a card with `padding="none"`: sits below a rule. */
export function CardFooter({ className, ...rest }: CardSectionProps) {
  return <div {...rest} className={cn('flex items-center justify-end gap-2 border-t border-line px-4 py-3 md:px-5', className)} />;
}
