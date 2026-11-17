import { useMemo, useState } from 'react';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { ChevronDown, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { TreadDivider } from '@/components/brand';
import { ErrorState, PageHeader, ProductGrid } from '@/components/commerce';
import { Badge, Button, Drawer, EmptyState, Select, Skeleton, type Crumb } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useCategories } from '@/hooks/useCategories';
import { api, isApiError } from '@/lib/api';
import { formatNumber, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Category, ProductListResponse, ProductQuery, ProductSort, ProductSummary } from '@/types/api';
import { appliedFilters, AppliedFiltersBar } from './parts/AppliedFilters';
import { CarBar } from './parts/CarBar';
import { FilterPanel } from './parts/FilterPanel';
import { PickOfThree } from './parts/PickOfThree';
import { SearchBox } from './parts/SearchBox';
import { ShopEmpty } from './parts/ShopEmpty';
import {
  countFilters,
  EMPTY_FILTERS,
  filtersToQuery,
  MAX_PAGES,
  PAGE_SIZE,
  readFilters,
  readPage,
  readSort,
  sameFilters,
  SORT_LABELS,
  SORTS,
  writeFilters,
  type ShopFilters,
} from './parts/shopQuery';
import { SubcategoryNav, type SubcategoryLink } from './parts/SubcategoryNav';
import { useScrollRestore } from './parts/useScrollRestore';

interface TreeMatch {
  hub: Category | null;
  sub: Category | null;
  /** False once the tree has loaded and the path names a category it does not have. */
  known: boolean;
}

function findInTree(tree: Category[] | undefined, hubSlug: string | null, subSlug: string | null): TreeMatch {
  if (!hubSlug) return { hub: null, sub: null, known: true };
  if (!tree) return { hub: null, sub: null, known: true };
  const hub = tree.find((category) => category.slug === hubSlug) ?? null;
  if (!hub) return { hub: null, sub: null, known: false };
  if (!subSlug) return { hub, sub: null, known: true };
  const sub = hub.children.find((category) => category.slug === subSlug) ?? null;
  return { hub, sub, known: sub !== null };
}

function uniqueById(products: ProductSummary[]): ProductSummary[] {
  const seen = new Set<number>();
  return products.filter((product) => (seen.has(product.id) ? false : (seen.add(product.id), true)));
}

