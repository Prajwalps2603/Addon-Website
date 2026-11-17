/**
 * Dates and times for the fitting studio. The studio runs on India time whatever the
 * device is set to: days are plain 'YYYY-MM-DD' strings and slots are 'HH:MM' strings,
 * and nothing here converts them through the device's own time zone.
 */
import { formatINR } from '@/lib/format';
import type { BookingStatus, StudioService, StudioSlotReason } from '@/types/api';

const INDIA = 'Asia/Kolkata';
const DAY_MS = 86_400_000;
/** India is UTC+5:30 all year (no daylight saving). */
const INDIA_OFFSET_MINUTES = 330;

/** Today in India as 'YYYY-MM-DD'. */
export function todayInIndia(now: Date = new Date()): string {
  // en-CA writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: INDIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function toUtcDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/** '2026-11-30' + 2 → '2026-12-02'. */
export function addDays(day: string, count: number): string {
  return new Date(toUtcDate(day).getTime() + count * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for the calendar day itself. */
export function weekdayOf(day: string): number {
  return toUtcDate(day).getUTCDay();
}

/** `count` days from `from`, as 'YYYY-MM-DD'. */
export function daysFrom(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

const dayParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const longDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** { weekday: 'Wed', day: '18', month: 'Nov' } for the date strip. */
export function dayChip(day: string): { weekday: string; day: string; month: string } {
  const out: Record<string, string> = {};
  for (const part of dayParts.formatToParts(toUtcDate(day))) out[part.type] = part.value;
  return { weekday: out.weekday ?? '', day: out.day ?? '', month: out.month ?? '' };
}

/** 'Wednesday, 18 November 2026'. */
export function longDate(day: string): string {
  return longDay.format(toUtcDate(day));
}

/** '13:00' → '1:00 pm', '10:00' → '10:00 am'. */
export function slotLabel(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return slot;
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Why a slot cannot be booked, in a word or two for the slot button. */
export const SLOT_REASON_WORDS: Record<Exclude<StudioSlotReason, null>, string> = {
  full: 'Full',
  past: 'Passed',
  notice: 'Too soon',
  closed: 'Closed',
};

/** The same reasons as a sentence, for screen readers and the day summary. */
export const SLOT_REASON_DETAIL: Record<Exclude<StudioSlotReason, null>, string> = {
  full: 'Fully booked',
  past: 'This time has passed',
  notice: 'Starts too soon to book online',
  closed: 'The studio is closed at this time',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'Car in the studio',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

export const BOOKING_STATUS_DETAIL: Record<BookingStatus, string> = {
  requested: 'The studio will confirm the slot with you shortly.',
  confirmed: 'The studio has confirmed this slot. Bring the car at the time below.',
  in_progress: 'Your car is with the studio team now.',
  completed: 'The work is done.',
  cancelled: 'This booking is cancelled. Book again if you still want the work done.',
  no_show: 'The car did not come in for this slot. Book again to pick a new time.',
};

/** The id of the free consultation in settings.services. */
export const CONSULT_ID = 'consult';

/** '₹799', 'Free' for the consultation, or 'No fitting charge' where the work is included with the part. */
export function chargeLabel(service: Pick<StudioService, 'id' | 'charge'>): string {
  if (service.charge > 0) return formatINR(service.charge);
  return service.id === CONSULT_ID ? 'Free' : 'No fitting charge';
}

/** Charge for a booking snapshot, worded the same way. */
export function bookingChargeLabel(serviceId: string, charge: number): string {
  return chargeLabel({ id: serviceId, charge });
}

/** 'YYYY-MM-DD' + 'HH:MM' in India time → '20261118T043000Z' (UTC, for calendar files). */
function icsStamp(day: string, slot: string, plusMinutes = 0): string {
  const [h, m] = slot.split(':').map(Number);
  const ms = toUtcDate(day).getTime() + ((h ?? 0) * 60 + (m ?? 0) - INDIA_OFFSET_MINUTES + plusMinutes) * 60_000;
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines over 75 octets are folded, as the calendar format asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export interface CalendarEventInput {
  uid: string;
  day: string;
  slot: string;
  minutes: number;
  title: string;
  description: string;
  location: string;
}

/** A one-event .ics file that phones and mail apps open as "add to calendar". */
export function calendarFile(event: CalendarEventInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Addon Automotive//Studio booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(event.uid)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${icsStamp(event.day, event.slot)}`,
    `DTEND:${icsStamp(event.day, event.slot, Math.max(30, event.minutes || 60))}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    event.location ? `LOCATION:${icsText(event.location)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
