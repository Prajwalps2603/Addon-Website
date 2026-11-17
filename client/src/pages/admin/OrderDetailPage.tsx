import { useQuery } from '@tanstack/react-query';
import { Ban, FileText, Printer, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { WhatsAppIcon } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, Callout, Checkbox, Skeleton, SkeletonText, Stepper } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { ORDER_PROGRESS } from '@/lib/labels';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminOrderUpdate, Order, OrderStatus } from '@/types/api';
import { ConfirmModal } from './sales/ConfirmModal';
import { useCustomerWaLink } from './sales/contact';
import { orderMessage } from './sales/messages';
import { MessageDrawer } from './sales/order/MessageDrawer';
import { NextStep, atStudio, nextAction } from './sales/order/NextStep';
import { PackBench } from './sales/order/PackBench';
import { PackingSlip } from './sales/order/PackingSlip';
import { CustomerPanel, EventLog, FulfilmentSection, OrderItems, OrderTotals, PackPhotoSection, ShippingSection } from './sales/order/parts';
import { PaymentSection } from './sales/order/PaymentSection';
import { ShippingDrawer } from './sales/order/ShippingDrawer';
import { useOrderUpdate } from './sales/order/useOrderUpdate';
import { ORDER_STATUS_LABELS, OrderStatusBadge, PaymentStatusBadge } from './sales/status';
import { waLink } from '@/lib/whatsapp';

type Panel = null | 'bench' | 'ship' | 'tracking' | 'message' | 'deliver' | 'cancel' | 'return';

const CANCELLABLE: readonly OrderStatus[] = ['pending_payment', 'placed', 'confirmed', 'packed'];
const RETURNABLE: readonly OrderStatus[] = ['shipped', 'out_for_delivery', 'delivered'];
const STEPS = ORDER_PROGRESS.map((status) => ({ label: ORDER_STATUS_LABELS[status] }));
/** Orders that come to the studio skip the courier steps. */
const STUDIO_PROGRESS: readonly OrderStatus[] = ['placed', 'confirmed', 'packed', 'delivered'];

function progressFor(order: Order): { steps: { label: string }[]; current: number } {
  if (!atStudio(order)) {
    const index = ORDER_PROGRESS.indexOf(order.status);
    return { steps: STEPS, current: order.status === 'delivered' ? STEPS.length : Math.max(0, index) };
  }
  const fitting = order.fulfilment === 'studio';
  const steps = STUDIO_PROGRESS.map((status) => ({
    label: status === 'packed' ? 'Parts ready' : status === 'delivered' ? (fitting ? 'Fitted' : 'Collected') : ORDER_STATUS_LABELS[status],
  }));
  // A studio order may sit at shipped or out for delivery if it was moved there by hand: treat it as ready.
  const at = order.status === 'shipped' || order.status === 'out_for_delivery' ? 'packed' : order.status;
  const index = STUDIO_PROGRESS.indexOf(at);
  return { steps, current: order.status === 'delivered' ? steps.length : Math.max(0, index) };
}

export default function OrderDetailPage() {
  const { orderNumber = '' } = useParams();
  useDocumentMeta({ title: orderNumber ? `Order ${orderNumber}` : 'Order', noindex: true });

  const order = useQuery({
    queryKey: queryKeys.admin.orders.detail(orderNumber),
    queryFn: ({ signal }) => api.admin.orders.get(orderNumber, { signal }),
    enabled: orderNumber !== '',
  });

  if (order.isPending) return <OrderSkeleton />;
  if (order.error) {
    return (
      <div className="container-page py-10">
        <ErrorState
          error={order.error}
          onRetry={() => void order.refetch()}
          title={order.error.isNotFound ? `No order ${orderNumber}` : 'Could not load this order'}
          notFoundAction={
            <Button variant="outline" to="/admin/orders">
              Back to orders
            </Button>
          }
        />
      </div>
    );
  }
  return <OrderView order={order.data} />;
}

