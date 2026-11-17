import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, Loader2, TriangleAlert, Wallet } from 'lucide-react';
import { Button, Modal, toast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import type { Order } from '@/types/api';

const schema = z.object({
  reason: z.string().trim().max(300, { error: 'Keep it under 300 characters' }),
});
type CancelInput = z.input<typeof schema>;
type CancelOutput = z.output<typeof schema>;

/** One-tap reasons. Tapping one fills the reason; the shopper can still write their own. */
const QUICK_REASONS = ['Ordered by mistake', 'Found it cheaper', 'Changed my mind', 'Wrong part for my car', 'Delivery or slot too late'];

export interface CancelOrderProps {
  order: Order;
  token: string | undefined;
  onOrderChange(order: Order): void;
}

/** "Cancel order" with a confirmation step and an optional reason. Shown only while the order can be cancelled. */
export function CancelOrder({ order, token, onOrderChange }: CancelOrderProps) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<CancelInput, unknown, CancelOutput>({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const reason = useWatch({ control, name: 'reason' }) ?? '';

  const cancel = useMutation({
    mutationFn: (values: CancelOutput) => api.orders.cancel(order.orderNumber, { token, reason: values.reason || undefined }),
  });

  const close = () => {
    if (cancel.isPending) return;
    setOpen(false);
    setFormError(null);
    reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await cancel.mutateAsync(values);
      setOpen(false);
      reset();
      onOrderChange(updated);
      toast.success('Order cancelled', {
        description: order.fulfilment === 'studio' ? `Order ${order.orderNumber} is cancelled and its studio slot is released.` : `Order ${order.orderNumber} will not be sent.`,
      });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const refundLine =
    order.amountPaid > 0 ? `You paid ${formatINR(order.amountPaid)}. We refund it to the account it came from.` : 'Nothing has been charged, so there is nothing to refund.';
  const whatHappens =
    order.fulfilment === 'studio'
      ? 'We release your studio slot and put the parts back on the shelf.'
      : order.fulfilment === 'pickup'
        ? 'We put the parts back on the shelf.'
        : 'We stop packing it and put the items back on the shelf.';

  return (
    <>
      <Button variant="ghost" block onClick={() => setOpen(true)}>
        Cancel this order
      </Button>
      <Modal
        open={open}
        onClose={close}
        dismissible={!cancel.isPending}
        title={`Cancel order ${order.orderNumber}?`}
        titleHidden
        className="overflow-hidden !rounded-[22px]"
      >
        <form id="cancel-order-form" noValidate onSubmit={onSubmit} className="grid gap-5">
          <div className="grid justify-items-center gap-3 pt-2 text-center">
            <span aria-hidden className="grid size-14 place-items-center rounded-full bg-stop-soft text-stop ring-8 ring-stop-soft/40">
              <TriangleAlert className="size-7" />
            </span>
            <p className="text-xl font-bold">Cancel this order?</p>
            <p className="max-w-sm text-sm text-muted">
              <span className="font-mono font-semibold text-ink">{order.orderNumber}</span>. {whatHappens} This cannot be undone.
            </p>
          </div>

          <p className="flex items-start gap-3 rounded-[14px] bg-surface px-4 py-3 text-sm">
            <Wallet aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>{refundLine}</span>
          </p>

          <div className="grid gap-2.5">
            <p className="text-sm font-semibold">
              Why are you cancelling? <span className="font-normal text-muted">Optional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((quick) => {
                const on = reason.trim() === quick;
                return (
                  <button
                    key={quick}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setValue('reason', on ? '' : quick, { shouldDirty: true })}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150',
                      on ? 'border-ink bg-ink text-page' : 'border-line bg-raised hover:border-line-strong',
                    )}
                  >
                    {quick}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={3}
              maxLength={300}
              placeholder="Or tell us in your own words"
              aria-label="Why are you cancelling"
              aria-invalid={errors.reason ? true : undefined}
              className="min-h-20 w-full resize-y rounded-[14px] border border-transparent bg-surface px-4 py-3 text-[0.9375rem] outline-none transition-colors placeholder:text-muted focus:bg-surface-2"
              {...register('reason')}
            />
            {errors.reason?.message && <p className="text-sm text-stop">{errors.reason.message}</p>}
          </div>

          {formError && (
            <p role="alert" className="flex items-start gap-2 text-sm font-medium text-stop">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={close}
              disabled={cancel.isPending}
              className="h-12 rounded-full bg-ink font-bold text-page transition-colors hover:bg-ink-2 disabled:opacity-50"
            >
              Keep the order
            </button>
            <button
              type="submit"
              disabled={cancel.isPending}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-2 border-stop font-bold text-stop transition-colors hover:bg-stop hover:text-stop-ink disabled:opacity-60"
            >
              {cancel.isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              {cancel.isPending ? 'Cancelling' : 'Yes, cancel order'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
