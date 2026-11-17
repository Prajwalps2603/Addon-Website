import { TriangleAlert } from 'lucide-react';
import { slotLabel } from '@/components/studio';
import { Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { AdminBooking } from '@/types/api';
import { ADMIN_STATUS_LABELS, BookingStatusBadge, type DiaryRow } from './bookings';

export interface DiaryProps {
  rows: DiaryRow[];
  bays: number;
  onOpen: (booking: AdminBooking) => void;
}

const COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-[6.5rem_minmax(0,1fr)]',
  2: 'md:grid-cols-[6.5rem_repeat(2,minmax(0,1fr))]',
  3: 'md:grid-cols-[6.5rem_repeat(3,minmax(0,1fr))]',
  4: 'md:grid-cols-[6.5rem_repeat(4,minmax(0,1fr))]',
};

/** Phones show at most two bays side by side; more wrap underneath. */
const PHONE_BAYS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2', 4: 'grid-cols-2' };

/**
 * One day of the studio: a row per slot, a column per bay. Each car is a button that opens the booking.
 * Below 768 px a slot's time heads its row and the bays sit two to a line.
 */
export function Diary({ rows, bays, onOpen }: DiaryProps) {
  const count = Math.min(Math.max(bays, 1), 4);
  return (
    <div className="grid border-t border-ink">
      <div aria-hidden className={cn('hidden gap-3 border-b border-line py-2 md:grid', COLUMNS[count])}>
        <span className="type-label text-muted">Time</span>
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="type-label text-muted">
            Bay {index + 1}
          </span>
        ))}
      </div>
      <ol className="grid">
        {rows.map((row) => (
          <li key={row.slot} className={cn('grid gap-2 border-b border-line py-3 md:gap-3', COLUMNS[count])}>
            <h3 className={cn('flex items-baseline gap-2 md:block', row.past && 'text-muted')}>
              <span className="text-lg font-extrabold tnum">{slotLabel(row.slot)}</span>
              {row.past && <span className="type-small md:block">Started</span>}
            </h3>
            <ul className={cn('grid gap-2 md:contents', PHONE_BAYS[count])}>
              {row.bays.map((booking, index) => (
                <li key={booking?.bookingNumber ?? `free-${index}`} className="min-w-0">
                  {booking ? (
                    <BookingCell booking={booking} bay={index + 1} past={row.past} onOpen={onOpen} />
                  ) : (
                    <div
                      className={cn(
                        'grid h-full min-h-20 content-center border border-dashed px-3 py-2',
                        row.past ? 'border-line text-muted' : 'border-line-strong text-muted',
                      )}
                    >
                      <span className="sr-only">Bay {index + 1}: </span>
                      <span className="type-small">{row.past ? 'Not used' : 'Free'}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {(row.extra.length > 0 || row.off.length > 0) && (
              <div className="grid gap-1.5 md:[grid-column:2/-1]">
                {row.extra.length > 0 && (
                  <p className="type-small flex items-center gap-1.5 font-bold text-warn">
                    <TriangleAlert aria-hidden className="size-4 shrink-0" />
                    More cars than bays in this slot
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {[...row.extra, ...row.off].map((booking) => (
                    <li key={booking.bookingNumber}>
                      <button
                        type="button"
                        onClick={() => onOpen(booking)}
                        className="focus-ring type-small inline-flex min-h-11 items-center gap-2 rounded-control border border-line px-2.5 text-left hover:border-ink"
                      >
                        <span className="font-bold">{booking.name}</span>
                        <span className="text-muted">{ADMIN_STATUS_LABELS[booking.status]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BookingCell({ booking, bay, past, onOpen }: { booking: AdminBooking; bay: number; past: boolean; onOpen: (booking: AdminBooking) => void }) {
  const late = past && (booking.status === 'requested' || booking.status === 'confirmed');
  return (
    <button
      type="button"
      onClick={() => onOpen(booking)}
      className={cn(
        'focus-ring grid h-full min-h-20 w-full content-start gap-1 border px-3 py-2 text-left transition-colors dur-quick',
        booking.status === 'in_progress' ? 'border-ink bg-surface-2' : 'border-line-strong bg-page hover:border-ink',
      )}
    >
      <span className="sr-only">Bay {bay}: </span>
      <span className="line-clamp-2 min-w-0 font-bold break-words">{booking.name || 'No name'}</span>
      <span className="type-small line-clamp-2 min-w-0 break-words">{booking.vehicle || 'Car not given'}</span>
      <span className="type-small line-clamp-2 min-w-0 break-words text-muted">
        {booking.orderNumber ? `Order ${booking.orderNumber}` : booking.serviceName}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5">
        <BookingStatusBadge status={booking.status} size="sm" />
        {late && <span className="type-small font-bold text-warn">Not checked in</span>}
      </span>
    </button>
  );
}

export function DiarySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid border-t border-ink" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-2 border-b border-line py-3 md:grid-cols-[6.5rem_repeat(2,minmax(0,1fr))] md:gap-3">
          <Skeleton className="h-6 w-20" />
          <div className="grid grid-cols-2 gap-2 md:contents">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
