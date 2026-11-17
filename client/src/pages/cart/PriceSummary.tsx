import type { ReactNode } from 'react';
import { PitBoard } from '@/components/brand';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import type { PricedCart, PricedLine } from '@/types/api';

function counted(line: PricedLine): boolean {
  return line.issue === null || line.issue === 'insufficient_stock';
}

function Row({ label, value, tone, children }: { label: ReactNode; value: ReactNode; tone?: 'fit'; children?: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline justify-between gap-4">
        <dt>{label}</dt>
        <dd className={cn('font-bold tnum', tone === 'fit' && 'text-fit')}>{value}</dd>
      </div>
      {children}
    </div>
  );
}

/** Delivery split into the flat fee and any large-part surcharge, each explained. */
function deliveryNotes(cart: PricedCart, shipping: { bulkySurcharge: number; freightSurcharge: number } | undefined): string[] {
  if (!shipping || cart.shippingFee <= 0) return [];
  const live = cart.lines.filter(counted);
  const bulky = live.find((line) => line.shipClass === 'bulky');
  const freight = live.find((line) => line.shipClass === 'freight');
  const bulkyFee = bulky ? Math.max(0, shipping.bulkySurcharge) : 0;
  const freightFee = freight ? Math.max(0, shipping.freightSurcharge) : 0;
  if (bulkyFee + freightFee === 0) return [];
  const base = Math.max(0, cart.shippingFee - bulkyFee - freightFee);
  const notes = [base > 0 ? `Standard delivery ${formatINR(base)}.` : 'Standard delivery is free.'];
  if (bulky && bulkyFee > 0) notes.push(`${formatINR(bulkyFee)} for a large box: ${bulky.name} is bulky.`);
  if (freight && freightFee > 0) notes.push(`${formatINR(freightFee)} for freight: ${freight.name} is too big for a courier.`);
  return notes;
}

export interface PriceSummaryProps {
  cart: PricedCart;
  updating?: boolean;
  /** The checkout button and its reason, placed under the total on the board. */
  children?: ReactNode;
}

/** The money, on the pit board: items, coupon, studio fitting, delivery explained, total, and the GST inside it. */
export function PriceSummary({ cart, updating = false, children }: PriceSummaryProps) {
  const shipping = useSettings().data?.shipping;
  const notes = deliveryNotes(cart, shipping);
  const methodTotals = new Set(cart.paymentOptions.filter((option) => option.available).map((option) => option.total));
  const fitted = cart.lines.filter((line) => line.fitAtStudio && line.fittingCharge > 0);

  return (
    <PitBoard as="section" aria-labelledby="price-summary" title={<h2 id="price-summary">Order summary</h2>} className="gap-4 p-4 sm:p-5">
      <dl className={cn('grid gap-3 transition-opacity dur-base', updating && 'opacity-60')}>
        <Row label={`Items (${pluralize(cart.itemCount, 'part')})`} value={formatINR(cart.subtotal)}>
          {cart.savings > 0 && <p className="type-small text-muted tnum">{formatINR(cart.savings)} below MRP</p>}
        </Row>
        {cart.coupon && <Row label={<>Coupon <span className="type-code">{cart.coupon.code}</span></>} value={`-${formatINR(cart.discount)}`} tone="fit" />}
        {cart.prepaidDiscount > 0 && <Row label="Paying online in full" value={`-${formatINR(cart.prepaidDiscount)}`} tone="fit" />}
        {cart.fittingTotal > 0 && (
          <Row label="Studio fitting" value={formatINR(cart.fittingTotal)}>
            <p className="type-small text-muted">
              {pluralize(fitted.reduce((sum, line) => sum + line.qty, 0), 'part')} fitted by our team. Coupons do not apply to fitting.
            </p>
          </Row>
        )}
        {cart.fulfilment === 'delivery' ? (
          <Row label="Delivery" value={cart.shippingFee > 0 ? formatINR(cart.shippingFee) : 'Free'}>
            {notes.map((note) => (
              <p key={note} className="type-small text-muted tnum">
                {note}
              </p>
            ))}
          </Row>
        ) : (
          <Row label={cart.fulfilment === 'studio' ? 'Fitted at the studio' : 'Collect from the studio'} value="No delivery charge" />
        )}
        {cart.codFee > 0 && <Row label="Cash on delivery fee" value={formatINR(cart.codFee)} />}
        <div className="grid gap-1 border-t border-ink pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-extrabold">Total</dt>
            <dd className="type-price-xl tnum" aria-live="polite" aria-atomic="true">
              {formatINR(cart.total)}
            </dd>
          </div>
          <p className="type-small text-muted tnum">Inclusive of GST {formatINR(cart.tax.gst, { paise: !Number.isInteger(cart.tax.gst) })}</p>
          {methodTotals.size > 1 && <p className="type-small text-muted">This is the total for paying online in full. The other ways to pay are priced below.</p>}
        </div>
      </dl>
      {children}
    </PitBoard>
  );
}
