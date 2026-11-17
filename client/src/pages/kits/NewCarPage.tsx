import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useSearchParams } from 'react-router';
import * as z from 'zod';
import { CircleAlert } from 'lucide-react';
import { Roundel, TreadDivider } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, Field, Input, prefersReducedMotion } from '@/components/ui';
import { useVehicle } from '@/hooks/useVehicles';
import { formatDate, formatINR, formatNumber } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useGarage } from '@/stores/garage';
import type { Vehicle } from '@/types/api';
import { BudgetField } from './BudgetField';
import { KeepKit } from './KeepKit';
import { KitDock, KitResults, KitSkeleton, KitStudioOffer, TakenOut } from './KitResults';
import { CarStep, DealerCompare, OrderBy, QuoteNote } from './NewCarParts';
import { NoKits } from './NoKits';
import { isIsoDate, longDay, parseRupees, todayInIndia } from './kitShared';
import { RESET_PLANNER, useKitPlanner, useParamPatch } from './useKitPlanner';
import { useLowestBudget } from './useKits';

const BUDGET_MIN = 2_000;
const BUDGET_MAX = 5_00_000;
const SLIDER_MIN = 5_000;
const SLIDER_MAX = 1_50_000;
const QUICK = [15_000, 25_000, 40_000, 60_000] as const;

const DESCRIPTION =
  'The dealer quotes an accessories pack as one figure. Give us the car and a budget and we split it into three kits of parts that fit, priced part by part.';

const plannerSchema = z.object({
  vehicleId: z.number().int().positive().nullable().refine((value) => value !== null, { error: 'Choose the car you have booked.' }),
  arrival: z
    .string()
    .refine((value) => value === '' || (isIsoDate(value) && value >= todayInIndia()), { error: 'Pick a date from today on, or leave it blank.' }),
  budget: z.string().refine(
    (value) => {
      const amount = parseRupees(value);
      return amount !== null && amount >= BUDGET_MIN && amount <= BUDGET_MAX;
    },
    { error: `Enter a budget from ${formatINR(BUDGET_MIN)} to ${formatINR(BUDGET_MAX)}.` },
  ),
  quote: z.string().refine((value) => value.trim() === '' || (parseRupees(value) ?? 0) > 0, {
    error: 'Enter the quote in rupees, or leave it blank.',
  }),
});

type PlannerInput = z.input<typeof plannerSchema>;
type PlannerValues = z.output<typeof plannerSchema>;

interface Committed {
  vehicleId: number | null;
  budget: number | null;
  arrival: string;
  quote: number | null;
}

function StepHead({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <legend className="mb-4 flex items-center gap-3">
      <Roundel size="md" tone="ink">
        {n}
      </Roundel>
      <span className="grid">
        <span className="type-h3">{title}</span>
        {note && <span className="type-small text-muted">{note}</span>}
      </span>
    </legend>
  );
}

