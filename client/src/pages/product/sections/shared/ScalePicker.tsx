import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ScaleOption {
  value: number;
  /** The big reading on the tile. */
  label: ReactNode;
  /** Words under it, so the number is never the only signal. */
  caption?: ReactNode;
  /** Spoken name when the tile has art instead of words. */
  ariaLabel?: string;
}

export interface ScalePickerProps {
  legend: ReactNode;
  hint?: ReactNode;
  options: readonly ScaleOption[];
  value: number | null | undefined;
  onChange: (value: number) => void;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
}

/**
 * One value from a short scale (1 to 5), drawn as a row of square tiles.
 * Native radio buttons underneath: Tab reaches the group once, arrow keys move.
 */
export function ScalePicker({ legend, hint, options, value, onChange, error, optional = false, className }: ScalePickerProps) {
  const name = useId();
  const hintId = `${name}-hint`;
  const errorId = `${name}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <fieldset className={cn('grid min-w-0 gap-2', className)} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="type-small mb-2 flex w-full items-baseline justify-between gap-3 font-bold">
        {legend}
        {optional && <span className="type-small font-normal text-muted">Optional</span>}
      </legend>
      {hint && (
        <p id={hintId} className="type-small -mt-1 text-muted">
          {hint}
        </p>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border px-1 py-2 text-center',
                'transition-colors dur-quick has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
                checked ? 'border-ink bg-brand-soft' : 'border-line-strong hover:bg-surface-2',
                error && !checked && 'border-stop',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                aria-label={option.ariaLabel}
                className="sr-only"
              />
              <span className="text-xl leading-none font-extrabold tnum">{option.label}</span>
              {option.caption && <span className="type-small leading-tight text-muted">{option.caption}</span>}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="type-small font-medium text-stop">
          {error}
        </p>
      )}
    </fieldset>
  );
}
