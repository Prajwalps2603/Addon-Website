import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface VisuallyHiddenProps extends HTMLAttributes<HTMLElement> {
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3';
}

/**
 * Text for screen readers only: the words an icon, a colour or a layout says to the eye.
 * Example: <VisuallyHidden>Price before discount</VisuallyHidden> before a struck MRP.
 */
export function VisuallyHidden({ as: Tag = 'span', className, ...rest }: VisuallyHiddenProps) {
  return <Tag {...rest} className={cn('sr-only', className)} />;
}
