import { cn } from '@/lib/cn';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ErrorState, PageHeader, ProductFrame } from '@/components/commerce';
import { Badge, Button, Countdown, EmptyState, IconButton, Skeleton, Switch, toast, type BadgeToneName } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminDrop, DropInput } from '@/types/api';
import { ConfirmModal } from './catalog/ConfirmModal';
import { DropEditor } from './catalog/DropEditor';
import { windowsOverlap } from './catalog/utils';

const STATE: Record<string, { label: string; tone: BadgeToneName; variant: 'solid' | 'soft' | 'outline' }> = {
  live: { label: 'Live now', tone: 'fit', variant: 'solid' },
  scheduled: { label: 'Scheduled', tone: 'info', variant: 'soft' },
  ended: { label: 'Ended', tone: 'neutral', variant: 'soft' },
  off: { label: 'Switched off', tone: 'neutral', variant: 'outline' },
};

function inputOf(drop: AdminDrop, patch: Partial<DropInput> = {}): DropInput {
  return {
    title: drop.title,
    note: drop.note,
    startsAt: drop.startsAt,
    endsAt: drop.endsAt,
    isActive: drop.isActive,
    items: drop.items.map((item) => ({ productId: item.product.id, percentOff: item.percentOff, reason: item.reason })),
    ...patch,
  };
}

function overlapsOf(drop: AdminDrop, all: readonly AdminDrop[]): AdminDrop[] {
  return all.filter((other) => other.id !== drop.id && other.isActive && windowsOverlap(drop.startsAt, drop.endsAt, other.startsAt, other.endsAt));
}

