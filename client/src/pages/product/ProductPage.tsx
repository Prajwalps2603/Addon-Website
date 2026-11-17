import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { TreadDivider } from '@/components/brand';
import { CompareButton, DemoBadge, ErrorState, ProductRail, ShareButton, StraightLabelPanel, WishlistButton, describeFit } from '@/components/commerce';
import { Breadcrumbs } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useProduct } from '@/hooks/useProduct';
import { useProductsByIds } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { useRecentlyViewed } from '@/stores/recentlyViewed';
import type { ProductDetail, ProductVariant } from '@/types/api';
import FittedReports from '@/pages/product/sections/FittedReports';
import ProductQuestions from '@/pages/product/sections/ProductQuestions';
import { BuyBox, blockedReason } from './parts/BuyBox';
import { DeliveryBlock } from './parts/DeliveryBlock';
import { Details } from './parts/Details';
import { FittingRow } from './parts/FittingRow';
import { FitVerdict } from './parts/FitVerdict';
import { Gallery } from './parts/Gallery';
import { PricePanel } from './parts/PricePanel';
import { ProductSkeleton } from './parts/ProductSkeleton';
import { Relations } from './parts/Relations';
import { ShareRow } from './parts/ShareRow';
import { StickyBuyBar } from './parts/StickyBuyBar';
import { fittingServiceFor, type FitChoice } from './parts/studio';

// The not-found view has a request form (form libraries); only a missing part needs it.
const ProductNotFound = lazy(() => import('./parts/ProductNotFound').then((m) => ({ default: m.ProductNotFound })));

export default function ProductPage() {
  const { slug = '' } = useParams();
  const { data, isPending, error, refetch } = useProduct(slug);
  // Changing the car refetches the verdict: keep showing this part meanwhile instead of the skeleton.
  const last = useRef<ProductDetail | null>(null);
  if (data) last.current = data;
  const product = data ?? (isPending && last.current?.slug === slug ? last.current : undefined);

  useDocumentMeta({
    title: product?.name ?? (error?.isNotFound ? 'Part not found' : 'Part'),
    description: product?.shortDescription || undefined,
    image: product?.image ?? null,
    noindex: Boolean(error?.isNotFound),
  });

  if (product) return <ProductView key={product.id} product={product} />;
  if (isPending || !error) return <ProductSkeleton />;
  if (error.isNotFound)
    return (
      <Suspense fallback={<ProductSkeleton />}>
        <ProductNotFound slug={slug} />
      </Suspense>
    );
  return (
    <div className="container-page section-y">
      <ErrorState error={error} onRetry={() => refetch()} title="Could not load this part" />
    </div>
  );
}