function OrderView({ order }: { order: Order }) {
  const settings = useSettings().data;
  const storeName = settings?.storeName ?? '';
  const [panel, setPanel] = useState<Panel>(null);
  const [printing, setPrinting] = useState(false);
  const [cashCollected, setCashCollected] = useState(true);
  const close = useCallback(() => setPanel(null), []);
  const donePrinting = useCallback(() => setPrinting(false), []);

  const update = useOrderUpdate(order.orderNumber, close);
  const action = nextAction(order);
  const message = orderMessage(order, { storeName, dispatchDays: settings?.shipping.dispatchDays, studio: settings?.studio });
  const waOn = useCustomerWaLink(order.phone, message) !== '';

  const setStatus = (status: OrderStatus, extra: AdminOrderUpdate = {}) =>
    update.mutate({
      body: { status, ...extra },
      success: `Order ${order.orderNumber}: ${ORDER_STATUS_LABELS[status].toLowerCase()}`,
      description: 'The customer has been emailed.',
    });

  const act = () => {
    switch (action.kind) {
      case 'verify': {
        const expected = order.advanceAmount > 0 && order.advanceAmount < order.total ? order.advanceAmount : order.total;
        update.mutate({
          body: {
            paymentStatus: expected < order.total ? 'advance_paid' : 'paid',
            amountPaid: expected,
            note: `UPI payment verified, UTR ${order.upiReference}.`,
          },
          success: 'Payment verified',
          description: `${formatINR(expected)} against UTR ${order.upiReference}`,
        });
        return;
      }
      case 'status':
        setStatus(action.status);
        return;
      case 'bench':
        setPanel('bench');
        return;
      case 'ship':
        setPanel('ship');
        return;
      case 'deliver':
        if (order.amountDue > 0) {
          setCashCollected(true);
          setPanel('deliver');
        } else setStatus('delivered');
        return;
      default:
        return;
    }
  };

  const progress = progressFor(order);
  const studio = atStudio(order);
  const closed = order.status === 'cancelled' || order.status === 'returned';
  const canCancel = CANCELLABLE.includes(order.status);
  const canReturn = RETURNABLE.includes(order.status);

  const whatsappButton = waOn ? (
    <Button variant="outline" size="lg" block className="sm:w-auto" iconLeft={<WhatsAppIcon />} onClick={() => setPanel('message')}>
      WhatsApp customer
    </Button>
  ) : undefined;

  return (
    <div className="container-page pb-16 print:hidden">
      <PageHeader
        variant="plain"
        title={order.orderNumber}
        breadcrumbs={[{ label: 'Orders', to: '/admin/orders' }, { label: order.orderNumber }]}
        meta={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <span>Placed {formatDateTime(order.createdAt)}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft={<FileText aria-hidden />} href={`/order/${encodeURIComponent(order.orderNumber)}/invoice`} target="_blank" rel="noopener">
              Invoice
            </Button>
            <Button variant="ghost" size="sm" iconLeft={<Printer aria-hidden />} onClick={() => setPrinting(true)}>
              Packing slip
            </Button>
          </>
        }
      />

      <NextStep order={order} action={action} loading={update.isPending && panel === null} onAct={act} message={whatsappButton} />

      {closed ? (
        <Callout tone="info" className="mt-4" title={`This order was ${order.status === 'cancelled' ? 'cancelled' : 'returned'}`}>
          {order.amountPaid > 0 && order.paymentStatus !== 'refunded'
            ? `${formatINR(order.amountPaid)} was received. Mark it refunded once the money has gone back.`
            : 'Nothing more to do here.'}
        </Callout>
      ) : (
        order.status !== 'pending_payment' && <Stepper steps={progress.steps} current={progress.current} label="Order progress" className="mt-6" />
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
        <div className="grid content-start gap-10">
          <OrderItems order={order} />
          <PackPhotoSection order={order} onReplace={() => setPanel('bench')} />
          {!studio && (order.status === 'packed' || RETURNABLE.includes(order.status) || order.tracking.number) && (
            <ShippingSection order={order} onEdit={() => setPanel('tracking')} />
          )}
          <EventLog order={order} />
        </div>

        <aside className="grid content-start gap-10" aria-label="Order details">
          <FulfilmentSection order={order} />
          <PaymentSection order={order} />
          <CustomerPanel order={order} message={message} />
          <OrderTotals order={order} />
          {(canCancel || canReturn) && (
            <section aria-labelledby="problems-title" className="grid gap-3">
              <h2 id="problems-title" className="type-h3 border-b border-ink pb-2">
                If something went wrong
              </h2>
              <div className="flex flex-wrap gap-2">
                {canCancel && (
                  <Button variant="outline" iconLeft={<Ban aria-hidden />} onClick={() => setPanel('cancel')}>
                    Cancel order
                  </Button>
                )}
                {canReturn && (
                  <Button variant="outline" iconLeft={<RotateCcw aria-hidden />} onClick={() => setPanel('return')}>
                    Mark returned
                  </Button>
                )}
              </div>
              <p className="type-small text-muted">Stock goes back on the shelf either way. The customer is emailed.</p>
            </section>
          )}
        </aside>
      </div>

      <PackBench order={order} open={panel === 'bench'} onClose={close} />
      <ShippingDrawer order={order} open={panel === 'ship' || panel === 'tracking'} mode={panel === 'ship' ? 'ship' : 'edit'} onClose={close} />
      <MessageDrawer
        open={panel === 'message'}
        onClose={close}
        name={order.customerName}
        phone={order.phone}
        draft={message}
        linkFor={(text) => (waOn ? waLink(order.phone, text) : '')}
        context={`Written for where the order is now: ${ORDER_STATUS_LABELS[order.status]}. Edit anything before sending.`}
      />

      <ConfirmModal
        open={panel === 'deliver'}
        onClose={close}
        title={studio ? (order.fulfilment === 'studio' ? 'Fitted and handed over?' : 'Collected by the customer?') : 'Mark delivered?'}
        description={studio ? `${formatINR(order.amountDue)} was to be paid at the studio.` : `${formatINR(order.amountDue)} was due on delivery.`}
        confirmLabel={studio ? 'Mark handed over' : 'Mark delivered'}
        tone="primary"
        loading={update.isPending}
        onConfirm={() =>
          setStatus(
            'delivered',
            cashCollected
              ? {
                  paymentStatus: 'paid',
                  amountPaid: order.total,
                  note: studio ? `Handed over at the studio. ${formatINR(order.amountDue)} paid there.` : `Delivered. Courier collected ${formatINR(order.amountDue)} cash.`,
                }
              : {},
          )
        }
      >
        <Checkbox
          checked={cashCollected}
          onChange={(event) => setCashCollected(event.target.checked)}
          label={studio ? `The customer paid ${formatINR(order.amountDue)} at the studio` : `The courier collected ${formatINR(order.amountDue)} in cash`}
          description="Untick if the cash has not been confirmed yet. You can record it later under Payment."
        />
      </ConfirmModal>

      <ConfirmModal
        open={panel === 'cancel'}
        onClose={close}
        title={`Cancel ${order.orderNumber}?`}
        description={
          order.bookingNumber
            ? `The parts go back in stock, studio booking ${order.bookingNumber} is cancelled and the customer is emailed.`
            : 'The parts go back in stock and the customer is emailed.'
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        reason={{ label: 'Reason', required: true, placeholder: 'Customer asked to cancel on the phone', hint: 'Goes in the order log and the email.' }}
        loading={update.isPending}
        onConfirm={(reason) => setStatus('cancelled', { note: reason })}
      >
        {order.amountPaid > 0 && (
          <p>
            {formatINR(order.amountPaid)} was paid. Refund it, then mark it refunded under Payment.
          </p>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={panel === 'return'}
        onClose={close}
        title={`Mark ${order.orderNumber} returned?`}
        description="Do this when the parts are back with you. Stock is restored."
        confirmLabel="Mark returned"
        cancelLabel="Go back"
        reason={{ label: 'Reason', required: true, placeholder: 'Did not fit: wrong generation', hint: 'Goes in the order log.' }}
        loading={update.isPending}
        onConfirm={(reason) => setStatus('returned', { note: reason })}
      />

      {printing && <PackingSlip order={order} storeName={storeName} onDone={donePrinting} />}
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="container-page pb-16" aria-busy="true">
      <span className="sr-only" role="status">
        Loading the order
      </span>
      <div className="grid gap-3 pt-6 pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="grid grid-cols-[4rem_1fr] gap-3">
              <Skeleton className="aspect-square w-full" />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
        <div className="grid content-start gap-4">
          <SkeletonText lines={5} />
          <SkeletonText lines={6} />
        </div>
      </div>
    </div>
  );
}
