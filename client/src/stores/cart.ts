import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, syncAcrossTabs } from '@/lib/storage';
import type { CartLineInput } from '@/types/api';

const STORAGE_KEY = 'addon-cart-v1';

export const MAX_LINE_QTY = 99;
export const MAX_CART_LINES = 60;

type LineIdentity = Pick<CartLineInput, 'productId' | 'variantId'> & { custom?: Record<string, unknown> | null };

/** JSON with object keys sorted, so two equal designs always produce the same text. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function shortHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

function hasCustom(custom: Record<string, unknown> | null | undefined): custom is Record<string, unknown> {
  return typeof custom === 'object' && custom !== null && Object.keys(custom).length > 0;
}

/**
 * Identifies a cart line: same product, same variant, same custom design → same key.
 * Works on a CartLineInput and on a PricedLine, so priced lines map back to the store
 * with `cartLineKey(pricedLine)`. (PricedLine.key is the server's own id: do not pass it to the store.)
 */
export function cartLineKey(line: LineIdentity): string {
  return `${line.productId}:${line.variantId ?? 0}:${hasCustom(line.custom) ? shortHash(stableStringify(line.custom)) : ''}`;
}

function clampQty(qty: unknown): number {
  const value = Math.floor(Number(qty));
  return Number.isFinite(value) ? Math.min(MAX_LINE_QTY, Math.max(1, value)) : 1;
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Turns anything (stored state, a shared cart link) into valid cart lines:
 * drops malformed entries, clamps quantities and merges identical lines.
 */
export function normalizeCartLines(input: unknown): CartLineInput[] {
  if (!Array.isArray(input)) return [];
  const lines = new Map<string, CartLineInput>();
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Partial<CartLineInput>;
    if (!isId(entry.productId)) continue;
    const line: CartLineInput = {
      productId: entry.productId,
      variantId: isId(entry.variantId) ? entry.variantId : null,
      qty: clampQty(entry.qty),
    };
    if (hasCustom(entry.custom)) line.custom = entry.custom;
    const key = cartLineKey(line);
    const existing = lines.get(key);
    if (existing) existing.qty = clampQty(existing.qty + line.qty);
    else if (lines.size < MAX_CART_LINES) lines.set(key, line);
  }
  return [...lines.values()];
}

export interface AddToCartInput {
  productId: number;
  variantId?: number | null;
  /** Defaults to 1. */
  qty?: number;
  /** Designer output for customised products. */
  custom?: Record<string, unknown> | null;
}

interface CartState {
  lines: CartLineInput[];
  couponCode: string;
  /** The delivery pincode typed in the cart, '' until one is given. */
  pincode: string;
  /** The line most recently added, for the "added to cart" feedback. Not persisted. */
  lastAddedKey: string | null;

  /** Adds a line, or raises the quantity of an identical one. Returns the line's key. */
  add: (input: AddToCartInput) => string;
  /** Sets a line's quantity. Zero or less removes the line. */
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  /** Empties the cart and forgets the coupon. The pincode stays. */
  clear: () => void;
  /** Replaces the whole cart, for a shared cart link or a quote. */
  replaceAll: (lines: CartLineInput[], options?: { couponCode?: string }) => void;
  setCouponCode: (code: string) => void;
  setPincode: (pincode: string) => void;
  clearLastAdded: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      couponCode: '',
      pincode: '',
      lastAddedKey: null,

      add: (input) => {
        const line: CartLineInput = {
          productId: input.productId,
          variantId: input.variantId ?? null,
          qty: clampQty(input.qty ?? 1),
        };
        if (hasCustom(input.custom)) line.custom = input.custom;
        const key = cartLineKey(line);
        const lines = get().lines;
        const exists = lines.some((existing) => cartLineKey(existing) === key);
        if (!exists && lines.length >= MAX_CART_LINES) return key;
        set({
          lines: exists
            ? lines.map((existing) =>
                cartLineKey(existing) === key ? { ...existing, qty: clampQty(existing.qty + line.qty) } : existing,
              )
            : [...lines, line],
          lastAddedKey: key,
        });
        return key;
      },

      setQty: (key, qty) => {
        if (!(qty > 0)) {
          get().remove(key);
          return;
        }
        set((state) => ({
          lines: state.lines.map((line) => (cartLineKey(line) === key ? { ...line, qty: clampQty(qty) } : line)),
        }));
      },

      remove: (key) =>
        set((state) => ({
          lines: state.lines.filter((line) => cartLineKey(line) !== key),
          lastAddedKey: state.lastAddedKey === key ? null : state.lastAddedKey,
        })),

      clear: () => set({ lines: [], couponCode: '', lastAddedKey: null }),

      replaceAll: (lines, options) =>
        set((state) => ({
          lines: normalizeCartLines(lines),
          couponCode: options?.couponCode === undefined ? state.couponCode : options.couponCode.trim().toUpperCase(),
          lastAddedKey: null,
        })),

      setCouponCode: (code) => set({ couponCode: code.trim().toUpperCase() }),
      setPincode: (pincode) => set({ pincode: pincode.trim() }),
      clearLastAdded: () => set({ lastAddedKey: null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state) => ({ lines: state.lines, couponCode: state.couponCode, pincode: state.pincode }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<CartState>;
        return {
          ...current,
          lines: normalizeCartLines(stored.lines),
          couponCode: typeof stored.couponCode === 'string' ? stored.couponCode : '',
          pincode: typeof stored.pincode === 'string' ? stored.pincode : '',
        };
      },
    },
  ),
);

syncAcrossTabs(useCart, STORAGE_KEY);

/** Units in the cart (the sum of quantities), for the cart badge. */
export function useCartCount(): number {
  return useCart((state) => state.lines.reduce((total, line) => total + line.qty, 0));
}
