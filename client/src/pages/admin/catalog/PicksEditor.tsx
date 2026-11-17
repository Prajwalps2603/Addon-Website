import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState, ProductFrame } from '@/components/commerce';
import { Button, Callout, Field, Input, Skeleton, toast } from '@/components/ui';
import { api, errorMessage, isApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { Category, CategoryPick } from '@/types/api';
import { knownFrom, type KnownProduct } from './ListEditors';
import { ProductPicker } from './ProductPicker';

type Tier = CategoryPick['tier'];

const TIERS: { tier: Tier; name: string; prompt: string }[] = [
  { tier: 'sensible', name: 'Sensible', prompt: 'The one that does the job for the least money.' },
  { tier: 'sweet_spot', name: 'Sweet Spot', prompt: 'The one you would buy yourself.' },
  { tier: 'all_out', name: 'All-Out', prompt: 'The best there is, when money is not the point.' },
];

interface Slot {
  product: KnownProduct | null;
  reason: string;
}

type Slots = Record<Tier, Slot>;

const emptySlots = (): Slots => ({
  sensible: { product: null, reason: '' },
  sweet_spot: { product: null, reason: '' },
  all_out: { product: null, reason: '' },
});

function slotsFrom(picks: readonly CategoryPick[]): Slots {
  const slots = emptySlots();
  for (const pick of picks) {
    slots[pick.tier] = {
      product: {
        id: pick.product.id,
        name: pick.product.name,
        sku: '',
        image: pick.product.image,
        artKind: pick.product.artKind,
        price: pick.product.regularPrice,
      },
      reason: pick.reason,
    };
  }
  return slots;
}

/** Pick of Three for one subcategory: Sensible, Sweet Spot and All-Out, each with the shop's one-line reason. */
export function PicksEditor({ category }: { category: Category }) {
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.admin.categories.picks(category.id),
    queryFn: ({ signal }) => api.admin.categories.picks(category.id, { signal }),
  });
  const [slots, setSlots] = useState<Slots>(emptySlots);
  const [choosing, setChoosing] = useState<Tier | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Tier, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setSlots(slotsFrom(data));
  }, [data]);

  const save = useMutation({
    mutationFn: (order: Tier[]) =>
      api.admin.categories.setPicks(category.id, {
        picks: order.map((tier) => ({ tier, productId: (slots[tier].product as KnownProduct).id, reason: slots[tier].reason.trim() })),
      }),
    onSuccess: (picks) => {
      setFieldErrors({});
      setFormError(null);
      queryClient.setQueryData(queryKeys.admin.categories.picks(category.id), picks);
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
      toast.success('Pick of Three saved', { description: category.name });
    },
    onError: (err, order) => {
      const next: Partial<Record<Tier, string>> = {};
      if (isApiError(err)) {
        for (const [path, message] of Object.entries(err.fields)) {
          const match = /^picks\.(\d+)\./.exec(path);
          const tier = match ? order[Number(match[1])] : undefined;
          if (tier) next[tier] = message;
        }
      }
      setFieldErrors(next);
      setFormError(errorMessage(err));
    },
  });

  if (isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-3" aria-label="Loading the picks">
        {TIERS.map((t) => (
          <Skeleton key={t.tier} className="h-40 rounded-[18px]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => refetch()} size="sm" title="Could not load the picks" />;

  const filled = TIERS.filter((t) => slots[t.tier].product !== null).map((t) => t.tier);
  const dirty = JSON.stringify(slotsFrom(data)) !== JSON.stringify(slots);
  const chosenIds = filled.map((tier) => (slots[tier].product as KnownProduct).id);

  const update = (tier: Tier, patch: Partial<Slot>) => {
    setSlots((s) => ({ ...s, [tier]: { ...s[tier], ...patch } }));
    setFieldErrors(({ [tier]: _cleared, ...rest }) => rest);
  };

  return (
    <div className="grid gap-4">
      {category.productCount === 0 && (
        <Callout tone="info">There are no products on sale in {category.name} yet. Add some, then pick three.</Callout>
      )}
      <ol className="grid gap-3 md:grid-cols-3">
        {TIERS.map(({ tier, name, prompt }) => {
          const slot = slots[tier];
          const reasonId = `pick-${category.id}-${tier}`;
          return (
            <li key={tier} className="grid content-start gap-3 rounded-[18px] bg-raised p-4">
              <div className="grid gap-0.5">
                <h4 className="text-lg font-black italic uppercase">{name}</h4>
                <p className="type-small text-muted">{prompt}</p>
              </div>
              {slot.product ? (
                <div className="flex items-center gap-3">
                  <ProductFrame image={slot.product.image} alt="" artKind={slot.product.artKind} className="size-14 shrink-0 overflow-hidden rounded-[12px]" />
                  <div className="grid min-w-0 gap-0.5">
                    <span className="line-clamp-2 leading-snug font-bold">{slot.product.name}</span>
                    <span className="justify-self-start rounded-full bg-surface px-2 py-0.5 text-xs font-bold tnum">{formatINR(slot.product.price)}</span>
                  </div>
                </div>
              ) : (
                <p className="rounded-[12px] border-2 border-dashed border-line-strong p-3 text-center text-sm text-muted">No product chosen.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setChoosing(tier)} disabled={category.productCount === 0 && !slot.product}>
                  {slot.product ? 'Change' : 'Choose product'}
                </Button>
                {slot.product && (
                  <Button variant="ghost" size="sm" onClick={() => update(tier, { product: null, reason: '' })}>
                    Clear
                  </Button>
                )}
              </div>
              <Field label="Why this one" htmlFor={reasonId} hint={`${slot.reason.length} of 200`} error={fieldErrors[tier]}>
                <Input
                  id={reasonId}
                  value={slot.reason}
                  maxLength={200}
                  onChange={(event) => update(tier, { reason: event.target.value })}
                  disabled={!slot.product}
                  placeholder={slot.product ? 'One line, in your words' : 'Choose a product first'}
                  autoComplete="off"
                />
              </Field>
            </li>
          );
        })}
      </ol>
      {formError && (
        <Callout tone="danger" live>
          {formError}
        </Callout>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="dark" onClick={() => save.mutate(filled)} loading={save.isPending} disabled={!dirty}>
          Save picks
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setSlots(slotsFrom(data))} disabled={save.isPending}>
            Undo changes
          </Button>
        )}
        <span className="type-small text-muted">{filled.length === 0 ? 'Saving with none chosen removes the Pick of Three.' : `${filled.length} of 3 chosen`}</span>
      </div>

      <ProductPicker
        open={choosing !== null}
        onClose={() => setChoosing(null)}
        title={choosing ? `${TIERS.find((t) => t.tier === choosing)?.name} pick for ${category.name}` : 'Choose a product'}
        description="Products on sale in this subcategory."
        category={category.slug}
        activeOnly
        chosenIds={chosenIds}
        onPick={(product) => {
          if (choosing) update(choosing, { product: knownFrom(product) });
        }}
      />
    </div>
  );
}
