/**
 * The build state in and out of the address bar (`?b=`), and the rules that keep a state valid
 * for the art and for POST /builds (SUV-only parts, the sedan's roof spoiler, colours, lowering).
 *
 * Format, version 1 (URL safe, no escaping needed):
 *   header  "1" + body (h|s|u) + paint (6 hex) + ride (0..4 = -2..2) + wheel (0..2) + light (n|d) + tint (2 chars base 36)
 *   part    "~" + slot (1 char base 36, index in BUILD_SLOTS) + style (1 char base 36) [+ "c" + 6 hex] [+ "p" + product id base 36]
 * Example: 1hd5d8dd20n00~05cc3c7ccp1a~6l
 */
import type { BuildPart, BuildSlot, BuildState } from '@/types/api';
import {
  BUILD_SLOT_STYLES,
  BUILD_SLOTS,
  DEFAULT_BUILD_STATE,
  LOWERING_RIDE_HEIGHT,
  findBuildStyle,
} from '@/features/buildbay/contract';
import type { BuildBodyType } from '@/features/buildbay/contract';
import { DEFAULT_GLOW, DEFAULT_WHEEL_FINISH } from '@/features/buildbay/stage/styles';

const BODY_CODES: Record<BuildBodyType, string> = { hatchback: 'h', sedan: 's', suv: 'u' };
const BODY_FROM_CODE: Record<string, BuildBodyType> = { h: 'hatchback', s: 'sedan', u: 'suv' };
const HEX6 = /^[0-9a-f]{6}$/;

/** A fresh stock car. DEFAULT_BUILD_STATE is frozen, so every build starts from a copy. */
export function freshState(bodyType: BuildBodyType = DEFAULT_BUILD_STATE.bodyType): BuildState {
  return { ...DEFAULT_BUILD_STATE, bodyType, parts: {} };
}

function cleanHex(value: string | null | undefined): string | null {
  if (!value) return null;
  let hex = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.replace(/./g, (c) => c + c);
  return HEX6.test(hex) ? `#${hex}` : null;
}

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(hi, Math.max(lo, n));
}

/** Whether a style of a slot can be drawn on a body type. */
export function styleSuits(slot: BuildSlot, style: string, bodyType: BuildBodyType): boolean {
  const option = findBuildStyle(slot, style);
  return Boolean(option && option.bodyTypes.includes(bodyType));
}

/** The colour a part is drawn in when it takes one and none is set. */
export function defaultColourFor(slot: BuildSlot): string {
  return slot === 'wheels' ? DEFAULT_WHEEL_FINISH : DEFAULT_GLOW;
}

/**
 * Makes any state valid: known slots and styles only, parts that suit the body, colours where the
 * part takes one, ride height in range and at -1 or lower while lowering parts are fitted.
 * Returns the clean state and the labels of parts that had to come off.
 */
export function sanitizeState(input: Partial<BuildState> | null | undefined): { state: BuildState; removed: BuildSlot[] } {
  const source = input ?? {};
  const bodyType: BuildBodyType = source.bodyType && source.bodyType in BODY_CODES ? source.bodyType : DEFAULT_BUILD_STATE.bodyType;
  const parts: Partial<Record<BuildSlot, BuildPart>> = {};
  const removed: BuildSlot[] = [];
  const rawParts = (source.parts ?? {}) as Partial<Record<BuildSlot, BuildPart>>;

  for (const slot of BUILD_SLOTS) {
    const part = rawParts[slot];
    if (!part || typeof part.style !== 'string') continue;
    const option = findBuildStyle(slot, part.style);
    if (!option) continue;
    if (!option.bodyTypes.includes(bodyType)) {
      removed.push(slot);
      continue;
    }
    const clean: BuildPart = { style: option.style };
    if (option.takesColor) clean.color = cleanHex(part.color) ?? cleanHex(defaultColourFor(slot)) ?? undefined;
    if (typeof part.productId === 'number' && Number.isInteger(part.productId) && part.productId > 0) clean.productId = part.productId;
    parts[slot] = clean;
  }

  let rideHeight = clampInt(source.rideHeight, -2, 2, 0);
  const lowering = parts.lowering;
  if (lowering && rideHeight > -1) rideHeight = LOWERING_RIDE_HEIGHT[lowering.style] ?? -1;

  return {
    state: {
      bodyType,
      paint: cleanHex(source.paint) ?? DEFAULT_BUILD_STATE.paint,
      rideHeight,
      wheelSize: clampInt(source.wheelSize, 0, 2, 0),
      night: typeof source.night === 'boolean' ? source.night : DEFAULT_BUILD_STATE.night,
      tint: clampInt(source.tint, 0, 60, 0),
      parts,
    },
    removed,
  };
}

