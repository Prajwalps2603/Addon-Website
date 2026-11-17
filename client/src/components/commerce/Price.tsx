import { Info } from 'lucide-react';
import { Popover } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateTime, formatINR } from '@/lib/format';
import type { ProductDrop } from '@/types/api';

export interface PriceProps {
  /** What the shopper pays now, GST included. */
  price: number;
  /** The printed MRP. Left out or not above the price: no strike-through is shown. */
  mrp?: number;
  /** The regular selling price before a live drop. Only read when `drop` is set. */
  regularPrice?: number;
  /** A live drop on this product. Switches to the drop state: regular price struck, drop percent, reason on demand. */
  drop?: ProductDrop | null;
  /** Puts "From" before the price: products with variants show their lowest price. */
  from?: boolean;
  /** `lg` only: the lowest price of the 30 days before this one, shown beside a reduction when history exists. */
  lowest30Days?: number | null;
  /**
   * During a drop: show the "Drop N% off" chip with the reason on demand. Turn it off where a full DropBadge
   * already states the percent beside this price (the product page), so it is not said twice.
   */
  showDropChip?: boolean;
  /** `sm` for rows and dense lists, `md` for cards, `lg` for the product page (adds the tax line). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PRICE_TEXT = {
  sm: 'text-[0.9375rem] leading-tight font-bold tnum',
  md: 'type-price',
  lg: 'type-price-xl',
} as const;

/** Whole percent that `price` is below `mrp`, rounded down exactly as the server does. */
export function percentBelow(price: number, mrp: number): number {
  if (!(mrp > 0) || !(price < mrp)) return 0;
  return Math.max(0, Math.floor(((mrp - price) * 100) / mrp));
}

/**
 * A price, always upright and in tabular figures. Shows the struck MRP and the percent off when
 * the MRP is higher, and in the large size states that taxes are included. Every figure comes
 * from the API: this component never invents a reduction.
 */
export function Price({
  price,
  mrp = 0,
  regularPrice,
  drop = null,
  from = false,
  lowest30Days = null,
  size = 'md',
  showDropChip = true,
  className,
}: PriceProps) {
  const large = size === 'lg';
  const regular = regularPrice ?? price;
  const inDrop = drop !== null && regular > price;
  const percent = percentBelow(price, mrp);
  const reduced = inDrop || percent > 0;
  const saving = cn('font-bold text-fit tnum', large ? 'text-base' : 'text-[0.8125rem]');
  // The mrp recipe is 13 px; the product page sets the struck price a step larger without touching the recipe.
  const struck = cn('whitespace-nowrap', large ? 'text-base leading-tight text-muted line-through tnum' : 'type-mrp');

  return (
    <div className={cn('grid min-w-0 gap-1', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn(PRICE_TEXT[size], 'whitespace-nowrap')}>
          {from && <span className="type-small font-normal text-muted">From </span>}
          <span className="sr-only">Price </span>
          {formatINR(price)}
        </span>

        {inDrop ? (
          <>
            <s className={struck}>
              <span className="sr-only">Regular price </span>
              {formatINR(regular)}
            </s>
            {showDropChip && (
            <Popover
              label="About this price drop"
              className="max-w-72"
              trigger={
                <button
                  type="button"
                  className="tap-44 z-raised inline-flex h-6 shrink-0 items-center gap-1 self-center rounded-control bg-fit-soft px-2 type-label whitespace-nowrap text-fit tnum"
                >
                  Drop {drop.percentOff}% off
                  <Info aria-hidden className="size-3.5" />
                </button>
              }
            >
              <div className="grid gap-1.5">
                <p className="font-bold">{drop.percentOff}% off until the drop ends</p>
                {drop.reason && <p className="type-small">{drop.reason}</p>}
                <p className="type-small text-muted">
                  Regular price {formatINR(regular)}. Ends {formatDateTime(drop.endsAt)}.
                </p>
              </div>
            </Popover>
            )}
          </>
        ) : (
          percent > 0 && (
            <>
              <s className={struck}>
                <span className={large ? undefined : 'sr-only'}>MRP </span>
                {formatINR(mrp)}
              </s>
              <span className={saving}>{percent}% off</span>
            </>
          )
        )}
      </div>

      {large && (
        <p className="type-small text-muted">
          {inDrop && mrp > price ? `MRP ${formatINR(mrp)}, inclusive of all taxes` : percent > 0 ? 'Inclusive of all taxes' : 'MRP, inclusive of all taxes'}
        </p>
      )}
      {large && reduced && lowest30Days !== null && (
        <p className="type-small text-muted">
          Lowest price in the 30 days before this one: <span className="font-bold text-ink tnum">{formatINR(lowest30Days)}</span>
        </p>
      )}
    </div>
  );
}
