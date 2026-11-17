import { useEffect, useRef } from 'react';
import { ArrowRight, OctagonAlert, Wrench } from 'lucide-react';
import { CartAnnouncer, CartEmpty, CartMessages } from '@/components/cart/CartBits';
import { CartLineItem, CartLineSkeleton } from '@/components/cart/CartLineItem';
import { CouponBox } from '@/components/cart/CouponBox';
import { EmiNote } from '@/components/cart/EmiNote';
import { whatsAppOrder } from '@/components/cart/orderText';
import { Redline } from '@/components/cart/Redline';
import { SanityCheck } from '@/components/cart/SanityCheck';
import { useAnnouncer, useCartActions, useCartRows } from '@/components/cart/useCartRows';
import { WaysToPay } from '@/components/cart/WaysToPay';
import { ErrorState, PageHeader, PincodeCheck, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Skeleton } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { usePricedCart } from '@/hooks/usePricedCart';
import { useSettings } from '@/hooks/useSettings';
import { useSharedCart } from '@/hooks/useSharedCart';
import { pluralize } from '@/lib/format';
import { isValidPincode } from '@/lib/india';
import { useDocumentMeta } from '@/lib/seo';
import { waNumber } from '@/lib/whatsapp';
import { useCart, useCartCount } from '@/stores/cart';
import type { PricedCart } from '@/types/api';
import { PriceSummary } from './PriceSummary';
import { SendToPayer } from './SendToPayer';
import { SharedCartPrompt } from './SharedCartPrompt';

function checkoutBlocker(cart: PricedCart): string | null {
  if (cart.canCheckout) return null;
  if (cart.itemCount === 0) return 'Nothing in this cart can be bought right now. Remove the parts that are out of stock or cannot be bought.';
  return 'Some parts cannot be bought as they are. Fix or remove them to check out.';
}

