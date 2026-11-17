import { useEffect, useState } from 'react';
import { BadgeCheck, CircleCheck, CircleHelp, CircleX, Wrench } from 'lucide-react';
import { AddToCartButton, describeFit } from '@/components/commerce';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { ProductDetail, ProductVariant, Vehicle } from '@/types/api';
import { setLineFitAtStudio } from './studio';

export interface StickyBuyBarProps {
  product: ProductDetail;
  variant: ProductVariant | null;
  vehicle: Vehicle | null;
  qty: number;
  blocked: string | null;
  /** The main buy row. The bar shows once it has scrolled up out of view. */
  target: HTMLElement | null;
  /** True when the shopper chose to have it fitted at the studio: the bar adds it the same way. */
  atStudio?: boolean;
  /** Only when the part has a studio service: record the choice on the cart line. */
  hasService?: boolean;
}

const FIT_ICON = {
  direct: { Icon: CircleCheck, text: 'text-fit' },
  with_work: { Icon: Wrench, text: 'text-warn' },
  universal: { Icon: CircleCheck, text: 'text-fit' },
  no: { Icon: CircleX, text: 'text-stop' },
  unknown: { Icon: CircleHelp, text: 'text-info' },
} as const;

function useScrolledPast(target: HTMLElement | null): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [target]);
  return past;
}

/**
 * The phone's buy bar: price, the fit verdict as an icon, and Add to cart, fixed above the bottom
 * navigation once the main button has scrolled away. Hidden from 768 px, where the buy box stays near.
 */
export function StickyBuyBar({ product, variant, vehicle, qty, blocked, target, atStudio = false, hasService = false }: StickyBuyBarProps) {
  const shown = useScrolledPast(target);
  const fit = describeFit(product, vehicle);
  const fitIcon = fit && fit.state !== 'select' ? FIT_ICON[fit.state] : null;
  const FitIcon = fit?.verified ? BadgeCheck : fitIcon?.Icon;
  const price = variant?.price ?? product.price;
  const inStock = variant ? variant.inStock : product.inStock;

  const backToMain = () => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    target?.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true });
  };

  let action;
  if (product.customKind === 'show-plate') {
    action = (
      <Button size="md" disabled>
        Not available
      </Button>
    );
  } else if (!product.inStock || !inStock) {
    action = (
      <Button variant="dark" size="md" onClick={backToMain}>
        Tell me when back
      </Button>
    );
  } else if (blocked) {
    action = (
      <Button size="md" onClick={backToMain}>
        {blocked.replace(/ first$/, '')}
      </Button>
    );
  } else {
    action = (
      <AddToCartButton
        productId={product.id}
        variantId={variant?.id ?? null}
        qty={qty}
        productName={product.name}
        size="md"
        onAdded={hasService ? (key) => setLineFitAtStudio(key, atStudio) : undefined}
      >
        {atStudio ? 'Add with fitting' : 'Add to cart'}
      </AddToCartButton>
    );
  }

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={cn(
        'fixed inset-x-0 bottom-[var(--bottom-bar-h)] z-sticky border-t border-ink bg-page pb-safe dur-settle ease-settle transition-[transform,opacity] md:hidden',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
    >
      <div className="container-page flex items-center gap-3 py-2">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <p className="truncate type-small font-bold">{product.name}</p>
          <p className="flex items-center gap-1.5">
            <span className="type-price whitespace-nowrap">{formatINR(price)}</span>
            {fitIcon && FitIcon && fit && (
              <span className={cn('inline-flex items-center', fitIcon.text)} title={fit.headline}>
                <FitIcon aria-hidden className="size-4" />
                <span className="sr-only">{fit.headline}</span>
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  );
}
