import type { Category } from '@/types/api';

/** Gross margin in rupees and as a percent of the selling price, or null when the cost is unknown. */
export function marginOf(price: number, cost: number | null | undefined): { amount: number; percent: number } | null {
  if (cost === null || cost === undefined || !Number.isFinite(cost) || !Number.isFinite(price)) return null;
  const amount = Math.round(price - cost);
  const percent = price > 0 ? Math.round((amount / price) * 100) : 0;
  return { amount, percent };
}

/** A whole number typed into a text field, or null when it is blank or not a whole number. */
export function wholeNumber(text: string | number | null | undefined): number | null {
  if (typeof text === 'number') return Number.isInteger(text) ? text : null;
  const trimmed = String(text ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/** The price after a percent off, rounded the way the server rounds drop prices. */
export function afterPercentOff(price: number, percent: number): number {
  return Math.round((price * (100 - percent)) / 100);
}

export interface CategoryOption {
  id: number;
  slug: string;
  label: string;
  parent: Category;
  category: Category;
}

/** Every subcategory, grouped under its parent, in the shop's order. */
export function subcategoryGroups(tree: readonly Category[] | undefined): { parent: Category; children: Category[] }[] {
  if (!tree) return [];
  return [...tree]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((parent) => ({
      parent,
      children: [...parent.children].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    }));
}

export function findCategory(tree: readonly Category[] | undefined, id: number | null | undefined): Category | null {
  if (!tree || !id) return null;
  for (const parent of tree) {
    if (parent.id === id) return parent;
    const child = parent.children.find((c) => c.id === id);
    if (child) return child;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Indian time. The shop runs on IST whatever the phone is set to.
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 330 * 60_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO instant → 'YYYY-MM-DDTHH:mm' as the clock reads in India (for a datetime-local input). */
export function isoToIstInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const d = new Date(at + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 'YYYY-MM-DDTHH:mm' read as Indian time → ISO instant, or '' when it does not parse. */
export function istInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return '';
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS;
  return Number.isNaN(utc) ? '' : new Date(utc).toISOString();
}

/**
 * The usual Friday Five window: this Friday 7 pm to Sunday 11:59 pm, Indian time.
 * After Friday 7 pm (or at the weekend) it is the coming Friday.
 */
export function thisFridayWindow(now = Date.now()): { startsAt: string; endsAt: string } {
  const ist = new Date(now + IST_OFFSET_MS);
  const day = ist.getUTCDay(); // 0 Sunday … 5 Friday
  let ahead = (5 - day + 7) % 7;
  const fridayAtSeven = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + ahead, 19, 0);
  if (ahead === 0 && ist.getTime() >= fridayAtSeven) ahead = 7;
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate() + ahead;
  const start = Date.UTC(y, m, d, 19, 0) - IST_OFFSET_MS;
  const end = Date.UTC(y, m, d + 2, 23, 59) - IST_OFFSET_MS;
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
}

/** True when two windows share any moment. */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = Date.parse(aStart);
  const ae = Date.parse(aEnd);
  const bs = Date.parse(bStart);
  const be = Date.parse(bEnd);
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return as < be && ae > bs;
}

/** Moves one item of a list from one index to another, returning a new list. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}
