import { useId } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ProductVariant } from '@/types/api';
import { attributeKeys, attributeValues, valueAvailable, variantFor, variantLabel } from './variants';

export interface VariantPickerProps {
  variants: readonly ProductVariant[];
  selected: ProductVariant | null;
  onSelect: (variant: ProductVariant) => void;
  /** Shown under the pills when the shopper pressed Add before choosing. */
  error?: string | null;
}

const PILL =
  'focus-ring relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[10px] border-2 px-4 text-[0.9375rem] font-semibold dur-quick transition-colors';

/**
 * Attribute pills: one row per attribute (Colour, Size). Every value is shown; a value that only
 * exists out of stock is struck and cannot be pressed. Products whose variants carry no attributes
 * get one row of variant names.
 */
export function VariantPicker({ variants, selected, onSelect, error }: VariantPickerProps) {
  const baseId = useId();
  const keys = attributeKeys(variants);

  const groups =
    keys.length > 0
      ? keys.map((key) => ({
          key,
          options: attributeValues(variants, key).map((value) => {
            const { exists, inStock } = valueAvailable(variants, selected, key, value);
            return {
              id: value,
              label: value,
              pressed: selected?.attributes?.[key] === value,
              disabled: !exists || !inStock,
              pick: () => {
                const next = variantFor(variants, selected, key, value);
                if (next) onSelect(next);
              },
            };
          }),
        }))
      : [
          {
            key: 'Option',
            options: variants.map((variant) => ({
              id: String(variant.id),
              label: variantLabel(variant),
              pressed: selected?.id === variant.id,
              disabled: !variant.inStock,
              pick: () => onSelect(variant),
            })),
          },
        ];

  return (
    <div className="grid gap-4">
      {groups.map((group, index) => {
        const labelId = `${baseId}-${index}`;
        const chosen = group.options.find((option) => option.pressed);
        return (
          <div key={group.key} role="group" aria-labelledby={labelId} className="grid gap-2">
            <p id={labelId} className="text-sm">
              <span className="font-semibold text-muted">{group.key}: </span>
              <span className="font-bold">{chosen ? chosen.label : 'Choose one'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.pressed}
                  disabled={option.disabled}
                  onClick={option.pick}
                  className={cn(
                    PILL,
                    option.pressed
                      ? 'border-brand bg-brand-soft text-ink'
                      : 'border-line bg-page text-ink hover:border-line-strong',
                    option.disabled && 'cursor-not-allowed border-line bg-surface text-muted line-through hover:border-line',
                  )}
                >
                  {option.pressed && <Check aria-hidden className="size-4 text-brand-text" />}
                  {option.label}
                  {option.disabled && <span className="sr-only"> (sold out)</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="type-small font-bold text-stop">
          {error}
        </p>
      )}
    </div>
  );
}
