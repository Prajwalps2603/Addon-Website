import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useController, useFieldArray, useFormContext } from 'react-hook-form';
import { ProductFrame } from '@/components/commerce';
import { Button, Field, IconButton, Input, Textarea } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { AdminProduct } from '@/types/api';
import { RowTools } from './fields';
import { ProductPicker } from './ProductPicker';
import type { ProductForm } from './productForm';

/** Spec rows: label and value, e.g. Material: ABS plastic. */
export function SpecsEditor() {
  const { control, register, formState } = useFormContext<ProductForm>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'specs', keyName: 'key' });
  const errors = formState.errors.specs;
  return (
    <div className="grid gap-2">
      <p className="type-small flex justify-between font-bold">
        <span>Specs</span>
        <span className="font-normal text-muted tnum">{fields.length} of 40</span>
      </p>
      {fields.length > 0 && (
        <ol className="grid gap-2">
          {fields.map((field, index) => (
            <li key={field.key} className="grid gap-1">
              <div className="flex items-start gap-2 max-sm:flex-wrap">
                <Input
                  aria-label={`Spec ${index + 1} name`}
                  placeholder="Material"
                  {...register(`specs.${index}.label`)}
                  invalid={Boolean(errors?.[index]?.label)}
                  className="min-w-0 flex-1 sm:max-w-56"
                />
                <Input
                  aria-label={`Spec ${index + 1} value`}
                  placeholder="ABS plastic"
                  {...register(`specs.${index}.value`)}
                  invalid={Boolean(errors?.[index]?.value)}
                  className="min-w-0 flex-[2]"
                />
                <RowTools index={index} count={fields.length} name={`spec ${index + 1}`} onMove={move} onRemove={() => remove(index)} />
              </div>
              {(errors?.[index]?.label?.message || errors?.[index]?.value?.message) && (
                <p role="alert" className="type-small text-stop">
                  {errors?.[index]?.label?.message ?? errors?.[index]?.value?.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {fields.length < 40 && (
        <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => append({ label: '', value: '' })} className="justify-self-start">
          Add spec row
        </Button>
      )}
    </div>
  );
}

/** The Fitting Card steps, each in English and Hindi. */
export function StepsEditor() {
  const { control, register, formState } = useFormContext<ProductForm>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'fittingSteps', keyName: 'key' });
  const errors = formState.errors.fittingSteps;
  return (
    <div className="grid gap-3">
      <p className="type-small flex justify-between font-bold">
        <span>Steps</span>
        <span className="font-normal text-muted tnum">{fields.length} of 40</span>
      </p>
      {fields.length > 0 && (
        <ol className="grid gap-3">
          {fields.map((field, index) => (
            <li key={field.key} className="grid gap-3 border-l border-ink pl-3 md:pl-4">
              <div className="flex items-center justify-between gap-2">
                <span className="type-h3 tnum">Step {index + 1}</span>
                <RowTools index={index} count={fields.length} name={`step ${index + 1}`} onMove={move} onRemove={() => remove(index)} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="English" error={errors?.[index]?.en?.message}>
                  <Textarea rows={3} {...register(`fittingSteps.${index}.en`)} />
                </Field>
                <Field label="Hindi" optional error={errors?.[index]?.hi?.message}>
                  <Textarea rows={3} lang="hi" {...register(`fittingSteps.${index}.hi`)} />
                </Field>
              </div>
            </li>
          ))}
        </ol>
      )}
      {fields.length < 40 && (
        <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => append({ en: '', hi: '' })} className="justify-self-start">
          Add step
        </Button>
      )}
    </div>
  );
}

export interface KnownProduct {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  artKind: string;
  price: number;
}

export function knownFrom(product: AdminProduct): KnownProduct {
  return { id: product.id, name: product.name, sku: product.sku, image: product.image, artKind: product.artKind, price: product.regularPrice };
}

/** A list of other products by id, chosen from the catalogue. */
export function RelationsEditor({
  name,
  title,
  description,
  known,
  onKnown,
  productId,
}: {
  name: 'requiresIds' | 'pairsWithIds';
  title: string;
  description: string;
  known: ReadonlyMap<number, KnownProduct>;
  onKnown: (product: KnownProduct) => void;
  productId: number | null;
}) {
  const { control, formState } = useFormContext<ProductForm>();
  const { field } = useController({ control, name });
  const ids = field.value;
  const [open, setOpen] = useState(false);
  const errors = formState.errors[name];
  const itemError = (index: number) => (Array.isArray(errors) ? (errors[index] as { message?: string } | undefined)?.message : undefined);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="type-h3">
            {title} <span className="type-small font-normal text-muted tnum">{ids.length}</span>
          </h3>
          <p className="type-small max-w-prose text-muted">{description}</p>
        </div>
        <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => setOpen(true)} disabled={ids.length >= 30}>
          Add parts
        </Button>
      </div>
      {ids.length > 0 ? (
        <ul className="grid divide-y divide-line border-y border-line">
          {ids.map((id, index) => {
            const product = known.get(id);
            const message = itemError(index);
            return (
              <li key={id} className="grid gap-1 py-2">
                <div className="flex items-center gap-3">
                  <ProductFrame image={product?.image} alt="" artKind={product?.artKind} className="size-12 shrink-0 border border-line" />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-bold">{product?.name ?? `Product ${id}`}</span>
                    <span className="flex gap-3">
                      {product && <span className="type-code text-muted">{product.sku}</span>}
                      {product && <span className="type-small tnum">{formatINR(product.price)}</span>}
                    </span>
                  </div>
                  <IconButton label={`Remove ${product?.name ?? `product ${id}`}`} onClick={() => field.onChange(ids.filter((x) => x !== id))}>
                    <Trash2 aria-hidden />
                  </IconButton>
                </div>
                {message && (
                  <p role="alert" className="type-small text-stop">
                    {message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="type-small border border-dashed border-line-strong p-4 text-muted">None yet.</p>
      )}
      {!Array.isArray(errors) && errors?.message && (
        <p role="alert" className="type-small text-stop">
          {errors.message}
        </p>
      )}
      <ProductPicker
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        multiple
        chosenIds={ids}
        excludeIds={productId ? [productId] : []}
        onPick={(product) => {
          onKnown(knownFrom(product));
          field.onChange([...field.value, product.id]);
        }}
      />
    </div>
  );
}
