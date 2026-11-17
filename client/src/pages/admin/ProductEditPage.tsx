import { useMemo, useRef, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Controller, FormProvider, useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { DemoBadge, ErrorState, PageHeader } from '@/components/commerce';
import {
  Badge,
  Button,
  Callout,
  Field,
  Input,
  Segmented,
  Select,
  Skeleton,
  SkeletonText,
  Switch,
  Textarea,
  prefersReducedMotion,
  toast,
} from '@/components/ui';
import { BUILD_SLOT_LABELS, BUILD_SLOT_STYLES, BUILD_SLOTS } from '@/features/buildbay/contract';
import { ApiError, api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber, pluralize } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminProduct, AdminProductDeleteResponse, BuildSlot, Category, ShipClass } from '@/types/api';
import { ConfirmModal } from './catalog/ConfirmModal';
import { ChoiceChips, FormSection, GroupLabel, StringList } from './catalog/fields';
import { FitmentEditor } from './catalog/FitmentEditor';
import { LabelEditor } from './catalog/LabelEditor';
import { RelationsEditor, SpecsEditor, StepsEditor, type KnownProduct } from './catalog/ListEditors';
import { PhotosEditor } from './catalog/PhotosEditor';
import {
  GST_RATES,
  KIT_GOALS,
  SECTION_OF,
  emptyProductForm,
  productSchema,
  productToForm,
  summaryFromVariants,
  toProductInput,
  type ProductForm,
} from './catalog/productForm';
import { useLeaveGuard } from './catalog/useLeaveGuard';
import { findCategory, marginOf, subcategoryGroups, wholeNumber } from './catalog/utils';
import { VariantsEditor } from './catalog/VariantsEditor';

const SECTIONS = [
  { id: 'basics', title: 'Basics' },
  { id: 'photos', title: 'Photos' },
  { id: 'price', title: 'Price and stock' },
  { id: 'fitment', title: 'Fitment' },
  { id: 'label', title: 'The Straight Label' },
  { id: 'fitting', title: 'Fitting Card' },
  { id: 'details', title: 'Details and legal' },
  { id: 'placement', title: 'Placement' },
  { id: 'goes', title: 'Goes with' },
] as const;

const SHIP_CLASSES: { value: ShipClass; label: string; detail: string }[] = [
  { value: 'small', label: 'Small', detail: 'Fits a courier pouch or small box.' },
  { value: 'medium', label: 'Medium', detail: 'A regular carton.' },
  { value: 'bulky', label: 'Bulky', detail: 'Large carton: adds the bulky surcharge once per order.' },
  { value: 'freight', label: 'Freight', detail: 'Goes by surface freight: adds the freight surcharge once per order.' },
];

const DESIGNER_TYPES = [{ value: 'show-plate', label: 'Show plate designer' }];

export default function ProductEditPage() {
  const { id: rawId } = useParams();
  const id = rawId && rawId !== 'new' ? Number(rawId) : null;
  const validId = id === null || (Number.isInteger(id) && id > 0);

  const product = useQuery({
    queryKey: queryKeys.admin.products.detail(id ?? 0),
    queryFn: ({ signal }) => api.admin.products.get(id as number, { signal }),
    enabled: id !== null && validId,
  });
  const categories = useQuery({
    queryKey: queryKeys.admin.categories.list(),
    queryFn: ({ signal }) => api.admin.categories.list({ signal }),
    staleTime: 60_000,
  });

  useDocumentMeta({ title: id === null ? 'New product' : product.data ? `Edit ${product.data.name}` : 'Edit product', noindex: true });

  const backAction = (
    <Button variant="dark" to="/admin/products">
      Back to products
    </Button>
  );

  if (!validId) {
    return (
      <div className="container-page py-10">
        <ErrorState error={new ApiError(404, 'not_found', 'No such product.')} title="No such product" notFoundAction={backAction} />
      </div>
    );
  }
  const failed = product.error ?? categories.error;
  if (failed) {
    return (
      <div className="container-page py-10">
        <ErrorState
          error={failed}
          title={product.error?.isNotFound ? 'This product does not exist' : 'Could not load the product'}
          notFoundAction={backAction}
          onRetry={() => {
            void product.refetch();
            void categories.refetch();
          }}
        />
      </div>
    );
  }
  if ((id !== null && !product.data) || !categories.data) return <EditSkeleton />;

  return <ProductEditor key={id ?? 'new'} product={id !== null ? (product.data ?? null) : null} categories={categories.data} />;
}

