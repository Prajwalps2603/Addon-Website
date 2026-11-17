import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { OctagonAlert } from 'lucide-react';
import { CustomSummary, ErrorState, PageHeader, ProductFrame } from '@/components/commerce';
import { Badge, Button, Callout } from '@/components/ui';
import { useProductsByIds } from '@/hooks/useProducts';
import { api } from '@/lib/api';
import { formatDateTime, formatINR, pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { PricedLine, ProductSummary, QuoteView } from '@/types/api';
import { QuoteBoard, QuoteClosed, QuoteNotFound, QuoteSkeleton } from './parts/QuoteStates';

/** What the same line would cost at today's shop price, when that can be known (no variant). */
function regularUnitPrice(line: PricedLine, products: Map<number, ProductSummary>): number | null {
  if (line.variantId !== null) return null;
  const product = products.get(line.productId);
  return product ? product.price : null;
}

function QuoteLine({ line, regular }: { line: PricedLine; regular: number | null }) {
  const compare = regular !== null && regular > line.unitPrice ? { label: 'Shop price', value: regular } : line.unitMrp > line.unitPrice ? { label: 'MRP', value: line.unitMrp } : null;
  const lineSaving = compare ? (compare.value - line.unitPrice) * line.qty : 0;
  const problem =
    line.issue === 'out_of_stock' ? 'Sold out since this quote' : line.issue === 'unavailable' ? 'No longer sold' : line.issue === 'insufficient_stock' ? `Only ${line.maxQty} left` : null;

  return (
    <li className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-2 py-4 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
      <Link to={`/p/${line.slug}`} tabIndex={-1} aria-hidden className="row-span-2 sm:row-span-1">
        <ProductFrame image={line.image} alt="" artKind={line.artKind} />
      </Link>
      <div className="grid min-w-0 content-start gap-1">
        <Link to={`/p/${line.slug}`} className="leading-snug font-bold hover:underline">
          {line.name}
        </Link>
        {line.variantName && <span className="type-small text-muted">{line.variantName}</span>}
        <span className="type-small text-muted tnum">Qty {line.qty}</span>
        {line.custom && <CustomSummary custom={line.custom} heading={false} />}
        {problem && (
          <Badge tone="stop" size="sm" icon={<OctagonAlert aria-hidden />} className="justify-self-start">
            {problem}
          </Badge>
        )}
      </div>
      <div className="grid content-start gap-0.5 sm:justify-items-end sm:text-right">
        <span className="type-price tnum">{formatINR(line.lineTotal)}</span>
        <span className="type-small tnum">
          {formatINR(line.unitPrice)} each
          {compare && (
            <>
              {' '}
              <span className="text-muted">
                {compare.label} <s>{formatINR(compare.value)}</s>
              </span>
            </>
          )}
        </span>
        {lineSaving > 0 && <span className="type-small font-bold text-fit tnum">{formatINR(lineSaving)} less</span>}
      </div>
    </li>
  );
}

function OpenQuote({ quote, onExpire }: { quote: QuoteView; onExpire: () => void }) {
  const { cart } = quote;
  const ids = useMemo(() => [...new Set(cart.lines.map((line) => line.productId))], [cart.lines]);
  const products = useProductsByIds(ids, { withVehicle: false });
  const byId = useMemo(() => new Map((products.data ?? []).map((product) => [product.id, product])), [products.data]);
  const methods = cart.paymentOptions.filter((option) => option.available);
  const checkoutHref = `/checkout?quote=${encodeURIComponent(quote.token)}`;

  if (cart.lines.length === 0) {
    return (
      <Callout tone="warn" title="This quote has no parts left to order">
        The parts on it are no longer sold. Message us and we will price an alternative.
      </Callout>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start xl:gap-16">
      <div className="grid min-w-0 gap-8">
        <QuoteBoard quote={quote} onExpire={onExpire} />
        <section aria-labelledby="quote-lines" className="grid gap-2">
          <h2 id="quote-lines" className="type-h2">
            What is quoted
          </h2>
          <ul className="divide-y divide-line border-y border-line">
            {cart.lines.map((line) => (
              <QuoteLine key={line.key} line={line} regular={regularUnitPrice(line, byId)} />
            ))}
          </ul>
          {cart.messages.length > 0 && (
            <Callout tone="info">
              <ul className="grid gap-1">
                {cart.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Callout>
          )}
        </section>
      </div>

      <aside aria-label="Quote total" className="grid gap-5 lg:sticky lg:top-24">
        <dl className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">{pluralize(cart.itemCount, 'item')}</dt>
            <dd className="tnum">{formatINR(cart.subtotal)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">Delivery</dt>
            <dd className="tnum">{cart.shippingFee === 0 ? 'Free' : formatINR(cart.shippingFee)}</dd>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-ink pt-3">
            <dt className="font-bold">Total</dt>
            <dd className="type-price-xl tnum">{formatINR(cart.total)}</dd>
          </div>
          <p className="type-small text-right text-muted tnum">Includes GST of {formatINR(cart.tax.gst, { paise: true })}</p>
        </dl>
        {cart.canCheckout ? (
          <Button to={checkoutHref} size="lg" block>
            Accept and check out
          </Button>
        ) : (
          <Callout tone="danger" title="This quote cannot be ordered as it stands">
            Something on it has changed since we sent it. Message us and we will update it.
          </Callout>
        )}
        <div className="type-small grid gap-1 text-muted">
          <p>The quoted prices hold until {formatDateTime(quote.validUntil)}. Coupons do not apply on top.</p>
          {methods.length > 0 && <p>Pay at the next step: {methods.map((option) => option.label).join(', ')}.</p>}
          <p>Delivery and any cash-on-delivery fee are worked out for your PIN code at checkout.</p>
        </div>
      </aside>
    </div>
  );
}

export default function QuotePage() {
  const { token = '' } = useParams();
  const query = useQuery({
    queryKey: queryKeys.quote(token),
    queryFn: ({ signal }) => api.quotes.get(token, { signal }),
    enabled: token !== '',
  });
  const quote = query.data;

  useDocumentMeta({
    title: quote?.customerName ? `Quote for ${quote.customerName}` : 'Your quote',
    noindex: true,
  });

  let body;
  if (!token) body = <QuoteNotFound />;
  else if (query.isPending) body = <QuoteSkeleton />;
  else if (query.error) body = query.error.isNotFound ? <QuoteNotFound /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  else if (!quote) body = <QuoteNotFound />;
  else if (quote.status !== 'open') body = <QuoteClosed quote={quote} />;
  else body = <OpenQuote quote={quote} onExpire={() => void query.refetch()} />;

  return (
    <div className="container-page pb-16">
      <PageHeader title="Your quote" description={quote?.status === 'open' ? 'Prices set for you by the shop. Accept them and order in one step.' : undefined} />
      {body}
    </div>
  );
}
