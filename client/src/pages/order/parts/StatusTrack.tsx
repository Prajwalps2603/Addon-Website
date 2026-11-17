import { Check, CircleSlash, Undo2 } from 'lucide-react';
import { BoardWord, PitBoard, Roundel } from '@/components/brand';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { capitalize, formatDate, formatDateTime, formatINR, formatTime, relativeDay } from '@/lib/format';
import { ORDER_PROGRESS, ORDER_STATUS_LABELS } from '@/lib/labels';
import type { Order, OrderEvent, OrderStatus } from '@/types/api';
import { progressFor, slotWords, statusLabel } from './fulfilment';

function isOrderStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABELS;
}

/** The newest event for a status, or null when the order never reached it. */
function latestEvent(events: readonly OrderEvent[], status: OrderStatus): OrderEvent | null {
  let found: OrderEvent | null = null;
  for (const event of events) {
    if (event.status === status && (!found || event.createdAt >= found.createdAt)) found = event;
  }
  return found;
}

/** Where a status sits on this order's stops. A courier stop on a studio order counts as the stop before it. */
function stopIndex(progress: readonly OrderStatus[], status: OrderStatus): number {
  const at = progress.indexOf(status);
  if (at >= 0) return at;
  const general = ORDER_PROGRESS.indexOf(status);
  if (general < 0) return -1;
  let best = -1;
  progress.forEach((stop, index) => {
    if (ORDER_PROGRESS.indexOf(stop) <= general) best = index;
  });
  return best;
}

/** How far along the normal sequence the order got: -1 for none. */
function reachedIndex(order: Order, progress: readonly OrderStatus[]): number {
  if (order.status === 'pending_payment') return -1;
  const at = stopIndex(progress, order.status);
  if (at >= 0) return at;
  // Cancelled or returned: the furthest normal stop the events show.
  let furthest = -1;
  for (const event of order.events) {
    if (isOrderStatus(event.status)) furthest = Math.max(furthest, stopIndex(progress, event.status));
  }
  if (order.status === 'returned') furthest = Math.max(furthest, progress.indexOf('delivered'));
  return furthest;
}

/** One plain sentence about where the order is now. */
function statusLine(order: Order): string {
  const closedAt = latestEvent(order.events, order.status)?.createdAt ?? order.updatedAt;
  switch (order.status) {
    case 'pending_payment':
      return order.fulfilment === 'studio'
        ? 'We have saved your order and are holding your slot. It is confirmed once the payment goes through.'
        : 'We have saved your order. It goes to packing once the payment goes through.';
    case 'placed':
      if (order.fulfilment === 'studio') return order.studioSlot ? `We have your order. We confirm it and get the parts ready for ${slotWords(order.studioSlot)}.` : 'We have your order. We confirm it and get the parts ready for your slot.';
      if (order.fulfilment === 'pickup') return 'We have your order. We confirm it next, then get it ready to collect.';
      return 'We have your order. We confirm it next, then pack it.';
    case 'confirmed':
      if (order.fulfilment === 'studio') return 'Confirmed. The parts are being set aside for your fitting.';
      if (order.fulfilment === 'pickup') return 'Confirmed. We are getting it ready to collect.';
      return 'Confirmed. We are getting it ready to pack.';
    case 'packed':
      if (order.fulfilment === 'studio') return order.studioSlot ? `The parts are ready. Bring your car on ${slotWords(order.studioSlot)}.` : 'The parts are ready for your fitting.';
      if (order.fulfilment === 'pickup') return 'Ready to collect from the studio.';
      return 'Packed and waiting for the courier to collect it.';
    case 'shipped':
      return order.tracking.carrier ? `With ${order.tracking.carrier}, on its way to you.` : 'With the courier, on its way to you.';
    case 'out_for_delivery':
      return `Out for delivery ${relativeDay(closedAt)}. Keep your phone close: the rider may call.`;
    case 'delivered':
      if (order.fulfilment === 'studio') return `Fitted at the studio ${relativeDay(closedAt)}.`;
      if (order.fulfilment === 'pickup') return `Collected from the studio ${relativeDay(closedAt)}.`;
      return `Delivered ${relativeDay(closedAt)}.`;
    case 'cancelled':
      return order.amountPaid > 0 && order.paymentStatus !== 'refunded'
        ? `Cancelled ${relativeDay(closedAt)}. You paid ${formatINR(order.amountPaid)}: we refund it to the account it came from.`
        : `Cancelled ${relativeDay(closedAt)}.`;
    case 'returned':
      return `Returned to us ${relativeDay(closedAt)}.`;
    default:
      return '';
  }
}

