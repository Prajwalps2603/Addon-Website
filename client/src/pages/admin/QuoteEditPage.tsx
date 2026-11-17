import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, Callout, Card, Checkbox, Chip, CopyButton, EmptyState, Field, Input, Skeleton, SkeletonText, Switch, Textarea, toast } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatINR, relativeDay } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminProduct, AdminQuote } from '@/types/api';
import { CustomerWhatsApp } from './sales/contact';
import { addDaysIst, todayIst } from './sales/dates';
import { quoteMessage, quoteUrl } from './sales/messages';
import { ProductSearch } from './sales/quote/ProductSearch';
import { QuoteLineRow } from './sales/quote/QuoteLineRow';
import { emptyQuote, formToInput, lineFromProduct, lineMargin, marginPercent, quoteSchema, quoteToForm, type QuoteForm } from './sales/quote/schema';
import { QUOTE_STATUS_LABELS, QuoteStatusBadge } from './sales/status';

interface LocationState {
  quote?: AdminQuote;
  saved?: boolean;
}

/** There is no single-quote endpoint: walk the list until the id turns up. */
async function findQuote(id: number, signal: AbortSignal): Promise<AdminQuote> {
  for (let page = 1; page <= 40; page += 1) {
    const list = await api.admin.quotes.list({ page, limit: 60 }, { signal });
    const quote = list.items.find((item) => item.id === id);
    if (quote) return quote;
    if (page >= list.pages) break;
  }
  throw new ApiError(404, 'not_found', 'We could not find that quote.');
}

export default function QuoteEditPage() {
  const params = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const isNew = id === null;
  useDocumentMeta({ title: isNew ? 'New quote' : 'Quote', noindex: true });

  const initial = state.quote && state.quote.id === id ? state.quote : undefined;
  const quote = useQuery({
    queryKey: [...queryKeys.admin.quotes.all(), 'detail', id] as const,
    queryFn: ({ signal }) => findQuote(id ?? 0, signal),
    enabled: !isNew,
    initialData: initial,
  });

  if (isNew) return <QuoteEditor key="new" />;
  if (quote.isPending) return <EditorSkeleton />;
  if (quote.error) {
    return (
      <div className="container-page py-10">
        <ErrorState
          error={quote.error}
          onRetry={() => void quote.refetch()}
          title={quote.error.isNotFound ? 'No such quote' : 'Could not load the quote'}
          notFoundAction={
            <Button variant="outline" to="/admin/quotes">
              Back to quotes
            </Button>
          }
        />
      </div>
    );
  }
  return <QuoteEditor key={quote.data.id} quote={quote.data} justSaved={state.saved === true} />;
}

