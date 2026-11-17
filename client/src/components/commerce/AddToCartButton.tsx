import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, IconButton, toast, type ButtonSize } from '@/components/ui';
import { cn } from '@/lib/cn';
import { MAX_CART_LINES, MAX_LINE_QTY, cartLineKey, useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';

export interface AddToCartButtonProps {
  productId: number;
  /** The chosen variant, for products that have them. */
  variantId?: number | null;
  /** Defaults to 1. */
  qty?: number;
  /** Designer output for customised products (a show plate design). */
  custom?: Record<string, unknown> | null;
  /** Used in the accessible name of the `icon` variant: "Add Addon Aero Spoiler to cart". */
  productName?: string;
  /**
   * A reason the part cannot be added yet, e.g. "Choose a size first". The button stays pressable
   * and shows this as an error instead of adding, so the shopper learns what is missing.
   */
  blocked?: string | null;
  /** `button` is the labelled button. `icon` is the round quick-add control on a product card. */
  variant?: 'button' | 'icon';
  /** Colour of the labelled button. Use `dark` where red is already the ground or another primary is in view. */
  tone?: 'primary' | 'dark' | 'outline';
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  /** Opens the cart drawer after adding. On by default. */
  openCart?: boolean;
  /** Called with the cart line's key once the line is in the cart. */
  onAdded?: (key: string) => void;
  /** The label. Defaults to "Add to cart". */
  children?: ReactNode;
  className?: string;
}

const ADDED_MS = 1600;

/**
 * Puts a product in the cart: one line per product, variant and custom design, with quantities merged.
 * The button confirms in place ("Added"), announces it, and opens the cart drawer.
 * If the cart cannot take the line, it says why in a toast and changes nothing.
 */
export function AddToCartButton({
  productId,
  variantId = null,
  qty = 1,
  custom = null,
  productName,
  blocked = null,
  variant = 'button',
  tone = 'primary',
  size = 'md',
  block = false,
  disabled = false,
  openCart = true,
  onAdded,
  children = 'Add to cart',
  className,
}: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = () => {
    if (blocked) {
      toast.error(blocked, { id: 'add-to-cart' });
      return;
    }
    const cart = useCart.getState();
    const key = cartLineKey({ productId, variantId, custom });
    const existing = cart.lines.find((line) => cartLineKey(line) === key);
    if (!existing && cart.lines.length >= MAX_CART_LINES) {
      toast.error('Your cart is full', { description: `A cart holds ${MAX_CART_LINES} different items. Remove one to add this.`, id: 'add-to-cart' });
      return;
    }
    if (existing && existing.qty >= MAX_LINE_QTY) {
      toast.error(`You already have ${MAX_LINE_QTY} of these in your cart`, { description: 'For a larger order, contact us for a quote.', id: 'add-to-cart' });
      return;
    }

    cart.add({ productId, variantId, qty, custom });
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
    onAdded?.(key);
    if (openCart) useUi.getState().openCart();
  };

  const announce = (
    <span aria-live="polite" className="sr-only">
      {added ? `Added to cart${productName ? `: ${productName}` : ''}` : ''}
    </span>
  );

  if (variant === 'icon') {
    return (
      <>
        <IconButton
          label={productName ? `Add ${productName} to cart` : 'Add to cart'}
          variant={added ? 'dark' : 'primary'}
          size={size}
          disabled={disabled}
          onClick={add}
          className={cn('rounded-full', className)}
        >
          {added ? <Check aria-hidden /> : <Plus aria-hidden />}
        </IconButton>
        {announce}
      </>
    );
  }

  // The "pit stop": on adding, a fill in the opposite colour wipes across at the lean and the label confirms.
  const wipe = tone === 'dark' ? 'bg-brand' : 'bg-ink';
  const wipeInk = tone === 'dark' ? 'text-brand-ink' : 'text-page';

  return (
    <>
      <Button
        variant={tone}
        size={size}
        block={block}
        disabled={disabled}
        onClick={add}
        className={cn('relative isolate overflow-hidden', added && wipeInk, className)}
      >
        {added && <span aria-hidden className={cn('absolute inset-0 -z-10 animate-wipe', wipe)} />}
        {/* The label keeps its place while hidden, so the button does not change width. */}
        <span className={cn('inline-flex items-center gap-2', added && 'invisible')}>{children}</span>
        {added && (
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <Check aria-hidden />
            Added
          </span>
        )}
      </Button>
      {announce}
    </>
  );
}
