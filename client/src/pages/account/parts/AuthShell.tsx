import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { BoardWord, PitBoard } from '@/components/brand';
import { Skeleton } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { safeNextPath } from '@/lib/urls';
import { useGarage } from '@/stores/garage';
import { useWishlist } from '@/stores/wishlist';

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  /** The form column. */
  children: ReactNode;
  /** The quieter column beside the form (below it on a phone). */
  aside?: ReactNode;
}

/**
 * The frame of the sign-in, register and password pages: one heavy headline, the form in a
 * narrow column, and a short side column that reports something real.
 */
export function AuthShell({ title, description, children, aside }: AuthShellProps) {
  return (
    <div className="container-page pt-6 pb-16 md:pt-10 md:pb-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-20">
        <div className="grid content-start gap-8">
          <header className="grid gap-3">
            <h1 className="type-h1">{title}</h1>
            {description && <p className="type-lead max-w-prose text-muted">{description}</p>}
          </header>
          {children}
        </div>
        {aside && <aside className="grid content-start gap-6 lg:border-l lg:border-line lg:pt-2 lg:pl-12">{aside}</aside>}
      </div>
    </div>
  );
}

/** Placeholder for a form while the session check runs, laid out like the finished form. */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="grid gap-5" aria-hidden>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="grid gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      <Skeleton className="h-13 w-full" />
    </div>
  );
}

/**
 * What this phone already holds that signing in will add to the account: saved parts and the
 * garage. Real counts from the stores; when there is nothing, it says what an account keeps instead.
 */
export function DeviceSummary({ action }: { action: 'sign in' | 'register' }) {
  const savedCount = useWishlist((state) => state.ids.length);
  const carCount = useGarage((state) => state.vehicles.length);
  const activeModel = useGarage((state) => state.vehicles.find((car) => car.vehicleId === state.activeVehicleId)?.vehicle.model ?? null);

  if (savedCount === 0 && carCount === 0) {
    return (
      <div className="grid gap-4">
        <h2 className="type-h3">What an account keeps</h2>
        <ul className="grid border-t border-line">
          {[
            'Every order and its tracking, in one list.',
            'Addresses, ready for the next checkout.',
            'Saved parts and your cars, on any phone you sign in on.',
          ].map((line) => (
            <li key={line} className="type-body border-b border-line py-3">
              {line}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <PitBoard title="On this phone">
        <div className="grid gap-2">
          {savedCount > 0 && <BoardWord text={`${savedCount} saved`} size="sm" />}
          {activeModel ? (
            <BoardWord text={activeModel} size="sm" tone="brand" />
          ) : (
            carCount > 0 && <BoardWord text={`${carCount} ${carCount === 1 ? 'car' : 'cars'}`} size="sm" tone="brand" />
          )}
        </div>
      </PitBoard>
      <p className="type-body max-w-prose text-muted">
        {action === 'sign in' ? 'Signing in' : 'Creating an account'} adds{' '}
        {[savedCount > 0 ? pluralize(savedCount, 'saved part') : null, carCount > 0 ? pluralize(carCount, 'car') : null]
          .filter(Boolean)
          .join(' and ')}{' '}
        from this phone to your account, so they are there on every device.
      </p>
    </div>
  );
}

/** Keeps `next` on the links between the sign-in pages, so the visitor still lands where they were going. */
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/**
 * Where to go after signing in, from `?next=`. A link written as `/login?next=/p/x#fitted-reports`
 * (not encoded) puts the fragment on this page's own address, so it is carried over to `next`
 * when `next` has none of its own. `kept` is the same path for the links between the sign-in pages.
 */
export function useNextTarget(): { next: string; kept: string | null } {
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const raw = params.get('next');
  const withHash = raw && hash && !raw.includes('#') ? `${raw}${hash}` : raw;
  return { next: safeNextPath(withHash, '/account'), kept: safeNextPath(withHash, '') || null };
}
