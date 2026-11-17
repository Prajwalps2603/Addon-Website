import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Trash2 } from 'lucide-react';
import { Badge, Button, Callout, Field, Input, Modal, Skeleton, toast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatNumber, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminSettings } from '@/types/api';
import { SectionShell } from './shared';

const CONFIRM_WORD = 'REMOVE';
const PAGE = 100;

/** Sample products left, counted from the admin product list (there is no count endpoint). */
async function countSampleProducts(signal: AbortSignal): Promise<{ sample: number; total: number }> {
  let page = 1;
  let pages = 1;
  let sample = 0;
  let total = 0;
  do {
    const result = await api.admin.products.list({ page, limit: PAGE }, { signal });
    sample += result.items.filter((product) => product.isDemo).length;
    total = result.total;
    pages = result.pages;
    page += 1;
  } while (page <= pages && page <= 50);
  return { sample, total };
}

/** Names for the tables the clear endpoint reports, in the order a person cares about. */
const REMOVED_LABELS: [key: string, label: string][] = [
  ['products', 'Products'],
  ['variants', 'Variants'],
  ['fitments', 'Fitment records'],
  ['priceHistory', 'Price history rows'],
  ['relations', 'Related-part links'],
  ['picks', 'Pick of Three places'],
  ['reports', 'Fitted reports'],
  ['questions', 'Questions'],
  ['orders', 'Orders'],
  ['orderItems', 'Order lines'],
  ['orderEvents', 'Order history entries'],
  ['drops', 'Friday Five drops'],
  ['dropItems', 'Drop items'],
  ['coupons', 'Coupons'],
  ['builds', 'Build Bay builds'],
  ['wishlistItems', 'Wishlist saves'],
  ['stockAlerts', 'Stock alerts'],
];

export function SampleDataSection({ settings }: { settings: AdminSettings }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [removed, setRemoved] = useState<Record<string, number> | null>(null);
  const hasDemo = settings.hasDemoData;

  const count = useQuery({
    queryKey: [...queryKeys.admin.products.all(), 'sample-count'],
    queryFn: ({ signal }) => countSampleProducts(signal),
    enabled: hasDemo,
  });

  const clear = useMutation({
    mutationFn: () => api.admin.demo.clear(),
    onSuccess: ({ removed: rows }) => {
      setRemoved(rows);
      setConfirming(false);
      setTyped('');
      const total = Object.values(rows).reduce((sum, n) => sum + n, 0);
      toast.success('Sample data removed', { description: `${pluralize(total, 'record')} deleted. Your own data is untouched.` });
      // Products, orders, drops, coupons, builds, reports and the settings flag all changed.
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error('Could not remove the sample data', { description: errorMessage(error) }),
  });

  const close = () => {
    if (clear.isPending) return;
    setConfirming(false);
    setTyped('');
  };

  const removedRows = removed ? REMOVED_LABELS.filter(([key]) => (removed[key] ?? 0) > 0) : [];

  return (
    <SectionShell
      id="sample-data"
      title="Sample data"
      description="The store came with a sample catalogue so every page has something to show. Remove it before you take real orders; shoppers see it labelled Sample until then."
    >
      {removed && (
        <div className="grid gap-3 pb-6">
          <Callout tone="good" title="Sample data removed" live>
            The catalogue now holds only your own products.
          </Callout>
          {removedRows.length > 0 && (
            <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
              {removedRows.map(([key, label]) => (
                <div key={key} className="flex items-baseline justify-between gap-3 border-b border-line py-2 pr-4">
                  <dt className="type-small text-muted">{label}</dt>
                  <dd className="tnum font-bold">{formatNumber(removed[key] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {!hasDemo ? (
        !removed && (
          <p className="flex items-center gap-2">
            <Badge tone="fit" icon={<CircleCheck aria-hidden />}>
              None left
            </Badge>
            <span className="type-small text-muted">Every product in the catalogue is your own.</span>
          </p>
        )
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {count.isPending ? (
              <Skeleton className="h-10 w-40" />
            ) : count.error ? (
              <p className="type-small text-muted">
                Could not count the sample products.{' '}
                <Button variant="link" size="sm" onClick={() => void count.refetch()}>
                  Try again
                </Button>
              </p>
            ) : (
              <>
                <p className="type-stat tnum">{formatNumber(count.data.sample)}</p>
                <p className="type-body text-muted">
                  sample {count.data.sample === 1 ? 'product' : 'products'} of {formatNumber(count.data.total)} in the catalogue
                </p>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid content-start gap-2">
              <h3 className="type-label">What is deleted</h3>
              <ul className="type-small grid list-disc gap-1.5 pl-5">
                <li>Every sample product, with its variants, fitment records, price history, related-part links and Pick of Three places.</li>
                <li>All fitted reports and questions on those products, and every other sample report and question.</li>
                <li>Sample orders with their lines and history.</li>
                <li>Sample Friday Five drops, coupons and Build Bay builds.</li>
                <li>Wishlist saves and stock alerts for sample products.</li>
              </ul>
            </div>
            <div className="grid content-start gap-2">
              <h3 className="type-label">What stays</h3>
              <ul className="type-small grid list-disc gap-1.5 pl-5">
                <li>Your categories, the car list, these settings and every customer account.</li>
                <li>Every product, order, coupon and drop you created yourself.</li>
                <li>A real order that included a sample product keeps that line with its name, SKU and price.</li>
              </ul>
            </div>
          </div>

          <div>
            <Button variant="danger" iconLeft={<Trash2 aria-hidden />} onClick={() => setConfirming(true)}>
              Remove all sample data
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={confirming}
        onClose={close}
        title="Remove all sample data?"
        description="This cannot be undone. Your own products and orders are not touched."
        dismissible={!clear.isPending}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={clear.isPending}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={clear.isPending}
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
              onClick={() => clear.mutate()}
            >
              Remove sample data
            </Button>
          </div>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (typed.trim().toUpperCase() === CONFIRM_WORD && !clear.isPending) clear.mutate();
          }}
        >
          <Field label={`Type ${CONFIRM_WORD} to confirm`}>
            <Input value={typed} autoComplete="off" autoCapitalize="characters" spellCheck={false} mono onChange={(event) => setTyped(event.target.value)} data-autofocus />
          </Field>
        </form>
      </Modal>
    </SectionShell>
  );
}
