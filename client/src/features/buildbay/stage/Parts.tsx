import type { ReactNode } from 'react';
import type { BuildPart, BuildSlot } from '@/types/api';
import Appear from './Appear';
import { mix } from './color';
import type { PaintTones } from './color';
import type { CarGeometry } from './geometry';
import { DEFAULT_GLOW } from './styles';

const NIGHT = '#0b0e16';

export interface PartContext {
  g: CarGeometry;
  parts: Partial<Record<BuildSlot, BuildPart>>;
  tones: PaintTones;
  night: boolean;
  uid: string;
  animate: boolean;
}

interface Materials {
  black: string;
  blackEdge: string;
  steel: string;
  steelLight: string;
  chrome: string;
  chromeDark: string;
  lens: string;
}

export function materials(night: boolean): Materials {
  return night
    ? { black: '#0c0e12', blackEdge: '#262a31', steel: '#1c1f24', steelLight: '#3a3f47', chrome: '#5b6068', chromeDark: '#25282e', lens: '#fffdf2' }
    : { black: '#18191c', blackEdge: '#3d4047', steel: '#2b2e33', steelLight: '#8a8f97', chrome: '#d3d6db', chromeDark: '#6a6e75', lens: '#e8edf2' };
}

function f(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** True when a part of this slot is fitted and suits the body type. */
export function has(ctx: PartContext, slot: BuildSlot, ...styles: string[]): string | null {
  const part = ctx.parts[slot];
  if (!part || !part.style) return null;
  if (styles.length && !styles.includes(part.style)) return null;
  const suv = ctx.g.type === 'suv';
  if ((slot === 'bullBar' || slot === 'sideStep' || slot === 'snorkel') && !suv) return null;
  if (slot === 'spoiler' && part.style === 'roof' && ctx.g.type === 'sedan') return null;
  return part.style;
}

function keyOf(ctx: PartContext, slot: BuildSlot): string {
  const part = ctx.parts[slot];
  return `${slot}-${part?.style ?? ''}-${part?.color ?? ''}`;
}

export function partColour(ctx: PartContext, slot: BuildSlot): string {
  const c = ctx.parts[slot]?.color;
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_GLOW;
}

// ---------------------------------------------------------------------------
// Spoilers
// ---------------------------------------------------------------------------

function Spoiler({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, tones, night } = ctx;
  const m = materials(night);
  const edge = tones.edge;
  const boot = g.type === 'sedan';
  if (style === 'lip') {
    const { x, y } = g.deck;
    const d = boot
      ? `M ${x + 64} ${y - 1} C ${x + 34} ${y - 2} ${x + 10} ${y - 5} ${x - 6} ${y - 11} L ${x - 5} ${y - 4} C ${x + 6} ${y + 1} ${x + 34} ${y + 2} ${x + 64} ${y + 2} Z`
      : `M ${x + 40} ${y - 2} C ${x + 18} ${y - 3} ${x} ${y - 2} ${x - 16} ${y + 2} L ${x - 15} ${y + 7} C ${x} ${y + 5} ${x + 18} ${y + 4} ${x + 40} ${y + 3} Z`;
    return <path d={d} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} strokeLinejoin="round" />;
  }
  if (style === 'ducktail') {
    const { x, y } = g.deck;
    const d = boot
      ? `M ${x + 96} ${y - 1} C ${x + 50} ${y - 4} ${x + 12} ${y - 12} ${x - 12} ${y - 24} L ${x - 13} ${y - 17} C ${x - 9} ${y - 7} ${x - 4} ${y + 2} ${x + 6} ${y + 4} L ${x + 96} ${y + 4} Z`
      : `M ${x + 52} ${y - 2} C ${x + 22} ${y - 4} ${x - 6} ${y - 8} ${x - 28} ${y - 15} L ${x - 27} ${y - 6} C ${x - 18} ${y + 3} ${x - 4} ${y + 8} ${x + 18} ${y + 7} L ${x + 52} ${y + 4} Z`;
    return (
      <g>
        <path d={d} fill={tones.base} stroke={edge} strokeWidth={1} strokeLinejoin="round" />
        <path d={boot ? `M ${x + 90} ${y - 1} C ${x + 50} ${y - 4} ${x + 12} ${y - 12} ${x - 11} ${y - 23}` : `M ${x + 48} ${y - 2} C ${x + 22} ${y - 4} ${x - 6} ${y - 8} ${x - 27} ${y - 14}`} fill="none" stroke={tones.highlight} strokeWidth={1.4} strokeLinecap="round" />
      </g>
    );
  }
  if (style === 'roof') {
    const { x, y } = g.roofEnd;
    const d = `M ${x + 46} ${y - 1} C ${x + 12} ${y - 4} ${x - 20} ${y - 3} ${x - 42} ${y + 4} L ${x - 44} ${y + 14} C ${x - 30} ${y + 15} ${x - 10} ${y + 12} ${x + 12} ${y + 8} L ${x + 46} ${y + 4} Z`;
    return (
      <g>
        <path d={d} fill={tones.base} stroke={edge} strokeWidth={1} strokeLinejoin="round" />
        <path d={`M ${x - 44} ${y + 14} C ${x - 30} ${y + 15} ${x - 10} ${y + 12} ${x + 12} ${y + 8}`} fill="none" stroke={m.black} strokeWidth={3} strokeLinecap="round" />
        <path d={`M ${x + 40} ${y - 1} C ${x + 12} ${y - 4} ${x - 20} ${y - 3} ${x - 40} ${y + 4}`} fill="none" stroke={tones.highlight} strokeWidth={1.4} strokeLinecap="round" />
      </g>
    );
  }
  if (style === 'gt-wing') {
    const { x, y } = g.wingMount;
    const rise = boot ? 56 : 36;
    const chord = boot ? 128 : 108;
    const cx = x - 16;
    const cy = y - rise;
    const le = cx + chord / 2;
    const te = cx - chord / 2;
    const foil = `M ${le} ${cy} C ${le} ${cy - 7} ${cx + 10} ${cy - 9} ${te} ${cy - 7} L ${te} ${cy - 2} C ${cx} ${cy + 1} ${le - 14} ${cy + 5} ${le} ${cy} Z`;
    const plate = `M ${te - 5} ${cy - 18} L ${te + 38} ${cy - 15} L ${te + 38} ${cy + 7} L ${te - 5} ${cy + 9} Z`;
    return (
      <g>
        {/* swan-neck upright */}
        <path d={`M ${x - 4} ${y + 2} L ${x + 4} ${cy - 2} L ${x + 14} ${cy - 3} L ${x + 8} ${y + 2} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} strokeLinejoin="round" />
        <path d={foil} fill={m.black} stroke={m.blackEdge} strokeWidth={1} strokeLinejoin="round" />
        <path d={`M ${le - 4} ${cy - 4} C ${cx + 10} ${cy - 8} ${te + 20} ${cy - 7} ${te + 4} ${cy - 6}`} fill="none" stroke={night ? '#3c4048' : '#6a6f78'} strokeWidth={1.2} strokeLinecap="round" />
        <path d={plate} fill={m.steel} stroke={m.blackEdge} strokeWidth={1} strokeLinejoin="round" />
        <path d={`M ${te - 3} ${cy - 15} L ${te + 36} ${cy - 12.5}`} stroke={night ? '#3c4048' : '#6a6f78'} strokeWidth={1} strokeLinecap="round" />
      </g>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aero below the bumpers and sills
// ---------------------------------------------------------------------------

function Splitter({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, night } = ctx;
  const m = materials(night);
  const y = g.sillY;
  const start = g.frontLowerStart - 6;
  if (style === 'race') {
    const tip = g.noseX + 24;
    return (
      <g>
        <path d={`M ${start} ${y - 3} L ${tip - 4} ${y - 3} L ${tip} ${y + 1} L ${tip - 2} ${y + 5} L ${start} ${y + 5} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} />
        <path d={`M ${tip - 8} ${y - 2} L ${g.noseX - 2} ${y - 26}`} stroke={m.steelLight} strokeWidth={1.6} strokeLinecap="round" />
        <path d={`M ${g.noseX - 6} ${y - 36} L ${g.noseX + 14} ${y - 30} L ${g.noseX - 4} ${y - 26} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} />
      </g>
    );
  }
  const tip = g.noseX + 9;
  return <path d={`M ${start} ${y - 2} L ${tip - 2} ${y - 2} L ${tip} ${y + 1} L ${tip - 3} ${y + 3} L ${start} ${y + 3} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} />;
}

export function sillSpan(g: CarGeometry): [number, number] {
  const dy = g.sillY + g.wheelR;
  const dx = Math.sqrt(Math.max(0, g.archR * g.archR - dy * dy));
  return [g.rearX + dx, g.frontX - dx];
}

function Skirts({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const m = materials(night);
  const [a, b] = sillSpan(g);
  const y = g.sillY;
  return (
    <g>
      <path d={`M ${f(a + 2)} ${y - 9} L ${f(b - 2)} ${y - 9} L ${f(b - 6)} ${y + 6} L ${f(a + 6)} ${y + 6} Z`} fill={m.black} />
      <path d={`M ${f(a + 4)} ${y - 8} L ${f(b - 4)} ${y - 8}`} stroke={m.blackEdge} strokeWidth={1.4} />
      <path d={`M ${f(a + 8)} ${y + 5} L ${f(b - 8)} ${y + 5}`} stroke={night ? '#000' : '#000'} strokeOpacity={0.5} strokeWidth={1} />
    </g>
  );
}

function Diffuser({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const m = materials(night);
  const y = g.sillY;
  const [rearArch] = [g.rearX - Math.sqrt(Math.max(0, g.archR * g.archR - (g.sillY + g.wheelR) ** 2))];
  const x0 = g.rearLower.x - 4;
  const x1 = rearArch - 2;
  return (
    <g>
      <path d={`M ${f(x0)} ${y - 3} L ${f(x1)} ${y - 3} L ${f(x1)} ${y + 3} L ${f(x0 + 6)} ${y + 3} Z`} fill={m.black} />
      <path d={`M ${f(x1)} ${y + 2} L ${f(x0 + 2)} ${y - 4} L ${f(x0 - 2)} ${y + 2} L ${f(x1 - 10)} ${y + 7} Z`} fill={m.steel} stroke={m.blackEdge} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M ${f(x1 - 4)} ${y + 6} L ${f(x0 + 2)} ${y + 1}`} stroke={m.steelLight} strokeWidth={0.8} strokeOpacity={0.6} />
    </g>
  );
}

function Exhaust({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, night, uid } = ctx;
  const m = materials(night);
  const x = g.rearLower.x - 5;
  const y = g.sillY - 6;
  const grid: [number, number][] =
    style === 'quad'
      ? [[9, -10], [0, -10], [9, 0], [0, 0]]
      : style === 'twin'
        ? [[10, -1], [0, 0]]
        : [[0, 0]];
  const r = style === 'single' ? 6.5 : 5;
  return (
    <g>
      {grid.map(([dx, dy], i) => (
        <g key={i}>
          <rect x={x + dx} y={y + dy - r} width={14} height={r * 2} rx={1.5} fill={`url(#${uid}-chrome)`} />
          <ellipse cx={x + dx} cy={y + dy} rx={r * 0.55} ry={r} fill={m.chrome} />
          <ellipse cx={x + dx} cy={y + dy} rx={r * 0.38} ry={r * 0.72} fill={night ? '#050506' : '#101114'} />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Roof
// ---------------------------------------------------------------------------

function RackFoot({ x, y, m }: { x: number; y: number; m: Materials }) {
  return (
    <g>
      <path d={`M ${x - 11} ${y + 1} L ${x - 6} ${y - 12} L ${x + 8} ${y - 12} L ${x + 12} ${y + 1} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={0.8} strokeLinejoin="round" />
      <path d={`M ${x - 14} ${y - 15} C ${x - 14} ${y - 20} ${x + 14} ${y - 21} ${x + 16} ${y - 16} C ${x + 14} ${y - 11} ${x - 12} ${y - 10} ${x - 14} ${y - 15} Z`} fill={m.steel} stroke={m.blackEdge} strokeWidth={0.8} />
      <path d={`M ${x - 10} ${y - 18} L ${x + 10} ${y - 18}`} stroke={m.steelLight} strokeWidth={1} strokeLinecap="round" />
    </g>
  );
}

function RoofRack({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, night } = ctx;
  const m = materials(night);
  const [a, b] = g.rackFeet;
  const top = Math.min(a.y, b.y) - 18;
  const feet = (
    <>
      <RackFoot x={a.x} y={a.y} m={m} />
      <RackFoot x={b.x} y={b.y} m={m} />
    </>
  );
  if (style === 'basket') {
    const x1 = a.x - 34;
    const x2 = b.x + 30;
    const yb = top - 2;
    const h = 22;
    const bars: number[] = [];
    for (let x = x1 + 14; x < x2 - 6; x += 14) bars.push(x);
    return (
      <g>
        {feet}
        <path d={`M ${x1 + 6} ${yb} L ${x2 - 6} ${yb}`} stroke={m.black} strokeWidth={4} strokeLinecap="round" />
        {bars.map((x) => (
          <path key={x} d={`M ${x} ${yb} L ${x} ${yb - h + 4}`} stroke={m.black} strokeWidth={2} />
        ))}
        <path d={`M ${x1} ${yb - h + 10} C ${x1} ${yb - h} ${x1 + 4} ${yb - h} ${x1 + 14} ${yb - h} L ${x2 - 10} ${yb - h} C ${x2} ${yb - h} ${x2 + 2} ${yb - h + 6} ${x2 - 4} ${yb - 2}`} fill="none" stroke={m.black} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${x1 + 14} ${yb - h - 1.5} L ${x2 - 10} ${yb - h - 1.5}`} stroke={m.steelLight} strokeWidth={1} strokeOpacity={0.6} />
      </g>
    );
  }
  if (style === 'box') {
    const x1 = a.x - 58;
    const x2 = b.x + 44;
    const yb = top + 1;
    const h = 38;
    return (
      <g>
        {feet}
        <path
          d={`M ${x1 + 6} ${yb} L ${x2 - 14} ${yb} C ${x2 + 6} ${yb} ${x2 + 10} ${yb - 12} ${x2 - 8} ${yb - h * 0.62} C ${x2 - 40} ${yb - h} ${x1 + 60} ${yb - h - 2} ${x1 + 14} ${yb - h + 6} C ${x1 - 6} ${yb - h + 10} ${x1 - 6} ${yb - 4} ${x1 + 6} ${yb} Z`}
          fill={night ? '#121418' : '#202226'}
          stroke={m.blackEdge}
          strokeWidth={1}
        />
        <path d={`M ${x1 + 16} ${yb - h + 7} C ${x1 + 60} ${yb - h - 1} ${x2 - 40} ${yb - h + 1} ${x2 - 10} ${yb - h * 0.6}`} fill="none" stroke={night ? '#3a3e46' : '#6a6f78'} strokeWidth={1.6} strokeLinecap="round" />
        <path d={`M ${x1 + 4} ${yb - 9} L ${x2 - 4} ${yb - 9}`} stroke="#000" strokeOpacity={0.5} strokeWidth={1} />
      </g>
    );
  }
  return <g>{feet}</g>;
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

export function roofBarLens(g: CarGeometry): { x: number; y: number } {
  return { x: g.lightBarAt.x + 11, y: g.lightBarAt.y - 15 };
}

export function podLenses(g: CarGeometry): { x: number; y: number }[] {
  const y = g.type === 'suv' ? g.sillY - 30 : g.sillY - 14;
  const x = g.type === 'suv' ? g.noseX + 14 : g.noseX - 4;
  return [
    { x, y },
    { x: x - 7, y: y - 1 },
  ];
}

function LightBar({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, night } = ctx;
  const m = materials(night);
  if (style === 'roof-bar') {
    const { x, y } = g.lightBarAt;
    return (
      <g>
        <path d={`M ${x - 6} ${y + 1} L ${x - 2} ${y - 8} L ${x + 4} ${y - 8} L ${x + 6} ${y + 1} Z`} fill={m.black} />
        <rect x={x - 10} y={y - 22} width={22} height={15} rx={2} fill={m.steel} stroke={m.blackEdge} strokeWidth={0.8} />
        <rect x={x + 9} y={y - 21} width={4} height={13} rx={1} fill={m.lens} />
        <path d={`M ${x - 8} ${y - 19} L ${x + 6} ${y - 19}`} stroke={m.steelLight} strokeWidth={0.8} strokeOpacity={0.7} />
      </g>
    );
  }
  const pods = podLenses(g);
  return (
    <g>
      {[...pods].reverse().map((p, i) => (
        <g key={i} opacity={i === 0 ? 0.85 : 1}>
          <rect x={p.x - 13} y={p.y - 7} width={14} height={14} rx={2} fill={m.steel} stroke={m.blackEdge} strokeWidth={0.8} />
          <rect x={p.x - 1} y={p.y - 6} width={3.5} height={12} rx={1} fill={m.lens} />
          <path d={`M ${p.x - 8} ${p.y + 7} L ${p.x - 8} ${p.y + 12}`} stroke={m.black} strokeWidth={3} />
        </g>
      ))}
    </g>
  );
}

function Underglow({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const colour = partColour(ctx, 'underglow');
  const [a, b] = sillSpan(g);
  const y = g.sillY + 3;
  return (
    <g>
      <path d={`M ${f(a + 10)} ${y} L ${f(b - 10)} ${y}`} stroke={night ? colour : mix(colour, '#2b2e33', 0.6)} strokeWidth={night ? 3 : 2.4} strokeLinecap="round" />
      {night && <path d={`M ${f(a + 10)} ${y} L ${f(b - 10)} ${y}`} stroke="#ffffff" strokeOpacity={0.7} strokeWidth={1} strokeLinecap="round" />}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Decals
// ---------------------------------------------------------------------------

function Decal({ ctx, style }: { ctx: PartContext; style: string }) {
  const { g, night, uid } = ctx;
  const raw = partColour(ctx, 'decal');
  const colour = night ? mix(raw, NIGHT, 0.5) : raw;
  if (style === 'stripe') {
    return (
      <g clipPath={`url(#${uid}-bodyclip)`}>
        <path d={g.shoulder} transform="translate(0 12)" fill="none" stroke={colour} strokeWidth={8} />
        <path d={g.shoulder} transform="translate(0 22)" fill="none" stroke={colour} strokeWidth={3} />
      </g>
    );
  }
  const [a, b] = sillSpan(g);
  const yb = g.shadeY.crease + 4;
  const yt = yb - 30;
  const x1 = a + 18;
  const x2 = b - 30;
  const slash = (x: number, w: number) => `M ${x} ${yb} L ${x + w} ${yb} L ${x + w + 20} ${yt} L ${x + 20} ${yt} Z`;
  return (
    <g clipPath={`url(#${uid}-bodyclip)`}>
      <path d={`M ${x1} ${yb} L ${x2 - 120} ${yb} L ${x2 - 100} ${yt} L ${x1 + 50} ${yt} Z`} fill={colour} />
      <path d={slash(x2 - 110, 22)} fill={colour} />
      <path d={slash(x2 - 78, 14)} fill={colour} />
      <path d={slash(x2 - 54, 8)} fill={colour} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// SUV kit
// ---------------------------------------------------------------------------

function BullBar({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const m = materials(night);
  const n = g.noseX;
  const d = `M ${n - 10} ${g.sillY - 4} C ${n + 6} ${g.sillY - 6} ${n + 14} ${g.sillY - 14} ${n + 15} ${g.sillY - 30} L ${n + 16} ${g.noseTop + 34} C ${n + 16} ${g.noseTop + 14} ${n + 8} ${g.noseTop + 4} ${n - 12} ${g.noseTop - 2}`;
  return (
    <g>
      <path d={`M ${n - 2} ${g.noseTop + 30} L ${n + 15} ${g.noseTop + 30}`} stroke={m.black} strokeWidth={5} strokeLinecap="round" />
      <path d={`M ${n - 4} ${g.sillY - 30} L ${n + 15} ${g.sillY - 30}`} stroke={m.black} strokeWidth={5} strokeLinecap="round" />
      <path d={d} fill="none" stroke={m.black} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={m.steelLight} strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" transform="translate(-1.5 -1.5)" />
    </g>
  );
}

function SideStep({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const m = materials(night);
  const [a, b] = sillSpan(g);
  const y = g.sillY + 8;
  return (
    <g>
      <path d={`M ${f(a + 30)} ${g.sillY} L ${f(a + 30)} ${y}`} stroke={m.black} strokeWidth={5} />
      <path d={`M ${f(b - 30)} ${g.sillY} L ${f(b - 30)} ${y}`} stroke={m.black} strokeWidth={5} />
      <rect x={a + 6} y={y - 2} width={b - a - 12} height={9} rx={3} fill={m.steel} stroke={m.blackEdge} strokeWidth={0.8} />
      <path d={`M ${f(a + 10)} ${y - 1} L ${f(b - 10)} ${y - 1}`} stroke={m.steelLight} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

function Snorkel({ ctx }: { ctx: PartContext }) {
  const { g, night } = ctx;
  const m = materials(night);
  const base = g.aPillarBase;
  const top = g.aPillarTop;
  const d = `M ${base.x + 42} ${base.y + 70} C ${base.x + 40} ${base.y + 30} ${base.x + 20} ${base.y + 6} ${base.x + 8} ${base.y - 4} L ${top.x + 16} ${top.y - 8}`;
  return (
    <g>
      <path d={d} fill="none" stroke={m.black} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={m.blackEdge} strokeWidth={1.4} strokeLinecap="round" transform="translate(-3 -2)" />
      <path d={`M ${top.x + 6} ${top.y - 4} L ${top.x + 10} ${top.y - 24} L ${top.x + 40} ${top.y - 24} C ${top.x + 46} ${top.y - 24} ${top.x + 48} ${top.y - 18} ${top.x + 44} ${top.y - 12} L ${top.x + 26} ${top.y + 2} Z`} fill={m.black} stroke={m.blackEdge} strokeWidth={1} strokeLinejoin="round" />
      <path d={`M ${top.x + 38} ${top.y - 21} L ${top.x + 42} ${top.y - 15}`} stroke={m.blackEdge} strokeWidth={1} />
      <path d={`M ${top.x + 34} ${top.y - 21} L ${top.x + 38} ${top.y - 13}`} stroke={m.blackEdge} strokeWidth={1} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

/** Parts that sit behind the wheels (under the car). */
export function partsUnder(ctx: PartContext): ReactNode[] {
  const out: ReactNode[] = [];
  if (has(ctx, 'underglow')) out.push(<Appear key={keyOf(ctx, 'underglow')} animate={ctx.animate} dy={4}><Underglow ctx={ctx} /></Appear>);
  return out;
}

/** Parts painted onto the body, under lamps and trim. */
export function partsOnBody(ctx: PartContext): ReactNode[] {
  const out: ReactNode[] = [];
  const decal = has(ctx, 'decal');
  if (decal) out.push(<Appear key={keyOf(ctx, 'decal')} animate={ctx.animate} dy={0}><Decal ctx={ctx} style={decal} /></Appear>);
  return out;
}

/** Bolt-on parts drawn over the body. */
export function partsOver(ctx: PartContext): ReactNode[] {
  const out: ReactNode[] = [];
  const a = ctx.animate;
  const spoiler = has(ctx, 'spoiler');
  if (spoiler) out.push(<Appear key={keyOf(ctx, 'spoiler')} animate={a}><Spoiler ctx={ctx} style={spoiler} /></Appear>);
  const rack = has(ctx, 'roofRack');
  if (rack) out.push(<Appear key={keyOf(ctx, 'roofRack')} animate={a}><RoofRack ctx={ctx} style={rack} /></Appear>);
  const splitter = has(ctx, 'splitter');
  if (splitter) out.push(<Appear key={keyOf(ctx, 'splitter')} animate={a} dy={6}><Splitter ctx={ctx} style={splitter} /></Appear>);
  if (has(ctx, 'skirts')) out.push(<Appear key={keyOf(ctx, 'skirts')} animate={a} dy={6}><Skirts ctx={ctx} /></Appear>);
  if (has(ctx, 'diffuser')) out.push(<Appear key={keyOf(ctx, 'diffuser')} animate={a} dy={6}><Diffuser ctx={ctx} /></Appear>);
  const exhaust = has(ctx, 'exhaust');
  if (exhaust) out.push(<Appear key={keyOf(ctx, 'exhaust')} animate={a} dy={4}><Exhaust ctx={ctx} style={exhaust} /></Appear>);
  if (has(ctx, 'sideStep')) out.push(<Appear key={keyOf(ctx, 'sideStep')} animate={a} dy={6}><SideStep ctx={ctx} /></Appear>);
  if (has(ctx, 'snorkel')) out.push(<Appear key={keyOf(ctx, 'snorkel')} animate={a}><Snorkel ctx={ctx} /></Appear>);
  if (has(ctx, 'bullBar')) out.push(<Appear key={keyOf(ctx, 'bullBar')} animate={a}><BullBar ctx={ctx} /></Appear>);
  const light = has(ctx, 'lightBar');
  if (light) out.push(<Appear key={keyOf(ctx, 'lightBar')} animate={a}><LightBar ctx={ctx} style={light} /></Appear>);
  return out;
}
