import { useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useSearchParams } from 'react-router';
import * as z from 'zod';
import { CircleAlert } from 'lucide-react';
import { TreadDivider } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { useVehicle } from '@/hooks/useVehicles';
import { formatINR, formatNumber } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useGarage } from '@/stores/garage';
import type { BodyType, Vehicle } from '@/types/api';
import { BudgetField } from './BudgetField';
import { KeepKit } from './KeepKit';
import { KitDock, KitResults, KitSkeleton, KitStudioOffer, TakenOut } from './KitResults';
import { NoKits } from './NoKits';
import { BudgetNudges, CarChoice, POCKET_MAX, POCKET_MIN, VibePicker } from './PocketParts';
import { bodyLabel, bodyPlural, isBodyType, isVibe, parseRupees, VIBES, VIBE_WORDS, type Vibe } from './kitShared';
import { RESET_PLANNER, useKitPlanner, useParamPatch } from './useKitPlanner';
import { useLowestBudget } from './useKits';

const QUICK = [2_000, 5_000, 10_000, 20_000, 35_000] as const;

const DESCRIPTION = 'Type a budget, pick a vibe, and get a complete kit of parts that fit. The total never goes over the number you typed.';

const budgetSchema = z.object({
  budget: z.string().refine(
    (value) => {
      const amount = parseRupees(value);
      return amount !== null && amount >= POCKET_MIN && amount <= POCKET_MAX;
    },
    { error: `Enter an amount from ${formatINR(POCKET_MIN)} to ${formatINR(POCKET_MAX)}.` },
  ),
});
type BudgetValues = z.infer<typeof budgetSchema>;

function validBudget(value: number | null): number | null {
  return value !== null && value >= POCKET_MIN && value <= POCKET_MAX ? value : null;
}

/** The budget box: typed, chips or nudges. A valid amount reaches the URL once typing pauses. */
function PocketBudget({ urlBudget, onBudget }: { urlBudget: number | null; onBudget: (budget: number) => void }) {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BudgetValues>({
    resolver: zodResolver(budgetSchema),
    mode: 'onChange',
    defaultValues: { budget: urlBudget ? formatNumber(urlBudget) : '' },
  });

  const typed = validBudget(parseRupees(watch('budget')));
  const settled = useDebounce(typed, 450);

  useEffect(() => {
    if (settled !== null && settled !== urlBudget) onBudget(settled);
    // Only when the typed amount settles; a new URL budget is copied into the box below.
  }, [settled]);

  // A chip, a nudge or the back button changed the budget: show it in the box.
  useEffect(() => {
    if (urlBudget !== null && parseRupees(watch('budget')) !== urlBudget) {
      setValue('budget', formatNumber(urlBudget), { shouldValidate: true });
    }
  }, [urlBudget]);

  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} aria-label="Budget">
      <Controller
        control={control}
        name="budget"
        render={({ field }) => (
          <BudgetField
            label="Your budget"
            hint={`From ${formatINR(POCKET_MIN)} to ${formatINR(POCKET_MAX)}, everything included.`}
            name={field.name}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={errors.budget?.message}
            min={POCKET_MIN}
            max={POCKET_MAX}
            quickAmounts={QUICK}
          />
        )}
      />
    </form>
  );
}

