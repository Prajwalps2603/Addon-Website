import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { controlBox } from './controlStyles';
import { useFieldControl } from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Error styling. Inside a Field with an `error` this is set for you. */
  invalid?: boolean;
  /** 44 px (default) or 52 px for the one field a page is about, such as search or PIN code. */
  inputSize?: 'md' | 'lg';
  /** Fixed content before the text: an icon, "+91", "₹". */
  leading?: ReactNode;
  /** Fixed content after the text: a unit, a clear or reveal button. */
  trailing?: ReactNode;
  /** Martian Mono capitals for codes: coupon, order number, PIN code. Never for an amount in rupees. */
  mono?: boolean;
}

/**
 * Text input. Spread react-hook-form's `register()` straight onto it.
 * Set `type`, `inputMode` and `autoComplete` properly: on a phone they choose the keyboard.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, inputSize = 'md', leading, trailing, mono = false, className, type = 'text', ...rest },
  ref,
) {
  const control = useFieldControl(rest, invalid);
  const height = inputSize === 'lg' ? 'h-13' : 'h-11';
  const text = mono && 'font-mono tracking-wide uppercase placeholder:normal-case';

  if (!leading && !trailing) {
    return <input {...control} ref={ref} type={type} className={cn(controlBox, height, 'px-3', text, className)} />;
  }

  return (
    <div
      className={cn(
        controlBox,
        height,
        'flex items-center focus-within:bg-surface-2',
        'has-disabled:cursor-not-allowed has-disabled:bg-surface',
        'has-aria-invalid:border-stop/50 has-aria-invalid:bg-stop-soft',
        className,
      )}
    >
      {leading && <span className="flex shrink-0 items-center pl-3 text-muted [&_svg]:size-5">{leading}</span>}
      <input
        {...control}
        ref={ref}
        type={type}
        className={cn(
          'h-full w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-muted focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed',
          text,
        )}
      />
      {trailing && <span className="flex shrink-0 items-center pr-1.5 text-muted [&_svg]:size-5">{trailing}</span>}
    </div>
  );
});
