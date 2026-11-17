import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { Store, Wrench, X } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { slotLabel } from '@/components/studio';
import { dayChip } from '@/components/studio/studioTime';
import { Button, EmptyState, Field, Input, Pagination, Select, Tab, TabList, TabPanel, Table, Tabs, type TableColumn } from '@/components/ui';
import { api, type AdminOrderQuery } from '@/lib/api';
import { formatDate, formatINR, formatNumber, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminOrderListItem, OrderStatus, PaymentStatus } from '@/types/api';
import { PLAIN_DAY } from './sales/dates';
import { ExportOrdersButton } from './sales/ExportOrders';
import { METHOD_SHORT, ORDER_STATUS_LABELS, OrderStatusBadge, PAYMENT_STATUS_LABELS, PaymentStatusBadge } from './sales/status';
import { SearchBox, useUrlFilters } from './sales/urlState';

const PAGE_SIZE = 25;

/** The tabs in the order the work flows. '' is every order. */
const STATUS_TABS: readonly ('' | OrderStatus)[] = [
  '',
  'placed',
  'pending_payment',
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
];

const TAB_LABELS: Record<'' | OrderStatus, string> = {
  '': 'All',
  ...ORDER_STATUS_LABELS,
  placed: 'To confirm',
};

const PAYMENT_OPTIONS = (Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((value) => ({
  value,
  label: PAYMENT_STATUS_LABELS[value],
}));

const FILTER_KEYS = ['q', 'status', 'payment', 'from', 'to'] as const;

function isStatus(value: string): value is OrderStatus {
  return value in ORDER_STATUS_LABELS;
}

function isPayment(value: string): value is PaymentStatus {
  return value in PAYMENT_STATUS_LABELS;
}

const COLUMNS: TableColumn<AdminOrderListItem>[] = [
  {
    key: 'number',
    header: 'Order',
    primary: true,
    cell: (order) => (
      <span className="flex flex-wrap items-center justify-between gap-2">
        <Link to={`/admin/orders/${encodeURIComponent(order.orderNumber)}`} className="focus-ring inline-flex rounded-full bg-surface px-2.5 py-1 font-mono text-xs font-bold whitespace-nowrap transition-colors hover:bg-ink hover:text-page">
          {order.orderNumber}
        </Link>
        <span className="flex gap-1.5 md:hidden">
          <OrderStatusBadge status={order.status} size="sm" />
        </span>
      </span>
    ),
  },
  {
    key: 'date',
    header: 'Placed',
    cell: (order) => (
      <span className="tnum whitespace-nowrap">
        {formatDate(order.createdAt, { year: false })}
        <span className="text-muted"> {formatTime(order.createdAt)}</span>
      </span>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    cell: (order) => (
      <span className="grid">
        <span className="font-bold whitespace-nowrap">{order.customerName}</span>
        <span className="type-small text-muted tnum">{order.phone}</span>
      </span>
    ),
  },
  {
    key: 'city',
    header: 'Delivery',
    cell: (order) =>
      order.fulfilment === 'studio' ? (
        <span className="grid">
          <span className="inline-flex items-center gap-1.5 font-bold whitespace-nowrap">
            <Wrench aria-hidden className="size-4 shrink-0" />
            Studio fitting
          </span>
          {order.studioSlot && (
            <span className="type-small text-muted tnum">
              {dayChip(order.studioSlot.date).day} {dayChip(order.studioSlot.date).month}, {slotLabel(order.studioSlot.slot)}
            </span>
          )}
        </span>
      ) : order.fulfilment === 'pickup' ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Store aria-hidden className="size-4 shrink-0" />
          Collect at studio
        </span>
      ) : (
        [order.city, order.state].filter(Boolean).join(', ') || '-'
      ),
  },
  { key: 'items', header: 'Items', numeric: true, cell: (order) => formatNumber(order.itemCount) },
  { key: 'total', header: 'Total', numeric: true, cell: (order) => <span className="font-bold whitespace-nowrap">{formatINR(order.total)}</span> },
  {
    key: 'due',
    header: 'Due',
    numeric: true,
    cell: (order) => (order.amountDue > 0 ? <span className="font-bold text-warn">{formatINR(order.amountDue)}</span> : <span className="text-muted">Nil</span>),
  },
  { key: 'status', header: 'Status', className: 'max-md:hidden', cell: (order) => <OrderStatusBadge status={order.status} /> },
  {
    key: 'payment',
    header: 'Payment',
    cell: (order) => (
      <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap md:justify-start">
        <PaymentStatusBadge status={order.paymentStatus} />
        <span className="type-small text-muted">{METHOD_SHORT[order.paymentMethod]}</span>
      </span>
    ),
  },
];

export default function OrdersPage() {
  useDocumentMeta({ title: 'Orders', noindex: true });
  const { values, page, set, hrefFor } = useUrlFilters(FILTER_KEYS);

  const status = isStatus(values.status) ? values.status : '';
  const payment = isPayment(values.payment) ? values.payment : undefined;
  const from = PLAIN_DAY.test(values.from) ? values.from : undefined;
  const to = PLAIN_DAY.test(values.to) ? values.to : undefined;
  const base: AdminOrderQuery = { q: values.q || undefined, paymentStatus: payment, from, to };
  const query: AdminOrderQuery = { ...base, status: status || undefined, page, limit: PAGE_SIZE };

  const list = useQuery({
    queryKey: queryKeys.admin.orders.list(query),
    queryFn: ({ signal }) => api.admin.orders.list(query, { signal }),
    placeholderData: keepPreviousData,
  });

  // One tiny request per tab for its count, with the same search and filters.
  const counts = useQueries({
    queries: STATUS_TABS.map((tab) => {
      const countQuery: AdminOrderQuery = { ...base, status: tab || undefined, page: 1, limit: 1 };
      return {
        queryKey: queryKeys.admin.orders.list(countQuery),
        queryFn: ({ signal }: { signal: AbortSignal }) => api.admin.orders.list(countQuery, { signal }),
        placeholderData: keepPreviousData,
      };
    }),
  });

  const filtered = Boolean(values.q || payment || from || to);
  const clearFilters = () => set({ q: null, payment: null, from: null, to: null });

  const data = list.data;
  const empty = filtered ? (
    <EmptyState
      size="sm"
      title="No orders match"
      description="Nothing fits this search and these filters. Clear them to see every order."
      actions={
        <Button variant="outline" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      title={status ? `No orders are ${ORDER_STATUS_LABELS[status].toLowerCase()}` : 'No orders yet'}
      description={status ? 'Nothing is waiting at this step.' : 'Orders appear here the moment a customer checks out.'}
    />
  );

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Orders"
        meta={data ? `${formatNumber(data.total)} ${status ? TAB_LABELS[status].toLowerCase() : 'in all'}` : undefined}
        actions={<ExportOrdersButton from={from} to={to} />}
      />

      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-end">
        <SearchBox
          label="Search orders"
          placeholder="Order number, name or phone"
          value={values.q}
          onSearch={(q) => set({ q })}
          className="col-span-full md:col-span-1"
        />
        <div className="grid grid-cols-2 gap-3 md:contents">
          <Field label="Payment" className="col-span-2 md:col-span-1">
            <Select
              placeholder="Any payment state"
              options={PAYMENT_OPTIONS}
              value={payment ?? ''}
              onChange={(event) => set({ payment: event.target.value })}
            />
          </Field>
          <Field label="From">
            <Input type="date" value={from ?? ''} max={to} onChange={(event) => set({ from: event.target.value })} className="tnum" />
          </Field>
          <Field label="To">
            <Input type="date" value={to ?? ''} min={from} onChange={(event) => set({ to: event.target.value })} className="tnum" />
          </Field>
        </div>
      </div>
      {filtered && (
        <div className="mt-2">
          <Button variant="ghost" size="sm" iconLeft={<X aria-hidden />} onClick={clearFilters}>
            Clear search and filters
          </Button>
        </div>
      )}

      <Tabs value={status || 'all'} onValueChange={(next) => set({ status: next === 'all' ? null : next })} className="mt-6">
        <TabList label="Order status">
          {STATUS_TABS.map((tab, index) => (
            <Tab key={tab || 'all'} value={tab || 'all'} count={counts[index]?.data?.total}>
              {TAB_LABELS[tab]}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={status || 'all'} className="pt-0">
          {list.error && !data ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Could not load the orders" className="py-10" />
          ) : (
            <div className={list.isPlaceholderData ? 'opacity-60 transition-opacity dur-base' : 'transition-opacity dur-base'} aria-busy={list.isFetching || undefined}>
              <Table
                columns={COLUMNS}
                rows={data?.items ?? []}
                rowKey={(order) => order.orderNumber}
                caption={`Orders${status ? `: ${TAB_LABELS[status]}` : ''}`}
                loading={list.isPending}
                skeletonRows={8}
                empty={<div className="py-10">{empty}</div>}
                dense
                className="max-md:mt-4"
              />
            </div>
          )}
          {data && data.pages > 1 && (
            <Pagination page={data.page} pageCount={data.pages} hrefFor={hrefFor} label="Orders" className="mt-6" />
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
