import { useId, type KeyboardEvent } from 'react';
import { ChevronDown, LogOut, Package, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Skeleton, toast } from '@/components/ui';
import { useLogout, useMe } from '@/hooks/useMe';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { loginPath } from '@/lib/urls';
import { moveFocusWithin, useDisclosure } from './hooks';

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'Account';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'A';
}

/** Signs out, then leaves pages that only make sense signed in. Shared by the header and the menu drawer. */
export function useSignOut() {
  const logout = useLogout();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success('Signed out', { description: 'Your cart and garage stay on this device.' });
        if (pathname.startsWith('/account') || pathname.startsWith('/admin')) navigate('/');
      },
      onError: (error) => toast.error('Could not sign out', { description: errorMessage(error) }),
    });
  return { signOut, pending: logout.isPending };
}

/** Signed in: the first name and a menu (account, orders, admin for admins, sign out). Signed out: Sign in. */
export function AccountMenu() {
  const me = useMe();
  const { pathname, search } = useLocation();
  const menu = useDisclosure<HTMLButtonElement>();
  const { signOut, pending } = useSignOut();
  const panelId = useId();

  if (me.isPending) return <Skeleton className="h-6 w-20" />;

  if (!me.user) {
    const next = pathname === '/login' || pathname === '/register' ? null : pathname + search;
    return (
      <Link
        to={loginPath(next)}
        aria-label="Sign in"
        title="Sign in"
        className="relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors dur-quick hover:bg-surface-2"
      >
        <UserRound aria-hidden className="size-5" />
      </Link>
    );
  }

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    menu.setOpen(true);
    window.requestAnimationFrame(() => menu.panelRef.current?.querySelector<HTMLElement>('a[href],button')?.focus());
  };

  const item =
    'focus-ring-inset flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left font-bold transition-colors dur-quick hover:bg-surface-2';

  return (
    <div className="relative" onBlur={menu.onBlur}>
      <button
        ref={menu.triggerRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={panelId}
        onClick={() => menu.setOpen(!menu.open)}
        onKeyDown={onTriggerKeyDown}
        title={me.user.name}
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-full transition-colors dur-quick hover:bg-surface-2',
          menu.open && 'bg-surface-2',
        )}
      >
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-ink text-sm font-extrabold uppercase text-page"
        >
          {initials(me.user.name)}
        </span>
        <span className="sr-only">Account menu for {firstName(me.user.name)}</span>
      </button>
      <div
        ref={menu.panelRef}
        id={panelId}
        hidden={!menu.open}
        onClick={menu.onPanelClick}
        onKeyDown={(event) => {
          if (moveFocusWithin(event.currentTarget, event.key)) event.preventDefault();
        }}
        className="absolute top-full right-0 mt-2 w-64 animate-pop-in rounded-control border border-ink bg-raised p-1.5 text-ink shadow-pop"
      >
        <p className="truncate border-b border-line px-3 pt-1.5 pb-2.5">
          <span className="block font-bold">{me.user.name}</span>
          <span className="type-small block truncate text-muted">{me.user.email}</span>
        </p>
        <ul className="grid pt-1.5">
          <li>
            <Link to="/account" className={item}>
              <UserRound aria-hidden className="size-5" />
              My account
            </Link>
          </li>
          <li>
            <Link to="/account/orders" className={item}>
              <Package aria-hidden className="size-5" />
              Orders
            </Link>
          </li>
          {me.isAdmin && (
            <li>
              <Link to="/admin" className={item}>
                <ShieldCheck aria-hidden className="size-5" />
                Admin
              </Link>
            </li>
          )}
          <li className="mt-1.5 border-t border-line pt-1.5">
            <button type="button" onClick={signOut} disabled={pending} aria-busy={pending || undefined} className={cn(item, pending && 'opacity-45')}>
              <LogOut aria-hidden className="size-5" />
              {pending ? 'Signing out' : 'Sign out'}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
