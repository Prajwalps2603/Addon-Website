/**
 * Money, dates and small bits of wording. Timestamps are shown in Indian time
 * whatever the device is set to, so the site, the emails and the invoice agree.
 */

const STORE_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 86_400_000;

type DateInput = string | number | Date | null | undefined;

const rupees = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupeesAndPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 119999 → '1,19,999' (Indian lakh grouping, no sign). */
export function formatNumber(value: number | null | undefined): string {
  return rupees.format(Number.isFinite(value) ? (value as number) : 0);
}

/**
 * 119999 → '₹1,19,999'. Whole rupees by default; `{ paise: true }` keeps two decimals
 * (the GST breakdown on invoices).
 */
export function formatINR(amount: number | null | undefined, options: { paise?: boolean } = {}): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  const rounded = options.paise ? Math.round(value * 100) / 100 : Math.round(value);
  const body = (options.paise ? rupeesAndPaise : rupees).format(Math.abs(rounded));
  return `${rounded < 0 ? '-' : ''}₹${body}`;
}

const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SQL_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/** A plain 'YYYY-MM-DD' names a calendar day, not an instant: it is never shifted by a time zone. */
function parse(value: DateInput): { date: Date; timeZone: string } | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const plain = PLAIN_DATE.exec(value);
    if (plain) {
      return { date: new Date(Date.UTC(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))), timeZone: 'UTC' };
    }
    if (SQL_TIMESTAMP.test(value)) value = `${value.replace(' ', 'T')}Z`;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, timeZone: STORE_TIME_ZONE };
}

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).formatToParts(date)) {
    out[part.type] = part.value;
  }
  return out;
}

export interface DateFormatOptions {
  /** 'Tue, 17 Nov 2026' */
  weekday?: boolean;
  /** false → '17 Nov' */
  year?: boolean;
}

/** '17 Nov 2026'. Accepts ISO timestamps and plain 'YYYY-MM-DD' dates. '' for an empty or invalid value. */
export function formatDate(value: DateInput, options: DateFormatOptions = {}): string {
  const parsed = parse(value);
  if (!parsed) return '';
  const p = parts(parsed.date, parsed.timeZone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: options.weekday ? 'short' : undefined,
  });
  const text = options.year === false ? `${p.day} ${p.month}` : `${p.day} ${p.month} ${p.year}`;
  return options.weekday ? `${p.weekday}, ${text}` : text;
}

/** '4:05 pm' */
export function formatTime(value: DateInput): string {
  const parsed = parse(value);
  if (!parsed) return '';
  const p = parts(parsed.date, parsed.timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`.trim();
}

/** '17 Nov 2026, 4:05 pm' */
export function formatDateTime(value: DateInput): string {
  const date = formatDate(value);
  return date ? `${date}, ${formatTime(value)}` : '';
}

/** '20 to 23 Nov' or '28 Nov to 2 Dec': for delivery estimates. */
export function formatDateRange(from: DateInput, to: DateInput): string {
  const start = parse(from);
  const end = parse(to);
  if (!start || !end) return formatDate(from, { year: false }) || formatDate(to, { year: false });
  const a = parts(start.date, start.timeZone, { day: 'numeric', month: 'short' });
  const b = parts(end.date, end.timeZone, { day: 'numeric', month: 'short' });
  if (a.day === b.day && a.month === b.month) return `${a.day} ${a.month}`;
  return a.month === b.month ? `${a.day} to ${b.day} ${b.month}` : `${a.day} ${a.month} to ${b.day} ${b.month}`;
}

/** The calendar day of a value, as days since 1970, in the store's time zone. */
function dayNumber(value: DateInput): number | null {
  const parsed = parse(value);
  if (!parsed) return null;
  const p = parts(parsed.date, parsed.timeZone, { day: 'numeric', month: 'numeric', year: 'numeric' });
  return Math.floor(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) / DAY_MS);
}

/**
 * 'today', 'yesterday', 'tomorrow', '3 days ago', 'in 3 days', and the date itself
 * beyond a week. Lower case so it reads inside a sentence: use capitalize() for a label.
 */
export function relativeDay(value: DateInput, now: DateInput = Date.now()): string {
  const day = dayNumber(value);
  const today = dayNumber(now);
  if (day === null || today === null) return '';
  const diff = day - today;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1 && diff < 7) return `in ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return formatDate(value);
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** pluralize(1, 'item') → '1 item'; pluralize(3, 'item') → '3 items'; pluralize(2, 'box', 'boxes') → '2 boxes'. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function hours(minutes: number): string {
  const value = Math.round((minutes / 60) * 10) / 10;
  return String(value);
}

/**
 * Fitting time in plain words: minutesLabel(45, 90) → '45 min to 1.5 hr',
 * minutesLabel(20, 40) → '20 to 40 min', minutesLabel(60, 120) → '1 to 2 hr', minutesLabel(30) → '30 min'.
 * '' when there is no time to state.
 */
export function minutesLabel(min: number | null | undefined, max?: number | null): string {
  const low = Math.max(0, Math.round(min ?? 0));
  const high = Math.max(0, Math.round(max ?? 0));
  const from = low || high;
  const to = Math.max(low, high);
  if (from <= 0) return '';
  if (from === to) return from < 60 ? `${from} min` : `${hours(from)} hr`;
  if (to < 60) return `${from} to ${to} min`;
  if (from >= 60) return `${hours(from)} to ${hours(to)} hr`;
  return `${from} min to ${hours(to)} hr`;
}
