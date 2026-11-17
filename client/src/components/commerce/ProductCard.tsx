import { ArrowRight, Bell } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ProductSummary, Vehicle } from '@/types/api';
import { AddToCartButton } from './AddToCartButton';
import { CompareButton } from './CompareButton';
import { DropBadge } from './DropBadge';
import { FitBadge } from './FitBadge';
import { Price } from './Price';
import { ProductFrame } from './ProductFrame';
import { WishlistButton } from './WishlistButton';

export interface ProductCardProps {
  product: ProductSummary;
  /** Load the photo at once: the first row of the first grid on a page. */
  eager?: boolean;
  /** The car the fit verdict was worked out for, when it is not the active garage car (a /cars page). */
  vehicle?: (Pick<Vehicle, 'model'> & Partial<Pick<Vehicle, 'label' | 'bodyType'>>) | null;
  /** Adds the compare toggle at the foot of the card. */
  compare?: boolean;
  /** Kept for callers that pass it; the card itself no longer shows report numbers. */
  fittedOkPercent?: number | null;
  className?: string;
}

/**
 * A product as it appears in every grid and rail. Deliberately quiet: photo, house line, name,
 * price, the one fit line for the shopper's car, and one action. The Straight Label, reports and
 * stock detail live on the product page.
 */
export function ProductCard({ product, eager = false, vehicle, compare = false, className }: ProductCardProps) {
  const href = `/p/${product.slug}`;
  const needsChoice = product.hasVariants || product.customKind !== null;

  return (
    <article
      className={cn(
        'group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-surface',
        'transform-gpu transition-[border-color,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-line-strong motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        'has-[h3>a:focus-visible]:outline-2 has-[h3>a:focus-visible]:outline-offset-2 has-[h3>a:focus-visible]:outline-focus',
        className,
      )}
    >
      <ProductFrame
        image={product.image}
        alt={product.name}
        artKind={product.artKind}
        eager={eager}
        muted={!product.inStock}
        className="[&>img]:transform-gpu [&>img]:transition-transform [&>img]:duration-700 [&>img]:ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:[&>img]:scale-[1.04] motion-reduce:[&>img]:transition-none"
      >
        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1">
          {!product.inStock ? (
            <Badge tone="ink" variant="solid">
              Sold out
            </Badge>
          ) : product.drop ? (
            <DropBadge drop={product.drop} />
          ) : product.isNew ? (
            <Badge tone="ink" variant="solid">
              New
            </Badge>
          ) : null}
        </div>
        <div className="absolute top-2 right-2 z-raised">
          <WishlistButton productId={product.id} productName={product.name} size="sm" onPhoto />
        </div>
      </ProductFrame>

      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-3.5">
        <p className="text-[0.6875rem] font-bold tracking-wide text-muted uppercase">{product.brand}</p>
        <h3 className="line-clamp-2 min-h-[2.6em] text-[0.9375rem] leading-[1.3] font-semibold">
          <Link to={href} className="outline-hidden after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        <div className="mt-1 min-h-5">
          <FitBadge product={product} vehicle={vehicle} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price price={product.price} mrp={product.mrp} regularPrice={product.regularPrice} drop={product.drop} from={product.hasVariants} />
          <div className="relative z-raised shrink-0">
            {!product.inStock ? (
              <Link
                to={href}
                aria-label={`Notify me when ${product.name} is back`}
                className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:border-ink"
              >
                <Bell aria-hidden className="size-4" />
              </Link>
            ) : needsChoice ? (
              <Link
                to={href}
                aria-label={product.customKind ? `Design ${product.name}` : `Choose options for ${product.name}`}
                className="grid size-10 place-items-center rounded-full border border-line-strong text-ink transition-colors hover:border-ink hover:bg-ink hover:text-page"
              >
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <AddToCartButton variant="icon" size="sm" productId={product.id} productName={product.name} />
            )}
          </div>
        </div>
        {compare && <CompareButton variant="text" productId={product.id} productName={product.name} className="z-raised self-start pt-1" />}
      </div>
    </article>
  );
}
