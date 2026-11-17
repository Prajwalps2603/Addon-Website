import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, CopyButton, EmptyState, IconButton, Pagination, Tab, TabList, TabPanel, Table, Tabs, toast, type TableColumn } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api, errorMessage, type AdminQuoteQuery } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, formatNumber, relativeDay } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminQuote } from '@/types/api';
import { ConfirmModal } from './sales/ConfirmModal';
import { CustomerWhatsApp } from './sales/contact';
import { quoteMessage, quoteUrl } from './sales/messages';
import { QUOTE_STATUS_LABELS, QuoteStatusBadge } from './sales/status';
import { SearchBox, useUrlFilters } from './sales/urlState';

const PAGE_SIZE = 25;
const TABS = ['open', 'ordered', 'expired', 'cancelled', 'all'] as const;
type TabValue = (typeof TABS)[number];
const TAB_LABELS: Record<TabValue, string> = { ...QUOTE_STATUS_LABELS, all: 'All' };

function isTab(value: string): value is TabValue {
  return (TABS as readonly string[]).includes(value);
}

/** Margin as rupees and a percent of the quote total. */
function MarginCell({ quote }: { quote: Pick<AdminQuote, 'margin' | 'total'> }) {
  if (quote.margin === null) return <span className="text-muted">Cost not set</span>;
  const percent = quote.total > 0 ? Math.round((quote.margin / quote.total) * 100) : 0;
  return (
    <span className={cn('font-bold tnum', quote.margin < 0 && 'text-stop')}>
      {formatINR(quote.margin)}
      <span className="type-small font-normal text-muted"> {percent}%</span>
    </span>
  );
}

