import { useSearchParams } from 'react-router';
import { Segmented } from '@/components/ui';
import type { StatsRange } from '@/lib/api';

export const RANGES: readonly StatsRange[] = [7, 30, 90, 365];

/** The `days` range from the URL (?days=90), so a reload or a shared link keeps it. Default 30. */
export function useRangeParam(): [StatsRange, (days: StatsRange) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get('days'));
  const days = (RANGES as readonly number[]).includes(raw) ? (raw as StatsRange) : 30;
  const setDays = (next: StatsRange) => {
    setParams(
      (previous) => {
        const copy = new URLSearchParams(previous);
        if (next === 30) copy.delete('days');
        else copy.set('days', String(next));
        return copy;
      },
      { replace: true },
    );
  };
  return [days, setDays];
}

export function rangeLabel(days: number): string {
  return days === 365 ? 'Last 12 months' : `Last ${days} days`;
}

const OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
] as const;

export function RangeSwitch({ value, onChange }: { value: StatsRange; onChange: (days: StatsRange) => void }) {
  return (
    <Segmented
      label="Date range"
      options={OPTIONS}
      value={String(value) as (typeof OPTIONS)[number]['value']}
      onChange={(next) => onChange(Number(next) as StatsRange)}
      size="sm"
    />
  );
}
