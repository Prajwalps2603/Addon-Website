import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { Button, Input, Skeleton } from '@/components/ui';
import { useVehicles } from '@/hooks/useVehicles';
import { cn } from '@/lib/cn';
import type { BodyType, Vehicle, VehicleMake, VehicleModelGroup } from '@/types/api';
import { ErrorState } from './ErrorState';

type Step = 'make' | 'model' | 'generation' | 'year';

export interface VehicleStepsProps {
  /** Called once a car is chosen. `year` is null when the shopper skipped it. */
  onDone: (vehicle: Vehicle, year: number | null) => void;
  /** Lays the three slots in one row from 768 px. Leave off in a narrow panel. */
  wide?: boolean;
  className?: string;
}

const BODY_LABELS: Record<BodyType, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  muv: 'MUV',
  pickup: 'Pickup',
  coupe: 'Coupe',
};


/** Past this many options a list gets a filter box. */
const FILTER_FROM = 8;

/** '2018 to 2024', '2024 onwards', or '2019' for a single year. */
function yearsOf(vehicle: Vehicle): string {
  if (vehicle.yearTo === null) return `${vehicle.yearFrom} onwards`;
  return vehicle.yearTo === vehicle.yearFrom ? String(vehicle.yearFrom) : `${vehicle.yearFrom} to ${vehicle.yearTo}`;
}

/** Every model year of a generation, newest first. A generation still on sale runs to this year. */
function modelYears(vehicle: Vehicle): number[] {
  const last = Math.max(vehicle.yearFrom, vehicle.yearTo ?? new Date().getFullYear());
  return Array.from({ length: last - vehicle.yearFrom + 1 }, (_, index) => last - index);
}

