import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface PageHeaderProps {
  title: string;
  /** The trail from the top of the site to this page. The last crumb is this page and has no `to`. */
  breadcrumbs?: ReadonlyArray<Crumb>;
  /** One or two plain sentences under the title. */
  description?: ReactNode;
  /** Sits beside the title: a real count ("186 parts"), a status badge. */
  meta?: ReactNode;
  /** Buttons opposite the title: the page's main action last. */
  actions?: ReactNode;
  /**
   * `headline` is italic display capitals, for storefront pages ("WHAT FITS YOUR SWIFT").
   * `plain` is the upright title for anything read closely: an order number, a product name, an admin page.
   */
  variant?: 'headline' | 'plain';
  className?: string;
}

/**
 * The top of a page: breadcrumbs, the page's one `<h1>`, a line of description and its actions.
 * It has no container of its own: place it inside `container-page` with the rest of the page.
 */
export function PageHeader({ title, breadcrumbs, description, meta, actions, variant = 'headline', className }: PageHeaderProps) {
  return (
    <header className={cn('grid gap-3 pt-4 pb-6 md:pt-6 md:pb-8', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className={variant === 'headline' ? 'type-h1' : 'type-title'}>{title}</h1>
            {meta && <div className="type-small text-muted tnum">{meta}</div>}
          </div>
          {description && <p className="type-lead max-w-prose text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
