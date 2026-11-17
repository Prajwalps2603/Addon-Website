import { useEffect, useState } from 'react';

/** Returns `value` once it has stopped changing for `delayMs`. The first value is returned at once. */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
