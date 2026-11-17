import { cn } from '@/lib/cn';

/** Confetti pieces: angle (deg), distance (px), colour class, size, delay (ms). */
const BURST: { a: number; d: number; c: string; s: string; w: number }[] = [
  { a: -90, d: 78, c: 'bg-brand', s: 'size-2.5 rounded-sm', w: 0 },
  { a: -60, d: 92, c: 'bg-fit', s: 'size-2 rounded-full', w: 40 },
  { a: -30, d: 80, c: 'bg-ink', s: 'h-1.5 w-3 rounded-full', w: 20 },
  { a: 0, d: 96, c: 'bg-brand', s: 'size-2 rounded-full', w: 60 },
  { a: 30, d: 82, c: 'bg-fit', s: 'size-2.5 rounded-sm', w: 10 },
  { a: 60, d: 94, c: 'bg-brand', s: 'h-1.5 w-3 rounded-full', w: 50 },
  { a: 90, d: 76, c: 'bg-ink', s: 'size-2 rounded-full', w: 30 },
  { a: 120, d: 90, c: 'bg-fit', s: 'h-1.5 w-3 rounded-full', w: 0 },
  { a: 150, d: 84, c: 'bg-brand', s: 'size-2 rounded-sm', w: 45 },
  { a: 180, d: 96, c: 'bg-ink', s: 'size-2.5 rounded-full', w: 15 },
  { a: 210, d: 80, c: 'bg-fit', s: 'size-2 rounded-full', w: 55 },
  { a: 240, d: 92, c: 'bg-brand', s: 'h-1.5 w-3 rounded-full', w: 25 },
];

/**
 * The order-placed tick: the ring draws itself, the disc fills and pops, the check is drawn,
 * two ripples run out and a small confetti burst flies off. Plays once; still under reduced motion.
 */
export function SuccessMark({ pending = false, className }: { pending?: boolean; className?: string }) {
  const tone = pending ? 'text-warn' : 'text-fit';
  return (
    <span aria-hidden className={cn('success-mark relative grid size-24 place-items-center', tone, className)}>
      {!pending && (
        <>
          <span className="success-ripple absolute inset-0 rounded-full border-2 border-current" />
          <span className="success-ripple absolute inset-0 rounded-full border-2 border-current [animation-delay:250ms]" />
          {BURST.map((p, i) => (
            <span
              key={i}
              className={cn('success-bit absolute top-1/2 left-1/2', p.c, p.s)}
              style={
                {
                  '--tx': `${Math.cos((p.a * Math.PI) / 180) * p.d}px`,
                  '--ty': `${Math.sin((p.a * Math.PI) / 180) * p.d}px`,
                  '--rot': `${p.a * 2}deg`,
                  animationDelay: `${650 + p.w}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}
      <svg viewBox="0 0 96 96" className="relative size-full overflow-visible">
        <circle className="success-disc fill-current" cx="48" cy="48" r="40" />
        <circle className="success-ring stroke-current" cx="48" cy="48" r="44" fill="none" strokeWidth="3" strokeLinecap="round" />
        {pending ? (
          <g className="success-check stroke-white" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M48 30v19l11 7" pathLength={1} />
          </g>
        ) : (
          <path className="success-check stroke-white" d="M31 49l12 12 23-25" fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        )}
      </svg>
    </span>
  );
}
