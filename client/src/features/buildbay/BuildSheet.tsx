import { Car, CircleX, OctagonAlert, ShoppingBag, Trash2, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { AddToCartButton, ProductFrame } from '@/components/commerce';
import { Button, IconButton } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import { useUi } from '@/stores/ui';
import type { BuildSlot } from '@/types/api';
import { addBuildToCart, splitForCart } from './cart';
import type { BuildSheet as Sheet, SheetWarningKind } from './sheet';
import { StudioFitOffer } from './studio';
import type { ProductsBySlot } from './useBuildProducts';

export const PREVIEW_LINE = 'Style preview on a generic car. Fitment is confirmed on each product page.';

const WARNING_LOOK: Record<SheetWarningKind, { Icon: LucideIcon; tone: string }> = {
  no_fit: { Icon: CircleX, tone: 'text-stop' },
  off_road: { Icon: OctagonAlert, tone: 'text-stop' },
  sold_out: { Icon: CircleX, tone: 'text-stop' },
  with_work: { Icon: Wrench, tone: 'text-warn' },
};

export interface BuildSheetProps {
  sheet: Sheet;
  bySlot: ProductsBySlot;
  catalogueLoading: boolean;
  /** Takes a part off the car. Left out on a read-only sheet. */
  onRemove?: (slot: BuildSlot) => void;
  /** Opens a slot's controls, from an entry that has no product yet. */
  onOpenSlot?: (slot: BuildSlot) => void;
  /** Hide the heading when the container (a drawer) already names it. */
  showHeading?: boolean;
  /** Hide the total and the whole-build button when a pinned footer shows them. */
  showTotal?: boolean;
  className?: string;
}

/** The whole-build button and the parts that need a choice on their own page. */
export function AddWholeBuild({ sheet, size = 'lg' }: { sheet: Sheet; size?: 'md' | 'lg' }) {
  const { needChoice } = splitForCart(sheet.products);
  if (sheet.products.length === 0) return null;
  return (
    <div className="grid gap-2">
      <Button size={size} block iconLeft={<ShoppingBag aria-hidden />} onClick={() => addBuildToCart(sheet.products)}>
        Add the whole build to cart
      </Button>
      {needChoice.length > 0 && (
        <p className="type-small text-muted">
          Choose a size or colour first for{' '}
          {needChoice.map((product, index) => (
            <span key={product.id}>
              {index > 0 && (index === needChoice.length - 1 ? ' and ' : ', ')}
              <Link to={`/p/${product.slug}`} className="link font-bold text-ink">
                {product.name}
              </Link>
            </span>
          ))}
          . {needChoice.length === 1 ? 'It is' : 'They are'} not added with the rest.
        </p>
      )}
    </div>
  );
}

/** The build sheet: each part with its product and price, the warnings that matter, the total and the way to the cart. */
export function BuildSheet({ sheet, bySlot, catalogueLoading, onRemove, onOpenSlot, showHeading = true, showTotal = true, className }: BuildSheetProps) {
  const vehicle = useActiveVehicle();
  const openVehiclePicker = useUi((s) => s.openVehiclePicker);
  const { entries, warnings, total, products } = sheet;
  const styleOnly = entries.filter((entry) => !entry.product).length;

  return (
    <section aria-labelledby={showHeading ? 'build-sheet-heading' : undefined} className={cn('grid gap-4', className)}>
      {showHeading && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="build-sheet-heading" className="type-h2">
            Build sheet
          </h2>
          <span className="type-small text-muted tnum">{entries.length ? pluralize(entries.length, 'part') : 'Stock car'}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="grid gap-2 border-y border-line py-5">
          <p className="font-bold">Nothing fitted yet</p>
          <p className="type-small text-muted">Pick a slot and try a style. Every part you add lands here with its real price.</p>
        </div>
      ) : (
        <ul className="border-t border-ink">
          {entries.map((entry) => {
            const product = entry.product;
            const catalogueHas = (bySlot[entry.slot] ?? []).some((p) => p.buildStyle === entry.style);
            return (
              <li key={entry.slot} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-line py-3">
                {product ? (
                  <ProductFrame image={product.image} alt="" artKind={product.artKind} variant="thumb" sizes="56px" />
                ) : (
                  <span aria-hidden className="grid aspect-square place-items-center bg-surface type-label text-muted">
                    {entry.colour ? <span className="size-6 rounded-full border border-line-strong" style={{ backgroundColor: entry.colour }} /> : 'Style'}
                  </span>
                )}
                <div className="grid min-w-0 gap-0.5">
                  <p className="type-label text-muted">
                    {entry.slotLabel}
                    <span className="sr-only">:</span>
                  </p>
                  {product ? (
                    <>
                      <Link to={`/p/${product.slug}`} className="link line-clamp-2 font-bold leading-snug">
                        {product.name}
                      </Link>
                      <p className="type-small text-muted">{entry.styleLabel}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold leading-snug">{entry.styleLabel}</p>
                      <p className="type-small text-muted">
                        {entry.productMissing
                          ? catalogueLoading
                            ? 'Loading the part'
                            : 'That part is no longer in the catalogue.'
                          : catalogueHas
                            ? 'Style only. '
                            : 'Style only. No matching part in the catalogue yet.'}
                        {!entry.productMissing && catalogueHas && onOpenSlot && (
                          <button type="button" className="link font-bold text-ink" onClick={() => onOpenSlot(entry.slot)}>
                            Pick a part
                          </button>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="grid justify-items-end gap-1.5">
                  <span className={cn('tnum', product ? 'type-price' : 'type-small text-muted')}>{product ? formatINR(product.price) : 'Not priced'}</span>
                  <div className="flex items-center gap-1">
                    {product &&
                      (product.hasVariants || product.customKind ? (
                        <Button size="sm" variant="link" to={`/p/${product.slug}`} className="[--button-text:0.8125rem]">
                          Choose size
                        </Button>
                      ) : product.inStock ? (
                        <AddToCartButton variant="icon" size="sm" productId={product.id} productName={product.name} openCart={false} />
                      ) : null)}
                    {onRemove && (
                      <IconButton size="sm" label={`Remove ${entry.slotLabel.toLowerCase()}`} onClick={() => onRemove(entry.slot)}>
                        <Trash2 aria-hidden />
                      </IconButton>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(warnings.length > 0 || (!vehicle && products.length > 0)) && (
        <div className="grid gap-2" aria-live="polite">
          <h3 className="type-label text-muted">Check before you buy</h3>
          <ul className="grid gap-2">
            {warnings.map((warning) => {
              const { Icon, tone } = WARNING_LOOK[warning.kind];
              return (
                <li key={`${warning.slot}-${warning.kind}`} className="flex items-start gap-2">
                  <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', tone)} />
                  <p className="type-small">
                    <span className="font-bold">{warning.product.name}.</span> <span className={cn('font-bold', tone)}>{warning.message}</span>
                  </p>
                </li>
              );
            })}
            {!vehicle && products.length > 0 && (
              <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Car aria-hidden className="size-4 shrink-0" />
                <p className="type-small">Fit is not checked: no car is chosen.</p>
                <Button size="sm" variant="link" onClick={openVehiclePicker} aria-haspopup="dialog" className="[--button-text:0.8125rem]">
                  Select your car
                </Button>
              </li>
            )}
          </ul>
        </div>
      )}

      {showTotal && (
        <div className="grid gap-3 border-t border-ink pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-bold">Build total</span>
            <span className="type-price-xl tnum">{formatINR(total)}</span>
          </div>
          <p className="type-small text-muted">
            {products.length ? `${pluralize(products.length, 'catalogue part')}, prices include GST.` : 'No catalogue parts on the build yet.'}
            {styleOnly > 0 && ` ${pluralize(styleOnly, 'style-only part')} not priced.`}
          </p>
          <AddWholeBuild sheet={sheet} />
        </div>
      )}

      {products.length > 0 && (
        <StudioFitOffer
          parts={products.map((product) => ({ productId: product.id, categorySlug: product.categorySlug }))}
          onAddForFitting={() => addBuildToCart(products, { fitAtStudio: true })}
          addLabel="Add the build for fitting"
        />
      )}

      <p className="type-small text-muted">{PREVIEW_LINE}</p>
    </section>
  );
}
