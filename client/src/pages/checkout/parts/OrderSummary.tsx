import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { OctagonAlert, Wrench } from 'lucide-react';
import { isShowPlate, SHOW_PLATE_NOTE } from '@/components/cart/lineNotes';
import { CustomSummary, ProductFrame } from '@/components/commerce';
import { Badge, Button, Callout, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import type { CartLineIssue, PricedCart, PricedLine } from '@/types/api';

function issueText(issue: CartLineIssue, line: PricedLine): string | null {
  if (issue === 'unavailable') return 'No longer sold';
  if (issue === 'out_of_stock') return 'Sold out';
  if (issue === 'insufficient_stock') return `Only ${line.maxQty} left`;
  return null;
}

function SummaryLine({ line }: { line: PricedLine }) {
  const issue = issueText(line.issue, line);
  return (
    <li className="flex gap-3 py-3">
      <Link to={`/p/${line.slug}`} className="w-14 shrink-0" tabIndex={-1} aria-hidden>
        <ProductFrame image={line.image} alt="" artKind={line.artKind} />
      </Link>
      <div className="grid min-w-0 flex-1 content-start gap-0.5">
        <Link to={`/p/${line.slug}`} className="line-clamp-2 leading-snug font-bold hover:underline">
          {line.name}
        </Link>
        {line.variantName && <span className="type-small text-muted">{line.variantName}</span>}
        <span className="type-small text-muted tnum">
          {line.qty} × {formatINR(line.unitPrice)}
          {line.unitMrp > line.unitPrice && (
            <>
              {' '}
              <s className="type-mrp">{formatINR(line.unitMrp)}</s>
            </>
          )}
        </span>
        {line.custom && <CustomSummary custom={line.custom} heading={false} />}
        {isShowPlate(line.custom) && <span className="type-small text-muted">{SHOW_PLATE_NOTE}</span>}
        {line.fitAtStudio && (
          <span className="type-small inline-flex items-start gap-1.5">
            <Wrench aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="tnum">
              Fitted at the studio{line.fittingServiceName ? `: ${line.fittingServiceName}` : ''}, {line.fittingCharge > 0 ? formatINR(line.fittingCharge) : 'no charge'}
            </span>
          </span>
        )}
        {issue && (
          <Badge tone="stop" size="sm" icon={<OctagonAlert aria-hidden />} className="mt-1 justify-self-start">
            {issue}
          </Badge>
        )}
      </div>
      <span className="type-price shrink-0 tnum">{formatINR(line.lineTotal)}</span>
    </li>
  );
}

function Row({ label, value, tone, strong }: { label: ReactNode; value: string; tone?: 'fit'; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong && 'font-bold')}>
      <dt className={cn(!strong && 'text-muted')}>{label}</dt>
      <dd className={cn('tnum', tone === 'fit' && 'text-fit')}>{value}</dd>
    </div>
  );
}

export interface OrderSummaryProps {
  cart: PricedCart | undefined;
  isPending: boolean;
  isUpdating: boolean;
  /** Quote checkout: the lines are fixed and coupons do not apply. */
  fromQuote: boolean;
  /** Show the totals heading (the desktop column) or leave it to the surrounding disclosure (mobile). */
  heading?: boolean;
  className?: string;
}

/** The order as the server priced it: lines, discounts, delivery, fees, total, GST, and what still needs fixing. */
export function OrderSummary({ cart, isPending, isUpdating, fromQuote, heading = true, className }: OrderSummaryProps) {
  if (isPending || !cart) {
    return (
      <div className={cn('grid gap-4', className)} aria-busy="true" aria-label="Loading your order">
        {heading && <Skeleton className="h-7 w-40" />}
        {[0, 1].map((n) => (
          <div key={n} className="flex gap-3">
            <Skeleton className="size-14" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const problems = cart.advice.filter((item) => item.severity === 'problem');
  const showSplit = cart.dueOnDelivery > 0;

  return (
    <div className={cn('grid gap-4', className)}>
      {heading && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="type-h2">Your order</h2>
          {!fromQuote && (
            <Button to="/cart" variant="link" size="sm">
              Edit cart
            </Button>
          )}
        </div>
      )}

      <ul className="divide-y divide-line border-y border-line" aria-label={pluralize(cart.itemCount, 'item')}>
        {cart.lines.map((line) => (
          <SummaryLine key={line.key} line={line} />
        ))}
      </ul>

      {cart.messages.length > 0 && (
        <Callout tone="info" live>
          <ul className="grid gap-1">
            {cart.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Callout>
      )}

      {problems.length > 0 && (
        <Callout
          tone="danger"
          title="Fix these before you order"
          actions={
            fromQuote ? null : (
              <Button to="/cart" variant="outline" size="sm">
                Fix in cart
              </Button>
            )
          }
        >
          <ul className="grid gap-1">
            {problems.map((problem) => (
              <li key={`${problem.code}-${problem.productIds.join('-')}`}>{problem.message}</li>
            ))}
          </ul>
        </Callout>
      )}

      <dl
        className={cn('grid gap-2 transition-opacity dur-base', isUpdating && 'opacity-60')}
        aria-busy={isUpdating || undefined}
      >
        <Row label={`Items (${cart.itemCount})`} value={formatINR(cart.subtotal)} />
        {cart.coupon && cart.discount > 0 && (
          <Row
            label={
              <>
                Coupon <span className="type-code">{cart.coupon.code}</span>
              </>
            }
            value={`-${formatINR(cart.discount)}`}
            tone="fit"
          />
        )}
        {cart.prepaidDiscount > 0 && <Row label="Paying online in full" value={`-${formatINR(cart.prepaidDiscount)}`} tone="fit" />}
        {cart.fittingTotal > 0 && <Row label="Studio fitting" value={formatINR(cart.fittingTotal)} />}
        {cart.fulfilment === 'delivery' ? (
          <Row label="Delivery" value={cart.shippingFee === 0 ? 'Free' : formatINR(cart.shippingFee)} />
        ) : (
          <Row label={cart.fulfilment === 'studio' ? 'Fitted at the studio' : 'Collect from the studio'} value="No delivery charge" />
        )}
        {cart.codFee > 0 && <Row label="Cash on delivery fee" value={formatINR(cart.codFee)} />}
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ink pt-3">
          <dt className="font-bold">Total</dt>
          <dd className="type-price-xl tnum">{formatINR(cart.total)}</dd>
        </div>
        <p className="type-small text-right text-muted tnum">Includes GST of {formatINR(cart.tax.gst, { paise: true })}</p>
        {showSplit && (
          <div className="mt-1 grid gap-1 border-t border-line pt-3">
            <Row label="Pay now" value={formatINR(cart.payNow)} strong />
            <Row label={cart.fulfilment === 'delivery' ? 'Pay the courier' : 'Pay at the studio'} value={formatINR(cart.dueOnDelivery)} />
          </div>
        )}
      </dl>

      {!fromQuote && cart.couponError && (
        <p className="type-small text-muted">
          Coupon not applied: {cart.couponError}{' '}
          <Link to="/cart" className="link">
            Change it in the cart
          </Link>
        </p>
      )}
      {cart.savings > 0 && <p className="type-small text-muted tnum">{formatINR(cart.savings)} below MRP on these parts.</p>}
    </div>
  );
}
