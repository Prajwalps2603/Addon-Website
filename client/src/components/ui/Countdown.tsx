import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { BoardTile } from '@/components/brand/PitBoard';

export interface CountdownProps {
  /** The real moment the offer ends: an ISO time from the API (a drop's `endsAt`, a quote's expiry). */
  to: string | Date;
  /** Words before the clock, e.g. "Ends in". */
  label?: string;
  /** What to show once the time has passed. */
  endedLabel?: string;
  /** Called once when the clock reaches zero, so the page can refetch. */
  onEnd?: () => void;
  /** `tiles` is the board clock for a drop. `inline` is one line of text for cards and rows. */
  variant?: 'tiles' | 'inline';
  size?: 'sm' | 'md';
  className?: string;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntil(target: number): Remaining | null {
  const ms = target - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

const two = (value: number): string => String(value).padStart(2, '0');

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

/** The sentence a screen reader hears. It changes once a minute, not once a second. */
function spoken({ days, hours, minutes }: Remaining): string {
  const parts = [days > 0 ? plural(days, 'day') : null, days > 0 || hours > 0 ? plural(hours, 'hour') : null, plural(minutes, 'minute')];
  return parts.filter(Boolean).join(' ');
}

/**
 * A clock counting down to a real deadline. The only countdown the store allows is one with
 * a true end time behind it (the Friday Five, a quote's expiry). Never loop it, never invent one.
 */
export function Countdown({ to, label = 'Ends in', endedLabel = 'Ended', onEnd, variant = 'tiles', size = 'md', className }: CountdownProps) {
  const target = to instanceof Date ? to.getTime() : Date.parse(to);
  const [left, setLeft] = useState<Remaining | null>(() => remainingUntil(target));
  const ended = useRef(onEnd);
  useEffect(() => {
    ended.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    setLeft(remainingUntil(target));
    if (!Number.isFinite(target) || target <= Date.now()) return;
    const timer = window.setInterval(() => {
      const next = remainingUntil(target);
      setLeft(next);
      if (!next) {
        window.clearInterval(timer);
        ended.current?.();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!Number.isFinite(target)) return null;

  if (!left) {
    return <span className={cn('type-label text-muted', className)}>{endedLabel}</span>;
  }

  const units: Array<[string, string, string]> = [
    ...(left.days > 0 ? [[two(left.days), 'days', 'd'] as [string, string, string]] : []),
    [two(left.hours), 'hrs', 'h'],
    [two(left.minutes), 'min', 'm'],
    [two(left.seconds), 'sec', 's'],
  ];

  if (variant === 'inline') {
    return (
      <span role="timer" className={cn('inline-flex items-baseline gap-1.5 type-small', className)}>
        <span className="sr-only">
          {label} {spoken(left)}
        </span>
        <span aria-hidden className="text-muted">
          {label}
        </span>
        <span aria-hidden className="font-bold tnum">
          {units.map(([value, , short]) => `${value}${short}`).join(' ')}
        </span>
      </span>
    );
  }

  return (
    <div role="timer" className={cn('inline-flex flex-col gap-1.5', className)}>
      <span className="sr-only">
        {label} {spoken(left)}
      </span>
      <span aria-hidden className="type-label text-muted">
        {label}
      </span>
      <span aria-hidden className="flex items-start gap-1">
        {units.map(([value, name]) => (
          <span key={name} className="flex flex-col items-center gap-1">
            <BoardTile size={size === 'sm' ? 'sm' : 'md'} className={size === 'sm' ? 'min-w-9' : 'min-w-12'}>
              {value}
            </BoardTile>
            <span className="text-[0.6875rem] leading-none font-bold text-muted uppercase">{name}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
