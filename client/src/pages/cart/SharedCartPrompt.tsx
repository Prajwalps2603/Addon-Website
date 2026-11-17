import { Link2 } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { usePricedCart } from '@/hooks/usePricedCart';
import { formatINR, pluralize } from '@/lib/format';
import { useCart } from '@/stores/cart';
import type { CartLineInput } from '@/types/api';

export interface SharedCartPromptProps {
  shared: { lines: CartLineInput[]; couponCode: string };
  onReplace: () => void;
  onMerge: () => void;
  onKeep: () => void;
}

/**
 * A cart link opened on a phone that already has a cart: show what the link holds, priced fresh,
 * and let the shopper choose. Nothing changes until they do.
 */
export function SharedCartPrompt({ shared, onReplace, onMerge, onKeep }: SharedCartPromptProps) {
  const own = useCart((state) => state.lines.length);
  const { cart, isPending, isError } = usePricedCart({ items: shared.lines, debounceMs: 0 });
  const units = shared.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <section aria-labelledby="shared-cart" className="grid gap-4 border border-ink p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Link2 aria-hidden className="mt-1 size-5 shrink-0" />
        <div className="grid gap-1">
          <h2 id="shared-cart" className="type-h3">
            Someone sent you a cart
          </h2>
          <p className="text-muted">
            It has {pluralize(units, 'part')}. Your own cart has {pluralize(own, 'line')}. Choose what to do: nothing changes until you do.
          </p>
        </div>
      </div>

      <ul className="grid border-t border-line" aria-busy={isPending || undefined}>
        {isPending
          ? shared.lines.slice(0, 4).map((line) => (
              <li key={`${line.productId}-${line.variantId ?? 0}`} className="flex justify-between gap-4 border-b border-line py-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-14" />
              </li>
            ))
          : (cart?.lines ?? []).map((line) => (
              <li key={line.key} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
                <span className="min-w-0">
                  <span className="tnum">{line.qty} x </span>
                  <span className="font-bold">{line.name}</span>
                  {line.variantName && <span className="text-muted">, {line.variantName}</span>}
                  {line.issue && <span className="type-small block text-stop">Not available right now</span>}
                </span>
                <span className="shrink-0 tnum">{formatINR(line.lineTotal)}</span>
              </li>
            ))}
        {isError && <li className="border-b border-line py-2.5 text-muted">Prices could not be loaded. You can still load the parts.</li>}
      </ul>
      {cart && (
        <p className="flex items-baseline justify-between gap-4">
          <span className="font-bold">Items in the link{shared.couponCode ? `, with coupon ${shared.couponCode}` : ''}</span>
          <span className="type-price tnum">{formatINR(cart.subtotal)}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onReplace}>Replace my cart</Button>
        <Button variant="outline" onClick={onMerge}>
          Add to my cart
        </Button>
        <Button variant="ghost" onClick={onKeep}>
          Keep my cart
        </Button>
      </div>
    </section>
  );
}
