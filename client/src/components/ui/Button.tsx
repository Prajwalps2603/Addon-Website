import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';
import { RollingTyre } from '@/components/brand/RollingTyre';

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  /** Tread Red fill, white ink. One per view: the thing we want the shopper to do next. On the red plane it turns black. */
  primary: 'type-button bg-brand text-brand-ink hover:bg-brand-press',
  /** Ink fill. The strong second action, and the main action where red is already the ground. */
  dark: 'type-button bg-ink text-page hover:bg-ink-2',
  /** 1 px ink outline that fills on hover. Secondary actions. */
  outline: 'type-button border border-ink text-ink hover:bg-ink hover:text-page',
  /** No box until hovered. Tertiary actions, toolbars, "Cancel". */
  ghost: 'text-[length:var(--button-text,0.9375rem)] font-bold text-ink hover:bg-surface-2',
  /**
   * Destructive actions only: delete, cancel an order. Drawn as an outlined, tinted box in the danger
   * colour (never a red fill), so it cannot be mistaken for the red primary button. Give it an icon.
   */
  danger: 'type-button border border-stop bg-stop-soft text-stop hover:bg-stop hover:text-stop-ink',
  /** Reads as a text link but keeps a button's hit area and loading state. */
  link: 'text-[length:var(--button-text,0.9375rem)] font-bold text-ink underline decoration-1 underline-offset-4 hover:decoration-2',
};

const SIZES: Record<ButtonSize, string> = {
  /** 36 px tall with a 44 px hit area. Dense rows and admin tables. */
  sm: 'tap-44 h-9 gap-1.5 px-3 [--button-text:0.8125rem]',
  /** 44 px. The default everywhere. */
  md: 'h-11 gap-2 px-5',
  /** 52 px. The one main action of a page: Add to cart, Place order. */
  lg: 'h-13 gap-2.5 px-7 [--button-text:1rem]',
};

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows the rolling tyre, sets aria-busy and blocks further presses. The label stays, so the width does not jump. */
  loading?: boolean;
  /** Full width of its container. */
  block?: boolean;
  /** An icon before the label (a lucide icon at its default size is fine: it is sized here). */
  iconLeft?: ReactNode;
  /** An icon after the label. */
  iconRight?: ReactNode;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

type AsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps> & { to?: undefined; href?: undefined };

type AsRouterLink = ButtonOwnProps &
  Omit<LinkProps, keyof ButtonOwnProps | 'to'> & { to: LinkProps['to']; href?: undefined };

type AsAnchor = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps | 'href'> & { href: string; to?: undefined };

/** With `to` it renders a react-router Link, with `href` a plain anchor, otherwise a button. */
export type ButtonProps = AsButton | AsRouterLink | AsAnchor;

function swallow(event: MouseEvent<HTMLElement>): void {
  event.preventDefault();
}

/**
 * The store's button. Filled variants shout in italic capitals; ghost and link speak in sentence case.
 * Give it a verb that says what happens: "Add to cart", "Show what fits", not "Submit".
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    block: fullWidth = false,
    iconLeft,
    iconRight,
    disabled = false,
    className,
    children,
    ...rest
  } = props;

  const inactive = disabled || loading;
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center rounded-control whitespace-nowrap select-none',
    'transition-[background-color,color,border-color,transform] dur-quick ease-settle',
    'active:scale-[0.97] [&_svg]:size-[1.15em] [&_svg]:shrink-0',
    variant === 'link' ? 'h-auto gap-1.5 px-0' : SIZES[size],
    VARIANTS[variant],
    fullWidth && 'flex w-full',
    inactive && 'pointer-events-none',
    disabled && 'opacity-45',
    className,
  );

  const content = (
    <>
      {loading ? <RollingTyre size={18} label="" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </>
  );

  if (rest.to !== undefined) {
    const { to, onClick, ...linkRest } = rest;
    return (
      <Link
        {...linkRest}
        ref={ref as Ref<HTMLAnchorElement>}
        to={to}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : linkRest.tabIndex}
        onClick={inactive ? swallow : onClick}
        className={classes}
      >
        {content}
      </Link>
    );
  }

  if (rest.href !== undefined) {
    const { href, onClick, ...anchorRest } = rest;
    return (
      <a
        {...anchorRest}
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : anchorRest.tabIndex}
        onClick={inactive ? swallow : onClick}
        className={classes}
      >
        {content}
      </a>
    );
  }

  const { type = 'button', ...buttonRest } = rest as Omit<AsButton, keyof ButtonOwnProps>;
  return (
    <button
      {...buttonRest}
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? swallow : buttonRest.onClick}
      className={classes}
    >
      {content}
    </button>
  );
});
