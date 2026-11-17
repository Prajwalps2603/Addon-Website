import { cartLineKey, useCart } from '@/stores/cart';
import { formatINR } from '@/lib/format';
import type { CartLineInput, LineFittingService, PricedLine } from '@/types/api';

/**
 * "Fit at our studio" on a cart line. The cart store has no action for the flag yet, so the line is
 * replaced in place through the store's own setState (its key does not change). Same approach as the
 * product page and Build Bay use.
 */
export function setLineFitAtStudio(key: string, fitAtStudio: boolean): void {
  useCart.setState((state) => ({
    lines: state.lines.map((line) => {
      if (cartLineKey(line) !== key) return line;
      const next: CartLineInput = { ...line };
      if (fitAtStudio) next.fitAtStudio = true;
      else delete next.fitAtStudio;
      return next;
    }),
  }));
}

/** Sets or clears the flag on many store lines at once (checkout's "How do you want it?"). */
export function setStoreFitAtStudio(keys: ReadonlySet<string> | 'none'): void {
  useCart.setState((state) => ({
    lines: state.lines.map((line) => {
      const want = keys !== 'none' && keys.has(cartLineKey(line));
      if (Boolean(line.fitAtStudio) === want) return line;
      const next: CartLineInput = { ...line };
      if (want) next.fitAtStudio = true;
      else delete next.fitAtStudio;
      return next;
    }),
  }));
}

/** '₹799 a part, about 90 min' or 'No fitting charge, about 2 hours'. */
export function fittingTerms(service: LineFittingService): string {
  const charge = service.charge > 0 ? `${formatINR(service.charge)} a part` : 'No fitting charge';
  return service.minutes > 0 ? `${charge}, about ${minutesWords(service.minutes)}` : charge;
}

export function minutesWords(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourWords = hours === 1 ? '1 hour' : `${hours} hours`;
  return rest ? `${hourWords} ${rest} min` : hourWords;
}

/** Lines the studio can fit (the server names a service for them and they can be bought). */
export function fittableLines(lines: readonly PricedLine[]): PricedLine[] {
  return lines.filter((line) => line.fittingService !== null && (line.issue === null || line.issue === 'insufficient_stock'));
}
