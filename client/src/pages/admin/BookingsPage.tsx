import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { addDays, daysFrom, longDate, slotLabel, todayInIndia } from '@/components/studio';
import { dayChip } from '@/components/studio/studioTime';
import {
  Button,
  Callout,
  EmptyState,
  Field,
  IconButton,
  Input,
  Pagination,
  Segmented,
  Select,
  Table,
  type TableColumn,
} from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api, type AdminBookingQuery } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminBooking, BookingStatus } from '@/types/api';
import { PLAIN_DAY } from './sales/dates';
import { SearchBox, useUrlFilters } from './sales/urlState';
import { BookingDrawer } from './studio/BookingDrawer';
import {
  ADMIN_STATUS_LABELS,
  BOOKING_STATUSES,
  BookingStatusBadge,
  STILL_TO_HANDLE,
  TAKES_A_BAY,
  dayName,
  diaryRows,
  slotsForDay,
  useBookings,
  useDayBookings,
} from './studio/bookings';
import { Diary, DiarySkeleton } from './studio/Diary';

const FILTER_KEYS = ['view', 'day', 'q', 'status', 'from', 'to', 'booking'] as const;
const STRIP_DAYS = 14;
const PAGE_SIZE = 50;

const STATUS_OPTIONS = BOOKING_STATUSES.map((value) => ({ value, label: ADMIN_STATUS_LABELS[value] }));

function isStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

/**
 * The studio diary. "Day" lays one day out as slots by bays, with a strip of the next two weeks
 * and how full each day is. "List" searches and filters every booking from a date onwards.
 * Opening a car shows its booking in a drawer: the next step, WhatsApp, a move, the studio note.
 */
export default function BookingsPage() {
  useDocumentMeta({ title: 'Studio bookings', noindex: true });
  const { values, page, set, hrefFor } = useUrlFilters(FILTER_KEYS);
  const settings = useSettings();
  const today = todayInIndia();
  const view = values.view === 'list' ? 'list' : 'day';
  const day = PLAIN_DAY.test(values.day) ? values.day : today;

  const todays = useDayBookings(today);
  const todayCount = (todays.data?.items ?? []).filter((booking) => TAKES_A_BAY.has(booking.status)).length;

  const open = (booking: AdminBooking) => set({ booking: booking.bookingNumber, page });

  const studio = settings.data?.studio;

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Studio bookings"
        meta={todays.data ? `${pluralize(todayCount, 'car')} booked in today` : undefined}
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={(next) => set({ view: next === 'list' ? 'list' : null, booking: null })}
            options={[
              { value: 'day', label: 'Diary', icon: <CalendarDays aria-hidden /> },
              { value: 'list', label: 'List', icon: <List aria-hidden /> },
            ]}
          />
        }
      />

      {studio && !studio.enabled && (
        <Callout
          tone="warn"
          title="Studio bookings are paused"
          className="mb-6"
          actions={
            <Button variant="outline" size="sm" to="/admin/settings#studio">
              Open studio settings
            </Button>
          }
        >
          Shoppers cannot book a slot, collect from the studio or ask for fitting at checkout. Bookings already made stay here.
        </Callout>
      )}

      {view === 'day' ? (
        <DayView day={day} today={today} onDay={(next) => set({ day: next === today ? null : next, booking: null })} onOpen={open} />
      ) : (
        <ListView values={values} page={page} set={set} hrefFor={hrefFor} onOpen={open} />
      )}

      <BookingDrawer bookingNumber={values.booking || null} onClose={() => set({ booking: null, page })} />
    </div>
  );
}

interface DayViewProps {
  day: string;
  today: string;
  onDay: (day: string) => void;
  onOpen: (booking: AdminBooking) => void;
}

