import { Button, Chip } from '@/components/ui';
import { LEGALITY_WORDS } from '@/components/commerce';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { Vehicle } from '@/types/api';
import { difficultyLabel } from './FilterPanel';
import { EMPTY_FILTERS, tagLabel, type ShopFilters } from './shopQuery';

export interface AppliedFilter {
  key: string;
  label: string;
  /** The filters with this one taken off. */
  without: ShopFilters;
}

/** Each filter that is on, in words, with what the list looks like without it. */
export function appliedFilters(
  filters: ShopFilters,
  options: { vehicle: Pick<Vehicle, 'model'> | null; categoryName?: (slug: string) => string | null },
): AppliedFilter[] {
  const list: AppliedFilter[] = [];
  const add = (key: string, label: string, patch: Partial<ShopFilters>) => list.push({ key, label, without: { ...filters, ...patch } });

  if (filters.fitOnly && options.vehicle) add('fitOnly', `Fits my ${options.vehicle.model}`, { fitOnly: false });
  if (filters.category) add('category', options.categoryName?.(filters.category) ?? filters.category, { category: null });
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const label =
      filters.minPrice !== null && filters.maxPrice !== null
        ? `${formatINR(filters.minPrice)} to ${formatINR(filters.maxPrice)}`
        : filters.minPrice !== null
          ? `From ${formatINR(filters.minPrice)}`
          : `Up to ${formatINR(filters.maxPrice)}`;
    add('price', label, { minPrice: null, maxPrice: null });
  }
  if (filters.inStock) add('inStock', 'In stock', { inStock: false });
  if (filters.onSale) add('onSale', 'On sale', { onSale: false });
  if (filters.inDrop) add('inDrop', 'In the Friday Five', { inDrop: false });
  if (filters.isNew) add('isNew', 'New in', { isNew: false });
  if (filters.featured) add('featured', 'Featured', { featured: false });
  if (filters.legality) add('legality', LEGALITY_WORDS[filters.legality].chip, { legality: null });
  if (filters.maxDifficulty !== null) add('maxDifficulty', difficultyLabel(filters.maxDifficulty), { maxDifficulty: null });
  for (const tag of filters.tags) add(`tag:${tag}`, tagLabel(tag), { tags: filters.tags.filter((other) => other !== tag) });
  return list;
}

export interface AppliedFiltersBarProps {
  items: AppliedFilter[];
  onChange: (next: ShopFilters) => void;
  className?: string;
}

/** The filters that are on, as chips that one press takes off, and "Clear all". */
export function AppliedFiltersBar({ items, onChange, className }: AppliedFiltersBarProps) {
  if (items.length === 0) return null;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ul aria-label="Filters on" className="no-scrollbar -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 md:flex-wrap">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <Chip size="sm" selected removable onClick={() => onChange(item.without)}>
              <span className="sr-only">Remove filter: </span>
              {item.label}
            </Chip>
          </li>
        ))}
      </ul>
      {items.length > 1 && (
        <Button variant="link" onClick={() => onChange(EMPTY_FILTERS)} className="shrink-0 [--button-text:0.875rem]">
          Clear all
        </Button>
      )}
    </div>
  );
}
