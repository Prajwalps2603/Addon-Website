/** Shared by the id-list stores (wishlist, compare, recently viewed). */

/** Keeps positive whole numbers, drops repeats, and cuts the list at `max`. */
export function cleanIds(input: unknown, max: number): number[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set<number>();
  for (const value of input) {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) ids.add(value);
  }
  return [...ids].slice(0, max);
}