function PlannerForm({ initial, hasResults, onSubmit }: { initial: Committed; hasResults: boolean; onSubmit: (values: Committed) => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlannerInput, unknown, PlannerValues>({
    resolver: zodResolver(plannerSchema),
    defaultValues: {
      vehicleId: initial.vehicleId,
      arrival: initial.arrival,
      budget: initial.budget ? formatNumber(initial.budget) : formatNumber(25_000),
      quote: initial.quote ? formatNumber(initial.quote) : '',
    },
  });

  return (
    <form
      noValidate
      aria-label="Plan the kit"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          vehicleId: values.vehicleId,
          budget: parseRupees(values.budget),
          arrival: values.arrival,
          quote: values.quote.trim() ? parseRupees(values.quote) : null,
        }),
      )}
      className="grid gap-8"
    >
      <div className="grid gap-10 border-t border-ink pt-6 lg:grid-cols-3 lg:gap-8">
        <fieldset className="min-w-0">
          <StepHead n={1} title="Which car" />
          <Controller
            control={control}
            name="vehicleId"
            render={({ field }) => <CarStep value={field.value} onChange={field.onChange} error={errors.vehicleId?.message} />}
          />
        </fieldset>

        <fieldset className="grid min-w-0 content-start gap-5 lg:border-l lg:border-line lg:pl-8">
          <StepHead n={2} title="When and how much" />
          <Field label="When does it arrive?" optional hint="Leave blank if the dealer has not said." error={errors.arrival?.message}>
            <Input type="date" min={todayInIndia()} {...register('arrival')} />
          </Field>
          <Controller
            control={control}
            name="budget"
            render={({ field }) => (
              <BudgetField
                label="Accessories budget"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.budget?.message}
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                sliderStep={1_000}
                quickAmounts={QUICK}
              />
            )}
          />
        </fieldset>

        <fieldset className="min-w-0 content-start lg:border-l lg:border-line lg:pl-8">
          <StepHead n={3} title="The dealer's quote" note="Optional" />
          <Field
            label="What did the dealer quote for accessories?"
            hint="The total of the pack, if you have one. We compare totals only."
            error={errors.quote?.message}
          >
            <Input inputMode="numeric" autoComplete="off" leading={<span className="font-bold">₹</span>} className="tnum" {...register('quote')} />
          </Field>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" size="lg" variant={hasResults ? 'outline' : 'primary'}>
          {hasResults ? 'Update the kits' : 'Show my kits'}
        </Button>
        <p className="type-small max-w-prose text-muted">Only parts in stock that fit the car, or universal parts. Nothing is reserved.</p>
      </div>
    </form>
  );
}

