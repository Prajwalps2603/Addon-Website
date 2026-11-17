import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { EmptyState, Segmented, Tab, TabList, TabPanel, Tabs, toast } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { CheckoutLead, SavedKit } from '@/types/api';
import { DeskPage, ListError, ListPager, QueueSkeleton, useDeskRefresh, usePageParam, useParamState, useProductMap } from './desk/common';
import { KIT_STATUS, KitCard, LEAD_STATUS, LeadCard, type KitStatus, type LeadStatus } from './desk/leads';

const VIEWS = ['checkouts', 'kits'] as const;
type View = (typeof VIEWS)[number];
const PAGE_SIZE = 20;

const LEAD_FILTERS = ['open', 'contacted', 'recovered', 'dismissed'] as const satisfies readonly LeadStatus[];
const KIT_FILTERS = ['open', 'contacted', 'ordered', 'dismissed'] as const satisfies readonly KitStatus[];

/** People who nearly bought: unfinished checkouts and kits saved from the New Car planner. */
export default function LeadsPage() {
  useDocumentMeta({ title: 'Leads', noindex: true });
  const [view, setView] = useParamState<View>('tab', VIEWS, 'checkouts');

  const openLeads = useQuery({
    queryKey: queryKeys.admin.leads.list({ status: 'open', limit: 1 }),
    queryFn: ({ signal }) => api.admin.leads.list({ status: 'open', limit: 1 }, { signal }),
  });
  const openKits = useQuery({
    queryKey: queryKeys.admin.kits.list({ status: 'open', limit: 1 }),
    queryFn: ({ signal }) => api.admin.kits.list({ status: 'open', limit: 1 }, { signal }),
  });

  return (
    <DeskPage title="Leads" description="People who stopped short of buying. One message often finishes the sale: send it, then mark what happened.">
      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabList label="Leads">
          <Tab value="checkouts" count={openLeads.data?.total}>
            Abandoned checkouts
          </Tab>
          <Tab value="kits" count={openKits.data?.total}>
            Saved kits
          </Tab>
        </TabList>
      <TabPanel value={view} className="pt-6">{view === 'checkouts' ? <Checkouts /> : <Kits />}</TabPanel>
      </Tabs>
    </DeskPage>
  );
}

function Checkouts() {
  const [status, setStatus] = useParamState<LeadStatus>('status', LEAD_FILTERS, 'open');
  const [page, setPage] = usePageParam();
  const refresh = useDeskRefresh();
  const listQuery = { status, page, limit: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.admin.leads.list(listQuery),
    queryFn: ({ signal }) => api.admin.leads.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });

  const update = useMutation<CheckoutLead, ApiError, { lead: CheckoutLead; status: LeadStatus; quiet?: boolean }>({
    mutationFn: ({ lead, status: next }) => api.admin.leads.update(lead.id, { status: next }),
    onSuccess: async (saved, { lead, quiet }) => {
      toast.success(quiet ? `${lead.name || 'Lead'} marked contacted` : `Marked ${LEAD_STATUS[saved.status].label.toLowerCase()}`, {
        action: { label: 'Undo', onClick: () => update.mutate({ lead: saved, status: lead.status }) },
      });
      await refresh(queryKeys.admin.leads.all());
    },
    onError: (error) => toast.error('Could not update the lead', { description: error.message }),
  });

  const items = query.data?.items ?? [];
  return (
    <div className="grid gap-5">
      <Segmented
        label="Show"
        value={status}
        onChange={setStatus}
        options={LEAD_FILTERS.map((value) => ({ value, label: LEAD_STATUS[value].label }))}
        className="max-w-full overflow-x-auto"
      />
      {query.isPending ? (
        <QueueSkeleton count={2} media={false} />
      ) : query.error ? (
        <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the checkouts" />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'open' ? 'No unfinished checkouts' : `Nothing marked ${LEAD_STATUS[status].label.toLowerCase()}`}
          description={
            status === 'open' ? 'When a shopper gives a phone number at checkout and does not pay, they show here.' : undefined
          }
        />
      ) : (
        <div className={cn('grid gap-3 transition-opacity dur-base lg:grid-cols-2', query.isPlaceholderData && 'opacity-60')}>
          {items.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              busy={update.isPending && update.variables?.lead.id === lead.id ? update.variables.status : null}
              onStatus={(next) => update.mutate({ lead, status: next })}
              onReminded={() => {
                if (lead.status === 'open') update.mutate({ lead, status: 'contacted', quiet: true });
              }}
            />
          ))}
        </div>
      )}
      {query.data && <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Checkouts" />}
    </div>
  );
}

function Kits() {
  const [status, setStatus] = useParamState<KitStatus>('status', KIT_FILTERS, 'open');
  const [page, setPage] = usePageParam();
  const refresh = useDeskRefresh();
  const listQuery = { status, page, limit: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.admin.kits.list(listQuery),
    queryFn: ({ signal }) => api.admin.kits.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];
  const products = useProductMap(items.flatMap((kit) => kit.productIds));

  const update = useMutation<SavedKit, ApiError, { kit: SavedKit; status: KitStatus; quiet?: boolean }>({
    mutationFn: ({ kit, status: next }) => api.admin.kits.update(kit.id, { status: next }),
    onSuccess: async (saved, { kit, quiet }) => {
      toast.success(quiet ? `${kit.name || 'Kit'} marked contacted` : `Marked ${KIT_STATUS[saved.status].label.toLowerCase()}`, {
        action: { label: 'Undo', onClick: () => update.mutate({ kit: saved, status: kit.status }) },
      });
      await refresh(queryKeys.admin.kits.all());
    },
    onError: (error) => toast.error('Could not update the kit', { description: error.message }),
  });

  return (
    <div className="grid gap-5">
      <Segmented
        label="Show"
        value={status}
        onChange={setStatus}
        options={KIT_FILTERS.map((value) => ({ value, label: KIT_STATUS[value].label }))}
        className="max-w-full overflow-x-auto"
      />
      {query.isPending ? (
        <QueueSkeleton count={2} media={false} />
      ) : query.error ? (
        <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the saved kits" />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === 'open' ? 'No saved kits waiting' : `Nothing marked ${KIT_STATUS[status].label.toLowerCase()}`}
          description={status === 'open' ? 'Kits saved from the New Car planner, with the dealer quote they compared, show here.' : undefined}
        />
      ) : (
        <div className={cn('grid gap-3 transition-opacity dur-base lg:grid-cols-2', query.isPlaceholderData && 'opacity-60')}>
          {items.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              products={products.map}
              productsLoading={products.isPending}
              busy={update.isPending && update.variables?.kit.id === kit.id ? update.variables.status : null}
              onStatus={(next) => update.mutate({ kit, status: next })}
              onMessaged={() => {
                if (kit.status === 'open') update.mutate({ kit, status: 'contacted', quiet: true });
              }}
            />
          ))}
        </div>
      )}
      {query.data && <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Saved kits" />}
    </div>
  );
}
