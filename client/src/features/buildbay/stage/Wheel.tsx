import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { mix } from './color';

export type WheelStyle = 'five-spoke' | 'multi-spoke' | 'mesh' | 'split-spoke' | 'turbine' | 'steelie' | 'stock';

interface WheelProps {
  cx: number;
  cy: number;
  /** Tyre outer radius. */
  r: number;
  /** Rim radius (the visible metal). */
  rimR: number;
  style: WheelStyle;
  finish: string;
  caliper: string;
  night: boolean;
  uid: string;
  /** Changing this spins the wheel once (when animating). */
  spinKey: string;
  animate: boolean;
}

const NIGHT = '#0b0e16';

function f(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function pt(cx: number, cy: number, r: number, deg: number): string {
  const [x, y] = polar(cx, cy, r, deg);
  return `${f(x)} ${f(y)}`;
}

/** A tapered spoke between two radii; widths are in degrees at each end. */
function spoke(cx: number, cy: number, r1: number, r2: number, deg: number, w1: number, w2: number, bend = 0): string {
  const midR = (r1 + r2) / 2;
  return [
    `M ${pt(cx, cy, r1, deg - w1 / 2)}`,
    `Q ${pt(cx, cy, midR, deg - (w1 + w2) / 4 + bend)} ${pt(cx, cy, r2, deg - w2 / 2)}`,
    `A ${f(r2)} ${f(r2)} 0 0 1 ${pt(cx, cy, r2, deg + w2 / 2)}`,
    `Q ${pt(cx, cy, midR, deg + (w1 + w2) / 4 + bend)} ${pt(cx, cy, r1, deg + w1 / 2)}`,
    'Z',
  ].join(' ');
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function Spokes({ cx, cy, rimR, style, metal, metalDark, metalLight }: { cx: number; cy: number; rimR: number; style: WheelStyle; metal: string; metalDark: string; metalLight: string }): ReactNode {
  const inner = rimR - 3.5;
  const hub = rimR * 0.26;
  switch (style) {
    case 'stock':
      // Steel wheel under a plastic cover, as most cars leave the showroom.
      return (
        <g>
          <circle cx={cx} cy={cy} r={inner} fill={metal} />
          <circle cx={cx} cy={cy} r={inner * 0.9} fill="none" stroke={metalDark} strokeWidth={0.8} opacity={0.6} />
          {range(10).map((i) => (
            <path key={i} d={spoke(cx, cy, inner * 0.56, inner * 0.84, i * 36, 16, 20)} fill="#141518" stroke={metalDark} strokeWidth={0.6} />
          ))}
          <circle cx={cx} cy={cy} r={inner * 0.36} fill={metalLight} stroke={metalDark} strokeWidth={0.8} />
        </g>
      );
    case 'five-spoke':
      return range(5).map((i) => {
        const deg = i * 72 + 18;
        return (
          <g key={i}>
            <path d={spoke(cx, cy, hub, inner, deg, 34, 20)} fill={metal} stroke={metalDark} strokeWidth={0.8} />
            <path d={spoke(cx, cy, hub + 2, inner - 2, deg - 4, 6, 4)} fill={metalLight} opacity={0.5} />
          </g>
        );
      });
    case 'multi-spoke':
      return range(10).map((i) => {
        const deg = i * 36;
        return <path key={i} d={spoke(cx, cy, hub, inner, deg, 13, 8)} fill={metal} stroke={metalDark} strokeWidth={0.6} />;
      });
    case 'split-spoke':
      return range(5).map((i) => {
        const deg = i * 72;
        return (
          <g key={i}>
            <path d={spoke(cx, cy, hub, inner, deg - 9, 14, 9, 3)} fill={metal} stroke={metalDark} strokeWidth={0.7} />
            <path d={spoke(cx, cy, hub, inner, deg + 9, 14, 9, -3)} fill={metal} stroke={metalDark} strokeWidth={0.7} />
          </g>
        );
      });
    case 'mesh':
      return (
        <g>
          {range(10).map((i) => {
            const deg = i * 36;
            const [x1, y1] = polar(cx, cy, hub * 0.95, deg);
            const [x2, y2] = polar(cx, cy, inner, deg + 26);
            const [x3, y3] = polar(cx, cy, inner, deg - 26);
            return (
              <g key={i}>
                <path d={`M ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)}`} stroke={metal} strokeWidth={2.4} strokeLinecap="round" />
                <path d={`M ${f(x1)} ${f(y1)} L ${f(x3)} ${f(y3)}`} stroke={metal} strokeWidth={2.4} strokeLinecap="round" />
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={inner * 0.64} fill="none" stroke={metal} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={inner - 1} fill="none" stroke={metalDark} strokeWidth={1.2} />
        </g>
      );
    case 'turbine':
      return range(14).map((i) => {
        const deg = i * (360 / 14);
        const [x1, y1] = polar(cx, cy, hub, deg);
        const [xm, ym] = polar(cx, cy, (hub + inner) / 2, deg + 22);
        const [x2, y2] = polar(cx, cy, inner, deg + 30);
        return (
          <path
            key={i}
            d={`M ${f(x1)} ${f(y1)} Q ${f(xm)} ${f(ym)} ${f(x2)} ${f(y2)}`}
            stroke={metal}
            strokeWidth={4.2}
            strokeLinecap="round"
            fill="none"
          />
        );
      });
    case 'steelie':
      return (
        <g>
          <circle cx={cx} cy={cy} r={inner} fill={metal} />
          <circle cx={cx} cy={cy} r={inner * 0.84} fill="none" stroke={metalDark} strokeWidth={1.4} />
          {range(8).map((i) => {
            const [x, y] = polar(cx, cy, inner * 0.6, i * 45 + 22.5);
            return <ellipse key={i} cx={x} cy={y} rx={rimR * 0.09} ry={rimR * 0.09} fill="#5c6067" stroke={metalDark} strokeWidth={0.8} />;
          })}
          <circle cx={cx} cy={cy} r={inner * 0.42} fill={mix(metal, '#ffffff', 0.15)} stroke={metalDark} strokeWidth={1} />
        </g>
      );
    default:
      return null;
  }
}

export default function Wheel({ cx, cy, r, rimR, style, finish, caliper, night, uid, spinKey, animate }: WheelProps) {
  const metal = night ? mix(finish, NIGHT, 0.45) : finish;
  const metalDark = mix(metal, '#0c0d0f', 0.45);
  const metalLight = mix(metal, '#ffffff', 0.45);
  const tyre = night ? '#0d0e11' : '#18191c';
  const sidewall = night ? '#15171b' : '#232529';
  const discR = rimR * 0.8;
  const caliperFill = night ? mix(caliper, NIGHT, 0.4) : caliper;
  const sideR = (r + rimR) / 2;
  const nuts = style === 'stock' ? 0 : style === 'steelie' ? 4 : 5;

  const spin = (
    <g>
      <Spokes cx={cx} cy={cy} rimR={rimR} style={style} metal={metal} metalDark={metalDark} metalLight={metalLight} />
      {/* rim lip */}
      <circle cx={cx} cy={cy} r={rimR - 1.6} fill="none" stroke={metal} strokeWidth={3.4} />
      <circle cx={cx} cy={cy} r={rimR - 3.6} fill="none" stroke={metalDark} strokeWidth={0.8} opacity={0.8} />
      {/* centre cap and nuts */}
      {style !== 'steelie' && style !== 'stock' && <circle cx={cx} cy={cy} r={rimR * 0.27} fill={metal} stroke={metalDark} strokeWidth={0.8} />}
      {range(nuts).map((i) => {
        const [x, y] = polar(cx, cy, rimR * (style === 'steelie' ? 0.26 : 0.18), (i * 360) / nuts);
        return <circle key={i} cx={x} cy={y} r={rimR * 0.035 + 0.6} fill={metalDark} />;
      })}
      <circle cx={cx} cy={cy} r={rimR * 0.09} fill={metalDark} />
    </g>
  );

  return (
    <g>
      {/* tyre and sidewall */}
      <circle cx={cx} cy={cy} r={r} fill={tyre} />
      <circle cx={cx} cy={cy} r={sideR} fill="none" stroke={sidewall} strokeWidth={(r - rimR) * 0.62} />
      <path
        d={`M ${pt(cx, cy, sideR, -70)} A ${f(sideR)} ${f(sideR)} 0 0 1 ${pt(cx, cy, sideR, 10)}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={night ? 0.04 : 0.09}
        strokeWidth={(r - rimR) * 0.3}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={2} />
      {/* barrel, disc, caliper (do not spin) */}
      <circle cx={cx} cy={cy} r={rimR} fill="#0f1012" />
      <circle cx={cx} cy={cy} r={discR} fill={night ? '#3c3f45' : '#868a91'} />
      <circle cx={cx} cy={cy} r={discR - 2.5} fill="none" stroke={night ? '#2a2c31' : '#6c7077'} strokeWidth={1} strokeDasharray="2 3" />
      <circle cx={cx} cy={cy} r={discR * 0.48} fill={night ? '#2c2e33' : '#5c6067'} />
      <path
        d={`M ${pt(cx, cy, discR * 0.68, 236)} A ${f(discR * 0.68)} ${f(discR * 0.68)} 0 0 1 ${pt(cx, cy, discR * 0.68, 284)} L ${pt(cx, cy, discR + 2, 282)} A ${f(discR + 2)} ${f(discR + 2)} 0 0 0 ${pt(cx, cy, discR + 2, 238)} Z`}
        fill={caliperFill}
        stroke={mix(caliperFill, '#000000', 0.4)}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {animate ? (
        <motion.g key={spinKey} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }} initial={{ rotate: -150 }} animate={{ rotate: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
          {spin}
        </motion.g>
      ) : (
        spin
      )}
      {/* light from above: sheen on the rim, shade below */}
      <circle cx={cx} cy={cy} r={rimR} fill={`url(#${uid}-rimsheen)`} />
    </g>
  );
}