const QUICK_DAYS = [
  { label: 'Today', days: 0 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
] as const;

function QuoteEditor({ quote, justSaved = false }: { quote?: AdminQuote; justSaved?: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeName = useSettings().data?.storeName ?? '';
  const [saved, setSaved] = useState<AdminQuote | null>(justSaved && quote ? quote : null);
  const [formError, setFormError] = useState('');
  const editable = !quote || quote.status === 'open';

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    trigger,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<QuoteForm>({ resolver: zodResolver(quoteSchema), defaultValues: quote ? quoteToForm(quote) : emptyQuote() });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const items = useWatch({ control, name: 'items' }) ?? [];
  const overrideShipping = useWatch({ control, name: 'overrideShipping' });
  const shippingFee = useWatch({ control, name: 'shippingFee' });
  const validUntil = useWatch({ control, name: 'validUntil' });
  const allowBelowCost = useWatch({ control, name: 'allowBelowCost' });

  // Ticking or unticking "allow below cost" changes which prices are errors.
  useEffect(() => {
    if (isSubmitted) void trigger('items');
  }, [allowBelowCost, isSubmitted, trigger]);

  // Once edited, the "link ready" panel describes an older version: hide it.
  useEffect(() => {
    if (isDirty) setSaved(null);
  }, [isDirty]);

  const totals = items.reduce(
    (sum, line) => {
      const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
      const qty = Number.isFinite(line.qty) ? line.qty : 0;
      const margin = lineMargin(line);
      return {
        items: sum.items + price * qty,
        regular: sum.regular + line.regularPrice * qty,
        margin: margin === null || sum.margin === null ? null : sum.margin + margin,
        below: sum.below + (line.costPrice !== null && price < line.costPrice ? 1 : 0),
      };
    },
    { items: 0, regular: 0, margin: 0 as number | null, below: 0 },
  );
  const fee = overrideShipping && Number.isFinite(shippingFee) ? (shippingFee ?? 0) : null;
  const blocked = totals.below > 0 && !allowBelowCost;

  const addProduct = (product: AdminProduct) => {
    const line = lineFromProduct(product);
    const existing = items.findIndex((item) => item.productId === line.productId && item.variantId === line.variantId);
    if (existing >= 0) {
      const qty = (items[existing]?.qty ?? 0) + 1;
      setValue(`items.${existing}.qty`, Math.min(99, qty), { shouldDirty: true });
      toast.info(`${product.name}: quantity now ${Math.min(99, qty)}`);
      return;
    }
    append(line);
    if (!product.inStock) toast.info(`${product.name} is sold out`, { description: 'The customer cannot pay until it is back in stock.' });
  };

  const save = useMutation({
    mutationFn: (form: QuoteForm) => {
      const body = formToInput(form);
      const options = { allowBelowCost: form.allowBelowCost };
      return quote ? api.admin.quotes.update(quote.id, body, options) : api.admin.quotes.create(body, options);
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.quotes.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.followups() });
      queryClient.setQueryData([...queryKeys.admin.quotes.all(), 'detail', result.id], result);
      toast.success(quote ? 'Quote updated' : 'Quote saved', { description: 'The link is ready to send.' });
      if (!quote) {
        navigate(`/admin/quotes/${result.id}`, { replace: true, state: { quote: result, saved: true } satisfies LocationState });
        return;
      }
      reset(quoteToForm(result));
      setSaved(result);
    },
    onError: (error) => {
      setFormError(applyApiError(error, setError, { shippingFee: 'shippingFee' }));
      toast.error('Could not save the quote', { description: errorMessage(error) });
    },
  });

  const submit = handleSubmit(
    (values) => {
      setFormError('');
      save.mutate(values);
    },
    () => setFormError('Some lines need attention. Check the fields marked in red.'),
  );

  const title = quote ? `Quote for ${quote.customerName || 'customer'}` : 'New quote';

  return (
    <div className="container-page pb-16">
      <PageHeader
        variant="plain"
        title={title}
        breadcrumbs={[{ label: 'Quotes', to: '/admin/quotes' }, { label: quote ? `#${quote.id}` : 'New' }]}
        meta={quote ? <QuoteStatusBadge status={quote.status} /> : undefined}
      />

      {saved && saved.status === 'open' && <LinkReady quote={saved} storeName={storeName} />}

      {quote && !editable && (
        <Callout tone="info" className="mb-6" title={`This quote is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()}`}>
          {quote.status === 'ordered' && quote.orderNumber ? (
            <>
              It became order{' '}
              <Button variant="link" to={`/admin/orders/${encodeURIComponent(quote.orderNumber)}`}>
                {quote.orderNumber}
              </Button>
              . It can no longer be changed.
            </>
          ) : (
            'It can no longer be changed. Start a new quote for the same customer if they still want the parts.'
          )}
        </Callout>
      )}

      <form noValidate onSubmit={submit}>
        <fieldset disabled={!editable || save.isPending} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="grid min-w-0 content-start gap-8">
            <section aria-labelledby="customer-title" className="grid gap-4">
              <h2 id="customer-title" className="type-h3 border-b border-ink pb-2">
                Customer
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={errors.customerName?.message} required>
                  <Input autoComplete="off" autoCapitalize="words" {...register('customerName')} />
                </Field>
                <Field label="Mobile number" error={errors.phone?.message} required>
                  <Input type="tel" inputMode="numeric" autoComplete="off" leading="+91" className="tnum" {...register('phone')} />
                </Field>
              </div>
              <Field label="Note for the customer" optional hint="Shown on the quote page, e.g. which car it is for." error={errors.note?.message}>
                <Textarea rows={2} {...register('note')} />
              </Field>
            </section>

            <section aria-labelledby="parts-title" className="grid gap-4">
              <h2 id="parts-title" className="type-h3 border-b border-ink pb-2">
                Parts
              </h2>
              {editable && <ProductSearch onAdd={addProduct} disabled={save.isPending} />}
              {fields.length === 0 ? (
                <EmptyState size="sm" title="No parts yet" description="Search above and tap a part to add it." />
              ) : (
                <ul className="grid gap-3" aria-label="Quoted parts">
                  {fields.map((field, index) => (
                    <QuoteLineRow
                      key={field.id}
                      index={index}
                      control={control}
                      register={register}
                      setValue={setValue}
                      errors={errors}
                      onRemove={() => remove(index)}
                      disabled={!editable}
                    />
                  ))}
                </ul>
              )}
              {errors.items?.message && <p className="type-small text-stop">{errors.items.message}</p>}
              {errors.items?.root?.message && <p className="type-small text-stop">{errors.items.root.message}</p>}
            </section>
          </div>

          <aside className="grid content-start gap-6 lg:sticky lg:top-4 lg:self-start" aria-label="Terms and totals">
            <section aria-labelledby="terms-title" className="grid gap-4">
              <h2 id="terms-title" className="type-h3 border-b border-ink pb-2">
                Terms
              </h2>
              <div className="grid gap-2">
                <Field label="Valid until" error={errors.validUntil?.message} hint={validUntil ? `Ends 11:59 pm, ${formatDate(validUntil, { weekday: true })} (${relativeDay(validUntil)})` : undefined}>
                  <Input type="date" min={todayIst()} className="tnum" {...register('validUntil')} />
                </Field>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Quick choices for valid until">
                  {QUICK_DAYS.map((choice) => {
                    const day = addDaysIst(choice.days);
                    return (
                      <Chip key={choice.label} size="sm" selected={validUntil === day} onClick={() => setValue('validUntil', day, { shouldDirty: true, shouldValidate: true })}>
                        {choice.label}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2">
                <Switch label="Set the delivery fee myself" description="Off: the usual delivery rules apply at checkout." {...register('overrideShipping')} />
                {overrideShipping && (
                  <Field label="Delivery fee" hint="0 for free delivery." error={errors.shippingFee?.message}>
                    <Input inputMode="numeric" leading="₹" className="tnum" {...register('shippingFee', { valueAsNumber: true })} />
                  </Field>
                )}
              </div>
            </section>

            <section aria-labelledby="totals-title" className="grid gap-3">
              <h2 id="totals-title" className="type-h3 border-b border-ink pb-2">
                Totals
              </h2>
              <dl className="grid gap-1">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">At regular prices</dt>
                  <dd className="tnum">{formatINR(totals.regular)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt>Parts as quoted</dt>
                  <dd className="tnum">{formatINR(totals.items)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt>Delivery</dt>
                  <dd className="tnum">{fee === null ? 'Usual rules' : fee === 0 ? 'Free' : formatINR(fee)}</dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-ink pt-2">
                  <dt className="font-bold">{fee === null ? 'Total before delivery' : 'Quote total'}</dt>
                  <dd className="type-price-xl tnum">{formatINR(totals.items + (fee ?? 0))}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 pt-1">
                  <dt className="font-bold">Margin on parts</dt>
                  <dd className={cn('type-price tnum', totals.margin !== null && totals.margin < 0 && 'text-stop')}>
                    {totals.margin === null ? (
                      <span className="type-small font-normal text-muted">Unknown: a cost is not set</span>
                    ) : (
                      `${formatINR(totals.margin)} (${marginPercent(totals.margin, totals.items)}%)`
                    )}
                  </dd>
                </div>
              </dl>

              {totals.below > 0 && (
                <div className={cn('grid gap-1 border p-3', allowBelowCost ? 'border-warn bg-warn-soft' : 'border-stop bg-stop-soft')}>
                  <p className={cn('font-bold', allowBelowCost ? 'text-warn' : 'text-stop')}>
                    {totals.below === 1 ? 'One line is' : `${totals.below} lines are`} priced below cost
                  </p>
                  <Checkbox
                    label="Allow below cost for this quote"
                    description="Only if you mean to lose money on these parts."
                    {...register('allowBelowCost')}
                  />
                </div>
              )}
            </section>

            {formError && (
              <Callout tone="danger" live>
                {formError}
              </Callout>
            )}

            {editable && (
              <div className="grid gap-2">
                <Button type="submit" size="lg" block iconLeft={<Save aria-hidden />} loading={save.isPending} disabled={blocked || fields.length === 0}>
                  {quote ? 'Save changes' : 'Save and get the link'}
                </Button>
                {blocked && <p className="type-small text-stop">Saving is blocked while a line is below cost.</p>}
              </div>
            )}
          </aside>
        </fieldset>
      </form>
    </div>
  );
}

/** The saved quote's link, ready to send while the customer is still on the line. */
function LinkReady({ quote, storeName }: { quote: AdminQuote; storeName: string }) {
  const url = quoteUrl(quote.token);
  const message = quoteMessage(quote, storeName, formatDate(quote.validUntil, { weekday: true }));
  return (
    <Card variant="brand" padding="md" as="section" aria-labelledby="link-ready-title" className="mb-8 grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="link-ready-title" className="type-h2">
          Link ready
        </h2>
        <p className="type-price tnum">{formatINR(quote.total)}</p>
      </div>
      <p className="type-small break-all">{url}</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <CustomerWhatsApp phone={quote.phone} text={message} label={`Send to ${quote.customerName || 'customer'} on WhatsApp`} variant="primary" size="lg" block className="sm:w-auto" />
        <CopyButton value={url} label="Copy link" size="lg" buttonVariant="outline" />
        <Button variant="ghost" size="lg" href={url} target="_blank" rel="noopener" iconLeft={<ExternalLink aria-hidden />}>
          Open as the customer
        </Button>
      </div>
    </Card>
  );
}

function EditorSkeleton() {
  return (
    <div className="container-page pb-16" aria-busy="true">
      <span className="sr-only" role="status">
        Loading the quote
      </span>
      <div className="grid gap-3 pt-6 pb-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
        <SkeletonText lines={8} />
      </div>
    </div>
  );
}
