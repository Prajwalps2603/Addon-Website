/**
 * The build sheet worked out from a build and the catalogue: one entry per fitted slot, the total,
 * and the warnings that matter for a style build (off-road only parts, parts that do not fit the car).
 */
import type { BuildSlot, BuildState, ProductSummary } from '@/types/api';
import { BUILD_SLOT_LABELS, findBuildStyle } from '@/features/buildbay/contract';
import { fittedSlots } from './codec';

export interface SheetEntry {
  slot: BuildSlot;
  slotLabel: string;
  /** The style key on the part. */
  style: string;
  styleLabel: string;
  /** The catalogue product on this part, or null for a style with no product chosen. */
  product: ProductSummary | null;
  /** A product id is on the part but the product could not be loaded (removed, or still loading). */
  productMissing: boolean;
  colour: string | null;
}

export type SheetWarningKind = 'off_road' | 'no_fit' | 'with_work' | 'sold_out';

export interface SheetWarning {
  kind: SheetWarningKind;
  slot: BuildSlot;
  product: ProductSummary;
  message: string;
}

export interface BuildSheet {
  entries: SheetEntry[];
  /** Entries that carry a product. */
  products: ProductSummary[];
  total: number;
  warnings: SheetWarning[];
}

export function warningsFor(slot: BuildSlot, product: ProductSummary, carModel: string | null): SheetWarning[] {
  const out: SheetWarning[] = [];
  const car = carModel ?? 'car';
  if (product.fit === 'no') {
    out.push({ kind: 'no_fit', slot, product, message: product.fitNote ? `Does not fit your ${car}: ${product.fitNote}` : `Does not fit your ${car}.` });
  } else if (product.fit === 'with_work') {
    out.push({ kind: 'with_work', slot, product, message: product.fitNote ? `Fits your ${car} with work: ${product.fitNote}` : `Fits your ${car} with work. Ask us what is involved.` });
  }
  if (product.legality === 'off_road_only') {
    out.push({ kind: 'off_road', slot, product, message: 'Off-road only. Not for use on public roads.' });
  }
  if (!product.inStock) out.push({ kind: 'sold_out', slot, product, message: 'Sold out at the moment.' });
  return out;
}

export function buildSheet(state: BuildState, byId: ReadonlyMap<number, ProductSummary>, carModel: string | null): BuildSheet {
  const entries: SheetEntry[] = [];
  const products: ProductSummary[] = [];
  const warnings: SheetWarning[] = [];
  const counted = new Set<number>();
  let total = 0;

  for (const slot of fittedSlots(state)) {
    const part = state.parts[slot];
    if (!part) continue;
    const id = part.productId ?? null;
    const product = id ? (byId.get(id) ?? null) : null;
    entries.push({
      slot,
      slotLabel: BUILD_SLOT_LABELS[slot],
      style: part.style,
      styleLabel: findBuildStyle(slot, part.style)?.label ?? part.style,
      product,
      productMissing: Boolean(id) && !product,
      colour: part.color ?? null,
    });
    if (product) {
      if (!counted.has(product.id)) {
        counted.add(product.id);
        products.push(product);
        total += product.price;
      }
      warnings.push(...warningsFor(slot, product, carModel));
    }
  }
  return { entries, products, total, warnings };
}
