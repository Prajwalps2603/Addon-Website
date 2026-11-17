import { useEffect, useId, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Ban, CalendarClock, ExternalLink, UserX } from 'lucide-react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '@/components/brand';
import { DemoBadge } from '@/components/commerce';
import { SLOT_REASON_WORDS, addDays, chargeLabel, longDate, slotLabel, todayInIndia } from '@/components/studio';
import { Button, Callout, CopyButton, Drawer, Field, Input, Skeleton, Textarea, toast } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, minutesLabel } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminBooking, AdminBookingUpdate, BookingStatus, Paginated, StudioSlot } from '@/types/api';
import { CallButton, useCustomerWaLink } from '../sales/contact';
import { ADMIN_STATUS_LABELS, BookingStatusBadge, bookingCustomerMessage, dayName, dayPhrase, hasStarted, nextSteps } from './bookings';

/** PUT one booking; refreshes the diary, the slot answers the storefront reads, and the order it belongs to. */
export function useBookingUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingNumber, body }: { bookingNumber: string; body: AdminBookingUpdate; success: string }) =>
      api.admin.bookings.update(bookingNumber, body),
    onSuccess: (saved, { success }) => {
      queryClient.setQueryData(queryKeys.admin.bookings.detail(saved.bookingNumber), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bookings.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
      if (saved.orderNumber) void queryClient.invalidateQueries({ queryKey: queryKeys.admin.orders.all() });
      toast.success(success, { description: `${saved.bookingNumber}, ${dayName(saved.date)} at ${slotLabel(saved.slot)}` });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'slot_unavailable') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
        toast.error('That slot has just filled', { description: 'Choose another time.' });
        return;
      }
      toast.error('Could not update the booking', { description: errorMessage(error) });
    },
  });
}

function loadedRow(queryClient: QueryClient, bookingNumber: string): AdminBooking | undefined {
  for (const [, page] of queryClient.getQueriesData<Paginated<AdminBooking>>({ queryKey: queryKeys.admin.bookings.all() })) {
    const hit = page?.items?.find((item) => item.bookingNumber === bookingNumber);
    if (hit) return hit;
  }
  return undefined;
}

const STATUS_SUCCESS: Record<BookingStatus, string> = {
  requested: 'Booking reopened',
  confirmed: 'Booking confirmed',
  in_progress: 'Car checked in',
  completed: 'Marked done',
  cancelled: 'Booking cancelled',
  no_show: 'Marked missed',
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
      <dt className="type-small text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export interface BookingDrawerProps {
  /** The booking to show; null closes the drawer. */
  bookingNumber: string | null;
  onClose: () => void;
}

