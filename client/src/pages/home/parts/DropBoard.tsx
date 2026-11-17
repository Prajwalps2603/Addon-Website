import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Roundel } from '@/components/brand';
import { ProductFrame } from '@/components/commerce';
import { Button, Countdown } from '@/components/ui';
import { formatDateTime, formatINR } from '@/lib/format';
import type { Drop } from '@/types/api';
import { refreshAfterDrop } from './dropRefresh';

export interface DropBoardProps {
  drop: Drop;
}

/**
 * The live Friday Five on the home page: a timing tower ranked by the size of each drop,
 * with the owner's reason on every row and the real end time counting down.
 */
export function DropBoard({ drop }: DropBoardProps) {
  const queryClient = useQueryClient();
  const ranked = [...drop.items].sort((a, b) => b.percentOff - a.percentOff);
  const showTitle = drop.title.trim() && drop.title.trim().toLowerCase() !== 'the friday five';

  return (
    <section aria-labelledby="home-drop" className="plane-board">
      <div className="container-page section-y grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="grid content-start gap-5 lg:col-span-4">
          <div className="grid gap-2">
            <h2 id="home-drop" className="type-h1">
              The Friday Five
            </h2>
            {showTitle && <p className="type-h3">{drop.title}</p>}
            {drop.note && <p className="max-w-prose text-muted">{drop.note}</p>}
          </div>
          <Countdown to={drop.endsAt} label="This drop ends in" onEnd={() => refreshAfterDrop(queryClient)} />
          <p className="type-small text-muted">Ends {formatDateTime(drop.endsAt)}. Prices then go back to normal.</p>
          <div>
            <Button to="/friday-five" variant="outline">
              See the five in full
            </Button>
          </div>
        </div>

        <ol aria-label="The Friday Five, largest drop first" className="border-t border-ink lg:col-span-8">
          {ranked.map((item, index) => {
            const { product } = item;
            const was = product.regularPrice > product.price ? product.regularPrice : 0;
            return (
              <li
                key={product.id}
                className="relative grid grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b border-line py-4 transition-colors dur-quick hover:bg-surface sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-4"
              >
                <span className="pt-1 sm:pt-0">
                  <span className="sr-only">Position </span>
                  <Roundel tone={index === 0 ? 'brand' : 'paper'}>{index + 1}</Roundel>
                </span>
                <ProductFrame image={product.image} alt="" artKind={product.artKind} className="size-16 sm:size-20" />
                <span className="grid min-w-0 gap-1">
                  <Link to={`/p/${product.slug}`} className="font-bold leading-snug after:absolute after:inset-0 focus-ring-inset">
                    {product.name}
                  </Link>
                  {item.reason && <span className="type-small line-clamp-3 text-muted">{item.reason}</span>}
                </span>
                <span className="col-start-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:col-start-4 sm:flex-col sm:items-end sm:text-right">
                  <span className="type-price">
                    <span className="sr-only">Now </span>
                    {formatINR(product.price)}
                  </span>
                  {was > 0 && (
                    <s className="type-mrp">
                      <span className="sr-only">Was </span>
                      {formatINR(was)}
                    </s>
                  )}
                  <span className="type-label text-fit tnum">{item.percentOff}% off</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