export default function QuotesPage() {
  useDocumentMeta({ title: 'Quotes', noindex: true });
  const queryClient = useQueryClient();
  const storeName = useSettings().data?.storeName ?? '';
  const { values, page, set, hrefFor } = useUrlFilters(['q', 'status'] as const);
  const tab: TabValue = isTab(values.status) ? values.status : 'open';
  const query: AdminQuoteQuery = { q: values.q || undefined, status: tab === 'all' ? undefined : tab, page, limit: PAGE_SIZE };
  const [cancelling, setCancelling] = useState<AdminQuote | null>(null);

  const list = useQuery({
    queryKey: queryKeys.admin.quotes.list(query),
    queryFn: ({ signal }) => api.admin.quotes.list(query, { signal }),
    placeholderData: keepPreviousData,
  });

  const cancel = useMutation({
    mutationFn: (quote: AdminQuote) => api.admin.quotes.remove(quote.id),
    onSuccess: (_, quote) => {
      toast.success('Quote cancelled', { description: `The link for ${quote.customerName || 'this customer'} no longer works.` });
      setCancelling(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.quotes.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.followups() });
    },
    onError: (error) => toast.error('Could not cancel the quote', { description: errorMessage(error) }),
  });

  const columns: TableColumn<AdminQuote>[] = [
    {
      key: 'customer',
      header: 'Customer',
      primary: true,
      cell: (quote) => (
        <span className="flex items-start justify-between gap-2">
          <span className="grid">
            <Link to={`/admin/quotes/${quote.id}`} state={{ quote }} className="link focus-ring font-bold">
              {quote.customerName || 'No name'}
            </Link>
            <span className="type-small font-normal text-muted tnum">{quote.phone ? formatPhone(quote.phone) : 'No phone'}</span>
          </span>
          <span className="md:hidden">
            <QuoteStatusBadge status={quote.status} />
          </span>
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      numeric: true,
      cell: (quote) => formatNumber(quote.items.reduce((sum, item) => sum + item.qty, 0)),
    },
    { key: 'total', header: 'Total', numeric: true, cell: (quote) => <span className="font-bold">{formatINR(quote.total)}</span> },
    { key: 'margin', header: 'Margin', numeric: true, cell: (quote) => <MarginCell quote={quote} /> },
    {
      key: 'valid',
      header: 'Valid until',
      cell: (quote) => (
        <span className="tnum whitespace-nowrap">
          {formatDate(quote.validUntil, { year: false })}
          {quote.status === 'open' && <span className="text-muted"> ({relativeDay(quote.validUntil)})</span>}
        </span>
      ),
    },
    { key: 'status', header: 'Status', className: 'max-md:hidden', cell: (quote) => <QuoteStatusBadge status={quote.status} /> },
    {
      key: 'actions',
      header: 'Send',
      cell: (quote) =>
        quote.status === 'open' ? (
          <span className="inline-flex flex-wrap items-center justify-end gap-1">
            <CopyButton value={quoteUrl(quote.token)} label="Copy link" />
            <CustomerWhatsApp
              phone={quote.phone}
              iconOnly
              label={`WhatsApp the link to ${quote.customerName || 'the customer'}`}
              text={quoteMessage(quote, storeName, formatDate(quote.validUntil, { weekday: true }))}
            />
            <IconButton label={`Cancel the quote for ${quote.customerName || 'this customer'}`} size="sm" onClick={() => setCancelling(quote)}>
              <Ban aria-hidden />
            </IconButton>
          </span>
        ) : quote.orderNumber ? (
          <Link to={`/admin/orders/${encodeURIComponent(quote.orderNumber)}`} className="type-code link focus-ring">
            {quote.orderNumber}
          </Link>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
  ];

  const data = list.data;

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Quotes"
        description="Price a set of parts on a call and send the customer a link that pays that exact price."
        actions={
          <Button to="/admin/quotes/new" iconLeft={<Plus aria-hidden />}>
            New quote
          </Button>
        }
      />

      <SearchBox label="Search quotes" placeholder="Customer name or phone" value={values.q} onSearch={(q) => set({ q })} className="md:max-w-md" />

      <Tabs value={tab} onValueChange={(next) => set({ status: next === 'open' ? null : next })} className="mt-6">
        <TabList label="Quote status">
          {TABS.map((value) => (
            <Tab key={value} value={value} count={value === tab ? data?.total : undefined}>
              {TAB_LABELS[value]}
            </Tab>
          ))}
        </TabList>
        <TabPanel value={tab} className="pt-0">
          {list.error && !data ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Could not load the quotes" className="py-10" />
          ) : (
            <div className={cn('transition-opacity dur-base', list.isPlaceholderData && 'opacity-60')}>
              <Table
                columns={columns}
                rows={data?.items ?? []}
                rowKey={(quote) => quote.id}
                caption={`Quotes: ${TAB_LABELS[tab]}`}
                loading={list.isPending}
                skeletonRows={6}
                dense
                className="max-md:mt-4"
                empty={
                  <div className="py-10">
                    {values.q ? (
                      <EmptyState size="sm" title="No quotes match" description={`Nothing for “${values.q}” here.`} actions={<Button variant="outline" onClick={() => set({ q: null })}>Clear search</Button>} />
                    ) : tab === 'open' || tab === 'all' ? (
                      <EmptyState
                        size="sm"
                        title="No open quotes"
                        description="On a call? Build the quote while you talk and send the link before you hang up."
                        actions={<Button to="/admin/quotes/new" iconLeft={<Plus aria-hidden />}>New quote</Button>}
                      />
                    ) : (
                      <EmptyState size="sm" title={`No ${TAB_LABELS[tab].toLowerCase()} quotes`} />
                    )}
                  </div>
                }
              />
            </div>
          )}
          {data && data.pages > 1 && <Pagination page={data.page} pageCount={data.pages} hrefFor={hrefFor} label="Quotes" className="mt-6" />}
        </TabPanel>
      </Tabs>

      <ConfirmModal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Cancel this quote?"
        description={cancelling ? `${cancelling.customerName || 'No name'}, ${formatINR(cancelling.total)}, valid until ${formatDate(cancelling.validUntil)}.` : undefined}
        confirmLabel="Cancel quote"
        cancelLabel="Keep quote"
        loading={cancel.isPending}
        onConfirm={() => cancelling && cancel.mutate(cancelling)}
      >
        <p>The link stops working at once. A customer who opens it sees that the quote is no longer available.</p>
      </ConfirmModal>
    </div>
  );
}
