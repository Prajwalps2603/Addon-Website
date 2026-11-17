import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'size'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /**
   * The current value in words, shown at the right end and read by screen readers instead of the bare number:
   * "₹25,000", "35% light let through". Pass a function of the value.
   */
  format?: (value: number) => ReactNode;
  /** Text for screen readers when `format` returns something that is not plain text. */
  valueText?: (value: number) => string;
  className?: string;
}

/**
 * A range control: a budget, the darkness of a window film. A native range input (arrow keys, Page Up
 * and Down, Home and End all work) in Tread Red, 44 px tall, with the value in words beside it.
 * Wrap it in a Field for its label. For an exact figure the shopper types, use Input.
 */
export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { value, onChange, min = 0, max = 100, step = 1, format, valueText, className, disabled, ...rest },
  ref,
) {
  const control = useFieldControl(rest);
  const shown = format ? format(value) : value;
  const spoken = valueText ? valueText(value) : typeof shown === 'string' || typeof shown === 'number' ? String(shown) : undefined;

  return (
    <div className={cn('flex min-h-11 items-center gap-3', disabled && 'opacity-45', className)}>
      <input
        {...control}
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={spoken}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="focus-ring h-11 min-w-0 flex-1 cursor-pointer accent-brand disabled:cursor-not-allowed"
      />
      <output aria-hidden className="shrink-0 text-right type-small font-bold tnum">
        {shown}
      </output>
    </div>
  );
});
