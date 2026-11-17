import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckoutSectionProps {
  /** The real step number in the checkout. */
  step: number;
  title: string;
  /** True once the shopper has given everything this step needs. */
  done?: boolean;
  /** The first step still to fill in: its roundel is Tread Red. */
  current?: boolean;
  /** Sits opposite the title: a short status or a control. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** One numbered checkout step: red while it is the one to fill in, a tick once it is complete. */
export function CheckoutSection({ step, title, done = false, current = false, aside, className, children }: CheckoutSectionProps) {
  const id = `checkout-step-${step}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'grid gap-5 rounded-[16px] border bg-raised p-5 transition-colors dur-base sm:p-6',
        current ? 'border-line-strong' : 'border-line',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tnum',
            done ? 'bg-fit text-fit-ink' : current ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted',
          )}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : step}
        </span>
        <h2 id={id} className="min-w-0 flex-1 text-lg font-bold">
          <span className="sr-only">Step {step}: </span>
          {title}
          {done && <span className="sr-only"> (complete)</span>}
        </h2>
        {aside && <div className="type-small shrink-0 text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