export default function PocketBuildsPage() {
  useDocumentMeta({ title: 'Pocket builds', description: DESCRIPTION });
  const [params] = useSearchParams();
  const location = useLocation();
  const patch = useParamPatch();
  const activeId = useGarage((state) => state.activeVehicleId);

  const budget = validBudget(parseRupees(params.get('budget')));
  const vibeParam = params.get('vibe');
  const vibe: Vibe | null = isVibe(vibeParam) ? vibeParam : null;
  const carParam = Number(params.get('car'));
  const bodyParam = params.get('body');
  const bodyType: BodyType | null = isBodyType(bodyParam) ? bodyParam : null;
  const vehicleId = Number.isSafeInteger(carParam) && carParam > 0 ? carParam : bodyType ? null : activeId;

  // A car just added through the picker becomes the car for the kit.
  const lastActive = useRef(activeId);
  useEffect(() => {
    if (activeId !== lastActive.current && activeId !== null) patch({ car: activeId, body: null, ...RESET_PLANNER });
    lastActive.current = activeId;
  }, [activeId, patch]);

  const ready = budget !== null && vibe !== null;
  const planner = useKitPlanner(ready ? { goal: vibe, budget, vehicleId: vehicleId ?? undefined, bodyType: vehicleId ? undefined : (bodyType ?? undefined) } : null);
  const lowest = useLowestBudget(
    ready && planner.data && planner.data.kits.length === 0 && !planner.updating ? planner.request : null,
    { max: POCKET_MAX, step: 500 },
  );
  const { data: carRecord } = useVehicle(vehicleId);
  const vehicle: Vehicle | null = vehicleId ? (planner.data?.vehicle ?? carRecord ?? null) : null;

  /** Every key the result depends on, so a link opens the same kits even without the garage car. */
  const fullPatch = { car: vehicleId, body: vehicleId ? null : bodyType };

  const setBudget = (next: number) => patch({ budget: next, ...fullPatch });
  const setVibe = (next: Vibe) => patch({ vibe: next, ...fullPatch, ...RESET_PLANNER });
  const setCar = (id: number) => patch({ car: id, body: null, ...RESET_PLANNER });
  const setBody = (body: BodyType) => patch({ body, car: null, ...RESET_PLANNER });

  const vibeWord = vibe ? VIBE_WORDS[vibe] : '';
  const vibeLabel = VIBES.find((entry) => entry.value === vibe)?.label ?? '';
  const forWhom = vehicle ? `the ${vehicle.model}` : bodyType ? `any ${bodyLabel(bodyType)}` : 'any car';
  const vehicleLabel = vehicle?.label ?? (bodyType ? `Any ${bodyLabel(bodyType).toLowerCase()}` : 'Any car');
  const shareParams = new URLSearchParams(location.search);
  if (vehicleId) shareParams.set('car', String(vehicleId));
  const path = `${location.pathname}?${shareParams.toString()}`;
  const chosen = planner.chosen;
  const kitBudget = planner.data?.budget ?? budget ?? 0;

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader title="Pocket builds" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Pocket builds' }]} description={DESCRIPTION} />

      <div className="grid gap-10 border-t border-ink pt-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
        <div className="grid content-start gap-10">
          <PocketBudget urlBudget={budget} onBudget={setBudget} />
          <CarChoice vehicleId={vehicleId} bodyType={bodyType} onCar={setCar} onBody={setBody} />
        </div>
        <div className="lg:border-l lg:border-line lg:pl-12">
          <VibePicker value={vibe} onChange={setVibe} />
        </div>
      </div>

      <TreadDivider tone="ink" className="my-10 md:my-14" />

      {!ready ? (
        <section aria-label="Kits" className="grid max-w-prose gap-2">
          <h2 className="type-h2">{budget === null ? 'Start with a number' : 'Now pick a vibe'}</h2>
          <p className="text-muted">
            {budget === null
              ? `Type what you want to spend, from ${formatINR(POCKET_MIN)} to ${formatINR(POCKET_MAX)}, and pick a vibe. The kits appear here.`
              : `${formatINR(budget)} is set. Pick one of the six vibes above and the kits appear here.`}
          </p>
        </section>
      ) : (
        <section aria-labelledby="pocket-kits-title" className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="grid gap-2">
              <h2 id="pocket-kits-title" className="type-h1">
                {vibeLabel} within {formatINR(budget)}
              </h2>
              <p className="max-w-prose text-muted">
                For {vehicle ? vehicle.label : forWhom}. Every total stays at or under your number. Remove a part, or swap it for the next option in
                its range.
              </p>
            </div>
            {planner.request && planner.shown.length > 0 && <BudgetNudges request={planner.request} onUse={setBudget} />}
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
              what={`a ${vibeWord} kit for ${vehicle ? `the ${vehicle.model}` : bodyType ? bodyPlural(bodyType) : 'any car'}`}
              lowest={lowest.data}
              lowestFailed={lowest.isError}
              onUseBudget={setBudget}
              askText={`Hi, I want a ${vibeWord} kit for ${vehicle ? `my ${vehicle.label}` : forWhom} with a budget of ${formatINR(budget)}. What would you suggest?`}
              actions={
                <Button variant="outline" to="/shop">
                  Browse all parts
                </Button>
              }
            />
          ) : (
            <>
              <KitResults
                idPrefix="pocket-kit"
                shown={planner.shown}
                selected={planner.selected}
                onSelect={planner.onSelect}
                budget={kitBudget}
                vehicle={vehicle}
                bodyType={vehicle ? null : bodyType}
                updating={planner.updating}
                swappingId={planner.swappingId}
                onSwap={planner.onSwap}
                onRemove={planner.onRemove}
                onRestore={planner.onRestore}
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
              <KitDock shown={chosen} budget={kitBudget} busy={planner.updating} />
            </>
          )}
        </section>
      )}

      {ready && chosen && vibe && (
        <>
          <TreadDivider tone="line" className="my-10 md:my-14" />
          <KeepKit
            shown={chosen}
            goal={vibe}
            budget={kitBudget}
            vehicle={vehicle}
            vehicleLabel={vehicleLabel}
            shareHeading={`A ${vibeWord} kit for ${vehicle ? `my ${vehicle.model}` : forWhom}, within ${formatINR(kitBudget)}`}
            path={path}
          />
        </>
      )}
    </div>
  );
}
