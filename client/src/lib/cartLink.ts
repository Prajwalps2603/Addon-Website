/**
 * "Send cart to payer": a cart packed into one URL parameter so it opens on another phone.
 *
 *   /cart?c=12x1.34v5x2.77x1-eyJ0ZXh0IjoiS0EifQ&coupon=FIRST10
 *
 * One chunk per line, joined by dots: <productId>[v<variantId>]x<qty>[-<custom design as base64url JSON>].
 * Only letters, digits, '.', '-' and '_' are used, so chat apps keep the link in one piece.
 * Prices are never in the link: the receiving phone prices the cart on the server like any other.
 */
import { siteUrl } from '@/lib/urls';
import { normalizeCartLines } from '@/stores/cart';
import type { CartLineInput } from '@/types/api';

export const CART_LINK_PARAM = 'c';
export const CART_COUPON_PARAM = 'coupon';

const LINE = /^(\d+)(?:v(\d+))?x(\d+)(?:-([A-Za-z0-9_-]+))?$/;

function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeCart(lines: readonly CartLineInput[]): string {
  return lines
    .map((line) => {
      const head = `${line.productId}${line.variantId ? `v${line.variantId}` : ''}x${line.qty}`;
      const hasCustom = line.custom && Object.keys(line.custom).length > 0;
      return hasCustom ? `${head}-${toBase64Url(JSON.stringify(line.custom))}` : head;
    })
    .join('.');
}

/** Reads what encodeCart wrote. Chunks that do not parse are skipped; the result is always a valid cart. */
export function decodeCart(param: string | null | undefined): CartLineInput[] {
  if (!param) return [];
  const lines: CartLineInput[] = [];
  for (const chunk of param.split('.')) {
    const match = LINE.exec(chunk);
    if (!match) continue;
    const line: CartLineInput = {
      productId: Number(match[1]),
      variantId: match[2] ? Number(match[2]) : null,
      qty: Number(match[3]),
    };
    if (match[4]) {
      try {
        const custom: unknown = JSON.parse(fromBase64Url(match[4]));
        if (typeof custom !== 'object' || custom === null || Array.isArray(custom)) continue;
        line.custom = custom as Record<string, unknown>;
      } catch {
        continue;
      }
    }
    lines.push(line);
  }
  return normalizeCartLines(lines);
}

/** The absolute link that restores this cart: https://<site>/cart?c=...  */
export function cartShareUrl(lines: readonly CartLineInput[], options: { couponCode?: string } = {}): string {
  const coupon = options.couponCode?.trim();
  const query = `${CART_LINK_PARAM}=${encodeCart(lines)}${coupon ? `&${CART_COUPON_PARAM}=${encodeURIComponent(coupon)}` : ''}`;
  return siteUrl(`/cart?${query}`);
}

/**
 * The shared cart in a location's search string, or null when there is none.
 * The cart page calls this on load and offers to load the lines with useCart().replaceAll().
 */
export function readCartLink(search: string | URLSearchParams): { lines: CartLineInput[]; couponCode: string } | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const lines = decodeCart(params.get(CART_LINK_PARAM));
  if (lines.length === 0) return null;
  return { lines, couponCode: (params.get(CART_COUPON_PARAM) ?? '').trim().toUpperCase() };
}
