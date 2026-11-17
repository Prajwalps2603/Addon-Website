import { useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MAX_LINE_QTY } from '@/stores/cart';

export interface QtyStepperProps {
  value: number;
  /** Called with a whole number already held between `min` and `max`. */
  onChange: (qty: number) => void;
  /** Lowest quantity. Pass 0 where stepping below one should remove the line. */
  min?: number;
  /** Highest quantity: the stock available (`PricedLine.maxQty`, a variant's `stock`). Never above 99. */
  max?: number;
  size?: 'sm' | 'md';
  /** Names the control for screen readers, e.g. "Quantity of Addon Aero Spoiler". */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Minus, a number that can also be typed, plus. The buttons stop at `min` and `max`,
 * and a typed number is pulled back inside them when the field is left.
 */
export function QtyStepper({ value, onChange, min = 1, max = MAX_LINE_QTY, size = 'md', label = 'Quantity', disabled = false, className }: QtyStepperProps) {
  // What is being typed, until it is committed. null means the field shows `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const top = Math.min(Math.max(min, max), MAX_LINE_QTY);
  const clamp = (qty: number) => Math.min(top, Math.max(min, qty));

  const set = (qty: number) => {
    const next = clamp(qty);
    if (next !== value) onChange(next);
  };

  const commit = () => {
    if (draft === null) return;
    const typed = Number.parseInt(draft, 10);
    setDraft(null);
    if (Number.isFinite(typed)) set(typed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      setDraft(null);
      set(value + (event.key === 'ArrowUp' ? 1 : -1));
    }
  };

  const small = size === 'sm';
  const button = cn(
    'tap-44 grid shrink-0 place-items-center text-ink transition-colors dur-quick active:scale-[0.94]',
    'disabled:pointer-events-none disabled:text-line-strong focus-ring-inset [&_svg]:size-4',
    // The small one is a compact pill: round buttons inside a rounded outline.
    small ? 'size-7 rounded-full bg-surface hover:bg-surface-2 [&_svg]:size-3.5' : 'size-11 hover:bg-surface-2',
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex bg-page',
        small ? 'items-center gap-0.5 rounded-full border border-line-strong p-0.5' : 'items-stretch rounded-control border border-line-strong',
        disabled && 'opacity-45',
        className,
      )}
    >
      <button type="button" aria-label="Decrease quantity" disabled={disabled || value <= min} onClick={() => set(value - 1)} className={button}>
        <Minus aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={top}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, '').slice(0, 2))}
        onFocus={(event) => event.target.select()}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cn(
          'min-w-0 bg-transparent text-center font-bold tnum focus-ring-inset',
          small ? 'w-8 text-sm' : 'w-12 border-x border-line text-base',
        )}
      />
      <button type="button" aria-label="Increase quantity" disabled={disabled || value >= top} onClick={() => set(value + 1)} className={button}>
        <Plus aria-hidden />
      </button>
    </div>
  );
}
