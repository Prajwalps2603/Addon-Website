import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

interface AccordionContextValue {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
  headingLevel: 2 | 3 | 4;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  /** `single` closes the open item when another opens. `multiple` lets several stay open. */
  type?: 'single' | 'multiple';
  /** Items open at first, by value. */
  defaultOpen?: ReadonlyArray<string>;
  /** Heading level of the item titles, to fit the page outline. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

/**
 * Questions and answers, spec groups, policy sections: titles that open in place.
 *
 *   <Accordion type="single" defaultOpen={['delivery']}>
 *     <AccordionItem value="delivery" title="How long does delivery take?">...</AccordionItem>
 *   </Accordion>
 */
export function Accordion({ type = 'single', defaultOpen = [], headingLevel = 3, className, children }: AccordionProps) {
  const [open, setOpen] = useState<ReadonlyArray<string>>(defaultOpen);
  const toggle = (value: string) =>
    setOpen((now) => {
      if (now.includes(value)) return now.filter((item) => item !== value);
      return type === 'single' ? [value] : [...now, value];
    });
  return (
    <AccordionContext.Provider value={{ isOpen: (value) => open.includes(value), toggle, headingLevel }}>
      <div className={cn('border-t border-ink', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps {
  /** Unique within the accordion. */
  value: string;
  title: ReactNode;
  /** Shown at the right of the title row before the plus: a count, a badge. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function AccordionItem({ value, title, aside, className, children }: AccordionItemProps) {
  const accordion = useContext(AccordionContext);
  if (!accordion) throw new Error('AccordionItem must be used inside <Accordion>.');
  const id = useId();
  const open = accordion.isOpen(value);
  const Heading = `h${accordion.headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <div className={cn('border-b border-line', className)}>
      <Heading>
        <button
          type="button"
          id={`${id}-title`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => accordion.toggle(value)}
          className="focus-ring-inset flex min-h-13 w-full items-center gap-4 py-3 text-left font-bold"
        >
          <span className="min-w-0 flex-1">{title}</span>
          {aside && <span className="type-small shrink-0 font-normal text-muted">{aside}</span>}
          <Plus aria-hidden className={cn('size-5 shrink-0 transition-transform dur-base ease-settle', open && 'rotate-45')} />
        </button>
      </Heading>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-title`} hidden={!open} className="animate-fade-in pb-5">
        {children}
      </div>
    </div>
  );
}
