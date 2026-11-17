import { lazy, Suspense, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleX, Pencil } from 'lucide-react';
import { Link } from 'react-router';
import { TimingRow, TimingTower } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Badge, Button, Skeleton, Stat, Table, type BadgeToneName, type TableColumn } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber, pluralize } from '@/lib/format';
import { ORDER_PROGRESS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/labels';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminStats, OrderStatus } from '@/types/api';
import { BarList } from './shell/BarList';
import { RangeSwitch, rangeLabel, useRangeParam } from './shell/range';
import { SetupChecklist } from './shell/SetupChecklist';
import { ORDER_STATUS_TONE } from './shell/statusTone';
import { TodayAtStudio } from './studio/TodayAtStudio';

const RevenueChart = lazy(() => import('./shell/RevenueChart'));

type LowStockRow = AdminStats['lowStock'][number];

/** Every dashboard section sits on a soft rounded panel. */
const PANEL = 'rounded-[22px] bg-surface p-5 md:p-6';

export default function DashboardPage() {
  useDocumentMeta({ title: 'Dashboard', noindex: true });
  const [days, setDays] = useRangeParam();
  const settings = useSettings();

  const { data, error, isPending, isPlaceholderData, refetch } = useQuery({
    queryKey: queryKeys.admin.stats(days),
    queryFn: ({ signal }) => api.admin.stats(days, { signal }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="container-page">
      <PageHeader
        variant="plain"
        title="Dashboard"
        meta={rangeLabel(days)}
        actions={<RangeSwitch value={days} onChange={setDays} />}
      />

      <div className="grid gap-10 md:gap-14">
        {settings.data?.hasDemoData && <SetupChecklist />}

        {error && !data ? (
          <ErrorState error={error} onRetry={() => refetch()} title="Could not load the numbers" />
        ) : (
          <div className={cn('grid gap-4 transition-opacity dur-base md:gap-5', isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData}>
            {data && <TodayBand stats={data} />}
            <TodayAtStudio />
            <Kpis stats={data} loading={isPending} days={days} />
            <ChartSection stats={data} days={days} />

            <div className="grid gap-4 lg:grid-cols-2">
              <StatusSection stats={data} />
              <PaymentSection stats={data} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TopProducts stats={data} />
              <ListSection
                title="Top categories"
                stats={data}
                empty="No category sales in this range."
                rows={(s) =>
                  s.topCategories.map((row) => ({
                    key: row.name,
                    label: row.name,
                    amount: row.revenue,
                    value: formatINR(row.revenue),
                    note: pluralize(row.units, 'unit'),
                  }))
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ListSection
                title="Top states"
                stats={data}
                empty="No orders in this range."
                rows={(s) =>
                  s.topStates.map((row) => ({
                    key: row.state,
                    label: row.state,
                    amount: row.revenue,
                    value: formatINR(row.revenue),
                    note: pluralize(row.orders, 'order'),
                  }))
                }
              />
              <ListSection
                title="Top cars"
                description="The car on the order, where the shopper had one set."
                stats={data}
                empty="No orders named a car in this range."
                rows={(s) =>
                  s.topVehicles.map((row) => ({
                    key: row.vehicle,
                    label: row.vehicle,
                    amount: row.orders,
                    value: pluralize(row.orders, 'order'),
                  }))
                }
              />
            </div>

            <LowStock stats={data} loading={isPending} />
          </div>
        )}
      </div>
    </div>
  );
}

/** The one thing to do next: people waiting for a message, orders waiting for action. */
function TodayBand({ stats }: { stats: AdminStats }) {
  const followUps = stats.openCounts.followUps;
  const pending = stats.pendingOrders;
  if (followUps === 0 && pending === 0) return null;
  return (
    <section aria-label="Waiting for you" className="plane-brand flex flex-wrap items-center justify-between gap-4 rounded-[22px] px-5 py-5 md:px-7">
      <div className="grid gap-1">
        <p className="type-h3">
          {followUps > 0 ? `${pluralize(followUps, 'person', 'people')} to message today` : 'No one to message today'}
        </p>
        {pending > 0 && (
          <p className="type-small">
            <Link to="/admin/orders" className="font-bold underline underline-offset-4 focus-ring">
              {pluralize(pending, 'order')} waiting to be confirmed or shipped
            </Link>
          </p>
        )}
      </div>
      {followUps > 0 && (
        <Button size="lg" variant="dark" to="/admin/followups" iconRight={<ArrowRight aria-hidden />} className="rounded-full max-sm:w-full">
          Open follow-ups
        </Button>
      )}
    </section>
  );
}

function Kpis({ stats, loading, days }: { stats: AdminStats | undefined; loading: boolean; days: number }) {
  const range = days === 365 ? 'in 12 months' : `in ${days} days`;
  const marginPct =
    stats && stats.margin !== null && stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : null;
  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="sr-only">
        Key figures, {rangeLabel(days).toLowerCase()}
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={formatINR(stats?.revenue)} hint={range} to="/admin/orders" loading={loading} />
        <Stat label="Orders" value={formatNumber(stats?.orders)} hint={range} to="/admin/orders" loading={loading} />
        <Stat label="Average order" value={formatINR(stats?.averageOrderValue)} loading={loading} />
        <Stat label="Units sold" value={formatNumber(stats?.unitsSold)} loading={loading} />
        <Stat label="Money collected" value={formatINR(stats?.collected)} hint="Confirmed received" loading={loading} />
        <Stat
          label="COD cash outstanding"
          value={formatINR(stats?.codOutstanding)}
          hint="Still with couriers"
          to="/admin/orders?payment=pending"
          loading={loading}
        />
        {stats && stats.margin === null ? (
          <Stat label="Margin" value="Not known" hint="Add cost prices to see margin" to="/admin/products" loading={loading} />
        ) : (
          <Stat
            label="Margin"
            value={formatINR(stats?.margin ?? 0)}
            hint={marginPct !== null ? `${marginPct}% of revenue, where cost is known` : undefined}
            loading={loading}
          />
        )}
        <Stat label="New customers" value={formatNumber(stats?.newCustomers)} hint={range} to="/admin/customers" loading={loading} />
      </div>
    </section>
  );
}

function SectionTitle({ id, title, description, action }: { id: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="grid gap-0.5">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {description && <p className="type-small text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="rounded-[14px] bg-raised px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function ChartSection({ stats, days }: { stats: AdminStats | undefined; days: number }) {
  const hasSales = stats ? stats.series.some((point) => point.orders > 0 || point.revenue > 0) : false;
  return (
    <section aria-labelledby="chart-heading" className={PANEL}>
      <SectionTitle
        id="chart-heading"
        title="Revenue and orders"
        description={days > 90 ? 'Weekly totals' : 'Daily totals'}
        action={
          <ul className="type-small flex gap-4 text-muted" aria-hidden>
            <li className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-[3px] bg-ink" /> Revenue
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-info" /> Orders
            </li>
          </ul>
        }
      />
      {!stats ? (
        <Skeleton className="h-64 w-full md:h-72" />
      ) : !hasSales ? (
        <Quiet>No orders in this range yet. The chart fills in as orders come in.</Quiet>
      ) : (
        <figure>
          <Suspense fallback={<Skeleton className="h-64 w-full md:h-72" />}>
            <RevenueChart series={stats.series} days={days} />
          </Suspense>
          <figcaption className="sr-only">
            {formatINR(stats.revenue)} from {pluralize(stats.orders, 'order')}, {rangeLabel(days).toLowerCase()}. Bars show revenue,
            the line shows orders.
          </figcaption>
        </figure>
      )}
    </section>
  );
}

const STATUS_FILL: Record<BadgeToneName, string> = {
  neutral: 'bg-line-strong',
  ink: 'bg-ink',
  pit: 'bg-brand',
  brand: 'bg-brand',
  fit: 'bg-fit',
  warn: 'bg-warn',
  stop: 'bg-stop',
  info: 'bg-info',
  best: 'bg-best',
};

const STATUS_ORDER: readonly OrderStatus[] = ['pending_payment', ...ORDER_PROGRESS, 'cancelled', 'returned'];

function StatusSection({ stats }: { stats: AdminStats | undefined }) {
  const rows = stats
    ? STATUS_ORDER.map((status) => ({ status, count: stats.byStatus.find((row) => row.status === status)?.count ?? 0 })).filter(
        (row) => row.count > 0,
      )
    : [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section aria-labelledby="status-heading" className={PANEL}>
      <SectionTitle id="status-heading" title="Orders by status" />
      {!stats ? (
        <ListSkeleton rows={3} />
      ) : total === 0 ? (
        <Quiet>No orders in this range.</Quiet>
      ) : (
        <div className="grid gap-3">
          <div aria-hidden className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
            {rows.map((row) => (
              <span
                key={row.status}
                className={STATUS_FILL[ORDER_STATUS_TONE[row.status]]}
                style={{ width: `${(row.count / total) * 100}%` }}
              />
            ))}
          </div>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {rows.map((row) => (
              <li key={row.status}>
                <Link
                  to={`/admin/orders?status=${row.status}`}
                  className="focus-ring-inset flex min-h-11 items-center justify-between gap-3 rounded-[12px] px-2 transition-colors hover:bg-raised"
                >
                  <Badge tone={ORDER_STATUS_TONE[row.status]} variant="soft">
                    {ORDER_STATUS_LABELS[row.status]}
                  </Badge>
                  <span className="tnum font-bold">{formatNumber(row.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PaymentSection({ stats }: { stats: AdminStats | undefined }) {
  return (
    <ListSection
      title="Orders by payment method"
      stats={stats}
      empty="No orders in this range."
      rows={(s) =>
        s.byPaymentMethod.map((row) => ({
          key: row.method,
          label: PAYMENT_METHOD_LABELS[row.method] ?? row.method,
          amount: row.count,
          value: pluralize(row.count, 'order'),
          note: formatINR(row.revenue),
        }))
      }
    />
  );
}

function ListSection({
  title,
  description,
  stats,
  rows,
  empty,
}: {
  title: string;
  description?: string;
  stats: AdminStats | undefined;
  rows: (stats: AdminStats) => Parameters<typeof BarList>[0]['rows'];
  empty: string;
}) {
  const id = `dash-${title.toLowerCase().replace(/\W+/g, '-')}`;
  const list = stats ? rows(stats) : [];
  return (
    <section aria-labelledby={id} className={PANEL}>
      <SectionTitle id={id} title={title} description={description} />
      {!stats ? <ListSkeleton /> : list.length === 0 ? <Quiet>{empty}</Quiet> : <BarList label={title} rows={list} />}
    </section>
  );
}

function TopProducts({ stats }: { stats: AdminStats | undefined }) {
  return (
    <section aria-labelledby="top-products-heading" className={PANEL}>
      <SectionTitle id="top-products-heading" title="Top products" description="Ranked by revenue" />
      {!stats ? (
        <ListSkeleton rows={5} />
      ) : stats.topProducts.length === 0 ? (
        <Quiet>No products sold in this range.</Quiet>
      ) : (
        <TimingTower label="Top products by revenue">
          {stats.topProducts.map((product, index) => (
            <TimingRow
              key={product.productId}
              position={index + 1}
              title={product.name}
              subtitle={`${pluralize(product.units, 'unit')} sold`}
              value={formatINR(product.revenue)}
              to={`/admin/products/${product.productId}`}
            />
          ))}
        </TimingTower>
      )}
    </section>
  );
}

const LOW_STOCK_COLUMNS: TableColumn<LowStockRow>[] = [
  {
    key: 'name',
    header: 'Product',
    primary: true,
    cell: (row) => (
      <Link to={`/admin/products/${row.productId}`} className="font-bold underline-offset-4 hover:underline focus-ring">
        {row.name}
      </Link>
    ),
  },
  { key: 'sku', header: 'SKU', cell: (row) => <span className="type-code">{row.sku}</span> },
  {
    key: 'stock',
    header: 'Stock',
    numeric: true,
    cell: (row) =>
      row.stock <= 0 ? (
        <Badge tone="stop" variant="soft" icon={<CircleX aria-hidden />}>
          Sold out
        </Badge>
      ) : (
        <span className="tnum">
          <span className="font-bold text-warn">{formatNumber(row.stock)}</span>
          <span className="text-muted"> of {formatNumber(row.threshold)} minimum</span>
        </span>
      ),
  },
  { key: 'supplier', header: 'Supplier', cell: (row) => row.supplier || <span className="text-muted">Not set</span> },
  {
    key: 'edit',
    header: <span className="sr-only">Edit</span>,
    align: 'right',
    cell: (row) => (
      <Button variant="outline" size="sm" to={`/admin/products/${row.productId}`} iconLeft={<Pencil aria-hidden />} aria-label={`Edit ${row.name}`}>
        Edit
      </Button>
    ),
  },
];

function LowStock({ stats, loading }: { stats: AdminStats | undefined; loading: boolean }) {
  const count = stats?.lowStock.length ?? 0;
  return (
    <section aria-labelledby="low-stock-heading" className={PANEL}>
      <SectionTitle
        id="low-stock-heading"
        title={count > 0 ? `Low stock (${count})` : 'Low stock'}
        description="At or below the minimum you set on each product."
        action={
          count > 0 ? (
            <Button variant="link" size="sm" to="/admin/demand" iconRight={<ArrowRight aria-hidden />}>
              Reorder list
            </Button>
          ) : undefined
        }
      />
      <Table
        caption="Products at or below their minimum stock"
        columns={LOW_STOCK_COLUMNS}
        rows={stats?.lowStock ?? []}
        rowKey={(row) => row.productId}
        loading={loading}
        dense
        empty={<Quiet>Every product is above its minimum stock.</Quiet>}
      />
    </section>
  );
}