function ProductView({ product }: { product: ProductDetail }) {
  const vehicle = useActiveVehicle();
  const [searchParams, setSearchParams] = useSearchParams();
  const [qty, setQty] = useState(1);
  const [mainButton, setMainButton] = useState<HTMLDivElement | null>(null);
  const settings = useSettings().data;
  const service = fittingServiceFor(product, settings);
  const [fitChoice, setFitChoice] = useState<FitChoice>('self');
  const doesNotFit = vehicle && describeFit(product, vehicle)?.state === 'no' ? vehicle.model : null;
  const atStudio = service !== null && fitChoice === 'studio' && !doesNotFit;

  // The chosen variant lives in ?variant=, so a shared link opens the same choice.
  const variantParam = Number(searchParams.get('variant'));
  const variant: ProductVariant | null = useMemo(() => {
    const fromUrl = product.variants.find((v) => v.id === variantParam);
    if (fromUrl) return fromUrl;
    return product.variants.length === 1 ? product.variants[0] : null;
  }, [product.variants, variantParam]);

  const selectVariant = useCallback(
    (next: ProductVariant) => {
      setSearchParams(
        (params) => {
          const copy = new URLSearchParams(params);
          copy.set('variant', String(next.id));
          return copy;
        },
        { replace: true, preventScrollReset: true },
      );
      setQty((current) => Math.max(1, Math.min(current, next.stock)));
    },
    [setSearchParams],
  );

  // Recently viewed: read the list as it was before this visit, then record this product.
  const recentIds = useRecentlyViewed((state) => state.ids);
  const [recentBefore] = useState(() => recentIds.filter((id) => id !== product.id).slice(0, 10));
  useEffect(() => {
    useRecentlyViewed.getState().push(product.id);
  }, [product.id]);
  const recent = useProductsByIds(recentBefore);

  const blocked = blockedReason(product, variant);
  const parentPath = `/shop/${product.parentCategorySlug}`;
  const categoryPath = `${parentPath}/${product.categorySlug}`;

  return (
    <article className="pb-24 md:pb-0">
      <div className="container-page pt-4">
        <Breadcrumbs
          items={[
            { label: 'Shop', to: '/shop' },
            ...(product.parentCategorySlug ? [{ label: product.parentCategoryName, to: parentPath }] : []),
            { label: product.categoryName, to: product.parentCategorySlug ? categoryPath : `/shop/${product.categorySlug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 xl:gap-16">
          <div className="min-w-0">
            <Gallery images={product.images.length > 0 ? product.images : product.image ? [product.image] : []} name={product.name} artKind={product.artKind} muted={!product.inStock} />
            <div className={cn('mt-4 flex flex-wrap items-center gap-2', product.images.length > 1 && 'md:pl-20')}>
              <WishlistButton productId={product.id} productName={product.name} variant="button" size="sm" />
              <CompareButton productId={product.id} productName={product.name} variant="button" size="sm" />
              <ShareButton url={`/p/${product.slug}`} title={product.name} text={product.shortDescription || product.name} variant="outline" size="sm" />
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-6">
            <header className="grid gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {product.brand && (
                  <span className="lean-box bg-brand px-3 py-1 text-brand-ink">
                    <span className="lean-undo inline-block type-label tracking-widest uppercase">{product.brand}</span>
                  </span>
                )}
                {product.isNew && (
                  <span className="lean-box bg-black px-3 py-1 text-white">
                    <span className="lean-undo inline-block type-label tracking-widest uppercase">New</span>
                  </span>
                )}
                {product.sku && <span className="font-mono text-xs text-muted">SKU {product.sku}</span>}
              </div>
              <h1 className="type-title text-balance">{product.name}</h1>
              <span aria-hidden className="tread w-24 text-brand" />
              <ReportLine product={product} />
              {product.shortDescription && <p className="type-body max-w-prose text-muted">{product.shortDescription}</p>}
              <QuickFacts product={product} />
            </header>

            <PricePanel product={product} variant={variant} />
          </div>
        </div>

        {/* Below the photo and title: buying on the left, fit, delivery and the label on the right, full width. */}
        <div className="mt-10 grid grid-cols-1 gap-8 border-t border-line pt-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="grid min-w-0 content-start gap-6 lg:sticky lg:top-24 lg:self-start">
            <BuyBox
              product={product}
              variant={variant}
              onVariant={selectVariant}
              qty={qty}
              onQty={setQty}
              mainRef={setMainButton}
              service={service}
              fitChoice={fitChoice}
              onFitChoice={setFitChoice}
              doesNotFit={doesNotFit}
            />
          </div>

          <div className="grid min-w-0 content-start gap-6">
            <FitVerdict product={product} vehicle={vehicle} />

            <ShareRow product={product} variant={variant} vehicle={vehicle} />

            <div className="grid gap-3">
              <StraightLabelPanel
                label={product.label}
                className="overflow-hidden rounded-[14px] !border-line [&>header]:!bg-surface [&>header]:!text-ink [&>header]:border-b [&>header]:border-line [&>header_h2]:!text-xl"
              />
              <FittingRow product={product} elsewhere={service !== null} />
            </div>

            <DeliveryBlock product={product} />
          </div>
        </div>
      </div>

      <div className="container-page section-y">
        <TreadDivider tone="line" className="mb-10" />
        <Details product={product} />
      </div>

      {product.relations.length > 0 && (
        <div className="container-page pb-[clamp(2.5rem,7vw,5rem)]">
          <Relations relations={product.relations} />
        </div>
      )}

      {/* The sections carry their own anchors: #fitted-reports and #questions (with #ask-fitment).
          #reports stays as an older alias, used by the order page. */}
      <div className="container-page grid gap-12">
        <div>
          <span id="reports" aria-hidden className="block scroll-mt-24" />
          <FittedReports product={product} />
        </div>
        <ProductQuestions product={product} />
      </div>

      <div className="container-page section-y grid gap-12">
        <ProductRail
          title="Similar parts"
          products={product.similar}
          seeAll={{ to: product.parentCategorySlug ? categoryPath : `/shop/${product.categorySlug}`, label: `All ${product.categoryName.toLowerCase()}` }}
        />
        <ProductRail title="Recently viewed" products={recent.data} loading={recentBefore.length > 0 && recent.isPending} />
      </div>

      <StickyBuyBar
        product={product}
        variant={variant}
        vehicle={vehicle}
        qty={qty}
        blocked={blocked}
        target={mainButton}
        atStudio={atStudio}
        hasService={service !== null}
      />
    </article>
  );
}

const FITMENT_LABEL: Record<ProductDetail['fitmentType'], string> = {
  universal: 'Universal',
  vehicle: 'Car specific',
  body_type: 'By body type',
  pcd: 'By wheel PCD',
  none: 'Not car specific',
};

/** A three-cell strip of the facts a buyer checks first: fitment, how hard it is to fit, warranty. */
function QuickFacts({ product }: { product: ProductDetail }) {
  const facts = [
    { label: 'Fitment', value: FITMENT_LABEL[product.fitmentType] ?? 'See below' },
    {
      label: 'Fit level',
      value: (
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className={cn('h-3 w-1.5 -skew-x-[20deg]', step <= product.installDifficulty ? 'bg-brand' : 'bg-line-strong')} />
            ))}
          </span>
          <span className="tnum">{product.installDifficulty}/5</span>
        </span>
      ),
    },
    { label: 'Warranty', value: product.warrantyMonths > 0 ? pluralize(product.warrantyMonths, 'month') : 'None' },
  ];
  return (
    <dl className="mt-1 grid grid-cols-3 divide-x divide-line border-y border-line">
      {facts.map((fact) => (
        <div key={fact.label} className="grid gap-1 px-3 py-2.5 first:pl-0">
          <dt className="type-label text-muted uppercase">{fact.label}</dt>
          <dd className="type-small font-bold">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "92% fitted first time, 6 fitted reports": only when reports exist, linking down to them. */
function ReportLine({ product }: { product: ProductDetail }) {
  const sample = useSettings().data?.hasDemoData === true;
  const hasReports = product.ratingCount > 0;
  const { data } = useQuery({
    queryKey: queryKeys.reports.list(product.slug, {}),
    queryFn: ({ signal }) => api.reports.list(product.slug, {}, { signal }),
    enabled: hasReports,
  });
  if (!hasReports) return null;
  const reports = pluralize(product.ratingCount, 'fitted report');
  const percent = data?.fittedOkPercent;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 type-small">
      <ClipboardCheck aria-hidden className="size-4 shrink-0" />
      <a href="#fitted-reports" className="link tnum">
        {typeof percent === 'number' ? (
          <>
            <span className="font-bold">{percent}% fitted first time</span>, {reports}
          </>
        ) : (
          <>
            <span className="font-bold">{product.ratingAvg.toFixed(1)} of 5</span> from {reports}
          </>
        )}
      </a>
      {sample && <DemoBadge />}
    </p>
  );
}
