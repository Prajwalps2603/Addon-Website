import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CalendarClock, Check, Clock, ExternalLink, FileText, MapPin, MessageSquareText, Store, Wrench } from 'lucide-react';
import { Roundel, StickerChip } from '@/components/brand';
import { isShowPlate, SHOW_PLATE_NOTE } from '@/components/cart/lineNotes';
import { CustomSummary, ProductFrame, WhatsAppButton } from '@/components/commerce';
import { StudioContact } from '@/components/studio';
import { Badge, Button, CopyButton } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatDateRange, formatDateTime, formatINR, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { imageVariant } from '@/lib/images';
import { PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { orderSummary } from '@/lib/whatsapp';
import type { Order, PublicSettings } from '@/types/api';
import { CancelOrder } from './CancelOrder';
import { ChequeredFlag } from './ChequeredFlag';
import { FinishPayment } from './FinishPayment';
import { atStudio, fulfilmentTitle, methodLabel, slotWords } from './fulfilment';
import { invoicePath, orderUrl } from './orderAccess';
import { describePayment } from './paymentWords';
import { EventLog, StatusTrack } from './StatusTrack';
import { SuccessMark } from './SuccessMark';

export interface OrderViewProps {
  order: Order;
  /** The access token in hand (URL, this device, or the order itself). Needed by guests to pay or cancel. */
  token: string | undefined;
  /** Opens with the "Order placed" moment (?new=1 after checkout). */
  confirmation?: boolean;
  /** Called with the fresh order after a payment or a cancellation. */
  onOrderChange(order: Order): void;
  /** Rendered above the order heading, e.g. the "look up another" link on /track. */
  before?: ReactNode;
}

const CLOSED = new Set<Order['status']>(['delivered', 'cancelled', 'returned']);

/** The whole order: status, delivery, items, money, address and what can be done next. Used by /order and /track. */
export function OrderView({ order, token, confirmation = false, onOrderChange, before }: OrderViewProps) {
  const { isSignedIn } = useMe();
  const accessToken = token ?? order.accessToken;
  const canAct = Boolean(accessToken) || isSignedIn;
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
  const pending = order.status === 'pending_payment';

  return (
    <div className="grid gap-8 pb-16 md:gap-10">
      {before}
      {confirmation ? (
        <Confirmation order={order} token={accessToken} />
      ) : (
        <header className="grid gap-2 pt-4 md:pt-6">
          <p className="type-small text-muted">Order</p>
          <h1 className="font-mono text-2xl leading-tight font-medium break-all uppercase sm:text-3xl">{order.orderNumber}</h1>
          <p className="type-small text-muted tnum">
            Placed {formatDateTime(order.createdAt)} · {pluralize(itemCount, 'item')} · {formatINR(order.total)}
            {atStudio(order) && ` · ${fulfilmentTitle(order)}`}
          </p>
        </header>
      )}

      {pending && canAct && <FinishPayment order={order} token={accessToken} onOrderChange={onOrderChange} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="grid min-w-0 content-start gap-6">
          {/* The tracker is for coming back to the order (Track order, the order link); the confirmation already says what happens next. */}
          {!confirmation && <StatusTrack order={order} />}
          <div className="rounded-[20px] border border-line bg-raised p-5 sm:p-7">{atStudio(order) ? <StudioVisit order={order} /> : <Delivery order={order} />}</div>
          <PackPhoto order={order} />
          <div className="rounded-[20px] border border-line bg-raised p-5 sm:p-7">
            <Items order={order} />
          </div>
          {!confirmation && (
            <div className="rounded-[20px] border border-line bg-raised p-5 sm:p-7">
              <EventLog events={order.events} />
            </div>
          )}
        </div>

        <aside aria-label="Payment and delivery details" className="order-soft grid min-w-0 content-start gap-8 self-start rounded-[20px] border border-line bg-raised p-5 sm:p-6 lg:sticky lg:top-24">
          <PaymentBlock order={order} />
          <PriceBreakdown order={order} />
          <Address order={order} />
          <Actions order={order} token={accessToken} canAct={canAct} onOrderChange={onOrderChange} />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The order-placed moment
// ---------------------------------------------------------------------------

function studioSteps(order: Order, settings: PublicSettings | undefined): string[] {
  const steps: string[] = [];
  const due = order.amountDue > 0 && order.paymentMethod === 'cod' ? ` Pay ${formatINR(order.amountDue)} at the studio.` : '';
  if (order.status === 'pending_payment') {
    steps.push(order.fulfilment === 'studio' ? 'Finish the payment below. Your slot is confirmed once it is through.' : 'Finish the payment below. We get the order ready once it is through.');
  } else {
    steps.push(`We confirm the order with you on ${formatPhone(order.phone)}.`);
  }
  if (order.fulfilment === 'studio') {
    steps.push(order.studioSlot ? `Bring your car to the studio on ${slotWords(order.studioSlot)}.${due}` : `Bring your car to the studio at the time we agree with you.${due}`);
  } else {
    steps.push(`Collect the parts from the studio once this page shows Ready to collect.${due}`);
  }
  if (settings?.businessHours) steps.push(`Studio hours: ${settings.businessHours}.`);
  return steps;
}

function nextSteps(order: Order, dispatchDays: number): string[] {
  const steps: string[] = [];
  if (order.status === 'pending_payment') {
    steps.push('Finish the payment below. The order goes to packing once it is through.');
  } else if (order.paymentMethod === 'cod') {
    steps.push(`We confirm the order with you on ${formatPhone(order.phone)} before we pack it.`);
  } else if (order.paymentMethod === 'upi' && order.paymentStatus === 'pending') {
    steps.push('We match your UPI reference with our bank statement, then confirm the order.');
  } else {
    steps.push('We check every item against your order and confirm it.');
  }

  steps.push('We pack it and photograph the items before sealing the box. The photo shows up on this page.');

  let ship = dispatchDays > 0 ? `It leaves us within ${pluralize(dispatchDays, 'working day')}` : 'It goes to the courier';
  ship += order.estimatedDelivery ? ` and should reach you ${formatDateRange(order.estimatedDelivery.earliest, order.estimatedDelivery.latest)}.` : '.';
  ship += ' The tracking number appears here once it ships.';
  if (order.paymentMethod === 'cod' && order.amountDue > 0) ship += ` Keep ${formatINR(order.amountDue)} ready for the courier.`;
  steps.push(ship);
  return steps;
}

/** A reference number in a soft pill with its own Copy, like the order number at the top. */
function CodePill({ tag, value }: { tag: string; value: string }) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-4">
      <span className="text-xs font-semibold text-muted uppercase">{tag}</span>
      <span className="ml-1 font-mono text-sm font-bold tracking-wide">{value}</span>
      <CopyButton value={value} label="Copy" buttonVariant="ghost" size="sm" className="!rounded-full" />
    </div>
  );
}

function Confirmation({ order, token }: { order: Order; token: string | undefined }) {
  const settings = useSettings().data;
  const placed = order.status !== 'pending_payment';
  const steps = atStudio(order) ? studioSteps(order, settings) : nextSteps(order, settings?.shipping.dispatchDays ?? 0);
  const firstName = order.customerName.trim().split(/\s+/)[0] ?? '';

  return (
    <section aria-labelledby="order-placed-heading" className="mt-4 overflow-hidden rounded-[24px] border border-line bg-raised md:mt-6">
      <div className="relative isolate grid justify-items-center gap-4 px-5 pt-10 pb-8 text-center sm:px-10">
        <span aria-hidden className="pointer-events-none absolute -top-28 left-1/2 -z-10 size-80 -translate-x-1/2 rounded-full bg-fit/15 blur-3xl" />
        <SuccessMark pending={!placed} />
        <h1 id="order-placed-heading" className="text-3xl font-bold sm:text-4xl">
          {placed ? `Thank you${firstName ? `, ${firstName}` : ''}. Order placed.` : 'Almost there: payment pending'}
        </h1>
        <p className="max-w-xl text-muted">
          {placed
            ? 'Keep your order number handy. Quote it if you call or message us.'
            : order.fulfilment === 'studio'
              ? 'Your order is saved and your slot is held, but it is not paid yet. Finish paying below to confirm it.'
              : 'Your order is saved but not paid yet. Finish paying below and it goes to packing.'}
        </p>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface py-1 pr-1 pl-4">
          <span className="text-xs font-semibold text-muted uppercase">Order</span>
          <span className="ml-1 font-mono text-sm font-bold tracking-wide">{order.orderNumber}</span>
          <CopyButton value={order.orderNumber} label="Copy" buttonVariant="ghost" size="sm" className="!rounded-full" />
        </div>
      </div>

      <div className="border-t border-line bg-surface px-5 py-8 sm:px-10">
        <h2 className="mb-6 text-center text-sm font-bold tracking-[0.08em] text-muted uppercase">What happens next</h2>
        <ol className={cn('grid gap-6', steps.length === 3 ? 'md:grid-cols-3' : steps.length === 2 ? 'md:grid-cols-2' : '')}>
          {steps.map((step, index) => (
            <li key={index} className="relative grid content-start justify-items-start gap-3 md:justify-items-center md:text-center">
              {/* The line joining the steps on a wide screen. */}
              {index < steps.length - 1 && (
                <span aria-hidden className="absolute top-5 left-[calc(50%+1.75rem)] hidden h-0.5 w-[calc(100%-3.5rem+1.5rem)] bg-line-strong md:block" />
              )}
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full text-sm font-bold tnum',
                  index === 0 ? 'bg-brand text-brand-ink' : 'border-2 border-line-strong bg-raised text-ink',
                )}
              >
                {index + 1}
              </span>
              <p className="max-w-xs text-[0.9375rem] leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid justify-items-center gap-4 border-t border-line px-5 py-7 text-center sm:px-10">
        <div className="flex flex-wrap justify-center gap-3">
          <WhatsAppButton variant="dark" className="!rounded-full" text={`Hi, please send me updates on WhatsApp for order ${order.orderNumber}.`}>
            Send me updates on WhatsApp
          </WhatsAppButton>
          {token && <CopyButton value={orderUrl(order.orderNumber, token)} label="Copy link to this order" buttonVariant="outline" size="md" className="!rounded-full" />}
        </div>
        <p className="max-w-xl text-sm text-muted">
          Come back to this page with the link, or find the order any time on{' '}
          <Link to="/track" className="font-bold text-ink underline underline-offset-4">
            Track order
          </Link>{' '}
          with its number and your phone.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Delivery, tracking and the pack photo
// ---------------------------------------------------------------------------

function Delivery({ order }: { order: Order }) {
  const showEstimate = order.estimatedDelivery && !CLOSED.has(order.status);
  const { carrier, number, url } = order.tracking;
  const hasTracking = Boolean(carrier || number);
  if (!showEstimate && !hasTracking) return null;

  return (
    <section aria-labelledby="order-delivery-heading" className="grid gap-4 border-t border-ink pt-4">
      <h2 id="order-delivery-heading" className="sr-only">
        Delivery
      </h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {showEstimate && order.estimatedDelivery && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">Estimated delivery</dt>
            <dd className="type-h3 tnum">{formatDateRange(order.estimatedDelivery.earliest, order.estimatedDelivery.latest)}</dd>
          </div>
        )}
        {hasTracking && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">{carrier ? `Tracking with ${carrier}` : 'Tracking number'}</dt>
            <dd className="grid justify-items-start gap-2">
              {number ? <CodePill tag="Tracking" value={number} /> : <span className="type-body">Number to follow</span>}
            </dd>
          </div>
        )}
      </dl>
      {url && (
        <div>
          <Button variant="outline" href={url} target="_blank" rel="noopener noreferrer" iconRight={<ExternalLink aria-hidden />}>
            Track on {carrier || 'the courier'} site
          </Button>
        </div>
      )}
    </section>
  );
}

/** A studio or pickup order: the slot, the booking, where the studio is and the way there. */
function StudioVisit({ order }: { order: Order }) {
  const settings = useSettings().data;
  const closed = CLOSED.has(order.status);
  const mapUrl = settings?.studio.mapUrl.trim() ?? '';
  const isFitting = order.fulfilment === 'studio';

  return (
    <section aria-labelledby="order-studio-heading" className="grid gap-4">
      <h2 id="order-studio-heading" className="type-h3 flex items-center gap-2">
        {isFitting ? <Wrench aria-hidden className="size-5" /> : <Store aria-hidden className="size-5" />}
        {fulfilmentTitle(order)}
      </h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {isFitting && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">Your slot</dt>
            <dd className={cn('type-h3 tnum', closed && 'text-muted line-through decoration-1')}>
              {order.studioSlot ? slotWords(order.studioSlot) : 'To be agreed with you'}
            </dd>
          </div>
        )}
        {order.bookingNumber && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">Studio booking</dt>
            <dd className="grid justify-items-start">
              <CodePill tag="Booking" value={order.bookingNumber} />
            </dd>
          </div>
        )}
        {isFitting && order.vehicle && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">Car</dt>
            <dd className="type-body font-bold">{order.vehicle}</dd>
          </div>
        )}
        {order.fittingTotal > 0 && (
          <div className="grid gap-1">
            <dt className="type-label text-muted">Fitting charges</dt>
            <dd className="type-body font-bold tnum">{formatINR(order.fittingTotal)}, GST included</dd>
          </div>
        )}
      </dl>
      {!closed && settings && (
        <div className="grid gap-3">
          <StudioContact settings={settings} showAddress={false} />
          {settings.studio.address.trim() && (
            <p className="type-body flex items-start gap-3">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span className="whitespace-pre-line">{settings.studio.address.trim()}</span>
            </p>
          )}
          {mapUrl && (
            <div>
              <Button variant="outline" href={mapUrl} target="_blank" rel="noopener noreferrer" iconLeft={<MapPin aria-hidden />} iconRight={<ExternalLink aria-hidden />}>
                Get directions
              </Button>
            </div>
          )}
        </div>
      )}
      {isFitting && !closed && order.studioSlot && (
        <p className="type-small flex items-start gap-2 text-muted">
          <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Need another time? Write to us or ask on WhatsApp with the order number.</span>
        </p>
      )}
    </section>
  );
}

