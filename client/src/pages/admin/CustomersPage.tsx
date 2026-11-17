import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, EmptyState, Pagination, Table, type TableColumn } from '@/components/ui';
import { api, type ListQuery } from '@/lib/api';
import { cn } from '@/lib/cn';
import { capitalize, formatDate, formatINR, formatNumber, relativeDay } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminCustomer } from '@/types/api';
import { CallButton, CustomerWhatsApp } from './sales/contact';
import { SearchBox, useUrlFilters } from './sales/urlState';

const PAGE_SIZE = 30;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

const COLUMNS: TableColumn<AdminCustomer>[] = [
  {
    key: 'name',
    header: 'Customer',
    primary: true,
    cell: (customer) => (
      <span className="grid min-w-0">
        <span className="font-bold">{customer.name || 'No name'}</span>
        <span className="type-small font-normal break-all text-muted">{customer.email}</span>
      </span>
    ),
  },
  { key: 'phone', header: 'Phone', cell: (customer) => (customer.phone ? <span className="tnum">{formatPhone(customer.phone)}</span> : <span className="text-muted">Not given</span>) },
  {
    key: 'orders',
    header: 'Orders',
    numeric: true,
    cell: (customer) =>
      customer.orderCount > 0 ? (
        <Link to={`/admin/orders?q=${encodeURIComponent(customer.phone || customer.email)}`} className="link focus-ring">
          {formatNumber(customer.orderCount)}
        </Link>
      ) : (
        <span className="text-muted">0</span>
      ),
  },
  { key: 'spent', header: 'Spent', numeric: true, cell: (customer) => <span className="font-bold">{formatINR(customer.totalSpent)}</span> },
  {
    key: 'last',
    header: 'Last order',
    cell: (customer) =>
      customer.lastOrderAt ? <span className="tnum whitespace-nowrap">{capitalize(relativeDay(customer.lastOrderAt))}</span> : <span className="text-muted">None yet</span>,
  },
  { key: 'joined', header: 'Joined', cell: (customer) => <span className="tnum whitespace-nowrap">{formatDate(customer.createdAt)}</span> },
  {
    key: 'contact',
    header: 'Contact',
    cell: (customer) =>
      customer.phone ? (
        <span className="inline-flex gap-1">
          <CallButton phone={customer.phone} iconOnly label={`Call ${customer.name || 'customer'}`} />
          <CustomerWhatsApp phone={customer.phone} iconOnly label={`WhatsApp ${customer.name || 'customer'}`} text={`Hello ${firstName(customer.name) || 'there'},`} />
        </span>
      ) : (
        <span className="text-muted">-</span>
      ),
  },
];

export default function CustomersPage() {
  useDocumentMeta({ title: 'Customers', noindex: true });
  const { values, page, set, hrefFor } = useUrlFilters(['q'] as const);
  const query: ListQuery = { q: values.q || undefined, page, limit: PAGE_SIZE };

  const list = useQuery({
    queryKey: queryKeys.admin.customers.list(query),
    queryFn: ({ signal }) => api.admin.customers.list(query, { signal }),
    placeholderData: keepPreviousData,
  });
  const data = list.data;

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Customers"
        meta={data ? `${formatNumber(data.total)} ${values.q ? 'found' : 'with accounts'}` : undefined}
        description="People who made an account. Guest checkouts show under Orders."
      />
      <SearchBox label="Search customers" placeholder="Name, phone or email" value={values.q} onSearch={(q) => set({ q })} className="md:max-w-md" />

      <div className="mt-6">
        {list.error && !data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Could not load the customers" className="py-10" />
        ) : (
          <div className={cn('transition-opacity dur-base', list.isPlaceholderData && 'opacity-60')}>
            <Table
              columns={COLUMNS}
              rows={data?.items ?? []}
              rowKey={(customer) => customer.id}
              caption="Customers"
              loading={list.isPending}
              skeletonRows={8}
              dense
              empty={
                <div className="py-10">
                  {values.q ? (
                    <EmptyState
                      size="sm"
                      title="No customers match"
                      description={`Nobody with an account matches “${values.q}”. Guests who checked out without one are under Orders.`}
                      actions={
                        <>
                          <Button variant="outline" onClick={() => set({ q: null })}>
                            Clear search
                          </Button>
                          <Button variant="ghost" to={`/admin/orders?q=${encodeURIComponent(values.q)}`}>
                            Search orders instead
                          </Button>
                        </>
                      }
                    />
                  ) : (
                    <EmptyState size="sm" title="No customer accounts yet" description="Shoppers appear here once they register or check out signed in." />
                  )}
                </div>
              }
            />
          </div>
        )}
        {data && data.pages > 1 && <Pagination page={data.page} pageCount={data.pages} hrefFor={hrefFor} label="Customers" className="mt-6" />}
      </div>
    </div>
  );
}
