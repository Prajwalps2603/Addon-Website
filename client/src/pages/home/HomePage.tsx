import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TreadDivider } from '@/components/brand';
import { ErrorState, ProductRail } from '@/components/commerce';
import { Button, EmptyState } from '@/components/ui';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { CategoryTiles } from './parts/CategoryTiles';
import { DropBoard } from './parts/DropBoard';
import { AnnouncementTicker } from '@/components/layout/AnnouncementTicker';
import { HomeHero } from './parts/HomeHero';
import { PromoBanners } from './parts/PromoBanners';
import { StoreFacts } from './parts/StoreFacts';
import { StraightLabelExplainer } from './parts/StraightLabelExplainer';
import { StudioBand } from './parts/StudioBand';
import { StudioWork } from './parts/StudioWork';
import { ToolsBand } from './parts/ToolsBand';

export default function HomePage() {
  useDocumentMeta({
    description:
      'Car accessories for Indian cars, fitted at our studio. Choose your car and every part says whether it fits, what fitting costs and when to skip it.',
  });

  const car = useActiveCar();
  const vehicleId = car?.vehicleId ?? null;
  const settings = useSettings();

  // One request for everything below the hero. The hero itself never waits for it.
  const home = useQuery({
    queryKey: queryKeys.home(vehicleId),
    queryFn: ({ signal }) => api.catalog.home(vehicleId === null ? {} : { vehicleId }, { signal }),
    placeholderData: keepPreviousData,
  });

  const data = home.data;
  const loading = home.isPending;
  // While a newly chosen car loads, the previous answer stays up; its car-specific rail does not.
  const switchingCar = home.isPlaceholderData;

  return (
    <>
      <HomeHero car={car} />
      <AnnouncementTicker />

      {car && (
        <div className="container-page pt-[clamp(2rem,5vw,3.5rem)]">
          {!loading && !switchingCar && !home.error && data && data.forYourCar.length === 0 ? (
            <EmptyState
              size="sm"
              art={null}
              title={`No parts matched to the ${car.vehicle.model} yet`}
              description="Universal parts still fit. Browse the shop, or ask us about a part from its page and we will check it for your car."
              actions={
                <Button to="/shop?fitOnly=1" variant="dark">
                  Show what fits
                </Button>
              }
            />
          ) : (
            <ProductRail
              title={`Fits your ${car.vehicle.model}`}
              description={car.vehicle.label}
              products={switchingCar ? undefined : data?.forYourCar}
              loading={loading || switchingCar}
              seeAll={{ to: '/shop?fitOnly=1', label: 'Everything that fits' }}
            />
          )}
        </div>
      )}

      {home.error && !data ? (
        <div className="container-page section-y">
          <ErrorState error={home.error} title="Could not load the shop" onRetry={() => void home.refetch()} />
        </div>
      ) : (
        <>
          <CategoryTiles categories={data?.categories} loading={loading} />

          {data?.drop && data.drop.items.length > 0 && <DropBoard drop={data.drop} />}

          <div className="container-page">
            <TreadDivider tone="line" size="sm" />
          </div>
        </>
      )}

      <StudioBand settings={settings.data} />

      <StudioWork settings={settings.data} />

      <ToolsBand />

      {!(home.error && !data) && (
        <>
          <section aria-label="Products" className="section-y border-t border-line">
            <div className="container-page grid gap-[clamp(3rem,7vw,5rem)]">
              <ProductRail
                title="Featured"
                products={data?.featured}
                loading={loading}
                seeAll={{ to: '/shop?featured=1' }}
              />
              <ProductRail
                title="New arrivals"
                products={data?.newArrivals}
                loading={loading}
                seeAll={{ to: '/shop?isNew=1&sort=newest' }}
              />
              <ProductRail
                title="Best sellers"
                products={data?.bestSellers}
                loading={loading}
                seeAll={{ to: '/shop?sort=popular' }}
              />
            </div>
          </section>

          {data && <StraightLabelExplainer products={data.featured.length > 0 ? data.featured : data.bestSellers} />}

        </>
      )}

      <PromoBanners promos={settings.data?.promos ?? []} />

      <StoreFacts settings={settings.data} />
    </>
  );
}