export default function DropsPage() {
  const [params, setParams] = useSearchParams();
  const editing = params.get('edit');
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.admin.drops(),
    queryFn: ({ signal }) => api.admin.drops.list({ signal }),
  });

  const editDrop = editing && editing !== 'new' ? (data?.find((d) => d.id === Number(editing)) ?? null) : null;
  useDocumentMeta({
    title: editing === 'new' ? 'New drop' : editDrop ? `Edit ${editDrop.title}` : 'The Friday Five',
    noindex: true,
  });

  const [confirmOn, setConfirmOn] = useState<{ drop: AdminDrop; overlaps: AdminDrop[] } | null>(null);
  const [deleting, setDeleting] = useState<AdminDrop | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.drops() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
    void queryClient.invalidateQueries({ queryKey: ['drop'] });
    void queryClient.invalidateQueries({ queryKey: ['home'] });
  };

  const toggle = useMutation({
    mutationFn: ({ drop, isActive }: { drop: AdminDrop; isActive: boolean }) => api.admin.drops.update(drop.id, inputOf(drop, { isActive })),
    onMutate: ({ drop }) => setBusyId(drop.id),
    onSettled: () => {
      setBusyId(null);
      setConfirmOn(null);
    },
    onSuccess: (saved) => {
      const off = saved.deactivatedDropIds ?? [];
      const names = (data ?? []).filter((d) => off.includes(d.id)).map((d) => d.title);
      toast.success(saved.isActive ? 'Drop switched on' : 'Drop switched off', {
        description: names.length > 0 ? `Also switched off: ${names.join(', ')}` : saved.title,
      });
      invalidate();
    },
    onError: (err) => toast.error('Not changed', { description: errorMessage(err) }),
  });

  const remove = useMutation({
    mutationFn: (drop: AdminDrop) => api.admin.drops.remove(drop.id),
    onSuccess: (_ok, drop) => {
      toast.success('Drop deleted', { description: drop.title });
      setDeleting(null);
      invalidate();
    },
    onError: (err) => {
      setDeleting(null);
      toast.error('Not deleted', { description: errorMessage(err) });
    },
  });

  const openEditor = (value: string | null) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('edit', value);
      else next.delete('edit');
      return next;
    });

  const switchOn = (drop: AdminDrop, on: boolean) => {
    const overlaps = on ? overlapsOf(drop, data ?? []) : [];
    if (overlaps.length > 0) setConfirmOn({ drop, overlaps });
    else toggle.mutate({ drop, isActive: on });
  };

  // ---- the editor ----------------------------------------------------------
  if (editing) {
    const back = (
      <Button variant="link" iconLeft={<ArrowLeft aria-hidden />} onClick={() => openEditor(null)}>
        All drops
      </Button>
    );
    if (isPending) {
      return (
        <div className="container-page grid gap-4 py-8" aria-busy="true">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="container-page py-8">
          <ErrorState error={error} onRetry={() => refetch()} title="Could not load the drops" />
        </div>
      );
    }
    if (editing !== 'new' && !editDrop) {
      return (
        <div className="container-page py-8">
          <EmptyState title="That drop is gone" description="It may have been deleted." actions={back} />
        </div>
      );
    }
    return (
      <div className="container-page">
        <div className="pt-4">{back}</div>
        <PageHeader
          variant="plain"
          title={editDrop ? editDrop.title : 'New drop'}
          className="pt-2 md:pt-2"
          meta={editDrop ? <StateBadge drop={editDrop} /> : undefined}
          description={editDrop ? undefined : 'Up to eight parts, each with a percent off and the reason shoppers will read.'}
        />
        <DropEditor key={editing} drop={editDrop} allDrops={data ?? []} onDone={() => openEditor(null)} />
      </div>
    );
  }

  // ---- the list ------------------------------------------------------------
  const drops = data ?? [];
  const live = drops.filter((d) => d.state === 'live');
  const scheduled = drops.filter((d) => d.state === 'scheduled').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = drops.filter((d) => d.state !== 'live' && d.state !== 'scheduled');

  const group = (title: string, list: AdminDrop[], emptyText: string) => (
    <section aria-labelledby={`drops-${title}`} className="grid gap-4">
      <h2 id={`drops-${title}`} className="flex items-center gap-3">
        <span className="text-xl font-black italic uppercase">{title}</span>
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-surface px-2 text-xs font-bold text-muted tnum">{list.length}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </h2>
      {list.length === 0 ? (
        <p className="rounded-[18px] bg-surface px-4 py-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="grid gap-3">
          {list.map((drop) => (
            <DropRow
              key={drop.id}
              drop={drop}
              busy={busyId === drop.id}
              onEdit={() => openEditor(String(drop.id))}
              onToggle={(on) => switchOn(drop, on)}
              onDelete={() => setDeleting(drop)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="The Friday Five"
        meta={data ? pluralize(drops.length, 'drop') : undefined}
        description="A short, dated price drop on a few parts, each with your reason. The live one is the only countdown on the site."
        actions={
          <Button iconLeft={<Plus aria-hidden />} onClick={() => openEditor('new')}>
            New drop
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-3" aria-busy="true">
          <span className="sr-only">Loading drops</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Could not load the drops" />
      ) : drops.length === 0 ? (
        <EmptyState
          title="No drops yet"
          description="Pick up to eight parts, set a percent off and a reason for each, and choose the window. This Friday 7 pm to Sunday night is one tap."
          actions={
            <Button iconLeft={<Plus aria-hidden />} onClick={() => openEditor('new')}>
              New drop
            </Button>
          }
        />
      ) : (
        <div className="grid gap-10">
          {group('Live now', live, 'Nothing is live. The home page shows no drop until one starts.')}
          {group('Scheduled', scheduled, 'Nothing scheduled.')}
          {group('Past and switched off', past, 'None yet.')}
        </div>
      )}

      <ConfirmModal
        open={confirmOn !== null}
        tone="dark"
        title="Switch this drop on?"
        confirmLabel="Switch on"
        busy={toggle.isPending}
        onClose={() => setConfirmOn(null)}
        onConfirm={() => confirmOn && toggle.mutate({ drop: confirmOn.drop, isActive: true })}
      >
        <p>Only one drop runs at a time. Switching on {confirmOn?.drop.title} switches off:</p>
        <ul className="grid gap-1">
          {confirmOn?.overlaps.map((other) => (
            <li key={other.id}>
              <span className="font-bold">{other.title}</span>, {formatDateTime(other.startsAt)} to {formatDateTime(other.endsAt)}
            </li>
          ))}
        </ul>
      </ConfirmModal>
      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${deleting?.title ?? 'this drop'}?`}
        confirmLabel="Delete drop"
        busy={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        <p>
          {deleting?.state === 'live'
            ? 'It is live now: its prices go back to normal at once.'
            : 'It goes for good. To keep it as a record, switch it off instead.'}
        </p>
      </ConfirmModal>
    </div>
  );
}

function StateBadge({ drop }: { drop: AdminDrop }) {
  const state = STATE[drop.state] ?? STATE.off!;
  return (
    <Badge tone={state.tone} variant={state.variant} size="sm">
      {state.label}
    </Badge>
  );
}

function DropRow({
  drop,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  drop: AdminDrop;
  busy: boolean;
  onEdit: () => void;
  onToggle: (on: boolean) => void;
  onDelete: () => void;
}) {
  const shown = drop.items.slice(0, 4);
  return (
    <li className={cn('grid gap-4 rounded-[24px] p-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-6 md:p-6', drop.state === 'live' ? 'bg-ink text-page' : 'bg-surface')}>
      <div className="grid min-w-0 gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-xl font-black italic uppercase">{drop.title}</h3>
            <StateBadge drop={drop} />
          </div>
          <p className={cn('text-sm tnum', drop.state === 'live' ? 'text-page/65' : 'text-muted')}>
            {formatDateTime(drop.startsAt)} to {formatDateTime(drop.endsAt)}
          </p>
          {drop.state === 'live' && (
            <Countdown to={drop.endsAt} variant="inline" size="sm" label="Ends in" className="type-small justify-self-start rounded-full bg-brand px-3 py-1 text-brand-ink" />
          )}
          {drop.state === 'scheduled' && <Countdown to={drop.startsAt} variant="inline" size="sm" label="Starts in" endedLabel="Started" className="type-small" />}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2" aria-label={`Parts in ${drop.title}`}>
          {shown.map((item) => (
            <li key={item.product.id} className="flex items-center gap-3 rounded-[16px] bg-raised p-2 pr-3 text-ink">
              <ProductFrame image={item.product.image} alt="" artKind={item.product.artKind} className="size-11 shrink-0 overflow-hidden rounded-[10px]" />
              <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug font-semibold">{item.product.name}</span>
              <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink tnum">-{item.percentOff}%</span>
            </li>
          ))}
          {drop.items.length > shown.length && (
            <li className={cn('grid place-items-center rounded-[16px] border-2 border-dashed p-2 text-sm font-semibold', drop.state === 'live' ? 'border-page/20 text-page/70' : 'border-line-strong text-muted')}>
              +{pluralize(drop.items.length - shown.length, 'more part')}
            </li>
          )}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:flex-col md:items-end md:justify-between">
        <Switch
          label={drop.isActive ? 'On' : 'Off'}
          aria-label={`${drop.title} switched on`}
          checked={drop.isActive}
          disabled={busy}
          onChange={(event) => onToggle(event.target.checked)}
          labelFirst
        />
        <div className="flex items-center gap-1">
          <Button size="sm" iconLeft={<Pencil aria-hidden />} onClick={onEdit} className="rounded-full !bg-raised !text-ink hover:!bg-brand hover:!text-brand-ink">
            Edit
          </Button>
          <IconButton label={`Delete ${drop.title}`} size="sm" onClick={onDelete} className={cn('rounded-full', drop.state === 'live' && 'text-page hover:bg-page/10')}>
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      </div>
    </li>
  );
}
