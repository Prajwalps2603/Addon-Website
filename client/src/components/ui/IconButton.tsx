import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button, type ButtonProps, type ButtonSize } from './Button';

const SQUARE: Record<ButtonSize, string> = {
  sm: 'size-9 px-0',
  md: 'size-11 px-0',
  lg: 'size-13 px-0',
};

export type IconButtonProps = Omit<ButtonProps, 'children' | 'iconLeft' | 'iconRight' | 'block' | 'aria-label'> & {
  /** What the button does, in words. It is the accessible name and the tooltip, so it is required. */
  label: string;
  /** The icon, usually from lucide-react. */
  children: ReactNode;
};

/**
 * A square button that shows only an icon. Takes every Button prop, including `to` and `href`.
 * Defaults to the ghost variant: an icon rarely deserves a fill.
 */
export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...rest },
  ref,
) {
  const props = {
    ...rest,
    variant,
    size,
    'aria-label': label,
    title: rest.title ?? label,
    className: cn(SQUARE[size], '[&_svg]:size-5', className),
  } as ButtonProps;
  return (
    <Button ref={ref} {...props}>
      {children}
    </Button>
  );
});
