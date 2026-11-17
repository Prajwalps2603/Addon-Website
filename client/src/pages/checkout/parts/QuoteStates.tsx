import { CalendarX, FileQuestion, PackageCheck, Undo2 } from 'lucide-react';
import { WhatsAppButton } from '@/components/commerce';
import { PitBoard } from '@/components/brand';
import { Button, Countdown, EmptyState, Skeleton } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { QuoteView } from '@/types/api';

const ART = 'size-14 text-line-strong';

/** A quote link that cannot be ordered from any more: expired, already ordered or withdrawn. */
export function QuoteClosed({ quote }: { quote: Pick<QuoteView, 'status' | 'validUntil' | 'customerName' | 'token'> }) {
  if (quote.status === 'ordered') {
    return (
      <EmptyState
        art={<PackageCheck aria-hidden strokeWidth={1.5} className={ART} />}
        title="This quote has been ordered"
        description="An order was already placed from this quote. Track it with the order number and the mobile number you gave."
        actions={
          <Button to="/track" variant="dark">
            Track your order
          </Button>
        }
      />
    );
  }
  const expired = quote.status === 'expired';
  return (
    <EmptyState
      art={expired ? <CalendarX aria-hidden strokeWidth={1.5} className={ART} /> : <Undo2 aria-hidden strokeWidth={1.5} className={ART} />}
      title={expired ? 'This quote has expired' : 'This quote was withdrawn'}
      description={
        expired
          ? `It was held until ${formatDateTime(quote.validUntil)}. Prices may have moved since, so ask us for a fresh one.`
          : 'The shop withdrew this quote. Message us if you still want these parts and we will price them again.'
      }
      actions={
        <>
          <WhatsAppButton text={`Hello, my quote link (${quote.token.slice(0, 8)}) ${expired ? 'has expired' : 'was withdrawn'}. Could you send a fresh one?`}>
            Ask for a fresh quote
          </WhatsAppButton>
          <Button to="/contact" variant="link">
            Other ways to reach us
          </Button>
        </>
      }
    />
  );
}

/** An open quote with nothing left on it to order. */
export function QuoteEmpty({ quote }: { quote: Pick<QuoteView, 'token'> }) {
  return (
    <EmptyState
      art={<FileQuestion aria-hidden strokeWidth={1.5} className={ART} />}
      title="This quote has no parts to order"
      description="Every part on it has been taken off. Ask us and we will send a fresh quote."
      actions={
        <>
          <WhatsAppButton text={`Hello, my quote link (${quote.token.slice(0, 8)}) has no parts on it. Could you send a fresh one?`}>
            Ask for a fresh quote
          </WhatsAppButton>
          <Button to="/shop" variant="link">
            Browse the shop
          </Button>
        </>
      }
    />
  );
}

export function QuoteNotFound() {
  return (
    <EmptyState
      art={<FileQuestion aria-hidden strokeWidth={1.5} className={ART} />}
      title="We could not find this quote"
      description="The link may be cut short. Open it again from the message we sent, or ask us to send it again."
      actions={
        <>
          <WhatsAppButton text="Hello, my quote link does not open. Could you send it again?">Ask us to resend it</WhatsAppButton>
          <Button to="/shop" variant="link">
            Browse the shop
          </Button>
        </>
      }
    />
  );
}

/** Who the quote is for and how long its prices hold, with a countdown to the real expiry. */
export function QuoteBoard({ quote, onExpire, className }: { quote: Pick<QuoteView, 'customerName' | 'validUntil' | 'note'>; onExpire?: () => void; className?: string }) {
  return (
    <PitBoard title="Your quote" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="grid gap-1">
          <p className="type-h3">{quote.customerName ? `For ${quote.customerName}` : 'Prices held for you'}</p>
          <p className="type-small text-muted">Prices held until {formatDateTime(quote.validUntil)}</p>
        </div>
        <Countdown to={quote.validUntil} label="Held for" endedLabel="Expired" size="sm" onEnd={onExpire} />
      </div>
      {quote.note && <p className="max-w-prose border-t border-line pt-3">{quote.note}</p>}
    </PitBoard>
  );
}

export function QuoteSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the quote">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-3">
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex gap-3">
            <Skeleton className="size-16" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
