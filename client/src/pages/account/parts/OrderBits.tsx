import { ProductFrame } from '@/components/commerce';
import { cn } from '@/lib/cn';
import type { OrderItem } from '@/types/api';

const BOX = 'size-12 shrink-0 sm:size-14';

/** Up to `max` item photos in a row, then "+N" for the rest. */
export function OrderThumbs({ items, max = 4, className }: { items: readonly OrderItem[]; max?: number; className?: string }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <ul className={cn('flex items-center gap-1.5', className)} aria-label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
      {shown.map((item) => {
        const alt = item.variantName ? `${item.name}, ${item.variantName}` : item.name;
        return (
          <li key={item.id} className={cn(BOX, 'border border-line')}>
            <ProductFrame image={item.image} alt={alt} variant="tiny" sizes="56px" />
          </li>
        );
      })}
      {rest > 0 && <li className={cn(BOX, 'type-small grid place-items-center bg-surface font-bold tnum')}>+{rest}</li>}
    </ul>
  );
}
