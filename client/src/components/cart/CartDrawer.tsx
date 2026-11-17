import { ArrowRight, OctagonAlert } from 'lucide-react';
import { ErrorState } from '@/components/commerce';
import { Button, Drawer } from '@/components/ui';
import { usePricedCart } from '@/hooks/usePricedCart';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import { useCartCount } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { CartAnnouncer, CartEmpty, CartMessages } from './CartBits';
import { CartLineItem, CartLineSkeleton } from './CartLineItem';
import { Redline, readRedline } from './Redline';
import { SanityCheck } from './SanityCheck';
import { useAnnouncer, useCartActions, useCartRows } from './useCartRows';

/**
 * The cart drawer: opened from anywhere through useUi().openCart. Lines, the Redline, the problems
 * worth knowing before checkout, the subtotal and the way on. The Drawer traps focus and hands it
 * back to whatever opened it.
 */
export default function CartDrawer() {
  const open = useUi((state) => state.cartOpen);
  const close = useUi((state) => state.closeCart);
  const count = useCartCount();
  const { cart, isEmpty, isPending, isUpdating, isError, error, refetch } = usePricedCart({ enabled: open });
  const rows = useCartRows(cart);
  const { message, announce } = useAnnouncer();
  const actions = useCartActions(announce);

  const title = (
    <span className="flex items-baseline gap-2">
      Your cart
      {count > 0 && <span className="type-small font-normal text-muted tnum">{pluralize(count, 'item')}</span>}
    </span>
  );

  const footer =
    !isEmpty && cart ? (
      <div className="grid gap-3">
        <div className={cn('flex items-baseline justify-between gap-4 transition-opacity dur-base', isUpdating && 'opacity-60')}>
          <span className="font-bold">{cart.discount > 0 ? `Subtotal after ${cart.coupon?.code ?? 'coupon'}` : 'Subtotal'}</span>
          <span className="type-price-xl tnum" aria-live="polite" aria-atomic="true">
            {formatINR(cart.subtotal - cart.discount)}
          </span>
        </div>
        {cart.fittingTotal > 0 && (
          <div className={cn('-mt-1 flex items-baseline justify-between gap-4 transition-opacity dur-base', isUpdating && 'opacity-60')}>
            <span className="type-small">Studio fitting</span>
            <span className="type-small font-bold tnum">+{formatINR(cart.fittingTotal)}</span>
          </div>
        )}
        <p className="type-small -mt-2 text-muted">
          Inclusive of GST. {cart.fulfilment === 'delivery' ? 'Delivery and ways to pay are on the next step.' : 'You pick the studio slot and the way to pay on the next step.'}
        </p>
        {!cart.canCheckout && (
          <p className="type-small flex items-start gap-1.5 font-medium text-stop">
            <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Some parts cannot be bought as they are. Fix or remove them to check out.</span>
          </p>
        )}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button variant="outline" to="/cart" onClick={close}>
            View cart
          </Button>
          <Button to="/checkout" onClick={close} disabled={!cart.canCheckout} iconRight={<ArrowRight aria-hidden />} block>
            Checkout
          </Button>
        </div>
      </div>
    ) : undefined;

  return (
    <Drawer open={open} onClose={close} title={title} footer={footer} toolbar={cart && !isEmpty && readRedline(cart).show ? <Redline cart={cart} size="sm" updating={isUpdating} /> : undefined}>
      <CartAnnouncer message={message} />
      {isEmpty ? (
        <CartEmpty compact onNavigate={close} />
      ) : isPending ? (
        <div className="grid gap-5" aria-busy="true">
          <p className="sr-only">Loading your cart</p>
          {Array.from({ length: Math.min(Math.max(rows.length, 1), 3) }, (_, index) => (
            <CartLineSkeleton key={index} compact />
          ))}
        </div>
      ) : isError && !cart ? (
        <ErrorState error={error} onRetry={refetch} size="sm" align="center" title="Could not load your cart" />
      ) : cart ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <CartMessages messages={cart.messages} />
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-5" aria-label="Items in your cart">
            {rows.map((row) => (
              <li key={row.key} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                <CartLineItem row={row} onQty={actions.setQty} onRemove={actions.remove} updating={isUpdating} compact onNavigate={close} />
              </li>
            ))}
          </ul>
          <SanityCheck
            compact
            advice={cart.advice}
            lines={cart.lines}
            onRemoveProduct={actions.removeProduct}
            onAddProduct={actions.addProduct}
            onNavigate={close}
            id="drawer-sanity"
            className="border-t border-ink pt-4"
          />
        </div>
      ) : null}
    </Drawer>
  );
}
