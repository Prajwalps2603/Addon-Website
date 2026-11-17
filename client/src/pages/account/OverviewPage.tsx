import { Link } from 'react-router';
import { ArrowRight, CalendarClock, Car, ChevronRight, Wrench } from 'lucide-react';
import { BoardWord, PitBoard } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, Skeleton } from '@/components/ui';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { useMe } from '@/hooks/useMe';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, formatNumber } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useUi } from '@/stores/ui';
import { useWishlist } from '@/stores/wishlist';
import type { Order } from '@/types/api';
import { OrderThumbs } from './parts/OrderBits';
import { fulfilmentWords, orderHref, PAYMENT_TONE_CLASS, paymentWords, slotWords, statusLabel, upcomingFittings } from './parts/orders';
import { useAccountOrders } from './parts/useAccountOrders';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** The latest order on the pit board: its status is the one live reading this page has. */
function LatestOrder({ order }: { order: Order }) {
  const payment = paymentWords(order);
  const fulfilment = fulfilmentWords(order);
  const awaitingPayment = order.status === 'pending_payment';
  return (
    <PitBoard
      as="section"
      aria-labelledby="latest-order"
      title={<span id="latest-order">Latest order</span>}
      aside={<span className="type-code">{order.orderNumber}</span>}
      className="gap-5 p-4 sm:p-6"
    >
      <BoardWord text={statusLabel(order.status)} tone="brand" size="md" />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">Placed</dt>
          <dd className="type-body">{formatDate(order.createdAt)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">Total</dt>
          <dd className="type-price tnum">{formatINR(order.total)}</dd>
        </div>
        <div className="col-span-2 grid gap-0.5 sm:col-span-1">
          <dt className="type-label text-muted">Payment</dt>
          <dd className={cn('type-body', payment.tone === 'muted' ? undefined : PAYMENT_TONE_CLASS[payment.tone])}>{payment.text}</dd>
        </div>
        {fulfilment && (
          <div className="col-span-2 grid gap-0.5 sm:col-span-3">
            <dt className="type-label text-muted">{order.fulfilment === 'studio' ? 'Studio fitting' : 'Collection'}</dt>
            <dd className="type-body">{order.fulfilment === 'studio' && order.studioSlot ? slotWords(order.studioSlot) : fulfilment}</dd>
          </div>
        )}
        {order.fulfilment === 'delivery' && order.estimatedDelivery && !['delivered', 'cancelled', 'returned'].includes(order.status) && (
          <div className="col-span-2 grid gap-0.5 sm:col-span-3">
            <dt className="type-label text-muted">Expected</dt>
            <dd className="type-body">
              {formatDate(order.estimatedDelivery.earliest)}
              {order.estimatedDelivery.latest !== order.estimatedDelivery.earliest && ` to ${formatDate(order.estimatedDelivery.latest)}`}
            </dd>
          </div>
        )}
      </dl>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <OrderThumbs items={order.items} max={4} />
        <Button to={orderHref(order)} variant={awaitingPayment ? 'primary' : 'outline'} iconRight={<ArrowRight />}>
          {awaitingPayment ? 'Finish payment' : 'Open order'}
        </Button>
      </div>
    </PitBoard>
  );
}

function NoOrders() {
  return (
    <section aria-labelledby="latest-order" className="grid gap-3 border border-line p-4 sm:p-6">
      <h2 id="latest-order" className="type-h3">
        No orders yet
      </h2>
      <p className="type-body max-w-prose text-muted">Your first order shows up here with its status, so you never need to hunt for the email.</p>
      <Button to="/shop" className="justify-self-start">
        Shop parts
      </Button>
    </section>
  );
}

/** The active car and how many parts fit it, counted by the catalogue for that car. */
function ActiveCar() {
  const car = useActiveCar();
  const openPicker = useUi((state) => state.openVehiclePicker);
  const { data, isPending, isError } = useProducts({ limit: 1 }, { enabled: car !== null });

  if (!car) {
    return (
      <section aria-labelledby="your-car" className="grid content-start gap-3 border-t border-line pt-5">
        <h2 id="your-car" className="type-h3">
          Your car
        </h2>
        <p className="type-body text-muted">Add your car and every part shows whether it fits.</p>
        <Button variant="dark" iconLeft={<Car />} onClick={openPicker} className="justify-self-start">
          Add your car
        </Button>
      </section>
    );
  }

  const name = car.nickname || car.vehicle.model;
  const fits = data?.facets.fitsCount ?? null;
  return (
    <section aria-labelledby="your-car" className="grid content-start gap-3 border-t border-line pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="your-car" className="type-h3">
          Your car
        </h2>
        <Link to="/garage" className="link type-small">
          Change
        </Link>
      </div>
      <p className="type-body">
        <span className="font-bold">{name}</span>
        <span className="text-muted">
          {' '}
          {car.year ? `${car.year}, ` : ''}
          {car.vehicle.label}
        </span>
      </p>
      <div className="type-body" aria-live="polite">
        {isPending ? (
          <Skeleton className="inline-block h-5 w-40 align-middle" />
        ) : isError || fits === null ? (
          'Could not count the parts right now.'
        ) : (
          <>
            <span className="type-stat tnum">{formatNumber(fits)}</span> {fits === 1 ? 'part fits' : 'parts fit'} it
          </>
        )}
      </div>
      <Button to="/shop?fitOnly=1" variant="dark" iconRight={<ArrowRight />} className="justify-self-start">
        Shop for my {car.vehicle.model}
      </Button>
    </section>
  );
}

/**
 * Upcoming fittings at the studio. The account API lists orders, and a studio order carries its booked slot,
 * so this shows the signed-in shopper's studio orders still to come. A fitting service booked on its own is
 * not tied to the account (it is found by booking number and phone), so the way to book one is always offered.
 */
function StudioFittings({ orders, loading }: { orders: readonly Order[] | undefined; loading: boolean }) {
  const { data: settings } = useSettings();
  const upcoming = orders ? upcomingFittings(orders) : [];
  const studioOpen = settings?.studio.enabled ?? false;
  if (!loading && upcoming.length === 0 && !studioOpen) return null;

  return (
    <section aria-labelledby="studio-fittings" className="grid content-start gap-3 border-t border-line pt-5">
      <h2 id="studio-fittings" className="type-h3">
        Studio fittings
      </h2>
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : upcoming.length > 0 ? (
        <ul className="grid border-t border-line">
          {upcoming.slice(0, 3).map((order) => (
            <li key={order.orderNumber} className="border-b border-line">
              <Link to={orderHref(order)} className="group focus-ring-inset grid gap-0.5 py-3 hover:bg-surface">
                <span className="type-body inline-flex items-start gap-2 font-bold">
                  <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {order.studioSlot ? slotWords(order.studioSlot) : 'Slot to be confirmed'}
                </span>
                <span className="type-small text-muted">
                  <span className="type-code">{order.orderNumber}</span>
                  {order.bookingNumber && ` · Booking ${order.bookingNumber}`}
                  {order.fittingTotal > 0 && ` · Fitting ${formatINR(order.fittingTotal)}`}
                </span>
                {order.status === 'pending_payment' && <span className="type-small text-warn">Finish payment to keep this slot.</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-body text-muted">No fitting booked. Bring the car in and our team fits the parts in a booked slot.</p>
      )}
      {studioOpen && (
        <Button to="/book-fitting" variant="outline" iconLeft={<Wrench />} className="justify-self-start">
          Book a fitting slot
        </Button>
      )}
    </section>
  );
}

function Count({ to, label, value }: { to: string; label: string; value: number | null }) {
  return (
    <Link to={to} className="group focus-ring grid gap-1 py-4 pr-4 transition-colors dur-quick hover:bg-surface">
      {value === null ? <Skeleton className="h-8 w-10" /> : <span className="type-stat tnum">{formatNumber(value)}</span>}
      <span className="type-small inline-flex items-center gap-1 font-bold">
        {label}
        <ChevronRight aria-hidden className="size-4 transition-transform dur-quick group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

const QUICK_LINKS: readonly { to: string; label: string; detail: string }[] = [
  { to: '/account/addresses', label: 'Addresses', detail: 'Add, edit, pick the default' },
  { to: '/account/profile', label: 'Profile and password', detail: 'Name, mobile, password' },
  { to: '/garage', label: 'My garage', detail: 'Every car you have saved' },
  { to: '/track', label: 'Track an order', detail: 'For orders placed as a guest' },
];

export default function OverviewPage() {
  useDocumentMeta({ title: 'My account', noindex: true });
  const { user } = useMe();
  const savedCount = useWishlist((state) => state.ids.length);
  const { data: orders, isPending, error, refetch } = useAccountOrders();
  const latest = orders?.[0] ?? null;
  const first = user ? firstName(user.name) : '';

  return (
    <div className="grid gap-10">
      <PageHeader
        title={first ? `Hello, ${first}` : 'My account'}
        description={user ? `Signed in as ${user.email}` : undefined}
        className="pb-0 md:pb-0"
      />

      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-12">
        <div className="grid content-start gap-6">
          {isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} title="Could not load your latest order" size="sm" />
          ) : latest ? (
            <LatestOrder order={latest} />
          ) : (
            <NoOrders />
          )}
          <div className="grid grid-cols-2 divide-x divide-line border-y border-line [&>*:last-child]:pl-4">
            <Count to="/account/orders" label="Orders" value={isPending || error ? null : (orders?.length ?? 0)} />
            <Count to="/wishlist" label={savedCount === 1 ? 'Saved part' : 'Saved parts'} value={savedCount} />
          </div>
        </div>

        <div className="grid content-start gap-8">
          <ActiveCar />
          <StudioFittings orders={error ? [] : orders} loading={isPending} />
        </div>
      </div>

      <nav aria-labelledby="quick-links" className="grid gap-3">
        <h2 id="quick-links" className="type-h3">
          Quick links
        </h2>
        <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
          {QUICK_LINKS.map((link) => (
            <li key={link.to} className="border-b border-line">
              <Link to={link.to} className="group focus-ring-inset flex min-h-14 items-center justify-between gap-4 py-3 hover:bg-surface">
                <span className="grid gap-0.5">
                  <span className="type-body font-bold">{link.label}</span>
                  <span className="type-small text-muted">{link.detail}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted transition-transform dur-quick group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
