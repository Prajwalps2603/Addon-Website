import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge, Button, Callout, EmptyState, Tab, TabList, TabPanel, Table, Tabs, type TableColumn } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Enquiry } from '@/types/api';
import { Ago, DeskPage, ListError, ListPager, usePageParam, useParamState } from './desk/common';
import { ACK_HOURS, ackDue, DueCell, EnquiryDrawer, KIND_LABELS, STATUS_WORDS } from './desk/enquiries';

const VIEWS = ['new', 'acknowledged', 'resolved'] as const;
type View = (typeof VIEWS)[number];
const PAGE_SIZE = 50;

/**
 * Tickets from the contact form. New ones carry the 48-hour promise to acknowledge: overdue
 * tickets are flagged and listed first, then the rest by how soon they fall due.
 */
export default function EnquiriesPage() {
  useDocumentMeta({ title: 'Enquiries', noindex: true });
  const [view, setView] = useParamState<View>('tab', VIEWS, 'new');
  const [page, setPage] = usePageParam();
  const [selected, setSelected] = useState<Enquiry | null>(null);

  const newCount = useQuery({
    queryKey: queryKeys.admin.enquiries.list({ status: 'new', limit: 1 }),
    queryFn: ({ signal }) => api.admin.enquiries.list({ status: 'new', limit: 1 }, { signal }),
  });
  const openCount = useQuery({
    queryKey: queryKeys.admin.enquiries.list({ status: 'acknowledged', limit: 1 }),
    queryFn: ({ signal }) => api.admin.enquiries.list({ status: 'acknowledged', limit: 1 }, { signal }),
  });
  const counts = { new: newCount.data?.total, acknowledged: openCount.data?.total };

  const listQuery = { status: view, page, limit: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.admin.enquiries.list(listQuery),
    queryFn: ({ signal }) => api.admin.enquiries.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });

  // The server lists newest first; for new tickets the oldest is the most urgent.
  const rows = [...(query.data?.items ?? [])];
  if (view === 'new') rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const overdue = view === 'new' ? rows.filter((row) => ackDue(row).overdue).length : 0;

  const columns: TableColumn<Enquiry>[] = [
    {
      key: 'ticket',
      header: 'Ticket',
      primary: true,
      cell: (row) => (
        <span className="grid gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="type-code">{row.ticketNumber}</span>
            <span className="font-bold">{row.name}</span>
          </span>
          <span className="type-small line-clamp-1 font-normal text-muted">{row.subject || row.message}</span>
        </span>
      ),
    },
    { key: 'kind', header: 'Kind', cell: (row) => KIND_LABELS[row.kind] ?? row.kind },
    { key: 'age', header: 'Received', cell: (row) => <Ago iso={row.createdAt} /> },
    { key: 'due', header: `Acknowledge within ${ACK_HOURS} h`, cell: (row) => <DueCell enquiry={row} /> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={STATUS_WORDS[row.status].tone} size="sm">
          {STATUS_WORDS[row.status].label}
        </Badge>
      ),
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      cell: (row) => (
        <Button size="sm" variant={ackDue(row).overdue ? 'primary' : 'outline'} onClick={() => setSelected(row)} className="max-md:mt-1">
          Open<span className="sr-only"> {row.ticketNumber}</span>
        </Button>
      ),
    },
  ];

  return (
    <DeskPage
      title="Enquiries"
      meta={counts.new !== undefined ? `${pluralize(counts.new, 'new ticket')}` : undefined}
      description={`Every new ticket gets a reply within ${ACK_HOURS} hours: a WhatsApp, an email or a call, then mark it acknowledged.`}
    >
      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabList label="Tickets">
          <Tab value="new" count={counts.new}>
            New
          </Tab>
          <Tab value="acknowledged" count={counts.acknowledged}>
            Acknowledged
          </Tab>
          <Tab value="resolved">Resolved</Tab>
        </TabList>

      <TabPanel value={view} className="grid gap-4 pt-6">
        {overdue > 0 && (
          <Callout tone="danger" title={`${pluralize(overdue, 'ticket')} past ${ACK_HOURS} hours`}>
            They are at the top. A short message saying you have seen it is enough to acknowledge.
          </Callout>
        )}
        {query.error ? (
          <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the enquiries" />
        ) : (
          <div className={cn('transition-opacity dur-base', query.isPlaceholderData && 'opacity-60')}>
            <Table
              caption={`${STATUS_WORDS[view].label} enquiries`}
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={query.isPending}
              empty={
                <EmptyState
                  size="sm"
                  title={view === 'new' ? 'No new enquiries' : view === 'acknowledged' ? 'Nothing in progress' : 'No resolved tickets yet'}
                  description={view === 'new' ? 'Messages from the contact page and order help land here.' : undefined}
                />
              }
            />
            {query.data && <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Enquiries" />}
          </div>
        )}
      </TabPanel>
      </Tabs>

      <EnquiryDrawer enquiry={selected} onClose={() => setSelected(null)} onChange={setSelected} />
    </DeskPage>
  );
}
