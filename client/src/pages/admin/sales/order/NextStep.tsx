import { CircleCheck, PackageCheck, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { PitBoard } from '@/components/brand';
import { Button } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { Order, OrderStatus } from '@/types/api';
import { ORDER_STATUS_LABELS } from '../status';

export type NextAction =
  | { kind: 'verify'; label: string; hint: string }
  | { kind: 'status'; status: OrderStatus; label: string; hint: string }
  | { kind: 'bench'; label: string; hint: string }
  | { kind: 'ship'; label: string; hint: string }
  | { kind: 'deliver'; label: string; hint: string }
  | { kind: 'wait'; hint: string }
  | { kind: 'done'; hint: string };

export function needsUpiCheck(order: Order): boolean {
  return Boolean(order.upiReference) && order.paymentStatus === 'pending' && order.status !== 'cancelled' && order.status !== 'returned';
}

/** True when the customer comes to the studio for the order (to collect it, or to have it fitted). */
export function atStudio(order: Pick<Order, 'fulfilment'>): boolean {
  return order.fulfilment === 'pickup' || order.fulfilment === 'studio';
}

/** '18 Nov at 11:30 am' for a studio order's slot, '' when there is none. */
function slotWords(order: Order): string {
  if (!order.studioSlot) return '';
  const [y, m, d] = order.studioSlot.date.split('-').map(Number);
  const day = new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)));
  const [h, min] = order.studioSlot.slot.split(':').map(Number);
  const hour = (h ?? 0) % 12 === 0 ? 12 : (h ?? 0) % 12;
  return `${day} at ${hour}:${String(min ?? 0).padStart(2, '0')} ${(h ?? 0) >= 12 ? 'pm' : 'am'}`;
}

/** The next step for an order the customer collects or has fitted at the studio: no courier. */
function studioAction(order: Order): NextAction | null {
  const fitting = order.fulfilment === 'studio';
  const when = slotWords(order);
  switch (order.status) {
    case 'placed':
      return {
        kind: 'status',
        status: 'confirmed',
        label: 'Confirm order',
        hint: fitting
          ? `Check the parts are in stock for the slot${when ? ` on ${when}` : ''}, then confirm with the customer.`
          : 'Check the parts are in stock, then tell the customer when to collect.',
      };
    case 'confirmed':
      return { kind: 'bench', label: 'Parts ready', hint: fitting ? 'Opens the pack bench: tick each part as you set it aside for the fitting.' : 'Opens the pack bench: tick each part and photograph them for the customer.' };
    case 'packed':
    case 'shipped':
    case 'out_for_delivery':
      return {
        kind: 'deliver',
        label: fitting ? 'Fitted and handed over' : 'Handed over',
        hint:
          order.amountDue > 0
            ? `${formatINR(order.amountDue)} to collect at the studio.`
            : fitting
              ? `When the work is done and the car goes back${when ? ` (slot ${when})` : ''}.`
              : 'When the customer collects the parts.',
      };
    case 'delivered':
      return { kind: 'done', hint: fitting ? 'Fitted and handed over. Ask for a fitted report.' : 'Collected. Ask for a fitted report once the part is on the car.' };
    default:
      return null;
  }
}

/** The one thing to do next with this order. */
export function nextAction(order: Order): NextAction {
  if (atStudio(order) && !needsUpiCheck(order)) {
    const studio = studioAction(order);
    if (studio) return studio;
  }
  if ((order.status === 'pending_payment' || order.status === 'placed') && needsUpiCheck(order)) {
    return { kind: 'verify', label: 'Payment verified', hint: `Find ${formatINR(order.advanceAmount > 0 ? order.advanceAmount : order.total)} with UTR ${order.upiReference} in your bank app first.` };
  }
  switch (order.status) {
    case 'pending_payment':
      return { kind: 'wait', hint: 'Waiting for the customer to finish paying online. Nothing to pack yet.' };
    case 'placed':
      return {
        kind: 'status',
        status: 'confirmed',
        label: 'Confirm order',
        hint: order.paymentMethod === 'cod' ? 'Cash on delivery: confirm with the customer on WhatsApp or a call first.' : 'Check stock and the address, then confirm.',
      };
    case 'confirmed':
      return { kind: 'bench', label: 'Mark packed', hint: 'Opens the pack bench: tick each part and photograph the box.' };
    case 'packed':
      return { kind: 'ship', label: 'Mark shipped', hint: 'Add the courier and tracking number.' };
    case 'shipped':
      return { kind: 'status', status: 'out_for_delivery', label: 'Out for delivery', hint: 'When the courier shows it out for delivery.' };
    case 'out_for_delivery':
      return {
        kind: 'deliver',
        label: 'Mark delivered',
        hint: order.amountDue > 0 ? `${formatINR(order.amountDue)} cash to collect on delivery.` : 'When the courier confirms delivery.',
      };
    case 'delivered':
      return { kind: 'done', hint: 'Delivered. Ask for a fitted report once the part is on the car.' };
    case 'cancelled':
      return { kind: 'done', hint: 'Cancelled. Stock went back on the shelf.' };
    case 'returned':
      return { kind: 'done', hint: 'Returned. Stock went back on the shelf.' };
  }
}

const ICONS: Partial<Record<NextAction['kind'], ReactNode>> = {
  verify: <CircleCheck aria-hidden />,
  bench: <PackageCheck aria-hidden />,
  ship: <Truck aria-hidden />,
  deliver: <CircleCheck aria-hidden />,
};

export interface NextStepProps {
  order: Order;
  action: NextAction;
  loading: boolean;
  onAct: () => void;
  /** The WhatsApp control for the current step, when there is one. */
  message?: ReactNode;
}

/** The board at the top of the order: where it stands and the one big button for what comes next. */
export function NextStep({ order, action, loading, onAct, message }: NextStepProps) {
  const actionable = action.kind !== 'wait' && action.kind !== 'done';
  return (
    <PitBoard as="section" aria-label="Next step" title="Next step" aside={<span className="font-bold">Now: {ORDER_STATUS_LABELS[order.status]}</span>}>
      <div className="grid gap-3 md:flex md:items-center md:justify-between md:gap-6">
        <p className="type-body max-w-prose">{action.hint}</p>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center md:shrink-0 md:justify-end">
          {actionable && (
            <Button size="lg" block className="sm:order-last sm:w-auto" iconLeft={ICONS[action.kind]} loading={loading} onClick={onAct}>
              {action.label}
            </Button>
          )}
          {message}
        </div>
      </div>
    </PitBoard>
  );
}