/** The state as a short string for `?b=`. */
export function encodeBuild(state: BuildState): string {
  const { state: s } = sanitizeState(state);
  let out = '1';
  out += BODY_CODES[s.bodyType];
  out += s.paint.slice(1);
  out += String(s.rideHeight + 2);
  out += String(s.wheelSize);
  out += s.night ? 'n' : 'd';
  out += s.tint.toString(36).padStart(2, '0');
  for (const slot of BUILD_SLOTS) {
    const part = s.parts[slot];
    if (!part) continue;
    const slotIndex = BUILD_SLOTS.indexOf(slot);
    const styleIndex = BUILD_SLOT_STYLES[slot].findIndex((option) => option.style === part.style);
    if (styleIndex < 0) continue;
    out += `~${slotIndex.toString(36)}${styleIndex.toString(36)}`;
    if (part.color) out += `c${part.color.slice(1)}`;
    if (part.productId) out += `p${part.productId.toString(36)}`;
  }
  return out;
}

/** Reads `?b=`. Returns null when the value is missing or not a build this page wrote. */
export function decodeBuild(code: string | null | undefined): BuildState | null {
  if (!code || code.length < 13 || code.length > 600 || code[0] !== '1') return null;
  const [header, ...segments] = code.toLowerCase().split('~');
  if (header.length !== 13) return null;
  const bodyType = BODY_FROM_CODE[header[1]];
  const paint = header.slice(2, 8);
  const ride = Number(header[8]);
  const wheel = Number(header[9]);
  const light = header[10];
  const tint = parseInt(header.slice(11, 13), 36);
  if (!bodyType || !HEX6.test(paint) || !(ride >= 0 && ride <= 4) || !(wheel >= 0 && wheel <= 2) || (light !== 'n' && light !== 'd') || Number.isNaN(tint)) {
    return null;
  }

  const parts: Partial<Record<BuildSlot, BuildPart>> = {};
  for (const segment of segments) {
    const match = /^([0-9a-z])([0-9a-z])(?:c([0-9a-f]{6}))?(?:p([0-9a-z]{1,10}))?$/.exec(segment);
    if (!match) continue;
    const slot = BUILD_SLOTS[parseInt(match[1], 36)];
    if (!slot) continue;
    const option = BUILD_SLOT_STYLES[slot][parseInt(match[2], 36)];
    if (!option) continue;
    const part: BuildPart = { style: option.style };
    if (match[3]) part.color = `#${match[3]}`;
    if (match[4]) {
      const id = parseInt(match[4], 36);
      if (Number.isSafeInteger(id) && id > 0) part.productId = id;
    }
    parts[slot] = part;
  }

  return sanitizeState({ bodyType, paint: `#${paint}`, rideHeight: ride - 2, wheelSize: wheel, night: light === 'n', tint, parts }).state;
}

/** `/build-bay?b=...`: opens this state in the Build Bay. */
export function buildBayPath(state: BuildState): string {
  return `/build-bay?b=${encodeBuild(state)}`;
}

/** The product ids on the parts, in build-sheet order, each once. */
export function productIdsOf(state: BuildState): number[] {
  const ids: number[] = [];
  for (const slot of BUILD_SLOTS) {
    const id = state.parts[slot]?.productId;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The fitted slots, in build-sheet order. */
export function fittedSlots(state: BuildState): BuildSlot[] {
  return BUILD_SLOTS.filter((slot) => Boolean(state.parts[slot]));
}

export function sameState(a: BuildState, b: BuildState): boolean {
  return encodeBuild(a) === encodeBuild(b);
}
