import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CircleX, ExternalLink, Mail } from 'lucide-react';
import { Badge, Button, EmptyState, Tab, TabList, TabPanel, Table, Tabs, toast, type TableColumn } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { ProductSummary, StockAlert } from '@/types/api';
import {
  Ago,
  CustomerWhatsApp,
  DeskPage,
  ListError,
  ListPager,
  ProductThumb,
  QueueSkeleton,
  useDeskRefresh,
  usePageParam,
  useParamState,
  useProductMap,
  useStoreName,
} from './desk/common';
import { backInStock } from './desk/messages';

const VIEWS = ['waiting', 'notified'] as const;
type View = (typeof VIEWS)[number];
const WAITING_LIMIT = 100;
const HISTORY_SIZE = 50;

interface AlertGroup {
  key: string;
  productId: number;
  productName: string;
  productSlug: string;
  variantId: number | null;
  stock: number;
  alerts: StockAlert[];
}

function groupAlerts(alerts: readonly StockAlert[]): AlertGroup[] {
  const groups = new Map<string, AlertGroup>();
  for (const alert of alerts) {
    const key = `${alert.productId}:${alert.variantId ?? 0}`;
    const group = groups.get(key);
    if (group) group.alerts.push(alert);
    else
      groups.set(key, {
        key,
        productId: alert.productId,
        productName: alert.productName,
        productSlug: alert.productSlug,
        variantId: alert.variantId,
        stock: alert.stock,
        alerts: [alert],
      });
  }
  // Back in stock first (those can be answered now), then the longest queues.
  return [...groups.values()].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.alerts.length - a.alerts.length);
}

/** People waiting for sold-out parts, grouped by part, with the ones back in stock first. */
export default function StockAlertsPage() {
  useDocumentMeta({ title: 'Stock alerts', noindex: true });
  const [view, setView] = useParamState<View>('tab', VIEWS, 'waiting');

  return (
    <DeskPage title="Stock alerts" description="Shoppers who asked to be told when a sold-out part comes back. Restock, tell them, mark them notified.">
      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabList label="Stock alerts">
          <Tab value="waiting">Waiting</Tab>
          <Tab value="notified">Notified</Tab>
        </TabList>
      <TabPanel value={view} className="pt-6">{view === 'waiting' ? <Waiting /> : <Notified />}</TabPanel>
      </Tabs>
    </DeskPage>
  );
}

function useMarkNotified() {
  const refresh = useDeskRefresh();
  return useMutation<unknown, ApiError, StockAlert[]>({
    mutationFn: (alerts) => Promise.all(alerts.map((alert) => api.admin.stockAlerts.update(alert.id, { status: 'notified' }))),
    onSuccess: async (_data, alerts) => {
      toast.success(alerts.length > 1 ? `${alerts.length} people marked notified` : 'Marked notified', {
        action: {
          label: 'Undo',
          onClick: () => {
            Promise.all(alerts.map((alert) => api.admin.stockAlerts.update(alert.id, { status: 'waiting' })))
              .then(() => refresh(queryKeys.admin.stockAlerts.all()))
              .catch((error: unknown) => toast.error('Could not undo', { description: error instanceof Error ? error.message : undefined }));
          },
        },
      });
      await refresh(queryKeys.admin.stockAlerts.all());
    },
    onError: (error) => toast.error('Could not mark notified', { description: error.message }),
  });
}

function Waiting() {
  const query = useQuery({
    queryKey: queryKeys.admin.stockAlerts.list({ status: 'waiting', limit: WAITING_LIMIT }),
    queryFn: ({ signal }) => api.admin.stockAlerts.list({ status: 'waiting', limit: WAITING_LIMIT }, { signal }),
  });
  const items = query.data?.items ?? [];
  const groups = groupAlerts(items);
  const { map } = useProductMap(groups.map((group) => group.productId));
  const mark = useMarkNotified();

  if (query.isPending) return <QueueSkeleton count={3} />;
  if (query.error) return <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the stock alerts" />;
  if (groups.length === 0) {
    return <EmptyState title="Nobody waiting" description="When a shopper asks to be told about a sold-out part, they show here under that part." />;
  }

  const ready = groups.filter((group) => group.stock > 0);
  const out = groups.filter((group) => group.stock <= 0);
  const busyIds = mark.isPending ? new Set(mark.variables?.map((alert) => alert.id)) : new Set<number>();

  return (
    <div className="grid gap-10">
      {ready.length > 0 && (
        <section aria-labelledby="alerts-ready" className="grid gap-3">
          <h2 id="alerts-ready" className="type-h2">
            Back in stock
          </h2>
          <p className="max-w-prose text-muted">These can be answered now. Tell each person, then mark them notified.</p>
          {ready.map((group) => (
            <GroupCard key={group.key} group={group} product={map.get(group.productId)} busyIds={busyIds} onMark={(alerts) => mark.mutate(alerts)} />
          ))}
        </section>
      )}
      {out.length > 0 && (
        <section aria-labelledby="alerts-out" className="grid gap-3">
          <h2 id="alerts-out" className="type-h2">
            Still sold out
          </h2>
          <p className="max-w-prose text-muted">The longest queues first: a good guide to what to reorder.</p>
          {out.map((group) => (
            <GroupCard key={group.key} group={group} product={map.get(group.productId)} busyIds={busyIds} onMark={(alerts) => mark.mutate(alerts)} />
          ))}
        </section>
      )}
      {query.data.total > items.length && (
        <p className="type-small text-muted tnum">
          Showing the newest {items.length} of {query.data.total} requests.
        </p>
      )}
    </div>
  );
}

