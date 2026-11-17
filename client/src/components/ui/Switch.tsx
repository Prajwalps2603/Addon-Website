import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  /** What the switch turns on, e.g. "Only parts for my car". Without it, pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  /** Put the label before the track instead of after it (settings rows). */
  labelFirst?: boolean;
}

/**
 * An on/off setting that takes effect at once. A native checkbox with role="switch",
 * drawn as a slot with a sliding tile. For a choice confirmed by a Save button, use Checkbox.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, description, labelFirst = false, className, disabled, ...rest },
  ref,
) {
  const text = (label || description) && (
    <span className="grid min-w-0 flex-1 gap-0.5">
      {label && <span className="leading-snug">{label}</span>}
      {description && <span className="type-small text-muted">{description}</span>}
    </span>
  );

  return (
    <label
      className={cn(
        'flex min-h-11 items-center gap-3 py-2',
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
        className,
      )}
    >
      {labelFirst && text}
      <span className="relative inline-flex h-[22px] w-[38px] shrink-0 items-center">
        <input
          {...rest}
          ref={ref}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer absolute inset-0 size-full cursor-[inherit] appearance-none rounded-full bg-line-strong/55 transition-colors duration-200 hover:bg-line-strong/75 checked:bg-brand checked:hover:bg-brand"
        />
        <span
          aria-hidden
          className="pointer-events-none relative ml-[3px] size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-200 ease-out peer-checked:translate-x-4"
        />
      </span>
      {!labelFirst && text}
    </label>
  );
});
