import { cn } from '@/lib/cn';

const COLS = 6;
const ROWS = 4;
const CELL = 8;

/**
 * The chequered flag: drawn once, on the order-placed screen and nowhere else.
 * Ink squares in currentColor with the ground showing through, on a short pole.
 * The flag waves with a skew so it reads as cloth, not a border pattern.
 */
export function ChequeredFlag({ className }: { className?: string }) {
  const squares = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if ((row + col) % 2 === 0) squares.push(<rect key={`${row}-${col}`} x={col * CELL} y={row * CELL} width={CELL} height={CELL} />);
    }
  }
  const width = COLS * CELL;
  const height = ROWS * CELL;
  return (
    <svg
      aria-hidden
      viewBox={`-6 -8 ${width + 10} ${height + 32}`}
      className={cn('h-auto w-16 shrink-0 print-exact', className)}
      fill="currentColor"
    >
      <rect x={-4} y={-1} width={3} height={height + 25} rx={1} />
      <g transform="skewY(-6)">
        <rect x={0} y={0} width={width} height={height} fill="none" stroke="currentColor" strokeWidth={1.5} />
        {squares}
      </g>
    </svg>
  );
}
