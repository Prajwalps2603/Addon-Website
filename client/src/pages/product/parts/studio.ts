import { cartLineKey, useCart } from '@/stores/cart';
import type { EmiSettings, ProductDetail, PublicSettings, StudioService } from '@/types/api';

/** How the shopper wants the part: fitted at the studio, or sent to them to fit elsewhere. */
export type FitChoice = 'self' | 'studio';

/** EMI is shown as a monthly figure over this many months. Indicative only: the partner sets the plan. */
export const EMI_MONTHS = 9;

/**
 * The studio service that fits this part, or null. A part can be fitted when its subcategory is in a
 * service's subcategorySlugs; the free consultation never applies to a part, and nothing applies
 * while studio bookings are paused or for a show plate (designed, then sent).
 */
export function fittingServiceFor(product: ProductDetail, settings: PublicSettings | undefined): StudioService | null {
  if (!settings?.studio.enabled || product.customKind === 'show-plate') return null;
  return (
    settings.services.find((service) => service.id !== 'consult' && service.subcategorySlugs.includes(product.categorySlug)) ?? null
  );
}

/** The indicative monthly EMI for a price, or null when EMI is off or the price is below the minimum. */
export function emiMonthly(price: number, emi: EmiSettings | undefined): number | null {
  if (!emi?.enabled || !emi.partner || price <= 0 || price < emi.minAmount) return null;
  return Math.ceil(price / EMI_MONTHS);
}

/**
 * Sets fitAtStudio on a cart line just added. The cart store's `add` does not take the flag yet,
 * so it is written onto the line straight after; the line key is unchanged by it.
 */
export function setLineFitAtStudio(key: string, fitAtStudio: boolean) {
  useCart.setState((state) => ({
    lines: state.lines.map((line) => {
      if (cartLineKey(line) !== key) return line;
      const next = { ...line };
      if (fitAtStudio) next.fitAtStudio = true;
      else delete next.fitAtStudio;
      return next;
    }),
  }));
}