function DayView({ day, today, onDay, onOpen }: DayViewProps) {
  const settings = useSettings();
  const studio = settings.data?.studio;
  // The strip runs two weeks from today, or from the chosen day when that lies outside it.
  const stripStart = day >= today && day < addDays(today, STRIP_DAYS) ? today : day;
  const strip = daysFrom(stripStart, STRIP_DAYS);
  const windowQuery = useBookings({ from: strip[0], to: strip[strip.length - 1], limit: 200 });
  const dayQuery = useDayBookings(day);

  const perDay = useMemo(() => {
    const counts = new Map<string, { cars: number; toConfirm: number }>();
    for (const booking of windowQuery.data?.items ?? []) {
      if (!TAKES_A_BAY.has(booking.status)) continue;
      const entry = counts.get(booking.date) ?? { cars: 0, toConfirm: 0 };
      entry.cars += 1;
      if (booking.status === 'requested') entry.toConfirm += 1;
      counts.set(booking.date, entry);
    }
    return counts;
  }, [windowQuery.data]);

  const bookings = dayQuery.data?.items ?? [];
  const rows = studio ? diaryRows(day, studio, bookings) : [];
  const places = studio ? slotsForDay(day, studio).length * Math.max(1, studio.carsPerSlot) : 0;
  const taken = bookings.filter((booking) => TAKES_A_BAY.has(booking.status)).length;
  const toHandle = bookings.filter((booking) => STILL_TO_HANDLE.has(booking.status)).length;
  const closedDay = studio ? slotsForDay(day, studio).length === 0 : false;

  return (
    <div className="grid gap-6">
      <nav aria-label="Days" className="grid gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <IconButton label="Day before" variant="outline" onClick={() => onDay(addDays(day, -1))}>
            <ChevronLeft aria-hidden />
          </IconButton>
          <IconButton label="Next day" variant="outline" onClick={() => onDay(addDays(day, 1))}>
            <ChevronRight aria-hidden />
          </IconButton>
          <Button variant="outline" onClick={() => onDay(today)} disabled={day === today}>
            Today
          </Button>
          <Field label="Go to a day" labelHidden className="w-44">
            <Input type="date" value={day} onChange={(event) => PLAIN_DAY.test(event.target.value) && onDay(event.target.value)} className="tnum" aria-label="Go to a day" />
          </Field>
        </div>
        <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {strip.map((date) => {
            const chip = dayChip(date);
            const count = perDay.get(date);
            const chosen = date === day;
            const closed = studio ? slotsForDay(date, studio).length === 0 : false;
            return (
              <li key={date} className="flex shrink-0">
                <button
                  type="button"
                  onClick={() => onDay(date)}
                  aria-current={chosen ? 'date' : undefined}
                  className={cn(
                    'focus-ring grid w-[4.5rem] content-start justify-items-center gap-0.5 rounded-control border px-1 py-2 text-center transition-colors dur-quick',
                    chosen ? 'border-ink bg-ink text-page' : 'border-line hover:border-ink',
                  )}
                >
                  <span className={cn('type-label', chosen ? 'text-page' : 'text-muted')}>{date === today ? 'Today' : chip.weekday}</span>
                  <span className="text-lg leading-6 font-extrabold tnum">{chip.day}</span>
                  <span className={cn('type-small tnum', chosen ? 'text-page' : closed ? 'text-muted' : '')}>
                    {windowQuery.isPending ? (
                      <span className="sr-only">Loading</span>
                    ) : closed ? (
                      'Closed'
                    ) : (
                      `${count?.cars ?? 0} ${count?.cars === 1 ? 'car' : 'cars'}`
                    )}
                  </span>
                  {count && count.toConfirm > 0 && (
                    <span className={cn('type-small leading-tight font-bold tnum', chosen ? 'text-page' : '')}>
                      {count.toConfirm} to confirm
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="day-title" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="day-title" className="type-h3">
            {dayName(day) === longDate(day) ? longDate(day) : `${dayName(day)}, ${longDate(day)}`}
          </h2>
          {studio && !closedDay && dayQuery.data && (
            <p className="type-small text-muted tnum">
              {formatNumber(taken)} of {formatNumber(places)} places taken
              {toHandle > 0 && day >= today ? `, ${toHandle} still to handle` : ''}
            </p>
          )}
        </div>

        {dayQuery.error && !dayQuery.data ? (
          <ErrorState error={dayQuery.error} onRetry={() => void dayQuery.refetch()} title="Could not load this day" size="sm" />
        ) : settings.error && !studio ? (
          <ErrorState error={settings.error} onRetry={() => void settings.refetch()} title="Could not load the studio rules" size="sm" />
        ) : !studio || dayQuery.isPending ? (
          <DiarySkeleton />
        ) : closedDay && bookings.length === 0 ? (
          <EmptyState
            size="sm"
            title="The studio is closed on this day"
            description="Closed weekdays are set in Settings, under Studio."
            actions={
              <Button variant="outline" onClick={() => onDay(addDays(day, 1))}>
                Next day
              </Button>
            }
          />
        ) : (
          <>
            <Diary rows={rows} bays={studio.carsPerSlot} onOpen={onOpen} />
            {bookings.length === 0 && (
              <p className="type-small text-muted">
                No cars booked {day < today ? 'on this day' : 'yet'}. Bookings from the shop and from studio orders appear here.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

interface ListViewProps {
  values: Record<(typeof FILTER_KEYS)[number], string>;
  page: number;
  set: (patch: Partial<Record<(typeof FILTER_KEYS)[number] | 'page', string | number | null>>) => void;
  hrefFor: (page: number) => string;
  onOpen: (booking: AdminBooking) => void;
}

function ListView({ values, page, set, hrefFor, onOpen }: ListViewProps) {
  const status = isStatus(values.status) ? values.status : undefined;
  const from = PLAIN_DAY.test(values.from) ? values.from : undefined;
  const to = PLAIN_DAY.test(values.to) ? values.to : undefined;
  const query: AdminBookingQuery = { q: values.q || undefined, status, from, to, page, limit: PAGE_SIZE };
  const list = useQuery({
    queryKey: queryKeys.admin.bookings.list(query),
    queryFn: ({ signal }) => api.admin.bookings.list(query, { signal }),
    placeholderData: keepPreviousData,
  });

  const filtered = Boolean(values.q || status || from || to);
  const clear = () => set({ q: null, status: null, from: null, to: null });

  const columns: TableColumn<AdminBooking>[] = [
    {
      key: 'when',
      header: 'When',
      primary: true,
      cell: (booking) => (
        <button type="button" onClick={() => onOpen(booking)} className="focus-ring link grid text-left font-bold">
          <span className="tnum">
            {dayName(booking.date)}, {slotLabel(booking.slot)}
          </span>
          <span className="type-code font-medium text-muted">{booking.bookingNumber}</span>
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (booking) => (
        <span className="grid">
          <span className="font-bold">{booking.name}</span>
          <span className="type-small text-muted tnum">{formatPhone(booking.phone)}</span>
        </span>
      ),
    },
    {
      key: 'car',
      header: 'Car',
      cell: (booking) => (
        <span className="grid">
          <span>{booking.vehicle || 'Not given'}</span>
          {booking.registrationNumber && <span className="type-code text-muted">{booking.registrationNumber}</span>}
        </span>
      ),
    },
    {
      key: 'work',
      header: 'Work',
      cell: (booking) => (
        <span className="grid">
          <span>{booking.serviceName}</span>
          {booking.orderNumber && (
            <Link to={`/admin/orders/${encodeURIComponent(booking.orderNumber)}`} className="type-code link focus-ring">
              {booking.orderNumber}
            </Link>
          )}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (booking) => <BookingStatusBadge status={booking.status} /> },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
        <SearchBox
          label="Search bookings"
          placeholder="Name, phone, car, registration or number"
          value={values.q}
          onSearch={(q) => set({ q })}
          className="col-span-full md:col-span-1"
        />
        <div className="grid grid-cols-2 gap-3 md:contents">
          <Field label="Status" className="col-span-2 md:col-span-1">
            <Select placeholder="Any status" options={STATUS_OPTIONS} value={status ?? ''} onChange={(event) => set({ status: event.target.value })} />
          </Field>
          <Field label="From" hint={from ? undefined : 'Blank: from today'}>
            <Input type="date" value={from ?? ''} max={to} onChange={(event) => set({ from: event.target.value })} className="tnum" />
          </Field>
          <Field label="To">
            <Input type="date" value={to ?? ''} min={from} onChange={(event) => set({ to: event.target.value })} className="tnum" />
          </Field>
        </div>
      </div>
      {filtered && (
        <div>
          <Button variant="ghost" size="sm" iconLeft={<X aria-hidden />} onClick={clear}>
            Clear search and filters
          </Button>
        </div>
      )}

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Could not load the bookings" />
      ) : (
        <div className={cn('transition-opacity dur-base', list.isPlaceholderData && 'opacity-60')} aria-busy={list.isFetching || undefined}>
          {list.data && (
            <p className="type-small mb-2 text-muted tnum">
              {pluralize(list.data.total, 'booking')}
              {from || to ? '' : ' from today on'}
            </p>
          )}
          <Table
            columns={columns}
            rows={list.data?.items ?? []}
            rowKey={(booking) => booking.bookingNumber}
            caption="Studio bookings"
            loading={list.isPending}
            dense
            empty={
              <div className="py-8">
                {filtered ? (
                  <EmptyState
                    size="sm"
                    title="No bookings match"
                    description="Nothing fits this search and these filters."
                    actions={
                      <Button variant="outline" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState size="sm" title="No bookings from today on" description="Bookings made in the shop and slots from studio orders appear here." />
                )}
              </div>
            }
          />
          {list.data && list.data.pages > 1 && <Pagination page={list.data.page} pageCount={list.data.pages} hrefFor={hrefFor} label="Bookings" className="mt-6" />}
        </div>
      )}
    </div>
  );
}
