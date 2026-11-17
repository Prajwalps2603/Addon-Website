import { useId } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { CarStageProps } from '@/features/buildbay/contract';
import { BUILD_SLOTS, findBuildStyle } from '@/features/buildbay/contract';
import { mix, normalizeHex, paintTones } from './color';
import { archLip, archWell, carGeometry } from './geometry';
import Garage, { GROUND, STAGE_H, STAGE_W } from './Garage';
import { has, materials, sillSpan, partColour, partsOnBody, partsOver, partsUnder, podLenses, roofBarLens } from './Parts';
import type { PartContext } from './Parts';
import { DEFAULT_WHEEL_FINISH, PAINTS } from './styles';
import Wheel from './Wheel';
import type { WheelStyle } from './Wheel';

const WHEEL_STYLES: WheelStyle[] = ['five-spoke', 'multi-spoke', 'mesh', 'split-spoke', 'turbine', 'steelie'];
const BODY_NAMES = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV' } as const;

function clamp(n: unknown, lo: number, hi: number, fallback = 0): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, v));
}

function describe(state: CarStageProps['state'], paint: string, ride: number, step: number, tint: number): string {
  const body = BODY_NAMES[state.bodyType] ?? 'Car';
  const paintName = PAINTS.find((p) => p.hex.toLowerCase() === paint.toLowerCase())?.name ?? `paint ${paint}`;
  const fitted: string[] = [];
  for (const slot of BUILD_SLOTS) {
    const part = state.parts?.[slot];
    if (!part) continue;
    const option = findBuildStyle(slot, part.style);
    if (option && option.bodyTypes.includes(state.bodyType)) fitted.push(option.label.toLowerCase());
  }
  const height = ride < 0 ? 'lowered' : ride > 0 ? 'lifted' : 'at stock height';
  const bits = [
    `${body} in ${paintName}, ${height}`,
    step > 0 ? `wheels ${step} inch${step > 1 ? 'es' : ''} over stock` : '',
    tint > 0 ? `${Math.round(tint)}% window tint` : '',
    fitted.length ? `fitted with ${fitted.join(', ')}` : 'no parts fitted',
    state.night ? 'in the garage at night' : 'in the garage by day',
  ].filter(Boolean);
  return `${bits.join('; ')}.`;
}

