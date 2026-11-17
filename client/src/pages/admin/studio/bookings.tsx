/**
 * The studio diary's shared pieces: which bookings take a bay, how each status looks and reads,
 * the queries for one day and a run of days, and the WhatsApp message for each step.
 * Days are 'YYYY-MM-DD' and slots 'HH:MM', both India time (see components/studio/studioTime).
 */
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleDashed, CircleX, Hourglass, UserX, Wrench } from 'lucide-react';
import { Badge, type BadgeToneName } from '@/components/ui';
import { BOOKING_STATUS_LABELS, addDays, longDate, slotLabel, todayInIndia, weekdayOf } from '@/components/studio';
import { api, type AdminBookingQuery } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, BookingStatus, PublicSettings, StudioSettings } from '@/types/api';

export { BOOKING_STATUS_LABELS };

export const BOOKING_STATUSES: readonly BookingStatus[] = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

/** Bookings that hold a place in their slot (the server counts the same ones). */
export const TAKES_A_BAY: ReadonlySet<BookingStatus> = new Set(['requested', 'confirmed', 'in_progress', 'completed']);

/** Bookings the studio still has to act on today: the nav count and the dashboard. */
export const STILL_TO_HANDLE: ReadonlySet<BookingStatus> = new Set(['requested', 'confirmed', 'in_progress']);

const LOOK: Record<BookingStatus, { tone: BadgeToneName; icon: ReactNode }> = {
  requested: { tone: 'brand', icon: <CircleDashed aria-hidden /> },
  confirmed: { tone: 'info', icon: <CircleCheck aria-hidden /> },
  in_progress: { tone: 'ink', icon: <Wrench aria-hidden /> },
  completed: { tone: 'fit', icon: <CircleCheck aria-hidden /> },
  cancelled: { tone: 'neutral', icon: <CircleX aria-hidden /> },
  no_show: { tone: 'warn', icon: <UserX aria-hidden /> },
};

/** Staff wording: 'Requested' reads as a job to do in the diary. */
export const ADMIN_STATUS_LABELS: Record<BookingStatus, string> = {
  ...BOOKING_STATUS_LABELS,
  requested: 'To confirm',
  in_progress: 'In the studio',
};

export function BookingStatusBadge({ status, size }: { status: BookingStatus; size?: 'sm' | 'md' }) {
  const look = LOOK[status];
  return (
    <Badge tone={look.tone} variant={status === 'in_progress' ? 'solid' : 'soft'} icon={look.icon} size={size}>
      {ADMIN_STATUS_LABELS[status]}
    </Badge>
  );
}

export const WAITING_ICON = <Hourglass aria-hidden />;

/** The admin diary for a run of days, by date then slot. */
export function useBookings(query: AdminBookingQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.bookings.list(query),
    queryFn: ({ signal }) => api.admin.bookings.list(query, { signal }),
    enabled,
    refetchInterval: 60_000,
  });
}

/** Every booking on one day (a day never holds more than the limit: slots x bays plus cancellations). */
export function useDayBookings(day: string) {
  return useBookings({ from: day, to: day, limit: 200 });
}

/** Today's bookings still to handle, for the nav and the dashboard. Shares the day query. */
export function useTodayStudio() {
  const today = todayInIndia();
  const query = useDayBookings(today);
  const items = query.data?.items ?? [];
  return { today, query, items, toHandle: items.filter((booking) => STILL_TO_HANDLE.has(booking.status)).length };
}

/** The slot times the studio runs on this day: none on a closed weekday, the half day on Sunday. */
export function slotsForDay(day: string, studio: StudioSettings): string[] {
  const weekday = weekdayOf(day);
  if (studio.closedWeekdays.includes(weekday)) return [];
  if (weekday === 0 && studio.sundayLastSlot) return studio.slots.filter((slot) => slot <= studio.sundayLastSlot);
  return [...studio.slots];
}

export interface DiaryRow {
  slot: string;
  /** One entry per bay: the booking in it, or null when free. */
  bays: (AdminBooking | null)[];
  /** Bookings in this slot beyond the bays (overbooked by hand), shown so nothing is hidden. */
  extra: AdminBooking[];
  /** Cancelled and missed bookings for this slot, for the record. */
  off: AdminBooking[];
  /** The slot has started (India time). */
  past: boolean;
}

