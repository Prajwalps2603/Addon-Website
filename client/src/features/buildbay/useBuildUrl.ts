import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { readJSON, writeJSON } from '@/lib/storage';
import { decodeBuild, encodeBuild, freshState } from './codec';
import { useBuildBay } from './store';

const LAST_KEY = 'addon-buildbay-last-v1';

/**
 * Keeps the build and the address in step: `?b=` is read on arrival (a shared link, a refresh)
 * and rewritten after every change, so copying the address shares the build. The last build is
 * also kept on this device for a visit to /build-bay with no link.
 */
export function useBuildUrl(): void {
  const [params, setParams] = useSearchParams();
  const vehicle = useActiveVehicle();
  const build = useBuildBay((s) => s.build);
  const written = useRef<string | null>(null);
  const ready = useRef(false);
  const code = params.get('b');

  // Arrival, and any later address change this hook did not make (back / forward, a pasted link).
  useEffect(() => {
    if (code !== null && code === written.current) return;
    const fromLink = decodeBuild(code);
    if (fromLink) {
      useBuildBay.getState().load(fromLink);
    } else if (!ready.current) {
      const last = decodeBuild(readJSON<string | null>(LAST_KEY, null));
      if (last) useBuildBay.getState().load(last);
      else {
        const body = vehicle?.bodyType;
        useBuildBay.getState().load(freshState(body === 'hatchback' || body === 'sedan' || body === 'suv' ? body : undefined));
      }
    }
    ready.current = true;
    // Only the address drives this; the garage car is read once for a first visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Every change goes back into the address and onto this device.
  useEffect(() => {
    // Skip a render that is older than the store (the arrival effect has just loaded a build).
    if (!ready.current || build !== useBuildBay.getState().build) return;
    const next = encodeBuild(build);
    writeJSON(LAST_KEY, next);
    if (next === code) return;
    written.current = next;
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.set('b', next);
        return copy;
      },
      { replace: true, preventScrollReset: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build]);
}
