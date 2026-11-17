import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * A placeholder block in the shape of what is loading. Size it with className (h-*, w-*, aspect-*).
 * Pages show skeletons, not spinners: lay them out like the finished content so nothing jumps.
 * The sweep is a transform, and stops under reduced motion.
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} aria-hidden className={cn('relative overflow-hidden rounded-control bg-surface-2', className)}>
      <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-page/50 to-transparent motion-reduce:hidden" />
    </div>
  );
}

export interface SkeletonTextProps {
  /** Number of lines. The last one is shorter, like a paragraph. */
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div aria-hidden className={cn('grid gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}
