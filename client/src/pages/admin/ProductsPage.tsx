import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { DemoBadge, ErrorState, PageHeader, ProductFrame } from '@/components/commerce';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Pagination,
  Select,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Table,
  Tabs,
  toast,
  type TableColumn,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { api, errorMessage, type AdminProductPatch, type AdminProductQuery, type AdminProductStatus } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminProduct } from '@/types/api';
import { QuickEdit } from './catalog/QuickEdit';
import { marginOf, subcategoryGroups } from './catalog/utils';

const STATUSES: readonly { value: '' | AdminProductStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'active', label: 'In the shop' },
  { value: 'inactive', label: 'Hidden' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
];

const PAGE_SIZE = 20;

function readStatus(value: string | null): '' | AdminProductStatus {
  return STATUSES.some((s) => s.value === value) ? (value as AdminProductStatus) : '';
}

export default function ProductsPage() {
  useDocumentMeta({ title: 'Products', noindex: true });
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const status = readStatus(params.get('status'));
  const page = Math.max(1, Number(params.get('page')) || 1);

  // The search box writes to the URL once typing stops.
  const [text, setText] = useState(q);
  const debounced = useDebounce(text.trim(), 300);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (debounced === q) return;
    update({ q: debounced, page: '' });
  }, [debounced]);

  function update(patch: Record<string, string>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: 'q' in patch },
    );
  }

  const query: AdminProductQuery = { q: q || undefined, category: category || undefined, status: status || undefined, page, limit: PAGE_SIZE };
  const { data, isPending, isPlaceholderData, error, refetch } = useQuery({
    queryKey: queryKeys.admin.products.list(query),
    queryFn: ({ signal }) => api.admin.products.list(query, { signal }),
    placeholderData: keepPreviousData,
  });

  const categories = useQuery({
    queryKey: queryKeys.admin.categories.list(),
    queryFn: ({ signal }) => api.admin.categories.list({ signal }),
    staleTime: 60_000,
  });

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminProductPatch; message: string; key: string }) => api.admin.products.patch(id, body),
    onMutate: ({ key }) => setBusy((b) => ({ ...b, [key]: true })),
    onSettled: (_data, _error, { key }) => setBusy(({ [key]: _done, ...rest }) => rest),
    onSuccess: (product, { message }) => {
      toast.success(message, { description: product.name });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (err) => toast.error('Not saved', { description: errorMessage(err) }),
  });

  const save = (product: AdminProduct, body: AdminProductPatch, message: string, key: string) =>
    patch.mutateAsync({ id: product.id, body, message, key });

  const columns: TableColumn<AdminProduct>[] = [
    {
      key: 'product',
      header: 'Product',
      primary: true,
      cell: (p) => (
        <div className="flex min-w-0 items-start gap-3">
          <ProductFrame image={p.image} alt="" artKind={p.artKind} className="size-16 shrink-0 overflow-hidden rounded-[14px]" />
          <div className="grid min-w-0 gap-1.5">
            <Link to={`/admin/products/${p.id}`} className="focus-ring line-clamp-2 max-w-[32rem] leading-snug font-bold hover:text-brand-text">
              {p.name}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-surface px-2.5 py-0.5 font-mono text-[0.6875rem] font-bold text-muted">{p.sku}</span>
              {!p.isActive && (
                <Badge size="sm" tone="neutral" variant="outline">
                  Hidden
                </Badge>
              )}
              {p.hasVariants && (
                <Badge size="sm" tone="neutral">
                  {pluralize(p.variants.length, 'variant')}
                </Badge>
              )}
              {p.isDemo && <DemoBadge />}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      cell: (p) =>
        p.hasVariants ? (
          <span className="grid justify-items-end">
            <span className="tnum">From {formatINR(p.regularPrice)}</span>
            <span className="type-small text-muted">Edit in the form</span>
          </span>
        ) : (
          <span className="grid justify-items-end">
            <QuickEdit
              label={`price of ${p.name}`}
              value={p.regularPrice}
              money
              display={<span className="font-bold">{formatINR(p.regularPrice)}</span>}
              disabled={busy[`price-${p.id}`]}
              onSave={(price) => save(p, { price }, `Price set to ${formatINR(price)}`, `price-${p.id}`)}
            />
            {p.mrp > p.regularPrice && <span className="text-xs text-muted line-through tnum">{formatINR(p.mrp)}</span>}
          </span>
        ),
    },
    {
      key: 'stock',
      header: 'Stock',
      numeric: true,
      cell: (p) => {
        const tone = p.stock <= 0 ? 'bg-stop-soft text-stop' : p.stock <= p.lowStockThreshold ? 'bg-warn/12 text-warn' : 'bg-fit/10 text-fit';
        const words = p.stock <= 0 ? 'Sold out' : p.stock <= p.lowStockThreshold ? 'Low' : 'In stock';
        const display = (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap tnum', tone)}>
            {formatNumber(p.stock)}
            <span className="text-xs font-semibold opacity-80">{words}</span>
          </span>
        );
        return p.hasVariants ? (
          <span className="pr-1.5">{display}</span>
        ) : (
          <QuickEdit
            label={`stock of ${p.name}`}
            value={p.stock}
            display={display}
            disabled={busy[`stock-${p.id}`]}
            onSave={(stock) => save(p, { stock }, `Stock set to ${formatNumber(stock)}`, `stock-${p.id}`)}
          />
        );
      },
    },
    {
      key: 'margin',
      header: 'Margin',
      numeric: true,
      cell: (p) => {
        const margin = marginOf(p.regularPrice, p.costPrice);
        if (!margin) return <span className="type-small text-muted">No cost</span>;
        return (
          <span className="grid justify-items-end gap-1">
            <span className={cn('font-semibold whitespace-nowrap tnum', margin.amount < 0 && 'text-stop')}>{formatINR(margin.amount)}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tnum', margin.amount < 0 ? 'bg-stop-soft text-stop' : 'bg-surface text-muted')}>{margin.percent}%</span>
          </span>
        );
      },
    },
    {
      key: 'active',
      header: 'In shop',
      align: 'center',
      cell: (p) => (
        <Switch
          aria-label={`Show ${p.name} in the shop`}
          checked={p.isActive}
          disabled={busy[`active-${p.id}`]}
          onChange={(event) =>
            void save(
              p,
              { isActive: event.target.checked },
              event.target.checked ? 'Back in the shop' : 'Hidden from the shop',
              `active-${p.id}`,
            ).catch(() => undefined)
          }
          className="inline-flex"
        />
      ),
    },
    {
      key: 'featured',
      header: 'Featured',
      align: 'center',
      cell: (p) => (
        <Switch
          aria-label={`Feature ${p.name} on the home page`}
          checked={p.isFeatured}
          disabled={busy[`featured-${p.id}`]}
          onChange={(event) =>
            void save(
              p,
              { isFeatured: event.target.checked },
              event.target.checked ? 'Featured' : 'No longer featured',
              `featured-${p.id}`,
            ).catch(() => undefined)
          }
          className="inline-flex"
        />
      ),
    },
  ];

  const filtered = Boolean(q || category || status);
  const groups = subcategoryGroups(categories.data);
  const hrefFor = (n: number) => {
    const next = new URLSearchParams(params);
    if (n > 1) next.set('page', String(n));
    else next.delete('page');
    const search = next.toString();
    return `/admin/products${search ? `?${search}` : ''}`;
  };

  let body: ReactNode;
  if (error && !data) {
    body = <ErrorState error={error} onRetry={() => refetch()} title="Could not load products" />;
  } else {
    body = (
      <div className={cn('transition-opacity dur-quick', isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData || isPending}>
        <Table
          caption="Products"
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(p) => p.id}
          loading={isPending}
          skeletonRows={6}
          empty={
            filtered ? (
              <EmptyState
                size="sm"
                title="No products match"
                description="Try another word or SKU, or clear the filters."
                actions={
                  <Button variant="outline" to="/admin/products">
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No products yet"
                description="Add the first part: name, price, photos and the honest label."
                actions={
                  <Button to="/admin/products/new" iconLeft={<Plus aria-hidden />}>
                    Add product
                  </Button>
                }
              />
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Products"
        meta={data ? pluralize(data.total, filtered ? 'match' : 'product', filtered ? 'matches' : 'products') : undefined}
        actions={
          <Button to="/admin/products/new" iconLeft={<Plus aria-hidden />}>
            Add product
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <Field label="Search products" labelHidden>
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search by name or SKU"
            leading={<Search aria-hidden />}
            autoComplete="off"
            enterKeyHint="search"
          />
        </Field>
        <Field label="Category" labelHidden>
          <Select value={category} onChange={(event) => update({ category: event.target.value, page: '' })}>
            <option value="">All categories</option>
            {groups.map(({ parent, children }) => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.slug}>All of {parent.name}</option>
                {children.map((child) => (
                  <option key={child.id} value={child.slug}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
      </div>

      <Tabs value={status} onValueChange={(value) => update({ status: value, page: '' })} className="mt-4">
        <TabList label="Filter by status">
          {STATUSES.map((s) => (
            <Tab key={s.value || 'all'} value={s.value}>
              {s.value === 'low_stock' && <TriangleAlert aria-hidden className="size-4 text-warn" />}
              {s.label}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={status} className="pt-4 focus-visible:outline-none">
          {body}
        </TabPanel>
      </Tabs>

      {data && data.pages > 1 && (
        <Pagination
          className="mt-8"
          page={data.page}
          pageCount={data.pages}
          hrefFor={hrefFor}
          label="Product pages"
        />
      )}
    </div>
  );
}
