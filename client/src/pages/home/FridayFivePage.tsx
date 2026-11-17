import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  AddToCartButton,
  DemoBadge,
  ErrorState,
  FitBadge,
  ProductFrame,
  ProductGrid,
  SectionHeading,
  StockNote,
  StraightLabelChips,
} from '@/components/commerce';
import { Button, Countdown, EmptyState, Skeleton, SkeletonText } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Drop } from '@/types/api';
import { refreshAfterDrop } from './parts/dropRefresh';

type DropItem = Drop['items'][number];

export default function FridayFivePage() {
  const vehicle = useActiveVehicle();
  const vehicleId = vehicle?.id ?? null;

  const dropQuery = useQuery({
    queryKey: queryKeys.drop(vehicleId),
    queryFn: ({ signal }) => api.catalog.currentDrop(vehicleId === null ? {} : { vehicleId }, { signal }),
  });
  const drop = dropQuery.data && dropQuery.data.items.length > 0 ? dropQuery.data : null;

  useDocumentMeta({
    title: drop ? drop.title || 'The Friday Five' : 'The Friday Five',
    description: drop?.note || 'A short, dated price drop on up to five parts, each with the reason it was picked and its price history.',
  });

  if (dropQuery.isPending) return <DropSkeleton />;
  if (dropQuery.error) {
    return (
      <div className="container-page section-y">
        <ErrorState error={dropQuery.error} title="Could not load the Friday Five" onRetry={() => void dropQuery.refetch()} />
      </div>
    );
  }
  if (!drop) return <NoDrop />;
  return <LiveDrop drop={drop} vehicleId={vehicleId} />;
}

/* ------------------------------------------------------------------ live drop */

function LiveDrop({ drop, vehicleId }: { drop: Drop; vehicleId: number | null }) {
  const queryClient = useQueryClient();
  const settings = useSettings().data;

  // Each item's detail says whether it is sample data, for the Sample note.
  // Same keys as the product page, so opening a product afterwards is instant.
  const details = useQueries({
    queries: drop.items.map((item) => ({
      queryKey: queryKeys.products.detail(item.product.slug, vehicleId),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.products.get(item.product.slug, vehicleId === null ? {} : { vehicleId }, { signal }),
    })),
  });

  const allSample = details.length > 0 && details.every((detail) => detail.data?.isDemo === true);
  const title = drop.title.trim() || 'The Friday Five';

  return (
    <>
      <header className="plane-board">
        <div className="container-page grid gap-8 py-[clamp(2rem,6vw,4rem)] lg:grid-cols-12 lg:items-end">
          <div className="grid gap-4 lg:col-span-7">
            <h1 className="type-h1 break-words">
              The Friday Five
              {settings?.hasDemoData && allSample && <DemoBadge className="ml-3 align-middle" />}
            </h1>
            {title.toLowerCase() !== 'the friday five' && <p className="type-h3">{title}</p>}
            {drop.note && <p className="type-lead max-w-prose">{drop.note}</p>}
            <p className="type-small text-muted tnum">
              Runs {formatDateTime(drop.startsAt)} to {formatDateTime(drop.endsAt)}. Prices include GST and go back to normal when it ends.
            </p>
          </div>
          <div className="lg:col-span-5 lg:justify-self-end">
            <Countdown to={drop.endsAt} label="This drop ends in" onEnd={() => refreshAfterDrop(queryClient)} />
          </div>
        </div>
      </header>

      <div className="container-page pb-[clamp(2.5rem,7vw,5rem)]">
        <ol aria-label={`${drop.items.length} parts in this drop`} className="grid">
          {drop.items.map((item, index) => (
            <DropItemRow key={item.product.id} item={item} eager={index === 0} />
          ))}
        </ol>
      </div>
    </>
  );
}

interface DropItemRowProps {
  item: DropItem;
  eager: boolean;
}

