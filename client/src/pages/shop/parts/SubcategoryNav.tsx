import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';

export interface SubcategoryLink {
  slug: string;
  name: string;
  count: number;
  to: string;
}

export interface SubcategoryNavProps {
  /** The hub ("All lighting") first, then each subcategory. */
  items: SubcategoryLink[];
  label: string;
  className?: string;
}

/**
 * The subcategories of a category as a row of link chips with their counts. On a phone the row
 * scrolls sideways instead of wrapping into a wall. The page you are on is marked and filled.
 */
export function SubcategoryNav({ items, label, className }: SubcategoryNavProps) {
  if (items.length <= 1) return null;
  return (
    <nav aria-label={label} className={cn('-mx-4 sm:mx-0', className)}>
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-1 sm:flex-wrap sm:overflow-visible sm:px-0">
        {items.map((item) => {
          const empty = item.count === 0;
          return (
            <li key={item.slug} className="shrink-0">
              <NavLink
                to={item.to}
                end
                aria-disabled={empty || undefined}
                className={({ isActive }) =>
                  cn(
                    'focus-ring inline-flex h-10 items-center gap-2 rounded-full pr-1.5 pl-4 text-sm font-semibold whitespace-nowrap',
                    'transition-colors duration-200',
                    isActive ? 'bg-ink text-page' : 'bg-surface text-ink hover:bg-surface-2',
                    empty && !isActive && 'opacity-45',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.name}
                    <span className={cn('grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-bold tnum', isActive ? 'bg-brand text-brand-ink' : 'bg-raised text-muted')}>
                      {formatNumber(item.count)}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
