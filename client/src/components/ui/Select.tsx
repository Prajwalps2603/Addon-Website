import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlBox } from './controlStyles';
import { useFieldControl } from './Field';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** The choices. Or pass <option> elements as children. */
  options?: ReadonlyArray<SelectOption>;
  /** A first, empty choice such as "Choose a state". */
  placeholder?: string;
  /** Error styling. Inside a Field with an `error` this is set for you. */
  invalid?: boolean;
  selectSize?: 'sm' | 'md';
  children?: ReactNode;
}

/**
 * The native select, restyled. Native on purpose: on a phone it opens the system picker,
 * which beats any custom list. For five choices or fewer, prefer RadioGroup or Segmented.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, invalid, selectSize = 'md', className, children, ...rest },
  ref,
) {
  const control = useFieldControl(rest, invalid);
  return (
    <span className={cn('relative block', className)}>
      <select
        {...control}
        ref={ref}
        className={cn(controlBox, 'appearance-none pr-10 pl-3', selectSize === 'sm' ? 'h-9' : 'h-11')}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink" />
    </span>
  );
});