/** One booking: who and what, the next step, a WhatsApp message, a move to another slot and the studio's own note. */
export function BookingDrawer({ bookingNumber, onClose }: BookingDrawerProps) {
  const queryClient = useQueryClient();
  const [last, setLast] = useState(bookingNumber);
  if (bookingNumber && bookingNumber !== last) setLast(bookingNumber);
  const number = bookingNumber ?? last;
  const detail = useQuery({
    queryKey: queryKeys.admin.bookings.detail(number ?? ''),
    queryFn: ({ signal }) => api.admin.bookings.get(number ?? '', { signal }),
    enabled: Boolean(number),
    // The row the diary already holds shows at once while the fresh copy loads.
    placeholderData: () => (number ? loadedRow(queryClient, number) : undefined),
  });
  const booking = detail.data ?? null;
  const open = bookingNumber !== null;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={booking ? booking.name || 'Booking' : 'Booking'}
      description={booking ? `${booking.bookingNumber}, ${dayName(booking.date)} at ${slotLabel(booking.slot)}` : undefined}
    >
      {booking ? (
        <BookingDetail key={booking.bookingNumber} booking={booking} />
      ) : detail.error ? (
        <Callout tone="danger" title="Could not load this booking">
          {errorMessage(detail.error)}
        </Callout>
      ) : (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-11 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </Drawer>
  );
}

function BookingDetail({ booking }: { booking: AdminBooking }) {
  const update = useBookingUpdate();
  const [confirming, setConfirming] = useState<null | 'cancelled' | 'no_show'>(null);
  const steps = nextSteps(booking.status);
  const open = booking.status === 'requested' || booking.status === 'confirmed';
  const fromOrder = booking.orderNumber !== '';

  const setStatus = (status: BookingStatus) =>
    update.mutate(
      { bookingNumber: booking.bookingNumber, body: { status }, success: STATUS_SUCCESS[status] },
      { onSuccess: () => setConfirming(null) },
    );

  return (
    <div className="grid gap-8">
      <section aria-label="Where it stands" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookingStatusBadge status={booking.status} />
          {booking.isDemo && <DemoBadge />}
        </div>
        {(steps.length > 0 || open) && (
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            {steps.map((step, index) => (
              <Button
                key={step.status}
                variant={index === 0 ? 'primary' : 'outline'}
                loading={update.isPending && update.variables?.body.status === step.status}
                onClick={() => setStatus(step.status)}
              >
                {step.label}
              </Button>
            ))}
            {open && hasStarted(booking.date, booking.slot) && (
              <Button variant="outline" iconLeft={<UserX aria-hidden />} onClick={() => setConfirming('no_show')}>
                Did not come
              </Button>
            )}
            {open && !fromOrder && (
              <Button variant="danger" iconLeft={<Ban aria-hidden />} onClick={() => setConfirming('cancelled')}>
                Cancel booking
              </Button>
            )}
          </div>
        )}
        {confirming && (
          <Callout
            tone={confirming === 'cancelled' ? 'danger' : 'warn'}
            title={confirming === 'cancelled' ? 'Cancel this booking?' : 'Mark the car as not come?'}
            actions={
              <>
                <Button
                  variant={confirming === 'cancelled' ? 'danger' : 'dark'}
                  size="sm"
                  loading={update.isPending}
                  onClick={() => setStatus(confirming)}
                >
                  {confirming === 'cancelled' ? 'Yes, cancel it' : 'Yes, mark missed'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
              </>
            }
          >
            {confirming === 'cancelled'
              ? 'The slot opens up for other customers. The customer is emailed if they gave an email.'
              : 'The bay opens up again. You can book it back in later.'}
          </Callout>
        )}
        {fromOrder && open && (
          <p className="type-small max-w-prose text-muted">
            This slot belongs to order{' '}
            <Link to={`/admin/orders/${encodeURIComponent(booking.orderNumber)}`} className="link focus-ring font-bold">
              {booking.orderNumber}
            </Link>
            . To call it off, cancel the order: the booking follows it.
          </p>
        )}
      </section>

      <section aria-labelledby="booking-what" className="grid gap-1">
        <h3 id="booking-what" className="type-h3 border-b border-ink pb-2">
          The job
        </h3>
        <dl>
          <Row label="Work">
            <span className="font-bold">{booking.serviceName}</span>
            <span className="block type-small text-muted tnum">
              {[
                booking.orderNumber ? null : chargeLabel({ id: booking.serviceId, charge: booking.serviceCharge }),
                booking.serviceMinutes > 0 ? minutesLabel(booking.serviceMinutes) : null,
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </Row>
          <Row label="When">
            <span className="tnum">
              {longDate(booking.date)}, {slotLabel(booking.slot)}
            </span>
          </Row>
          <Row label="Car">
            {booking.vehicle || <span className="text-muted">Not given</span>}
            {booking.registrationNumber && <span className="type-code mt-1 block">{booking.registrationNumber}</span>}
          </Row>
          {booking.orderNumber && (
            <Row label="Order">
              <Link to={`/admin/orders/${encodeURIComponent(booking.orderNumber)}`} className="type-code link focus-ring">
                {booking.orderNumber}
              </Link>
              <span className="block type-small text-muted">Parts and fitting charges are on the order.</span>
            </Row>
          )}
          {booking.notes && (
            <Row label="Customer note">
              <span className="whitespace-pre-line">{booking.notes}</span>
            </Row>
          )}
          <Row label="Booked">
            <span className="tnum">{formatDateTime(booking.createdAt)}</span>
          </Row>
        </dl>
      </section>

      <CustomerSection booking={booking} />
      <MoveSection booking={booking} />
      <NoteSection booking={booking} />
    </div>
  );
}

function CustomerSection({ booking }: { booking: AdminBooking }) {
  const settings = useSettings().data;
  const draft = bookingCustomerMessage(booking, settings);
  const [text, setText] = useState(draft);
  const id = useId();
  useEffect(() => setText(draft), [draft]);
  const href = useCustomerWaLink(booking.phone, text);

  return (
    <section aria-labelledby="booking-who" className="grid gap-3">
      <h3 id="booking-who" className="type-h3 border-b border-ink pb-2">
        Customer
      </h3>
      <div className="grid gap-0.5">
        <p className="font-bold">{booking.name}</p>
        <p className="tnum">{formatPhone(booking.phone)}</p>
        {booking.email && (
          <a href={`mailto:${booking.email}`} className="link focus-ring break-all">
            {booking.email}
          </a>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <CallButton phone={booking.phone} />
        <Button variant="ghost" size="sm" to={`/admin/bookings?view=list&q=${encodeURIComponent(booking.phone)}`}>
          Their bookings
        </Button>
      </div>
      <Field
        label="WhatsApp message"
        hint={`Written for: ${ADMIN_STATUS_LABELS[booking.status]}. Edit anything before sending.`}
        className="mt-2"
      >
        <Textarea id={id} rows={7} value={text} onChange={(event) => setText(event.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        {href ? (
          <Button href={href} target="_blank" rel="noopener noreferrer" variant="outline" iconLeft={<WhatsAppIcon />}>
            Send on WhatsApp
          </Button>
        ) : (
          <p className="type-small text-muted">
            {settings?.whatsapp ? 'This phone number cannot take a WhatsApp link.' : 'Add the store WhatsApp number in Settings to send from here.'}
          </p>
        )}
        <CopyButton value={text} label="Copy message" />
        {text !== draft && (
          <Button variant="ghost" size="sm" onClick={() => setText(draft)}>
            Undo my changes
          </Button>
        )}
      </div>
    </section>
  );
}

/** Slots staff may move a car into: free ones, and ones only too soon for shoppers to book online. */
function movable(slot: StudioSlot): boolean {
  return slot.available || slot.reason === 'notice';
}

function MoveSection({ booking }: { booking: AdminBooking }) {
  const settings = useSettings().data;
  const today = todayInIndia();
  const update = useBookingUpdate();
  const [day, setDay] = useState(booking.date < today ? today : booking.date);
  const [slot, setSlot] = useState<string | null>(null);
  const closed = booking.status === 'completed';
  const maxDay = addDays(today, settings?.studio.maxDaysAhead ?? 60);

  const answer = useQuery({
    queryKey: queryKeys.studio.slots(day),
    queryFn: ({ signal }) => api.studio.slots(day, { signal }),
    enabled: !closed && /^\d{4}-\d{2}-\d{2}$/.test(day),
  });

  if (closed) return null;

  const isCurrent = (time: string) => day === booking.date && time === booking.slot;
  const move = () => {
    if (!slot) return;
    update.mutate(
      { bookingNumber: booking.bookingNumber, body: { date: day, slot }, success: 'Booking moved' },
      { onSuccess: () => setSlot(null) },
    );
  };

  return (
    <section aria-labelledby="booking-move" className="grid gap-3">
      <h3 id="booking-move" className="type-h3 border-b border-ink pb-2">
        Move to another slot
      </h3>
      <p className="type-small max-w-prose text-muted">
        Places left are counted with this car still in its own slot. The customer is emailed about the new time
        {booking.orderNumber ? ', and the order moves with it' : ''}.
      </p>
      <Field label="Day">
        <Input
          type="date"
          value={day}
          min={today}
          max={maxDay}
          onChange={(event) => {
            setDay(event.target.value);
            setSlot(null);
          }}
          className="tnum"
        />
      </Field>
      {answer.isPending ? (
        <div className="grid grid-cols-3 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : answer.error ? (
        <Callout tone="danger" title="Could not load the slots" actions={<Button size="sm" variant="outline" onClick={() => void answer.refetch()}>Try again</Button>}>
          {errorMessage(answer.error)}
        </Callout>
      ) : answer.data.slots.length === 0 ? (
        <p className="text-muted">{answer.data.message || 'The studio has no slots on this day.'}</p>
      ) : (
        <>
          {answer.data.message && <p className="type-small text-muted">{answer.data.message}</p>}
          <div role="radiogroup" aria-label={`Slots on ${longDate(day)}`} className="grid grid-cols-3 gap-2">
            {answer.data.slots.map((option) => {
              const current = isCurrent(option.slot);
              const can = !current && movable(option);
              const chosen = slot === option.slot;
              const word = current ? 'Booked here' : option.available ? `${option.left} free` : option.reason ? SLOT_REASON_WORDS[option.reason] : 'Free';
              return (
                <button
                  key={option.slot}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={!can}
                  onClick={() => setSlot(option.slot)}
                  className={cn(
                    'focus-ring grid min-h-14 content-center rounded-control border px-2 py-1.5 text-left transition-colors dur-quick',
                    chosen ? 'border-ink bg-brand-soft' : 'border-line-strong hover:border-ink',
                    !can && 'cursor-not-allowed border-line bg-surface text-muted hover:border-line',
                  )}
                >
                  <span className="font-bold tnum">{slotLabel(option.slot)}</span>
                  <span className="type-small">{option.reason === 'notice' && !current ? 'Short notice' : word}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div>
        <Button variant="dark" iconLeft={<ArrowRightLeft aria-hidden />} disabled={!slot} loading={update.isPending && Boolean(update.variables?.body.slot)} onClick={move}>
          {slot ? `Move to ${dayPhrase(day)}, ${slotLabel(slot)}` : 'Choose a slot first'}
        </Button>
      </div>
    </section>
  );
}

function NoteSection({ booking }: { booking: AdminBooking }) {
  const update = useBookingUpdate();
  const [note, setNote] = useState(booking.adminNote);
  useEffect(() => setNote(booking.adminNote), [booking.adminNote]);
  const changed = note.trim() !== booking.adminNote.trim();
  return (
    <section aria-labelledby="booking-note" className="grid gap-3">
      <h3 id="booking-note" className="type-h3 border-b border-ink pb-2">
        Studio note
      </h3>
      <Field label="Note for the team" hint="Only staff see this. Parts to keep ready, who is fitting, what the customer asked on the phone.">
        <Textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          iconLeft={<CalendarClock aria-hidden />}
          disabled={!changed}
          loading={update.isPending && update.variables?.body.adminNote !== undefined}
          onClick={() => update.mutate({ bookingNumber: booking.bookingNumber, body: { adminNote: note.trim() }, success: 'Note saved' })}
        >
          Save note
        </Button>
        {booking.orderNumber && (
          <Button variant="ghost" size="sm" to={`/admin/orders/${encodeURIComponent(booking.orderNumber)}`} iconRight={<ExternalLink aria-hidden />}>
            Open the order
          </Button>
        )}
      </div>
    </section>
  );
}
