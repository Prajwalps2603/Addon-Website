import { Fragment } from 'react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';

export interface Crumb {
  label: string;
  /** Leave out on the last crumb: the current page is not a link. */
  to?: To;
}

export interface BreadcrumbsProps {
  /** From the top of the site down to the current page. */
  items: ReadonlyArray<Crumb>;
  className?: string;
}

/**
 * The trail back up the catalogue. The slash between crumbs leans with the logo.
 * On a phone the trail scrolls sideways rather than wrapping.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('no-scrollbar -mx-1 overflow-x-auto', className)}>
      <ol className="type-small flex items-center whitespace-nowrap">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li className="flex shrink-0 items-center">
                {item.to !== undefined && !last ? (
                  <Link
                    to={item.to}
                    className="focus-ring-inset flex min-h-8 items-center px-1 text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className="px-1 font-medium text-ink">
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="shrink-0 px-1 font-extrabold text-line-strong italic">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
