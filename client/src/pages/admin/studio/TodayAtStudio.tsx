import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/commerce';
import { slotLabel } from '@/components/studio';
import { Button, Skeleton } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { pluralize } from '@/lib/format';
import { BookingStatusBadge, TAKES_A_BAY, hasStarted, useBookings, useTodayStudio } from './bookings';

/**
 * The dashboard's studio block: the cars booked in today in slot order, how many are in now,
 * and the bookings still waiting for a confirmation on any day ahead.
 */
export function TodayAtStudio() {
  const settings = useSettings().data;
  const { query } = useTodayStudio();
  const waiting = useBookings({ status: 'requested', limit: 1 });
  const cars = (query.data?.items ?? []).filter((booking) => TAKES_A_BAY.has(booking.status));
  const inNow = cars.filter((booking) => booking.status === 'in_progress').length;
  const toConfirm = waiting.data?.total ?? 0;
  const paused = settings?.studio.enabled === false;

  return (
    <section aria-labelledby="studio-today-heading" className="grid gap-4 rounded-[22px] bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="grid gap-1">
          <h2 id="studio-today-heading" className="text-lg font-bold">
            Today at the studio
          </h2>
          {query.data && (
            <p className="type-small text-muted">
              {cars.length === 0
                ? 'No cars booked in today.'
                : `${pluralize(cars.length, 'car')} booked in${inNow > 0 ? `, ${inNow} in the studio now` : ''}.`}
              {paused && ' Bookings are paused in Settings.'}
            </p>
          )}
        </div>
        <Button variant="link" size="sm" to="/admin/bookings" iconRight={<ArrowRight aria-hidden />}>
          Open the diary
        </Button>
      </div>

      {query.error && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Could not load today's bookings" size="sm" />
      ) : query.isPending ? (
        <div className="grid gap-2" aria-hidden>
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-12 w-full" />
          ))}
        </div>
      ) : cars.length > 0 ? (
        <ol className="grid gap-1.5">
          {cars.map((booking) => {
            const late = hasStarted(booking.date, booking.slot) && (booking.status === 'requested' || booking.status === 'confirmed');
            return (
              <li key={booking.bookingNumber}>
                <Link
                  to={`/admin/bookings?booking=${encodeURIComponent(booking.bookingNumber)}`}
                  className="focus-ring-inset grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-[14px] bg-raised px-3 py-2.5 transition-colors hover:bg-surface-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto]"
                >
                  <span className="font-extrabold whitespace-nowrap tnum">{slotLabel(booking.slot)}</span>
                  <span className="grid min-w-0">
                    <span className="truncate font-bold">
                      {booking.name}
                      {booking.vehicle ? <span className="font-normal text-muted">, {booking.vehicle}</span> : null}
                    </span>
                    <span className="type-small truncate text-muted">
                      {booking.serviceName}
                      {booking.orderNumber ? `, order ${booking.orderNumber}` : ''}
                    </span>
                  </span>
                  <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:justify-end">
                    {late && <span className="type-small font-bold text-warn">Not checked in</span>}
                    <BookingStatusBadge status={booking.status} size="sm" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-[14px] bg-raised px-4 py-6 text-center text-sm text-muted">The diary is clear for today. Bookings from the shop and studio orders show here.</p>
      )}

      {toConfirm > 0 && (
        <p className="type-small">
          <Link to="/admin/bookings?view=list&status=requested" className="focus-ring font-bold underline underline-offset-4">
            {pluralize(toConfirm, 'booking')} waiting to be confirmed
          </Link>
          <span className="text-muted"> on the days ahead.</span>
        </p>
      )}
    </section>
  );
}
