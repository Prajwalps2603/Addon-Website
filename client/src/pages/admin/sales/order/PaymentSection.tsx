import { zodResolver } from '@hookform/resolvers/zod';
import { Banknote, CircleCheck, RotateCcw, XCircle } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button, Callout, CopyButton, Field, Input, Modal } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import type { Order, PaymentStatus } from '@/types/api';
import { ConfirmModal } from '../ConfirmModal';
import { PAYMENT_METHOD_LABELS, PaymentStatusBadge } from '../status';
import { atStudio } from './NextStep';

/** 'Cash on delivery' reads as 'Pay at the studio' when the customer comes to the studio. */
function methodLabel(order: Order): string {
  return order.paymentMethod === 'cod' && atStudio(order) ? 'Pay at the studio' : PAYMENT_METHOD_LABELS[order.paymentMethod];
}
import { useOrderUpdate } from './useOrderUpdate';

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'type-price tnum' : 'tnum'}>{value}</dd>
    </div>
  );
}

/** What the order has been paid, what is due, and the buttons to record money in or out. */
export function PaymentSection({ order }: { order: Order }) {
  const [dialog, setDialog] = useState<null | 'record' | 'not_received' | 'refund'>(null);
  const update = useOrderUpdate(order.orderNumber, () => setDialog(null));
  const closed = order.status === 'cancelled' || order.status === 'returned';
  const upiToVerify = Boolean(order.upiReference) && order.paymentStatus === 'pending' && !closed;
  const expected = order.advanceAmount > 0 && order.advanceAmount < order.total ? order.advanceAmount : order.total;
  const canRecord = order.amountDue > 0 && !closed && !upiToVerify && order.paymentStatus !== 'refunded';
  const canRefund = closed && order.amountPaid > 0 && order.paymentStatus !== 'refunded';

  const verify = () => {
    const status: PaymentStatus = expected < order.total ? 'advance_paid' : 'paid';
    update.mutate({
      body: { paymentStatus: status, amountPaid: expected, note: `UPI payment verified, UTR ${order.upiReference}.` },
      success: 'Payment verified',
      description: `${formatINR(expected)} against UTR ${order.upiReference}`,
    });
  };

  return (
    <section aria-labelledby="payment-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="payment-title" className="type-h3">
          Payment
        </h2>
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>
      <p className="type-small text-muted">{methodLabel(order)}</p>
      <dl className="type-body border-t border-line">
        <Row label="Order total" value={formatINR(order.total)} />
        {order.advanceAmount > 0 && <Row label="Advance asked online" value={formatINR(order.advanceAmount)} />}
        <Row label="Received" value={formatINR(order.amountPaid)} />
        <div className="border-t border-ink">
          <Row label={order.paymentMethod === 'cod' && !closed ? (atStudio(order) ? 'To pay at the studio' : 'To collect on delivery') : 'Still due'} value={order.amountDue > 0 ? formatINR(order.amountDue) : 'Nil'} strong />
        </div>
      </dl>

      {order.upiReference && (
        <div className="grid gap-1.5">
          <p className="type-label text-muted">UTR the customer gave</p>
          <CopyButton variant="code" value={order.upiReference} label="Copy UTR" />
        </div>
      )}

      {upiToVerify && (
        <Callout
          tone="warn"
          title="Check your bank app for this UTR"
          actions={
            <>
              <Button variant="dark" size="sm" iconLeft={<CircleCheck aria-hidden />} loading={update.isPending && dialog === null} onClick={verify}>
                Payment verified
              </Button>
              <Button variant="outline" size="sm" iconLeft={<XCircle aria-hidden />} onClick={() => setDialog('not_received')}>
                Not received
              </Button>
            </>
          }
        >
          Look for {formatINR(expected)} with this reference before you pack.
        </Callout>
      )}

      {(canRecord || canRefund) && (
        <div className="flex flex-wrap gap-2">
          {canRecord && (
            <Button variant="outline" iconLeft={<Banknote aria-hidden />} onClick={() => setDialog('record')}>
              {order.paymentMethod === 'cod' ? (atStudio(order) ? 'Paid at the studio' : 'COD cash received') : 'Record a payment'}
            </Button>
          )}
          {canRefund && (
            <Button variant="outline" iconLeft={<RotateCcw aria-hidden />} onClick={() => setDialog('refund')}>
              Mark refunded
            </Button>
          )}
        </div>
      )}

      <RecordPaymentModal order={order} open={dialog === 'record'} onClose={() => setDialog(null)} />

      <ConfirmModal
        open={dialog === 'not_received'}
        onClose={() => setDialog(null)}
        title="Payment not received?"
        description={`UTR ${order.upiReference}`}
        confirmLabel="Mark not received"
        reason={{ label: 'What you found', placeholder: 'No credit with this UTR in the bank statement' }}
        loading={update.isPending}
        onConfirm={(reason) =>
          update.mutate({
            body: { paymentStatus: 'failed', note: reason || `No payment found for UTR ${order.upiReference}.` },
            success: 'Payment marked not received',
            description: 'Message the customer before cancelling the order.',
          })
        }
      >
        <p>The payment shows as failed. The order stays open so you can ask the customer to pay again.</p>
      </ConfirmModal>

      <ConfirmModal
        open={dialog === 'refund'}
        onClose={() => setDialog(null)}
        title={`Mark ${formatINR(order.amountPaid)} refunded?`}
        description="Do this after the money has left your account."
        confirmLabel="Mark refunded"
        tone="dark"
        reason={{ label: 'Refund reference', placeholder: 'Bank or Razorpay refund reference' }}
        loading={update.isPending}
        onConfirm={(reason) =>
          update.mutate({
            body: { paymentStatus: 'refunded', note: reason ? `Refunded: ${reason}` : 'Refunded.' },
            success: 'Marked refunded',
          })
        }
      />
    </section>
  );
}

function RecordPaymentModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const formId = useId();
  const [formError, setFormError] = useState('');
  const schema = z.object({
    amount: z.coerce
      .number({ error: 'Enter the amount in rupees' })
      .int({ error: 'Whole rupees only' })
      .min(1, { error: 'Enter the amount in rupees' })
      .max(order.amountDue, { error: `No more than the ${formatINR(order.amountDue)} still due` }),
    note: z.string().trim().max(200),
  });
  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({ amount: order.amountDue, note: '' });
      setFormError('');
    }
  }, [open, order.amountDue, reset]);

  const update = useOrderUpdate(order.orderNumber, onClose);
  const cod = order.paymentMethod === 'cod';
  const studio = atStudio(order);

  const submit = handleSubmit((values) => {
    const paid = order.amountPaid + values.amount;
    const status: PaymentStatus = paid >= order.total ? 'paid' : 'advance_paid';
    update.mutate(
      {
        body: {
          paymentStatus: status,
          amountPaid: paid,
          note: values.note || `${cod ? (studio ? 'Paid at the studio' : 'COD cash received') : 'Payment received'}: ${formatINR(values.amount)}.`,
        },
        success: `${formatINR(values.amount)} recorded`,
        description: paid >= order.total ? 'The order is paid in full.' : `${formatINR(order.total - paid)} still due.`,
      },
      { onError: (error) => setFormError(applyApiError(error, setError, { amountPaid: 'amount' })) },
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cod ? (studio ? 'Paid at the studio' : 'COD cash received') : 'Record a payment'}
      description={`${order.orderNumber}. ${formatINR(order.amountDue)} due.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Go back
          </Button>
          <Button type="submit" form={formId} variant="dark" loading={update.isPending}>
            Record {cod ? 'cash' : 'payment'}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-4">
        {formError && (
          <Callout tone="danger" live>
            {formError}
          </Callout>
        )}
        <Field label="Amount received" error={errors.amount?.message} required>
          <Input inputMode="numeric" leading="₹" className="tnum" {...register('amount')} />
        </Field>
        <Field label="Note" optional hint={cod ? (studio ? 'e.g. Cash, or UPI to the shop phone' : 'e.g. Delhivery remittance of 18 Nov') : 'e.g. bank transfer reference'} error={errors.note?.message}>
          <Input autoComplete="off" {...register('note')} />
        </Field>
      </form>
    </Modal>
  );
}
