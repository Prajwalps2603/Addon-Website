import type { MouseEvent, ReactNode } from 'react';
import { ArrowRight, Car, Heart, LogOut, Package, ShieldCheck, Truck, UserRound, Wrench } from 'lucide-react';
import { Link } from 'react-router';
import { iconForArtKind } from '@/components/commerce/categoryIcons';
import { ErrorState } from '@/components/commerce/ErrorState';
import { GarageButton } from '@/components/commerce/GarageButton';
import { Accordion, AccordionItem, Button, Drawer, Skeleton } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { formatDate } from '@/lib/format';
import { loginPath } from '@/lib/urls';
import { useUi } from '@/stores/ui';
import { useWishlist } from '@/stores/wishlist';
import { firstName, useSignOut } from './AccountMenu';
import { useLiveDrop } from './hooks';
import { categoryPath, HELP_LINKS, partsCount, sortCategories, TOOLS } from './nav';
import { StoreContact } from './storeContact';
import { ThemeSwitch } from './ThemeSwitch';

const rowLink = 'focus-ring-inset flex min-h-11 items-center gap-3 py-2 font-bold';
const subLink = 'focus-ring-inset flex min-h-11 items-center justify-between gap-3 py-1.5 pl-8';

/**
 * The menu drawer for phones and tablets: every destination of the desktop header, as accordions.
 * Opened by the header's menu button and the bottom bar's Shop slot. Navigation closes it (the layout closes every overlay on a route change).
 */
export function MobileMenu() {
  const open = useUi((state) => state.mobileMenuOpen);
  const close = useUi((state) => state.closeMobileMenu);

  // A link to the page already showing changes no route, so close here as well.
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) close();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Menu"
      side="left"
      size="sm"
      height="full"
      toolbar={
        <div className="flex items-center justify-between gap-3" onClick={closeOnLink}>
          <GarageButton />
          <Link to="/cars" className="inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-1 underline-offset-4">
            Shop by car
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      }
    >
      {open && (
        <div onClick={closeOnLink}>
          <MenuBody />
        </div>
      )}
    </Drawer>
  );
}

