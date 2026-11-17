import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { BoardWord, PitBoard, TreadDivider } from '@/components/brand';
import { ErrorState, PageHeader, ProductGrid, SectionHeading, WhatsAppButton } from '@/components/commerce';
import { Button, Chip, EmptyState, RadioGroup, Skeleton, toast } from '@/components/ui';
import { useProducts } from '@/hooks/useProducts';
import { useVehicles } from '@/hooks/useVehicles';
import { api } from '@/lib/api';
import { formatNumber, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { MAX_GARAGE_CARS, useGarage } from '@/stores/garage';
import type { ProductQuery, Vehicle, VehicleModelGroup } from '@/types/api';
import { CarNotFound, slugWords } from './CarNotFound';
import { BODY_SINGULAR, directFirst, findMake, findModel, yearsLabel } from './carText';

const PAGE_SIZE = 24;

/** The generation in the URL, else the one in the garage (the car in use first), else the newest. */
function chooseGeneration(model: VehicleModelGroup, requested: number | null, savedIds: readonly number[], activeId: number | null): Vehicle | null {
  const gens = model.generations;
  if (gens.length === 0) return null;
  const byId = (id: number | null) => (id === null ? undefined : gens.find((gen) => gen.id === id));
  return (
    byId(requested) ??
    byId(activeId) ??
    gens.find((gen) => savedIds.includes(gen.id)) ??
    [...gens].sort((a, b) => b.yearFrom - a.yearFrom)[0] ??
    null
  );
}

function generationName(gen: Vehicle): string {
  return gen.generation || yearsLabel(gen);
}

/** The board: how many parts fit this car, and the one action that makes it the shopper's car. */
function FitBoard({ vehicle, fits, unchecked, loading, failed, onRetry }: {
  vehicle: Vehicle;
  fits: number | undefined;
  unchecked: number;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const activeId = useGarage((state) => state.activeVehicleId);
  const saved = useGarage((state) => state.vehicles.some((car) => car.vehicleId === vehicle.id));
  const garageFull = useGarage((state) => state.vehicles.length >= MAX_GARAGE_CARS);
  const isActive = activeId === vehicle.id;

  const makeMine = () => {
    const garage = useGarage.getState();
    if (saved) garage.setActive(vehicle.id);
    else garage.add(vehicle);
    toast.success(`Showing what fits your ${vehicle.model}`, { id: 'garage' });
  };

  return (
    <PitBoard as="section" aria-label={`Parts that fit the ${vehicle.label}`} title="Parts that fit" className="gap-4 p-4 sm:p-6">
      <div aria-live="polite" className="grid gap-2">
        {loading && fits === undefined ? (
          <>
            <span className="sr-only">Counting the parts that fit</span>
            <Skeleton className="h-14 w-40" />
          </>
        ) : failed && fits === undefined ? (
          <p className="flex flex-wrap items-center gap-x-3">
            <span>Could not count the parts just now.</span>
            <Button variant="link" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <BoardWord text={String(fits ?? 0)} tone="brand" size="lg" />
            <span className="type-h3">
              {fits === 1 ? 'part fits' : 'parts fit'} the {vehicle.model} <span className="tnum">({yearsLabel(vehicle)})</span>
            </span>
          </p>
        )}
        {unchecked > 0 && (
          <p className="type-small text-muted">
            {unchecked === 1 ? 'One more part has' : `${formatNumber(unchecked)} more parts have`} not been checked on this car yet. Their cards say so, with a way to ask us.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        {isActive ? (
          <>
            <p className="flex items-center gap-2 font-bold">
              <Check aria-hidden className="size-5" />
              This is your car. Every part on the site shows its fit for it.
            </p>
            <Link to="/garage" className="type-small font-bold underline underline-offset-4 hover:decoration-2">
              Manage my garage
            </Link>
          </>
        ) : !saved && garageFull ? (
          <p className="type-small">
            Your garage holds {MAX_GARAGE_CARS} cars.{' '}
            <Link to="/garage" className="font-bold underline underline-offset-4 hover:decoration-2">
              Remove one in My garage
            </Link>{' '}
            to add this car.
          </p>
        ) : (
          <>
            <Button size="lg" onClick={makeMine}>
              Make this my car
            </Button>
            <p className="type-small text-muted">
              {saved ? 'It is in your garage. This switches fit checks to it.' : 'Saves it to your garage and checks every part against it.'}
            </p>
          </>
        )}
      </div>
    </PitBoard>
  );
}

function ModelSkeleton() {
  return (
    <div aria-hidden className="grid gap-8">
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-24" />
        ))}
      </div>
    </div>
  );
}

function FittingParts({ vehicle, categoryFacets, totalAll }: {
  vehicle: Vehicle;
  categoryFacets: { slug: string; name: string; count: number }[] | undefined;
  totalAll: number | undefined;
}) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('category') ?? '';
  const category = categoryFacets?.some((facet) => facet.slug === requested) ? requested : '';

  const setCategory = (slug: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (slug) next.set('category', slug);
        else next.delete('category');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const base: ProductQuery = { vehicleId: vehicle.id, fitOnly: '1', category: category || undefined, limit: PAGE_SIZE };
  const listing = useInfiniteQuery({
    queryKey: [...queryKeys.products.list(base), 'pages'] as const,
    queryFn: ({ pageParam, signal }) => api.products.list({ ...base, page: pageParam }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  // Each page is ordered direct fits first on its own, so "Show more" only ever adds below.
  const products = useMemo(() => listing.data?.pages.flatMap((page) => directFirst(page.items)), [listing.data]);
  const total = listing.data?.pages[0]?.total ?? 0;
  const shown = products?.length ?? 0;
  const model = vehicle.model;

  return (
    <section aria-labelledby="fitting-parts" className="grid gap-6">
      <SectionHeading
        id="fitting-parts"
        title={`Parts that fit the ${model}`}
        description="Direct fits first, then parts that fit with some work, then universal parts."
      />

      {categoryFacets && categoryFacets.length > 0 && (
        <div role="group" aria-label="Filter by category" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:px-0">
          <Chip selected={category === ''} count={totalAll} onClick={() => setCategory('')}>
            All parts
          </Chip>
          {categoryFacets.map((facet) => (
            <Chip key={facet.slug} selected={category === facet.slug} count={facet.count} onClick={() => setCategory(category === facet.slug ? '' : facet.slug)}>
              {facet.name}
            </Chip>
          ))}
        </div>
      )}

      {listing.error && !listing.data ? (
        <ErrorState error={listing.error} onRetry={() => void listing.refetch()} title="Could not load the parts for this car" />
      ) : (
        <ProductGrid
          products={products}
          loading={listing.isPending}
          updating={listing.isPlaceholderData}
          skeletons={8}
          vehicle={vehicle}
          compare
          label={`Parts that fit the ${vehicle.label}`}
          empty={
            <EmptyState
              title={category ? 'Nothing in this category for this car yet' : `No parts listed for the ${model} yet`}
              description="We add parts for more cars every week. Ask us and we will check what suits yours."
              actions={
                <>
                  {category ? (
                    <Button variant="dark" onClick={() => setCategory('')}>
                      Show all parts
                    </Button>
                  ) : (
                    <Button variant="dark" to="/shop">
                      Browse the shop
                    </Button>
                  )}
                  <WhatsAppButton text={`Hi, which parts do you have for a ${vehicle.label}?`}>Ask us about your car</WhatsAppButton>
                </>
              }
            />
          }
        />
      )}

      {shown > 0 && (
        <div className="grid justify-items-start gap-3 border-t border-line pt-6 sm:flex sm:items-center sm:justify-between">
          <p aria-live="polite" className="type-small text-muted tnum">
            Showing {formatNumber(shown)} of {pluralize(total, 'part')}
          </p>
          {listing.hasNextPage && (
            <Button variant="outline" loading={listing.isFetchingNextPage} onClick={() => void listing.fetchNextPage()}>
              Show more parts
            </Button>
          )}
          {listing.isFetchNextPageError && <p className="type-small text-stop">Could not load more. Press Show more parts to try again.</p>}
        </div>
      )}
    </section>
  );
}

/** /cars/:make/:model: choose the generation, then every part that fits it. */
export function ModelView({ makeSlug, modelSlug }: { makeSlug: string; modelSlug: string }) {
  const { data: makes, isPending, error, refetch } = useVehicles();
  const [params, setParams] = useSearchParams();
  const savedIds = useGarage((state) => state.vehicles.map((car) => car.vehicleId).join(','));
  const activeId = useGarage((state) => state.activeVehicleId);

  const make = findMake(makes, makeSlug);
  const model = findModel(make, modelSlug);
  const requestedGen = Number(params.get('gen')) || null;
  const vehicle = model
    ? chooseGeneration(model, requestedGen, savedIds ? savedIds.split(',').map(Number) : [], activeId)
    : null;

  const makeName = make?.name ?? slugWords(makeSlug);
  const modelName = model?.name ?? slugWords(modelSlug);
  const loaded = !isPending && !error;
  const missingMake = loaded && !make;
  const missingModel = loaded && make !== null && !model;
  const fullName = `${makeName} ${modelName}`;

  useDocumentMeta({
    title: missingMake || missingModel ? 'Car not found' : `${fullName} accessories and parts`,
    description:
      vehicle && model
        ? `Accessories and parts that fit the ${make?.name} ${model.name}, ${model.generations.map((gen) => yearsLabel(gen)).join(' and ')}. Each one says whether it fits as it is or needs work.`
        : undefined,
  });

  const summaryQuery: ProductQuery = { vehicleId: vehicle?.id, fitOnly: '1', limit: 1 };
  const summary = useProducts(summaryQuery, { enabled: vehicle !== null });
  const current = summary.isPlaceholderData ? undefined : summary.data;

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Cars', to: '/cars' },
    { label: makeName, to: `/cars/${make?.slug ?? makeSlug}` },
    { label: modelName },
  ];

  if (error) {
    return (
      <div className="container-page pb-16">
        <PageHeader title={fullName} breadcrumbs={crumbs} />
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the list of cars" />
      </div>
    );
  }

  if (missingMake || missingModel) {
    return (
      <div className="container-page pb-16">
        <PageHeader title="Car not found" breadcrumbs={missingMake ? [crumbs[0], crumbs[1], { label: 'Not found' }] : [crumbs[0], crumbs[1], crumbs[2], { label: 'Not found' }]} />
        {missingMake ? (
          <CarNotFound
            title={`We do not list ${makeName || 'that make'}`}
            description="The link may be wrong, or we have not added this make yet. Pick from every make we list."
            back={{ to: '/cars', label: 'See every make' }}
            asked={fullName}
          />
        ) : (
          <CarNotFound
            title={`We do not list the ${fullName}`}
            description="The link may be wrong, or we have not added this model yet. Every model we list for this make is one tap away."
            back={{ to: `/cars/${make?.slug ?? makeSlug}`, label: `See every ${makeName} model` }}
            asked={fullName}
          />
        )}
      </div>
    );
  }

  const chooseGen = (id: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('gen', id);
        next.delete('category');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  const topFacets = current?.facets.categories.filter((facet) => facet.parentSlug === null && facet.count > 0);

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title={fullName}
        breadcrumbs={crumbs}
        meta={model ? `${BODY_SINGULAR[model.bodyType]}, ${pluralize(model.generations.length, 'generation')}` : undefined}
      />

      {isPending || !model || !vehicle ? (
        <ModelSkeleton />
      ) : (
        <div className="grid gap-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
            {model.generations.length > 1 ? (
              <RadioGroup
                legend="Which generation is yours?"
                variant="card"
                value={String(vehicle.id)}
                onChange={chooseGen}
                options={model.generations.map((gen) => ({
                  value: String(gen.id),
                  label: generationName(gen),
                  description: gen.generation ? <span className="tnum">{yearsLabel(gen)}</span> : undefined,
                }))}
              />
            ) : (
              <div className="grid content-start gap-1">
                <p className="type-label text-muted">Generation</p>
                <p className="font-bold">{generationName(vehicle)}</p>
                <p className="text-muted tnum">{yearsLabel(vehicle)}</p>
              </div>
            )}
            <FitBoard
              vehicle={vehicle}
              fits={current?.facets.fitsCount}
              unchecked={current ? Math.max(0, current.total - current.facets.fitsCount) : 0}
              loading={summary.isPending || summary.isPlaceholderData}
              failed={summary.isError}
              onRetry={() => void summary.refetch()}
            />
          </div>
          <TreadDivider tone="ink" className="my-2" />
          <FittingParts key={vehicle.id} vehicle={vehicle} categoryFacets={topFacets} totalAll={current?.total} />
        </div>
      )}
    </div>
  );
}
