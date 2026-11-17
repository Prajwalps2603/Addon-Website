import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from '@/components/ui';
import { api } from '@/lib/api';
import { cartLineKey, useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import type { CartLineInput, PricedCart, PricedLine } from '@/types/api';

/** One cart line as the shopper sees it: the store's line (instant) with the server's pricing (when it has caught up). */
export interface CartRow {
  key: string;
  input: CartLineInput;
  priced: PricedLine | undefined;
}

function looseKey(line: Pick<CartLineInput, 'productId' | 'variantId'>): string {
  return `${line.productId}:${line.variantId ?? 0}`;
}

/** True when the line counts towards the total (the server leaves out sold-out and unavailable lines). */
export function isIncluded(line: PricedLine): boolean {
  return line.issue === null || line.issue === 'insufficient_stock';
}

/**
 * The store's lines in the store's order, each matched to its priced line. Quantity changes and
 * removals show at once because the rows follow the store; prices follow when the server answers.
 */
export function useCartRows(cart: PricedCart | undefined, items?: CartLineInput[]): CartRow[] {
  const storeLines = useCart((state) => state.lines);
  const lines = items ?? storeLines;
  return useMemo(() => {
    const exact = new Map<string, PricedLine>();
    const loose = new Map<string, PricedLine>();
    for (const line of cart?.lines ?? []) {
      exact.set(cartLineKey(line), line);
      if (!loose.has(looseKey(line))) loose.set(looseKey(line), line);
    }
    return lines.map((input) => {
      const key = cartLineKey(input);
      return { key, input, priced: exact.get(key) ?? loose.get(looseKey(input)) };
    });
  }, [cart, lines]);
}

/** A polite live region's text. Saying the same thing twice still gets announced. */
export function useAnnouncer(): { message: string; announce: (text: string) => void } {
  const [message, setMessage] = useState('');
  const flip = useRef(false);
  const announce = useCallback((text: string) => {
    flip.current = !flip.current;
    // A trailing no-break space makes a repeated sentence a change the screen reader will read.
    setMessage(flip.current ? text : `${text} `);
  }, []);
  return { message, announce };
}

function nameOf(row: CartRow): string {
  const line = row.priced;
  if (!line) return 'the part';
  return line.variantName ? `${line.name} (${line.variantName})` : line.name;
}

/** Cart changes, each announced to screen readers. Removal offers an undo. */
export function useCartActions(announce: (text: string) => void) {
  const navigate = useNavigate();
  const setQty = useCallback(
    (row: CartRow, qty: number) => {
      useCart.getState().setQty(row.key, qty);
      announce(`Quantity of ${nameOf(row)} set to ${qty}.`);
    },
    [announce],
  );

  const remove = useCallback(
    (row: CartRow) => {
      const before = useCart.getState().lines;
      const index = before.findIndex((line) => cartLineKey(line) === row.key);
      useCart.getState().remove(row.key);
      const name = nameOf(row);
      announce(`${name} removed from your cart.`);
      toast.info(`Removed ${name}`, {
        id: 'cart-removed',
        action: {
          label: 'Undo',
          onClick: () => {
            const now = useCart.getState().lines;
            if (now.some((line) => cartLineKey(line) === row.key) || index < 0) return;
            const next = [...now];
            next.splice(Math.min(index, next.length), 0, row.input);
            useCart.getState().replaceAll(next);
            announce(`${name} is back in your cart.`);
          },
        },
      });
    },
    [announce],
  );

  /** The Sanity Check's "remove": every line of that product. */
  const removeProduct = useCallback(
    (productId: number, name: string) => {
      const state = useCart.getState();
      for (const line of state.lines.filter((item) => item.productId === productId)) state.remove(cartLineKey(line));
      announce(`${name} removed from your cart.`);
    },
    [announce],
  );

  /**
   * The Sanity Check's "add the missing part". The advice does not say whether the part comes in
   * sizes, so it is looked up first: a part with sizes is not added blind, the shopper is sent to
   * choose one instead.
   */
  const addProduct = useCallback(
    (productId: number, label: string) => {
      const name = label.replace(/^Add\s+/i, '');
      void api.products
        .byIds([productId])
        .catch(() => [])
        .then((found) => {
          const product = found.find((item) => item.id === productId);
          if (product?.hasVariants) {
            announce(`${product.name} comes in more than one size. Open it to choose one.`);
            toast.info(`Choose a size for ${product.name}`, {
              id: 'cart-choose-size',
              description: 'It comes in more than one size, so we did not add it yet.',
              action: {
                label: 'Open the part',
                onClick: () => {
                  useUi.getState().closeCart();
                  navigate(`/p/${product.slug}`);
                },
              },
            });
            return;
          }
          useCart.getState().add({ productId });
          announce(`${name} added to your cart.`);
        });
    },
    [announce, navigate],
  );

  return { setQty, remove, removeProduct, addProduct };
}
