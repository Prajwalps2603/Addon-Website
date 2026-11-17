import { WhatsAppButton } from '@/components/commerce';
import { CopyButton } from '@/components/ui';
import { cartShareUrl } from '@/lib/cartLink';
import { shareCart } from '@/lib/whatsapp';
import { useCart } from '@/stores/cart';
import type { PricedCart } from '@/types/api';

/**
 * "Send cart to payer": for when the person choosing the parts is not the one paying.
 * The link carries only the parts and the coupon; the other phone prices it fresh.
 */
export function SendToPayer({ cart, onCopied }: { cart: PricedCart | undefined; onCopied?: () => void }) {
  const lines = useCart((state) => state.lines);
  const couponCode = useCart((state) => state.couponCode);
  if (lines.length === 0) return null;
  const url = cartShareUrl(lines, { couponCode: cart?.coupon?.code ?? couponCode });

  return (
    <section aria-labelledby="send-to-payer" className="grid gap-3 border-t border-line pt-6">
      <div className="grid gap-1">
        <h2 id="send-to-payer" className="type-h3">
          Someone else paying?
        </h2>
        <p className="max-w-prose text-muted">
          Send them this cart. The link opens the same parts on their phone, priced fresh, ready for them to pay.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <WhatsAppButton to="share" text={shareCart({ lines, cart, couponCode: cart?.coupon?.code ?? couponCode })}>
          Send on WhatsApp
        </WhatsAppButton>
        <CopyButton value={url} label="Copy cart link" copiedLabel="Link copied" size="md" onCopied={onCopied} />
      </div>
    </section>
  );
}
