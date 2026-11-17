import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useUi } from '@/stores/ui';
import { BottomBar } from './BottomBar';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { useRouteChange } from './useRouteChange';
import { WhatsAppFloat } from './WhatsAppFloat';

// The overlays are closed on first paint, so their code (search, menu drawer, cart drawer) loads
// once the browser is idle, or at once if one is opened before that.
const CartDrawer = lazy(() => import('@/components/cart/CartDrawer'));
const MobileMenu = lazy(() => import('./MobileMenu').then((m) => ({ default: m.MobileMenu })));
const SearchOverlay = lazy(() => import('./SearchOverlay').then((m) => ({ default: m.SearchOverlay })));

function useOverlaysReady(): boolean {
  const opened = useUi((state) => state.cartOpen || state.searchOpen || state.mobileMenuOpen);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    if (opened) {
      setReady(true);
      return;
    }
    const done = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(done, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(done, 1500);
    return () => window.clearTimeout(id);
  }, [opened, ready]);
  return ready || opened;
}

/**
 * The storefront shell: skip link, announcements, header, the routed page, footer, the phone's
 * bottom bar, and the overlays every page shares (menu drawer, search, cart drawer, WhatsApp).
 * The Toaster and the car picker are mounted once by App.tsx, above every layout, so they are not repeated here.
 */
export default function Layout() {
  const { pathname } = useLocation();
  useRouteChange();
  const overlaysReady = useOverlaysReady();

  const atCheckout = pathname === '/checkout' || pathname.startsWith('/checkout/');
  const onProduct = pathname.startsWith('/p/');
  // Product pages draw their own sticky buy bar in that place.
  const showBottomBar = !atCheckout && !onProduct;

  return (
    <div
      className="flex min-h-dvh flex-col"
      // With no bottom bar, things that sit above it (the product page's buy bar, toasts) drop to the screen's edge.
      style={showBottomBar ? undefined : ({ '--bottom-bar-h': '0px' } as CSSProperties)}
    >
      <a
        href="#main"
        onClick={(event) => {
          // Move focus without adding #main to the address.
          event.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
          main?.scrollIntoView();
        }}
        className="sr-only z-tooltip rounded-control bg-brand px-4 py-3 font-bold text-brand-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      {showBottomBar && (
        <>
          {/* Room under the footer so the fixed bar never covers the last line. */}
          <div aria-hidden className="h-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] bg-surface md:hidden print:hidden" />
          <BottomBar />
        </>
      )}
      {overlaysReady && (
        <>
          <Suspense fallback={null}>
            <MobileMenu />
          </Suspense>
          <Suspense fallback={null}>
            <SearchOverlay />
          </Suspense>
          <Suspense fallback={null}>
            <CartDrawer />
          </Suspense>
        </>
      )}
      {/* On a phone the product page's buy bar holds the bottom edge and has its own WhatsApp question. */}
      {!atCheckout && <WhatsAppFloat className={onProduct ? 'max-md:hidden' : undefined} />}
    </div>
  );
}
