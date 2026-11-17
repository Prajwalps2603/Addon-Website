import type { ReactNode } from 'react';
import { PackageSearch } from 'lucide-react';
import { WhatsAppButton } from '@/components/commerce';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { formatINR } from '@/lib/format';

export interface NoKitsProps {
  budget: number;
  /** What the kit was for, in a few words: 'a sound kit for the Swift'. */
  what: string;
  /** The smallest budget that gives a kit: a number, null when nothing matches at all, undefined while it is worked out. */
  lowest: number | null | undefined;
  lowestFailed: boolean;
  onUseBudget: (budget: number) => void;
  /** Ready text for a WhatsApp message to the shop. */
  askText: string;
  /** Other ways on (another vibe, the shop). */
  actions?: ReactNode;
}

/**
 * No kit came back. Either the budget is too small, and the page says the smallest one that works,
 * or nothing in stock matches the car and goal, and the shop can be asked on WhatsApp.
 */
export function NoKits({ budget, what, lowest, lowestFailed, onUseBudget, askText, actions }: NoKitsProps) {
  const art = <PackageSearch aria-hidden className="size-10" />;

  if (lowest === undefined && !lowestFailed) {
    return (
      <div className="grid max-w-xl gap-3 border border-line p-5" aria-live="polite">
        <p className="type-h3">Not enough for {what} at {formatINR(budget)}</p>
        <p className="type-small text-muted">Working out the smallest budget that gives a kit of two or more parts.</p>
        <Skeleton className="h-11 w-48" />
      </div>
    );
  }

  if (typeof lowest === 'number') {
    return (
      <EmptyState
        art={art}
        title={`Not enough for ${what} at ${formatINR(budget)}`}
        description={`A kit needs at least two parts that fit. The smallest budget that gives one is ${formatINR(lowest)}.`}
        actions={
          <>
            <Button onClick={() => onUseBudget(lowest)} className="tnum">
              Use {formatINR(lowest)}
            </Button>
            {actions}
          </>
        }
      />
    );
  }

  return (
    <EmptyState
      art={art}
      title="No parts match yet"
      description={
        lowestFailed
          ? `Nothing came back for ${what} at ${formatINR(budget)}. Try a larger budget, or ask the shop.`
          : `Nothing in stock is tagged for ${what} right now, at any budget. The shop can still suggest parts by hand.`
      }
      actions={
        <>
          <WhatsAppButton text={askText} variant="dark">
            Ask the shop on WhatsApp
          </WhatsAppButton>
          {actions}
        </>
      }
    />
  );
}
