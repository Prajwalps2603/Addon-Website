import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** `line` is the quiet 1 px rule; `strong` is the ink rule that opens a table or a total. */
  tone?: 'line' | 'strong';
  /** A word in the middle of a horizontal rule, such as "or". */
  label?: ReactNode;
  className?: string;
}

/** A crisp 1 px rule. For the break between page sections, use TreadDivider. */
export function Divider({ orientation = 'horizontal', tone = 'line', label, className }: DividerProps) {
  const colour = tone === 'strong' ? 'bg-ink' : 'bg-line';

  if (orientation === 'vertical') {
    return <span role="separator" aria-orientation="vertical" className={cn('inline-block w-px self-stretch', colour, className)} />;
  }

  if (label) {
    return (
      <div role="separator" className={cn('flex items-center gap-3', className)}>
        <span className={cn('h-px flex-1', colour)} />
        <span className="type-small text-muted">{label}</span>
        <span className={cn('h-px flex-1', colour)} />
      </div>
    );
  }

  return <hr className={cn('h-px w-full border-0', colour, className)} />;
}
