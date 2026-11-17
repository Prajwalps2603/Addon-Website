// Helpers every seed step uses: the catalogue and photo files, a stable hash for the
// "deterministic but varied" values, and backdated timestamps.
import fs from 'node:fs';
import { toIso } from '../db/index.js';
import { applyAdditions } from './data/additions.js';

const CATALOG_FILE = new URL('./data/catalog.json', import.meta.url);
const PHOTOS_FILE = new URL('./photos.json', import.meta.url);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** catalog.json plus the lines the owner added later (data/additions.js). */
export function loadCatalog() {
  return applyAdditions(JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8')));
}

const isPhoto = (photo) => photo !== null && typeof photo === 'object' && typeof photo.url === 'string' && photo.url.startsWith('/');
const photoList = (value) => (Array.isArray(value) ? value.filter(isPhoto) : []);

/** Whatever was read from photos.json as { catalog: { [artKind]: Photo[] }, editorial: Photo[] }, with anything unusable dropped. */
export function normalizePhotos(value) {
  const catalog = {};
  const pools = value !== null && typeof value === 'object' && value.catalog !== null && typeof value.catalog === 'object' ? value.catalog : {};
  for (const [artKind, pool] of Object.entries(pools)) {
    const photos = photoList(pool);
    if (photos.length > 0) catalog[artKind] = photos;
  }
  return { catalog, editorial: photoList(value?.editorial) };
}

/** The photo library the photo script wrote. A missing or unreadable file is an empty library: products then show the placeholder frame. */
export function loadPhotos(file = PHOTOS_FILE) {
  if (!fs.existsSync(file)) return normalizePhotos(null);
  try {
    return normalizePhotos(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return normalizePhotos(null);
  }
}

/** A stable 32-bit number for a string (FNV-1a with a final mix), so the same SKU always gets the same stock, cost and dates. */
export function hash(text) {
  let h = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    h ^= text.charCodeAt(index);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A whole number from min to max inclusive, fixed by the key. */
export function between(key, min, max) {
  return min + (hash(key) % (max - min + 1));
}

/** The timestamp `days` (and `hours`) before nowMs, in the format the schema stores. */
export function ago(nowMs, days, hours = 0) {
  return toIso(new Date(nowMs - days * DAY_MS - hours * HOUR_MS));
}

/** 'a', 'a and b', 'a, b and c'. Pass 'or' for choices. */
export function listOf(words, joiner = 'and') {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} ${joiner} ${words.at(-1)}`;
}

/** The choices of a variant option as one line. Choices that contain commas themselves ('16 x 7J, ET35') are set apart with semicolons. */
export function choiceList(values) {
  return values.some((value) => value.includes(',')) ? values.join('; ') : listOf(values, 'or');
}

/** Looks a SKU up in the map the product step returned, and fails loudly when the content names a part that is not in the catalogue. */
export function productIdOf(productIds, sku, where) {
  const id = productIds.get(sku);
  if (!id) throw new Error(`Seed content (${where}) names a SKU that is not in the catalogue: ${sku}`);
  return id;
}
