import { useId } from 'react';
import { PitBoard } from '@/components/brand';
import { Callout } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { Order, PaymentInstruction } from '@/types/api';
import { RazorpayPayment } from './RazorpayPayment';
import { UpiPayment } from './UpiPayment';

export interface PaymentPanelProps {
  order: Order;
  instruction: PaymentInstruction;
  onPaid(order: Order): void;
  /** Open the Razorpay window straight away (right after the order is placed). Off by default. */
  autoOpen?: boolean;
  /** Called when the shopper closes the Razorpay window without paying. Without it the panel shows its retry state. */
  onDismiss?: () => void;
}

/**
 * Takes the payment for an order: the Razorpay window, or a direct UPI payment with its UTR.
 * Says plainly whether this is the full amount or the advance on a cash-on-delivery order.
 */
export default function PaymentPanel({ order, instruction, onPaid, autoOpen = false, onDismiss }: PaymentPanelProps) {
  const headingId = useId();

  if (!instruction) {
    return (
      <Callout tone="info" title="Nothing to pay online">
        {order.amountDue > 0
          ? order.fulfilment === 'delivery'
            ? `Pay ${formatINR(order.amountDue)} to the courier when the parcel arrives.`
            : `Pay ${formatINR(order.amountDue)} at the studio.`
          : 'This order is already paid.'}
      </Callout>
    );
  }

  const amount = instruction.provider === 'razorpay' ? Math.round(instruction.amountPaise / 100) : instruction.amount;
  const isAdvance = instruction.purpose === 'advance';
  const balance = Math.max(0, order.total - order.amountPaid - amount);

  return (
    <section aria-labelledby={headingId} className="grid gap-6">
      <PitBoard title={isAdvance ? 'Advance for cash on delivery' : 'Full payment'} aside={<span className="type-code">{order.orderNumber}</span>}>
        <h2 id={headingId} className="sr-only">
          {isAdvance ? 'Pay the advance for cash on delivery' : 'Pay for your order'}
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p className="grid gap-1">
            <span className="type-small text-muted">To pay now</span>
            <span className="type-price-xl tnum">{formatINR(amount)}</span>
          </p>
          {isAdvance && balance > 0 && (
            <p className="type-small text-muted tnum">
              Then {formatINR(balance)} {order.fulfilment === 'delivery' ? 'to the courier on delivery' : 'at the studio'}
            </p>
          )}
          {!isAdvance && (
            <p className="type-small text-muted tnum">
              Order total {formatINR(order.total)}
              {order.fittingTotal > 0 ? `, studio fitting included` : ''}
            </p>
          )}
        </div>
      </PitBoard>

      {instruction.provider === 'razorpay' ? (
        <RazorpayPayment order={order} instruction={instruction} onPaid={onPaid} autoOpen={autoOpen} onDismiss={onDismiss} />
      ) : (
        <UpiPayment order={order} instruction={instruction} onPaid={onPaid} />
      )}
    </section>
  );
}