export function StatusTrack({ order }: { order: Order }) {
  const progress = progressFor(order);
  const reached = reachedIndex(order, progress);
  const closed = order.status === 'cancelled' || order.status === 'returned';
  const closedEvent = closed ? latestEvent(order.events, order.status) : null;
  const filled = progress.length > 1 ? Math.min(1, Math.max(0, reached / (progress.length - 1))) : 1;

  return (
    <section aria-labelledby="order-status-heading" className="grid gap-6 rounded-[20px] border border-line bg-raised p-5 sm:p-7">
      <h2 id="order-status-heading" className="sr-only">
        Order status
      </h2>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <span
            className={cn(
              'inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold',
              closed ? 'bg-surface-2 text-muted' : 'bg-brand-soft text-brand-text',
            )}
          >
            {!closed && <span aria-hidden className="size-2 animate-pulse rounded-full bg-brand" />}
            {statusLabel(order, order.status)}
          </span>
          <p className="max-w-prose text-[0.9375rem] leading-relaxed">{statusLine(order)}</p>
        </div>
        <span className="text-xs text-muted tnum">Updated {formatDateTime(order.updatedAt)}</span>
      </div>

      <div className="relative">
        {/* The track behind the steps, filled up to where the order is now. */}
        <span aria-hidden className="absolute top-4 right-[calc(100%/var(--n)/2)] left-[calc(100%/var(--n)/2)] hidden h-1 rounded-full bg-surface-2 md:block" style={{ '--n': progress.length } as React.CSSProperties}>
          <span
            className={cn('block h-full rounded-full transition-[width] duration-700', closed ? 'bg-line-strong' : 'bg-brand')}
            style={{ width: `${filled * 100}%` }}
          />
        </span>
        <ol aria-label="Order progress" className="relative grid gap-4 md:gap-0" style={{ gridTemplateColumns: `repeat(${progress.length}, minmax(0, 1fr))` }}>
          {progress.map((status, index) => {
            const done = index < reached || (index === reached && (closed || status === 'delivered'));
            const current = index === reached && !done;
            const event = latestEvent(order.events, status);
            return (
              <li key={status} aria-current={current ? 'step' : undefined} className="grid content-start justify-items-center gap-2 text-center">
                <span
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full text-sm font-bold tnum',
                    done ? 'bg-brand text-brand-ink' : current ? 'bg-brand text-brand-ink ring-4 ring-brand/20' : 'border-2 border-line-strong bg-raised text-muted',
                  )}
                >
                  {done ? <Check aria-hidden strokeWidth={3} className="size-4" /> : index + 1}
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className={cn('text-sm leading-tight font-bold', !done && !current && 'text-muted')}>
                    <span className="sr-only">{done ? 'Done: ' : current ? 'Now: ' : 'Not yet: '}</span>
                    {statusLabel(order, status)}
                  </span>
                  {event && index <= reached && (
                    <span className="text-xs leading-tight text-muted tnum">
                      {formatDate(event.createdAt, { year: false })}, {formatTime(event.createdAt)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {closed && (
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral" variant="outline" icon={order.status === 'cancelled' ? <CircleSlash aria-hidden /> : <Undo2 aria-hidden />}>
            {ORDER_STATUS_LABELS[order.status]}
          </Badge>
          {closedEvent && <span className="type-small text-muted tnum">{formatDateTime(closedEvent.createdAt)}</span>}
          {closedEvent?.note && <span className="type-small">{closedEvent.note}</span>}
        </p>
      )}
    </section>
  );
}

/** Every event on the order, newest first, with its time and note. */
export function EventLog({ events }: { events: readonly OrderEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  if (sorted.length === 0) return null;
  return (
    <section aria-labelledby="order-history-heading" className="grid gap-3">
      <h2 id="order-history-heading" className="type-h3">
        History
      </h2>
      <ol className="grid border-t border-line">
        {sorted.map((event, index) => (
          <li key={`${event.createdAt}-${index}`} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
            <time dateTime={event.createdAt} className="type-small text-muted tnum">
              {formatDateTime(event.createdAt)}
            </time>
            <div className="grid gap-0.5">
              <span className="type-small font-bold">
                {isOrderStatus(event.status) ? ORDER_STATUS_LABELS[event.status] : capitalize(event.status.replace(/_/g, ' '))}
                {event.actor === 'customer' && <span className="font-normal text-muted"> · by you</span>}
              </span>
              {event.note && <span className="type-small break-words">{event.note}</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
