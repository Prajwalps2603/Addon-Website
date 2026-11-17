import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Roundel } from '@/components/brand/Roundel';
import { TreadDivider } from '@/components/brand/TreadDivider';

export interface Step {
  label: string;
  /** A short second line, e.g. the chosen address or "COD". */
  description?: string;
}

export interface StepperProps {
  steps: ReadonlyArray<Step>;
  /** Index of the step the shopper is on, starting at 0. Pass `steps.length` when all are done. */
  current: number;
  /** Lets the shopper go back to a finished step. Steps ahead are never clickable. */
  onStepClick?: (index: number) => void;
  /** Names the process, e.g. "Checkout". */
  label?: string;
  className?: string;
}

/**
 * Checkout steps as race-number roundels joined by tread: finished steps are ink with a tick,
 * the current one is Tread Red, the rest are outlines. On a phone it folds to "Step 2 of 4" over a tread track.
 */
export function Stepper({ steps, current, onStepClick, label = 'Progress', className }: StepperProps) {
  const count = steps.length;
  const at = Math.min(count, Math.max(0, current));
  const now = steps[Math.min(at, count - 1)];

  return (
    <nav aria-label={label} className={className}>
      <div className="sm:hidden">
        <p className="type-small">
          <span className="font-bold tnum">
            Step {Math.min(at + 1, count)} of {count}
          </span>
          {now && <span className="text-muted"> · {now.label}</span>}
        </p>
        <TreadDivider size="sm" progress={count > 1 ? at / (count - 1) : 1} label={`${label}: step ${Math.min(at + 1, count)} of ${count}`} className="mt-2" />
      </div>

      <ol className="hidden sm:flex">
        {steps.map((step, index) => {
          const done = index < at;
          const active = index === at;
          const body = (
            <>
              <Roundel tone={done ? 'ink' : active ? 'brand' : 'ghost'}>
                {done ? <Check aria-hidden strokeWidth={3} className="size-4" /> : index + 1}
              </Roundel>
              <span className="grid gap-0.5">
                <span className={cn('type-small leading-tight font-bold', !done && !active && 'text-muted')}>
                  <span className="sr-only">{done ? 'Done: ' : active ? 'Current: ' : 'To do: '}</span>
                  {step.label}
                </span>
                {step.description && <span className="type-small leading-tight text-muted">{step.description}</span>}
              </span>
            </>
          );
          return (
            <li key={step.label} aria-current={active ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={cn('tread absolute top-3 right-[calc(50%+1.5rem)] left-[calc(-50%+1.5rem)] h-2', index <= at ? 'text-ink' : 'text-line')}
                />
              )}
              {done && onStepClick ? (
                <button type="button" onClick={() => onStepClick(index)} className="flex flex-col items-center gap-2 rounded-control px-2 hover:underline">
                  {body}
                </button>
              ) : (
                <span className="flex flex-col items-center gap-2 px-2">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