export default function NewCarPage() {
  useDocumentMeta({ title: 'New car planner', description: DESCRIPTION });
  const [params] = useSearchParams();
  const location = useLocation();
  const patch = useParamPatch();
  const activeId = useGarage((state) => state.activeVehicleId);
  const resultsRef = useRef<HTMLElement>(null);
  const [scrollToResults, setScrollToResults] = useState(false);

  const carParam = Number(params.get('car'));
  const vehicleId = Number.isSafeInteger(carParam) && carParam > 0 ? carParam : null;
  const budgetParam = parseRupees(params.get('budget'));
  const budget = budgetParam !== null && budgetParam >= BUDGET_MIN && budgetParam <= BUDGET_MAX ? budgetParam : null;
  const dateParam = params.get('date');
  const arrival = isIsoDate(dateParam) ? dateParam : '';
  const quote = parseRupees(params.get('quote')) || null;

  const ready = vehicleId !== null && budget !== null;
  const planner = useKitPlanner(ready ? { goal: 'new_car', budget, vehicleId } : null);
  const lowest = useLowestBudget(
    ready && planner.data && planner.data.kits.length === 0 && !planner.updating ? planner.request : null,
    { max: BUDGET_MAX, step: 1_000 },
  );
  const { data: fallbackVehicle } = useVehicle(ready && !planner.data ? vehicleId : null);
  const vehicle: Vehicle | null = planner.data?.vehicle ?? fallbackVehicle ?? null;

  useEffect(() => {
    if (!scrollToResults || !planner.data) return;
    setScrollToResults(false);
    resultsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, [scrollToResults, planner.data]);

  const submit = (values: Committed) => {
    const sameRequest = values.vehicleId === vehicleId && values.budget === budget;
    patch(
      {
        car: values.vehicleId,
        budget: values.budget,
        date: values.arrival || null,
        quote: values.quote,
        ...(sameRequest ? {} : RESET_PLANNER),
      },
      { push: true },
    );
    setScrollToResults(true);
  };

  const formKey = [vehicleId, budget, arrival, quote].join('|');
  const model = vehicle?.model ?? 'new car';
  const path = `${location.pathname}${location.search}`;
  const chosen = planner.chosen;

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title="New car planner"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'New car planner' }]}
        description={DESCRIPTION}
      />

      <PlannerForm
        key={formKey}
        initial={{ vehicleId: vehicleId ?? activeId, budget, arrival, quote }}
        hasResults={ready}
        onSubmit={submit}
      />

      {ready && (
        <>
          <TreadDivider tone="ink" className="my-10 md:my-14" />
          <section ref={resultsRef} aria-labelledby="kits-title" className="grid scroll-mt-24 gap-6">
            <div className="grid gap-2">
              <h2 id="kits-title" className="type-h1">
                Kits for the {model}
              </h2>
              <p className="max-w-prose text-muted">
                {vehicle ? `${vehicle.label}. ` : ''}Budget {formatINR(budget)}
                {arrival ? `, arriving ${longDay(arrival)}` : ''}
                {quote ? `, dealer's quote ${formatINR(quote)}` : ''}. Each kit stays within the budget. Remove a part, or swap it for the
                next option in its range.
              </p>
            </div>

            {planner.query.isPending ? (
              <>
                <span className="sr-only" role="status">
                  Building the kits
                </span>
                <KitSkeleton />
              </>
            ) : planner.query.isError && !planner.data ? (
              <ErrorState error={planner.query.error} onRetry={() => void planner.query.refetch()} />
            ) : planner.shown.length === 0 || !planner.selected || !chosen ? (
              <NoKits
                budget={budget}
                what={`a kit for the ${model}`}
                lowest={lowest.data}
                lowestFailed={lowest.isError}
                onUseBudget={(next) => patch({ budget: next, ...RESET_PLANNER }, { push: true })}
                askText={`Hi, I have booked a ${vehicle?.label ?? 'new car'}${arrival ? ` arriving on ${formatDate(arrival)}` : ''}. My accessories budget is ${formatINR(budget)}. Which parts would you suggest?`}
                actions={
                  <Button variant="outline" to="/shop">
                    Browse all parts
                  </Button>
                }
              />
            ) : (
              <>
                <KitResults
                  idPrefix="new-car-kit"
                  shown={planner.shown}
                  selected={planner.selected}
                  onSelect={planner.onSelect}
                  budget={planner.data?.budget ?? budget}
                  vehicle={vehicle}
                  updating={planner.updating}
                  swappingId={planner.swappingId}
                  onSwap={planner.onSwap}
                  onRemove={planner.onRemove}
                  onRestore={planner.onRestore}
                  kitNote={quote ? (entry) => <QuoteNote total={entry.total} quote={quote} /> : undefined}
                />
                {planner.query.isError && (
                  <p role="alert" className="type-small flex flex-wrap items-center gap-x-1.5 text-stop">
                    <CircleAlert aria-hidden className="size-4 shrink-0" />
                    Could not rebuild the kits: {planner.query.error.message}{' '}
                    <Button variant="link" size="sm" onClick={() => void planner.query.refetch()}>
                      Try again
                    </Button>
                  </p>
                )}
                <TakenOut
                  removed={planner.removed}
                  swapped={planner.excluded}
                  onPutBack={planner.onRestore}
                  onUnswap={planner.onUnswap}
                  disabled={planner.updating}
                />
                <KitStudioOffer shown={chosen} busy={planner.updating} />
                <KitDock shown={chosen} budget={planner.data?.budget ?? budget} busy={planner.updating} />
              </>
            )}
          </section>

          {chosen && vehicle && (
            <>
              {quote && (
                <>
                  <TreadDivider tone="line" className="my-10 md:my-14" />
                  <DealerCompare shown={chosen} quote={quote} vehicle={vehicle} />
                </>
              )}
              {arrival && (
                <>
                  <TreadDivider tone="line" className="my-10 md:my-14" />
                  <OrderBy arrival={arrival} />
                </>
              )}
              <TreadDivider tone="line" className="my-10 md:my-14" />
              <KeepKit
                shown={chosen}
                goal="new_car"
                budget={budget}
                vehicle={vehicle}
                vehicleLabel={vehicle.label}
                dealerQuote={quote}
                deliveryDate={arrival || null}
                shareHeading={`${chosen.kit.title} accessories kit for my new ${vehicle.model}`}
                path={path}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
