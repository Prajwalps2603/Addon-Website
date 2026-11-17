import { cn } from '@/lib/cn';

export type Compound = 'S' | 'M' | 'H';

export interface CompoundInfo {
  letter: Compound;
  /** The plain-language partner that always travels with the letter. */
  label: string;
  /** One line more, for tooltips and the Straight Label. */
  detail: string;
}

const LEVELS: Record<1 | 2 | 3 | 4 | 5, CompoundInfo> = {
  1: { letter: 'S', label: 'Plug in', detail: 'No tools. A few minutes.' },
  2: { letter: 'S', label: 'Easy DIY', detail: 'Basic hand tools. Under an hour.' },
  3: { letter: 'M', label: 'DIY with tools', detail: 'Tools and patience. An hour or two.' },
  4: { letter: 'H', label: 'Workshop advised', detail: 'Possible at home, better at a workshop.' },
  5: { letter: 'H', label: 'Workshop job', detail: 'Needs a workshop and a trained fitter.' },
};

/*
 * Band colours sit on the black tyre, never on the page, so they are fixed in both themes
 * (each is above 9:1 on the tyre). Green, yellow, orange: no red, so a difficulty band never
 * reads as the brand red or as the "does not fit" danger treatment.
 */
const BAND: Record<Compound, string> = { S: '#35d07f', M: '#ffd500', H: '#ff9a3d' };
const TYRE = '#0c0d0f';
const UNLIT = '#3a3e46';

function clampLevel(difficulty: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, Math.round(difficulty))) as 1 | 2 | 3 | 4 | 5;
}

/** S, M or H with its plain-language label for an install difficulty of 1 to 5. */
export function compoundFor(difficulty: number): CompoundInfo {
  return LEVELS[clampLevel(difficulty)];
}

function arc(radius: number, from: number, to: number): string {
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${(24 + radius * Math.cos(radians)).toFixed(2)} ${(24 + radius * Math.sin(radians)).toFixed(2)}`;
  };
  return `M${point(from)}A${radius} ${radius} 0 0 1 ${point(to)}`;
}

// Five band segments, clockwise from the top, with a gap between each.
const SEGMENTS = [0, 1, 2, 3, 4].map((i) => arc(16.5, -90 + i * 72 + 6, -90 + (i + 1) * 72 - 6));

export interface CompoundRingProps {
  /** Install difficulty, 1 (plug in) to 5 (workshop job). */
  difficulty: number;
  /** Diameter in px. */
  size?: number;
  /** Show the text label beside the ring. Without it the ring carries the same words as its accessible name. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Install difficulty as a tyre compound: S (soft, easy), M (medium), H (hard, workshop).
 * Five band segments light up to the exact level. The letter and the words carry the meaning;
 * colour only repeats it.
 */
export function CompoundRing({ difficulty, size = 36, showLabel = true, className }: CompoundRingProps) {
  const level = clampLevel(difficulty);
  const { letter, label } = LEVELS[level];
  const spoken = `Fitting difficulty ${level} of 5: ${label}`;

  const ring = (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className="shrink-0"
      {...(showLabel ? { 'aria-hidden': true } : { role: 'img', 'aria-label': spoken })}
    >
      <circle cx="24" cy="24" r="23" fill={TYRE} stroke="var(--line-strong)" strokeWidth="1" />
      {SEGMENTS.map((d, i) => (
        <path key={d} d={d} fill="none" stroke={i < level ? BAND[letter] : UNLIT} strokeWidth="4.4" />
      ))}
      <text
        x="24"
        y="24"
        dy="0.36em"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="15"
        fontWeight="800"
      >
        {letter}
      </text>
    </svg>
  );

  if (!showLabel) return <span className={cn('inline-flex', className)}>{ring}</span>;

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {ring}
      <span className="type-small leading-tight font-bold">
        <span className="sr-only">Fitting difficulty {level} of 5: </span>
        {label}
      </span>
    </span>
  );
}