/** Minutes since midnight in India now. */
function indiaMinutesNow(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function minutesOf(slot: string): number {
  const [h, m] = slot.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * The day laid out as rows of slots and columns of bays. Slots that hold a booking but are not in
 * today's slot list (the rules changed after it was booked) still get their row.
 */
export function diaryRows(day: string, studio: StudioSettings, bookings: readonly AdminBooking[]): DiaryRow[] {
  const bays = Math.max(1, studio.carsPerSlot);
  const slots = new Set(slotsForDay(day, studio));
  for (const booking of bookings) if (booking.date === day) slots.add(booking.slot);
  return [...slots].sort().map((slot) => {
    const here = bookings.filter((booking) => booking.date === day && booking.slot === slot);
    const holding = here.filter((booking) => TAKES_A_BAY.has(booking.status));
    return {
      slot,
      bays: Array.from({ length: bays }, (_, index) => holding[index] ?? null),
      extra: holding.slice(bays),
      off: here.filter((booking) => !TAKES_A_BAY.has(booking.status)),
      past: hasStarted(day, slot),
    };
  });
}

/** The statuses a booking can move to next, main action first. */
export function nextSteps(status: BookingStatus): { status: BookingStatus; label: string }[] {
  switch (status) {
    case 'requested':
      return [{ status: 'confirmed', label: 'Confirm booking' }];
    case 'confirmed':
      return [{ status: 'in_progress', label: 'Car has arrived' }];
    case 'in_progress':
      return [{ status: 'completed', label: 'Work done' }];
    case 'cancelled':
    case 'no_show':
      return [{ status: 'confirmed', label: 'Book it back in' }];
    case 'completed':
      return [];
  }
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** Where the studio is, for a message: the address, else the map link, else nothing. */
function studioWhere(settings: PublicSettings | undefined): string | null {
  if (!settings) return null;
  const address = settings.studio.address.trim().replace(/\s*\n\s*/g, ', ');
  if (address && settings.studio.mapUrl) return `Studio: ${address}\nMap: ${settings.studio.mapUrl}`;
  if (address) return `Studio: ${address}`;
  if (settings.studio.mapUrl) return `Map to the studio: ${settings.studio.mapUrl}`;
  return null;
}

/** The WhatsApp message for where the booking stands now. The owner can edit it before sending. */
export function bookingCustomerMessage(booking: AdminBooking, settings: PublicSettings | undefined): string {
  const hello = `Hello ${firstName(booking.name) || 'there'},`;
  const when = `${longDate(booking.date)} at ${slotLabel(booking.slot)}`;
  const what = `${booking.serviceName}${booking.vehicle ? ` for your ${booking.vehicle}` : ''}`;
  const sign = settings?.storeName ?? '';
  const ref = `Booking ${booking.bookingNumber}${booking.orderNumber ? `, order ${booking.orderNumber}` : ''}.`;
  const lines: (string | null)[] = (() => {
    switch (booking.status) {
      case 'requested':
      case 'confirmed':
        return [
          hello,
          `Your studio slot is confirmed: ${what}, ${when}.`,
          ref,
          booking.serviceMinutes > 0 ? `The work takes about ${booking.serviceMinutes} minutes.` : null,
          studioWhere(settings),
          'Reply here if you need another time.',
        ];
      case 'in_progress':
        return [hello, `Your car is with our team now for ${booking.serviceName.toLowerCase()}.`, 'We will message you when it is ready.'];
      case 'completed':
        return [
          hello,
          `The ${booking.serviceName.toLowerCase()} on your car is done.`,
          booking.serviceCharge > 0 && !booking.orderNumber ? `Fitting charge: ${formatINR(booking.serviceCharge)}.` : null,
          'Thank you for coming to the studio.',
        ];
      case 'cancelled':
        return [hello, `Your studio booking for ${when} is cancelled.`, ref, 'Reply here when you would like to book another time.'];
      case 'no_show':
        return [hello, `We kept ${when} for your car but missed you.`, 'Reply with a day and time that suits you and we will book it again.'];
    }
  })();
  return [...lines, sign].filter((line): line is string => Boolean(line)).join('\n');
}

/** The slot has started, in India time. */
export function hasStarted(day: string, slot: string): boolean {
  const today = todayInIndia();
  return day < today || (day === today && minutesOf(slot) <= indiaMinutesNow());
}

/** 'today', 'tomorrow' or the long date, for the middle of a sentence. */
export function dayPhrase(day: string): string {
  const name = dayName(day);
  return name === 'Today' || name === 'Tomorrow' || name === 'Yesterday' ? name.toLowerCase() : name;
}

/** '2026-11-18' → 'Today', 'Tomorrow', or the long date. */
export function dayName(day: string): string {
  const today = todayInIndia();
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  return longDate(day);
}
