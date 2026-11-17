import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, EmptyState, IconButton, Table, toast, type TableColumn } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { Coupon } from '@/types/api';
import { ConfirmModal } from './sales/ConfirmModal';
import { CouponDrawer, couponSummary } from './sales/CouponDrawer';
import { couponState, CouponStateBadge } from './sales/status';

function windowLabel(coupon: Coupon): string {
  if (!coupon.startsAt && !coupon.endsAt) return 'No end date';
  if (coupon.startsAt && coupon.endsAt) return `${formatDate(coupon.startsAt, { year: false })} to ${formatDate(coupon.endsAt)}`;
  if (coupon.endsAt) return `Until ${formatDate(coupon.endsAt)}`;
  return `From ${formatDate(coupon.startsAt)}`;
}

/** Live first, then scheduled, then the rest; newest first inside each. */
const ORDER = { live: 0, scheduled: 1, used_up: 2, ended: 3, off: 4 } as const;

export default function CouponsPage() {
  useDocumentMeta({ title: 'Coupons', noindex: true });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ coupon: Coupon | null } | null>(null);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const list = useQuery({
    queryKey: queryKeys.admin.coupons(),
    queryFn: ({ signal }) => api.admin.coupons.list({ signal }),
  });

  const remove = useMutation({
    mutationFn: (coupon: Coupon) => api.admin.coupons.remove(coupon.id),
    onSuccess: (_, coupon) => {
      toast.success(`Coupon ${coupon.code} deleted`);
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.coupons() });
    },
    onError: (error) => toast.error('Could not delete the coupon', { description: errorMessage(error) }),
  });

  const coupons = [...(list.data ?? [])].sort(
    (a, b) => ORDER[couponState(a)] - ORDER[couponState(b)] || b.createdAt.localeCompare(a.createdAt),
  );

  const columns: TableColumn<Coupon>[] = [
    {
      key: 'code',
      header: 'Code',
      primary: true,
      cell: (coupon) => (
        <span className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setEditing({ coupon })} className="type-code link focus-ring text-left">
            {coupon.code}
          </button>
          <span className="md:hidden">
            <CouponStateBadge coupon={coupon} />
          </span>
        </span>
      ),
    },
    {
      key: 'what',
      header: 'Gives',
      cell: (coupon) => (
        <span className="grid">
          <span>{couponSummary(coupon)}</span>
          {coupon.description && <span className="type-small text-muted">{coupon.description}</span>}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Used',
      numeric: true,
      cell: (coupon) => (
        <span className="whitespace-nowrap">
          {formatNumber(coupon.usedCount)}
          <span className="text-muted">{coupon.usageLimit !== null ? ` of ${formatNumber(coupon.usageLimit)}` : ''}</span>
        </span>
      ),
    },
    { key: 'window', header: 'Runs', cell: (coupon) => <span className="tnum">{windowLabel(coupon)}</span> },
    { key: 'state', header: 'State', className: 'max-md:hidden', cell: (coupon) => <CouponStateBadge coupon={coupon} /> },
    {
      key: 'actions',
      header: 'Edit',
      cell: (coupon) => (
        <span className="inline-flex gap-1">
          <IconButton label={`Edit ${coupon.code}`} size="sm" onClick={() => setEditing({ coupon })}>
            <Pencil aria-hidden />
          </IconButton>
          <IconButton label={`Delete ${coupon.code}`} size="sm" onClick={() => setDeleting(coupon)}>
            <Trash2 aria-hidden />
          </IconButton>
        </span>
      ),
    },
  ];

  const live = coupons.filter((coupon) => couponState(coupon) === 'live').length;

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title="Coupons"
        meta={list.data ? `${formatNumber(live)} live of ${formatNumber(coupons.length)}` : undefined}
        description="Codes customers type in the cart. Keep them few and give each a reason."
        actions={
          <Button iconLeft={<Plus aria-hidden />} onClick={() => setEditing({ coupon: null })}>
            New coupon
          </Button>
        }
      />

      {list.error && !list.data ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title="Could not load the coupons" className="py-10" />
      ) : (
        <Table
          columns={columns}
          rows={coupons}
          rowKey={(coupon) => coupon.id}
          caption="Coupons"
          loading={list.isPending}
          skeletonRows={4}
          empty={
            <div className="py-10">
              <EmptyState
                size="sm"
                title="No coupons"
                description="Nothing to type at checkout yet. A first-order code or a free-delivery code is a fair start."
                actions={
                  <Button iconLeft={<Plus aria-hidden />} onClick={() => setEditing({ coupon: null })}>
                    New coupon
                  </Button>
                }
              />
            </div>
          }
        />
      )}

      <CouponDrawer open={editing !== null} coupon={editing?.coupon ?? null} onClose={() => setEditing(null)} />

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? `Delete ${deleting.code}?` : 'Delete coupon?'}
        description={deleting ? couponSummary(deleting) : undefined}
        confirmLabel="Delete coupon"
        cancelLabel="Keep it"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        <p>
          The code stops working at once. Orders that already used it keep their discount.
          {deleting && deleting.usedCount > 0 ? ' To keep its history in this list, switch it off instead.' : ''}
        </p>
      </ConfirmModal>
    </div>
  );
}
