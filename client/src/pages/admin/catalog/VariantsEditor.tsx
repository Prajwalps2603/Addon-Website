import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Button, Field, IconButton, Input } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { RowTools } from './fields';
import type { ProductForm, VariantForm } from './productForm';
import { marginOf, wholeNumber } from './utils';

/** Variants: each with its own name, SKU, price, MRP, stock and attributes (Size: 17 inch). */
export function VariantsEditor({ costPrice }: { costPrice: number | null }) {
  const { control, register, formState } = useFormContext<ProductForm>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'variants', keyName: 'key' });
  const errors = formState.errors.variants;

  const blank: VariantForm = { name: '', sku: '', price: '', mrp: '', stock: '0', attributes: [{ name: '', value: '' }] };

  return (
    <div className="grid gap-3">
      {fields.length > 0 && (
        <ol className="grid gap-3">
          {fields.map((field, index) => {
            const e = errors?.[index];
            return (
              <li key={field.key} className="grid gap-3 border border-line p-3 md:p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="type-label text-muted">Variant {index + 1}</h4>
                  <RowTools index={index} count={fields.length} name={`variant ${index + 1}`} onMove={move} onRemove={() => remove(index)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" error={e?.name?.message} hint="What the shopper picks, e.g. 17 inch / Gloss black">
                    <Input {...register(`variants.${index}.name`)} autoComplete="off" />
                  </Field>
                  <Field label="SKU" error={e?.sku?.message}>
                    <Input {...register(`variants.${index}.sku`)} mono autoComplete="off" autoCapitalize="characters" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Price" error={e?.price?.message}>
                    <Input {...register(`variants.${index}.price`)} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" />
                  </Field>
                  <Field label="MRP" error={e?.mrp?.message}>
                    <Input {...register(`variants.${index}.mrp`)} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" />
                  </Field>
                  <Field label="Stock" error={e?.stock?.message}>
                    <Input {...register(`variants.${index}.stock`)} inputMode="numeric" className="tnum" />
                  </Field>
                </div>
                <VariantMargin index={index} costPrice={costPrice} />
                <AttributesEditor index={index} />
                {e?.id?.message && (
                  <p role="alert" className="type-small text-stop">
                    {e.id.message}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {errors?.root?.message || errors?.message ? (
        <p role="alert" className="type-small text-stop">
          {errors?.root?.message ?? errors?.message}
        </p>
      ) : null}
      <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => append(blank)} className="justify-self-start">
        {fields.length === 0 ? 'Add variants' : 'Add another variant'}
      </Button>
    </div>
  );
}

function VariantMargin({ index, costPrice }: { index: number; costPrice: number | null }) {
  const { control } = useFormContext<ProductForm>();
  const price = wholeNumber(useWatch({ control, name: `variants.${index}.price` }));
  const mrp = wholeNumber(useWatch({ control, name: `variants.${index}.mrp` }));
  const margin = price === null ? null : marginOf(price, costPrice);
  if (price === null) return null;
  return (
    <p className="type-small text-muted tnum">
      {mrp !== null && mrp < price ? (
        <span className="font-bold text-warn">MRP is below the price. </span>
      ) : null}
      {margin ? (
        <>
          Margin at {formatINR(price)}: <span className={margin.amount < 0 ? 'font-bold text-stop' : 'font-bold text-ink'}>{formatINR(margin.amount)}</span> ({margin.percent}%)
        </>
      ) : (
        'Add a cost price above to see the margin.'
      )}
    </p>
  );
}

function AttributesEditor({ index }: { index: number }) {
  const { control, register } = useFormContext<ProductForm>();
  const { fields, append, remove } = useFieldArray({ control, name: `variants.${index}.attributes`, keyName: 'key' });
  return (
    <fieldset className="grid gap-2">
      <legend className="type-small mb-1 font-bold">
        Attributes <span className="font-normal text-muted">such as Size or Finish</span>
      </legend>
      {fields.map((field, at) => (
        <div key={field.key} className="flex items-center gap-2">
          <Input aria-label={`Attribute ${at + 1} name`} placeholder="Size" {...register(`variants.${index}.attributes.${at}.name`)} className="min-w-0 flex-1" />
          <Input aria-label={`Attribute ${at + 1} value`} placeholder="17 inch" {...register(`variants.${index}.attributes.${at}.value`)} className="min-w-0 flex-1" />
          <IconButton label={`Remove attribute ${at + 1}`} size="sm" onClick={() => remove(at)}>
            <Trash2 aria-hidden />
          </IconButton>
        </div>
      ))}
      {fields.length < 6 && (
        <Button variant="link" size="sm" onClick={() => append({ name: '', value: '' })} className="justify-self-start">
          Add attribute
        </Button>
      )}
    </fieldset>
  );
}
