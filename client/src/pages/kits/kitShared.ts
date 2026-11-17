/**
 * Shared logic for the two kit planners (New Car and Pocket Builds): URL state, the
 * kit maths that runs on the client (removed parts, dealer comparison, order-by date),
 * the cart hand-off and the share text. No JSX here.
 */
import { formatDate, formatINR, pluralize } from '@/lib/format';
import { siteUrl } from '@/lib/urls';
import { toast } from '@/components/ui';
import { cartLineKey, useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { markForStudio } from '@/features/buildbay/studio';
import type { BodyType, Kit, KitGoal, KitItem, ProductSummary, Vehicle } from '@/types/api';

export type KitTier = Kit['tier'];

export const TIER_ORDER: readonly KitTier[] = ['essential', 'smart', 'full'];

/** The vibes Pocket Builds offers, in the order shown. `new_car` belongs to the New Car planner. */
export type Vibe = Exclude<KitGoal, 'new_car'>;

export const VIBES: ReadonlyArray<{ value: Vibe; label: string; description: string }> = [
  { value: 'sporty', label: 'Sporty', description: 'Sharper looks: spoilers, wheels, body lines.' },
  { value: 'comfort', label: 'Comfort', description: 'Easier drives: seats, shades, cabin bits.' },
  { value: 'sound', label: 'Sound', description: 'Better music: speakers, power, quieter doors.' },
  { value: 'night', label: 'Night', description: 'See and be seen after dark.' },
  { value: 'offroad', label: 'Off-road', description: 'Bad roads, trails and water crossings.' },
  { value: 'protection', label: 'Protection', description: 'Keep the paint and cabin looking new.' },
];

export const VIBE_WORDS: Record<KitGoal, string> = {
  new_car: 'new car',
  sporty: 'sporty',
  comfort: 'comfort',
  sound: 'sound',
  night: 'night driving',
  offroad: 'off-road',
  protection: 'protection',
};

export function isVibe(value: string | null): value is Vibe {
  return VIBES.some((vibe) => vibe.value === value);
}

export const BODY_TYPES: ReadonlyArray<{ value: BodyType; label: string; plural: string }> = [
  { value: 'hatchback', label: 'Hatchback', plural: 'hatchbacks' },
  { value: 'sedan', label: 'Sedan', plural: 'sedans' },
  { value: 'suv', label: 'SUV', plural: 'SUVs' },
  { value: 'muv', label: 'MUV', plural: 'MUVs' },
  { value: 'pickup', label: 'Pickup', plural: 'pickups' },
  { value: 'coupe', label: 'Coupe', plural: 'coupes' },
];

export function isBodyType(value: string | null): value is BodyType {
  return BODY_TYPES.some((body) => body.value === value);
}

export function bodyLabel(body: BodyType): string {
  return BODY_TYPES.find((entry) => entry.value === body)?.label ?? body;
}

export function bodyPlural(body: BodyType): string {
  return BODY_TYPES.find((entry) => entry.value === body)?.plural ?? body;
}

// ---------------------------------------------------------------------------- URL helpers

/** '12,40,7' → [7, 12, 40]: positive whole numbers, no repeats, sorted so the request key is stable. */
export function parseIds(value: string | null): number[] {
  if (!value) return [];
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return [...new Set(ids)].sort((a, b) => a - b).slice(0, 200);
}

export function joinIds(ids: readonly number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join(',');
}

/** A whole-rupee amount from the URL or a text box ('₹25,000' works), or null. */
export function parseRupees(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/[₹,\s]/g, '');
  if (!/^\d{1,8}$/.test(digits)) return null;
  return Number(digits);
}

export function isTier(value: string | null): value is KitTier {
  return value === 'essential' || value === 'smart' || value === 'full';
}

/** 'YYYY-MM-DD' that is a real calendar day. */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------- dates

const DAY_MS = 86_400_000;

/** Today's date in India as 'YYYY-MM-DD'. */
export function todayInIndia(now = Date.now()): string {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

/** The day that many working days (Sundays skipped) before a plain date. */
export function workingDaysBefore(ymd: string, days: number): string {
  let time = Date.parse(`${ymd}T00:00:00Z`);
  let left = Math.max(0, Math.trunc(days));
  while (left > 0) {
    time -= DAY_MS;
    if (new Date(time).getUTCDay() !== 0) left -= 1;
  }
  return new Date(time).toISOString().slice(0, 10);
}

export function longDay(ymd: string): string {
  return formatDate(ymd, { weekday: true, year: false });
}

// ---------------------------------------------------------------------------- kits after the shopper's edits

/** A kit as shown: the server's kit less any part the shopper took out, with the totals worked again. */
export interface ShownKit {
  kit: Kit;
  items: KitItem[];
  total: number;
  mrpTotal: number;
  /** How many of the server's parts were taken out of this kit. */
  removedCount: number;
}

export function showKits(kits: readonly Kit[], removed: readonly number[]): ShownKit[] {
  const out = new Set(removed);
  return [...kits]
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))
    .map((kit) => {
      const items = kit.items.filter((item) => !out.has(item.product.id));
      return {
        kit,
        items,
        total: items.reduce((sum, item) => sum + item.product.price, 0),
        mrpTotal: items.reduce((sum, item) => sum + item.product.mrp, 0),
        removedCount: kit.items.length - items.length,
      };
    });
}

