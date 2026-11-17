import { WhatsAppButton } from '@/components/commerce';
import { useSettings } from '@/hooks/useSettings';
import { askAboutProduct, shareProduct } from '@/lib/whatsapp';
import type { ProductDetail, ProductVariant, Vehicle } from '@/types/api';
import { variantLabel } from './variants';

export interface ShareRowProps {
  product: ProductDetail;
  variant: ProductVariant | null;
  vehicle: Vehicle | null;
}

/**
 * "Ask about this part" (to the shop, with the name, SKU, car and link written in), "Send to a friend"
 * (to anyone), and the phone's own share sheet. The WhatsApp pair disappears when the store has no number.
 */
export function ShareRow({ product, variant, vehicle }: ShareRowProps) {
  const hasWhatsApp = Boolean(useSettings().data?.whatsapp);
  const price = variant?.price ?? product.price;

  // The share sheet now sits under the photo (Save, Compare, Share), so only the WhatsApp pair is here.
  if (!hasWhatsApp) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
          <WhatsAppButton
            block
            className="!rounded-[10px]"
            text={askAboutProduct({
              product: { name: product.name, slug: product.slug, sku: variant?.sku || product.sku },
              variantName: variant ? variantLabel(variant) : undefined,
              vehicle,
            })}
          >
            Ask about this part
          </WhatsAppButton>
          <WhatsAppButton block to="share" variant="ghost" className="!rounded-[10px]" text={shareProduct({ product: { ...product, price }, vehicle })}>
            Send to a friend
          </WhatsAppButton>
    </div>
  );
}
