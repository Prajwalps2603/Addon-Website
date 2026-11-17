import { readJSON, writeJSON } from '@/lib/storage';

/** Order number → access token, so a guest can reopen an order from this browser. */
export const ORDER_TOKENS_KEY = 'addon-order-tokens';
/** The most recent order placed from this browser, so a refresh mid-payment can find it again. */
const LAST_ORDER_KEY = 'addon-checkout-last-order';
const MAX_TOKENS = 30;
const LAST_ORDER_FRESH_MS = 6 * 60 * 60 * 1000;

function readTokens(): Record<string, string> {
  const stored = readJSON<unknown>(ORDER_TOKENS_KEY, {});
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
  const tokens: Record<string, string> = {};
  for (const [orderNumber, token] of Object.entries(stored)) {
    if (typeof token === 'string' && token) tokens[orderNumber] = token;
  }
  return tokens;
}

export function rememberOrderToken(orderNumber: string, token: string | undefined): void {
  if (!token) return;
  const tokens = readTokens();
  delete tokens[orderNumber];
  tokens[orderNumber] = token;
  const entries = Object.entries(tokens);
  writeJSON(ORDER_TOKENS_KEY, Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_TOKENS))));
  writeJSON(LAST_ORDER_KEY, { orderNumber, at: Date.now() });
}

export function orderToken(orderNumber: string): string | null {
  return readTokens()[orderNumber] ?? null;
}

/** The order page address with the token a guest needs. */
export function orderPath(orderNumber: string, token: string | null | undefined, isNew = false): string {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (isNew) params.set('new', '1');
  const query = params.toString();
  return `/order/${encodeURIComponent(orderNumber)}${query ? `?${query}` : ''}`;
}

/** The order placed from this browser in the last few hours, if any. */
export function recentOrder(): { orderNumber: string; token: string | null } | null {
  const stored = readJSON<unknown>(LAST_ORDER_KEY, null);
  if (typeof stored !== 'object' || stored === null) return null;
  const { orderNumber, at } = stored as { orderNumber?: unknown; at?: unknown };
  if (typeof orderNumber !== 'string' || typeof at !== 'number') return null;
  if (Date.now() - at > LAST_ORDER_FRESH_MS) return null;
  return { orderNumber, token: orderToken(orderNumber) };
}
