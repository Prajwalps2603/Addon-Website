import type { ReactNode } from 'react';
import { Car, Heart, LayoutGrid, Search, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { useCartCount } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { useWishlist } from '@/stores/wishlist';
import { CountBadge } from './bits';

const slot =
  'relative flex h-14 w-full flex-col items-center justify-center gap-1 px-1 text-ink transition-[background-color,transform] dur-quick active:scale-[0.96] focus-ring-inset';
const label = 'max-w-full truncate text-[0.6875rem] leading-none font-bold';

function Slot({ icon, text, count, current }: { icon: ReactNode; text: ReactNode; count?: number; current: boolean }) {
  return (
    <>
      <span className="relative">
        {icon}
        {count !== undefined && <CountBadge count={count} className="-top-1.5 -right-2.5" />}
      </span>
      <span className={cn(label, current && 'underline decoration-2 underline-offset-4')}>{text}</span>
    </>
  );
}

/**
 * The five-slot bar fixed to the bottom of a phone screen: Shop, Search, My car, Saved, Cart.
 * Hidden from 768 px, where the header has room for all of them.
 */
export function BottomBar() {
  const { pathname } = useLocation();
  const car = useActiveCar();
  const cartCount = useCartCount();
  const savedCount = useWishlist((state) => state.ids.length);
  const ui = {
    menu: useUi((state) => state.mobileMenuOpen),
    search: useUi((state) => state.searchOpen),
    picker: useUi((state) => state.vehiclePickerOpen),
    cart: useUi((state) => state.cartOpen),
  };
  const openMobileMenu = useUi((state) => state.openMobileMenu);
  const openSearch = useUi((state) => state.openSearch);
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const openCart = useUi((state) => state.openCart);
  const icon = 'size-5';
  const onShop = pathname.startsWith('/shop') || pathname === '/search';

  return (
    <nav aria-label="Quick links" data-print="hide" className="fixed inset-x-0 bottom-0 z-header border-t border-ink bg-page pb-safe md:hidden print:hidden">
      <ul className="grid grid-cols-5">
        <li>
          <button type="button" onClick={openMobileMenu} aria-haspopup="dialog" aria-expanded={ui.menu} className={cn(slot, (ui.menu || onShop) && 'bg-surface-2')}>
            <Slot icon={<LayoutGrid aria-hidden className={icon} />} text="Shop" current={onShop} />
          </button>
        </li>
        <li>
          <button type="button" onClick={openSearch} aria-haspopup="dialog" aria-expanded={ui.search} className={cn(slot, ui.search && 'bg-surface-2')}>
            <Slot icon={<Search aria-hidden className={icon} />} text="Search" current={false} />
          </button>
        </li>
        <li>
          <button
            type="button"
            onClick={openVehiclePicker}
            aria-haspopup="dialog"
            aria-expanded={ui.picker}
            aria-label={car ? `My car: ${car.vehicle.make} ${car.vehicle.model}${car.year ? ` ${car.year}` : ''}. Change car` : 'My car: add your car'}
            className={cn(slot, ui.picker && 'bg-surface-2')}
          >
            <Slot
              icon={<Car aria-hidden className={icon} />}
              text={<span className={car ? 'uppercase' : undefined}>{car ? car.vehicle.model : 'My car'}</span>}
              current={false}
            />
          </button>
        </li>
        <li>
          <Link
            to="/wishlist"
            aria-label={`Saved parts, ${savedCount}`}
            aria-current={pathname === '/wishlist' ? 'page' : undefined}
            className={cn(slot, pathname === '/wishlist' && 'bg-surface-2')}
          >
            <Slot icon={<Heart aria-hidden className={icon} />} text="Saved" count={savedCount} current={pathname === '/wishlist'} />
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={openCart}
            aria-haspopup="dialog"
            aria-expanded={ui.cart}
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
            className={cn(slot, ui.cart && 'bg-surface-2')}
          >
            <Slot icon={<ShoppingBag aria-hidden className={icon} />} text="Cart" count={cartCount} current={false} />
          </button>
        </li>
      </ul>
    </nav>
  );
}
