import { useId, useState } from 'react';
import { ChevronDown, CreditCard } from 'lucide-react';
import { DropBadge, Price, percentBelow } from '@/components/commerce';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatDate, formatINR } from '@/lib/format';
import type { ProductDetail, ProductVariant } from '@/types/api';
import { PriceSparkline } from './PriceSparkline';
import { EMI_MONTHS, emiMonthly } from './studio';

export interface PricePanelProps {
  product: ProductDetail;
  /** The chosen variant: its price, regular price and MRP replace the product's. */
  variant: ProductVariant | null;
}

/**
 * The price at full size: struck MRP and percent off, "inclusive of all taxes", the drop state
 * with the owner's reason and the real countdown, the lowest price of the last 30 days, and the
 * price history behind a disclosure.
 */
export function PricePanel({ product, variant }: PricePanelProps) {
  const price = variant?.price ?? product.price;
  const regularPrice = variant?.regularPrice ?? product.regularPrice;
  const mrp = variant?.mrp ?? product.mrp;
  const fromPrice = product.hasVariants && !variant && product.variants.some((v) => v.price !== product.price);
  const inDrop = product.drop !== null && regularPrice > price;

  return (
    <div className="grid gap-3">
      {inDrop ? (
        <Price
        size="lg"
        price={price}
        mrp={mrp}
        regularPrice={regularPrice}
        drop={product.drop}
        from={fromPrice}
        lowest30Days={product.lowest30Days}
        showDropChip={!inDrop}
      />
      ) : (
        <PriceHero price={price} mrp={mrp} from={fromPrice} lowest30Days={product.lowest30Days} />
      )}
      {inDrop && product.drop && <DropBadge variant="full" drop={product.drop} />}
      <EmiLine price={price} />
      <PriceHistory history={product.priceHistory} current={price} />
    </div>
  );
}

/**
 * The everyday price, set big in the italic display face with a slanted "% off" tag beside it,
 * and one quiet line under it: struck MRP, the saving in rupees, taxes included.
 */
function PriceHero({ price, mrp, from, lowest30Days }: { price: number; mrp: number; from: boolean; lowest30Days: number | null }) {
  const percent = percentBelow(price, mrp);
  return (
    <div className="grid gap-2">
      <p className="type-label tracking-widest text-muted uppercase">{from ? 'Starts at' : 'Your price'}</p>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <p className="font-display text-[1.75rem] leading-none font-extrabold italic tnum">
          <span className="sr-only">Price </span>
          {formatINR(price)}
        </p>
        {percent > 0 && (
          <span className="type-label tracking-wider text-brand-text uppercase tnum">{percent}% off</span>
        )}
      </div>
      <p className="type-small text-muted">
        {percent > 0 ? (
          <>
            MRP <s className="tnum">{formatINR(mrp)}</s>
            <span aria-hidden> · </span>
            <span className="font-bold text-fit tnum">You save {formatINR(mrp - price)}</span>
            <span aria-hidden> · </span>
            Inclusive of all taxes
          </>
        ) : (
          'MRP, inclusive of all taxes'
        )}
      </p>
      {percent > 0 && lowest30Days !== null && (
        <p className="type-small text-muted">
          Lowest price in the 30 days before this one: <span className="font-bold text-ink tnum">{formatINR(lowest30Days)}</span>
        </p>
      )}
    </div>
  );
}

/** "EMI from ₹X a month with Bajaj Finserv": the price over nine months, rounded up, said to be indicative. */
function EmiLine({ price }: { price: number }) {
  const emi = useSettings().data?.emi;
  const monthly = emiMonthly(price, emi);
  if (!emi || monthly === null) return null;
  return (
    <p className="flex items-start gap-2 type-small">
      <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-bold tnum">
          EMI from {formatINR(monthly)} a month with {emi.partner}.
        </span>
        <span className="text-muted">
          {' '}
          Indicative: the price split over {EMI_MONTHS} months. {emi.note || `${emi.partner} sets the final plan and any charges.`}
        </span>
      </span>
    </p>
  );
}

function PriceHistory({ history, current }: { history: ProductDetail['priceHistory']; current: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (history.length < 2) return null;

  let high = history[0];
  let low = history[0];
  for (const point of history) {
    if (point.price > high.price) high = point;
    if (point.price < low.price) low = point;
  }

  return (
    <div className="border-t border-line pt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring inline-flex min-h-11 items-center gap-1.5 type-small font-bold"
      >
        Price history
        <ChevronDown aria-hidden className={cn('size-4 dur-base transition-transform', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="grid gap-3 pb-2">
        <PriceSparkline history={history} current={current} />
        <dl className="grid grid-cols-3 gap-3 type-small">
          <div className="grid gap-0.5">
            <dt className="text-muted">Now</dt>
            <dd className="font-bold tnum">{formatINR(current)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted">Lowest</dt>
            <dd className="font-bold tnum">{formatINR(low.price)}</dd>
            <dd className="text-muted tnum">{formatDate(low.date)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted">Highest</dt>
            <dd className="font-bold tnum">{formatINR(high.price)}</dd>
            <dd className="text-muted tnum">{formatDate(high.date)}</dd>
          </div>
        </dl>
        <p className="type-small text-muted">
          Every price we have charged since {formatDate(history[0].date, { year: true })}. Shown so you can judge a reduction yourself.
        </p>
      </div>
    </div>
  );
}
