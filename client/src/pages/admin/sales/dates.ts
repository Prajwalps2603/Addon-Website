/**
 * Calendar days in the store's time zone (India, UTC+05:30, no daylight saving).
 * Date inputs give 'YYYY-MM-DD'; the API wants ISO instants for windows and plain days for filters.
 */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Today in India as 'YYYY-MM-DD'. */
export function todayIst(now = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' that many days from today in India. */
export function addDaysIst(days: number, now = Date.now()): string {
  return todayIst(now + days * DAY_MS);
}

/** The first day of this month in India. */
export function monthStartIst(now = Date.now()): string {
  return `${todayIst(now).slice(0, 8)}01`;
}

/** 00:00 India time on that day, as an ISO instant. */
export function istDayStart(day: string): string {
  return new Date(`${day}T00:00:00+05:30`).toISOString();
}

/** 23:59:59 India time on that day, as an ISO instant. */
export function istDayEnd(day: string): string {
  return new Date(`${day}T23:59:59+05:30`).toISOString();
}

/** The India calendar day of an ISO instant, as 'YYYY-MM-DD'. '' for an empty or bad value. */
export function istDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  return todayIst(time);
}

export const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/;