/** Moves the body with ride height; eases between heights when animating. */
function BodyMove({ animate, lift, children }: { animate: boolean; lift: number; children: ReactNode }) {
  if (!animate) return <g transform={`translate(0 ${lift})`}>{children}</g>;
  return (
    <motion.g initial={false} animate={{ y: lift }} transition={{ duration: 0.42, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.g>
  );
}

/** The Build Bay stage: a car in a garage bay, drawn entirely from the build state. */
export default function CarStage({ state, className, static: isStatic }: CarStageProps) {
  const reduce = useReducedMotion();
  const animate = !isStatic && !reduce;
  const uid = `cs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const g = carGeometry(state.bodyType);
  const night = Boolean(state.night);
  const paint = normalizeHex(state.paint, '#D5D8DD');
  const tones = paintTones(paint, night);
  const ride = clamp(state.rideHeight, -2, 2);
  const step = Math.round(clamp(state.wheelSize, 0, 2));
  const tint = clamp(state.tint, 0, 60);
  const parts = state.parts ?? {};
  const m = materials(night);

  const lift = -ride * 9;
  const x0 = Math.round((STAGE_W - g.length) / 2);
  const ctx: PartContext = { g, parts, tones, night, uid, animate };

  // Wheels: the rim grows with each inch while the tyre's outer size stays nearly the same.
  const wheelPart = parts.wheels;
  const wheelStyle: WheelStyle = wheelPart && WHEEL_STYLES.includes(wheelPart.style as WheelStyle) ? (wheelPart.style as WheelStyle) : 'stock';
  const finish = wheelStyle === 'stock' ? '#b9bdc3' : normalizeHex(wheelPart?.color, DEFAULT_WHEEL_FINISH);
  const tyreR = g.wheelR + step * 0.8;
  const rimR = g.wheelR * 0.6 + step * 4.6;
  // Aftermarket wheels show a Tread Red caliper (the brand red); stock wheels keep a plain dark one.
  const caliper = wheelStyle === 'stock' ? '#3a3d43' : '#d71920';
  const spinKey = `${wheelStyle}-${finish}-${step}`;

  // Glass: clear is a cool grey with the cabin showing; tint takes it towards black.
  const tintT = tint / 60;
  const glassBase = night ? mix('#1a212b', '#040506', 0.3 + tintT * 0.6) : mix('#4f5d6b', '#08090b', 0.18 + tintT * 0.74);
  const glassTop = mix(glassBase, '#ffffff', night ? 0.06 : 0.22 - tintT * 0.1);
  const streak = night ? 0.05 : 0.2 - tintT * 0.1;

  const shade = g.shadeY;
  const span = shade.bottom - shade.roof;
  const at = (y: number) => Math.min(1, Math.max(0, (y - shade.roof) / span));

  const glow = parts.underglow && has(ctx, 'underglow') ? partColour(ctx, 'underglow') : null;
  const lightBar = has(ctx, 'lightBar');
  const toStage = (p: { x: number; y: number }, body = true) => ({ x: x0 + p.x, y: GROUND + p.y + (body ? lift : 0) });
  const head = toStage(g.headlampAt);
  const tail = toStage(g.taillampAt);

  const shadowOpacity = night ? 0.7 : 0.38 - ride * 0.05;
  const centre = x0 + (g.rearX + g.frontX) / 2;

  const lips = [g.rearX, g.frontX];
  const sill = sillSpan(g);
  const vTop = g.sillY - (g.cladding ? 46 : 34);
  const vx = g.rearLower.x - 6;
  const valance = `M ${vx} ${vTop} L ${sill[0] - 22} ${vTop + 2} C ${sill[0] - 10} ${vTop + 6} ${sill[0] - 2} ${g.sillY - 14} ${sill[0] - 1} ${g.sillY + 2} L ${vx} ${g.sillY + 2} Z`;

  const car = (
    <g>
      <g transform={`translate(${x0} ${GROUND})`}>
        <BodyMove animate={animate} lift={lift}>
          {lips.map((cx) => (
            <path key={cx} d={archWell(g, cx)} fill={night ? '#050608' : '#0d0e11'} />
          ))}
          {partsUnder(ctx)}
        </BodyMove>
      </g>
      <g transform={`translate(${x0} ${GROUND})`}>
        {lips.map((cx) => (
          <Wheel
            key={cx}
            cx={cx}
            cy={-tyreR}
            r={tyreR}
            rimR={rimR}
            style={wheelStyle}
            finish={finish}
            caliper={caliper}
            night={night}
            uid={uid}
            spinKey={spinKey}
            animate={animate}
          />
        ))}
      </g>
      <g transform={`translate(${x0} ${GROUND})`}>
        <BodyMove animate={animate} lift={lift}>
          <path d={g.body} fill={`url(#${uid}-paint)`} />
          {/* lower sill in black, arch to arch */}
          <path d={`M ${sill[0] - 2} ${g.sillY - (g.cladding ? 8 : 3)} L ${sill[1] + 2} ${g.sillY - (g.cladding ? 8 : 3)}`} stroke={m.black} strokeWidth={g.cladding ? 16 : 6} />
          {/* cabin */}
          {g.glass.map((d, i) => (
            <path key={i} d={d} fill={`url(#${uid}-glass)`} stroke={night ? '#050608' : '#1b1d21'} strokeWidth={2} strokeLinejoin="round" />
          ))}
          <g clipPath={`url(#${uid}-glassclip)`}>
            <path d={`M ${g.aPillarTop.x - 10} ${g.roof.y} L ${g.aPillarTop.x + 40} ${g.roof.y} L ${g.aPillarBase.x - 60} ${g.belt.y2 - 40} L ${g.aPillarBase.x - 110} ${g.belt.y2 - 40} Z`} fill="#ffffff" opacity={streak} />
            <path d={`M ${g.roof.x1 + 40} ${g.roof.y} L ${g.roof.x1 + 64} ${g.roof.y} L ${g.roof.x1 + 4} ${g.belt.y1 - 10} L ${g.roof.x1 - 20} ${g.belt.y1 - 10} Z`} fill="#ffffff" opacity={streak * 0.7} />
          </g>
          {/* panel lines and creases */}
          {g.shutLines.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={tones.edge} strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />
          ))}
          <path d={g.shoulder} fill="none" stroke={tones.highlight} strokeWidth={1.6} strokeLinecap="round" transform="translate(0 -1)" clipPath={`url(#${uid}-bodyclip)`} />
          <path d={g.shoulder} fill="none" stroke={tones.shade} strokeWidth={1.4} strokeLinecap="round" transform="translate(0 2)" clipPath={`url(#${uid}-bodyclip)`} />
          <path d={g.lowerCrease} fill="none" stroke={tones.light} strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
          {partsOnBody(ctx)}
          {/* arches: plastic cladding on the SUV, a painted lip on the others */}
          {lips.map((cx) =>
            g.cladding ? (
              <path key={cx} d={archLip(g, cx, 5)} fill="none" stroke={m.black} strokeWidth={11} />
            ) : (
              <g key={cx}>
                <path d={archLip(g, cx, 0.5)} fill="none" stroke={tones.edge} strokeWidth={1.6} />
                <path d={archLip(g, cx, 3)} fill="none" stroke={tones.light} strokeWidth={1.4} opacity={0.7} />
              </g>
            ),
          )}
          {/* bumpers */}
          <path d={g.grille} fill={night ? '#050608' : '#15171a'} />
          <path d={valance} fill={m.black} opacity={0.92} clipPath={`url(#${uid}-bodyclip)`} />
          {/* lamps */}
          <path d={g.headlamp} fill={night ? '#fff8df' : '#dce2e9'} stroke={night ? '#8a8270' : '#4d525a'} strokeWidth={1.2} strokeLinejoin="round" />
          <circle cx={g.headlampAt.x - 18} cy={g.headlampAt.y - 5} r={5} fill={night ? '#ffffff' : '#9aa2ac'} stroke={night ? '#d8cfb4' : '#5b6068'} strokeWidth={1} />
          <path d={`M ${g.headlampAt.x - 46} ${g.headlampAt.y - 15} L ${g.headlampAt.x - 28} ${g.headlampAt.y - 10}`} stroke={night ? '#ffffff' : '#f7f9fb'} strokeWidth={2} strokeLinecap="round" />
          <path d={g.taillamp} fill={night ? '#ff3b3b' : '#a5161f'} stroke={night ? '#7a1010' : '#4f080c'} strokeWidth={1.2} strokeLinejoin="round" />
          {/* mirror, handles, fuel flap */}
          <path d={g.mirror} fill={tones.base} stroke={tones.edge} strokeWidth={1.2} />
          {g.handles.map((h) => (
            <rect key={h.x} x={h.x - 13} y={h.y - 3} width={26} height={6} rx={3} fill={tones.shade} stroke={tones.edge} strokeWidth={0.8} />
          ))}
          <rect x={g.fuelFlap.x - 10} y={g.fuelFlap.y - 9} width={20} height={18} rx={5} fill="none" stroke={tones.edge} strokeWidth={1} opacity={0.7} />
          {g.roofRails && (
            <g>
              <path d={`M ${g.roof.x1 - 6} ${g.roof.y - 7} L ${g.roof.x2 - 10} ${g.roof.y - 7}`} stroke={m.black} strokeWidth={5} strokeLinecap="round" />
              <path d={`M ${g.roof.x1} ${g.roof.y + 1} L ${g.roof.x1 + 6} ${g.roof.y - 7} M ${g.roof.x2 - 16} ${g.roof.y + 1} L ${g.roof.x2 - 20} ${g.roof.y - 7}`} stroke={m.black} strokeWidth={6} />
            </g>
          )}
          {partsOver(ctx)}
        </BodyMove>
      </g>
    </g>
  );

  const pods = lightBar === 'bumper-pods' ? podLenses(g).map((p) => toStage(p)) : [];
  const bar = lightBar === 'roof-bar' ? toStage(roofBarLens(g)) : null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <title id={`${uid}-title`}>{`${BODY_NAMES[state.bodyType] ?? 'Car'} build preview`}</title>
      <desc id={`${uid}-desc`}>{describe(state, paint, ride, step, tint)}</desc>
      <defs>
        <linearGradient id={`${uid}-paint`} gradientUnits="userSpaceOnUse" x1="0" y1={shade.roof} x2="0" y2={shade.bottom}>
          <stop offset="0" stopColor={tones.light} />
          <stop offset={at(shade.belt)} stopColor={tones.base} />
          <stop offset={at(shade.shoulder) - 0.02} stopColor={tones.highlight} />
          <stop offset={at(shade.shoulder) + 0.012} stopColor={tones.base} />
          <stop offset={at(shade.crease)} stopColor={tones.shade} />
          <stop offset="1" stopColor={tones.deep} />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} gradientUnits="userSpaceOnUse" x1="0" y1={g.roof.y} x2="0" y2={g.belt.y1}>
          <stop offset="0" stopColor={glassTop} />
          <stop offset="1" stopColor={glassBase} />
        </linearGradient>
        <linearGradient id={`${uid}-chrome`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#6a6f77' : '#f2f4f6'} />
          <stop offset="0.5" stopColor={night ? '#3a3e45' : '#a9adb3'} />
          <stop offset="1" stopColor={night ? '#1d2025' : '#5d6168'} />
        </linearGradient>
        <radialGradient id={`${uid}-rimsheen`} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity={night ? 0.08 : 0.28} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity={night ? 0.35 : 0.28} />
        </radialGradient>
        <clipPath id={`${uid}-bodyclip`}>
          <path d={g.body} />
        </clipPath>
        <clipPath id={`${uid}-glassclip`}>
          {g.glass.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
        <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${uid}-blur-lg`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={`${uid}-blur-sm`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        <linearGradient id={`${uid}-reflectfade`} x1="0" y1={GROUND} x2="0" y2={STAGE_H} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity={night ? 0.32 : 0.2} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${uid}-reflectmask`} maskUnits="userSpaceOnUse" x="0" y={GROUND} width={STAGE_W} height={STAGE_H - GROUND}>
          <rect x="0" y={GROUND} width={STAGE_W} height={STAGE_H - GROUND} fill={`url(#${uid}-reflectfade)`} />
        </mask>
        <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3cc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff3cc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-pool`}>
          <stop offset="0" stopColor="#fff1c2" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff1c2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-tailpool`}>
          <stop offset="0" stopColor="#ff2a2a" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff2a2a" stopOpacity="0" />
        </radialGradient>
        {glow && (
          <radialGradient id={`${uid}-glowpool`}>
            <stop offset="0" stopColor={glow} stopOpacity="0.75" />
            <stop offset="0.6" stopColor={glow} stopOpacity="0.25" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>

      <Garage night={night} uid={uid} />

      {/* floor reflection */}
      <g mask={`url(#${uid}-reflectmask)`}>
        <g transform={`translate(0 ${GROUND * 2}) scale(1 -1)`}>{car}</g>
      </g>

      {/* underglow pool on the floor */}
      {night && glow && (
        <ellipse cx={centre} cy={GROUND + 10} rx={(g.frontX - g.rearX) * 0.66} ry={30 - ride * 3} fill={`url(#${uid}-glowpool)`} />
      )}

      {/* contact shadow */}
      <ellipse cx={centre} cy={GROUND + 2} rx={g.length * 0.46 + ride * 4} ry={9 + Math.max(0, ride) * 2} fill="#000000" opacity={shadowOpacity} filter={`url(#${uid}-blur)`} />
      {[g.rearX, g.frontX].map((cx) => (
        <ellipse key={cx} cx={x0 + cx} cy={GROUND + 1} rx={tyreR * 0.85} ry={4} fill="#000000" opacity={night ? 0.8 : 0.55} filter={`url(#${uid}-blur-sm)`} />
      ))}

      {night && (
        <g>
          {/* head beams on the floor and tail glow behind */}
          <path d={`M ${head.x - 4} ${head.y - 4} L ${STAGE_W + 20} ${head.y - 24} L ${STAGE_W + 20} ${GROUND + 80} L ${head.x} ${head.y + 8} Z`} fill={`url(#${uid}-beam)`} opacity={0.6} />
          <ellipse cx={Math.min(head.x + 170, STAGE_W - 60)} cy={GROUND + 28} rx={190} ry={30} fill={`url(#${uid}-pool)`} />
          <ellipse cx={Math.max(tail.x - 50, 60)} cy={GROUND + 16} rx={110} ry={16} fill={`url(#${uid}-tailpool)`} />
        </g>
      )}

      {car}

      {night && (
        <g style={{ pointerEvents: 'none' }}>
          <ellipse cx={head.x - 6} cy={head.y} rx={22} ry={12} fill="#fff4d0" opacity={0.85} filter={`url(#${uid}-blur)`} />
          <ellipse cx={head.x - 4} cy={head.y} rx={6} ry={4} fill="#ffffff" />
          <ellipse cx={tail.x + 6} cy={tail.y} rx={16} ry={14} fill="#ff2a2a" opacity={0.7} filter={`url(#${uid}-blur)`} />
          {glow && (
            <path
              d={`M ${x0 + g.rearX + g.archR} ${GROUND + g.sillY + lift + 4} L ${x0 + g.frontX - g.archR} ${GROUND + g.sillY + lift + 4}`}
              stroke={glow}
              strokeWidth={10}
              strokeLinecap="round"
              opacity={0.75}
              filter={`url(#${uid}-blur)`}
            />
          )}
          {bar && (
            <g>
              <path d={`M ${bar.x} ${bar.y - 6} L ${STAGE_W + 20} ${bar.y + 6} L ${STAGE_W + 20} ${bar.y + 150} L ${bar.x} ${bar.y + 6} Z`} fill={`url(#${uid}-beam)`} opacity={0.5} />
              <ellipse cx={bar.x + 2} cy={bar.y} rx={10} ry={14} fill="#f4f8ff" opacity={0.9} filter={`url(#${uid}-blur)`} />
            </g>
          )}
          {pods.map((p, i) => (
            <ellipse key={i} cx={p.x + 2} cy={p.y} rx={13} ry={11} fill="#f4f8ff" opacity={0.85} filter={`url(#${uid}-blur)`} />
          ))}
        </g>
      )}
    </svg>
  );
}
