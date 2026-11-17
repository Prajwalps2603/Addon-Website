import { lazy, Suspense, useState, type ReactNode, type Ref } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { AddToCartButton, QtyStepper, StockNote } from '@/components/commerce';
import { Button, toast } from '@/components/ui';
import { MAX_LINE_QTY, cartLineKey, useCart } from '@/stores/cart';
import type { ProductDetail, ProductVariant, StudioService } from '@/types/api';
import { StudioChoice } from './StudioChoice';
import { setLineFitAtStudio, type FitChoice } from './studio';
import { VariantPicker } from './VariantPicker';
import { attributeKeys, variantLabel } from './variants';

// Only shown when the part is out of stock; it brings the form libraries, so it loads on demand.
const StockAlertForm = lazy(() => import('./StockAlertForm').then((m) => ({ default: m.StockAlertForm })));

export interface BuyBoxProps {
  product: ProductDetail;
  variant: ProductVariant | null;
  onVariant: (variant: ProductVariant) => void;
  qty: number;
  onQty: (qty: number) => void;
  /** Put on the row with the main button, so the page knows when it has scrolled away. */
  mainRef?: Ref<HTMLDivElement>;
  /** The studio service that can fit this part, or null when the studio does not fit it. */
  service?: StudioService | null;
  fitChoice?: FitChoice;
  onFitChoice?: (choice: FitChoice) => void;
  /** The car model when the part is known not to fit it. */
  doesNotFit?: string | null;
}

/** Why the part cannot be added yet, or null. */
export function blockedReason(product: ProductDetail, variant: ProductVariant | null): string | null {
  if (!product.hasVariants || variant) return null;
  const key = attributeKeys(product.variants)[0];
  return key ? `Choose a ${key.toLowerCase()} first` : 'Choose an option first';
}

/**
 * Variant pills, quantity, Add to cart and Buy now, with save and compare beside them.
 * A show plate is designed before it is bought, so it gets one button to the designer instead.
 * A sold-out part (or a sold-out choice) gets the back-in-stock form instead.
 */
export function BuyBox({
  product,
  variant,
  onVariant,
  qty,
  onQty,
  mainRef,
  service = null,
  fitChoice = 'self',
  onFitChoice,
  doesNotFit = null,
}: BuyBoxProps) {
  const navigate = useNavigate();
  const atStudio = Boolean(service) && fitChoice === 'studio' && !doesNotFit;
  const [pickError, setPickError] = useState<string | null>(null);

  const blocked = blockedReason(product, variant);
  const stock = variant ? variant.stock : product.stock;
  const inStock = variant ? variant.inStock : product.inStock;
  const maxQty = Math.max(1, Math.min(MAX_LINE_QTY, stock));

  const select = (next: ProductVariant) => {
    setPickError(null);
    onVariant(next);
  };

  const buyNow = () => {
    if (blocked) {
      setPickError(blocked);
      toast.error(blocked, { id: 'add-to-cart' });
      return;
    }
    // Buy now means this many of this item: an identical line already in the cart is set to it, not added to.
    const cart = useCart.getState();
    const key = cartLineKey({ productId: product.id, variantId: variant?.id ?? null });
    if (cart.lines.some((line) => cartLineKey(line) === key)) cart.setQty(key, qty);
    else cart.add({ productId: product.id, variantId: variant?.id ?? null, qty });
    if (service) setLineFitAtStudio(key, atStudio);
    navigate('/checkout');
  };


  if (product.customKind === 'show-plate') {
    return (
      <div className="grid gap-4">
        <div ref={mainRef}>
          <Button size="lg" block disabled>
            Not available to order
          </Button>
        </div>
        <p className="type-small text-muted">Made-to-order show plates are no longer taken online. Ask the studio on WhatsApp.</p>
      </div>
    );
  }

  const hasPicker = product.hasVariants && product.variants.length > 0;
  const hasFitting = Boolean(service && onFitChoice);

  return (
    <div className="grid gap-6">
      {hasPicker && <VariantPicker variants={product.variants} selected={variant} onSelect={select} error={pickError} />}

      {product.inStock && inStock ? (
        <>
          {hasFitting && service && onFitChoice && (
            <Block title="Delivery or fitting">
              <StudioChoice service={service} value={fitChoice} onChange={onFitChoice} doesNotFit={doesNotFit} />
            </Block>
          )}

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold text-muted">Quantity</span>
              <QtyStepper
                value={Math.min(qty, maxQty)}
                onChange={onQty}
                max={maxQty}
                label={`Quantity of ${product.name}`}
                className="!items-center gap-1 !rounded-full border-2 !border-line p-1 [&>button]:!size-9 [&>button]:rounded-full [&>button]:bg-surface [&>button:hover]:bg-surface-2 [&>input]:!w-10 [&>input]:!border-0"
              />
              <StockNote variant="full" stock={stock} inStock={inStock} lowStock={variant ? undefined : product.lowStock} />
            </div>
            <div ref={mainRef} className="grid grid-cols-2 gap-3" onClickCapture={() => blocked && setPickError(blocked)}>
              <AddToCartButton
                productId={product.id}
                variantId={variant?.id ?? null}
                qty={Math.min(qty, maxQty)}
                productName={product.name}
                blocked={blocked}
                size="lg"
                block
                className="min-w-0 !rounded-[10px] !bg-ink !text-page hover:!bg-ink-2"
                onAdded={service ? (key) => setLineFitAtStudio(key, atStudio) : undefined}
              >
                {atStudio ? 'Add with fitting' : 'Add to cart'}
              </AddToCartButton>
              <Button size="lg" block onClick={buyNow} iconRight={<ArrowRight aria-hidden />} className="min-w-0 !rounded-[10px]">
                Buy now
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div ref={mainRef} className="grid gap-3">
          <Suspense fallback={<div aria-hidden className="min-h-24" />}>
            <StockAlertForm
              productId={product.id}
              variantId={variant && !variant.inStock ? variant.id : null}
              what={variant && !variant.inStock && product.inStock ? variantLabel(variant) : 'this part'}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

/** A plain labelled block of the buy area, like the option rows on big marketplaces. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}
