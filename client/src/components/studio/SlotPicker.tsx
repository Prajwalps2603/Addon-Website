import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ban, Check, ChevronLeft, ChevronRight, CircleAlert, Clock, Info, RotateCw } from 'lucide-react';
import { Button, Callout, Skeleton } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { StudioDay, StudioSlot } from '@/types/api';
import { SLOT_REASON_DETAIL, SLOT_REASON_WORDS, dayChip, daysFrom, longDate, slotLabel, todayInIndia, weekdayOf } from './studioTime';

export interface SlotValue {
  /** 'YYYY-MM-DD', India time. */
  date: string;
  /** 'HH:MM', India time, one of settings.studio.slots. */
  slot: string;
}

export interface SlotPickerProps {
  value: SlotValue | null;
  /**
   * Called with the chosen day and slot. Called with null when the chosen slot is no longer
   * free (someone else took the last place, or its time has passed) so the form can ask again.
   */
  onChange: (value: SlotValue | null) => void;
  /** A message under the picker, e.g. "Choose a time" after a failed submit. */
  error?: ReactNode;
  /** How many days the strip shows, from today. Default 14. */
  days?: number;
  className?: string;
}

type DayState = 'open' | 'full' | 'closed' | 'gone';

/** What a whole day looks like on the strip, from the calendar answer. */
function stateOf(day: StudioDay | undefined): DayState | null {
  if (!day) return null;
  if (day.open) return 'open';
  if (day.slots.length === 0 || day.slots.every((slot) => slot.reason === 'closed')) return 'closed';
  if (day.slots.some((slot) => slot.reason === 'full')) return 'full';
  return 'gone';
}

const DAY_STATE_WORDS: Record<Exclude<DayState, 'open'>, string> = {
  closed: 'Closed',
  full: 'Full',
  gone: 'None left',
};

/** Keeps the chosen day in view inside the sideways strip without moving the page. */
function scrollIntoStrip(strip: HTMLElement | null, day: string): void {
  if (!strip) return;
  const chip = strip.querySelector<HTMLElement>(`[data-day="${day}"]`);
  if (!chip) return;
  const box = strip.getBoundingClientRect();
  const rect = chip.getBoundingClientRect();
  const left = rect.left - box.left + strip.scrollLeft;
  const right = left + rect.width;
  if (left < strip.scrollLeft) strip.scrollLeft = Math.max(0, left - 8);
  else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 8;
}

/** The days of a month ('YYYY-MM') laid out Sunday first, with nulls for the blanks before the 1st. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const daysIn = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let d = 1; d <= daysIn; d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  return cells;
}

function SlotReasonIcon({ reason }: { reason: StudioSlot['reason'] }) {
  if (reason === 'full') return <Ban aria-hidden className="size-3.5 shrink-0" />;
  if (reason === 'closed') return <Ban aria-hidden className="size-3.5 shrink-0" />;
  return <Clock aria-hidden className="size-3.5 shrink-0" />;
}

/**
 * The studio's date strip and the day's slots. Days and times are India time. Each slot says in
 * words when it cannot be booked (full, gone, too soon, closed), and how many places are left.
 * Native radio buttons underneath: Tab reaches each group, arrow keys move within it.
 */
