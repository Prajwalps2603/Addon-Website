import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { ADMIN_NAV, countFor, countWords, type NavCounts } from './nav';

export interface AdminNavProps {
  counts: NavCounts | undefined;
  /** Called after a link is followed (closes the menu drawer). */
  onNavigate?: () => void;
  /** The desktop rail is closed: icons only, names as tooltips, counts as a dot. */
  collapsed?: boolean;
  className?: string;
}

/**
 * The grouped list of admin pages with their pending counts. Drawn on the pit board in the
 * desktop rail and on the raised sheet in the phone menu: the tokens follow the plane.
 */
export function AdminNav({ counts, onNavigate, collapsed = false, className }: AdminNavProps) {
  return (
    <div className={cn('grid', collapsed ? 'gap-3' : 'gap-5', className)}>
      {ADMIN_NAV.map((group) => (
        <section key={group.label} aria-labelledby={`admin-nav-${group.label}`}>
          <h2 id={`admin-nav-${group.label}`} className={cn('type-label mb-1 px-3 text-muted', collapsed && 'sr-only')}>
            {group.label}
          </h2>
          {collapsed && <span aria-hidden className="mx-auto mb-2 block h-px w-6 bg-line" />}
          <ul className={cn('grid', collapsed && 'gap-1')}>
            {group.items.map((item) => {
              const count = countFor(counts, item.count);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'focus-ring-inset relative flex min-h-11 items-center rounded-control font-bold transition-colors dur-quick',
                        collapsed ? 'mx-auto size-11 justify-center' : 'gap-3 px-3',
                        isActive ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface-2',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon aria-hidden className="size-5 shrink-0" />
                        <span className={cn('min-w-0 flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>
                        {count > 0 &&
                          (collapsed ? (
                            <span
                              className={cn(
                                'absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] leading-none font-bold tnum',
                                isActive ? 'bg-ink text-page' : 'bg-brand text-brand-ink',
                              )}
                            >
                              <span className="sr-only">, </span>
                              {count > 9 ? '9+' : count}
                              <span className="sr-only"> {countWords(item.count)}</span>
                            </span>
                          ) : (
                            <span
                              className={cn(
                                'tnum min-w-6 rounded-control px-1.5 text-center text-sm leading-6',
                                isActive ? 'bg-ink text-page' : 'bg-surface-2 text-ink',
                              )}
                            >
                              <span className="sr-only">, </span>
                              {count > 99 ? '99+' : count}
                              <span className="sr-only"> {countWords(item.count)}</span>
                            </span>
                          ))}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
