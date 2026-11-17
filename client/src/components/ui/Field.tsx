import { createContext, useContext, useId, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

interface ControlProps {
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined;
  'aria-required'?: boolean | 'true' | 'false' | undefined;
}

/**
 * Used by Input, Textarea and Select: picks up the id, description and error state of the
 * Field around them, so a control inside a Field is wired to its label with no extra props.
 */
export function useFieldControl<P extends ControlProps>(props: P, invalid?: boolean): P {
  const field = useContext(FieldContext);
  const describedBy = [props['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined;
  const isInvalid = invalid ?? (props['aria-invalid'] !== undefined ? props['aria-invalid'] : field?.invalid);
  return {
    ...props,
    id: props.id ?? field?.id,
    'aria-describedby': describedBy,
    'aria-invalid': isInvalid || undefined,
    // aria-required, not required: the native attribute would raise the browser's own bubble before the form's validation runs.
    'aria-required': props['aria-required'] ?? (field?.required || undefined),
  };
}

export interface FieldProps {
  label: ReactNode;
  /** Help that is always visible under the control: what format, why we ask. */
  hint?: ReactNode;
  /** The problem and how to fix it. Pass react-hook-form's `errors.name?.message`. */
  error?: ReactNode;
  /** Marks the control as required for assistive technology. Nothing is drawn: mark the optional ones instead. */
  required?: boolean;
  /** Adds "Optional" beside the label. */
  optional?: boolean;
  /** Keeps the label for screen readers but hides it, for a lone search box with an obvious purpose. */
  labelHidden?: boolean;
  /** Use when the control's id is set by hand. Otherwise an id is generated. */
  htmlFor?: string;
  className?: string;
  /** One Input, Textarea or Select. */
  children: ReactNode;
}

/**
 * Label, hint and error for one form control.
 *
 *   <Field label="Mobile number" hint="10 digits. We send order updates here." error={errors.phone?.message}>
 *     <Input type="tel" inputMode="numeric" {...register('phone')} />
 *   </Field>
 */
export function Field({ label, hint, error, required = false, optional = false, labelHidden = false, htmlFor, className, children }: FieldProps) {
  const generated = useId();
  const id = htmlFor ?? generated;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const invalid = Boolean(error);
  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className={cn('type-small flex items-baseline justify-between gap-3 font-bold', labelHidden && 'sr-only')}>
        <span>{label}</span>
        {optional && <span className="font-normal text-muted">Optional</span>}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid, required }}>{children}</FieldContext.Provider>
      {hint && (
        <p id={hintId} className="type-small text-muted">
          {hint}
        </p>
      )}
      {invalid && (
        <p id={errorId} role="alert" className="type-small flex items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
