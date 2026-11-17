import { Heart, Menu, Search, ShoppingBag, Wrench } from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { Logo } from '@/components/brand';
import { GarageButton } from '@/components/commerce/GarageButton';
import { Kbd } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCartCount } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { useWishlist } from '@/stores/wishlist';
import { AccountMenu } from './AccountMenu';
import { CountBadge } from './bits';
import { useLiveDrop, useScrolledPast } from './hooks';
import { MegaMenu } from './MegaMenu';
import { ThemeSwitch } from './ThemeSwitch';
import { ToolsMenu } from './ToolsMenu';

const iconLink =
  'relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-[background-color,transform] dur-quick hover:bg-surface-2 active:scale-[0.97] [&_svg]:size-5';

/**
 * The header on every storefront page. Sticky; once the page scrolls it condenses (the logo steps
 * down and the rule under it turns to ink). From 1280 px: full navigation (the wide search box from 1536 px). Below: logo, search, cart
 * and the menu button, with the rest in the menu drawer and the bottom bar.
 */
export function SiteHeader() {
  const condensed = useScrolledPast(8);
  const drop = useLiveDrop();
  const cartCount = useCartCount();
  const savedCount = useWishlist((state) => state.ids.length);
  const openCart = useUi((state) => state.openCart);
  const cartOpen = useUi((state) => state.cartOpen);
  const openSearch = useUi((state) => state.openSearch);
  const searchOpen = useUi((state) => state.searchOpen);
  const openMobileMenu = useUi((state) => state.openMobileMenu);
  const menuOpen = useUi((state) => state.mobileMenuOpen);

  return (
    <header
      data-print="hide"
      data-condensed={condensed || undefined}
      className={cn(
        'sticky top-0 z-header border-b bg-page text-ink transition-colors dur-base print:hidden',
        condensed ? 'border-ink' : 'border-line',
      )}
    >
      <div className="container-page flex h-16 items-center gap-1 xl:gap-4">
        <Link
          to="/"
          aria-label="Addon Automotive, home"
          className={cn(
            'mr-auto inline-flex h-11 shrink-0 origin-left items-center rounded-control transition-[scale] dur-base ease-settle xl:mr-0',
            condensed && 'scale-90',
          )}
        >
          <Logo height={28} tagline={false} roll="scroll" label="" className="lg:hidden" />
          <Logo height={36} roll="scroll" label="" className="hidden lg:block" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          <MegaMenu />
          <NavLink
            to="/cars"
            className={({ isActive }) =>
              cn(
                'inline-flex h-11 items-center rounded-control px-3 font-bold whitespace-nowrap transition-colors dur-quick hover:bg-surface-2',
                isActive && 'underline decoration-2 underline-offset-8',
              )
            }
          >
            Shop by car
          </NavLink>
          <ToolsMenu />
          <NavLink
            to="/book-fitting"
            className={({ isActive }) =>
              cn(
                'inline-flex h-11 items-center gap-1.5 rounded-control px-3 font-bold whitespace-nowrap transition-colors dur-quick hover:bg-surface-2',
                isActive && 'underline decoration-2 underline-offset-8',
              )
            }
          >
            <Wrench aria-hidden className="size-4" />
            Book a fitting
          </NavLink>
          {drop && (
            <Link
              to="/friday-five"
              title={`Live until ${formatDate(drop.endsAt, { weekday: true })}`}
              className="lean-end ml-2 mr-3 inline-flex h-9 items-center bg-brand pl-3 pr-1 type-button text-brand-ink"
            >
              Friday Five
              <span className="sr-only">, live now</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-0.5 xl:ml-auto xl:gap-1">
          <button
            type="button"
            onClick={openSearch}
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            aria-keyshortcuts="/"
            className="hidden h-11 w-60 items-center gap-2 rounded-control border border-line-strong px-3 text-left text-muted transition-colors dur-quick hover:border-ink 2xl:flex"
          >
            <Search aria-hidden className="size-5 shrink-0 text-ink" />
            <span className="min-w-0 flex-1 truncate">Search parts or cars</span>
            <Kbd aria-hidden>/</Kbd>
          </button>
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            aria-keyshortcuts="/"
            className={cn(iconLink, '2xl:hidden')}
          >
            <Search aria-hidden />
          </button>

          <GarageButton className="mx-1 hidden md:inline-flex" />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line md:block" />

          <div className="hidden xl:block">
            <AccountMenu />
          </div>

          <Link to="/wishlist" aria-label={`Saved parts, ${savedCount}`} className={cn(iconLink, 'hidden md:inline-flex')}>
            <Heart aria-hidden />
            <CountBadge count={savedCount} />
          </Link>

          <button
            type="button"
            onClick={openCart}
            aria-haspopup="dialog"
            aria-expanded={cartOpen}
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
            className={iconLink}
          >
            <ShoppingBag aria-hidden />
            <CountBadge count={cartCount} />
          </button>

          <ThemeSwitch className="hidden xl:inline-flex" />

          <button
            type="button"
            onClick={openMobileMenu}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label="Menu"
            className={cn(iconLink, '-mr-2 xl:hidden')}
          >
            <Menu aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
