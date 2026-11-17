import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { RollingTyre } from '@/components/brand/RollingTyre';

export interface EmptyStateProps {
  /** What is empty, said plainly: "Nothing saved yet", "No parts match these filters". */
  title: string;
  /** Why, and what to do about it. One or two sentences. */
  description?: ReactNode;
  /** The way out: one primary Button, at most one more. */
  actions?: ReactNode;
  /** Replaces the tyre. Pass null for no art. */
  art?: ReactNode;
  /** Left aligned by default, like the rest of the page. Centre it only inside a centred container such as a drawer. */
  align?: 'start' | 'center';
  /** `sm` for a panel or drawer, `md` for a whole page area. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * What a list shows when it has nothing to show. An empty state is a moment to be useful:
 * always give the next step.
 */
export function EmptyState({ title, description, actions, art, align = 'start', size = 'md', className }: EmptyStateProps) {
  return (
    <div
      data-empty-state=""
      className={cn(
        'flex flex-col gap-4',
        size === 'md' ? 'py-12 md:py-16' : 'py-8',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      {art === undefined ? <RollingTyre mode="still" size={size === 'md' ? 64 : 48} className="text-line-strong" /> : art}
      <div className="grid gap-2">
        <h2 className={size === 'md' ? 'type-h2' : 'type-h3'}>{title}</h2>
        {description && <p className="max-w-prose text-muted">{description}</p>}
      </div>
      {actions && <div className={cn('flex flex-wrap gap-2', align === 'center' && 'justify-center')}>{actions}</div>}
    </div>
  );
}
