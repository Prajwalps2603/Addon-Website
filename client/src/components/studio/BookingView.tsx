import type { ReactNode } from 'react';
import { CalendarPlus, CircleCheck, CircleX, Hourglass, Info, UserX, Wrench } from 'lucide-react';
import { PitBoard } from '@/components/brand';
import { WhatsAppButton } from '@/components/commerce';
import { Badge, Button, Callout, CopyButton, type BadgeToneName } from '@/components/ui';
import { saveFile } from '@/lib/api';
import { minutesLabel } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { siteUrl } from '@/lib/urls';
import type { Booking, BookingStatus, PublicSettings } from '@/types/api';
import { StudioContact } from './StudioContact';
import {
  BOOKING_STATUS_DETAIL,
  BOOKING_STATUS_LABELS,
  bookingChargeLabel,
  calendarFile,
  longDate,
  slotLabel,
} from './studioTime';

const STATUS_LOOK: Record<BookingStatus, { tone: BadgeToneName; icon: ReactNode }> = {
  requested: { tone: 'info', icon: <Hourglass aria-hidden /> },
  confirmed: { tone: 'fit', icon: <CircleCheck aria-hidden /> },
  in_progress: { tone: 'info', icon: <Wrench aria-hidden /> },
  completed: { tone: 'fit', icon: <CircleCheck aria-hidden /> },
  cancelled: { tone: 'neutral', icon: <CircleX aria-hidden /> },
  no_show: { tone: 'warn', icon: <UserX aria-hidden /> },
};

/** Statuses for which the visit is still ahead. */
const UPCOMING: ReadonlySet<BookingStatus> = new Set(['requested', 'confirmed']);

export function bookingPath(booking: Pick<Booking, 'bookingNumber' | 'phone'>): string {
  return `/book-fitting/${encodeURIComponent(booking.bookingNumber)}?phone=${encodeURIComponent(booking.phone)}`;
}

/** The WhatsApp message to the studio about one booking. */
export function bookingMessage(booking: Booking): string {
  return [
    `Hi, this is about my fitting booking ${booking.bookingNumber}.`,
    `${booking.serviceName}, ${longDate(booking.date)} at ${slotLabel(booking.slot)}.`,
    booking.vehicle ? `Car: ${booking.vehicle}${booking.registrationNumber ? ` (${booking.registrationNumber})` : ''}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function downloadCalendar(booking: Booking, settings: PublicSettings): void {
  const address = settings.studio.address.trim();
  const description = [
    `Booking ${booking.bookingNumber}`,
    booking.serviceName,
    booking.vehicle ? `Car: ${booking.vehicle}` : '',
    address ? '' : `Studio address: ask ${settings.storeName} on ${settings.phone || 'WhatsApp'}`,
    siteUrl(bookingPath(booking)),
  ]
    .filter(Boolean)
    .join('\n');
  const text = calendarFile({
    uid: `${booking.bookingNumber}@addon-studio`,
    day: booking.date,
    slot: booking.slot,
    minutes: booking.serviceMinutes,
    title: `${booking.serviceName}: ${settings.storeName} studio`,
    description,
    location: address.replace(/\s*\n\s*/g, ', '),
  });
  saveFile({ blob: new Blob([text], { type: 'text/calendar;charset=utf-8' }), filename: `${booking.bookingNumber}.ics` });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="type-small text-muted">{label}</dt>
      <dd className="type-body min-w-0 break-words">{children}</dd>
    </div>
  );
}

export interface BookingViewProps {
  booking: Booking;
  settings: PublicSettings;
  /** True right after the booking was made: says so at the top. */
  justBooked?: boolean;
  /** Links under the details, e.g. "Book another fitting". */
  footer?: ReactNode;
}

/** One booking as the customer sees it: the slot on the board, the details, the studio and what to do next. */
export function BookingView({ booking, settings, justBooked = false, footer }: BookingViewProps) {
  const look = STATUS_LOOK[booking.status];
  const upcoming = UPCOMING.has(booking.status);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-12">
      <div className="grid min-w-0 content-start gap-6">
        {justBooked && (
          <Callout tone="good" live>
            The studio has your request and will confirm the slot with you.
            {booking.email ? ` A copy is on its way to ${booking.email}.` : ''} Keep the booking number to look it up later.
          </Callout>
        )}

        <PitBoard
          as="section"
          aria-label="Your slot"
          title="Your slot"
          aside={
            <Badge tone={look.tone} icon={look.icon}>
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1">
              <span className="type-label text-muted">Day</span>
              <span className="type-h3">{longDate(booking.date)}</span>
            </div>
            <div className="grid gap-1">
              <span className="type-label text-muted">Time</span>
              <span className="type-h3 tnum">
                {slotLabel(booking.slot)}
                {booking.serviceMinutes > 0 && <span className="type-small ml-2 font-normal text-muted">about {minutesLabel(booking.serviceMinutes)}</span>}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
            <span className="type-label text-muted">Booking number</span>
            <CopyButton variant="code" value={booking.bookingNumber} label="Copy booking number" />
          </div>
        </PitBoard>

        <p className="type-body max-w-prose">{BOOKING_STATUS_DETAIL[booking.status]}</p>

        {upcoming && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" iconLeft={<CalendarPlus aria-hidden />} onClick={() => downloadCalendar(booking, settings)}>
              Add to calendar
            </Button>
            <WhatsAppButton text={bookingMessage(booking)}>WhatsApp the studio</WhatsAppButton>
          </div>
        )}

        <section aria-labelledby="booking-details" className="grid gap-2">
          <h2 id="booking-details" className="type-h3">
            Booking details
          </h2>
          <dl className="border-t border-ink">
            <Row label="Service">{booking.serviceName}</Row>
            <Row label="Fitting charge">
              <span className="tnum">{bookingChargeLabel(booking.serviceId, booking.serviceCharge)}</span>
              {booking.serviceCharge > 0 && <span className="type-small text-muted"> including GST</span>}
            </Row>
            <Row label="Car">
              {booking.vehicle || 'Not given'}
              {booking.registrationNumber && <span className="type-code ml-2 align-middle">{booking.registrationNumber}</span>}
            </Row>
            <Row label="Name">{booking.name}</Row>
            <Row label="Phone">
              <span className="tnum">+91 {formatPhone(booking.phone)}</span>
            </Row>
            {booking.email && <Row label="Email">{booking.email}</Row>}
            {booking.orderNumber && (
              <Row label="Order">
                <span className="type-code">{booking.orderNumber}</span>
              </Row>
            )}
            {booking.notes && (
              <Row label="Your notes">
                <span className="whitespace-pre-line">{booking.notes}</span>
              </Row>
            )}
          </dl>
        </section>

        {footer}
      </div>

      <aside aria-labelledby="studio-heading" className="grid content-start gap-4 border-t border-ink pt-4 lg:border-t-0 lg:border-l lg:border-line lg:pt-0 lg:pl-8">
        <h2 id="studio-heading" className="type-h3">
          The studio
        </h2>
        <StudioContact settings={settings} />
        {!settings.studio.address.trim() && (
          <p className="type-small flex items-start gap-1.5 text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Ask us for directions on WhatsApp or by phone before you set out.</span>
          </p>
        )}
      </aside>
    </div>
  );
}
