import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarCheck, Camera, ExternalLink, Mail, MapPin, Pencil, Store, Truck, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import * as z from 'zod';
import { CustomSummary, ProductFrame } from '@/components/commerce';
import { longDate, slotLabel } from '@/components/studio';
import { Badge, Button, CopyButton, Field, Input } from '@/components/ui';
import { capitalize, formatDateRange, formatDateTime, formatINR, formatNumber } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { formatPhone } from '@/lib/india';
import type { Order, OrderEvent } from '@/types/api';
import { CallButton, CustomerWhatsApp } from '../contact';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../status';
import { useOrderUpdate } from './useOrderUpdate';

export function SectionTitle({ id, children, action }: { id: string; children: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink pb-2">
      <h2 id={id} className="type-h3">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function OrderItems({ order }: { order: Order }) {
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <section aria-labelledby="items-title">
      <SectionTitle id="items-title" action={<span className="type-small text-muted tnum">{formatNumber(units)} {units === 1 ? 'unit' : 'units'}</span>}>
        Items
      </SectionTitle>
      <ul className="divide-y divide-line">
        {order.items.map((item) => (
          <li key={item.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
            <ProductFrame image={item.image} alt={item.name} className="border border-line" />
            <div className="grid min-w-0 content-start gap-0.5">
              {item.slug ? (
                <Link to={`/p/${item.slug}`} target="_blank" className="link focus-ring font-bold">
                  {item.name}
                </Link>
              ) : (
                <span className="font-bold">{item.name}</span>
              )}
              {item.variantName && <span className="type-small">{item.variantName}</span>}
              {item.sku && <span className="type-code text-muted">{item.sku}</span>}
              {item.custom && <CustomSummary custom={item.custom} className="mt-2" />}
              {item.fitAtStudio && (
                <p className="type-small mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone="ink" variant="outline" size="sm" icon={<Wrench aria-hidden />}>
                    Fit at studio
                  </Badge>
                  <span>
                    {item.fittingServiceName || 'Fitting'}
                    {item.fittingCharge > 0 ? <span className="tnum">, {formatINR(item.fittingCharge)}</span> : ', no fitting charge'}
                  </span>
                </p>
              )}
            </div>
            <div className="col-start-2 flex items-baseline justify-between gap-3 sm:col-start-3 sm:grid sm:justify-items-end sm:gap-0.5">
              <span className="type-small text-muted tnum">
                {formatNumber(item.qty)} &times; {formatINR(item.price)}
              </span>
              <span className="type-price tnum">{formatINR(item.lineTotal)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoneyRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className={muted ? 'text-muted' : undefined}>{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  const tax = order.tax;
  return (
    <section aria-labelledby="totals-title" className="grid gap-2">
      <SectionTitle id="totals-title">Totals</SectionTitle>
      <dl>
        <MoneyRow label="Items" value={formatINR(order.subtotal)} />
        {order.discount > 0 && <MoneyRow label={order.couponCode ? `Coupon ${order.couponCode}` : 'Discount'} value={`-${formatINR(order.discount)}`} />}
        {order.prepaidDiscount > 0 && <MoneyRow label="Prepaid discount" value={`-${formatINR(order.prepaidDiscount)}`} />}
        {order.fittingTotal > 0 && <MoneyRow label="Studio fitting" value={formatINR(order.fittingTotal)} />}
        <MoneyRow
          label="Delivery"
          value={order.fulfilment === 'delivery' ? (order.shippingFee > 0 ? formatINR(order.shippingFee) : 'Free') : 'None, at the studio'}
        />
        {order.codFee > 0 && <MoneyRow label="COD fee" value={formatINR(order.codFee)} />}
        <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-ink pt-2">
          <dt className="font-bold">Total</dt>
          <dd className="type-price-xl tnum">{formatINR(order.total)}</dd>
        </div>
      </dl>
      <dl className="type-small border-t border-line pt-2">
        <MoneyRow muted label="Taxable value" value={formatINR(tax.taxableValue, { paise: true })} />
        {tax.isInterState ? (
          <MoneyRow muted label="IGST" value={formatINR(tax.igst, { paise: true })} />
        ) : (
          <>
            <MoneyRow muted label="CGST" value={formatINR(tax.cgst, { paise: true })} />
            <MoneyRow muted label="SGST" value={formatINR(tax.sgst, { paise: true })} />
          </>
        )}
        <p className="pt-1 text-muted">
          {tax.isInterState
            ? 'Delivery to another state: IGST applies.'
            : order.fulfilment === 'delivery'
              ? 'Delivery within the store’s state: CGST and SGST.'
              : 'Sold at the studio: CGST and SGST.'}
          {order.fittingTotal > 0 ? ' Fitting is a service taxed at 18%.' : ''}
        </p>
      </dl>
    </section>
  );
}

export function CustomerPanel({ order, message }: { order: Order; message: string }) {
  const address = order.shippingAddress;
  return (
    <section aria-labelledby="customer-title" className="grid gap-3">
      <SectionTitle id="customer-title">Customer</SectionTitle>
      <div className="grid gap-0.5">
        <p className="font-bold">{order.customerName}</p>
        <p className="tnum">{formatPhone(order.phone)}</p>
        {order.email && (
          <a href={`mailto:${order.email}`} className="link focus-ring inline-flex items-center gap-1 break-all">
            <Mail aria-hidden className="size-4 shrink-0" />
            {order.email}
          </a>
        )}
        {order.gstin && (
          <p className="type-small mt-1">
            GSTIN <span className="type-code">{order.gstin}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <CallButton phone={order.phone} />
        <CustomerWhatsApp phone={order.phone} text={message} />
        <Button variant="ghost" size="sm" to={`/admin/orders?q=${encodeURIComponent(order.phone)}`}>
          Their orders
        </Button>
      </div>

      {(order.fulfilment === 'delivery' || address.line1) && (
      <div className="grid gap-1 border-t border-line pt-3">
        <h3 className="type-label text-muted">{order.fulfilment === 'delivery' ? 'Deliver to' : 'Billing address'}</h3>
        <address className="not-italic leading-snug">
          {address.name}
          <br />
          {address.line1}
          {address.line2 && (
            <>
              <br />
              {address.line2}
            </>
          )}
          {address.landmark && (
            <>
              <br />
              Near {address.landmark}
            </>
          )}
          <br />
          {address.city}, {address.state} <span className="tnum">{address.pincode}</span>
          {address.phone && address.phone !== order.phone && (
            <>
              <br />
              <span className="tnum">Phone {formatPhone(address.phone)}</span>
            </>
          )}
        </address>
        {order.estimatedDelivery && (
          <p className="type-small text-muted">Promised {formatDateRange(order.estimatedDelivery.earliest, order.estimatedDelivery.latest)}</p>
        )}
      </div>
      )}

      {order.vehicle && (
        <div className="grid gap-1 border-t border-line pt-3">
          <h3 className="type-label text-muted">Car</h3>
          <p>{order.vehicle}</p>
        </div>
      )}

      {order.notes && (
        <div className="grid gap-1 border-t border-line pt-3">
          <h3 className="type-label text-muted">Customer note</h3>
          <p className="whitespace-pre-line">{order.notes}</p>
        </div>
      )}
    </section>
  );
}

const FULFILMENT_WORDS: Record<Order['fulfilment'], { label: string; icon: ReactNode }> = {
  delivery: { label: 'Courier delivery', icon: <Truck aria-hidden /> },
  pickup: { label: 'Collect at the studio', icon: <Store aria-hidden /> },
  studio: { label: 'Fitted at the studio', icon: <Wrench aria-hidden /> },
};

/** How the order reaches the customer. For studio orders: the booked slot, the booking and what gets fitted. */
export function FulfilmentSection({ order }: { order: Order }) {
  const words = FULFILMENT_WORDS[order.fulfilment] ?? FULFILMENT_WORDS.delivery;
  const fitted = order.items.filter((item) => item.fitAtStudio);
  if (order.fulfilment === 'delivery') {
    return (
      <section aria-labelledby="fulfilment-title" className="grid gap-2">
        <SectionTitle id="fulfilment-title">How it reaches them</SectionTitle>
        <p className="flex items-center gap-2 [&_svg]:size-5">
          {words.icon}
          {words.label}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="fulfilment-title" className="grid gap-3">
      <SectionTitle id="fulfilment-title">At the studio</SectionTitle>
      <p className="flex items-center gap-2 font-bold [&_svg]:size-5">
        {words.icon}
        {words.label}
      </p>
      {order.studioSlot ? (
        <div className="grid gap-0.5">
          <p className="flex items-center gap-2 text-lg font-extrabold tnum">
            <CalendarCheck aria-hidden className="size-5 shrink-0" />
            {slotLabel(order.studioSlot.slot)}
          </p>
          <p>{longDate(order.studioSlot.date)}</p>
        </div>
      ) : (
        order.fulfilment === 'studio' && <p className="text-muted">No slot on the order.</p>
      )}
      {fitted.length > 0 && (
        <ul className="type-small grid gap-1 border-t border-line pt-2">
          {fitted.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                {item.fittingServiceName || 'Fitting'}: {item.name}
                {item.qty > 1 ? <span className="tnum"> &times; {formatNumber(item.qty)}</span> : null}
              </span>
              <span className="shrink-0 tnum">{item.fittingCharge > 0 ? formatINR(item.fittingCharge) : 'Included'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {order.bookingNumber && (
          <Button variant="outline" size="sm" iconLeft={<CalendarCheck aria-hidden />} to={`/admin/bookings?booking=${encodeURIComponent(order.bookingNumber)}${order.studioSlot ? `&day=${order.studioSlot.date}` : ''}`}>
            Booking {order.bookingNumber}
          </Button>
        )}
        {order.fulfilment === 'pickup' && (
          <p className="type-small flex items-center gap-1.5 text-muted">
            <MapPin aria-hidden className="size-4 shrink-0" />
            The customer collects from the studio. No courier.
          </p>
        )}
      </div>
    </section>
  );
}

export function ShippingSection({ order, onEdit }: { order: Order; onEdit: () => void }) {
  const tracking = order.tracking;
  const has = Boolean(tracking.carrier || tracking.number);
  return (
    <section aria-labelledby="shipping-title" className="grid gap-3">
      <SectionTitle
        id="shipping-title"
        action={
          <Button variant="ghost" size="sm" iconLeft={<Pencil aria-hidden />} onClick={onEdit}>
            {has ? 'Edit tracking' : 'Add tracking'}
          </Button>
        }
      >
        Shipping
      </SectionTitle>
      {has ? (
        <dl className="grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="type-label text-muted">Courier</dt>
            <dd className="mt-1">{tracking.carrier || 'Not given'}</dd>
          </div>
          <div>
            <dt className="type-label text-muted">Tracking number</dt>
            <dd className="mt-1">{tracking.number ? <CopyButton variant="code" value={tracking.number} label="Copy tracking number" /> : 'Not given'}</dd>
          </div>
          <div>
            <dt className="type-label text-muted">Tracking link</dt>
            <dd className="mt-1">
              {tracking.url ? (
                <a href={tracking.url} target="_blank" rel="noopener noreferrer" className="link focus-ring inline-flex items-center gap-1">
                  Open courier page
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              ) : (
                'Not given'
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted">No tracking yet.</p>
      )}
    </section>
  );
}

export function PackPhotoSection({ order, onReplace }: { order: Order; onReplace: () => void }) {
  if (!order.packPhoto) return null;
  return (
    <section aria-labelledby="pack-title" className="grid gap-3">
      <SectionTitle
        id="pack-title"
        action={
          <Button variant="ghost" size="sm" iconLeft={<Camera aria-hidden />} onClick={onReplace}>
            Replace photo
          </Button>
        }
      >
        Pack photo
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-start">
        <a href={order.packPhoto} target="_blank" rel="noopener noreferrer" className="focus-ring block">
          <ProductFrame image={order.packPhoto} alt={`Packed items for order ${order.orderNumber}`} className="border border-line" />
        </a>
        <p className="type-small max-w-prose text-muted">The customer sees this photo on their order page.</p>
      </div>
    </section>
  );
}

function eventTitle(event: OrderEvent): string {
  if (event.status in ORDER_STATUS_LABELS) return ORDER_STATUS_LABELS[event.status as keyof typeof ORDER_STATUS_LABELS];
  if (event.status in PAYMENT_STATUS_LABELS) return PAYMENT_STATUS_LABELS[event.status as keyof typeof PAYMENT_STATUS_LABELS];
  return capitalize(event.status.replace(/_/g, ' ')) || 'Note';
}

const ACTOR: Record<OrderEvent['actor'], string> = { system: 'Store system', customer: 'Customer', admin: 'You' };

export function EventLog({ order }: { order: Order }) {
  const events = [...order.events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section aria-labelledby="log-title" className="grid gap-3">
      <SectionTitle id="log-title">Order log</SectionTitle>
      <NoteForm orderNumber={order.orderNumber} />
      {events.length === 0 ? (
        <p className="text-muted">Nothing logged yet.</p>
      ) : (
        <ol className="grid">
          {events.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3">
              <span aria-hidden className="relative flex justify-center">
                <span className={index === 0 ? 'mt-1.5 size-2.5 bg-ink' : 'mt-1.5 size-2.5 border border-line-strong bg-page'} />
                {index < events.length - 1 && <span className="absolute top-5 bottom-0 w-px bg-line" />}
              </span>
              <div className="grid gap-0.5 pb-4">
                <p className="font-bold">{eventTitle(event)}</p>
                {event.note && <p className="whitespace-pre-line">{event.note}</p>}
                <p className="type-small text-muted tnum">
                  {formatDateTime(event.createdAt)} · {ACTOR[event.actor]}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const noteSchema = z.object({ note: z.string().trim().min(2, { error: 'Write the note first' }).max(500, { error: 'Keep it under 500 characters' }) });
type NoteValues = z.infer<typeof noteSchema>;

function NoteForm({ orderNumber }: { orderNumber: string }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { note: '' } });
  const update = useOrderUpdate(orderNumber, () => reset({ note: '' }));
  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) =>
        update.mutate({ body: { note: values.note }, success: 'Note added' }, { onError: (error) => void applyApiError(error, setError) }),
      )}
      className="flex items-start gap-2"
    >
      <Field label="Add a note to the log" labelHidden error={errors.note?.message} className="min-w-0 flex-1">
        <Input placeholder="Add a note to the log" autoComplete="off" {...register('note')} />
      </Field>
      <Button type="submit" variant="outline" loading={update.isPending}>
        Add
      </Button>
    </form>
  );
}
