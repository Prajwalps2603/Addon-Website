import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useEffect, useState, type ComponentType } from 'react';
import { BrowserRouter, useLocation, useNavigationType } from 'react-router';
import { Toaster } from '@/components/ui/Toast';
import { toast } from '@/components/ui/toastStore';
import { useAppSync } from '@/hooks/useAppSync';
import { ErrorBoundary } from '@/lib/ErrorBoundary';
import { queryClient } from '@/lib/queryClient';
import { AppRoutes } from '@/routes';
import '@/stores/theme';
import { useUi } from '@/stores/ui';

/**
 * A new page starts at the top. Back and forward keep the browser's own scroll position,
 * a link to #section scrolls to that section, and a change of query string alone
 * (filters, sort) leaves the scroll where it is.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const jump = (): boolean => {
      let id = hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // A malformed escape in the address: look for the id as written.
      }
      const target = document.getElementById(id);
      target?.scrollIntoView();
      return target !== null;
    };
    if (jump()) return;

    // The page behind the link is a lazy chunk and may not be on screen yet (/glossary#pcd):
    // start at the top, then go to the section once it appears.
    window.scrollTo(0, 0);
    const observer = new MutationObserver(() => {
      if (jump()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const giveUp = window.setTimeout(() => observer.disconnect(), 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
    // navigationType is left out on purpose: this runs when the page changes, not when only the type does.
  }, [pathname, hash]);

  return null;
}

function AppSync() {
  useAppSync();
  return null;
}

/**
 * The car picker behind GarageButton and FitBadge, mounted once for every page.
 * Its code stays out of the first download: it is fetched the first time the picker is asked for
 * (on a storefront page that chunk is already in memory, so it opens at once).
 */
function VehiclePickerHost() {
  const open = useUi((state) => state.vehiclePickerOpen);
  const [Picker, setPicker] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!open || Picker) return;
    let cancelled = false;
    import('@/components/commerce/VehiclePicker').then(
      (module) => {
        if (!cancelled) setPicker(() => module.VehiclePicker);
      },
      () => {
        if (cancelled) return;
        useUi.getState().closeVehiclePicker();
        toast.error('Could not open the car picker', { description: 'Check your connection and try again.' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, Picker]);

  return Picker ? <Picker /> : null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Motion follows the device's reduced-motion setting everywhere. */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <ScrollToTop />
            <AppSync />
            <AppRoutes />
            <VehiclePickerHost />
            <Toaster />
          </BrowserRouter>
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
