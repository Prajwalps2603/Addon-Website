import { useId } from 'react';

/*
 * The tyre from the owner's logo (client/public/brand/addon-logo.png), seen three-quarters on:
 * a black tyre whose tread is printed in Tread Red, around a ten-spoke silver alloy.
 * All coordinates are the logo PNG's own pixels (1024 x 304), so the Logo can lay the tyre and the
 * letters out on one grid and the drawing can be checked against the PNG by overlaying the two.
 * Geometry is worked out once when the module loads.
 */

/** The sidewall face: an ellipse leaning 23 degrees, and the offset of the far side of the tyre. */
const FACE = { cx: 621, cy: 139, rx: 78, ry: 110, rot: 23, dx: 47, dy: 9 };
/** The rim, in the same lean. Spokes, hub and lip are drawn on a 100-unit circle and squashed onto it. */
export const RIM_TRANSFORM = 'translate(621 139) rotate(23) scale(0.63 0.86)';

/** The square that holds the tyre alone (the `mark` variant and the favicon). */
export const TYRE_BOX = { x: 528, y: 23, size: 233 };

const r1 = (value: number): number => Math.round(value * 10) / 10;
const rad = (degrees: number): number => (degrees * Math.PI) / 180;

function facePoint(t: number, shift = 0): [number, number] {
  const cos = Math.cos(rad(FACE.rot));
  const sin = Math.sin(rad(FACE.rot));
  const x = FACE.rx * Math.cos(t);
  const y = FACE.ry * Math.sin(t);
  return [FACE.cx + FACE.dx * shift + x * cos - y * sin, FACE.cy + FACE.dy * shift + x * sin + y * cos];
}

function convexHull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list: Array<[number, number]>) => {
    const out: Array<[number, number]> = [];
    for (const point of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

const line = (points: Array<[number, number]>): string => `M${points.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}`;

function circle(radius: number, cx = 0, cy = 0, clockwise = true): string {
  const sweep = clockwise ? 1 : 0;
  return `M${cx + radius} ${cy}A${radius} ${radius} 0 1 ${sweep} ${cx - radius} ${cy}A${radius} ${radius} 0 1 ${sweep} ${cx + radius} ${cy}Z`;
}

function polar(radius: number, degrees: number): [number, number] {
  return [r1(radius * Math.cos(rad(degrees))), r1(radius * Math.sin(rad(degrees)))];
}

const SAMPLES = Array.from({ length: 72 }, (_, i) => (i / 72) * 2 * Math.PI);

/** Outline of the whole tyre: the face and the far side joined by the tread. */
const HULL = `${line(convexHull([...SAMPLES.map((t) => facePoint(t)), ...SAMPLES.map((t) => facePoint(t, 1))]))}Z`;

const FACE_PATH = (() => {
  const [ax, ay] = facePoint(0);
  const [bx, by] = facePoint(Math.PI);
  const arc = `${FACE.rx} ${FACE.ry} ${FACE.rot} 1 1`;
  return `M${r1(ax)} ${r1(ay)}A${arc} ${r1(bx)} ${r1(by)}A${arc} ${r1(ax)} ${r1(ay)}Z`;
})();

/** Three grooves round the tread and staggered cuts between them: the blocks of the logo's tread. */
const TREAD = (() => {
  const grooves = [0.22, 0.5, 0.78];
  let path = '';
  for (const shift of grooves) {
    const points: Array<[number, number]> = [];
    for (let d = -116; d <= 116; d += 4) points.push(facePoint(rad(d), shift));
    path += line(points);
  }
  const edges = [0, ...grooves, 1.1];
  for (let d = -120, k = 0; d <= 120; d += 11, k += 1) {
    for (let j = 0; j < edges.length - 1; j += 1) {
      const offset = (j + k) % 2 ? 5 : 0;
      path += line([facePoint(rad(d + offset), edges[j]), facePoint(rad(d + offset + 3.5), edges[j + 1])]);
    }
  }
  return path;
})();

/** Ten slim spokes that sweep a little on their way to the rim, as on the logo's alloy. */
const SPOKES = (() => {
  let path = '';
  for (let i = 0; i < 10; i += 1) {
    const c = i * 36 - 90;
    const [h1x, h1y] = polar(19, c - 13);
    const [h2x, h2y] = polar(19, c + 13);
    const [m1x, m1y] = polar(55, c - 2);
    const [m2x, m2y] = polar(55, c + 8);
    const [e1x, e1y] = polar(90, c + 0.8);
    const [e2x, e2y] = polar(90, c + 9.2);
    path += `M${h1x} ${h1y}Q${m1x} ${m1y} ${e1x} ${e1y}L${e2x} ${e2y}Q${m2x} ${m2y} ${h2x} ${h2y}Z`;
  }
  return path;
})();

const LIP = circle(100) + circle(88, 0, 0, false);
const BARREL = circle(89);
const HUB = circle(23);
const LUGS = Array.from({ length: 5 }, (_, i) => {
  const [x, y] = polar(13, i * 72 - 54);
  return circle(3, x, y);
}).join('');
const CAP = circle(6);

/** Fixed colours: rubber, alloy and tread are the same in both themes, like the printed logo. */
const RUBBER = '#0c0d0f';
const BARREL_SHADE = '#16181c';
const SPOKE_EDGE = '#6f757d';
const LUG = '#2a2d33';

export interface LogoTyreProps {
  /** Turns the alloy (not the tyre) with the page's scroll progress. Pure CSS, off under reduced motion. */
  roll?: boolean;
}

/**
 * The logo's tyre as SVG shapes with no wrapper, in the logo PNG's pixel space.
 * A faint keyline in the current text colour keeps the black tyre visible on a dark ground.
 */
export function LogoTyre({ roll = false }: LogoTyreProps) {
  // url(#id) needs a plain id; React's ids carry punctuation.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const silver = `addon-silver-${id}`;
  const band = `addon-band-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={silver} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f5f6" />
          <stop offset="0.55" stopColor="#b9bec4" />
          <stop offset="1" stopColor="#7d838b" />
        </linearGradient>
        <clipPath id={band}>
          <path clipRule="evenodd" d={HULL + FACE_PATH} />
        </clipPath>
      </defs>
      <path d={HULL} fill={RUBBER} stroke="currentColor" strokeOpacity={0.3} strokeWidth={2} />
      <path
        d={TREAD}
        fill="none"
        stroke="var(--red, #d71920)"
        strokeWidth={1.9}
        strokeLinecap="round"
        clipPath={`url(#${band})`}
      />
      <path d={FACE_PATH} fill={RUBBER} />
      <g transform={RIM_TRANSFORM}>
        <path d={LIP} fill={`url(#${silver})`} fillRule="evenodd" />
        <path d={BARREL} fill={BARREL_SHADE} />
        <g className={roll ? 'roll-scroll' : undefined}>
          <path d={SPOKES} fill={`url(#${silver})`} stroke={SPOKE_EDGE} strokeWidth={1} />
          <path d={HUB} fill={`url(#${silver})`} />
          <path d={LUGS} fill={LUG} />
          <path d={CAP} fill={RUBBER} />
        </g>
      </g>
    </>
  );
}