interface GroupCardProps {
  group: AlertGroup;
  product: ProductSummary | undefined;
  busyIds: Set<number>;
  onMark: (alerts: StockAlert[]) => void;
}

function GroupCard({ group, product, busyIds, onMark }: GroupCardProps) {
  const storeName = useStoreName();
  const inStock = group.stock > 0;
  const message = backInStock(group, storeName);
  const groupBusy = group.alerts.every((alert) => busyIds.has(alert.id));

  return (
    <article aria-labelledby={`alert-${group.key}`} className="grid gap-4 border border-line p-4 sm:p-5">
      <header className="flex gap-4">
        <ProductThumb product={product} name={group.productName} />
        <div className="grid min-w-0 flex-1 content-start gap-1">
          <h3 id={`alert-${group.key}`} className="type-h3 break-words">
            <Link
              to={`/p/${group.productSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-baseline gap-1 rounded-control underline-offset-4 hover:underline"
            >
              {group.productName}
              <ExternalLink aria-hidden className="size-3.5 shrink-0 self-center" />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          </h3>
          {group.variantId !== null && <p className="type-small text-muted">Waiting on one size or colour of this part.</p>}
          <p className="flex flex-wrap items-center gap-2 pt-1">
            {inStock ? (
              <Badge tone="fit" variant="solid" className="tnum">
                In stock: {formatNumber(group.stock)}
              </Badge>
            ) : (
              <Badge tone="stop" className="tnum" icon={<CircleX aria-hidden />}>
                Out of stock
              </Badge>
            )}
            <span className="font-bold tnum">{pluralize(group.alerts.length, 'person', 'people')} waiting</span>
          </p>
        </div>
      </header>

      <ul className="grid divide-y divide-line border-y border-line">
        {group.alerts.map((alert) => {
          const busy = busyIds.has(alert.id);
          return (
            <li key={alert.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="font-bold break-all tnum">{alert.phone ? formatPhone(alert.phone) : alert.email || 'No contact given'}</span>
                <span className="type-small text-muted">
                  {alert.phone && alert.email ? `${alert.email} · ` : ''}
                  asked <Ago iso={alert.createdAt} />
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {inStock && (
                  <CustomerWhatsApp phone={alert.phone} text={message} size="sm" variant="primary">
                    Tell them
                  </CustomerWhatsApp>
                )}
                {inStock && alert.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={<Mail />}
                    href={`mailto:${encodeURIComponent(alert.email)}?subject=${encodeURIComponent(`${group.productName} is back in stock`)}&body=${encodeURIComponent(message)}`}
                  >
                    Email
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onMark([alert])} loading={busy && !groupBusy} disabled={busy}>
                  Mark notified
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {inStock && group.alerts.length > 1 && (
        <Button variant="dark" onClick={() => onMark(group.alerts)} loading={groupBusy} className="justify-self-start max-sm:w-full">
          Mark all {group.alerts.length} notified
        </Button>
      )}
    </article>
  );
}

function Notified() {
  const [page, setPage] = usePageParam();
  const refresh = useDeskRefresh();
  const listQuery = { status: 'notified' as const, page, limit: HISTORY_SIZE };
  const query = useQuery({
    queryKey: queryKeys.admin.stockAlerts.list(listQuery),
    queryFn: ({ signal }) => api.admin.stockAlerts.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });
  const reopen = useMutation<StockAlert, ApiError, StockAlert>({
    mutationFn: (alert) => api.admin.stockAlerts.update(alert.id, { status: 'waiting' }),
    onSuccess: async () => {
      toast.success('Back on the waiting list');
      await refresh(queryKeys.admin.stockAlerts.all());
    },
    onError: (error) => toast.error('Could not move it back', { description: error.message }),
  });

  const columns: TableColumn<StockAlert>[] = [
    { key: 'product', header: 'Part', primary: true, cell: (row) => <span className="break-words">{row.productName}</span> },
    {
      key: 'who',
      header: 'Contact',
      cell: (row) => <span className="break-all tnum">{row.phone ? formatPhone(row.phone) : row.email || 'None'}</span>,
    },
    { key: 'asked', header: 'Asked', cell: (row) => <Ago iso={row.createdAt} /> },
    { key: 'stock', header: 'Stock now', numeric: true, cell: (row) => formatNumber(row.stock) },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => reopen.mutate(row)} loading={reopen.isPending && reopen.variables?.id === row.id}>
          Move back
        </Button>
      ),
    },
  ];

  if (query.error) return <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the stock alerts" />;
  return (
    <div className={cn('transition-opacity dur-base', query.isPlaceholderData && 'opacity-60')}>
      <Table
        caption="People already told"
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        loading={query.isPending}
        dense
        empty={<EmptyState size="sm" title="Nobody notified yet" description="People you mark notified are listed here." />}
      />
      {query.data && <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Notified" />}
    </div>
  );
}
