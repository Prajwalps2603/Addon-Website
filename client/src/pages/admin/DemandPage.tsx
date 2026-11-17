import type { ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { TimingRow, TimingTower } from '@/components/brand';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Badge, Button, EmptyState, Skeleton, Table, type TableColumn } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize, relativeDay } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { DemandReport } from '@/types/api';
import { BarList } from './shell/BarList';
import { PurchaseOrder } from './shell/PurchaseOrder';
import { RangeSwitch, rangeLabel, useRangeParam } from './shell/range';

type SearchRow = DemandReport['topSearches'][number];

export default function DemandPage() {
  useDocumentMeta({ title: 'Demand radar', noindex: true });
  const [days, setDays] = useRangeParam();

  const { data, error, isPending, isPlaceholderData, refetch } = useQuery({
    queryKey: queryKeys.admin.demand(days),
    queryFn: ({ signal }) => api.admin.demand(days, { signal }),
    placeholderData: keepPreviousData,
  });

  const nothingYet =
    data &&
    data.reorder.length === 0 &&
    data.topSearches.length === 0 &&
    data.missedSearches.length === 0 &&
    data.mostWaitedFor.length === 0 &&
    data.unansweredCars.length === 0;

  let body: ReactNode;
  if (isPending) body = <DemandSkeleton />;
  else if (error && !data) body = <ErrorState error={error} onRetry={() => refetch()} title="Could not load the demand radar" />;
  else if (!data || nothingYet)
    body = (
      <EmptyState
        title="Nothing on the radar yet"
        description={`No searches, waiting lists, unanswered fitment questions or low stock ${rangeLabel(days).toLowerCase()}. Try a longer range.`}
        actions={
          days !== 365 ? (
            <Button variant="dark" onClick={() => setDays(365)}>
              Look at the last 12 months
            </Button>
          ) : undefined
        }
      />
    );
  else
    body = (
      <div className={cn('grid gap-5 transition-opacity dur-base', isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData}>
        <ReorderSection report={data} />

        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            id="missed"
            title="Stock these next"
            description="Searches that found nothing, by how often they were made."
            action={
              <Button variant="link" size="sm" to="/admin/settings#search-words" iconRight={<ArrowRight aria-hidden />}>
                Teach search a word
              </Button>
            }
          >
            {data.missedSearches.length === 0 ? (
              <Quiet>Every search found something.</Quiet>
            ) : (
              <TimingTower label="Searches that found nothing, most frequent first">
                {data.missedSearches.map((row, index) => (
                  <TimingRow
                    key={row.query}
                    position={index + 1}
                    title={`“${row.query}”`}
                    subtitle={`Last searched ${relativeDay(row.lastSeen)}`}
                    value={pluralize(row.count, 'search', 'searches')}
                  />
                ))}
              </TimingTower>
            )}
          </Section>

          <Section id="waited" title="Most waited-for" description="People who asked to be told when it is back.">
            {data.mostWaitedFor.length === 0 ? (
              <Quiet>No one is waiting on a product.</Quiet>
            ) : (
              <TimingTower label="Products with the most back-in-stock requests">
                {data.mostWaitedFor.map((row, index) => (
                  <TimingRow
                    key={row.productId}
                    position={index + 1}
                    title={row.name}
                    subtitle={row.stock > 0 ? `${formatNumber(row.stock)} in stock now: tell them` : 'Sold out'}
                    value={`${formatNumber(row.waiting)} waiting`}
                    delta={row.stock > 0 ? { label: 'Back in stock', tone: 'gain' } : undefined}
                    to={`/admin/products/${row.productId}`}
                  />
                ))}
              </TimingTower>
            )}
          </Section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section
            id="cars"
            title="Cars with no answer yet"
            description="Cars shoppers asked about that have no fit verdict or parts."
            action={
              data.unansweredCars.length > 0 ? (
                <Button variant="link" size="sm" to="/admin/fitment-desk" iconRight={<ArrowRight aria-hidden />}>
                  Fitment Desk
                </Button>
              ) : undefined
            }
          >
            {data.unansweredCars.length === 0 ? (
              <Quiet>Every car shoppers asked about has an answer.</Quiet>
            ) : (
              <BarList
                label="Cars with unanswered questions"
                rows={data.unansweredCars.map((row) => ({
                  key: row.vehicleLabel,
                  label: row.vehicleLabel,
                  amount: row.questions,
                  value: pluralize(row.questions, 'question'),
                  to: '/admin/fitment-desk',
                }))}
              />
            )}
          </Section>

          <Section id="searches" title="What people searched for" description="Most frequent searches and how much they found on average.">
            <Table
              caption="Most frequent searches"
              columns={SEARCH_COLUMNS}
              rows={data.topSearches}
              rowKey={(row) => row.query}
              dense
              empty={<Quiet>No searches {rangeLabel(days).toLowerCase()}.</Quiet>}
            />
          </Section>
        </div>
      </div>
    );

  return (
    <div className="container-page">
      <PageHeader
        variant="plain"
        title="Demand radar"
        meta={rangeLabel(days)}
        description="The sales the shop could not make: what to stock, who is waiting and which cars need an answer."
        actions={<RangeSwitch value={days} onChange={setDays} />}
      />
      {body}
    </div>
  );
}

const SEARCH_COLUMNS: TableColumn<SearchRow>[] = [
  { key: 'query', header: 'Search', primary: true, cell: (row) => <span className="font-bold">{row.query}</span> },
  { key: 'count', header: 'Times', numeric: true, cell: (row) => formatNumber(row.count) },
  {
    key: 'results',
    header: 'Results found',
    numeric: true,
    cell: (row) =>
      row.avgResults < 1 ? (
        <Badge tone="warn" variant="soft">
          Almost none
        </Badge>
      ) : (
        formatNumber(Math.round(row.avgResults))
      ),
  },
];

function ReorderSection({ report }: { report: DemandReport }) {
  const products = report.reorder.reduce((sum, supplier) => sum + supplier.items.length, 0);
  return (
    <Section
      id="reorder"
      title="Reorder list"
      description={
        report.reorder.length > 0
          ? `${pluralize(products, 'product')} low or sold out, from ${pluralize(report.reorder.length, 'supplier')}. Quantities are suggestions: check them before sending.`
          : undefined
      }
    >
      {report.reorder.length === 0 ? (
        <Quiet>Nothing is low. Every product is above its minimum stock.</Quiet>
      ) : (
        <div className="grid gap-4">
          {report.reorder.map((supplier) => (
            <PurchaseOrder key={supplier.supplier || '(none)'} supplier={supplier} />
          ))}
        </div>
      )}
    </Section>
  );
}

function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`demand-${id}`} className="min-w-0 rounded-[24px] bg-surface p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="grid gap-1">
          <h2 id={`demand-${id}`} className="text-xl font-black italic uppercase">
            {title}
          </h2>
          {description && <p className="max-w-prose text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="rounded-[14px] bg-raised px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function DemandSkeleton() {
  return (
    <div className="grid gap-12" aria-busy="true">
      <span className="sr-only" role="status">
        Loading the demand radar
      </span>
      <div className="grid gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-13 w-full sm:w-80" />
      </div>
      <div className="grid gap-12 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, column) => (
          <div key={column} className="grid gap-3">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
