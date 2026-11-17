import { useEffect, useReducer } from 'react';

export interface Countdown {
  /** Milliseconds left, never below 0. */
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the moment has passed, or when no valid end time was given. */
  isOver: boolean;
}

function remaining(end: number): Countdown {
  const totalMs = Number.isFinite(end) ? Math.max(0, end - Date.now()) : 0;
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isOver: totalMs <= 0,
  };
}

/**
 * Time left until `endsAt`, re-rendering each time the seconds figure changes and once
 * more at the end. Only for real deadlines: a live drop's end, a quote's expiry.
 */
export function useCountdown(endsAt: string | number | Date | null | undefined): Countdown {
  const end = endsAt === null || endsAt === undefined ? Number.NaN : new Date(endsAt).getTime();
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => {
      const left = end - Date.now();
      if (!(left > 0)) return;
      // Wake just after the displayed second rolls over, so the last tick lands on the deadline.
      timer = window.setTimeout(
        () => {
          tick();
          schedule();
        },
        (left % 1000) + 1,
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [end]);

  return remaining(end);
}
