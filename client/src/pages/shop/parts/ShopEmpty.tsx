import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { iconForArtKind, WhatsAppButton } from '@/components/commerce';
import { Button, Chip } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { AppliedFilter } from './AppliedFilters';
import type { ShopFilters } from './shopQuery';

export interface ShopEmptyProps {
  /** The search words, '' on a category page. */
  q: string;
  /** What the search was read as, when it differs from the words typed. */
  understoodAs: string | null;
  /** The category being browsed, if any. */
  categoryName: string | null;
  applied: AppliedFilter[];
  onChange: (next: ShopFilters) => void;
  onClearAll: () => void;
  className?: string;
}

/**
 * Nothing matched. Says what was looked for, offers to take off one filter at a time (each with a
 * plain label), lists the busiest categories, and offers to ask the shop on WhatsApp when it has a number.
 */
export function ShopEmpty({ q, understoodAs, categoryName, applied, onChange, onClearAll, className }: ShopEmptyProps) {
  const categories = useCategories().data ?? [];
  const popular = [...categories].sort((a, b) => b.productCount - a.productCount).filter((c) => c.productCount > 0).slice(0, 6);

  const title = q
    ? `Nothing found for "${q}"`
    : applied.length > 0
      ? 'No parts match these filters'
      : `No ${categoryName ? categoryName.toLowerCase() : 'parts'} listed yet`;

  const lookingFor = q || categoryName || 'a part';
  const message = `Hi, I was looking for ${q ? `"${q}"` : lookingFor} on your website and could not find it. Do you have it, or something like it?`;

  return (
    <div role="status" className={cn('grid gap-8 py-10 md:py-14', className)}>
      <div className="grid max-w-prose gap-3">
        <SearchX aria-hidden strokeWidth={1.5} className="size-12 text-line-strong" />
        <h2 className="type-h2">{title}</h2>
        {q && understoodAs && understoodAs.toLowerCase() !== q.toLowerCase() && (
          <p className="text-muted">We also looked for "{understoodAs}".</p>
        )}
        {applied.length > 0 ? (
          <p className="text-muted">
            {applied.length === 1 ? 'One filter is on.' : `${applied.length} filters are on.`} Take one off to widen the list:
          </p>
        ) : q ? (
          <p className="text-muted">Check the spelling, try fewer words, or use the name printed on the box.</p>
        ) : (
          <p className="text-muted">Try another category below, or ask us: we can often get a part in.</p>
        )}
        {applied.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {applied.map((item) => (
              <Chip key={item.key} size="sm" removable onClick={() => onChange(item.without)}>
                <span className="sr-only">Remove filter: </span>
                {item.label}
              </Chip>
            ))}
            {applied.length > 1 && (
              <Button variant="link" onClick={onClearAll} className="[--button-text:0.875rem]">
                Clear all
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <WhatsAppButton text={message}>Ask us on WhatsApp</WhatsAppButton>
          <Button variant="outline" to="/shop">
            Browse all parts
          </Button>
        </div>
      </div>

      {popular.length > 0 && (
        <section aria-labelledby="shop-empty-popular" className="grid gap-3">
          <h3 id="shop-empty-popular" className="type-h3">
            Popular categories
          </h3>
          <ul className="grid grid-cols-1 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((category) => {
              const Icon = iconForArtKind(category.artKind);
              return (
                <li key={category.id} className="border-b border-line">
                  <Link
                    to={`/shop/${category.slug}`}
                    className="focus-ring-inset flex min-h-14 items-center gap-3 px-1 py-2 hover:bg-surface"
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate font-bold">{category.name}</span>
                    <span className="type-small text-muted tnum">{formatNumber(category.productCount)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