/** True when every word typed appears somewhere in the text. */
function matches(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const STEP_TITLES: Record<Step, string> = {
  make: 'Choose the make',
  model: 'Choose the model',
  generation: 'Choose the years it was sold',
  year: 'Which year is yours?',
};

function Option({ title, aside, onClick }: { title: ReactNode; aside?: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="focus-ring-inset flex min-h-12 w-full items-center justify-between gap-3 border-b border-line px-2 py-2 text-left transition-colors dur-quick hover:bg-surface-2"
      >
        <span className="min-w-0 font-bold">{title}</span>
        <span className="flex shrink-0 items-center gap-2 text-muted">
          {aside && <span className="type-small">{aside}</span>}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </button>
    </li>
  );
}

function Tile({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="focus-ring flex min-h-11 w-full items-center justify-center rounded-control border border-line bg-page px-2 py-2 text-center text-sm leading-tight font-medium transition-colors dur-quick hover:border-brand hover:text-brand-text"
      >
        {children}
      </button>
    </li>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-0.5 pt-4 pb-2 type-small font-bold text-muted first:pt-0">{children}</p>;
}

/** One of the three choices at the top: a light field that reads back the answer, outlined when it is the step in hand. */
function StepField({
  label,
  value,
  current,
  disabled,
  onClick,
  className,
}: {
  label: string;
  value: string | null | undefined;
  current: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? 'step' : undefined}
      className={cn(
        'focus-ring grid min-h-14 min-w-0 content-center gap-0.5 rounded-control border bg-page px-3 py-2 text-left transition-colors dur-quick',
        current ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong',
        disabled && 'cursor-not-allowed bg-surface opacity-60',
        className,
      )}
    >
      <span className="text-xs text-muted">{label}</span>
      <span className={cn('truncate text-sm font-bold', !value && 'font-normal text-muted')}>{value || 'Select'}</span>
    </button>
  );
}

/**
 * The make, model and year selector: three board slots that show what has been chosen, and under
 * them the list for the step in hand. Shared by the car picker drawer and the inline picker in the home hero.
 * Steps with one possible answer are taken for the shopper, so most cars need three or four taps.
 */
export function VehicleSteps({ onDone, wide = false, className }: VehicleStepsProps) {
  const { data: makes, isPending, error, refetch } = useVehicles();
  const [step, setStep] = useState<Step>('make');
  const [makeSlug, setMakeSlug] = useState<string | null>(null);
  const [modelSlug, setModelSlug] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const region = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const moved = useRef(false);

  const make = makes?.find((entry) => entry.slug === makeSlug) ?? null;
  const model = make?.models.find((entry) => entry.slug === modelSlug) ?? null;
  const vehicle = model?.generations.find((entry) => entry.id === vehicleId) ?? null;

  // After a choice the list is replaced: hand focus to the new list so keyboard and screen reader users follow it.
  useEffect(() => {
    if (moved.current) region.current?.focus({ preventScroll: true });
  }, [step]);

  const go = (next: Step) => {
    moved.current = true;
    setFilter('');
    setStep(next);
  };

  const pickGeneration = (chosen: Vehicle) => {
    const years = modelYears(chosen);
    if (years.length === 1) {
      onDone(chosen, years[0] ?? null);
      return;
    }
    setVehicleId(chosen.id);
    go('year');
  };

  const pickModel = (ofMake: VehicleMake, chosen: VehicleModelGroup) => {
    setMakeSlug(ofMake.slug);
    setModelSlug(chosen.slug);
    setVehicleId(null);
    const only = chosen.generations.length === 1 ? chosen.generations[0] : undefined;
    if (only) pickGeneration(only);
    else go('generation');
  };

  const pickMake = (chosen: VehicleMake) => {
    setMakeSlug(chosen.slug);
    setModelSlug(null);
    setVehicleId(null);
    const only = chosen.models.length === 1 ? chosen.models[0] : undefined;
    if (only) pickModel(chosen, only);
    else go('model');
  };

  // The step actually on screen: a later step falls back to an earlier one while its answer is missing.
  let shown: Step = 'make';
  let list: ReactNode;
  let filterable = false;

  if (isPending) {
    list = (
      <div role="status" className="grid gap-2">
        <span className="sr-only">Loading the list of cars</span>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (error || !makes) {
    list = <ErrorState size="sm" error={error} title="Could not load the list of cars" onRetry={() => void refetch()} />;
  } else if (step === 'make' || !make) {
    filterable = true;
    const query = filter.trim();
    if (query) {
      const foundMakes = makes.filter((entry) => matches(entry.name, query));
      const foundModels = makes.flatMap((ofMake) =>
        ofMake.models.filter((entry) => matches(`${ofMake.name} ${entry.name}`, query)).map((entry) => ({ ofMake, entry })),
      );
      list =
        foundMakes.length + foundModels.length === 0 ? (
          <NoMatch query={query} onClear={() => setFilter('')} />
        ) : (
          <>
            {foundModels.length > 0 && (
              <>
                <GroupLabel>Models</GroupLabel>
                <ul>
                  {foundModels.slice(0, 30).map(({ ofMake, entry }) => (
                    <Option
                      key={`${ofMake.slug}/${entry.slug}`}
                      title={entry.name}
                      aside={ofMake.name}
                      onClick={() => pickModel(ofMake, entry)}
                    />
                  ))}
                </ul>
              </>
            )}
            {foundMakes.length > 0 && (
              <>
                <GroupLabel>Makes</GroupLabel>
                <ul>
                  {foundMakes.map((entry) => (
                    <Option key={entry.slug} title={entry.name} onClick={() => pickMake(entry)} />
                  ))}
                </ul>
              </>
            )}
          </>
        );
    } else {
      const popular = makes.filter((entry) => entry.isPopular);
      const others = popular.length > 0 ? makes.filter((entry) => !entry.isPopular) : makes;
      list = (
        <>
          {popular.length > 0 && (
            <>
              <GroupLabel>Popular makes</GroupLabel>
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {popular.map((entry) => (
                  <Tile key={entry.slug} onClick={() => pickMake(entry)}>
                    {entry.name}
                  </Tile>
                ))}
              </ul>
            </>
          )}
          {others.length > 0 && (
            <>
              {popular.length > 0 && <GroupLabel>Other makes</GroupLabel>}
              <ul>
                {others.map((entry) => (
                  <Option key={entry.slug} title={entry.name} onClick={() => pickMake(entry)} />
                ))}
              </ul>
            </>
          )}
        </>
      );
    }
  } else if (step === 'model' || !model) {
    shown = 'model';
    filterable = make.models.length > FILTER_FROM;
    const query = filter.trim();
    const found = query ? make.models.filter((entry) => matches(entry.name, query)) : make.models;
    list =
      found.length === 0 ? (
        <NoMatch query={query} onClear={() => setFilter('')} />
      ) : (
        <ul>
          {found.map((entry) => (
            <Option key={entry.slug} title={entry.name} aside={BODY_LABELS[entry.bodyType]} onClick={() => pickModel(make, entry)} />
          ))}
        </ul>
      );
  } else if (step === 'generation' || !vehicle) {
    shown = 'generation';
    list = (
      <ul>
        {model.generations.map((entry) => (
          <Option key={entry.id} title={<span className="tnum">{yearsOf(entry)}</span>} aside={entry.generation} onClick={() => pickGeneration(entry)} />
        ))}
      </ul>
    );
  } else {
    shown = 'year';
    list = (
      <div className="grid gap-3">
        <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {modelYears(vehicle).map((year) => (
            <Tile key={year} onClick={() => onDone(vehicle, year)}>
              <span className="tnum">{year}</span>
            </Tile>
          ))}
        </ul>
        <Button variant="outline" onClick={() => onDone(vehicle, null)} className="justify-self-start">
          Not sure, skip the year
        </Button>
      </div>
    );
  }

  const title =
    shown === 'model' && make ? `Choose the ${make.name} model` : shown === 'year' && model ? `Which year is your ${model.name}?` : STEP_TITLES[shown];

  const slots = (
    <div className="grid grid-cols-3 gap-2">
      <StepField label="Make" value={make?.name} current={shown === 'make'} onClick={() => go('make')} />
      <StepField label="Model" value={model?.name} disabled={!make} current={shown === 'model'} onClick={() => go('model')} />
      <StepField
        label="Year"
        value={vehicle ? yearsOf(vehicle) : null}
        disabled={!model}
        current={shown === 'generation' || shown === 'year'}
        onClick={() => go(model && model.generations.length > 1 ? 'generation' : 'year')}
      />
    </div>
  );

  return (
    <div className={cn('grid min-w-0 gap-4', className)}>
      {slots}

      <div ref={region} tabIndex={-1} role="group" aria-labelledby={titleId} className="grid min-w-0 gap-3 outline-hidden">
        <p id={titleId} className="font-bold">
          {title}
        </p>
        {filterable && (
          <Input
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            aria-label={shown === 'make' ? 'Search makes and models' : `Search ${make?.name ?? ''} models`}
            placeholder={shown === 'make' ? 'Search makes and models' : 'Search models'}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            leading={<Search aria-hidden />}
          />
        )}
        <div className="min-w-0">{list}</div>
      </div>
    </div>
  );
}

function NoMatch({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="grid justify-items-start gap-2 px-2 py-4">
      <p className="font-bold">No car matches "{query}"</p>
      <p className="type-small text-muted">Check the spelling, or search by the model name alone. If your car is not listed, ask us and we will add it.</p>
      <Button variant="outline" size="sm" onClick={onClear} iconLeft={<X aria-hidden />}>
        Clear search
      </Button>
    </div>
  );
}