function PageSkeleton({ lines }: { lines: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_26rem]" aria-busy="true">
      <p className="sr-only">Loading your cart</p>
      <div className="grid content-start gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-28 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        <div className="grid gap-6 border-t border-ink pt-6">
          {Array.from({ length: Math.min(Math.max(lines, 1), 4) }, (_, index) => (
            <CartLineSkeleton key={index} />
          ))}
        </div>
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/** The cart in full: lines, the Redline, the Sanity Check, delivery, coupon, the money and every way to pay. */
export default function CartPage() {
  useDocumentMeta({ title: 'Your cart', noindex: true });
  const count = useCartCount();
  const storeLines = useCart((state) => state.lines);
  const couponCode = useCart((state) => state.couponCode);
  const pincode = useCart((state) => state.pincode);
  const vehicle = useActiveVehicle();
  const whatsapp = waNumber(useSettings().data?.whatsapp);
  const { shared, accept, dismiss } = useSharedCart();
  const { cart, isEmpty, isPending, isUpdating, isError, error, refetch } = usePricedCart();
  const rows = useCartRows(cart);
  const { message, announce } = useAnnouncer();
  const actions = useCartActions(announce);

  // A shared cart on a phone with no cart of its own: nothing to lose, so load it straight away.
  const autoAccepted = useRef(false);
  useEffect(() => {
    if (!shared || autoAccepted.current || useCart.getState().lines.length > 0) return;
    autoAccepted.current = true;
    accept();
    announce('The shared cart is loaded.');
  }, [shared, accept, announce]);

  const replace = () => {
    accept();
    announce('Your cart now holds the shared parts.');
  };
  const merge = () => {
    if (shared) {
      const state = useCart.getState();
      state.replaceAll([...state.lines, ...shared.lines], shared.couponCode ? { couponCode: shared.couponCode } : undefined);
    }
    dismiss();
    announce('The shared parts are added to your cart.');
  };
  const keep = () => {
    dismiss();
    announce('Your cart is unchanged.');
  };

  const showPrompt = Boolean(shared) && storeLines.length > 0;
  const allCod = cart ? cart.lines.every((line) => line.codEligible) : true;
  const blocker = cart ? checkoutBlocker(cart) : null;

  let body;
  if (isEmpty) {
    body = shared ? null : <CartEmpty />;
  } else if (isPending) {
    body = <PageSkeleton lines={storeLines.length} />;
  } else if (!cart) {
    body = <ErrorState error={error} onRetry={refetch} title="Could not load your cart" />;
  } else {
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-8 lg:col-start-1 lg:row-start-1">
          {isError && (
            <Callout
              tone="warn"
              live
              title="Prices could not be refreshed"
              actions={
                <Button variant="outline" size="sm" onClick={refetch}>
                  Try again
                </Button>
              }
            >
              These are the last prices we had. Checkout always uses fresh ones.
            </Callout>
          )}
          <CartMessages messages={cart.messages} />
          <Redline cart={cart} updating={isUpdating} />
          <ul aria-label="Items in your cart" className="grid grid-cols-[minmax(0,1fr)] border-t border-ink">
            {rows.map((row) => (
              <li key={row.key} className="border-b border-line py-5">
                <CartLineItem row={row} onQty={actions.setQty} onRemove={actions.remove} updating={isUpdating} />
              </li>
            ))}
          </ul>
          <SanityCheck advice={cart.advice} lines={cart.lines} onRemoveProduct={actions.removeProduct} onAddProduct={actions.addProduct} />
        </div>

        <aside
          aria-label="Delivery and payment"
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          {cart.fulfilment === 'delivery' ? (
            <PincodeCheck codEligible={allCod} />
          ) : (
            <div className="grid gap-1 border border-line p-3">
              <p className="flex items-start gap-2 font-bold">
                <Wrench aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{cart.fulfilment === 'studio' ? 'Fitted at our studio' : 'Collect from our studio'}</span>
              </p>
              <p className="type-small text-muted">
                {cart.fulfilment === 'studio'
                  ? 'Parts marked for fitting make this a studio order: no delivery, and you choose the day and time at checkout.'
                  : 'You collect the parts from the studio. No delivery charge.'}
              </p>
            </div>
          )}
          <CouponBox cart={cart} updating={isUpdating} error={error} onChange={announce} />
          <PriceSummary cart={cart} updating={isUpdating}>
            <div className="grid gap-2">
              <Button to="/checkout" size="lg" block disabled={!cart.canCheckout} iconRight={<ArrowRight aria-hidden />} aria-describedby={blocker ? 'checkout-blocker' : undefined}>
                Checkout
              </Button>
              {blocker && (
                <p id="checkout-blocker" className="type-small flex items-start gap-1.5 font-medium">
                  <OctagonAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>{blocker}</span>
                </p>
              )}
            </div>
          </PriceSummary>
          {whatsapp && cart.itemCount > 0 && (
            <div className="grid gap-2">
              <p className="type-small text-muted">Rather order by message? Send this cart to the shop on WhatsApp.</p>
              <WhatsAppButton
                to="store"
                block
                text={whatsAppOrder({ cart, lines: storeLines, couponCode: cart.coupon?.code ?? couponCode, pincode: isValidPincode(pincode) ? pincode : '', vehicle })}
              >
                Order on WhatsApp
              </WhatsAppButton>
            </div>
          )}
          <WaysToPay options={cart.paymentOptions} fulfilment={cart.fulfilment} updating={isUpdating} />
          <EmiNote total={cart.total} />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <SendToPayer cart={cart} onCopied={() => announce('Cart link copied.')} />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page pb-16">
      <PageHeader title="Your cart" meta={count > 0 ? pluralize(count, 'item') : undefined} />
      <CartAnnouncer message={message} />
      {showPrompt && shared && (
        <div className="mb-10">
          <SharedCartPrompt shared={shared} onReplace={replace} onMerge={merge} onKeep={keep} />
        </div>
      )}
      {body}
    </div>
  );
}
