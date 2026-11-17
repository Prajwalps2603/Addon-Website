import { Store } from 'lucide-react';
import { PaymentMark, type PaymentKind } from '@/components/brand';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { Fulfilment, PaymentMethod, PaymentOption } from '@/types/api';

const MARKS: Record<PaymentMethod, PaymentKind[]> = {
  upi: ['upi'],
  razorpay: ['card', 'netbanking'],
  cod: ['cod'],
};

/** The marks beside a way to pay. 'cod' at the studio is paying at the counter, not cash to a courier. */
export function PayMarks({ method, fulfilment, muted = false }: { method: PaymentMethod; fulfilment: Fulfilment; muted?: boolean }) {
  if (method === 'cod' && fulfilment !== 'delivery') {
    return (
      <span className={cn('inline-flex h-6 items-center gap-1 rounded-control border border-line-strong px-1.5 type-label', muted && 'opacity-60')}>
        <Store aria-hidden className="size-3.5" />
        Studio
      </span>
    );
  }
  return (
    <span className={cn('flex gap-1', muted && 'opacity-60')}>
      {MARKS[method].map((kind) => (
        <PaymentMark key={kind} kind={kind} compact />
      ))}
    </span>
  );
}

export interface WaysToPayProps {
  options: PaymentOption[];
  /** How the cart was priced: changes what the cash option means. */
  fulfilment?: Fulfilment;
  updating?: boolean;
  className?: string;
}

/**
 * Every way to pay, priced in rupees side by side. Unavailable ones stay in the list, greyed,
 * with the reason, so nothing is a surprise at the last step. The choice itself is made at checkout.
 */
export function WaysToPay({ options, fulfilment = 'delivery', updating = false, className }: WaysToPayProps) {
  if (options.length === 0) return null;
  return (
    <section aria-labelledby="ways-to-pay" className={cn('grid gap-3', className)}>
      <div className="grid gap-1">
        <h2 id="ways-to-pay" className="type-h3">
          Ways to pay
        </h2>
        <p className="type-small text-muted">
          {fulfilment === 'delivery' ? 'Each total includes delivery and any fee.' : 'Each total includes the studio fitting charges.'} You choose at checkout.
        </p>
      </div>
      <ul className={cn('grid border-t border-ink transition-opacity dur-base', updating && 'opacity-60')}>
        {options.map((option) => (
          <li
            key={`${option.method}-${option.label}`}
            className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-line py-3', !option.available && 'text-muted')}
          >
            <div className="grid min-w-0 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <PayMarks method={option.method} fulfilment={fulfilment} muted={!option.available} />
                <span className="font-bold">{option.label}</span>
              </div>
              {option.available ? (
                option.note && <p className="type-small text-muted tnum">{option.note}</p>
              ) : (
                <p className="type-small tnum">
                  <span className="font-bold">Not available.</span> {option.reason}
                </p>
              )}
            </div>
            <div className="grid content-start justify-items-end gap-1 text-right">
              {option.available ? (
                <>
                  <span className="type-price tnum">{formatINR(option.total)}</span>
                  {option.saving > 0 && (
                    <Badge tone="fit" size="sm">
                      Saves {formatINR(option.saving)}
                    </Badge>
                  )}
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
