import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import PaymentPanel from '@/components/payment/PaymentPanel';
import { Button, Callout, toast } from '@/components/ui';
import { WhatsAppButton } from '@/components/commerce';
import { useSettings } from '@/hooks/useSettings';
import { api, errorMessage } from '@/lib/api';
import { formatINR } from '@/lib/format';
import type { Order, PaymentInstruction } from '@/types/api';

export interface FinishPaymentProps {
  order: Order;
  token: string | undefined;
  onOrderChange(order: Order): void;
}

/** The amount still to pay online for a pending_payment order. */
export function amountToPayNow(order: Order): number {
  if (order.paymentMethod === 'cod') return Math.max(0, order.advanceAmount - order.amountPaid);
  return order.amountDue;
}

/** A UPI deep link, as the checkout makes it: payee, name, amount and the order number as the note. */
function upiInstruction(order: Order, upiId: string, payeeName: string): PaymentInstruction {
  const amount = amountToPayNow(order);
  const note = `Order ${order.orderNumber}`;
  const query = [
    `pa=${encodeURIComponent(upiId)}`,
    payeeName ? `pn=${encodeURIComponent(payeeName)}` : '',
    `am=${amount.toFixed(2)}`,
    'cu=INR',
    `tn=${encodeURIComponent(note)}`,
    `tr=${encodeURIComponent(order.orderNumber)}`,
  ]
    .filter(Boolean)
    .join('&');
  return {
    provider: 'upi',
    purpose: order.paymentMethod === 'cod' ? 'advance' : 'full',
    upiUri: `upi://pay?${query}`,
    upiId,
    payeeName,
    amount,
  };
}

/**
 * For an order that still waits for its online payment: says what is owed and why, then brings back
 * the payment step. Razorpay gets a fresh instruction from the retry endpoint (it reuses the same
 * Razorpay order); direct UPI is rebuilt from the order and the store's UPI id.
 */
export function FinishPayment({ order, token, onOrderChange }: FinishPaymentProps) {
  const settings = useSettings().data;
  const [instruction, setInstruction] = useState<{ value: PaymentInstruction } | null>(null);
  const toPay = amountToPayNow(order);
  const isUpi = order.paymentMethod === 'upi';
  const upiId = settings?.payments.upiId ?? '';

  const retry = useMutation({
    mutationFn: () => api.payments.razorpayRetry({ orderNumber: order.orderNumber, token }),
    onSuccess: (value) => setInstruction({ value }),
  });

  const start = () => {
    if (isUpi) {
      if (!upiId) return;
      setInstruction({ value: upiInstruction(order, upiId, settings?.payments.upiPayeeName || settings?.legalName || settings?.storeName || '') });
      return;
    }
    retry.mutate();
  };

  const paid = (updated: Order) => {
    setInstruction(null);
    onOrderChange(updated);
    toast.success(updated.paymentMethod === 'upi' ? 'Thanks. We will check the payment and confirm.' : 'Payment received');
  };

  const what =
    order.paymentMethod === 'cod'
      ? `This cash on delivery order needs an advance of ${formatINR(toPay)} online before we pack it. The rest is paid to the courier.`
      : order.fulfilment === 'studio'
        ? `${formatINR(toPay)} is still to pay. Your parts and your studio slot are held; the fitting is confirmed once the payment goes through.`
        : `${formatINR(toPay)} is still to pay. Your items are held for this order; we pack it once the payment goes through.`;

  const cannotUpi = isUpi && settings !== undefined && !upiId;

  return (
    <section aria-labelledby="finish-payment-heading" className="grid gap-4">
      <Callout
        tone="warn"
        title={<span id="finish-payment-heading">Payment not finished</span>}
        actions={
          instruction ? null : cannotUpi ? (
            <WhatsAppButton size="sm" text={`Hi, I could not finish paying for order ${order.orderNumber}.`}>
              Ask us on WhatsApp
            </WhatsAppButton>
          ) : (
            <Button iconLeft={<CreditCard aria-hidden />} loading={retry.isPending} onClick={start}>
              Pay {formatINR(toPay)}
            </Button>
          )
        }
      >
        <p>{what}</p>
        {cannotUpi && <p className="mt-1">UPI payments are switched off right now. Message us and we will sort it out.</p>}
      </Callout>

      {retry.isError && (
        <Callout tone="danger" live title="Could not start the payment">
          {errorMessage(retry.error)} Try again in a minute.
        </Callout>
      )}

      {instruction && instruction.value && <PaymentPanel order={order} instruction={instruction.value} onPaid={paid} />}
      {instruction && !instruction.value && (
        <Callout tone="good" live title="Nothing left to pay">
          This order needs no online payment now. Reload the page to see its latest status.
        </Callout>
      )}
    </section>
  );
}