/** The server's blurb ends with a left-over line worked out before any edits: drop it, the page shows its own. */
export function blurbOf(kit: Kit): string {
  return kit.blurb.replace(/\s*(₹[\d,]+ of your budget left over\.|Uses the whole budget\.)\s*$/, '').trim();
}

export function pickTier(shown: readonly ShownKit[], wanted: string | null): KitTier | null {
  if (shown.length === 0) return null;
  if (isTier(wanted) && shown.some((entry) => entry.kit.tier === wanted)) return wanted;
  return shown.find((entry) => entry.kit.tier === 'smart')?.kit.tier ?? shown[0]!.kit.tier;
}

// ---------------------------------------------------------------------------- the dealer's quote

export type QuoteVerdict = { kind: 'less' | 'more' | 'same'; difference: number };

/** Within 5% (and at least ₹500) of the dealer's figure counts as about the same. */
export function compareToQuote(total: number, quote: number): QuoteVerdict {
  const difference = quote - total;
  const band = Math.max(500, Math.round(quote * 0.05));
  if (difference > band) return { kind: 'less', difference };
  if (difference < -band) return { kind: 'more', difference: -difference };
  return { kind: 'same', difference: Math.abs(difference) };
}

export function quoteLine(verdict: QuoteVerdict): string {
  if (verdict.kind === 'less') return `${formatINR(verdict.difference)} less than the dealer's quote`;
  if (verdict.kind === 'more') return `${formatINR(verdict.difference)} more than the dealer's quote`;
  return "About the same as the dealer's quote";
}

// ---------------------------------------------------------------------------- the cart

/** True when a part cannot go in the cart from a kit: a size or design must be chosen on its page first. */
export function needsChoice(product: ProductSummary): boolean {
  return product.hasVariants || product.customKind !== null;
}

/**
 * Adds every part of a kit that can be added as it is. Parts already in the cart are left as they
 * are (no second unit), and parts that need a size are named so the shopper can add them from their page.
 */
export function addKitToCart(items: readonly KitItem[], kitTitle: string, options: { fitAtStudio?: boolean } = {}): void {
  const cart = useCart.getState();
  const inCart = new Set(cart.lines.map((line) => cartLineKey(line)));
  let added = 0;
  let already = 0;
  const choose: string[] = [];
  const plain: number[] = [];
  for (const { product } of items) {
    if (needsChoice(product)) {
      choose.push(product.name);
      continue;
    }
    plain.push(product.id);
    const key = cartLineKey({ productId: product.id, variantId: null });
    if (inCart.has(key)) {
      already += 1;
      continue;
    }
    cart.add({ productId: product.id });
    added += 1;
  }
  if (options.fitAtStudio) markForStudio(plain);

  const notes = [
    options.fitAtStudio && plain.length > 0 ? 'Marked for fitting at our studio: choose the slot at checkout.' : '',
    already > 0 ? `${pluralize(already, 'part was', 'parts were')} already in the cart.` : '',
    choose.length > 0 ? `Choose a size for ${choose.join(', ')} on ${choose.length === 1 ? 'its page' : 'their pages'}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (added > 0) {
    toast.success(`${kitTitle} kit: ${pluralize(added, 'part')} added to the cart`, { description: notes || undefined });
    useUi.getState().openCart();
  } else {
    toast.info(already > 0 && choose.length === 0 ? 'Every part of this kit is already in your cart' : 'Nothing added yet', {
      description: notes || undefined,
    });
    if (already > 0 && choose.length === 0) useUi.getState().openCart();
  }
}

// ---------------------------------------------------------------------------- sharing

export interface ShareTextInput {
  shown: ShownKit;
  heading: string;
  vehicle: Pick<Vehicle, 'label'> | null;
  /** Path and query of this page, so the link opens the same kit. */
  path: string;
}

export function kitShareText({ shown, heading, vehicle, path }: ShareTextInput): string {
  return [
    heading,
    vehicle ? `Car: ${vehicle.label}` : null,
    '',
    ...shown.items.map((item) => `- ${item.product.name}, ${formatINR(item.product.price)}`),
    '',
    `${shown.kit.title} kit, ${pluralize(shown.items.length, 'part')}: ${formatINR(shown.total)}`,
    siteUrl(path),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