function MenuBody() {
  const categories = useCategories();
  const drop = useLiveDrop();
  const savedCount = useWishlist((state) => state.ids.length);
  const sorted = categories.data ? sortCategories(categories.data) : [];

  return (
    <div className="grid gap-8 pb-4">
      {drop && (
        <Link to="/friday-five" className="plane-brand flex min-h-13 items-center justify-between gap-3 px-4 py-3">
          <span className="grid">
            <span className="type-button">Friday Five</span>
            <span className="type-small">Live until {formatDate(drop.endsAt, { weekday: true })}</span>
          </span>
          <ArrowRight aria-hidden className="size-5" />
        </Link>
      )}

      <Link to="/book-fitting" className="focus-ring-inset flex min-h-13 items-center justify-between gap-3 border border-ink px-4 py-3">
        <span className="flex items-center gap-3">
          <Wrench aria-hidden className="size-5 shrink-0" />
          <span className="grid">
            <span className="type-button">Book a fitting</span>
            <span className="type-small text-muted">Parts fitted at our studio in a slot you choose</span>
          </span>
        </span>
        <ArrowRight aria-hidden className="size-5 shrink-0" />
      </Link>

      <section aria-labelledby="menu-shop">
        <h3 id="menu-shop" className="type-label mb-2 text-muted">
          Shop by category
        </h3>
        {categories.isPending ? (
          <div className="grid gap-px border-t border-ink" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="my-3 h-6" />
            ))}
          </div>
        ) : categories.error ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} title="Could not load the categories" size="sm" />
        ) : sorted.length === 0 ? (
          <p className="type-body text-muted">No categories are on sale yet.</p>
        ) : (
          <Accordion type="single" headingLevel={4}>
            {sorted.map((category) => {
              const Icon = iconForArtKind(category.artKind);
              return (
                <AccordionItem
                  key={category.id}
                  value={category.slug}
                  title={
                    <span className="flex items-center gap-3">
                      <Icon aria-hidden className="size-5 shrink-0" />
                      {category.name}
                    </span>
                  }
                  aside={<span className="tnum">{category.productCount}</span>}
                  className="[&_[role=region]]:pb-3"
                >
                  <ul className="grid">
                    <li>
                      <Link to={categoryPath(category)} className={subLink}>
                        <span className="font-bold">All {category.name}</span>
                        <span className="type-small text-muted tnum">{partsCount(category.productCount)}</span>
                      </Link>
                    </li>
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link to={categoryPath(child, category)} className={subLink}>
                          <span>{child.name}</span>
                          <span className="type-small text-muted tnum">{child.productCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </section>

      <Accordion type="multiple" headingLevel={3}>
        <AccordionItem value="tools" title="Tools">
          <ul className="grid">
            {TOOLS.map(({ to, name, blurb, Icon }) => (
              <li key={to}>
                <Link to={to} className="focus-ring-inset flex items-start gap-3 py-2.5">
                  <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
                  <span className="grid">
                    <span className="font-bold">{name}</span>
                    <span className="type-small text-muted">{blurb}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AccordionItem>
        <AccordionItem value="help" title="Help">
          <ul className="grid">
            {HELP_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="focus-ring-inset flex min-h-11 items-center py-1.5">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </AccordionItem>
      </Accordion>

      <ul className="grid border-t border-line">
        <MenuRow to="/garage" icon={<Car aria-hidden className="size-5" />}>
          My garage
        </MenuRow>
        <MenuRow to="/wishlist" icon={<Heart aria-hidden className="size-5" />} aside={savedCount > 0 ? String(savedCount) : undefined}>
          Saved parts
        </MenuRow>
        <MenuRow to="/track" icon={<Truck aria-hidden className="size-5" />}>
          Track an order
        </MenuRow>
      </ul>

      <MenuContact />

      <AccountBlock />

      <div className="border-t border-line pt-2">
        <ThemeSwitch withLabel />
      </div>
    </div>
  );
}

function MenuRow({ to, icon, aside, children }: { to: string; icon: ReactNode; aside?: string; children: ReactNode }) {
  return (
    <li className="border-b border-line">
      <Link to={to} className={rowLink}>
        {icon}
        <span className="flex-1">{children}</span>
        {aside && <span className="type-small font-normal text-muted tnum">{aside}</span>}
      </Link>
    </li>
  );
}

function AccountBlock() {
  const me = useMe();
  const { signOut, pending } = useSignOut();

  if (me.isPending) return <Skeleton className="h-11 w-full" />;

  if (!me.user) {
    return (
      <div className="grid gap-2">
        <Button to={loginPath(null)} variant="dark" block iconLeft={<UserRound aria-hidden />}>
          Sign in
        </Button>
        <p className="type-small text-muted">
          New here?{' '}
          <Link to="/register" className="link font-bold">
            Create an account
          </Link>{' '}
          to keep your orders, addresses and garage together.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="menu-account" className="grid gap-2">
      <h3 id="menu-account" className="type-h3">
        {firstName(me.user.name)}
        <span className="sr-only">: your account</span>
      </h3>
      <ul className="grid border-t border-line">
        <MenuRow to="/account" icon={<UserRound aria-hidden className="size-5" />}>
          My account
        </MenuRow>
        <MenuRow to="/account/orders" icon={<Package aria-hidden className="size-5" />}>
          Orders
        </MenuRow>
        {me.isAdmin && (
          <MenuRow to="/admin" icon={<ShieldCheck aria-hidden className="size-5" />}>
            Admin
          </MenuRow>
        )}
      </ul>
      <Button variant="ghost" onClick={signOut} loading={pending} iconLeft={<LogOut aria-hidden />} className="justify-start px-0">
        Sign out
      </Button>
    </section>
  );
}

/** Phones, WhatsApp, Instagram, hours, the studio and EMI: the strip that sits above the header on wider screens. */
function MenuContact() {
  const { data } = useSettings();
  if (!data) return null;
  return (
    <section aria-labelledby="menu-contact" className="grid gap-3">
      <h3 id="menu-contact" className="type-label text-muted">
        Call or visit
      </h3>
      <StoreContact settings={data} />
    </section>
  );
}
