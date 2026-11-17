import { ArrowRight, CarFront, Check } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Skeleton } from '@/components/ui';
import { useVehicles } from '@/hooks/useVehicles';
import { pluralize } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useGarage } from '@/stores/garage';
import type { BodyType, VehicleModelGroup } from '@/types/api';
import { CarNotFound, slugWords } from './CarNotFound';
import { BODY_ORDER, BODY_PLURAL, carPath, findMake, modelPath, yearsLabel } from './carText';

function ModelEntry({ makeSlug, makeName, model, savedIds }: {
  makeSlug: string;
  makeName: string;
  model: VehicleModelGroup;
  savedIds: ReadonlySet<number>;
}) {
  const saved = model.generations.some((gen) => savedIds.has(gen.id));
  const several = model.generations.length > 1;
  return (
    <li className="group/model grid content-start gap-3 rounded-[20px] bg-surface p-3 transition-colors duration-200 hover:bg-surface-2">
      <Link to={modelPath(makeSlug, model.slug)} className="focus-ring flex items-center gap-3 rounded-[14px] px-2 pt-2">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-raised text-ink transition-colors duration-200 group-hover/model:bg-brand group-hover/model:text-brand-ink">
          <CarFront className="size-5" />
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-xl leading-tight font-bold">
            {model.name}
            <span className="sr-only"> ({makeName})</span>
          </span>
          <span className="text-xs text-muted">
            {saved ? (
              <span className="inline-flex items-center gap-1 font-bold text-fit">
                <Check aria-hidden className="size-3.5" />
                In your garage
              </span>
            ) : (
              pluralize(model.generations.length, 'generation')
            )}
          </span>
        </span>
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-raised transition-transform duration-200 group-hover/model:translate-x-0.5">
          <ArrowRight className="size-4" />
        </span>
      </Link>
      <ul aria-label={`${model.name} generations`} className="grid gap-1 rounded-[14px] bg-raised p-1.5">
        {model.generations.map((gen) => {
          const inner = (
            <>
              <span className="font-semibold">{gen.generation || (several ? 'Generation' : 'One generation')}</span>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted tnum">{yearsLabel(gen)}</span>
            </>
          );
          const row = 'flex min-h-10 items-center justify-between gap-3 rounded-[10px] px-2.5 text-sm';
          return (
            <li key={gen.id}>
              {several ? (
                <Link to={carPath(gen)} className={`focus-ring ${row} transition-colors hover:bg-surface`}>
                  {inner}
                </Link>
              ) : (
                <p className={row}>{inner}</p>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function MakeSkeleton() {
  return (
    <div aria-hidden className="grid gap-10">
      {Array.from({ length: 2 }, (_, group) => (
        <div key={group} className="grid gap-4">
          <Skeleton className="h-8 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-44 rounded-[20px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** /cars/:make: the make's models grouped by body type, each with its generations and years. */
export function MakeView({ makeSlug }: { makeSlug: string }) {
  const { data: makes, isPending, error, refetch } = useVehicles();
  const make = findMake(makes, makeSlug);
  const cars = useGarage((state) => state.vehicles);
  const savedIds = new Set(cars.map((car) => car.vehicleId));
  const name = make?.name ?? slugWords(makeSlug);
  const missing = !isPending && !error && !make;

  useDocumentMeta({
    title: missing ? 'Car not found' : `${name} accessories and parts`,
    description: make
      ? `Accessories and parts for every ${make.name} we list: ${make.models.map((model) => model.name).join(', ')}. Choose your model to see what fits.`
      : undefined,
  });

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Cars', to: '/cars' },
    { label: name },
  ];

  if (error) {
    return (
      <div className="container-page pb-16">
        <PageHeader title={name} breadcrumbs={crumbs} />
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the list of cars" />
      </div>
    );
  }

  if (missing) {
    return (
      <div className="container-page pb-16">
        <PageHeader title="Car not found" breadcrumbs={[crumbs[0], crumbs[1], { label: 'Not found' }]} />
        <CarNotFound
          title={`We do not list ${name || 'that make'}`}
          description="The link may be wrong, or we have not added this make yet. Pick from every make we list, or search by model."
          back={{ to: '/cars', label: 'See every make' }}
          asked={name || 'car'}
        />
      </div>
    );
  }

  const groups: { body: BodyType; models: VehicleModelGroup[] }[] = make
    ? BODY_ORDER.map((body) => ({ body, models: make.models.filter((model) => model.bodyType === body) })).filter(
        (group) => group.models.length > 0,
      )
    : [];

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title={name}
        breadcrumbs={crumbs}
        meta={make ? pluralize(make.models.length, 'model') : undefined}
        description="Choose your model to see only the parts that fit it."
      />
      {isPending || !make ? (
        <MakeSkeleton />
      ) : (
        <div className="grid gap-10 md:gap-12">
          {groups.map((group) => (
            <section key={group.body} aria-labelledby={`body-${group.body}`} className="grid gap-4">
              <div className="flex items-center gap-3">
                <h2 id={`body-${group.body}`} className="type-h3 italic uppercase">
                  {BODY_PLURAL[group.body]}
                </h2>
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted tnum">{pluralize(group.models.length, 'model')}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.models.map((model) => (
                  <ModelEntry key={model.slug} makeSlug={make.slug} makeName={make.name} model={model} savedIds={savedIds} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
