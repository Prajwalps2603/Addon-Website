import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, CircleX, Truck } from 'lucide-react';
import { Button, Field, Input, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/format';
import { isValidPincode } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useCart } from '@/stores/cart';
import type { ShippingEstimate } from '@/types/api';

export interface PincodeCheckProps {
  /** Pass the product's `codEligible`. False states that this part is prepaid only, whatever the PIN code allows. */
  codEligible?: boolean;
  /** Called with each new estimate, so the page can use it (a delivery line beside the buy button). */
  onEstimate?: (estimate: ShippingEstimate) => void;
  /** The field's label. */
  label?: string;
  className?: string;
}

/**
 * "When will it reach me?": a PIN code box that answers with the real delivery dates and whether
 * cash on delivery is offered there. The PIN code is remembered in the cart, so the shopper types
 * it once and the cart, checkout and every product page already know it.
 */
export function PincodeCheck({ codEligible = true, onEstimate, label = 'Delivery PIN code', className }: PincodeCheckProps) {
  const saved = useCart((state) => state.pincode);
  const setPincode = useCart((state) => state.setPincode);
  const [typed, setTyped] = useState(saved);
  const [checked, setChecked] = useState(isValidPincode(saved) ? saved : '');
  const [problem, setProblem] = useState<string | null>(null);

  // The PIN code can also change elsewhere (the cart page): follow it.
  useEffect(() => {
    if (!isValidPincode(saved)) return;
    setTyped(saved);
    setChecked(saved);
    setProblem(null);
  }, [saved]);

  const { data, error, isFetching } = useQuery({
    queryKey: queryKeys.shipping(checked),
    queryFn: ({ signal }) => api.shipping.estimate(checked, { signal }),
    enabled: checked !== '',
    staleTime: 10 * 60_000,
  });

  const report = useRef(onEstimate);
  useEffect(() => {
    report.current = onEstimate;
  });
  useEffect(() => {
    if (data) report.current?.(data);
  }, [data]);

  const check = () => {
    const pincode = typed.trim();
    if (!isValidPincode(pincode)) {
      setProblem('Enter a 6 digit PIN code.');
      return;
    }
    setProblem(null);
    setChecked(pincode);
    setPincode(pincode);
  };

  // Not a <form>: this sits inside pages that already have one, and forms cannot nest.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    check();
  };

  const current = data && data.pincode === checked ? data : null;

  return (
    <div className={cn('grid gap-3', className)}>
      <Field label={label} error={problem ?? (error && !isFetching ? error.message : undefined)}>
        <div className="flex gap-2">
          <Input
            mono
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="560001"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value.replace(/\D/g, '').slice(0, 6));
              setProblem(null);
            }}
            onKeyDown={onKeyDown}
            className="max-w-40"
          />
          <Button variant="outline" onClick={check} loading={isFetching}>
            Check
          </Button>
        </div>
      </Field>

      <div aria-live="polite" className="grid gap-1.5 empty:hidden">
        {isFetching && !current && <Skeleton className="h-10 w-full max-w-xs" />}
        {current &&
          (current.serviceable ? (
            <>
              <p className="flex items-start gap-2 font-bold">
                <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-fit" />
                <span>
                  Arrives {formatDateRange(current.earliest, current.latest)}
                  <span className="type-small block font-normal text-muted">
                    To <span className="font-mono text-[0.75rem]">{current.pincode}</span>
                    {current.state ? `, ${current.state}` : ''}
                  </span>
                </span>
              </p>
              <p className="type-small flex items-start gap-2">
                <Banknote aria-hidden className="size-5 shrink-0 text-muted" />
                <span className="pt-0.5">
                  {!codEligible
                    ? 'This part is prepaid only: pay by UPI or card.'
                    : current.codAvailable
                      ? 'Cash on delivery is available here.'
                      : 'Cash on delivery is not available at this PIN code. Pay by UPI or card.'}
                </span>
              </p>
              {current.message && <p className="type-small text-muted">{current.message}</p>}
            </>
          ) : (
            <p className="flex items-start gap-2 font-bold text-stop">
              <CircleX aria-hidden className="mt-0.5 size-5 shrink-0" />
              <span>
                We do not deliver to {current.pincode} yet.
                {current.message && <span className="type-small block font-normal text-ink">{current.message}</span>}
              </span>
            </p>
          ))}
      </div>
    </div>
  );
}
