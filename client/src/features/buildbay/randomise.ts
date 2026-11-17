import type { BuildPart, BuildSlot, BuildState, ProductSummary } from '@/types/api';
import { BUILD_SLOTS, LOWERING_RIDE_HEIGHT, buildStylesFor } from '@/features/buildbay/contract';
import { GLOW_COLOURS, PAINTS, WHEEL_FINISHES } from '@/features/buildbay/stage/styles';
import type { ProductsBySlot } from './useBuildProducts';

function pick<T>(items: readonly T[]): T | undefined {
  return items.length ? items[Math.floor(Math.random() * items.length)] : undefined;
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * "Surprise me": a new paint, wheels and four to seven other parts on the same body, using real
 * catalogue parts where the catalogue has them (skipping parts that do not fit the active car).
 * The garage light stays as the shopper set it.
 */
export function surpriseBuild(current: BuildState, bySlot: ProductsBySlot): BuildState {
  const body = current.bodyType;
  const parts: Partial<Record<BuildSlot, BuildPart>> = {};
  const offered = BUILD_SLOTS.filter((slot) => slot !== 'wheels' && buildStylesFor(slot, body).length > 0);
  const count = 4 + Math.floor(Math.random() * 4);
  const slots: BuildSlot[] = ['wheels', ...shuffle(offered).slice(0, count)];

  for (const slot of slots) {
    const options = buildStylesFor(slot, body);
    const candidates = (bySlot[slot] ?? []).filter(
      (product: ProductSummary) => product.fit !== 'no' && product.inStock && options.some((option) => option.style === product.buildStyle),
    );
    const product = Math.random() < 0.75 ? pick(candidates) : undefined;
    const option = product ? options.find((o) => o.style === product.buildStyle) : pick(options);
    if (!option) continue;
    const part: BuildPart = { style: option.style, productId: product?.id ?? null };
    if (option.takesColor) {
      const palette = slot === 'wheels' ? WHEEL_FINISHES : GLOW_COLOURS;
      const finish = product && /^#[0-9a-fA-F]{6}$/.test(product.finishColor) ? product.finishColor : pick(palette)?.hex;
      if (finish) part.color = finish;
    }
    parts[slot] = part;
  }

  const lowering = parts.lowering;
  return {
    ...current,
    paint: pick(PAINTS.filter((p) => p.hex !== current.paint))?.hex ?? current.paint,
    wheelSize: Math.floor(Math.random() * 3),
    tint: pick([0, 0, 15, 30, 45]) ?? 0,
    rideHeight: lowering ? (LOWERING_RIDE_HEIGHT[lowering.style] ?? -1) : body === 'suv' ? (pick([0, 1, 2]) ?? 0) : 0,
    parts,
  };
}
