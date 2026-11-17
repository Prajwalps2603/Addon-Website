import { useId } from 'react';
import { ArrowRight, CircleX } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui';
import { FitBadge, Price, ProductFrame } from '@/components/commerce';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { CategoryPick } from '@/types/api';

const TIERS: Record<CategoryPick['tier'], { name: string; order: number; dark: boolean }> = {
  sensible: { name: 'Sensible', order: 0, dark: false },
  sweet_spot: { name: 'Sweet Spot', order: 1, dark: false },
  all_out: { name: 'All-Out', order: 2, dark: true },
};

export interface PickOfThreeProps {
  picks: CategoryPick[];
  /** The subcategory, for the heading line. */
  categoryName: string;
  className?: string;
}

/**
 * Pick of Three: the shop's three answers for a subcategory as three rounded cards, each with its
 * one-line reason. The spend climbs left to right; the top tier sits on the black board.
 */
export function PickOfThree({ picks, categoryName, className }: PickOfThreeProps) {
  const headingId = useId();
  const sorted = [...picks].sort((a, b) => TIERS[a.tier].order - TIERS[b.tier].order);
  if (sorted.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={cn('grid gap-4', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={headingId} className="type-h3 italic uppercase">
          Pick of three
        </h2>
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">Chosen by the shop</span>
        <span aria-hidden className="hidden h-px flex-1 bg-line sm:block" />
        <p className="w-full text-sm text-muted sm:w-auto">If you only look at three {categoryName.toLowerCase()}, look at these.</p>
      </div>

      <ol className={cn('grid gap-3', sorted.length === 3 && 'md:grid-cols-3', sorted.length === 2 && 'md:grid-cols-2')}>
        {sorted.map((pick, index) => {
          const tier = TIERS[pick.tier];
          const previous = index > 0 ? sorted[index - 1] : null;
          const step = previous ? pick.product.price - previous.product.price : 0;
          const { product } = pick;
          return (
            <li
              key={pick.tier}
              className={cn(
                'group relative flex min-w-0 flex-col gap-4 rounded-[22px] p-3 transition-colors duration-200',
                'has-[a[data-pick]:focus-visible]:outline-2 has-[a[data-pick]:focus-visible]:outline-offset-2 has-[a[data-pick]:focus-visible]:outline-focus',
                tier.dark ? 'bg-ink text-page' : 'bg-surface hover:bg-surface-2',
              )}
            >
              <div className="grid gap-2 px-2 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-7 place-items-center rounded-full text-xs font-black',
                        tier.dark ? 'bg-brand text-brand-ink' : 'bg-raised text-ink',
                      )}
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-lg font-black italic uppercase">{tier.name}</h3>
                  </span>
                  {step > 0 && previous && (
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tnum', tier.dark ? 'bg-page/10 text-page/80' : 'bg-raised text-muted')}>
                      +{formatINR(step)}
                      <span className="sr-only"> more than {TIERS[previous.tier].name}</span>
                    </span>
                  )}
                </div>
                <p className={cn('text-sm leading-relaxed md:min-h-[3.4em]', tier.dark ? 'text-page/75' : 'text-muted')}>{pick.reason}</p>
              </div>

              <div className="mt-auto flex items-center gap-3 rounded-[16px] bg-raised p-2.5 text-ink">
                <ProductFrame
                  image={product.image}
                  alt={product.name}
                  artKind={product.artKind}
                  muted={!product.inStock}
                  className="w-20 shrink-0 overflow-hidden rounded-[12px]"
                />
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-muted uppercase">{product.brand}</p>
                  <p className="line-clamp-2 text-sm leading-snug font-bold">
                    <Link to={`/p/${product.slug}`} data-pick className="outline-hidden after:absolute after:inset-0">
                      {product.name}
                    </Link>
                  </p>
                  <Price price={product.price} mrp={product.mrp} regularPrice={product.regularPrice} drop={product.drop} from={product.hasVariants} />
                  {!product.inStock && (
                    <Badge tone="stop" variant="outline" icon={<CircleX aria-hidden />} className="justify-self-start">
                      Sold out
                    </Badge>
                  )}
                  <FitBadge product={product} />
                </div>
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-surface transition-[translate,background-color,color] duration-200 group-hover:translate-x-0.5 group-hover:bg-brand group-hover:text-brand-ink"
                >
                  <ArrowRight className="size-4" />
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
