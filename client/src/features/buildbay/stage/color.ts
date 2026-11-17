/** Small colour helpers for the stage art. Everything works on #rrggbb strings. */

type Rgb = [number, number, number];

const FALLBACK: Rgb = [213, 216, 221];

export function parseHex(hex: string | null | undefined): Rgb {
  if (!hex) return FALLBACK;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return FALLBACK;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function normalizeHex(hex: string | null | undefined, fallback: string): string {
  if (!hex) return fallback;
  const h = hex.trim();
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(h) ? toHex(parseHex(h)) : fallback;
}

/** The tones a body panel needs, derived from one paint colour. */
export interface PaintTones {
  base: string;
  light: string;
  highlight: string;
  shade: string;
  deep: string;
  edge: string;
}

export function paintTones(paint: string, night: boolean): PaintTones {
  const lum = luminance(paint);
  // Dark paints need a stronger lift to read; light paints need a stronger shade.
  const lift = lum < 0.08 ? 0.42 : lum < 0.3 ? 0.3 : 0.5;
  const drop = lum > 0.6 ? 0.3 : 0.42;
  let tones: PaintTones = {
    base: paint,
    light: mix(paint, '#ffffff', lift * 0.5),
    highlight: mix(paint, '#ffffff', lift),
    shade: mix(paint, '#0c0d0f', drop * 0.6),
    deep: mix(paint, '#0c0d0f', drop),
    edge: mix(paint, '#0c0d0f', 0.62),
  };
  if (night) {
    const dim = (c: string, t: number) => mix(c, '#0b0e16', t);
    tones = {
      base: dim(tones.base, 0.6),
      light: dim(tones.light, 0.52),
      highlight: dim(tones.highlight, 0.42),
      shade: dim(tones.shade, 0.66),
      deep: dim(tones.deep, 0.7),
      edge: dim(tones.edge, 0.6),
    };
  }
  return tones;
}
