import { Info } from 'lucide-react';
import { PayMarks } from '@/components/cart/WaysToPay';
import { Badge, Callout, RadioGroup, Skeleton, type RadioOption } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { Fulfilment, PaymentMethod, PaymentOption } from '@/types/api';

function Split({ option, fulfilment }: { option: PaymentOption; fulfilment: Fulfilment }) {
  const where = fulfilment === 'delivery' ? 'to the courier' : 'at the studio';
  if (option.dueOnDelivery > 0 && option.payNow > 0) {
    return (
      <span className="tnum">
        {formatINR(option.payNow)} now, {formatINR(option.dueOnDelivery)} {where}
      </span>
    );
  }
  if (option.dueOnDelivery > 0) {
    return (
      <span className="tnum">
        {fulfilment === 'delivery' ? `All ${formatINR(option.dueOnDelivery)} to the courier on delivery` : `All ${formatINR(option.dueOnDelivery)} at the studio`}
      </span>
    );
  }
  return <span className="tnum">All {formatINR(option.payNow)} paid now</span>;
}

export interface PaymentOptionsProps {
  options: PaymentOption[] | undefined;
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  loading: boolean;
  /** Said when the shopper's earlier choice stopped being available (a new PIN code, a bigger cart). */
  switchedNote: string | null;
  /** True inside the Instagram or Facebook app, where the card window may not open. */
  inAppBrowser: boolean;
  /** How the order is priced: 'cod' means paying at the studio for pickup and studio orders. */
  fulfilment: Fulfilment;
}

/** Every way to pay, each priced in full so the shopper compares real totals. */
export function PaymentOptions({ options, value, onChange, loading, switchedNote, inAppBrowser, fulfilment }: PaymentOptionsProps) {
  if (loading || !options) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Pricing each way to pay">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (options.length === 0) {
    return (
      <Callout tone="warn" title="No way to pay is set up yet">
        The shop has not switched on any payment method. Message us and we will take the order by phone.
      </Callout>
    );
  }

  const radioOptions: RadioOption<PaymentMethod>[] = options.map((option) => ({
    value: option.method,
    disabled: !option.available,
    label: (
      <span className="flex flex-wrap items-center gap-2">
        <span>{option.label}</span>
        <PayMarks method={option.method} fulfilment={fulfilment} />
      </span>
    ),
    description: option.available ? (
      <span className="grid gap-0.5">
        <Split option={option} fulfilment={fulfilment} />
        {option.note && <span>{option.note}</span>}
        {option.method === 'razorpay' && inAppBrowser && (
          <span className="text-warn">This window may not open inside the Instagram or Facebook app. If it does not, open this page in your browser.</span>
        )}
      </span>
    ) : (
      <span>{option.reason ?? 'Not available for this order.'}</span>
    ),
    trailing: option.available ? (
      <span className="grid justify-items-end gap-1">
        <span className="type-price">{formatINR(option.total)}</span>
        {option.saving > 0 && (
          <Badge tone="fit" size="sm">
            Save {formatINR(option.saving)}
          </Badge>
        )}
      </span>
    ) : null,
  }));

  return (
    <div className="grid gap-3">
      {switchedNote && (
        <p role="status" className="flex items-start gap-2 text-sm text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{switchedNote}</span>
        </p>
      )}
      <RadioGroup<PaymentMethod> legend="How do you want to pay?" legendHidden variant="card" options={radioOptions} value={value} onChange={onChange} />
    </div>
  );
}
