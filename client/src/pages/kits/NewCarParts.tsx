import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Car, CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import * as z from 'zod';
import { BoardWord, PitBoard } from '@/components/brand';
import { ErrorState, VehicleSteps } from '@/components/commerce';
import { Button, Callout, Field, Input, Skeleton } from '@/components/ui';
import { useVehicle } from '@/hooks/useVehicles';
import { api } from '@/lib/api';
import { formatDateRange, formatINR, pluralize } from '@/lib/format';
import { isValidPincode } from '@/lib/india';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { useCart } from '@/stores/cart';
import { useGarage } from '@/stores/garage';
import type { Vehicle } from '@/types/api';
import { compareToQuote, longDay, quoteLine, todayInIndia, workingDaysBefore, type ShownKit } from './kitShared';

// ---------------------------------------------------------------------------- step 1: the car

export interface CarStepProps {
  value: number | null;
  onChange: (vehicleId: number) => void;
  error?: string;
}

/** The booked car: read back on the board once chosen, or picked from the garage or the make, model and year steps. */
export function CarStep({ value, onChange, error }: CarStepProps) {
  const cars = useGarage((state) => state.vehicles);
  const [changing, setChanging] = useState(false);
  const garageCar = cars.find((car) => car.vehicleId === value)?.vehicle;
  const { data: fetched, isPending, error: carError, refetch } = useVehicle(garageCar ? null : value);
  const vehicle: Vehicle | undefined = garageCar ?? fetched;

  const pick = (next: Vehicle) => {
    queryClient.setQueryData(queryKeys.vehicles.detail(next.id), next);
    onChange(next.id);
    setChanging(false);
  };

  if (value && !changing) {
    if (!vehicle) {
      if (carError) return <ErrorState error={carError} onRetry={() => void refetch()} size="sm" />;
      return isPending ? <Skeleton className="h-36 w-full" /> : null;
    }
    return (
      <PitBoard
        title="The car you booked"
        aside={
          <button type="button" onClick={() => setChanging(true)} className="tap-44 font-bold underline underline-offset-4 hover:decoration-2">
            Change car
          </button>
        }
      >
        <BoardWord text={vehicle.model} size="md" tone="brand" />
        <p className="type-small text-muted">{vehicle.label}</p>
      </PitBoard>
    );
  }

  const others = cars.filter((car) => car.vehicleId !== value);
  return (
    <div className="grid min-w-0 gap-3">
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((car) => (
            <Button key={car.vehicleId} variant="outline" size="sm" iconLeft={<Car aria-hidden />} onClick={() => pick(car.vehicle)}>
              My {car.vehicle.model}
            </Button>
          ))}
        </div>
      )}
      <VehicleSteps
        onDone={(next, year) => {
          // Keep the booked car in the garage, without changing the car the rest of the shop checks fit for.
          useGarage.getState().add(next, { year, makeActive: useGarage.getState().activeVehicleId === null });
          pick(next);
        }}
      />
      {changing && value && (
        <Button variant="ghost" size="sm" onClick={() => setChanging(false)} className="justify-self-start">
          Keep {vehicle?.model ?? 'the same car'}
        </Button>
      )}
      {error && (
        <p role="alert" className="type-small flex items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- the dealer's quote

/** The one-line comparison under each kit's total. */
export function QuoteNote({ total, quote }: { total: number; quote: number }) {
  const verdict = compareToQuote(total, quote);
  return (
    <p className={verdict.kind === 'less' ? 'type-small font-bold text-fit tnum' : 'type-small font-bold tnum'}>{quoteLine(verdict)}</p>
  );
}

export interface DealerCompareProps {
  shown: ShownKit;
  quote: number;
  vehicle: Vehicle;
}

/**
 * The chosen kit beside the dealer's figure. It compares totals only and never guesses what the
 * dealer's pack holds: the facts listed are about the parts in this kit.
 */
export function DealerCompare({ shown, quote, vehicle }: DealerCompareProps) {
  const verdict = compareToQuote(shown.total, quote);
  const items = shown.items.map((item) => item.product);
  const direct = items.filter((product) => product.fit === 'direct').length;
  const universal = items.filter((product) => product.fit === 'universal' || product.fitmentType === 'none').length;
  const withWork = items.filter((product) => product.fit === 'with_work').length;
  const workshop = items.filter((product) => product.proInstall).length;
  const warranty = items.filter((product) => product.warrantyImpact !== 'none').length;

  const fitParts = [
    direct > 0 ? `${direct} ${direct === 1 ? 'is' : 'are'} listed as a direct fit` : '',
    universal > 0 ? `${universal} ${universal === 1 ? 'is a universal part' : 'are universal parts'}` : '',
    withWork > 0 ? `${withWork} ${withWork === 1 ? 'fits' : 'fit'} with some work` : '',
  ].filter(Boolean);

  const difference =
    verdict.kind === 'same' ? (verdict.difference > 0 ? formatINR(verdict.difference) : 'None') : formatINR(verdict.difference);

  return (
    <section aria-labelledby="dealer-title" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="dealer-title" className="type-h2">
          {verdict.kind === 'same' ? 'About the same: here is what differs' : "Against the dealer's quote"}
        </h2>
        <p className="max-w-prose text-muted">
          Totals only. We do not know what is in the dealer's pack, so ask for an itemised list before you compare part for part.
        </p>
      </div>

      <dl className="grid max-w-3xl grid-cols-1 border-t border-ink sm:grid-cols-3">
        <div className="grid gap-1 border-b border-line py-3 sm:border-b-0 sm:pr-4">
          <dt className="type-label text-muted">Dealer's quote</dt>
          <dd className="type-price-xl">{formatINR(quote)}</dd>
        </div>
        <div className="grid gap-1 border-b border-line py-3 sm:border-b-0 sm:border-l sm:px-4">
          <dt className="type-label text-muted">{shown.kit.title} kit</dt>
          <dd className="type-price-xl">{formatINR(shown.total)}</dd>
        </div>
        <div className="grid gap-1 py-3 sm:border-l sm:pl-4">
          <dt className="type-label text-muted">Difference</dt>
          <dd className="grid gap-0.5">
            <span className={verdict.kind === 'less' ? 'type-price-xl text-fit' : 'type-price-xl'}>{difference}</span>
            <span className="type-small text-muted">
              {verdict.kind === 'less' ? 'less here' : verdict.kind === 'more' ? 'more here' : 'within 5% of the quote'}
            </span>
          </dd>
        </div>
      </dl>

      <ul className="grid max-w-prose gap-3">
        <li className="border-l border-line pl-4">
          Each of the {pluralize(items.length, 'part')} here has its own price, so you can drop what you do not need and keep the rest.
        </li>
        {fitParts.length > 0 && (
          <li className="border-l border-line pl-4">
            Of these parts for the {vehicle.model}: {fitParts.join(', ')}.
          </li>
        )}
        <li className="border-l border-line pl-4">
          Fitting is not in this total.{' '}
          {workshop > 0
            ? `${workshop === 1 ? 'One part is' : `${workshop} parts are`} best fitted by a workshop; each part's page says what a fair labour charge is.`
            : 'None of these parts needs a workshop; each part says how hard it is to fit.'}
        </li>
        <li className="border-l border-line pl-4">
          {warranty > 0 ? (
            <>
              {warranty === 1 ? 'One part' : `${warranty} parts`} could affect the car's warranty. The{' '}
              <Link to="/straight-label" className="link font-bold">
                Straight Label
              </Link>{' '}
              on each part says how.
            </>
          ) : (
            'None of these parts is marked as a risk to the warranty.'
          )}
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------- order-by date

const pinSchema = z.object({
  pincode: z
    .string()
    .trim()
    .refine((value) => isValidPincode(value), { error: 'Enter the 6 digit PIN code the parts go to.' }),
});
type PinValues = z.infer<typeof pinSchema>;

function PinForm({ initial, onDone }: { initial: string; onDone: (pincode: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PinValues>({ resolver: zodResolver(pinSchema), defaultValues: { pincode: initial } });
  return (
    <form noValidate onSubmit={handleSubmit((values) => onDone(values.pincode))} className="flex max-w-md flex-wrap items-start gap-3">
      <Field label="Delivery PIN code" error={errors.pincode?.message} className="min-w-0 flex-1">
        <Input inputMode="numeric" autoComplete="postal-code" maxLength={6} mono {...register('pincode')} />
      </Field>
      <Button type="submit" variant="dark" className="mt-7">
        Work it out
      </Button>
    </form>
  );
}

/**
 * When to order so the parts are there when the car is: the arrival date less the slowest delivery
 * time for the shopper's PIN code. Stated as a fact, with the dates it rests on.
 */
export function OrderBy({ arrival }: { arrival: string }) {
  const pincode = useCart((state) => state.pincode);
  const setPincode = useCart((state) => state.setPincode);
  const [editing, setEditing] = useState(false);
  const valid = isValidPincode(pincode);

  const estimate = useQuery({
    queryKey: queryKeys.shipping(pincode),
    queryFn: ({ signal }) => api.shipping.estimate(pincode, { signal }),
    enabled: valid && !editing,
    staleTime: 10 * 60_000,
  });

  const today = todayInIndia();

  let body;
  if (!valid || editing) {
    body = (
      <PinForm
        initial={pincode}
        onDone={(next) => {
          setPincode(next);
          setEditing(false);
        }}
      />
    );
  } else if (estimate.isPending) {
    body = <Skeleton className="h-28 w-full max-w-xl" />;
  } else if (estimate.isError) {
    body = <ErrorState error={estimate.error} onRetry={() => void estimate.refetch()} size="sm" />;
  } else if (!estimate.data.serviceable) {
    body = (
      <Callout tone="warn" title={`We cannot deliver to ${pincode} yet`}>
        {estimate.data.message}
      </Callout>
    );
  } else {
    const est = estimate.data;
    const orderBy = workingDaysBefore(arrival, est.maxDays);
    const inTime = orderBy >= today;
    body = (
      <div className="grid gap-4">
        {inTime ? (
          <PitBoard title="Order by" className="max-w-xl">
            <BoardWord text={longDay(orderBy).replace(',', '')} size="md" tone="brand" />
            <p className="type-small">
              Ordered by then, the parts should reach {pincode} before the car arrives on {longDay(arrival)}.
            </p>
          </PitBoard>
        ) : (
          <Callout tone="info" title="The parts would arrive after the car">
            Ordered today, they should reach {pincode} between {formatDateRange(est.earliest, est.latest)}. The car arrives on {longDay(arrival)}, so
            plan to fit them in the days after.
          </Callout>
        )}
        <p className="type-small max-w-prose text-muted tnum">
          Delivery to {pincode}
          {est.state ? ` (${est.state})` : ''} takes {est.minDays} to {est.maxDays} working days, Sundays not counted. It is an estimate, not a
          courier promise.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="order-by-title" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="order-by-title" className="type-h2">
          Parts there before the car
        </h2>
        {valid && !editing && (
          <Button variant="link" size="sm" onClick={() => setEditing(true)}>
            Change PIN code
          </Button>
        )}
      </div>
      {body}
    </section>
  );
}