function PackPhoto({ order }: { order: Order }) {
  if (!order.packPhoto) return null;
  return (
    <section aria-labelledby="order-pack-heading" className="grid gap-3">
      <h2 id="order-pack-heading" className="type-h3">
        Your parcel, before we sealed it
      </h2>
      <figure className="grid max-w-lg gap-2">
        <a href={order.packPhoto} target="_blank" rel="noopener noreferrer" className="plane-frame relative block border border-line">
          <img
            src={imageVariant(order.packPhoto, 480)}
            width={480}
            height={360}
            loading="lazy"
            decoding="async"
            alt={`The items of order ${order.orderNumber}, laid out before the box was sealed`}
            className="aspect-4/3 w-full object-cover"
          />
          <StickerChip tone="ink" tilt className="absolute bottom-2 left-2">
            Photographed before sealing
          </StickerChip>
        </a>
        <figcaption className="type-small text-muted">Check it against what arrives. Open the photo full size to zoom in.</figcaption>
      </figure>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function Items({ order }: { order: Order }) {
  const delivered = order.status === 'delivered';
  return (
    <section aria-labelledby="order-items-heading" className="grid gap-3">
      <h2 id="order-items-heading" className="type-h3">
        In this order
      </h2>
      <ul className="grid border-t border-ink">
        {order.items.map((item) => {
          const linked = item.productId !== null && item.slug !== '';
          return (
            <li key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-line py-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-4">
              <ProductFrame image={item.image} alt={item.name} className="w-16 sm:w-20" />
              <div className="grid min-w-0 content-start gap-1">
                {linked ? (
                  <Link to={`/p/${item.slug}`} className="type-body font-bold hover:underline">
                    {item.name}
                  </Link>
                ) : (
                  <span className="type-body font-bold">{item.name}</span>
                )}
                {item.variantName && <span className="type-small">{item.variantName}</span>}
                <span className="type-small text-muted tnum">
                  {item.sku && <span className="type-code mr-2">{item.sku}</span>}
                  {item.qty} × {formatINR(item.price)}
                </span>
                <CustomSummary custom={item.custom} className="mt-1" />
                {isShowPlate(item.custom) && <span className="type-small text-muted">{SHOW_PLATE_NOTE}</span>}
                {item.fitAtStudio && (
                  <span className="type-small inline-flex items-start gap-1.5">
                    <Wrench aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span className="tnum">
                      Fitted at the studio{item.fittingServiceName ? `: ${item.fittingServiceName}` : ''}, {item.fittingCharge > 0 ? formatINR(item.fittingCharge) : 'no charge'}
                    </span>
                  </span>
                )}
                {delivered && linked && (
                  <Link to={`/p/${item.slug}#reports`} className="type-small mt-1 inline-flex items-center gap-1.5 justify-self-start font-bold underline underline-offset-4">
                    <Wrench aria-hidden className="size-4" />
                    Report how it fitted
                  </Link>
                )}
              </div>
              <span className="type-price col-start-2 tnum sm:col-start-auto sm:text-right">{formatINR(item.lineTotal)}</span>
            </li>
          );
        })}
      </ul>
      {order.vehicle && order.fulfilment !== 'studio' && <p className="type-small text-muted">Ordered for: {order.vehicle}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

function PaymentBlock({ order }: { order: Order }) {
  const words = describePayment(order);
  return (
    <section aria-labelledby="order-payment-heading" className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="order-payment-heading" className="type-h3">
          Payment
        </h2>
        <Badge tone={words.tone}>{words.short}</Badge>
      </div>
      {words.short !== methodLabel(order) && <p className="type-small text-muted">{methodLabel(order)}</p>}
      <p className="type-body">{words.detail}</p>
    </section>
  );
}

function Row({ label, value, strong = false, className }: { label: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <dt className={strong ? 'type-body font-bold' : 'type-small'}>{label}</dt>
      <dd className={cn('tnum text-right', strong ? 'type-price-xl' : 'type-small')}>{value}</dd>
    </div>
  );
}

function PriceBreakdown({ order }: { order: Order }) {
  const closed = order.status === 'cancelled' || order.status === 'returned';
  return (
    <section aria-labelledby="order-price-heading" className="grid gap-3">
      <h2 id="order-price-heading" className="type-h3">
        Price
      </h2>
      <dl className="grid gap-2">
        <Row label="Items" value={formatINR(order.subtotal)} />
        {order.discount > 0 && <Row label={order.couponCode ? <>Coupon <span className="type-code">{order.couponCode}</span></> : 'Discount'} value={`-${formatINR(order.discount)}`} />}
        {order.prepaidDiscount > 0 && <Row label="Paying online discount" value={`-${formatINR(order.prepaidDiscount)}`} />}
        {order.fittingTotal > 0 && <Row label="Studio fitting" value={formatINR(order.fittingTotal)} />}
        {atStudio(order) ? (
          <Row label={order.fulfilment === 'studio' ? 'Fitted at the studio' : 'Collect from the studio'} value="No delivery charge" />
        ) : (
          <Row label="Delivery" value={order.shippingFee > 0 ? formatINR(order.shippingFee) : 'Free'} />
        )}
        {order.codFee > 0 && <Row label="Cash on delivery fee" value={formatINR(order.codFee)} />}
        <Row label="Total" value={formatINR(order.total)} strong className="mt-1 border-t border-ink pt-3" />
        {order.tax.gst > 0 && <p className="type-small text-muted tnum">Includes GST of {formatINR(order.tax.gst, { paise: true })}</p>}
        {order.amountPaid > 0 && order.amountPaid < order.total && <Row label="Paid" value={formatINR(order.amountPaid)} className="border-t border-line pt-2" />}
        {order.amountDue > 0 && !closed && order.amountPaid > 0 && (
          <Row label={order.paymentMethod === 'cod' ? (atStudio(order) ? 'To pay at the studio' : 'To pay on delivery') : 'Still to pay'} value={formatINR(order.amountDue)} />
        )}
      </dl>
    </section>
  );
}

function Address({ order }: { order: Order }) {
  const a = order.shippingAddress;
  // Pickup and studio orders are usually placed without an address: show who the order is for instead.
  if (!a.line1.trim()) {
    return (
      <section aria-labelledby="order-address-heading" className="grid gap-2">
        <h2 id="order-address-heading" className="type-h3">
          Order for
        </h2>
        <p className="type-body">
          <span className="font-bold">{order.customerName}</span>
          <br />
          <span className="tnum">{formatPhone(order.phone)}</span>
        </p>
        {order.gstin && (
          <p className="type-small">
            GSTIN <span className="type-code">{order.gstin}</span>
          </p>
        )}
        {order.notes && <p className="type-small text-muted">Your note: {order.notes}</p>}
      </section>
    );
  }
  return (
    <section aria-labelledby="order-address-heading" className="grid gap-2">
      <h2 id="order-address-heading" className="type-h3">
        {atStudio(order) ? 'Billing address' : 'Delivering to'}
      </h2>
      <address className="type-body not-italic">
        <span className="font-bold">{a.name}</span>
        <br />
        {a.line1}
        {a.line2 && (
          <>
            <br />
            {a.line2}
          </>
        )}
        {a.landmark && (
          <>
            <br />
            Near {a.landmark}
          </>
        )}
        <br />
        {a.city}, {a.state} <span className="tnum">{a.pincode}</span>
        <br />
        <span className="tnum">{formatPhone(a.phone)}</span>
      </address>
      {order.gstin && (
        <p className="type-small">
          GSTIN <span className="type-code">{order.gstin}</span>
        </p>
      )}
      {order.notes && <p className="type-small text-muted">Your note: {order.notes}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// What can be done next
// ---------------------------------------------------------------------------

function Actions({ order, token, canAct, onOrderChange }: { order: Order; token: string | undefined; canAct: boolean; onOrderChange(order: Order): void }) {
  const help = `Hi, I need help with my order.\n\n${orderSummary(order)}`;
  return (
    <section aria-labelledby="order-actions-heading" className="grid gap-3 border-t border-ink pt-4">
      <h2 id="order-actions-heading" className="sr-only">
        Invoice and help
      </h2>
      <Button variant="outline" block to={invoicePath(order.orderNumber, token)} iconLeft={<FileText aria-hidden />}>
        Download invoice
      </Button>
      <div className="grid gap-2 pt-2">
        <p className="type-body font-bold">Need help with this order?</p>
        <p className="type-small text-muted">Quote the order number and we will pick it up from there.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button variant="outline" block to={`/contact?order=${encodeURIComponent(order.orderNumber)}`} iconLeft={<MessageSquareText aria-hidden />}>
            Write to us
          </Button>
          <WhatsAppButton block text={help}>
            Ask on WhatsApp
          </WhatsAppButton>
        </div>
      </div>
      {order.canCancel &&
        (canAct ? (
          <div className="pt-2">
            <CancelOrder order={order} token={token} onOrderChange={onOrderChange} />
          </div>
        ) : (
          <p className="type-small text-muted">
            To cancel, open the order from the link you got when you ordered, or ask us.
          </p>
        ))}
    </section>
  );
}