function DropItemRow({ item, eager }: DropItemRowProps) {
  const { product } = item;
  const before = product.regularPrice > product.price ? product.regularPrice : 0;
  const saving = before > 0 ? before - product.price : 0;
  const headingId = `drop-item-${product.id}`;

  return (
    <li className="border-b border-line py-[clamp(2rem,5vw,3.5rem)]">
      <article aria-labelledby={headingId} className="grid gap-6 md:grid-cols-12 md:items-start md:gap-8">
        <Link to={`/p/${product.slug}`} tabIndex={-1} aria-hidden className="mx-auto w-full max-w-64 md:col-span-3 md:max-w-none">
          <ProductFrame
            image={product.image}
            alt={product.name}
            artKind={product.artKind}
            variant="full"
            eager={eager}
            sizes="(min-width: 48rem) 22vw, 16rem"
            muted={!product.inStock}
            className="rounded-[14px] border border-line"
          />
        </Link>

        <div className="grid min-w-0 content-start gap-6 md:col-span-9 lg:grid-cols-9">
          <div className="grid content-start gap-4 lg:col-span-6">
            <div className="grid gap-1">
              {product.brand && <p className="type-small text-muted">{product.brand}</p>}
              <h2 id={headingId} className="type-title">
                <Link to={`/p/${product.slug}`} className="underline-offset-4 hover:underline">
                  {product.name}
                </Link>
              </h2>
            </div>

            {item.reason && (
              <div className="grid gap-1 border-t border-ink pt-3">
                <p className="type-small font-bold">Why it is in the five</p>
                <p className="type-lead">{item.reason}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <FitBadge product={product} />
              <StraightLabelChips product={product} />
            </div>
          </div>

          <div className="grid content-start gap-4 rounded-[20px] bg-surface p-5 lg:col-span-3">
            <div className="grid gap-2 tnum">
              <p className="text-xs font-bold tracking-[0.12em] text-muted uppercase">Drop price</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="type-price-xl">{formatINR(product.price)}</span>
                {item.percentOff > 0 && (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">-{item.percentOff}%</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {before > 0 && <s className="text-muted">{formatINR(before)}</s>}
                {saving > 0 && <span className="rounded-full bg-fit/12 px-2.5 py-0.5 font-bold text-fit">You save {formatINR(saving)}</span>}
              </div>
              <p className="text-xs text-muted">
                {product.mrp > product.price ? `MRP ${formatINR(product.mrp)} · ` : ''}Inclusive of all taxes
              </p>
            </div>

            {before > 0 && (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[14px] bg-raised p-3 tnum">
                <div className="grid gap-0.5">
                  <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-muted uppercase">Old price</span>
                  <span className="relative justify-self-start text-lg font-bold text-muted">
                    <span className="sr-only">Was </span>
                    {formatINR(before)}
                    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute -inset-x-1 inset-y-0.5 h-[calc(100%-0.25rem)] w-[calc(100%+0.5rem)] text-brand">
                      <path d="M4 8 L96 92 M96 8 L4 92" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
                    </svg>
                  </span>
                </div>
                <span aria-hidden className="grid size-8 place-items-center rounded-full bg-surface text-brand-text">
                  →
                </span>
                <div className="grid justify-items-end gap-0.5 text-right">
                  <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-brand-text uppercase">Offer price</span>
                  <span className="text-lg font-bold text-ink">{formatINR(product.price)}</span>
                </div>
              </div>
            )}

            <div className="grid gap-2.5">
              {product.hasVariants || product.customKind ? (
                <Button to={`/p/${product.slug}`} variant="dark" block className="rounded-full">
                  Choose options
                </Button>
              ) : (
                <AddToCartButton productId={product.id} productName={product.name} tone="dark" block disabled={!product.inStock} className="rounded-full" />
              )}
              <StockNote stock={product.stock} inStock={product.inStock} lowStock={product.lowStock} variant="full" />
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

/* ------------------------------------------------------------------ between drops */

function NoDrop() {
  const recent = useProducts({ isNew: '1', sort: 'newest', limit: 8 });

  return (
    <>
      <header className="container-page grid gap-4 pt-[clamp(2rem,6vw,4rem)] pb-8">
        <h1 className="type-h1">The Friday Five</h1>
        <div className="grid max-w-prose gap-3">
          <p className="type-lead">
            The Friday Five is a short, dated price drop on up to five parts, each picked by the shop with the reason written beside it.
          </p>
          <p className="type-lead">Every part shows its price history and its lowest price of the 30 days before, so you can see the drop is real.</p>
          <p className="type-lead">There is no drop running right now.</p>
        </div>
      </header>

      <section aria-labelledby="ff-recent" className="container-page grid gap-6 border-t border-line pt-10 pb-[clamp(2.5rem,7vw,5rem)]">
        <SectionHeading id="ff-recent" title="New in the shop" seeAll={{ to: '/shop?isNew=1&sort=newest', label: 'All new parts' }} />
        {recent.error && !recent.data ? (
          <ErrorState size="sm" error={recent.error} title="Could not load new parts" onRetry={() => void recent.refetch()} />
        ) : (
          <ProductGrid
            label="New in the shop"
            products={recent.data?.items}
            loading={recent.isPending}
            skeletons={4}
            empty={
              <EmptyState
                size="sm"
                title="Nothing new this week"
                description="Have a look at everything in the shop instead."
                actions={
                  <Button to="/shop" variant="dark">
                    Browse the shop
                  </Button>
                }
              />
            }
          />
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ loading */

function DropSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading the Friday Five</span>
      <div className="plane-board">
        <div className="container-page grid gap-4 py-[clamp(2rem,6vw,4rem)]">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full max-w-lg" />
          <SkeletonText lines={2} className="max-w-prose" />
          <Skeleton className="h-16 w-64" />
        </div>
      </div>
      <div className="container-page">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} aria-hidden className="grid gap-6 border-b border-line py-10 md:grid-cols-12 md:gap-8">
            <Skeleton className="aspect-square w-full rounded-none md:col-span-4" />
            <div className="grid content-start gap-4 md:col-span-8">
              <Skeleton className="h-8 w-3/4" />
              <SkeletonText lines={3} />
              <Skeleton className="h-11 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
