import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';

export interface SectionHeadingProps {
  title: string;
  /** One or two plain sentences under the title. */
  description?: ReactNode;
  /** A "see all" link opposite the title. */
  seeAll?: { to: To; label?: string };
  /** Anything else to sit opposite the title: a count, a Segmented control. Shown before `seeAll`. */
  action?: ReactNode;
  /** The heading element, to suit the page outline. */
  as?: 'h2' | 'h3';
  /** Put on the heading, so a region can point to it with aria-labelledby. */
  id?: string;
  className?: string;
}

/**
 * The heading of a page section: the title in display capitals, an optional line of description,
 * and the way to the full list on the right. No small label floating above it.
 */
export function SectionHeading({ title, description, seeAll, action, as: Heading = 'h2', id, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <div className="grid min-w-0 gap-2">
        <Heading id={id} className={Heading === 'h2' ? 'type-h2' : 'type-h3'}>
          {title}
        </Heading>
        {description && <p className="max-w-prose text-muted">{description}</p>}
      </div>
      {(action || seeAll) && (
        <div className="flex shrink-0 items-center gap-4">
          {action}
          {seeAll && (
            <Link
              to={seeAll.to}
              className="type-small inline-flex min-h-8 items-center gap-1.5 font-bold underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              {seeAll.label ?? 'See all'}
              <span className="sr-only"> {title}</span>
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
