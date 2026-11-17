import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import * as z from 'zod';
import { ProductFrame } from '@/components/commerce';
import { Button, Callout, Field, IconButton, Input, Switch, Textarea, prefersReducedMotion, toast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDateTime, formatINR, pluralize } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminDrop, AdminProduct, DropInput } from '@/types/api';
import { ProductPicker } from './ProductPicker';
import { useLeaveGuard } from './useLeaveGuard';
import { afterPercentOff, isoToIstInput, istInputToIso, marginOf, thisFridayWindow, wholeNumber, windowsOverlap } from './utils';

export const MAX_DROP_ITEMS = 8;

interface DropProduct {
  id: number;
  name: string;
  image: string | null;
  artKind: string;
  regularPrice: number;
  costPrice: number | null | undefined;
  hasVariants: boolean;
}

const schema = z
  .object({
    title: z.string().trim().min(2, { error: 'Give the drop a title.' }).max(120),
    note: z.string().trim().max(500),
    startsAt: z.string().refine((v) => istInputToIso(v) !== '', { error: 'Enter the start date and time.' }),
    endsAt: z.string().refine((v) => istInputToIso(v) !== '', { error: 'Enter the end date and time.' }),
    isActive: z.boolean(),
    items: z
      .array(
        z.object({
          productId: z.number(),
          percentOff: z
            .string()
            .trim()
            .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90, { error: 'A whole percent from 1 to 90.' }),
          reason: z.string().trim().max(200),
        }),
      )
      .min(1, { error: 'Add at least one part.' })
      .max(MAX_DROP_ITEMS, { error: `${MAX_DROP_ITEMS} parts at most.` }),
  })
  .superRefine((form, ctx) => {
    const start = istInputToIso(form.startsAt);
    const end = istInputToIso(form.endsAt);
    if (start && end && end <= start) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'The drop must end after it starts.' });
  });

type DropForm = z.infer<typeof schema>;

export interface DropEditorProps {
  drop: AdminDrop | null;
  allDrops: readonly AdminDrop[];
  onDone: () => void;
}

