import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, KeyRound, LogOut, Menu, Store } from 'lucide-react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { Logo } from '@/components/brand';
import { Button, Drawer, IconButton, Skeleton, toast } from '@/components/ui';
import { useLogout, useMe } from '@/hooks/useMe';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { readJSON, writeJSON } from '@/lib/storage';
import { loginPath } from '@/lib/urls';
import { AdminNav } from './shell/AdminNav';
import { BOTTOM_BAR, countFor, countWords, navCounts, navItemFor } from './shell/nav';
import { useTodayStudio } from './studio/bookings';

/** The range the dashboard opens on; the shell shares its cached stats for the pending counts. */
const COUNTS_RANGE = 30;
const RAIL_KEY = 'addon-admin-rail-closed';

/**
 * The admin frame. Only signed-in admins get in: visitors are sent to sign in and brought back,
 * signed-in customers see a plain "not allowed" page.
 * Desktop (1024 px and up): a pit-board side rail. Below that: a top bar with the page title and a
 * menu drawer, and on a phone a bottom bar for the five pages used most.
 */
export default function AdminLayout() {
  const { isAdmin, isSignedIn, isPending } = useMe();
  const location = useLocation();

  if (isPending) {
    // The frame's outline while the sign-in check runs, so the screen does not flash empty.
    return (
      <div role="status" className="min-h-dvh bg-page lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <span className="sr-only">Checking access</span>
        <div aria-hidden className="plane-board hidden h-dvh lg:block" />
        <div aria-hidden>
          <div className="plane-board h-14 lg:hidden" />
          <div className="container-page grid gap-4 py-8">
            <Skeleton className="h-9 w-48" />
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!isSignedIn) return <Navigate to={loginPath(location.pathname + location.search)} replace />;
  if (!isAdmin) return <NotAllowed />;
  return <AdminFrame />;
}

function AdminFrame() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  // The desktop rail can be closed to a slim strip of icons; remembered on this device.
  const [railClosed, setRailClosed] = useState(() => readJSON<boolean>(RAIL_KEY, false));
  const toggleRail = () => {
    setRailClosed((closed) => {
      writeJSON(RAIL_KEY, !closed);
      return !closed;
    });
  };
  const logout = useLogout();

  const { data: stats } = useQuery({
    queryKey: queryKeys.admin.stats(COUNTS_RANGE),
    queryFn: ({ signal }) => api.admin.stats(COUNTS_RANGE, { signal }),
    refetchInterval: 120_000,
  });

  const studio = useTodayStudio();
  const counts = navCounts(stats, studio.query.data ? studio.toHandle : undefined);

  // The drawer closes itself on navigation; also when the path changes by other means (back button).
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const current = navItemFor(location.pathname);
  const title = current?.label ?? 'Admin';

  const signOut = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success('Signed out');
        navigate('/', { replace: true });
      },
      onError: (error) => toast.error('Could not sign out', { description: errorMessage(error) }),
    });
  };

  const footerLinks = (slim: boolean) => {
    const row = cn(
      'focus-ring-inset flex min-h-11 items-center rounded-control font-bold text-ink transition-colors dur-quick hover:bg-surface-2 disabled:opacity-45',
      slim ? 'mx-auto size-11 justify-center' : 'gap-3 px-3 text-left',
    );
    const words = (text: string) => <span className={cn(slim && 'sr-only')}>{text}</span>;
    return (
      <div className="grid gap-1">
        <Link to="/" className={row} title={slim ? 'View store' : undefined}>
          <Store aria-hidden className="size-5 shrink-0" />
          {words('View store')}
        </Link>
        <Link to="/account/profile" className={row} title={slim ? 'Change password' : undefined}>
          <KeyRound aria-hidden className="size-5 shrink-0" />
          {words('Change password')}
        </Link>
        <button type="button" onClick={signOut} disabled={logout.isPending} className={row} title={slim ? 'Sign out' : undefined}>
          <LogOut aria-hidden className="size-5 shrink-0" />
          {words(logout.isPending ? 'Signing out' : 'Sign out')}
        </button>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'admin-soft min-h-dvh bg-page text-ink lg:grid lg:transition-[grid-template-columns] lg:duration-300 lg:ease-out',
        railClosed ? 'lg:grid-cols-[4.75rem_minmax(0,1fr)]' : 'lg:grid-cols-[16.5rem_minmax(0,1fr)]',
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:bg-brand focus:px-4 focus:py-3 focus:font-bold focus:text-brand-ink"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="plane-board sticky top-0 hidden h-dvh flex-col overflow-hidden lg:flex">
        <div className={cn('flex h-16 shrink-0 items-center border-b border-line', railClosed ? 'justify-center' : 'gap-3 px-5')}>
          <Link to="/admin" className="focus-ring rounded-control" aria-label="Admin dashboard">
            {railClosed ? <Logo variant="mark" height={30} label="" /> : <Logo height={26} tagline={false} label="" />}
          </Link>
          {!railClosed && <span className="type-label text-muted">Admin</span>}
        </div>
        <nav aria-label="Admin" className={cn('no-scrollbar min-h-0 flex-1 overflow-y-auto py-4', railClosed ? 'px-1' : 'px-2')}>
          <AdminNav counts={counts} collapsed={railClosed} />
        </nav>
        <div className={cn('shrink-0 border-t border-line py-3', railClosed ? 'px-1' : 'px-2')}>{footerLinks(railClosed)}</div>
      </aside>

      <div className="min-w-0">
        {/* Desktop: the round handle on the rail's edge that opens and closes it. Stays in view while scrolling. */}
        <div className="sticky top-0 z-sticky hidden h-0 lg:block">
          <button
            type="button"
            onClick={toggleRail}
            aria-expanded={!railClosed}
            aria-label={railClosed ? 'Open the sidebar' : 'Close the sidebar'}
            title={railClosed ? 'Open the sidebar' : 'Close the sidebar'}
            className="focus-ring absolute top-5 -left-4 grid size-8 place-items-center rounded-full border border-line bg-raised text-ink shadow-[0_4px_12px_-4px_rgb(12_13_15/0.35)] transition-[background-color,color,scale] duration-200 hover:scale-110 hover:bg-brand hover:text-brand-ink"
          >
            {railClosed ? <ChevronRight aria-hidden className="size-4" strokeWidth={2.75} /> : <ChevronLeft aria-hidden className="size-4" strokeWidth={2.75} />}
          </button>
        </div>
        {/* Phone and tablet top bar */}
        <header className="plane-board sticky top-0 z-header flex h-14 items-center gap-2 border-b border-line pr-2 pl-4 lg:hidden">
          <Link to="/admin" className="focus-ring shrink-0 rounded-control" aria-label="Admin dashboard">
            <Logo variant="mark" height={28} label="" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-lg font-extrabold" aria-hidden>
            {title}
          </p>
          <IconButton label="Open the admin menu" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}>
            <Menu aria-hidden />
          </IconButton>
        </header>

        <main id="main" tabIndex={-1} className="min-w-0 pb-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom)+1.5rem)] outline-hidden lg:pb-12">
          <Outlet />
        </main>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Admin menu" side="left" size="sm" footer={footerLinks(false)}>
        <nav aria-label="Admin">
          <AdminNav counts={counts} onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Drawer>

      {/* Phone bottom bar: the five pages used between calls. */}
      <nav
        aria-label="Admin shortcuts"
        className="fixed inset-x-0 bottom-0 z-header border-t border-line bg-raised pb-safe md:hidden"
      >
        <ul className="grid h-14 grid-cols-5">
          {BOTTOM_BAR.map((item) => {
            const Icon = item.icon;
            const count = countFor(counts, item.count);
            return (
              <li key={item.to} className="min-w-0">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring-inset relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-bold',
                      isActive ? 'text-ink' : 'text-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={cn('absolute inset-x-3 top-0 h-1', isActive ? 'bg-brand' : 'bg-transparent')}
                      />
                      <span className="relative">
                        <Icon aria-hidden className="size-6" />
                        {count > 0 && (
                          <span className="tnum absolute -top-1.5 left-4 min-w-5 rounded-control bg-ink px-1 text-center text-[0.6875rem] leading-5 text-page">
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </span>
                      <span className="max-w-full truncate px-1">
                        {item.short ?? item.label}
                        {count > 0 && <span className="sr-only">, {count} {countWords(item.count)}</span>}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** A signed-in customer who opened an admin link. */
function NotAllowed() {
  useDocumentMeta({ title: 'Not allowed', noindex: true });
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useLogout();
  const { user } = useMe();

  const switchAccount = () => {
    logout.mutate(undefined, {
      onSuccess: () => navigate(loginPath(location.pathname + location.search), { replace: true }),
      onError: (error) => toast.error('Could not sign out', { description: errorMessage(error) }),
    });
  };

  return (
    <main id="main" className="container-page grid min-h-dvh content-center gap-6 py-16">
      <Logo height={32} />
      <div className="grid max-w-prose gap-3">
        <h1 className="type-h1">Not allowed</h1>
        <p className="type-lead text-muted">
          This part of the site is for the shop&apos;s staff.
          {user ? ` You are signed in as ${user.email}, which is a customer account.` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="dark" to="/">
          Back to the store
        </Button>
        <Button variant="outline" onClick={switchAccount} loading={logout.isPending}>
          Sign in with another account
        </Button>
      </div>
    </main>
  );
}
