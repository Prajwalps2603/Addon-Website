import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckoutStageProps {
  /** 1, 2 or 3. */
  n: number;
  title: string;
  /** This stage is the one being filled in: its body shows. */
  open: boolean;
  /** Finished: a tick, and a one-line summary with Change while it is folded. */
  done: boolean;
  /** What was chosen, shown while the stage is folded. */
  summary?: ReactNode;
  /** Re-opens a finished stage. */
  onChange?: () => void;
  children: ReactNode;
}

/**
 * One stage of the step-by-step checkout, set straight on the page with no box: a heading in the
 * display face with a rule under it. Only the open stage shows its body; finished ones fold to a
 * summary with Change; later ones are greyed.
 */
export function CheckoutStage({ n, title, open, done, summary, onChange, children }: CheckoutStageProps) {
  const id = `checkout-stage-${n}`;
  return (
    <section aria-labelledby={id} className="grid">
      <header className={cn('flex items-center gap-3 border-b pb-3', open ? 'border-ink' : 'border-line')}>
        <span
          aria-hidden
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold tnum',
            done && !open ? 'bg-fit text-fit-ink' : open ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted',
          )}
        >
          {done && !open ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={id} className={cn('type-h2', !open && 'text-xl', !open && !done && 'text-muted')}>
            <span className="sr-only">Step {n}: </span>
            {title}
            {done && !open && <span className="sr-only"> (done)</span>}
          </h2>
          {!open && done && summary && <div className="mt-0.5 truncate text-sm text-muted">{summary}</div>}
        </div>
        {!open && done && onChange && (
          <button type="button" onClick={onChange} className="link shrink-0 text-sm font-bold">
            Change
          </button>
        )}
      </header>
      {open && <div className="grid gap-6 pt-5">{children}</div>}
    </section>
  );
}
