import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The clickable text. Without it, pass `aria-label`. */
  label?: ReactNode;
  /** A second, quieter line under the label. */
  description?: ReactNode;
  /** The "some but not all" state of a select-all box. */
  indeterminate?: boolean;
  invalid?: boolean;
}

/**
 * A native checkbox drawn as a tile: an ink fill and a tick in the page colour when checked.
 * The whole label row is the target (44 px tall).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate = false, invalid = false, className, disabled, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cn(
        'flex min-h-11 items-start gap-3 py-2.5',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-px grid size-5 shrink-0 place-items-center">
        <input
          {...rest}
          ref={(node) => {
            inner.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          type="checkbox"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn(
            'peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-[6px] border-[1.5px] border-line-strong bg-page',
            'transition-colors duration-200 hover:border-ink checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand',
            'aria-invalid:border-stop aria-invalid:inset-ring aria-invalid:inset-ring-stop',
          )}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none relative size-3.5 text-page opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
        />
        <Minus
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute size-3.5 text-page opacity-0 peer-indeterminate:opacity-100"
        />
      </span>
      {(label || description) && (
        <span className="grid gap-0.5">
          {label && <span className="leading-snug">{label}</span>}
          {description && <span className="type-small text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
});
