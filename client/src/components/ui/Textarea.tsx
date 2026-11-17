import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { controlBox } from './controlStyles';
import { useFieldControl } from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error styling. Inside a Field with an `error` this is set for you. */
  invalid?: boolean;
}

/** Multi-line text. Grows by hand (drag the corner); give it enough `rows` for a typical answer. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 4, ...rest },
  ref,
) {
  const control = useFieldControl(rest, invalid);
  return (
    <textarea
      {...control}
      ref={ref}
      rows={rows}
      className={cn(controlBox, 'min-h-24 resize-y px-3 py-2.5 leading-normal', className)}
    />
  );
});