export default function SlotPicker({ value, onChange, error, days: daysProp, className }: SlotPickerProps) {
  const id = useId();
  const stripRef = useRef<HTMLDivElement>(null);
  const settings = useSettings().data;
  // The calendar covers the whole booking window (the API serves at most 62 days).
  const days = Math.min(62, Math.max(7, daysProp ?? (settings?.studio.maxDaysAhead ?? 60) + 1));
  const sundayLastSlot = settings?.studio.sundayLastSlot ?? '';

  const [today] = useState(todayInIndia);
  const strip = useMemo(() => daysFrom(today, days), [today, days]);

  const calendar = useQuery({
    queryKey: queryKeys.studio.calendar({ from: today, days }),
    queryFn: ({ signal }) => api.studio.calendar({ from: today, days }, { signal }),
    staleTime: 60_000,
  });
  const byDay = useMemo(() => new Map((calendar.data ?? []).map((entry) => [entry.date, entry])), [calendar.data]);

  // The day on show. Starts on the chosen slot's day, else the first day with a free slot.
  const touched = useRef(Boolean(value));
  const [day, setDay] = useState<string>(() => (value && strip.includes(value.date) ? value.date : today));
  useEffect(() => {
    if (touched.current || !calendar.data) return;
    const firstOpen = calendar.data.find((entry) => entry.open);
    if (firstOpen && strip.includes(firstOpen.date)) setDay(firstOpen.date);
    touched.current = true;
  }, [calendar.data, strip]);

  useEffect(() => {
    if (value && strip.includes(value.date)) {
      setDay(value.date);
      touched.current = true;
    }
  }, [value, strip]);

  useEffect(() => {
    scrollIntoStrip(stripRef.current, day);
  }, [day]);

  const slots = useQuery({
    queryKey: queryKeys.studio.slots(day),
    queryFn: ({ signal }) => api.studio.slots(day, { signal }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // A chosen slot that has just filled or passed is dropped, so the form asks again.
  useEffect(() => {
    if (!value || value.date !== day || !slots.data) return;
    const current = slots.data.slots.find((slot) => slot.slot === value.slot);
    if (!current || !current.available) onChange(null);
  }, [slots.data, value, day, onChange]);

  const [month, setMonth] = useState(() => (value?.date ?? today).slice(0, 7));
  useEffect(() => {
    setMonth(day.slice(0, 7));
  }, [day]);
  const firstMonth = today.slice(0, 7);
  const lastMonth = (strip[strip.length - 1] ?? today).slice(0, 7);
  const shiftMonth = (by: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (next >= firstMonth && next <= lastMonth) setMonth(next);
  };
  const inWindow = new Set(strip);

  const pickDay = (next: string) => {
    touched.current = true;
    setDay(next);
  };

  const dayLegendId = `${id}-day`;
  const timeLegendId = `${id}-time`;
  const errorId = `${id}-error`;
  const message = slots.data?.message ?? byDay.get(day)?.message ?? '';
  const anyFree = slots.data?.slots.some((slot) => slot.available) ?? false;

  return (
    <div className={cn('grid min-w-0 gap-5', className)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
      <fieldset className="min-w-0 rounded-[16px] border border-line bg-raised p-4" aria-describedby={error ? errorId : undefined}>
        <legend id={dayLegendId} className="sr-only">
          Day
        </legend>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={month <= firstMonth}
            aria-label="Previous month"
            className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 disabled:opacity-30"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <p className="font-bold" aria-live="polite">
            {new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={month >= lastMonth}
            aria-label="Next month"
            className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface-2 disabled:opacity-30"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
        <div aria-hidden className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
            <span key={w} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div ref={stripRef} className="grid grid-cols-7 gap-1">
          {monthCells(month).map((date, index) => {
            if (!date) return <span key={`blank-${index}`} aria-hidden />;
            const state = stateOf(byDay.get(date));
            const bookable = inWindow.has(date) && (state === null || state === 'open');
            const selected = date === day;
            const isToday = date === today;
            const hasChosenSlot = value?.date === date;
            const shut = inWindow.has(date) && state !== null && state !== 'open';
            const note = shut ? DAY_STATE_WORDS[state as Exclude<DayState, 'open'>] : isToday ? 'Today' : '';
            return (
              <label key={date} data-day={date} className="relative">
                <input
                  type="radio"
                  name={`${id}-day`}
                  value={date}
                  checked={selected}
                  disabled={!bookable}
                  onChange={() => pickDay(date)}
                  className="peer sr-only"
                  aria-label={`${longDate(date)}${note ? `, ${note}` : ''}${hasChosenSlot ? ', your chosen day' : ''}${!bookable && !shut ? ', not bookable' : ''}`}
                />
                <span
                  aria-hidden
                  title={note || undefined}
                  className={cn(
                    'relative grid aspect-square place-items-center rounded-full text-sm font-semibold tnum transition-colors dur-quick',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                    selected
                      ? 'bg-brand text-brand-ink'
                      : bookable
                        ? 'cursor-pointer text-ink hover:bg-surface-2'
                        : 'cursor-not-allowed text-muted opacity-40',
                    isToday && !selected && 'ring-2 ring-line-strong ring-inset',
                    shut && !selected && 'line-through',
                  )}
                >
                  {Number(date.slice(8))}
                  {hasChosenSlot && !selected && <span className="absolute bottom-1 size-1 rounded-full bg-brand" />}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full ring-2 ring-line-strong ring-inset" /> Today
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-brand" /> Chosen
          </span>
          {sundayLastSlot && <span>Sundays are a half day</span>}
        </p>
      </fieldset>

      <fieldset className="min-w-0" aria-describedby={error ? errorId : undefined}>
        <legend id={timeLegendId} className="mb-3 font-bold">
          Time on {longDate(day).replace(/ \d{4}$/, '')}
        </legend>

        {slots.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="status" aria-label="Checking free slots">
            {Array.from({ length: settings?.studio.slots.length || 6 }, (_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : slots.isError ? (
          <Callout
            tone="danger"
            title="Could not load the slots"
            actions={
              <Button size="sm" variant="outline" iconLeft={<RotateCw aria-hidden />} onClick={() => void slots.refetch()} loading={slots.isFetching}>
                Try again
              </Button>
            }
          >
            {slots.error.message}
          </Callout>
        ) : (
          <div className="grid gap-3">
            <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3', slots.isFetching && 'opacity-80')}>
              {slots.data.slots.map((slot) => {
                const checked = value?.date === day && value.slot === slot.slot;
                const reason = slot.reason;
                const status = slot.available
                  ? slot.left === 1
                    ? '1 place left'
                    : `${pluralize(slot.left, 'place')} left`
                  : reason
                    ? SLOT_REASON_WORDS[reason]
                    : 'Not available';
                const detail = slot.available ? status : reason ? SLOT_REASON_DETAIL[reason] : 'Not available';
                return (
                  <label key={slot.slot} className="relative min-w-0">
                    <input
                      type="radio"
                      name={`${id}-slot`}
                      value={slot.slot}
                      checked={checked}
                      disabled={!slot.available}
                      onChange={() => onChange({ date: day, slot: slot.slot })}
                      className="peer sr-only"
                      aria-label={`${slotLabel(slot.slot)}, ${detail}`}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        'flex min-h-14 flex-col justify-center gap-0.5 rounded-[12px] border-2 px-3.5 py-2 transition-colors dur-quick',
                        'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                        slot.available
                          ? checked
                            ? 'cursor-pointer border-brand bg-brand text-brand-ink'
                            : 'cursor-pointer border-line bg-surface hover:border-line-strong'
                          : 'cursor-not-allowed border-transparent bg-surface text-muted opacity-55',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-base leading-tight font-bold tnum">{slotLabel(slot.slot)}</span>
                        {checked && <Check className="size-4 shrink-0" strokeWidth={3} />}
                      </span>
                      <span className={cn('type-small flex items-center gap-1', slot.available && !checked && 'text-muted')}>
                        {!slot.available && <SlotReasonIcon reason={reason} />}
                        {status}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {message && (
              <p className="type-small flex items-start gap-1.5 text-muted">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{message}</span>
              </p>
            )}
            {!anyFree && (
              <p className="type-small flex items-start gap-1.5 text-muted">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>No free slots on this day. Pick another day above.</span>
              </p>
            )}
          </div>
        )}
      </fieldset>
      </div>

      {error && (
        <p id={errorId} role="alert" className="type-small -mt-2 flex items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {value ? `Chosen: ${longDate(value.date)} at ${slotLabel(value.slot)}` : ''}
      </p>
    </div>
  );
}
