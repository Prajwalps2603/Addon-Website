import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { QrCode, Smartphone } from 'lucide-react';
import { Roundel } from '@/components/brand';
import { Button, Callout, CopyButton, Field, Input } from '@/components/ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import { api } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { qrPath } from '@/lib/qr';
import type { Order, PaymentInstruction } from '@/types/api';

export type UpiInstruction = Extract<PaymentInstruction, { provider: 'upi' }>;

const utrSchema = z.object({
  upiReference: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => /^\d{12}$/.test(value), { error: 'The UTR is a 12-digit number. Check the payment details in your UPI app.' }),
});
type UtrInput = z.input<typeof utrSchema>;
type UtrOutput = z.output<typeof utrSchema>;

function UpiQr({ uri, amount, payee }: { uri: string; amount: number; payee: string }) {
  const { size, path } = useMemo(() => qrPath(uri), [uri]);
  return (
    <div className="plane-frame print-exact inline-block border border-line p-2">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`UPI QR code to pay ${formatINR(amount)} to ${payee}`}
        className="block size-52 text-frame-ink sm:size-60"
      >
        <path d={path} fill="currentColor" />
      </svg>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
      <Roundel size="sm" tone="ink" className="mt-0.5">
        {n}
      </Roundel>
      <h3 className="type-h3">{title}</h3>
      <div className="col-start-2 grid gap-4">{children}</div>
    </li>
  );
}

export interface UpiPaymentProps {
  order: Order;
  instruction: UpiInstruction;
  onPaid(order: Order): void;
}

/** Direct UPI to the shop: QR on a computer, the UPI app on a phone, then the UTR so the shop can match the payment. */
export function UpiPayment({ order, instruction, onPaid }: UpiPaymentProps) {
  const isMobile = useIsMobile();
  const [showQr, setShowQr] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UtrInput, unknown, UtrOutput>({ resolver: zodResolver(utrSchema), defaultValues: { upiReference: '' } });

  const submit = handleSubmit(async ({ upiReference }) => {
    setFormError(null);
    try {
      const updated = await api.payments.upiConfirm({
        orderNumber: order.orderNumber,
        accessToken: order.accessToken ?? '',
        upiReference,
      });
      onPaid(updated);
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const qrVisible = !isMobile || showQr;

  return (
    <ol className="grid gap-8">
      <Step n={1} title={`Pay ${formatINR(instruction.amount)} by UPI`}>
        {isMobile && (
          <div className="grid gap-2">
            <Button href={instruction.upiUri} size="lg" block iconLeft={<Smartphone aria-hidden />}>
              Open UPI app
            </Button>
            <p className="type-small text-muted">Opens Google Pay, PhonePe, Paytm or your bank&apos;s app with the amount filled in.</p>
          </div>
        )}
        {qrVisible ? (
          <div className="grid gap-2">
            <UpiQr uri={instruction.upiUri} amount={instruction.amount} payee={instruction.payeeName} />
            <p className="type-small text-muted">{isMobile ? 'Scan it from another phone.' : 'Scan with any UPI app on your phone.'}</p>
          </div>
        ) : (
          <Button variant="link" size="sm" className="justify-self-start" iconLeft={<QrCode aria-hidden />} onClick={() => setShowQr(true)}>
            Paying from another phone? Show the QR code
          </Button>
        )}
        <dl className="grid gap-3 border-t border-line pt-4">
          <div className="grid gap-1">
            <dt className="type-label text-muted">Pay to</dt>
            <dd className="font-bold">{instruction.payeeName}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="type-label text-muted">UPI ID</dt>
            <dd>
              <CopyButton variant="code" value={instruction.upiId} label="Copy" copiedLabel="Copied" />
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="type-label text-muted">Amount</dt>
            <dd className="flex flex-wrap items-center gap-3">
              <span className="type-price tnum">{formatINR(instruction.amount)}</span>
              <CopyButton value={String(instruction.amount)} label="Copy amount" variant="button" buttonVariant="ghost" />
            </dd>
          </div>
        </dl>
      </Step>

      <Step n={2} title="Tell us the UTR">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field
            label="12-digit UTR"
            hint="In your UPI app, open this payment. It is shown as UTR, UPI Ref No. or Transaction ID."
            error={errors.upiReference?.message}
            required
          >
            <Input inputMode="numeric" autoComplete="off" maxLength={14} mono {...register('upiReference')} />
          </Field>
          {formError && !errors.upiReference && (
            <Callout tone="danger" live>
              {formError}
            </Callout>
          )}
          <Button type="submit" size="lg" block loading={isSubmitting}>
            I have paid
          </Button>
        </form>
        <p className="type-small max-w-prose text-muted">
          UPI payments go straight to the shop&apos;s account, so nothing confirms them automatically. We match your UTR
          against our bank statement and confirm the payment then. Until we do, your order shows the payment as pending.
        </p>
      </Step>
    </ol>
  );
}
