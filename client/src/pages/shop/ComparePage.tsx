import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { GitCompareArrows, Plus, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { AddToCartButton, DemoBadge, ErrorState, PageHeader, ProductFrame, WhatsAppButton } from '@/components/commerce';
import { Badge, Button, Callout, CopyButton, EmptyState, IconButton, Skeleton, Switch } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useProductsByIds } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { siteUrl } from '@/lib/urls';
import { shareCompare } from '@/lib/whatsapp';
import { MAX_COMPARE, useCompare } from '@/stores/compare';
import { useUi } from '@/stores/ui';
import type { FittedReportsResponse, ProductDetail, ProductSummary } from '@/types/api';
import { buildCompareGroups, rowDiffers } from './parts/compareRows';

function parseIds(value: string | null): number[] {
  if (!value) return [];
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

const crumbs = [{ label: 'Home', to: '/' }, { label: 'Compare' }];

/** Buying controls for one column: add, choose options, or sold out. */
function BuyCell({ product }: { product: ProductSummary }) {
  if (!product.inStock) {
    return (
      <Button to={`/p/${product.slug}`} size="sm" variant="outline" block>
        Sold out: see the part
      </Button>
    );
  }
  if (product.hasVariants || product.customKind) {
    return (
      <Button to={`/p/${product.slug}`} size="sm" variant="outline" block>
        {product.customKind ? 'Design it' : 'Choose options'}
      </Button>
    );
  }
  return <AddToCartButton productId={product.id} productName={product.name} size="sm" tone="dark" block />;
}

function CompareSkeleton({ columns }: { columns: number }) {
  return (
    <div aria-hidden className="grid gap-4">
      <div className="flex gap-3 overflow-hidden">
        <Skeleton className="h-64 w-28 shrink-0 sm:w-44" />
        {Array.from({ length: columns }, (_, index) => (
          <div key={index} className="grid w-44 shrink-0 content-start gap-2 sm:flex-1">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function ComparePage() {
  useDocumentMeta({
    title: 'Compare parts',
    description: 'Up to four parts side by side: price, fit for your car, the Straight Label and every specification.',
    noindex: true,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const storeIds = useCompare((state) => state.ids);
  const vehicle = useActiveVehicle();
  const sample = useSettings().data?.hasDemoData === true;
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  // A shared link (?ids=) replaces this device's list once; after that the address follows the list,
  // so "Copy link" and Back always describe what is on screen.
  const [urlIds] = useState(() => parseIds(searchParams.get('ids')));
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (urlIds.length > 0) useCompare.getState().setAll(urlIds);
    setSeeded(true);
  }, [urlIds]);

  const ids = seeded ? storeIds : urlIds.length > 0 ? urlIds : storeIds;
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!seeded) return;
    if ((searchParams.get('ids') ?? '') === idsKey) return;
    setSearchParams(idsKey ? { ids: idsKey } : {}, { replace: true });
  }, [seeded, idsKey, searchParams, setSearchParams]);

  const summaries = useProductsByIds(ids);
  // While a removal refetches, the previous answer is still on screen: show only what is still picked.
  const products = useMemo(() => {
    const byId = new Map((summaries.data ?? []).map((product) => [product.id, product]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }, [summaries.data, ids]);

  // Products the catalogue no longer has drop out of the list for good.
  useEffect(() => {
    if (!seeded || summaries.isPlaceholderData || !summaries.isSuccess) return;
    const found = new Set(summaries.data.map((product) => product.id));
    if (storeIds.some((id) => !found.has(id))) useCompare.getState().setAll(storeIds.filter((id) => found.has(id)));
  }, [seeded, summaries.isPlaceholderData, summaries.isSuccess, summaries.data, storeIds]);

  const detailQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: queryKeys.products.detail(product.slug, vehicle?.id ?? null),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.products.get(product.slug, { vehicleId: vehicle?.id }, { signal }),
    })),
  });
  const reportQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: queryKeys.reports.list(product.slug, { limit: 1 }),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.reports.list(product.slug, { limit: 1 }, { signal }),
      staleTime: 5 * 60_000,
    })),
  });

  const details = new Map<number, ProductDetail>();
  const reports = new Map<number, FittedReportsResponse>();
  products.forEach((product, index) => {
    const detail = detailQueries[index]?.data;
    if (detail) details.set(product.id, detail);
    const report = reportQueries[index]?.data;
    if (report) reports.set(product.id, report);
  });
  const settled = (queries: typeof detailQueries | typeof reportQueries) => (id: number) => {
    const index = products.findIndex((product) => product.id === id);
    const query = queries[index];
    return query ? !query.isPending || query.isError : true;
  };

  const groups = buildCompareGroups({
    products,
    details,
    reports,
    detailsSettled: settled(detailQueries),
    reportsSettled: settled(reportQueries),
    vehicle,
    sample,
    selectCar: (
      <Button variant="link" onClick={openVehiclePicker} aria-haspopup="dialog" className="[--button-text:0.8125rem]">
        Select your car
      </Button>
    ),
  });

  const shareUrl = siteUrl(`/compare?ids=${products.map((product) => product.id).join(',')}`);
  const first = products[0];
  const addMorePath = first ? `/shop/${[first.parentCategorySlug, first.categorySlug].filter(Boolean).join('/')}` : '/shop';
  const canAddMore = products.length > 0 && products.length < MAX_COMPARE;
  const columns = products.length + (canAddMore ? 1 : 0);

  // ------------------------------------------------------------------ states

  if (ids.length === 0) {
    return (
      <div className="container-page pb-16">
        <PageHeader title="Compare" breadcrumbs={crumbs} />
        <EmptyState
          art={<GitCompareArrows aria-hidden strokeWidth={1.5} className="size-14 text-line-strong" />}
          title="Nothing to compare yet"
          description="Press Compare under any part in the shop, or on a product page, to put it here. You can line up four parts at once and see where they differ: price, fit for your car, the Straight Label and every specification."
          actions={
            <Button variant="dark" to="/shop">
              Browse parts
            </Button>
          }
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Compare"
      breadcrumbs={crumbs}
      meta={products.length > 0 ? `${products.length} of ${MAX_COMPARE}` : undefined}
      description={
        vehicle ? (
          <>
            Fit is checked against your <span className="font-bold text-ink">{vehicle.label}</span>.
          </>
        ) : (
          'Rows where the parts differ are marked.'
        )
      }
      actions={
        products.length > 0 && (
          <>
            <WhatsAppButton to="share" text={shareCompare(products)} size="sm">
              Ask the gang
            </WhatsAppButton>
            <CopyButton value={shareUrl} label="Copy link" />
            <Button variant="ghost" size="sm" onClick={() => useCompare.getState().clear()}>
              Clear all
            </Button>
          </>
        )
      }
    />
  );

  if (summaries.isPending) {
    return (
      <div className="container-page pb-16">
        {header}
        <span className="sr-only" role="status">
          Loading the comparison
        </span>
        <CompareSkeleton columns={Math.max(1, ids.length)} />
      </div>
    );
  }

  if (summaries.error && products.length === 0) {
    return (
      <div className="container-page pb-16">
        {header}
        <ErrorState error={summaries.error} onRetry={() => void summaries.refetch()} title="The comparison did not load" />
      </div>
    );
  }

  const visibleGroups = groups
    .map((group) => ({ ...group, rows: onlyDifferences ? group.rows.filter(rowDiffers) : group.rows }))
    .filter((group) => group.rows.length > 0);
  const differenceCount = groups.reduce((sum, group) => sum + group.rows.filter(rowDiffers).length, 0);

  return (
    <div className="container-page pb-16">
      {header}

      {products.length === 1 && (
        <Callout tone="info" title="Add one more to compare" className="mb-6">
          The table fills in as you add parts. Press Compare on another part to put it beside this one.
        </Callout>
      )}

      {products.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <p className="type-small text-muted tnum" aria-live="polite">
            {differenceCount === 0 ? 'No differences found yet.' : `${differenceCount} ${differenceCount === 1 ? 'row differs' : 'rows differ'}.`}
          </p>
          <Switch checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} label="Only rows that differ" />
        </div>
      )}

      <div className="focus-ring-inset -mx-4 overflow-x-auto overscroll-x-contain border-y border-ink sm:mx-0 sm:border-x" tabIndex={0} role="region" aria-label="Comparison table, scrolls sideways">
        <table className="w-full table-fixed border-collapse text-left" style={{ minWidth: `${7 + columns * 11.5}rem` }}>
          <caption className="sr-only">Comparison of {products.map((product) => product.name).join(', ')}</caption>
          <colgroup>
            <col className="w-28 sm:w-44" />
          </colgroup>
          <thead>
            <tr>
              <td className="sticky left-0 z-raised border-r border-line bg-page p-3 align-bottom">
                <span className="type-label text-muted">
                  {products.length} {products.length === 1 ? 'part' : 'parts'}
                </span>
              </td>
              {products.map((product, index) => {
                const detail = detailQueries[index]?.data;
                return (
                  <th key={product.id} scope="col" className="border-l border-line p-3 align-top font-normal">
                    <div className="grid gap-2.5">
                      <ProductFrame image={product.image} alt={product.name} artKind={product.artKind} eager={index < 2} muted={!product.inStock}>
                        <IconButton
                          label={`Remove ${product.name} from compare`}
                          size="sm"
                          onClick={() => useCompare.getState().remove(product.id)}
                          className="absolute top-1 right-1 bg-frame text-frame-ink"
                        >
                          <X aria-hidden />
                        </IconButton>
                      </ProductFrame>
                      <div className="grid gap-1">
                        <p className="type-label truncate text-muted">{product.brand}</p>
                        <Link to={`/p/${product.slug}`} className="focus-ring line-clamp-3 leading-snug font-bold underline-offset-4 hover:underline">
                          {product.name}
                        </Link>
                        {detail?.isDemo && <DemoBadge className="justify-self-start" />}
                      </div>
                      <BuyCell product={product} />
                    </div>
                  </th>
                );
              })}
              {canAddMore && (
                <td className="border-l border-line p-3 align-top">
                  <Link
                    to={addMorePath}
                    className="focus-ring flex aspect-square flex-col items-center justify-center gap-2 border border-line-strong p-3 text-center hover:border-ink hover:bg-surface"
                  >
                    <Plus aria-hidden className="size-6" />
                    <span className="font-bold">Add a part</span>
                    <span className="type-small text-muted">
                      {first ? `More ${first.categoryName.toLowerCase()}` : 'From the shop'}, {MAX_COMPARE - products.length} more {MAX_COMPARE - products.length === 1 ? 'place' : 'places'}
                    </span>
                  </Link>
                </td>
              )}
            </tr>
          </thead>

          {visibleGroups.map((group) => (
            <tbody key={group.key}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={columns + 1}
                  className={cn('p-0 text-left', group.band ? 'bg-ink text-page print-exact' : 'border-t border-ink bg-surface')}
                >
                  <span className={cn('sticky left-0 inline-block px-3 py-2.5', group.band ? 'type-h3' : 'type-label')}>{group.title}</span>
                </th>
              </tr>
              {group.rows.map((row) => {
                const differs = rowDiffers(row);
                return (
                  <tr key={row.key} className="border-t border-line">
                    <th
                      scope="row"
                      className={cn(
                        'sticky left-0 z-raised border-r border-line p-3 align-top font-normal',
                        differs ? 'bg-surface' : 'bg-page',
                      )}
                    >
                      <span className="type-small block font-bold">{row.label}</span>
                      {differs && (
                        <Badge tone="ink" variant="outline" size="sm" className="mt-1.5">
                          Differs
                        </Badge>
                      )}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={products[index]?.id ?? index} className={cn('border-l border-line p-3 align-top', differs && 'bg-surface')}>
                        {cell}
                      </td>
                    ))}
                    {canAddMore && <td className="border-l border-line" />}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {onlyDifferences && visibleGroups.length === 0 && (
        <p className="type-small mt-4 text-muted">These parts read the same on every row we hold.</p>
      )}

      {products.length > 1 && <p className="type-small mt-4 text-muted sm:hidden">Swipe the table sideways to see every part.</p>}
    </div>
  );
}
