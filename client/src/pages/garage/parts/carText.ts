import type { BodyType, FitStatus, ProductSummary, Vehicle, VehicleMake, VehicleModelGroup } from '@/types/api';

export const BODY_ORDER: readonly BodyType[] = ['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'];

export const BODY_PLURAL: Record<BodyType, string> = {
  hatchback: 'Hatchbacks',
  sedan: 'Sedans',
  suv: 'SUVs',
  muv: 'MUVs',
  pickup: 'Pickups',
  coupe: 'Coupes',
};

export const BODY_SINGULAR: Record<BodyType, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  suv: 'SUV',
  muv: 'MUV',
  pickup: 'Pickup',
  coupe: 'Coupe',
};

/** "2018 to 2024" or "2024 onwards". */
export function yearsLabel(vehicle: Pick<Vehicle, 'yearFrom' | 'yearTo'>): string {
  return vehicle.yearTo === null ? `${vehicle.yearFrom} onwards` : `${vehicle.yearFrom} to ${vehicle.yearTo}`;
}

/** The model years a shopper can pick for their own car of this generation, newest first. */
export function modelYears(vehicle: Pick<Vehicle, 'yearFrom' | 'yearTo'>): number[] {
  const last = vehicle.yearTo ?? new Date().getFullYear();
  const years: number[] = [];
  for (let year = Math.max(last, vehicle.yearFrom); year >= vehicle.yearFrom; year -= 1) years.push(year);
  return years;
}

/** Lower case letters and digits only, so "Wagon-R", "wagon r" and "WagonR" all match. */
export function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** True when every word the shopper typed appears somewhere in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = squash(text);
  const words = query.split(/\s+/).map(squash).filter(Boolean);
  return words.length > 0 && words.every((word) => haystack.includes(word));
}

export function findMake(makes: readonly VehicleMake[] | undefined, slug: string | undefined): VehicleMake | null {
  if (!makes || !slug) return null;
  const wanted = slug.toLowerCase();
  return makes.find((make) => make.slug.toLowerCase() === wanted) ?? null;
}

export function findModel(make: VehicleMake | null, slug: string | undefined): VehicleModelGroup | null {
  if (!make || !slug) return null;
  const wanted = slug.toLowerCase();
  return make.models.find((model) => model.slug.toLowerCase() === wanted) ?? null;
}

export function modelPath(makeSlug: string, modelSlug: string, generationId?: number): string {
  const base = `/cars/${makeSlug}/${modelSlug}`;
  return generationId === undefined ? base : `${base}?gen=${generationId}`;
}

/** The model page with this generation chosen. */
export function carPath(vehicle: Pick<Vehicle, 'makeSlug' | 'modelSlug' | 'id'>): string {
  return modelPath(vehicle.makeSlug, vehicle.modelSlug, vehicle.id);
}

const FIT_RANK: Record<string, number> = { direct: 0, with_work: 1, universal: 2, unknown: 3, no: 4 };

function rank(fit: FitStatus): number {
  return fit === null ? 5 : (FIT_RANK[fit] ?? 5);
}

/**
 * Direct fits first, then fits with work, universal parts and parts not checked yet.
 * Stable, so the server's own order (in stock first, best sellers) holds inside each group.
 */
export function directFirst(products: readonly ProductSummary[]): ProductSummary[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => rank(a.product.fit) - rank(b.product.fit) || a.index - b.index)
    .map((entry) => entry.product);
}

export function fitsOnCar(product: ProductSummary): boolean {
  return product.fit === 'direct' || product.fit === 'with_work' || product.fit === 'universal';
}
