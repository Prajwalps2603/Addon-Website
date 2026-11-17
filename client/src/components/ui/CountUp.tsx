import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './a11y';

/**
 * Counts a figure up from zero, keeping what is around the number: "₹73,194" runs ₹0 → ₹73,194,
 * "39%" runs 0% → 39%. Text with no number in it is shown as it is. Screen readers get the final
 * value at once; with reduced motion the number does not run.
 */
export function CountUp({ value, duration = 1100 }: { value: string; duration?: number }) {
  const match = /^(\D*)([\d,]+(?:\.\d+)?)(.*)$/s.exec(value);
  const target = match ? Number(match[2]!.replace(/,/g, '')) : NaN;
  const decimals = match && match[2]!.includes('.') ? match[2]!.split('.')[1]!.length : 0;
  const [shown, setShown] = useState(() => (Number.isFinite(target) && !prefersReducedMotion() ? 0 : target));
  const from = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (prefersReducedMotion()) {
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = begin + (target - begin) * eased;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);

  if (!match || !Number.isFinite(target)) return <>{value}</>;
  const grouped = match[2]!.includes(',');
  const number = shown.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="tnum">
        {match[1]}
        {number}
        {match[3]}
      </span>
    </>
  );
}
