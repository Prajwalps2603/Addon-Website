import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** A key on the keyboard, for shortcut hints on desktop: <Kbd>Esc</Kbd>, <Kbd>/</Kbd>. */
export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      {...rest}
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-control border border-line-strong bg-surface px-1.5 font-mono text-[0.6875rem] leading-none font-medium text-ink',
        className,
      )}
    />
  );
}
