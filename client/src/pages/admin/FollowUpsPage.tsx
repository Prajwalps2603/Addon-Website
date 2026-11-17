import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, Chip, EmptyState, Skeleton, toast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { FollowUp } from '@/types/api';
import { useDoneToday } from './shell/doneToday';
import { FOLLOW_UP_TYPES, FollowUpCard } from './shell/FollowUpCard';
import { StudioReminders } from './studio/StudioReminders';

interface Group {
  type: FollowUp['type'];
  label: string;
  items: FollowUp[];
}

/** Groups in the order the server ranked them: the most urgent kind first. */
function groupItems(items: FollowUp[]): Group[] {
  const groups = new Map<FollowUp['type'], Group>();
  for (const item of items) {
    let group = groups.get(item.type);
    if (!group) {
      group = { type: item.type, label: FOLLOW_UP_TYPES[item.type]?.label ?? item.type, items: [] };
      groups.set(item.type, group);
    }
    group.items.push(item);
  }
  return [...groups.values()];
}

export default function FollowUpsPage() {
  useDocumentMeta({ title: "Today's Follow-ups", noindex: true });
  const [params, setParams] = useSearchParams();
  const filter = params.get('type');
  const { done, markDone, undo, reset } = useDoneToday();

  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: queryKeys.admin.followups(),
    queryFn: ({ signal }) => api.admin.followups({ signal }),
  });

  const open = useMemo(() => (data ?? []).filter((item) => !done.has(item.id)), [data, done]);
  const groups = useMemo(() => groupItems(open), [open]);
  const shown = filter ? groups.filter((group) => group.type === filter) : groups;
  const hiddenCount = (data ?? []).length - open.length;

  const setFilter = (type: string | null) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (type) next.set('type', type);
        else next.delete('type');
        return next;
      },
      { replace: true },
    );
  };

  const onDone = (item: FollowUp) => {
    markDone(item.id);
    toast.success(`${item.name || 'Follow-up'} marked done for today`, {
      id: `followup-done-${item.id}`,
      action: { label: 'Undo', onClick: () => undo(item.id) },
    });
  };

  const header = (
    <PageHeader
      variant="plain"
      title="Today's Follow-ups"
      meta={data ? (open.length > 0 ? `${open.length} to chase` : undefined) : undefined}
      description={formatDate(new Date(), { weekday: true })}
      actions={
        <Button variant="ghost" size="sm" iconLeft={<RefreshCw aria-hidden />} loading={isFetching && !isPending} onClick={() => refetch()}>
          Refresh
        </Button>
      }
    />
  );

  let body: ReactNode;
  if (isPending) {
    body = <FollowUpsSkeleton />;
  } else if (error) {
    body = <ErrorState error={error} onRetry={() => refetch()} title="Could not load today's follow-ups" />;
  } else if (open.length === 0) {
    body = (
      <EmptyState
        title="Nothing to chase today."
        description={
          hiddenCount > 0
            ? `You marked ${pluralize(hiddenCount, 'follow-up')} done today. New ones appear here as orders, questions and enquiries come in.`
            : 'New ones appear here as orders, questions and enquiries come in.'
        }
        actions={
          <>
            <Button variant="dark" to="/admin">
              Back to the dashboard
            </Button>
            {hiddenCount > 0 && (
              <Button variant="ghost" onClick={reset}>
                Show the {hiddenCount} marked done
              </Button>
            )}
          </>
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-6">
        {groups.length > 1 && (
          <div role="group" aria-label="Show one kind" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <Chip selected={!filter} count={open.length} onClick={() => setFilter(null)}>
              All
            </Chip>
            {groups.map((group) => (
              <Chip
                key={group.type}
                selected={filter === group.type}
                count={group.items.length}
                onClick={() => setFilter(filter === group.type ? null : group.type)}
              >
                {group.label}
              </Chip>
            ))}
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState
            size="sm"
            title="None of this kind left"
            description="Everything of this kind is done for today."
            actions={
              <Button variant="dark" onClick={() => setFilter(null)}>
                Show all
              </Button>
            }
          />
        ) : (
          shown.map((group) => (
            <section key={group.type} aria-labelledby={`fu-${group.type}`} className="grid gap-4">
              <h2 id={`fu-${group.type}`} className="flex items-center gap-3">
                <span className="text-lg font-black italic uppercase">{group.label}</span>
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-brand px-2 text-xs font-bold text-brand-ink tnum">{group.items.length}</span>
                <span aria-hidden className="h-px flex-1 bg-line" />
              </h2>
              <ul className="grid gap-4 xl:grid-cols-2">
                {group.items.map((item) => (
                  <FollowUpCard key={item.id} item={item} onDone={onDone} />
                ))}
              </ul>
            </section>
          ))
        )}

        {hiddenCount > 0 && (
          <p className="type-small text-muted">
            {pluralize(hiddenCount, 'follow-up')} marked done today.{' '}
            <Button variant="link" size="sm" onClick={reset}>
              Show them again
            </Button>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="container-page grid gap-8 pb-8">
      <div className="grid gap-6">
        {header}
        <StudioReminders />
      </div>
      {body}
    </div>
  );
}

function FollowUpsSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Loading follow-ups
      </span>
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32" />
        ))}
      </div>
      <Skeleton className="h-7 w-56" />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="grid gap-3 border-b border-line pb-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-13 w-full sm:w-56" />
        </div>
      ))}
    </div>
  );
}
