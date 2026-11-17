/**
 * The shop's state lives in the URL, so a filtered list can be shared and Back undoes a filter.
 * These helpers read the query string into filters and write filters back, using the same
 * names as ProductQuery (`minPrice`, `inStock`, `tags`...), so the address reads like the request.
 */
import type { Legality, ProductQuery, ProductSort } from '@/types/api';

export const PAGE_SIZE = 24;
/** "Show more" stops growing the page after this many pages: past it, refine the filters instead. */
export const MAX_PAGES = 20;

export interface ShopFilters {
  fitOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  onSale: boolean;
  inDrop: boolean;
  /** Only parts the shop marks as new (the home page's "New in" link). */
  isNew: boolean;
  /** Only parts the shop features (the home page's "Featured" link). */
  featured: boolean;
  legality: Legality | null;
  maxDifficulty: number | null;
  tags: string[];
  /** Search only: one category slug. Category pages carry their category in the path. */
  category: string | null;
}

export const EMPTY_FILTERS: ShopFilters = {
  fitOnly: false,
  minPrice: null,
  maxPrice: null,
  inStock: false,
  onSale: false,
  inDrop: false,
  isNew: false,
  featured: false,
  legality: null,
  maxDifficulty: null,
  tags: [],
  category: null,
};

const LEGALITIES: readonly Legality[] = ['road_legal', 'check_rules', 'off_road_only'];

export const SORTS: readonly ProductSort[] = ['relevance', 'popular', 'newest', 'price_asc', 'price_desc', 'rating', 'discount'];

export const SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'Best match',
  popular: 'Most popular',
  newest: 'Newest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Best fitted reports',
  discount: 'Biggest discount',
};

/** "I can fit it myself": the most difficult level the shopper is willing to take on. */
export const DIFFICULTY_LEVELS = [1, 2, 3] as const;

const FILTER_KEYS = [
  'fitOnly',
  'minPrice',
  'maxPrice',
  'inStock',
  'onSale',
  'inDrop',
  'isNew',
  'featured',
  'legality',
  'maxDifficulty',
  'tags',
  'category',
] as const;

function wholeRupees(value: string | null): number | null {
  if (!value || !/^\d{1,8}$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

function flag(value: string | null): boolean {
  return value === '1';
}

export function readFilters(params: URLSearchParams): ShopFilters {
  const legality = params.get('legality');
  const difficulty = wholeRupees(params.get('maxDifficulty'));
  const tags = (params.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    fitOnly: flag(params.get('fitOnly')),
    minPrice: wholeRupees(params.get('minPrice')),
    maxPrice: wholeRupees(params.get('maxPrice')),
    inStock: flag(params.get('inStock')),
    onSale: flag(params.get('onSale')),
    inDrop: flag(params.get('inDrop')),
    isNew: flag(params.get('isNew')),
    featured: flag(params.get('featured')),
    legality: LEGALITIES.includes(legality as Legality) ? (legality as Legality) : null,
    maxDifficulty: difficulty !== null && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    tags: [...new Set(tags)],
    category: params.get('category')?.trim() || null,
  };
}

/**
 * The query string for these filters, keeping everything else already in it (q, sort)
 * and dropping the page, because a new filter starts the list from the top.
 */
export function writeFilters(params: URLSearchParams, filters: ShopFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of FILTER_KEYS) next.delete(key);
  next.delete('page');
  const set = (key: string, value: string | number | null | false) => {
    if (value !== null && value !== false && value !== '') next.set(key, String(value));
  };
  set('fitOnly', filters.fitOnly && '1');
  set('minPrice', filters.minPrice);
  set('maxPrice', filters.maxPrice);
  set('inStock', filters.inStock && '1');
  set('onSale', filters.onSale && '1');
  set('inDrop', filters.inDrop && '1');
  set('isNew', filters.isNew && '1');
  set('featured', filters.featured && '1');
  set('legality', filters.legality);
  set('maxDifficulty', filters.maxDifficulty);
  set('tags', filters.tags.join(','));
  set('category', filters.category);
  return next;
}

/** The filters as a ProductQuery fragment. `fitOnly` only means something with a car. */
export function filtersToQuery(filters: ShopFilters, hasVehicle: boolean): ProductQuery {
  const query: ProductQuery = {};
  if (filters.fitOnly && hasVehicle) query.fitOnly = '1';
  if (filters.minPrice !== null) query.minPrice = filters.minPrice;
  if (filters.maxPrice !== null) query.maxPrice = filters.maxPrice;
  if (filters.inStock) query.inStock = '1';
  if (filters.onSale) query.onSale = '1';
  if (filters.inDrop) query.inDrop = '1';
  if (filters.isNew) query.isNew = '1';
  if (filters.featured) query.featured = '1';
  if (filters.legality) query.legality = filters.legality;
  if (filters.maxDifficulty !== null) query.maxDifficulty = filters.maxDifficulty;
  if (filters.tags.length > 0) query.tags = filters.tags.join(',');
  if (filters.category) query.category = filters.category;
  return query;
}

/** How many filters narrow the list, not counting the car toggle (it has its own bar). */
export function countFilters(filters: ShopFilters): number {
  return (
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.onSale ? 1 : 0) +
    (filters.inDrop ? 1 : 0) +
    (filters.isNew ? 1 : 0) +
    (filters.featured ? 1 : 0) +
    (filters.legality ? 1 : 0) +
    (filters.maxDifficulty !== null ? 1 : 0) +
    filters.tags.length +
    (filters.category ? 1 : 0)
  );
}

export function sameFilters(a: ShopFilters, b: ShopFilters): boolean {
  return writeFilters(new URLSearchParams(), a).toString() === writeFilters(new URLSearchParams(), b).toString();
}

export function readSort(params: URLSearchParams, isSearch: boolean): ProductSort {
  const value = params.get('sort') as ProductSort | null;
  const fallback: ProductSort = isSearch ? 'relevance' : 'popular';
  if (!value || !SORTS.includes(value)) return fallback;
  if (value === 'relevance' && !isSearch) return fallback;
  return value;
}

export function readPage(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page > 1 ? Math.min(page, MAX_PAGES) : 1;
}

const UPPER_WORDS = new Set(['led', 'hid', 'drl', 'usb', 'abs', 'tpu', 'pu', 'oem', 'gps', 'dvr', 'tpms', 'pcd', 'ip67', 'ip68', 'suv', 'muv', 'ac', 'dc', '4x4']);

/** A tag as a shopper reads it: "led" → "LED", "plug-and-play" → "Plug and play". */
export function tagLabel(tag: string): string {
  const words = tag.replace(/[-_]+/g, ' ').trim().split(/\s+/);
  const text = words.map((word) => (UPPER_WORDS.has(word.toLowerCase()) ? word.toUpperCase() : word.toLowerCase())).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
