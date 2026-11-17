import type { ProductVariant } from '@/types/api';

/** Attribute names in the order they first appear across the variants: ['Colour', 'Size']. */
export function attributeKeys(variants: readonly ProductVariant[]): string[] {
  const keys: string[] = [];
  for (const variant of variants) {
    for (const key of Object.keys(variant.attributes ?? {})) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** The values one attribute takes, in catalogue order, without repeats. */
export function attributeValues(variants: readonly ProductVariant[], key: string): string[] {
  const values: string[] = [];
  for (const variant of variants) {
    const value = variant.attributes?.[key];
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function matches(variant: ProductVariant, wanted: Record<string, string>): boolean {
  return Object.entries(wanted).every(([key, value]) => variant.attributes?.[key] === value);
}

/**
 * The variant to switch to when the shopper picks `value` for `key`, keeping as many of the
 * other current choices as still exist. Prefers one in stock. null when no variant has that value.
 */
export function variantFor(
  variants: readonly ProductVariant[],
  current: ProductVariant | null,
  key: string,
  value: string,
): ProductVariant | null {
  const candidates = variants.filter((variant) => variant.attributes?.[key] === value);
  if (candidates.length === 0) return null;
  const others = Object.entries(current?.attributes ?? {}).filter(([name]) => name !== key);
  const score = (variant: ProductVariant) =>
    others.reduce((sum, [name, wanted]) => sum + (variant.attributes?.[name] === wanted ? 2 : 0), 0) + (variant.inStock ? 1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * Whether picking `value` for `key` could land on a variant in stock, given the other current choices.
 * Out-of-stock values stay visible but cannot be picked.
 */
export function valueAvailable(
  variants: readonly ProductVariant[],
  current: ProductVariant | null,
  key: string,
  value: string,
): { exists: boolean; inStock: boolean } {
  const wanted: Record<string, string> = { ...(current?.attributes ?? {}), [key]: value };
  const exact = variants.filter((variant) => matches(variant, wanted));
  const any = variants.filter((variant) => variant.attributes?.[key] === value);
  const pool = exact.length > 0 ? exact : any;
  return { exists: any.length > 0, inStock: pool.some((variant) => variant.inStock) };
}

/** A short name for a variant: its attribute values, or its own name. */
export function variantLabel(variant: ProductVariant): string {
  const values = Object.values(variant.attributes ?? {}).filter(Boolean);
  return values.length > 0 ? values.join(', ') : variant.name;
}
