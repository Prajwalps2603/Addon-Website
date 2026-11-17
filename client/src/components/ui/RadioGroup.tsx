import { useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface RadioOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** A quieter second line: what choosing this means. */
  description?: ReactNode;
  /** Right-aligned content, such as the price of a payment method. */
  trailing?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<T extends string = string> {
  /** The question, shown as the group's legend. */
  legend: ReactNode;
  /** Keeps the legend for screen readers only. */
  legendHidden?: boolean;
  name?: string;
  options: ReadonlyArray<RadioOption<T>>;
  value: T | null | undefined;
  onChange: (value: T) => void;
  /**
   * `plain` is a simple list. `card` gives each choice its own bordered row and marks the
   * chosen one: use it for payment methods, delivery options and other choices with detail.
   */
  variant?: 'plain' | 'card';
  orientation?: 'vertical' | 'horizontal';
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * One choice from a few, as native radio buttons (arrow keys move between them).
 * With react-hook-form, wrap it in a Controller and pass `field.value` and `field.onChange`.
 */
export function RadioGroup<T extends string = string>({
  legend,
  legendHidden = false,
  name,
  options,
  value,
  onChange,
  variant = 'plain',
  orientation = 'vertical',
  error,
  disabled = false,
  className,
}: RadioGroupProps<T>) {
  const generated = useId();
  const groupName = name ?? generated;
  const errorId = `${generated}-error`;
  const card = variant === 'card';

  return (
    <fieldset
      role="radiogroup"
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={cn('min-w-0', className)}
    >
      <legend className={cn('type-small mb-2 font-bold', legendHidden && 'sr-only')}>{legend}</legend>
      <div
        className={cn(
          'flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap gap-x-6',
          card && 'gap-2',
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          const off = disabled || option.disabled;
          return (
            <label
              key={option.value}
              className={cn(
                'flex min-h-11 items-start gap-3',
                off ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                card
                  ? cn(
                      'rounded-control border p-3 transition-colors dur-quick',
                      checked ? 'border-ink bg-brand-soft' : 'border-line-strong hover:border-ink',
                    )
                  : 'py-2.5',
              )}
            >
              <span className="relative mt-px grid size-5 shrink-0 place-items-center">
                <input
                  type="radio"
                  name={groupName}
                  value={option.value}
                  checked={checked}
                  disabled={off}
                  onChange={() => onChange(option.value)}
                  className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-full border border-line-strong bg-page transition-colors dur-quick hover:border-ink checked:border-ink checked:bg-ink"
                />
                <span aria-hidden className="relative size-2 rounded-full bg-page opacity-0 peer-checked:opacity-100" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className={cn('leading-snug', card && 'font-bold')}>{option.label}</span>
                {option.description && <span className="type-small text-muted">{option.description}</span>}
              </span>
              {option.trailing && <span className="shrink-0 text-right tnum">{option.trailing}</span>}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="type-small mt-2 flex items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
