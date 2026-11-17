import { formatDate, formatINR } from '@/lib/format';
import type { ProductDetail } from '@/types/api';

export interface PriceSparklineProps {
  /** Oldest first, as the API sends it. */
  history: ProductDetail['priceHistory'];
  /** The price today: the line runs on to the right edge at this level. */
  current: number;
}

const W = 320;
const H = 72;
const PAD_Y = 8;

function time(date: string): number {
  const t = Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date);
  return Number.isFinite(t) ? t : 0;
}

/**
 * A step line of every price charged, ending at today's price. Prices hold until they change,
 * so it is drawn in steps, not slopes. Ink only; the dot marks now. A text summary sits beside it
 * for screen readers.
 */
export function PriceSparkline({ history, current }: PriceSparklineProps) {
  const points = history.map((point) => ({ t: time(point.date), price: point.price }));
  const now = Math.max(Date.now(), points[points.length - 1]?.t ?? 0);
  points.push({ t: now, price: current });

  const t0 = points[0].t;
  const span = Math.max(1, now - t0);
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  const x = (t: number) => ((t - t0) / span) * W;
  const y = (price: number) => (range === 0 ? H / 2 : PAD_Y + (1 - (price - min) / range) * (H - PAD_Y * 2));

  let path = `M${x(points[0].t).toFixed(1)},${y(points[0].price).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` H${x(points[i].t).toFixed(1)} V${y(points[i].price).toFixed(1)}`;
  }
  const last = points[points.length - 1];

  const summary = `Price history from ${formatDate(history[0].date)}: lowest ${formatINR(min)}, highest ${formatINR(max)}, now ${formatINR(current)}.`;

  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full max-w-md overflow-visible text-ink">
        <line x1={0} x2={W} y1={y(min)} y2={y(min)} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(last.t)} cy={y(last.price)} r={4} className="fill-brand stroke-ink" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex max-w-md justify-between type-small text-muted tnum" aria-hidden>
        <span>{formatDate(history[0].date, { year: false })}</span>
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
