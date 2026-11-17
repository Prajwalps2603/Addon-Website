/**
 * How a shopper gets back into an order: the access token from the confirmation link, kept on this
 * device under 'addon-order-tokens' (order number -> token), or the signed-in owner's session.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { readJSON, writeJSON } from '@/lib/storage';
import { siteUrl } from '@/lib/urls';

const STORAGE_KEY = 'addon-order-tokens';
/** Enough for a long run of orders on one phone without letting the map grow for ever. */
const MAX_REMEMBERED = 40;

type TokenMap = Record<string, string>;

function readMap(): TokenMap {
  const value = readJSON<unknown>(STORAGE_KEY, {});
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: TokenMap = {};
  for (const [key, token] of Object.entries(value as Record<string, unknown>)) {
    if (typeof token === 'string' && token) out[key] = token;
  }
  return out;
}

export function readOrderToken(orderNumber: string): string | undefined {
  return readMap()[orderNumber] || undefined;
}

export function rememberOrderToken(orderNumber: string, token: string | null | undefined): void {
  if (!orderNumber || !token) return;
  const map = readMap();
  if (map[orderNumber] === token) return;
  delete map[orderNumber];
  map[orderNumber] = token;
  const keys = Object.keys(map);
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_REMEMBERED))) delete map[key];
  writeJSON(STORAGE_KEY, map);
}

/** '/order/ADN-123' with the token when there is one, for links that must open on another device. */
export function orderPath(orderNumber: string, token?: string | null): string {
  const base = `/order/${encodeURIComponent(orderNumber)}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function invoicePath(orderNumber: string, token?: string | null): string {
  const base = `/order/${encodeURIComponent(orderNumber)}/invoice`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function orderUrl(orderNumber: string, token?: string | null): string {
  return siteUrl(orderPath(orderNumber, token));
}

/**
 * Loads an order for the order page and the invoice. A token in the URL wins and is remembered;
 * otherwise the one this device remembers; otherwise none, which works for the signed-in owner.
 */
export function useOrderWithAccess(orderNumber: string) {
  const [params] = useSearchParams();
  const urlToken = params.get('token')?.trim() || undefined;
  const token = urlToken ?? readOrderToken(orderNumber);

  useEffect(() => {
    if (urlToken) rememberOrderToken(orderNumber, urlToken);
  }, [orderNumber, urlToken]);

  const query = useQuery({
    queryKey: queryKeys.orders.detail(orderNumber, token ?? null),
    queryFn: ({ signal }) => api.orders.get(orderNumber, token, { signal }),
    enabled: orderNumber !== '',
  });

  // The owner's own view carries the token: keep it so the link works signed out too.
  const served = query.data?.accessToken;
  useEffect(() => {
    if (served) rememberOrderToken(orderNumber, served);
  }, [orderNumber, served]);

  return { query, token: token ?? served, queryKey: queryKeys.orders.detail(orderNumber, token ?? null) };
}

/** Errors that must all look the same, so a stranger cannot tell whether an order number exists. */
export function isHiddenOrderError(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403 || status === 404;
}