export default function ShopPage() {
  const params = useParams<{ category?: string; sub?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isSearch = location.pathname.replace(/\/+$/, '') === '/search';
  const q = isSearch ? (searchParams.get('q') ?? '').trim() : '';
  const hubSlug = isSearch ? null : (params.category ?? null);
  const subSlug = isSearch ? null : (params.sub ?? null);
  const pathCategory = subSlug ?? hubSlug;
  const searchWithoutWords = isSearch && q === '';

  const vehicle = useActiveVehicle();
  const tree = useCategories();
  const match = findInTree(tree.data, hubSlug, subSlug);

  // Only a search narrows by a `category` parameter; category pages carry theirs in the path.
  const urlFilters = useMemo(() => readFilters(searchParams), [searchParams]);
  const filters: ShopFilters = isSearch ? urlFilters : { ...urlFilters, category: null };
  const sort = readSort(searchParams, isSearch && q !== '');
  const page = readPage(searchParams);

  const buildQuery = (from: ShopFilters, extra: ProductQuery = {}): ProductQuery => ({
    ...filtersToQuery(from, vehicle !== null),
    ...(pathCategory ? { category: pathCategory } : {}),
    ...(q ? { q } : {}),
    ...(vehicle ? { vehicleId: vehicle.id } : {}),
    sort,
    limit: PAGE_SIZE,
    ...extra,
  });

  // One query per page that "Show more" has opened. Each page is cached on its own, so Back
  // brings every loaded page straight back and the scroll position can be restored.
  const pages = useQueries({
    queries: Array.from({ length: page }, (_, index) => {
      const query = buildQuery(filters, { page: index + 1 });
      return {
        queryKey: queryKeys.products.list(query),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.products.list(query, { signal }),
        enabled: !searchWithoutWords,
        placeholderData: index === 0 ? keepPreviousData<ProductListResponse> : undefined,
      };
    }),
  });

  const first = pages[0];
  const data = first?.data;
  const items = useMemo(() => uniqueById(pages.flatMap((result) => result.data?.items ?? [])), [pages]);
  const loadingMore = pages.slice(1).some((result) => result.isPending || (result.isFetching && result.isPlaceholderData));
  const moreError = pages.slice(1).find((result) => result.error)?.error ?? null;
  const allLoaded = pages.every((result) => !result.isPending) && !first?.isPlaceholderData;
  useScrollRestore(allLoaded && !searchWithoutWords);

  const drop = useQuery({
    queryKey: queryKeys.drop(vehicle?.id),
    queryFn: ({ signal }) => api.catalog.currentDrop({ vehicleId: vehicle?.id }, { signal }),
    staleTime: 60_000,
  });
  const dropLive = Boolean(drop.data && new Date(drop.data.endsAt).getTime() > Date.now());

  // ------------------------------------------------------------------ names and words

  const resolved = data?.category ?? null;
  const hub = match.hub ?? (resolved && resolved.parentId === null ? resolved : null);
  const sub = match.sub ?? (subSlug && resolved && resolved.slug === subSlug ? resolved : null);
  const current = sub ?? hub;
  const notFound =
    (isApiError(first?.error) && first.error.isNotFound) ||
    (pathCategory !== null && !match.known && data !== undefined && !first?.isPlaceholderData && resolved === null);

  const categoryName = (slug: string): string | null =>
    data?.facets.categories.find((row) => row.slug === slug)?.name ??
    tree.data?.flatMap((top) => [top, ...top.children]).find((category) => category.slug === slug)?.name ??
    null;

  const applied = appliedFilters(filters, { vehicle, categoryName });
  const narrowing = countFilters(filters);

  let title = filters.isNew && !filters.featured ? 'New in' : filters.featured && !filters.isNew ? 'Featured parts' : 'All parts';
  if (isSearch) title = q ? `Results for "${q}"` : 'Search';
  else if (current) title = current.name;
  else if (pathCategory) title = '';

  const understood = data?.understoodAs && data.understoodAs.toLowerCase() !== q.toLowerCase() ? data.understoodAs : null;

  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }];
  if (isSearch) crumbs.push({ label: 'Search' });
  else {
    crumbs.push(pathCategory ? { label: 'Shop', to: '/shop' } : { label: 'Shop' });
    if (hubSlug) crumbs.push(subSlug ? { label: hub?.name ?? '…', to: `/shop/${hubSlug}` } : { label: hub?.name ?? '…' });
    if (subSlug) crumbs.push({ label: sub?.name ?? '…' });
  }

  useDocumentMeta({
    title: isSearch ? (q ? `Search: ${q}` : 'Search') : notFound ? 'Category not found' : current?.name || (pathCategory ? 'Shop' : 'Shop all parts'),
    description: current?.blurb || undefined,
    image: current?.image || undefined,
    noindex: isSearch || notFound,
  });

  // ------------------------------------------------------------------ changing the URL

  const applyFilters = (next: ShopFilters) => {
    setSearchParams(writeFilters(searchParams, isSearch ? next : { ...next, category: null }));
  };

  const setSort = (next: ProductSort) => {
    const updated = new URLSearchParams(searchParams);
    updated.delete('page');
    if (next === readSort(new URLSearchParams(), isSearch && q !== '')) updated.delete('sort');
    else updated.set('sort', next);
    setSearchParams(updated);
  };

  const showMore = () => {
    const updated = new URLSearchParams(searchParams);
    updated.set('page', String(page + 1));
    // Replace, so Back from a product returns here with every page, not one "Show more" at a time.
    setSearchParams(updated, { replace: true });
  };

  const search = (words: string) => navigate({ pathname: '/search', search: `?q=${encodeURIComponent(words)}` });

  /** The current query string without the page, carried over to category links. */
  const carrySearch = (() => {
    const carry = writeFilters(searchParams, { ...filters, category: null });
    carry.delete('q');
    const text = carry.toString();
    return text ? `?${text}` : '';
  })();

  // ------------------------------------------------------------------ the filter sheet (phones)

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<ShopFilters>(EMPTY_FILTERS);
  const draftChanged = sheetOpen && !sameFilters(draft, filters);
  const previewQuery = buildQuery(draft, { page: 2, limit: 1 });
  // Page 2 of one item: the server counts the whole result but does not log it as a fresh search.
  const preview = useQuery({
    queryKey: queryKeys.products.list(previewQuery),
    queryFn: ({ signal }) => api.products.list(previewQuery, { signal }),
    enabled: draftChanged && !searchWithoutWords,
    placeholderData: keepPreviousData,
  });
  const sheetTotal = draftChanged ? preview.data?.total : data?.total;
  const sheetFacets = draftChanged ? (preview.data?.facets ?? data?.facets) : data?.facets;

  const openSheet = () => {
    setDraft(filters);
    setSheetOpen(true);
  };
  const applySheet = () => {
    if (!sameFilters(draft, filters)) applyFilters(draft);
    setSheetOpen(false);
  };

  // ------------------------------------------------------------------ hub and sibling chips

  const subcategoryLinks: SubcategoryLink[] = [];
  if (hub && hub.children.length > 0) {
    const facetCount = (slug: string) => (!subSlug ? data?.facets.categories.find((row) => row.slug === slug)?.count : undefined);
    subcategoryLinks.push({ slug: hub.slug, name: `All ${hub.name.toLowerCase()}`, count: hub.productCount, to: `/shop/${hub.slug}` });
    for (const child of hub.children) {
      subcategoryLinks.push({
        slug: child.slug,
        name: child.name,
        count: facetCount(child.slug) ?? child.productCount,
        to: `/shop/${hub.slug}/${child.slug}`,
      });
    }
  }

  const picks = subSlug && narrowing === 0 && !first?.isPlaceholderData ? (data?.picks ?? []) : [];
  const serverFields = isApiError(first?.error) ? first.error.fields : undefined;
  const sortOptions = SORTS.filter((value) => value !== 'relevance' || (isSearch && q !== '')).map((value) => ({
    value,
    label: SORT_LABELS[value],
  }));

  // ------------------------------------------------------------------ render

  if (notFound) {
    return (
      <div className="container-page pb-16">
        <PageHeader title="Category not found" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Shop', to: '/shop' }, { label: 'Not found' }]} />
        <EmptyState
          title="We do not have that category"
          description="It may have been renamed or removed. Every part is still in the shop."
          actions={
            <Button variant="dark" to="/shop">
              Browse all parts
            </Button>
          }
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title={title || ' '}
      breadcrumbs={crumbs}
      description={
        isSearch ? (
          understood ? (
            <>
              Showing results for <span className="font-bold text-ink">"{understood}"</span>.
            </>
          ) : undefined
        ) : (
          current?.blurb || undefined
        )
      }
      meta={
        searchWithoutWords ? undefined : data ? (
          <span aria-live="polite">{pluralize(data.total, 'part')}</span>
        ) : (
          <Skeleton className="h-4 w-16" />
        )
      }
    />
  );

  return (
    <div className="container-page pb-16">
      {pathCategory && !current && !data ? (
        <div className="grid gap-3 pt-4 pb-6 md:pt-6 md:pb-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-64 max-w-full md:h-12" />
          <Skeleton className="h-5 w-full max-w-prose" />
        </div>
      ) : (
        header
      )}

      {isSearch && <SearchBox value={q} onSearch={search} serverError={serverFields?.q} autoFocus={searchWithoutWords} className="-mt-2 mb-6 max-w-2xl" />}

      {searchWithoutWords ? (
        <EmptyState
          art={<Search aria-hidden strokeWidth={1.5} className="size-12 text-line-strong" />}
          title="What are you looking for?"
          description="Type a part, a brand or the word your mechanic uses. Trade words and Hinglish work too."
          actions={
            <Button variant="outline" to="/shop">
              Browse all parts
            </Button>
          }
        />
      ) : (
        <>
          {subcategoryLinks.length > 0 && <SubcategoryNav items={subcategoryLinks} label={`${hub?.name ?? 'Category'} subcategories`} className="mb-5" />}

          <CarBar
            vehicle={vehicle}
            fitsCount={data?.facets.fitsCount}
            total={data?.total}
            fitOnly={filters.fitOnly}
            onFitOnlyChange={(on) => applyFilters({ ...filters, fitOnly: on })}
          />

          {picks.length > 0 && sub && <PickOfThree picks={picks} categoryName={sub.name} className="mt-8 md:mt-10" />}

          <div className="mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
            <aside aria-labelledby="shop-filters-heading" className="hidden lg:block">
              <h2 id="shop-filters-heading" className="type-h3 mb-4 flex h-12 items-center border-b border-ink">
                Filters
              </h2>
              <FilterPanel
                filters={filters}
                onChange={applyFilters}
                facets={data?.facets}
                categoryMode={isSearch ? 'param' : pathCategory ? 'none' : 'link'}
                tree={tree.data}
                carrySearch={carrySearch}
                dropLive={dropLive}
                serverErrors={serverFields}
              />
            </aside>

            <div className="min-w-0">
              <h2 className="sr-only">Results</h2>
              <div className="flex h-12 items-center justify-between gap-3 border-b border-ink">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSheet}
                  aria-haspopup="dialog"
                  iconLeft={<SlidersHorizontal aria-hidden />}
                  className="lg:hidden"
                >
                  Filters
                  {narrowing > 0 && (
                    <Badge tone="ink" variant="solid" size="sm" className="ml-0.5">
                      {narrowing}
                      <span className="sr-only"> on</span>
                    </Badge>
                  )}
                </Button>
                <p className="type-small hidden text-muted tnum lg:block">
                  {data ? `${formatNumber(data.total)} ${data.total === 1 ? 'part' : 'parts'}` : ' '}
                </p>
                <label className="type-small flex items-center gap-2 font-bold">
                  <span className="hidden sm:inline">Sort by</span>
                  <span className="sr-only sm:hidden">Sort by</span>
                  <Select
                    selectSize="sm"
                    value={sort}
                    options={sortOptions}
                    onChange={(event) => setSort(event.target.value as ProductSort)}
                    className="w-44 font-normal"
                  />
                </label>
              </div>

              <AppliedFiltersBar items={applied} onChange={applyFilters} className="mt-3" />

              <div className="mt-6">
                {first?.error && !data ? (
                  <div className="grid gap-2">
                    <ErrorState error={first.error} onRetry={() => void first.refetch()} title="The parts list did not load" />
                    {narrowing > 0 && (
                      <Button variant="link" onClick={() => applyFilters(EMPTY_FILTERS)} className="justify-self-start">
                        Clear the filters and try again
                      </Button>
                    )}
                  </div>
                ) : (
                  <ProductGrid
                    products={data ? items : undefined}
                    loading={first?.isPending}
                    updating={first?.isPlaceholderData}
                    skeletons={8}
                    eagerCount={4}
                    compare
                    label={current ? current.name : isSearch ? `Results for ${q}` : 'Parts'}
                    empty={
                      <ShopEmpty
                        q={q}
                        understoodAs={data?.understoodAs ?? null}
                        categoryName={current?.name ?? null}
                        applied={applied}
                        onChange={applyFilters}
                        onClearAll={() => applyFilters(EMPTY_FILTERS)}
                      />
                    }
                  />
                )}
              </div>

              {data && items.length > 0 && (
                <div className="mx-auto mt-12 grid w-full max-w-md gap-4 rounded-[22px] bg-surface p-5 text-center">
                  <p className="text-sm text-muted tnum">
                    You have seen <span className="font-bold text-ink">{formatNumber(items.length)}</span> of{' '}
                    <span className="font-bold text-ink">{formatNumber(data.total)}</span> parts
                  </p>
                  <TreadDivider size="sm" progress={data.total > 0 ? items.length / data.total : 1} label="Parts shown so far" />
                  {moreError && (
                    <p role="alert" className="type-small text-stop">
                      The next parts did not load. {moreError.message}
                    </p>
                  )}
                  {page < data.pages && page < MAX_PAGES && (
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={moreError ? () => pages.forEach((result) => result.error && void result.refetch()) : showMore}
                      className="focus-ring group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-bold text-page transition-colors hover:bg-brand hover:text-brand-ink disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      ) : (
                        <ChevronDown aria-hidden className="size-4 transition-transform group-hover:translate-y-0.5" />
                      )}
                      {moreError ? 'Try again' : `Show ${formatNumber(Math.min(data.total - items.length, PAGE_SIZE))} more`}
                    </button>
                  )}
                  {page >= MAX_PAGES && page < data.pages && (
                    <p className="type-small text-muted">That is a long list. Narrow it with the filters to see the rest.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        description={vehicle && filters.fitOnly ? `Showing only parts for your ${vehicle.model}.` : undefined}
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDraft({ ...EMPTY_FILTERS, fitOnly: draft.fitOnly })} disabled={countFilters(draft) === 0}>
              Clear all
            </Button>
            <Button block onClick={applySheet} loading={draftChanged && preview.isFetching}>
              <span aria-live="polite">{sheetTotal === undefined ? 'Show parts' : `Show ${pluralize(sheetTotal, 'part')}`}</span>
            </Button>
          </div>
        }
      >
        <FilterPanel
          filters={draft}
          onChange={setDraft}
          facets={sheetFacets}
          categoryMode={isSearch ? 'param' : pathCategory ? 'none' : 'link'}
          tree={tree.data}
          carrySearch={carrySearch}
          dropLive={dropLive}
          serverErrors={serverFields}
          draft
        />
      </Drawer>
    </div>
  );
}
