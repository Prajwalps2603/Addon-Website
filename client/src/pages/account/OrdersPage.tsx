import { Link } from 'react-router';
import { ChevronRight, Store, Wrench } from 'lucide-react';
import { EmptyState, ErrorState, PageHeader } from '@/components/commerce';
import { Badge, Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, pluralize } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import type { Order } from '@/types/api';
import { OrderThumbs } from './parts/OrderBits';
import { fulfilmentWords, orderHref, PAYMENT_TONE_CLASS, paymentWords, statusLabel, statusTone } from './parts/orders';
import { useAccountOrders } from './parts/useAccountOrders';

const ROW = 'grid gap-3 py-4 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto_minmax(6rem,auto)_1.25rem] md:items-center md:gap-6';

function OrderRow({ order }: { order: Order }) {
  const payment = paymentWords(order);
  const fulfilment = fulfilmentWords(order);
  const units = order.items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <li className="border-b border-line">
      <Link to={orderHref(order)} className={cn(ROW, 'group focus-ring-inset -mx-2 px-2 transition-colors dur-quick hover:bg-surface')}>
        <div className="flex items-baseline justify-between gap-3 md:grid md:gap-1">
          <span className="type-code">{order.orderNumber}</span>
          <span className="type-small text-muted">{formatDate(order.createdAt)}</span>
        </div>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
            <span className={cn('type-small', PAYMENT_TONE_CLASS[payment.tone])}>{payment.text}</span>
          </div>
          {fulfilment && (
            <span className="type-small inline-flex items-start gap-1.5 text-muted">
              {order.fulfilment === 'studio' ? <Wrench aria-hidden className="mt-0.5 size-4 shrink-0" /> : <Store aria-hidden className="mt-0.5 size-4 shrink-0" />}
              {fulfilment}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4 md:contents">
          <OrderThumbs items={order.items} max={3} />
          <div className="grid justify-items-end gap-0.5 text-right">
            <span className="type-price tnum">{formatINR(order.total)}</span>
            <span className="type-small text-muted tnum">{pluralize(units, 'item')}</span>
          </div>
        </div>
        <ChevronRight aria-hidden className="hidden size-5 text-muted transition-transform dur-quick group-hover:translate-x-0.5 md:block" />
        <span className="sr-only">Open order {order.orderNumber}</span>
      </Link>
    </li>
  );
}

function OrdersSkeleton() {
  return (
    <ul aria-hidden className="border-t border-ink">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className={cn(ROW, 'border-b border-line')}>
          <div className="flex justify-between gap-3 md:grid md:gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center justify-between gap-4 md:contents">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((thumb) => (
                <Skeleton key={thumb} className="size-12 sm:size-14" />
              ))}
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <span className="hidden md:block" />
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  useDocumentMeta({ title: 'My orders', noindex: true });
  const { data: orders, isPending, error, refetch } = useAccountOrders();

  return (
    <section>
      <PageHeader title="My orders" meta={orders && orders.length > 0 ? pluralize(orders.length, 'order') : undefined} />
      {isPending ? (
        <OrdersSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load your orders" />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Orders you place while signed in show up here, with their status and invoice. Ordered as a guest? Find it with the order number and your phone."
          actions={
            <>
              <Button to="/shop">Shop parts</Button>
              <Button to="/track" variant="outline">
                Track a guest order
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div aria-hidden className="type-label hidden border-b border-ink pb-2 text-muted md:grid md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto_minmax(6rem,auto)_1.25rem] md:gap-6">
            <span>Order</span>
            <span>Status</span>
            <span>Items</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="border-t border-ink md:border-t-0">
            {orders.map((order) => (
              <OrderRow key={order.orderNumber} order={order} />
            ))}
          </ul>
          <p className="type-small mt-6 text-muted">
            Ordered without signing in?{' '}
            <Link to="/track" className="link">
              Track a guest order
            </Link>
            .
          </p>
        </>
      )}
    </section>
  );
}