function EditSkeleton() {
  return (
    <div className="container-page pb-16" aria-busy="true">
      <span className="sr-only">Loading the product</span>
      <div className="grid gap-3 pt-6 pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-2/3 max-w-lg" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="hidden gap-3 lg:grid lg:content-start">
          {SECTIONS.map((s) => (
            <Skeleton key={s.id} className="h-4 w-32" />
          ))}
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
          <Skeleton className="h-11" />
          <SkeletonText lines={4} />
          <Skeleton className="mt-6 h-8 w-40" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Counts the leaf errors under one form error node (skipping the DOM refs RHF keeps on them). */
function countErrors(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  if ('type' in node && 'message' in node) return 1;
  let total = 0;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'ref' || key === 'root') continue;
    total += countErrors(value);
  }
  return total;
}

function errorsBySection(errors: FieldErrors<ProductForm>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(errors)) {
    const section = SECTION_OF[key as keyof ProductForm];
    if (!section) continue;
    out[section] = (out[section] ?? 0) + Math.max(1, countErrors(value));
  }
  return out;
}

function ProductEditor({ product, categories }: { product: AdminProduct | null; categories: Category[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const category = product ? findCategory(categories, product.categoryId) : null;
  const initial = useMemo(() => (product ? productToForm(product, category?.artKind) : emptyProductForm()), [product, category?.artKind]);

  const methods = useForm<ProductForm>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductForm>,
    defaultValues: initial,
    shouldFocusError: false,
  });
  const { control, register, handleSubmit, setError, reset, formState } = methods;
  const { errors, isDirty } = formState;

  const [known, setKnown] = useState<Map<number, KnownProduct>>(
    () =>
      new Map(
        (product?.relations ?? []).map((relation) => [
          relation.product.id,
          {
            id: relation.product.id,
            name: relation.product.name,
            sku: '',
            image: relation.product.image,
            artKind: relation.product.artKind,
            price: relation.product.regularPrice,
          },
        ]),
      ),
  );
  const addKnown = (item: KnownProduct) => setKnown((map) => new Map(map).set(item.id, item));

  const { modal: leaveModal } = useLeaveGuard(isDirty);

  const scrollToFirstError = () => {
    window.requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      if (target.matches('input, select, textarea')) target.focus({ preventScroll: true });
    });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.categories.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
    void queryClient.invalidateQueries({ queryKey: ['home'] });
  };

  const save = useMutation({
    mutationFn: (values: ProductForm) => {
      const body = toProductInput(values);
      return product ? api.admin.products.update(product.id, body) : api.admin.products.create(body);
    },
    onSuccess: (saved) => {
      setFormError(null);
      invalidate();
      queryClient.setQueryData(queryKeys.admin.products.detail(saved.id), saved);
      const savedCategory = findCategory(categories, saved.categoryId);
      reset(productToForm(saved, savedCategory?.artKind));
      toast.success(product ? 'Product saved' : 'Product created', { description: saved.name });
      if (!product) void navigate(`/admin/products/${saved.id}`, { replace: true });
    },
    onError: (error) => {
      setFormError(applyApiError(error, setError));
      scrollToFirstError();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.admin.products.remove((product as AdminProduct).id),
    onSuccess: (result) => {
      const detail = result as Partial<AdminProductDeleteResponse>;
      invalidate();
      setConfirmDelete(false);
      if (detail.deactivated) {
        const productId = (product as AdminProduct).id;
        toast.info('Hidden instead of deleted', { description: detail.message ?? 'This part is on past orders, so it was hidden from the shop.' });
        void queryClient
          .fetchQuery({ queryKey: queryKeys.admin.products.detail(productId), queryFn: () => api.admin.products.get(productId), staleTime: 0 })
          .then((fresh) => reset(initialFormFor(fresh, categories)))
          .catch(() => undefined);
      } else {
        toast.success('Product deleted', { description: product?.name });
        void navigate('/admin/products');
      }
    },
    onError: (error) => {
      setConfirmDelete(false);
      toast.error('Could not remove the product', { description: errorMessage(error) });
    },
  });

  const onSubmit = handleSubmit(
    (values) => {
      setFormError(null);
      save.mutate(values);
    },
    () => {
      setFormError(null);
      scrollToFirstError();
    },
  );

  const name = useWatch({ control, name: 'name' });
  const categoryId = useWatch({ control, name: 'categoryId' });
  const variants = useWatch({ control, name: 'variants' });
  const price = wholeNumber(useWatch({ control, name: 'price' }));
  const mrp = wholeNumber(useWatch({ control, name: 'mrp' }));
  const costPrice = wholeNumber(useWatch({ control, name: 'costPrice' }));
  const buildSlot = useWatch({ control, name: 'buildSlot' });
  const customKind = useWatch({ control, name: 'customKind' });
  const finishColor = useWatch({ control, name: 'finishColor' });
  const summary = summaryFromVariants(variants);
  const currentCategory = findCategory(categories, Number(categoryId) || null);
  const sectionErrors = errorsBySection(errors);
  const errorTotal = Object.values(sectionErrors).reduce((a, b) => a + b, 0);

  const sellingPrice = summary ? summary.price : price;
  const margin = sellingPrice === null ? null : marginOf(sellingPrice, costPrice);
  const groups = subcategoryGroups(categories);
  const styles = buildSlot ? BUILD_SLOT_STYLES[buildSlot as BuildSlot] : [];

  return (
    <div className="container-page">
      <PageHeader
        variant="plain"
        title={product ? product.name : 'New product'}
        breadcrumbs={[{ label: 'Products', to: '/admin/products' }, { label: product ? product.name : 'New product' }]}
        meta={
          product ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="type-code">{product.sku}</span>
              {product.isActive ? (
                <Badge tone="fit" size="sm">
                  In the shop
                </Badge>
              ) : (
                <Badge tone="neutral" variant="outline" size="sm">
                  Hidden
                </Badge>
              )}
              {product.isDemo && <DemoBadge />}
            </span>
          ) : undefined
        }
        actions={
          product?.isActive ? (
            <>
              <Button variant="ghost" href={`/p/${product.slug}`} target="_blank" rel="noreferrer" iconRight={<ExternalLink aria-hidden />}>
                View in shop
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-x-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Form sections" className="no-scrollbar -mx-4 mb-6 overflow-x-auto px-4 lg:sticky lg:top-4 lg:mx-0 lg:mb-0 lg:self-start lg:px-0">
          <ol className="flex gap-2 lg:grid lg:gap-0">
            {SECTIONS.map((section) => {
              const count = sectionErrors[section.id] ?? 0;
              return (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      'focus-ring flex h-11 items-center gap-2 rounded-control border border-line-strong px-3 text-sm font-bold whitespace-nowrap hover:border-ink',
                      'lg:h-10 lg:rounded-none lg:border-0 lg:border-l lg:border-line lg:px-3 lg:hover:border-ink',
                      count > 0 && 'border-stop text-stop lg:border-stop',
                    )}
                  >
                    {section.title}
                    {count > 0 && <span className="type-small tnum">{count}</span>}
                    {count > 0 && <span className="sr-only">{count === 1 ? 'problem' : 'problems'}</span>}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <FormProvider {...methods}>
          <form ref={formRef} onSubmit={onSubmit} noValidate className="min-w-0">
            {formError && (
              <Callout tone="danger" title="Not saved" live className="mb-6">
                {formError}
              </Callout>
            )}

            <FormSection id="basics" title="Basics" description="What it is and where it lives in the shop.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={errors.name?.message} className="sm:col-span-2">
                  <Input {...register('name')} autoComplete="off" inputSize="lg" />
                </Field>
                <Field label="SKU" error={errors.sku?.message}>
                  <Input {...register('sku')} mono autoComplete="off" autoCapitalize="characters" />
                </Field>
                <Field label="House line" hint="e.g. Addon Aero, Addon Lumen" error={errors.brand?.message}>
                  <Input {...register('brand')} autoComplete="off" />
                </Field>
                <Field label="Category" error={errors.categoryId?.message}>
                  <Select {...register('categoryId')}>
                    <option value="">Choose a subcategory</option>
                    {groups.map(({ parent, children }) => (
                      <optgroup key={parent.id} label={parent.isActive ? parent.name : `${parent.name} (hidden)`}>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                            {child.isActive ? '' : ' (hidden)'}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </Field>
                <Field label="Web address" optional hint={product ? `/p/${product.slug}` : 'Blank = made from the name.'} error={errors.slug?.message}>
                  <Input {...register('slug')} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                </Field>
              </div>
              <Field label="Short description" hint="One line under the name on cards and at the top of the page." error={errors.shortDescription?.message}>
                <Textarea rows={2} {...register('shortDescription')} />
              </Field>
              <Field label="Description" hint="Plain text. A blank line starts a new paragraph." error={errors.description?.message}>
                <Textarea rows={8} {...register('description')} />
              </Field>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <StringList
                    label="Tags"
                    itemName="tag"
                    variant="chips"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Type a word and press Enter"
                    hint="Words shoppers search with. Separate several with commas."
                    error={errors.tags?.message}
                  />
                )}
              />
            </FormSection>

            <FormSection id="photos" title="Photos" description="The first photo is the main one on cards and at the top of the page.">
              <Controller
                control={control}
                name="images"
                render={({ field }) => (
                  <PhotosEditor
                    value={field.value}
                    onChange={field.onChange}
                    productName={name}
                    artKind={currentCategory?.artKind}
                    error={errors.images?.message ?? (Array.isArray(errors.images) ? 'Check the photos.' : undefined)}
                  />
                )}
              />
            </FormSection>

            <FormSection id="price" title="Price and stock" description="Prices are whole rupees, GST included. The MRP is inclusive of all taxes.">
              {summary ? (
                <dl className="grid grid-cols-3 border-y border-line">
                  <ReadOnly term="Price" value={`From ${formatINR(summary.price)}`} />
                  <ReadOnly term="MRP" value={formatINR(summary.mrp)} />
                  <ReadOnly term="Stock" value={formatNumber(summary.stock)} />
                  <p className="type-small col-span-3 pb-3 text-muted">Taken from the variants below: the lowest price, and the stock of all of them.</p>
                </dl>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Field label="Price" error={errors.price?.message}>
                    <Input {...register('price')} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" inputSize="lg" />
                  </Field>
                  <Field
                    label="MRP"
                    error={errors.mrp?.message}
                    hint={
                      price !== null && mrp !== null ? (
                        mrp < price ? (
                          <span className="font-bold text-warn">Below the price: the shop will not accept this.</span>
                        ) : mrp > price ? (
                          `${Math.floor(((mrp - price) / mrp) * 100)}% below MRP`
                        ) : (
                          'Sold at MRP'
                        )
                      ) : undefined
                    }
                  >
                    <Input {...register('mrp')} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" inputSize="lg" />
                  </Field>
                  <Field label="Stock" error={errors.stock?.message}>
                    <Input {...register('stock')} inputMode="numeric" className="tnum" inputSize="lg" />
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field
                  label="Cost price"
                  optional
                  error={errors.costPrice?.message}
                  hint={
                    margin ? (
                      <span>
                        Margin <span className={cn('font-bold tnum', margin.amount < 0 ? 'text-stop' : 'text-ink')}>{formatINR(margin.amount)}</span>{' '}
                        <span className="tnum">({margin.percent}%)</span>
                        {margin.amount < 0 && ' : selling at a loss'}
                      </span>
                    ) : (
                      'Only you see this.'
                    )
                  }
                >
                  <Input {...register('costPrice')} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" />
                </Field>
                <Field label="Low stock at" hint="Warn when stock falls to this." error={errors.lowStockThreshold?.message}>
                  <Input {...register('lowStockThreshold')} inputMode="numeric" className="tnum" />
                </Field>
                <Field label="Supplier" optional hint="For the reorder list." error={errors.supplier?.message} className="col-span-2 sm:col-span-1">
                  <Input {...register('supplier')} autoComplete="off" />
                </Field>
              </div>

              <GroupLabel className="mt-2">Variants</GroupLabel>
              <p className="type-small -mt-3 text-muted">
                For sizes or finishes sold under one product. With variants, the price and stock above come from them.
              </p>
              <VariantsEditor costPrice={costPrice} />
            </FormSection>

            <FormSection id="fitment" title="Fitment" description="Decides the fit verdict every shopper sees for their own car.">
              <FitmentEditor />
            </FormSection>

            <FormSection id="label" title="The Straight Label" description="The honest facts on every product page. Say it the way you would on the phone.">
              <LabelEditor />
            </FormSection>

            <FormSection id="fitting" title="Fitting Card" description="The printable card for the customer's mechanic, in English and Hindi.">
              <Controller
                control={control}
                name="fittingTools"
                render={({ field }) => (
                  <StringList
                    label="Tools"
                    itemName="tool"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="e.g. 10 mm spanner"
                    itemErrors={toItemErrors(errors.fittingTools)}
                  />
                )}
              />
              <StepsEditor />
            </FormSection>

            <FormSection id="details" title="Details and legal" description="Specs, what is in the box, and what the law asks every listing to show.">
              <SpecsEditor />
              <Controller
                control={control}
                name="highlights"
                render={({ field }) => (
                  <StringList
                    label="Highlights"
                    itemName="highlight"
                    value={field.value}
                    onChange={field.onChange}
                    max={12}
                    placeholder="One plain fact per line"
                    itemErrors={toItemErrors(errors.highlights)}
                  />
                )}
              />
              <Controller
                control={control}
                name="boxContents"
                render={({ field }) => (
                  <StringList
                    label="What is in the box"
                    itemName="box item"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="e.g. 2 x mounting screws"
                    itemErrors={toItemErrors(errors.boxContents)}
                  />
                )}
              />

              <GroupLabel className="mt-2">Legal Metrology and GST</GroupLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Net quantity" hint="e.g. 1 piece, Set of 4" error={errors.netQuantity?.message}>
                  <Input {...register('netQuantity')} autoComplete="off" />
                </Field>
                <Field label="Country of origin" error={errors.countryOfOrigin?.message}>
                  <Input {...register('countryOfOrigin')} autoComplete="off" />
                </Field>
                <Field label="Manufacturer or importer" hint="Name and address, as on the pack." error={errors.manufacturer?.message} className="sm:col-span-2">
                  <Textarea rows={2} {...register('manufacturer')} />
                </Field>
                <Field label="HSN code" optional error={errors.hsnCode?.message}>
                  <Input {...register('hsnCode')} inputMode="numeric" autoComplete="off" mono />
                </Field>
                <Field label="GST rate" error={errors.gstRate?.message}>
                  <Select {...register('gstRate')} options={GST_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }))} />
                </Field>
              </div>

              <GroupLabel className="mt-2">Shipping, warranty and returns</GroupLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Weight" error={errors.weightGrams?.message}>
                  <Input {...register('weightGrams')} inputMode="numeric" trailing={<span className="type-small pr-3">grams</span>} className="tnum" />
                </Field>
                <Field label="Warranty" hint="0 = no warranty" error={errors.warrantyMonths?.message}>
                  <Input {...register('warrantyMonths')} inputMode="numeric" trailing={<span className="type-small pr-3">months</span>} className="tnum" />
                </Field>
              </div>
              <Controller
                control={control}
                name="shipClass"
                render={({ field }) => (
                  <div className="grid gap-1.5">
                    <span className="type-small font-bold">Shipping size</span>
                    <Segmented label="Shipping size" options={SHIP_CLASSES} value={field.value} onChange={field.onChange} block />
                    <p className="type-small text-muted">{SHIP_CLASSES.find((s) => s.value === field.value)?.detail}</p>
                  </div>
                )}
              />
              <div className="grid divide-y divide-line border-y border-line">
                <Controller
                  control={control}
                  name="returnable"
                  render={({ field }) => (
                    <Switch label="Returnable" description="Can be sent back within the return window." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} labelFirst />
                  )}
                />
                <div>
                  <Controller
                    control={control}
                    name="codEligible"
                    render={({ field }) => (
                      <Switch
                        label="Cash on delivery allowed"
                        description={customKind === 'show-plate' ? 'Show plates are prepaid only.' : undefined}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        labelFirst
                        aria-invalid={Boolean(errors.codEligible) || undefined}
                      />
                    )}
                  />
                  {errors.codEligible?.message && (
                    <p role="alert" className="type-small pb-2 text-stop">
                      {errors.codEligible.message}
                    </p>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection id="placement" title="Placement" description="Where the part turns up besides its category: kits, Build Bay, the home page.">
              <Controller
                control={control}
                name="goals"
                render={({ field }) => (
                  <ChoiceChips legend="Kit goals this part serves" options={KIT_GOALS} value={field.value} onChange={field.onChange} error={errors.goals?.message} />
                )}
              />
              <Field label="Kit rank" hint="1 = the first thing to buy for those goals. 0 = never picked for a kit by itself." error={errors.essentialRank?.message} className="max-w-xs">
                <Input {...register('essentialRank')} inputMode="numeric" className="tnum" />
              </Field>

              {/* Build Bay was removed from the shop; its fields stay in the form data but are not shown. */}
              <GroupLabel className="mt-2 hidden">Build Bay</GroupLabel>
              <div className="hidden">
                <Field label="Slot" error={errors.buildSlot?.message}>
                  <Select
                    {...register('buildSlot', {
                      onChange: () => methods.setValue('buildStyle', '', { shouldDirty: true }),
                    })}
                  >
                    <option value="">Not in Build Bay</option>
                    {BUILD_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {BUILD_SLOT_LABELS[slot]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Style" error={errors.buildStyle?.message}>
                  <Select {...register('buildStyle')} disabled={!buildSlot}>
                    <option value="">{buildSlot ? 'Choose a style' : 'Choose a slot first'}</option>
                    {styles.map((style) => (
                      <option key={style.style} value={style.style}>
                        {style.label}
                        {style.bodyTypes.length < 3 ? ` (${style.bodyTypes.join(', ')} only)` : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Finish colour" optional hint="Hex, e.g. #1A1A1A" error={errors.finishColor?.message}>
                  <Input
                    {...register('finishColor')}
                    autoComplete="off"
                    mono
                    leading={
                      <span
                        aria-hidden
                        className="block size-5 rounded-control border border-line-strong"
                        style={/^#[0-9a-f]{6}$/i.test(finishColor) ? { backgroundColor: finishColor } : undefined}
                      />
                    }
                  />
                </Field>
              </div>

              <GroupLabel className="mt-2">Designer and icon</GroupLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Designer type" hint="Products set up in a designer before buying." error={errors.customKind?.message}>
                  <Select {...register('customKind')}>
                    <option value="">None: sold as it is</option>
                    {DESIGNER_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                    {customKind && !DESIGNER_TYPES.some((d) => d.value === customKind) && <option value={customKind}>{customKind}</option>}
                  </Select>
                </Field>
                <Field
                  label="Icon and photo pool"
                  optional
                  hint={currentCategory ? `Blank = same as the category (${currentCategory.artKind}).` : 'Blank = same as the category.'}
                  error={errors.artKind?.message}
                >
                  <Input {...register('artKind')} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={currentCategory?.artKind} />
                </Field>
              </div>

              <div className="grid divide-y divide-line border-y border-line">
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch label="In the shop" description="Off hides it from shoppers. Past orders keep it." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} labelFirst />
                  )}
                />
                <Controller
                  control={control}
                  name="isFeatured"
                  render={({ field }) => (
                    <Switch label="Featured" description="Shown in the featured row on the home page." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} labelFirst />
                  )}
                />
                <Controller
                  control={control}
                  name="isNew"
                  render={({ field }) => (
                    <Switch label="New arrival" description="Shown with the new arrivals." checked={field.value} onChange={(e) => field.onChange(e.target.checked)} labelFirst />
                  )}
                />
              </div>
            </FormSection>

            <FormSection id="goes" title="Goes with" description="Shown on the product page and used by the cart's Sanity Check.">
              <RelationsEditor
                name="requiresIds"
                title="You will also need"
                description="Parts the shopper cannot fit this without, e.g. a wiring harness."
                known={known}
                onKnown={addKnown}
                productId={product?.id ?? null}
              />
              <RelationsEditor
                name="pairsWithIds"
                title="Works well with"
                description="Optional extras that go with it."
                known={known}
                onKnown={addKnown}
                productId={product?.id ?? null}
              />
            </FormSection>

            {product && (
              <section aria-labelledby="remove-heading" className="grid gap-3 border-t border-line pt-5 pb-10">
                <h2 id="remove-heading" className="type-h3">
                  Remove this product
                </h2>
                <p className="type-small max-w-prose text-muted">
                  A product that has never been ordered is deleted for good. One that is on past orders is hidden from the shop instead, so those
                  orders and invoices stay complete.
                </p>
                <Button variant="outline" iconLeft={<Trash2 aria-hidden />} onClick={() => setConfirmDelete(true)} className="justify-self-start">
                  Delete or hide
                </Button>
              </section>
            )}

            <div className="sticky bottom-0 z-sticky -mx-4 flex items-center justify-between gap-3 border-t border-ink bg-page px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:mx-0 md:px-0">
              <p className="type-small min-w-0" aria-live="polite">
                {errorTotal > 0 ? (
                  <span className="font-bold text-stop">{pluralize(errorTotal, 'field')} to fix</span>
                ) : isDirty ? (
                  <span className="font-bold">Unsaved changes</span>
                ) : product ? (
                  <span className="text-muted">All changes saved</span>
                ) : (
                  <span className="text-muted">Not saved yet</span>
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {isDirty && product && (
                  <Button variant="ghost" onClick={() => reset(initialFormFor(product, categories))} disabled={save.isPending}>
                    Undo changes
                  </Button>
                )}
                <Button type="submit" size="lg" loading={save.isPending}>
                  {product ? 'Save product' : 'Create product'}
                </Button>
              </div>
            </div>
          </form>
        </FormProvider>
      </div>

      {leaveModal}
      {product && (
        <ConfirmModal
          open={confirmDelete}
          title={`Remove ${product.name}?`}
          confirmLabel="Delete or hide"
          busy={remove.isPending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
        >
          <p>If it has never been ordered it is deleted and cannot be brought back. If it is on past orders it is hidden from the shop instead.</p>
          {isDirty && <p className="font-bold">Your unsaved changes on this page will be lost.</p>}
        </ConfirmModal>
      )}
    </div>
  );
}

function initialFormFor(product: AdminProduct, categories: Category[]): ProductForm {
  return productToForm(product, findCategory(categories, product.categoryId)?.artKind);
}

function toItemErrors(node: unknown): Record<number, string | undefined> {
  const out: Record<number, string | undefined> = {};
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      if (item && typeof item === 'object' && 'message' in item) out[index] = String((item as { message?: unknown }).message ?? '');
    });
  }
  return out;
}

function ReadOnly({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 pr-3">
      <dt className="type-label text-muted">{term}</dt>
      <dd className="type-price tnum">{value}</dd>
    </div>
  );
}