/** Create or edit one Friday Five drop. */
export function DropEditor({ drop, allDrops, onDone }: DropEditorProps) {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const defaults = useMemo<DropForm>(() => {
    if (drop) {
      return {
        title: drop.title,
        note: drop.note,
        startsAt: isoToIstInput(drop.startsAt),
        endsAt: isoToIstInput(drop.endsAt),
        isActive: drop.isActive,
        items: drop.items.map((item) => ({ productId: item.product.id, percentOff: String(item.percentOff), reason: item.reason })),
      };
    }
    const friday = thisFridayWindow();
    return { title: 'The Friday Five', note: '', startsAt: isoToIstInput(friday.startsAt), endsAt: isoToIstInput(friday.endsAt), isActive: true, items: [] };
  }, [drop]);

  const { control, register, handleSubmit, setValue, setError, formState } = useForm<DropForm>({
    resolver: zodResolver(schema) as unknown as Resolver<DropForm>,
    defaultValues: defaults,
    shouldFocusError: false,
  });
  const { errors, isDirty } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: 'items', keyName: 'key' });
  const { modal: leaveModal } = useLeaveGuard(isDirty);

  // What we know of each product: the drop's own summary, then the admin record (for the cost price).
  const [picked, setPicked] = useState<Map<number, DropProduct>>(new Map());
  const existingIds = drop?.items.map((item) => item.product.id) ?? [];
  const costs = useQueries({
    queries: existingIds.map((id) => ({
      queryKey: queryKeys.admin.products.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.admin.products.get(id, { signal }),
      staleTime: 60_000,
    })),
  });
  const known = new Map<number, DropProduct>();
  drop?.items.forEach((item, index) => {
    const admin = costs[index]?.data;
    known.set(item.product.id, {
      id: item.product.id,
      name: item.product.name,
      image: item.product.image,
      artKind: item.product.artKind,
      regularPrice: admin?.regularPrice ?? item.product.regularPrice,
      costPrice: admin ? admin.costPrice : undefined,
      hasVariants: item.product.hasVariants,
    });
  });
  picked.forEach((value, key) => known.set(key, value));

  const items = useWatch({ control, name: 'items' });
  const isActive = useWatch({ control, name: 'isActive' });
  const startsAt = istInputToIso(useWatch({ control, name: 'startsAt' }));
  const endsAt = istInputToIso(useWatch({ control, name: 'endsAt' }));

  const overlapping =
    isActive && startsAt && endsAt
      ? allDrops.filter((other) => other.id !== drop?.id && other.isActive && windowsOverlap(startsAt, endsAt, other.startsAt, other.endsAt))
      : [];

  const scrollToFirstError = () => {
    window.requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      if (target?.matches('input, textarea')) target.focus({ preventScroll: true });
    });
  };

  const save = useMutation({
    mutationFn: (values: DropForm) => {
      const body: DropInput = {
        title: values.title.trim(),
        note: values.note.trim(),
        startsAt: istInputToIso(values.startsAt),
        endsAt: istInputToIso(values.endsAt),
        isActive: values.isActive,
        items: values.items.map((item) => ({ productId: item.productId, percentOff: Number(item.percentOff), reason: item.reason.trim() })),
      };
      return drop ? api.admin.drops.update(drop.id, body) : api.admin.drops.create(body);
    },
    onSuccess: (saved) => {
      const switchedOff = saved.deactivatedDropIds ?? [];
      const names = allDrops.filter((d) => switchedOff.includes(d.id)).map((d) => d.title);
      toast.success(drop ? 'Drop saved' : 'Drop created', {
        description: names.length > 0 ? `Switched off: ${names.join(', ')}` : saved.title,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.drops() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
      void queryClient.invalidateQueries({ queryKey: ['drop'] });
      void queryClient.invalidateQueries({ queryKey: ['home'] });
      onDone();
    },
    onError: (error) => {
      setFormError(applyApiError(error, setError));
      scrollToFirstError();
    },
  });

  const onSubmit = handleSubmit(
    (values) => {
      setFormError(null);
      save.mutate(values);
    },
    () => scrollToFirstError(),
  );

  const addProduct = (product: AdminProduct) => {
    if (items.some((item) => item.productId === product.id) || items.length >= MAX_DROP_ITEMS) return;
    setPicked((map) =>
      new Map(map).set(product.id, {
        id: product.id,
        name: product.name,
        image: product.image,
        artKind: product.artKind,
        regularPrice: product.regularPrice,
        costPrice: product.costPrice,
        hasVariants: product.hasVariants,
      }),
    );
    append({ productId: product.id, percentOff: '10', reason: '' });
  };

  const fridayShortcut = () => {
    const friday = thisFridayWindow();
    setValue('startsAt', isoToIstInput(friday.startsAt), { shouldDirty: true, shouldValidate: formState.isSubmitted });
    setValue('endsAt', isoToIstInput(friday.endsAt), { shouldDirty: true, shouldValidate: formState.isSubmitted });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-8">
      {formError && (
        <Callout tone="danger" title="Not saved" live>
          {formError}
        </Callout>
      )}

      <section aria-labelledby="drop-basics" className="grid gap-4 border-t border-ink pt-5">
        <h2 id="drop-basics" className="type-h2">
          The drop
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" error={errors.title?.message}>
            <Input {...register('title')} autoComplete="off" />
          </Field>
          <Field label="Note" optional hint="One or two lines above the parts, e.g. why these five this week." error={errors.note?.message} className="md:row-span-2">
            <Textarea rows={4} {...register('note')} />
          </Field>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Starts" hint="Indian time" error={errors.startsAt?.message}>
                <Input type="datetime-local" {...register('startsAt')} />
              </Field>
              <Field label="Ends" hint="Indian time" error={errors.endsAt?.message}>
                <Input type="datetime-local" {...register('endsAt')} />
              </Field>
            </div>
            <Button variant="outline" size="sm" iconLeft={<CalendarClock aria-hidden />} onClick={fridayShortcut} className="justify-self-start">
              This Friday 7 pm to Sunday night
            </Button>
          </div>
        </div>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              label="Switched on"
              description="Runs between the times above. Off keeps it as a draft."
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
        {overlapping.length > 0 && (
          <Callout tone="warn" title="Saving will switch off another drop" live>
            Only one drop runs at a time. These overlap this window and will be switched off:
            <ul className="mt-1 grid gap-0.5">
              {overlapping.map((other) => (
                <li key={other.id}>
                  <span className="font-bold">{other.title}</span>, {formatDateTime(other.startsAt)} to {formatDateTime(other.endsAt)}
                </li>
              ))}
            </ul>
          </Callout>
        )}
      </section>

      <section aria-labelledby="drop-parts" className="grid gap-4 border-t border-ink pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="drop-parts" className="type-h2">
              The parts
            </h2>
            <p className="type-small text-muted tnum">
              {fields.length} of {MAX_DROP_ITEMS}. Each with the reason the shopper will read.
            </p>
          </div>
          <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => setPicking(true)} disabled={fields.length >= MAX_DROP_ITEMS}>
            Add a part
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="type-body border border-dashed border-line-strong p-4 text-muted">No parts yet. Add the parts going into this drop.</p>
        ) : (
          <ol className="grid divide-y divide-line border-y border-line">
            {fields.map((field, index) => {
              const product = known.get(field.productId);
              const percent = wholeNumber(items[index]?.percentOff ?? '');
              const valid = percent !== null && percent >= 1 && percent <= 90;
              const dropPrice = product && valid ? afterPercentOff(product.regularPrice, percent) : null;
              const margin = dropPrice !== null ? marginOf(dropPrice, product?.costPrice) : null;
              const e = errors.items?.[index];
              return (
                <li key={field.key} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] md:items-start md:gap-4">
                  <div className="flex items-start gap-3">
                    <ProductFrame image={product?.image} alt="" artKind={product?.artKind} className="size-14 shrink-0 border border-line" />
                    <div className="grid min-w-0 gap-1">
                      <span className="line-clamp-2 leading-snug font-bold">{product?.name ?? `Product ${field.productId}`}</span>
                      {product && (
                        <span className="type-small tnum text-muted">
                          {product.hasVariants ? 'From ' : ''}
                          {formatINR(product.regularPrice)}
                        </span>
                      )}
                      {e?.productId?.message && (
                        <p role="alert" className="type-small text-stop">
                          {e.productId.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Field label="Off" error={e?.percentOff?.message}>
                      <Input
                        {...register(`items.${index}.percentOff`)}
                        inputMode="numeric"
                        trailing={<span className="type-small pr-3">%</span>}
                        className="tnum"
                      />
                    </Field>
                    {dropPrice !== null && product && (
                      <div className="type-small grid tnum">
                        <span>
                          <span className="font-bold">{formatINR(dropPrice)}</span> in the drop
                        </span>
                        {margin ? (
                          <span className={cn(margin.amount < 0 ? 'font-bold text-stop' : 'text-muted')}>
                            {margin.amount < 0 ? `${formatINR(-margin.amount)} below cost` : `${formatINR(margin.amount)} margin left (${margin.percent}%)`}
                          </span>
                        ) : (
                          <span className="text-muted">{product.costPrice === undefined ? 'Checking the cost' : 'No cost price on file'}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <Field label="Reason shoppers read" optional error={e?.reason?.message}>
                    <Input {...register(`items.${index}.reason`)} maxLength={200} autoComplete="off" placeholder="e.g. Last of this batch before the price goes up" />
                  </Field>
                  <IconButton label={`Remove ${product?.name ?? 'this part'}`} onClick={() => remove(index)} className="justify-self-end md:mt-6">
                    <Trash2 aria-hidden />
                  </IconButton>
                </li>
              );
            })}
          </ol>
        )}
        {(errors.items?.message || errors.items?.root?.message) && (
          <p role="alert" className="type-small text-stop">
            {errors.items?.message ?? errors.items?.root?.message}
          </p>
        )}
      </section>

      <div className="sticky bottom-0 z-sticky -mx-4 flex items-center justify-between gap-3 border-t border-ink bg-page px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:mx-0 md:px-0">
        <p className="type-small min-w-0 text-muted" aria-live="polite">
          {isDirty ? <span className="font-bold text-ink">Unsaved changes</span> : drop ? 'No changes' : pluralize(fields.length, 'part')}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={onDone} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={save.isPending}>
            {drop ? 'Save drop' : 'Create drop'}
          </Button>
        </div>
      </div>

      <ProductPicker
        open={picking}
        onClose={() => setPicking(false)}
        title="Add a part to the drop"
        description="Products on sale in the shop."
        activeOnly
        multiple
        chosenIds={items.map((item) => item.productId)}
        onPick={addProduct}
      />
      {leaveModal}
    </form>
  );
}
