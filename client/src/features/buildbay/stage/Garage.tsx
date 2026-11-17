/** The garage bay behind the car: back wall, tool board, red and white kerb band, floor with red bay lines. Pure presentation attributes. */

export const STAGE_W = 1200;
export const STAGE_H = 620;
export const GROUND = 500;

interface GarageProps {
  night: boolean;
  uid: string;
}

function Tools({ x, y, ink }: { x: number; y: number; ink: string }) {
  return (
    <g>
      {/* combination spanners, longest to shortest */}
      {[0, 1, 2, 3, 4].map((i) => {
        const sx = x + 22 + i * 16;
        const len = 92 - i * 12;
        return (
          <g key={i}>
            <path d={`M ${sx} ${y + 22} L ${sx} ${y + 22 + len}`} stroke={ink} strokeWidth={5 - i * 0.4} strokeLinecap="round" />
            <path d={`M ${sx - 5} ${y + 14} A 6 6 0 1 1 ${sx + 5} ${y + 14} L ${sx + 2} ${y + 18} L ${sx - 2} ${y + 18} Z`} fill={ink} />
            <circle cx={sx} cy={y + 24 + len} r={5 - i * 0.3} fill="none" stroke={ink} strokeWidth={2.4} />
          </g>
        );
      })}
      {/* screwdrivers */}
      {[0, 1, 2].map((i) => {
        const sx = x + 118 + i * 14;
        return (
          <g key={i}>
            <rect x={sx - 4} y={y + 16} width={8} height={30} rx={3} fill={ink} />
            <path d={`M ${sx} ${y + 46} L ${sx} ${y + 92 - i * 8}`} stroke={ink} strokeWidth={2} strokeLinecap="round" />
          </g>
        );
      })}
      {/* hammer */}
      <path d={`M ${x + 182} ${y + 24} L ${x + 182} ${y + 104}`} stroke={ink} strokeWidth={6} strokeLinecap="round" />
      <path d={`M ${x + 166} ${y + 14} L ${x + 200} ${y + 14} L ${x + 204} ${y + 26} L ${x + 166} ${y + 26} Z`} fill={ink} />
      {/* socket rail */}
      <path d={`M ${x + 18} ${y + 136} L ${x + 206} ${y + 136}`} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={x + 24 + i * 22} y={y + 138} width={10 + i * 0.8} height={14 + i * 1.2} rx={2} fill={ink} />
      ))}
    </g>
  );
}

export default function Garage({ night, uid }: GarageProps) {
  const wallTop = night ? '#14171d' : '#ecedef';
  const wallBottom = night ? '#0f1116' : '#dfe0e3';
  const seam = night ? '#1b1f26' : '#d3d5d9';
  const board = night ? '#161a20' : '#e2e4e7';
  const boardEdge = night ? '#20252d' : '#cdd0d4';
  const peg = night ? '#1d2129' : '#cfd2d6';
  const toolInk = night ? '#242931' : '#9da2a9';
  const skirting = night ? '#0b0c10' : '#a9adb3';
  const floorTop = night ? '#0d0f13' : '#c9cbcf';
  const floorBottom = night ? '#08090c' : '#b5b8bd';
  // Brand accents: the logo's Tread Red (--red, #d71920), dimmed at night. Written as values, not tokens,
  // so the stage SVG still draws when it is saved as a poster without the stylesheet.
  const bayLine = night ? '#5c1418' : '#d71920';
  const kerbRed = night ? '#4e1115' : '#d71920';
  const kerbWhite = night ? '#23262c' : '#f4f5f6';
  const lamp = night ? '#f4f1e4' : '#f7f8f9';

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={wallTop} />
          <stop offset="1" stopColor={wallBottom} />
        </linearGradient>
        <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={floorTop} />
          <stop offset="1" stopColor={floorBottom} />
        </linearGradient>
        <pattern id={`${uid}-hazard`} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="24" height="24" fill={kerbWhite} />
          <rect width="12" height="24" fill={kerbRed} />
        </pattern>
        <pattern id={`${uid}-peg`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="8" cy="8" r="1.6" fill={peg} />
        </pattern>
        <linearGradient id={`${uid}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6dc" stopOpacity={night ? 0.1 : 0} />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* back wall */}
      <rect x="0" y="0" width={STAGE_W} height={GROUND} fill={`url(#${uid}-wall)`} />
      {[240, 480, 720, 960].map((x) => (
        <path key={x} d={`M ${x} 0 L ${x} ${GROUND - 36}`} stroke={seam} strokeWidth={1.5} />
      ))}
      <path d={`M 0 300 L ${STAGE_W} 300`} stroke={seam} strokeWidth={1} />

      {/* tool board */}
      <rect x="64" y="96" width="250" height="186" fill={board} stroke={boardEdge} strokeWidth={2} />
      <rect x="64" y="96" width="250" height="186" fill={`url(#${uid}-peg)`} />
      <Tools x={74} y={108} ink={toolInk} />

      {/* overhead battens and, at night, the light they throw */}
      {night && <path d={`M 320 22 L 880 22 L 1080 ${GROUND} L 120 ${GROUND} Z`} fill={`url(#${uid}-cone)`} />}
      {[340, 640].map((x) => (
        <g key={x}>
          <rect x={x} y="14" width="220" height="9" rx="2" fill={night ? '#2a2d33' : '#c8cbd0'} />
          <rect x={x + 6} y="21" width="208" height="4" rx="2" fill={lamp} opacity={night ? 0.9 : 1} />
        </g>
      ))}

      {/* red and white kerb band, and skirting */}
      <rect x="0" y={GROUND - 30} width={STAGE_W} height="30" fill={skirting} />
      <rect x="0" y={GROUND - 36} width={STAGE_W} height="6" fill={`url(#${uid}-hazard)`} />

      {/* floor */}
      <rect x="0" y={GROUND} width={STAGE_W} height={STAGE_H - GROUND} fill={`url(#${uid}-floor)`} />
      <path d={`M 0 ${GROUND} L ${STAGE_W} ${GROUND}`} stroke={night ? '#000000' : '#0c0d0f'} strokeWidth={2} />
      <path d={`M 104 ${GROUND + 6} L 52 ${STAGE_H}`} stroke={bayLine} strokeWidth={6} />
      <path d={`M 1096 ${GROUND + 6} L 1148 ${STAGE_H}`} stroke={bayLine} strokeWidth={6} />
      <path d={`M 66 ${STAGE_H - 24} L 1134 ${STAGE_H - 24}`} stroke={bayLine} strokeWidth={5} />
    </g>
  );
}
