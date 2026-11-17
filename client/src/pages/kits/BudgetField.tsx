import { useId } from 'react';
import { Chip, Field, Input, Slider } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber } from '@/lib/format';
import { clamp, parseRupees } from './kitShared';

export interface BudgetFieldProps {
  label: string;
  hint?: string;
  /** What is typed, e.g. '25,000'. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  min: number;
  max: number;
  /** Slider step in rupees. Leave out to show no slider. */
  sliderStep?: number;
  quickAmounts: readonly number[];
  name?: string;
  className?: string;
}

/**
 * A rupee budget: the amount typed in a box, with a row of quick amounts and, optionally, a
 * slider. All three move together. The box accepts '25000', '25,000' or '₹25,000'.
 */
export function BudgetField({
  label,
  hint,
  value,
  onChange,
  onBlur,
  error,
  min,
  max,
  sliderStep,
  quickAmounts,
  name,
  className,
}: BudgetFieldProps) {
  const sliderId = useId();
  const amount = parseRupees(value);
  const sliderValue = clamp(amount ?? min, min, max);

  return (
    <div className={cn('grid gap-3', className)}>
      <Field label={label} hint={hint} error={error}>
        <Input
          name={name}
          inputSize="lg"
          inputMode="numeric"
          autoComplete="off"
          leading={<span className="font-bold">₹</span>}
          className="tnum"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (amount !== null) onChange(formatNumber(amount));
            onBlur?.();
          }}
        />
      </Field>

      {sliderStep !== undefined && (
        <div className="grid gap-1">
          <label htmlFor={sliderId} className="sr-only">
            {label}: slide to set
          </label>
          <Slider
            id={sliderId}
            min={min}
            max={max}
            step={sliderStep}
            value={sliderValue}
            format={formatINR}
            onChange={(next) => onChange(formatNumber(next))}
          />
          <p className="type-small text-muted tnum">
            Slide from {formatINR(min)} to {formatINR(max)}, or type any amount.
          </p>
        </div>
      )}

      <div role="group" aria-label="Quick amounts" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {quickAmounts.map((quick) => (
          <Chip key={quick} selected={amount === quick} onClick={() => onChange(formatNumber(quick))} className="tnum">
            {formatINR(quick)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
