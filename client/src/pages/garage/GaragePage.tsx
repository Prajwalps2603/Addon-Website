import { CircleCheck, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { BoardWord, TreadDivider } from '@/components/brand';
import { PageHeader, ProductRail, SectionHeading, VehiclePickerInline } from '@/components/commerce';
import { Button, Callout, Skeleton } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { useDocumentMeta } from '@/lib/seo';
import { loginPath } from '@/lib/urls';
import { MAX_GARAGE_CARS, useGarage, type GarageCar } from '@/stores/garage';
import { useUi } from '@/stores/ui';
import type { ProductQuery } from '@/types/api';
import { CarPlate } from './parts/CarPlate';
import { CategoryRows } from './parts/CategoryRows';
import { fitsOnCar } from './parts/carText';

const PROMISE = 'Pick your car once. Every part then tells you whether it fits.';

function SyncNote() {
  const { isSignedIn, isPending } = useMe();
  if (isPending) return null;
  return isSignedIn ? (
    <p className="type-small flex items-center gap-1.5 text-muted">
      <CircleCheck aria-hidden className="size-4 shrink-0" />
      Saved to your account, so your cars follow you to any device you sign in on.
    </p>
  ) : (
    <p className="type-small text-muted">
      Saved on this device.{' '}
      <Link to={loginPath('/garage')} className="font-bold text-ink underline underline-offset-4 hover:decoration-2">
        Sign in
      </Link>{' '}
      to keep your cars on your account.
    </p>
  );
}

/** The live reading on the plate of the car in use: how many parts fit, and the way into them. */
function FitReadout({ car, fits, unchecked, loading, failed, onRetry }: {
  car: GarageCar;
  fits: number | undefined;
  unchecked: number;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const studioOpen = useSettings().data?.studio.enabled === true;
  return (
    <div className="grid gap-4 border-t border-line pt-4">
      <div aria-live="polite" className="grid gap-2">
        {loading && fits === undefined ? (
          <>
            <span className="sr-only">Counting the parts that fit</span>
            <Skeleton className="h-11 w-56 max-w-full" />
          </>
        ) : failed && fits === undefined ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Could not count the parts that fit just now.</span>
            <Button variant="link" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <BoardWord text={String(fits ?? 0)} size="md" />
              <span className="type-h3">
                {fits === 1 ? 'part fits' : 'parts fit'} your {car.vehicle.model}
              </span>
            </p>
            {unchecked > 0 && (
              <p className="type-small text-muted">
                {unchecked === 1 ? 'One more part has' : `${unchecked} more parts have`} not been checked on this car yet. Ask us before you buy those.
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button to="/shop?fitOnly=1" size="lg">
          Shop parts that fit
        </Button>
        {studioOpen && (
          <Link to="/book-fitting" className="link type-small font-bold">
            Book a fitting slot at our studio
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyGarage() {
  return (
    <div className="grid gap-8 pb-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div className="grid content-start gap-4">
        <h2 className="type-h2">No car saved yet</h2>
        <p className="max-w-prose text-muted">Choose the make, model and year below. From then on:</p>
        <ul className="grid gap-3 border-t border-line pt-4">
          <li>Every product says whether it fits your car, fits with work, or does not fit.</li>
          <li>Listings can show only the parts for your car with one switch.</li>
          <li>The cart warns you before you pay for a part that will not fit.</li>
        </ul>
        <p className="type-small text-muted">
          Prefer to browse?{' '}
          <Link to="/cars" className="font-bold text-ink underline underline-offset-4 hover:decoration-2">
            See every make and model
          </Link>
        </p>
      </div>
      <VehiclePickerInline className="min-w-0" />
    </div>
  );
}

function useActiveCarShop({ car }: { car: GarageCar }) {
  const query: ProductQuery = { vehicleId: car.vehicleId, fitOnly: '1', sort: 'popular', limit: 12 };
  const { data, isPending, isError, refetch, isPlaceholderData } = useProducts(query);
  const current = isPlaceholderData ? undefined : data;
  const bestSellers = current?.items.filter(fitsOnCar);
  const model = car.vehicle.model;

  return {
    readout: (
      <FitReadout
        car={car}
        fits={current?.facets.fitsCount}
        unchecked={current ? Math.max(0, current.total - current.facets.fitsCount) : 0}
        loading={isPending || isPlaceholderData}
        failed={isError}
        onRetry={() => void refetch()}
      />
    ),
    sections: (
      <>
        <TreadDivider tone="ink" className="my-10 md:my-14" />
        <section aria-labelledby="garage-categories" className="grid gap-5">
          <SectionHeading
            id="garage-categories"
            title={`Shop for your ${model}`}
            description="Each category opens with only the parts for this car."
          />
          {isError && !current ? (
            <Callout tone="warn" title="Could not load the categories for this car" actions={<Button variant="dark" size="sm" onClick={() => void refetch()}>Try again</Button>}>
              Check your connection and try again.
            </Callout>
          ) : (
            <CategoryRows facets={current?.facets.categories} loading={isPending || isPlaceholderData} carName={model} />
          )}
        </section>
        <ProductRail
          className="mt-12 md:mt-16"
          title={`Best sellers that fit your ${model}`}
          description="Ranked by units sold. Each one fits as it is, with the work noted, or is a universal part."
          products={bestSellers}
          loading={isPending || isPlaceholderData}
          seeAll={{ to: '/shop?fitOnly=1&sort=popular', label: 'See all' }}
        />
      </>
    ),
  };
}

function GarageWithCars({ cars, activeId }: { cars: readonly GarageCar[]; activeId: number | null }) {
  const active = cars.find((car) => car.vehicleId === activeId) ?? null;
  const others = cars.filter((car) => car.vehicleId !== activeId);

  return (
    <>
      {!active && (
        <Callout tone="info" title="No car in use" className="mb-4">
          You are browsing without a car, so parts do not show whether they fit. Choose Use this car on one of your cars below.
        </Callout>
      )}
      {active ? <ActiveCarLayout car={active} others={others} /> : <OtherCars cars={others} />}
    </>
  );
}

function OtherCars({ cars }: { cars: readonly GarageCar[] }) {
  if (cars.length === 0) return null;
  return (
    <ul aria-label="Your other cars" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cars.map((car) => (
        <li key={car.vehicleId} className="flex min-w-0">
          <CarPlate car={car} active={false} className="flex-1" />
        </li>
      ))}
    </ul>
  );
}

function ActiveCarLayout({ car, others }: { car: GarageCar; others: readonly GarageCar[] }) {
  const shop = useActiveCarShop({ car });
  return (
    <>
      <div className="grid gap-3">
        <CarPlate car={car} active featured>
          {shop.readout}
        </CarPlate>
        {others.length > 0 && (
          <section aria-labelledby="garage-others" className="mt-6 grid gap-3">
            <h2 id="garage-others" className="type-h3">
              Your other cars
            </h2>
            <OtherCars cars={others} />
          </section>
        )}
      </div>
      {shop.sections}
    </>
  );
}

export default function GaragePage() {
  useDocumentMeta({ title: 'My garage', description: PROMISE });
  const cars = useGarage((state) => state.vehicles);
  const activeId = useGarage((state) => state.activeVehicleId);
  const openPicker = useUi((state) => state.openVehiclePicker);
  const full = cars.length >= MAX_GARAGE_CARS;

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title="My garage"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'My garage' }]}
        description={PROMISE}
        meta={cars.length > 0 ? `${cars.length} of ${MAX_GARAGE_CARS} cars` : undefined}
        actions={
          cars.length > 0 && (
            <div className="grid justify-items-start gap-1">
              <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={openPicker} disabled={full}>
                Add a car
              </Button>
              {full && <p className="type-small text-muted">The garage holds {MAX_GARAGE_CARS} cars. Remove one to add another.</p>}
            </div>
          )
        }
        className="pb-3 md:pb-4"
      />
      <div className="mb-6 md:mb-8">
        <SyncNote />
      </div>
      {cars.length === 0 ? <EmptyGarage /> : <GarageWithCars cars={cars} activeId={activeId} />}
    </div>
  );
}
