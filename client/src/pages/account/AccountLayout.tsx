import { useRef } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Car, Heart, LogOut } from 'lucide-react';
import { Button, Skeleton, toast } from '@/components/ui';
import { useLogout, useMe } from '@/hooks/useMe';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { loginPath } from '@/lib/urls';
import { useGarage } from '@/stores/garage';
import { useWishlist } from '@/stores/wishlist';

const SECTIONS: readonly { to: string; label: string; end?: boolean }[] = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/orders', label: 'Orders' },
  { to: '/account/addresses', label: 'Addresses' },
  { to: '/account/profile', label: 'Profile' },
];

/** Tabs across the top on a phone and tablet. */
function AccountTabs({ onSignOut, signingOut }: { onSignOut: () => void; signingOut: boolean }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    cn(
      'focus-ring-inset -mb-px inline-flex h-11 shrink-0 items-center border-b-[3px] text-sm font-bold whitespace-nowrap transition-colors dur-quick',
      isActive ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink',
    );
  return (
    <nav aria-label="Account" className="lg:hidden">
      <ul className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line">
        {SECTIONS.map((section) => (
          <li key={section.to} className="flex">
            <NavLink to={section.to} end={section.end} className={tab}>
              {section.label}
            </NavLink>
          </li>
        ))}
        <li className="flex">
          <NavLink to="/wishlist" className={tab}>
            Saved
          </NavLink>
        </li>
        <li className="flex">
          <NavLink to="/garage" className={tab}>
            Garage
          </NavLink>
        </li>
        <li className="flex">
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="focus-ring-inset -mb-px inline-flex h-11 shrink-0 items-center border-b-[3px] border-transparent text-sm font-bold whitespace-nowrap text-muted hover:text-ink disabled:opacity-45"
          >
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** The side list on a desktop. */
function AccountSideNav({ name, email, onSignOut, signingOut }: { name: string; email: string; onSignOut: () => void; signingOut: boolean }) {
  const savedCount = useWishlist((state) => state.ids.length);
  const carCount = useGarage((state) => state.vehicles.length);
  const row = ({ isActive }: { isActive: boolean }) =>
    cn(
      'focus-ring-inset flex min-h-11 items-center justify-between gap-3 px-3 text-sm font-bold transition-colors dur-quick',
      isActive ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
    );
  return (
    <aside className="hidden lg:sticky lg:top-6 lg:grid lg:content-start lg:gap-6 lg:self-start">
      <div className="grid gap-0.5 border-b border-line pb-4">
        <p className="type-h3 truncate">{name}</p>
        <p className="type-small truncate text-muted">{email}</p>
      </div>
      <nav aria-label="Account" className="grid gap-6">
        <ul className="grid gap-0.5">
          {SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink to={section.to} end={section.end} className={row}>
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <ul className="grid gap-0.5 border-t border-line pt-4">
          <li>
            <NavLink to="/wishlist" className={row}>
              <span className="inline-flex items-center gap-2">
                <Heart aria-hidden className="size-4" />
                Saved parts
              </span>
              <span className="font-normal tnum">{savedCount}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/garage" className={row}>
              <span className="inline-flex items-center gap-2">
                <Car aria-hidden className="size-4" />
                My garage
              </span>
              <span className="font-normal tnum">{carCount}</span>
            </NavLink>
          </li>
        </ul>
      </nav>
      <Button variant="ghost" size="sm" iconLeft={<LogOut />} onClick={onSignOut} loading={signingOut} className="justify-self-start">
        Sign out
      </Button>
    </aside>
  );
}

function LayoutSkeleton() {
  return (
    <div className="container-page pt-4 pb-16 lg:pt-8" role="status">
      <span className="sr-only">Loading your account</span>
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <div className="flex gap-6 border-b border-line pb-3 lg:hidden" aria-hidden>
          {[16, 14, 18, 14].map((width, index) => (
            <Skeleton key={index} className="h-5" style={{ width: `${width * 4}px` }} />
          ))}
        </div>
        <div className="hidden gap-2 lg:grid lg:content-start" aria-hidden>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mb-4 h-4 w-44" />
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
        <div className="grid gap-6 pt-6 lg:pt-0" aria-hidden>
          <Skeleton className="h-10 w-2/3 max-w-sm" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * The signed-in area. Visitors who are not signed in go to sign in and come back here after.
 * A compact nav: tabs across the top on a phone, a side list on a desktop.
 */
export default function AccountLayout() {
  const { user, isPending } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  // Signing out empties the session before the mutation's own callbacks run: go home, not to sign in.
  const leaving = useRef(false);

  if (isPending) return <LayoutSkeleton />;
  if (!user) return <Navigate to={leaving.current ? '/' : loginPath(location.pathname + location.search)} replace />;

  const signOut = () => {
    leaving.current = true;
    // mutateAsync, not mutate: its promise settles even after this layout has unmounted on the way home.
    logout.mutateAsync().then(
      () => {
        toast.success('Signed out', { description: 'Your cart and garage stay on this device.' });
        navigate('/', { replace: true });
      },
      (error: unknown) => {
        leaving.current = false;
        toast.error('Could not sign out', { description: errorMessage(error) });
      },
    );
  };

  return (
    <div className="container-page pt-2 pb-16 lg:pt-8 lg:pb-24">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <AccountTabs onSignOut={signOut} signingOut={logout.isPending} />
        <AccountSideNav name={user.name} email={user.email} onSignOut={signOut} signingOut={logout.isPending} />
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
