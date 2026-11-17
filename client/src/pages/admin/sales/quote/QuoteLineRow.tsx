import { TriangleAlert, Trash2 } from 'lucide-react';
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import { ProductFrame, QtyStepper } from '@/components/commerce';
import { Badge, Field, IconButton, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import { lineMargin, marginPercent, type QuoteForm } from './schema';

export interface QuoteLineRowProps {
  index: number;
  control: Control<QuoteForm>;
  register: UseFormRegister<QuoteForm>;
  setValue: UseFormSetValue<QuoteForm>;
  errors: FieldErrors<QuoteForm>;
  onRemove: () => void;
  disabled?: boolean;
}

/** One quoted part: variant, quantity and the offered price, with regular price, cost and live margin beside it. */
export function QuoteLineRow({ index, control, register, setValue, errors, onRemove, disabled = false }: QuoteLineRowProps) {
  const line = useWatch({ control, name: `items.${index}` });
  const allowBelowCost = useWatch({ control, name: 'allowBelowCost' });
  if (!line) return null;

  const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  const margin = lineMargin(line);
  const below = line.costPrice !== null && price < line.costPrice;
  const lineTotal = price * (Number.isFinite(line.qty) ? line.qty : 0);
  const off = line.regularPrice > 0 && price < line.regularPrice ? line.regularPrice - price : 0;
  const error = errors.items?.[index];

  const chooseVariant = (value: string) => {
    const variant = line.variants.find((v) => String(v.id) === value);
    if (!variant) return;
    setValue(`items.${index}.variantId`, variant.id, { shouldDirty: true });
    setValue(`items.${index}.variantName`, variant.name, { shouldDirty: true });
    setValue(`items.${index}.sku`, variant.sku, { shouldDirty: true });
    setValue(`items.${index}.regularPrice`, variant.regularPrice, { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, variant.price, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <li className={cn('grid gap-3 border p-3 transition-colors dur-quick', below ? 'border-stop bg-stop-soft' : 'border-line')}>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3">
        <ProductFrame image={line.image} alt="" className="border border-line" />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-bold">{line.name}</p>
          {line.variants.length > 1 ? null : line.variantName && <p className="type-small">{line.variantName}</p>}
          {line.sku && <p className="type-code text-muted">{line.sku}</p>}
        </div>
        <IconButton label={`Remove ${line.name}`} size="sm" onClick={onRemove} disabled={disabled}>
          <Trash2 aria-hidden />
        </IconButton>
      </div>

      {line.variants.length > 1 && (
        <Field label="Variant">
          <Select
            value={String(line.variantId ?? '')}
            disabled={disabled}
            onChange={(event) => chooseVariant(event.target.value)}
            options={line.variants.map((variant) => ({
              value: String(variant.id),
              label: `${variant.name}, ${formatINR(variant.price)}${variant.stock > 0 ? '' : ', sold out'}`,
            }))}
          />
        </Field>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <Field label="Qty" error={error?.qty?.message}>
          <Controller
            control={control}
            name={`items.${index}.qty`}
            render={({ field }) => (
              <QtyStepper value={field.value} onChange={field.onChange} label={`Quantity of ${line.name}`} disabled={disabled} />
            )}
          />
        </Field>
        <Field label="Offered price per unit" error={error?.unitPrice?.message}>
          <Input
            inputMode="numeric"
            leading="₹"
            className="tnum"
            invalid={below && !allowBelowCost ? true : undefined}
            disabled={disabled}
            {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
          />
        </Field>
      </div>

      <dl className="type-small grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-2 sm:grid-cols-4">
        <div>
          <dt className="text-muted">Regular</dt>
          <dd className="tnum">
            {formatINR(line.regularPrice)}
            {off > 0 && <span className="text-muted"> (-{formatINR(off)})</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Cost</dt>
          <dd className="tnum">{line.costPrice === null ? 'Not set' : formatINR(line.costPrice)}</dd>
        </div>
        <div>
          <dt className="text-muted">Margin</dt>
          <dd className={cn('font-bold tnum', margin !== null && margin < 0 && 'text-stop')}>
            {margin === null ? <span className="font-normal text-muted">Unknown</span> : `${formatINR(margin)} (${marginPercent(margin, lineTotal)}%)`}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Line total</dt>
          <dd className="font-bold tnum">{formatINR(lineTotal)}</dd>
        </div>
      </dl>
      {below && (
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone="stop" variant="soft" icon={<TriangleAlert aria-hidden />}>
            Below cost
          </Badge>
          <span className="type-small text-stop">{formatINR((line.costPrice ?? 0) - price)} a unit under what you paid.</span>
        </p>
      )}
    </li>
  );
}
