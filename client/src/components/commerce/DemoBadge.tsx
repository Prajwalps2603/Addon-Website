import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface DemoBadgeProps {
  /** `outline` beside text on the page. `solid` is a white label that reads on a photo or a dark stage. */
  variant?: 'outline' | 'solid';
  className?: string;
}

/**
 * Marks seeded sample content (`isDemo` on a report, question, build or product) so nobody mistakes
 * it for a real customer. Wherever sample data is shown, this sits beside it.
 */
export function DemoBadge({ variant = 'outline', className }: DemoBadgeProps) {
  return (
    <Badge
      size="sm"
      variant={variant === 'solid' ? 'solid' : 'outline'}
      title="Sample content added to show how the store works. Not from a real customer."
      className={cn('align-middle', variant === 'solid' && 'bg-frame text-frame-ink', className)}
    >
      Sample
    </Badge>
  );
}
