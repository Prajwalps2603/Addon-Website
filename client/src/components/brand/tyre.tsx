/**
 * A one-colour tyre seen front-on, so it can turn: the RollingTyre loader and small marks drawn in the text colour.
 * The logo's own three-quarter tyre, with its red tread and silver alloy, is LogoTyre in logoTyre.tsx.
 * Geometry lives in a 100 x 100 box centred on 0,0 and is built once when the module loads.
 */

const round = (value: number): number => Math.round(value * 100) / 100;

function polar(radius: number, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  return [round(radius * Math.cos(radians)), round(radius * Math.sin(radians))];
}

/** A full circle as a path, so circles can be combined into rings with the even-odd rule. */
function circle(radius: number, clockwise = true): string {
  const sweep = clockwise ? 1 : 0;
  return `M${radius} 0A${radius} ${radius} 0 1 ${sweep} ${-radius} 0A${radius} ${radius} 0 1 ${sweep} ${radius} 0Z`;
}

/** The outer edge with its tread blocks: 36 blocks, each cut back 2 units at a slant. */
function treadEdge(radius = 48, depth = 2, blocks = 36): string {
  const step = 360 / blocks;
  const inner = radius - depth;
  let path = '';
  for (let i = 0; i < blocks; i += 1) {
    const start = i * step;
    const [x0, y0] = polar(radius, start);
    const [x1, y1] = polar(radius, start + step * 0.66);
    const [x2, y2] = polar(inner, start + step * 0.66 + 1.6);
    const [x3, y3] = polar(inner, start + step - 0.2);
    path += `${i === 0 ? 'M' : 'L'}${x0} ${y0}A${radius} ${radius} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 0 1 ${x3} ${y3}`;
  }
  return `${path}Z`;
}

/** Five split spokes (ten blades), wider at the hub, like the alloy in the owner's logo. */
function splitSpokes(): string {
  const pairs = 5;
  const spread = 10.5;
  const hubRadius = 6.5;
  const rimRadius = 27.6;
  const hubHalf = 2.1;
  const rimHalf = 1.5;
  let path = '';
  for (let i = 0; i < pairs; i += 1) {
    for (const side of [-1, 1]) {
      const centre = (i * 360) / pairs - 90;
      const angle = centre + side * spread;
      const [nx, ny] = polar(1, angle + 90);
      const [hx, hy] = polar(hubRadius, centre + side * spread * 1.9);
      const [rx, ry] = polar(rimRadius, angle);
      path +=
        `M${round(hx - nx * hubHalf)} ${round(hy - ny * hubHalf)}` +
        `L${round(rx - nx * rimHalf)} ${round(ry - ny * rimHalf)}` +
        `L${round(rx + nx * rimHalf)} ${round(ry + ny * rimHalf)}` +
        `L${round(hx + nx * hubHalf)} ${round(hy + ny * hubHalf)}Z`;
    }
  }
  return path;
}

const BODY = treadEdge() + circle(34.6, false);
const GROOVE = circle(41.4);
const RIM_LIP = circle(33) + circle(27.2, false);
const SPOKES = splitSpokes();
const HUB = circle(8.2) + circle(2.6, false);

export interface TyreGlyphProps {
  /** Colour of the shoulder groove. Defaults to the page behind, which follows the theme and the plane. */
  cut?: string;
}

/**
 * The tyre as SVG shapes with no wrapper: place it inside an <svg> whose viewBox is
 * "-50 -50 100 100", or inside a <g> that moves and scales it. Ink is currentColor.
 */
export function TyreGlyph({ cut = 'var(--page)' }: TyreGlyphProps) {
  return (
    <>
      <path fill="currentColor" fillRule="evenodd" d={BODY} />
      <path fill="none" stroke={cut} strokeWidth={1.1} d={GROOVE} />
      <path fill="currentColor" fillRule="evenodd" d={RIM_LIP} />
      <path fill="currentColor" d={SPOKES} />
      <path fill="currentColor" fillRule="evenodd" d={HUB} />
    </>
  );
}
