import type { ReactNode } from 'react';
import { Store, Truck, Wrench } from 'lucide-react';
import { fittingTerms } from '@/components/cart/studioFit';
import { Checkbox, RadioGroup, Skeleton, type RadioOption } from '@/components/ui';
import { formatINR, pluralize } from '@/lib/format';
import { cartLineKey } from '@/stores/cart';
import type { Fulfilment, PricedCart, PricedLine } from '@/types/api';

function OptionLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="[&_svg]:size-4">
        {icon}
      </span>
      {children}
    </span>
  );
}

export interface FulfilmentSectionProps {
  value: Fulfilment;
  onChange: (value: Fulfilment) => void;
  cart: PricedCart | undefined;
  /** Lines the studio can fit, from the priced cart. */
  fittable: PricedLine[];
  /** Store keys (cartLineKey) of the lines marked for fitting. */
  fitKeys: ReadonlySet<string>;
  onFitLine: (line: PricedLine, fit: boolean) => void;
  /** The studio's address as one line, '' when the owner has not filled it in. */
  studioAddress: string;
  /** The first price is still on its way. */
  loading: boolean;
}

/** "How do you want it?": delivered, collected from the studio, or fitted at the studio in a booked slot. */
export function FulfilmentSection({ value, onChange, cart, fittable, fitKeys, onFitLine, studioAddress, loading }: FulfilmentSectionProps) {
  if (loading && !cart) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Loading the ways to get your order">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // What fitting would cost: the lines already marked, or every part the studio fits when none is marked yet.
  const marked = fittable.filter((line) => fitKeys.has(cartLineKey(line)));
  const quoteLines = marked.length > 0 ? marked : fittable;
  const fittingCharge = quoteLines.reduce((sum, line) => sum + (line.fittingService?.charge ?? 0) * line.qty, 0);
  const firstLine = studioAddress.split('\n')[0]?.trim() ?? '';

  const options: RadioOption<Fulfilment>[] = [
    {
      value: 'delivery',
      label: <OptionLabel icon={<Truck />}>Deliver to me</OptionLabel>,
      description: 'By courier to your address. You fit the parts yourself or with your own mechanic.',
    },
    {
      value: 'pickup',
      label: <OptionLabel icon={<Store />}>Collect from our studio</OptionLabel>,
      description: firstLine ? `Collect the parts from ${firstLine}. No delivery charge.` : 'You collect the parts from the studio. No delivery charge.',
    },
    {
      value: 'studio',
      disabled: fittable.length === 0,
      label: <OptionLabel icon={<Wrench />}>Fit at our studio</OptionLabel>,
      description:
        fittable.length === 0
          ? 'None of these parts is on the studio fitting list. You can still collect them from the studio.'
          : `Our own team fits ${fittable.length === 1 ? 'the part' : `the ${pluralize(fittable.length, 'part')} we fit`} in a slot you book. No delivery charge.`,
      trailing:
        fittable.length > 0 ? (
          <span className="grid justify-items-end">
            <span className="type-price tnum">{fittingCharge > 0 ? `+${formatINR(fittingCharge)}` : 'No charge'}</span>
            <span className="type-small text-muted">fitting</span>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="grid gap-4">
      <RadioGroup<Fulfilment> legend="How do you want it?" legendHidden variant="card" options={options} value={value} onChange={onChange} />

      {value === 'studio' && fittable.length > 0 && (
        <fieldset className="grid gap-1 border-t border-line pt-3">
          <legend className="type-small mb-1 font-bold">Parts to fit</legend>
          {fittable.map((line) => {
            const service = line.fittingService;
            if (!service) return null;
            const key = cartLineKey(line);
            const charge = service.charge * line.qty;
            return (
              <Checkbox
                key={key}
                checked={fitKeys.has(key)}
                onChange={(event) => onFitLine(line, event.target.checked)}
                label={
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0">
                      {line.qty > 1 ? `${line.qty} x ` : ''}
                      {line.name}
                      {line.variantName ? ` (${line.variantName})` : ''}
                    </span>
                    <span className="type-small font-bold tnum">{charge > 0 ? formatINR(charge) : 'No charge'}</span>
                  </span>
                }
                description={`${service.name}. ${fittingTerms(service)}.`}
              />
            );
          })}
          {marked.length === 0 && (
            <p className="type-small text-warn">Tick at least one part to fit, or choose Collect from our studio.</p>
          )}
          {cart && fittable.length < cart.lines.length && marked.length > 0 && (
            <p className="type-small text-muted">The other parts are handed over at the studio with your car.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
