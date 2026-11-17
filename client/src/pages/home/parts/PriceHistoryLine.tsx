import { useId } from 'react';
import { cn } from '@/lib/cn';
import { formatDate, formatINR } from '@/lib/format';

export interface PriceHistoryLineProps {
  /** Oldest first, from ProductDetail.priceHistory. */
  history: { date: string; price: number }[];
  /** What the shopper pays now. Added as the last step when the history does not end on it. */
  current: number;
  className?: string;
}

const W = 240;
const H = 56;
const PAD = 4;

interface Point {
  time: number;
  price: number;
  date: string;
}

/**
 * A small step line of a product's price over time. A price holds until it changes,
 * so the line steps rather than slopes. The words under it carry the figures.
 */
export function PriceHistoryLine({ history, current, className }: PriceHistoryLineProps) {
  const captionId = useId();
  const fillId = `phl${captionId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const points: Point[] = history
    .map((entry) => ({ time: Date.parse(entry.date), price: entry.price, date: entry.date }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price))
    .sort((a, b) => a.time - b.time);

  const now = Date.now();
  const last = points[points.length - 1];
  if (!last || last.price !== current) points.push({ time: Math.max(now, last?.time ?? now), price: current, date: new Date(now).toISOString() });

  const first = points[0];
  if (points.length < 2 || !first) {
    return <p className={cn('type-small text-muted', className)}>No earlier prices recorded for this part yet.</p>;
  }

  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const start = first.time;
  const lastTime = points[points.length - 1]?.time ?? now;
  // The latest price runs on to today, and always gets enough width to be seen.
  const end = Math.max(now, lastTime + Math.max((lastTime - first.time) * 0.15, 86_400_000));
  const span = Math.max(1, end - start);
  const x = (time: number) => PAD + ((time - start) / span) * (W - PAD * 2);
  const y = (price: number) => (high === low ? H / 2 : PAD + (1 - (price - low) / (high - low)) * (H - PAD * 2));

  let path = `M${x(first.time).toFixed(1)},${y(first.price).toFixed(1)}`;
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    path += ` H${x(point.time).toFixed(1)} V${y(point.price).toFixed(1)}`;
  }
  path += ` H${x(end).toFixed(1)}`;

  const summary = `Price history since ${formatDate(first.date)}: highest ${formatINR(high)}, lowest ${formatINR(low)}, now ${formatINR(current)}.`;
  const area = `${path} V${H} H${x(first.time).toFixed(1)} Z`;
  const dropX = x(lastTime);
  const dotTop = (y(current) / H) * 100;

  return (
    <figure aria-labelledby={captionId} className={cn('grid gap-2', className)}>
      <div className="relative">
        <svg role="img" aria-label={summary} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full overflow-visible text-brand">
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${fillId})`} />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          aria-hidden
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-raised bg-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_22%,transparent)]"
          style={{ left: `${(dropX / W) * 100}%`, top: `${dotTop}%` }}
        />
      </div>
      <figcaption id={captionId} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted tnum">
        <span>Since {formatDate(first.date, { year: false })}</span>
        <span>
          High <span className="font-semibold text-ink">{formatINR(high)}</span> · Now <span className="font-bold text-brand-text">{formatINR(current)}</span>
        </span>
      </figcaption>
    </figure>
  );
}
