/**
 * Revenue and orders over the dashboard range. Lazy loaded: recharts lives only in this chunk,
 * which only the admin dashboard imports.
 */
import { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { AdminStats } from '@/types/api';
import { formatDate, formatDateRange, formatINR, formatNumber, pluralize } from '@/lib/format';

interface Point {
  /** First day of the bucket, YYYY-MM-DD. */
  date: string;
  /** Last day of the bucket (same as date for daily points). */
  until: string;
  revenue: number;
  orders: number;
}

/** Daily points up to 90 days; weekly sums for a year, so the bars stay readable on a phone. */
export function bucketSeries(series: AdminStats['series'], days: number): Point[] {
  const size = days > 90 ? 7 : 1;
  const points: Point[] = [];
  for (let at = 0; at < series.length; at += size) {
    const chunk = series.slice(at, at + size);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;
    points.push({
      date: first.date,
      until: last.date,
      revenue: chunk.reduce((sum, point) => sum + point.revenue, 0),
      orders: chunk.reduce((sum, point) => sum + point.orders, 0),
    });
  }
  return points;
}

/** ₹1.2L, ₹45k, ₹800: axis labels only. Exact figures are in the tooltip and the tiles. */
function shortINR(value: number): string {
  if (value >= 10_000_000) return `₹${trim(value / 10_000_000)}Cr`;
  if (value >= 100_000) return `₹${trim(value / 100_000)}L`;
  if (value >= 1_000) return `₹${trim(value / 1_000)}k`;
  return `₹${Math.round(value)}`;
}

function trim(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '');
}

function ChartTip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  const when = point.date === point.until ? formatDate(point.date, { weekday: true }) : formatDateRange(point.date, point.until);
  return (
    <div className="plane-board grid gap-1 px-3 py-2 shadow-pop">
      <p className="type-small text-muted">{when}</p>
      <p className="tnum font-bold">{formatINR(point.revenue)}</p>
      <p className="type-small tnum">{pluralize(point.orders, 'order')}</p>
    </div>
  );
}

export interface RevenueChartProps {
  series: AdminStats['series'];
  days: number;
}

export default function RevenueChart({ series, days }: RevenueChartProps) {
  const data = useMemo(() => bucketSeries(series, days), [series, days]);
  const weekly = days > 90;

  return (
    <div className="h-64 w-full md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap={weekly ? 2 : '18%'}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDate(value, { year: false })}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--ink)' }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="revenue"
            tickFormatter={shortINR}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            allowDecimals={false}
            tickFormatter={(value: number) => formatNumber(value)}
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={ChartTip} cursor={{ fill: 'var(--surface-2)' }} isAnimationActive={false} />
          <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill="var(--ink)" isAnimationActive={false} />
          <Line
            yAxisId="orders"
            dataKey="orders"
            name="Orders"
            type="monotone"
            stroke="var(--info)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--info)', stroke: 'var(--page)' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
