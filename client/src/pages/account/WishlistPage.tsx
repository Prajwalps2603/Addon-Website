import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight, Car, Heart, ShoppingCart } from 'lucide-react';
import { iconForArtKind } from '@/components/commerce/categoryIcons';
import { EmptyState, ErrorState, PageHeader, ProductGrid, ShareButton } from '@/components/commerce';
import { Button, Callout, Skeleton, toast } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useCategories } from '@/hooks/useCategories';
import { useMe } from '@/hooks/useMe';
import { useProductsByIds } from '@/hooks/useProducts';
import { pluralize } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { MAX_WISHLIST, useWishlist } from '@/stores/wishlist';
import type { ProductSummary } from '@/types/api';

/** `?ids=4,9,12` from a shared list link: positive whole numbers, no repeats, at most the list's limit. */
function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  for (const part of raw.split(',')) {
    const id = Number(part.trim());
    if (Number.isInteger(id) && id > 0) seen.add(id);
  }
  return [...seen].slice(0, MAX_WISHLIST);
}

const FITS = new Set(['direct', 'with_work', 'universal']);

/** Parts that go straight into the cart: in stock, one version, nothing to design first. */
function isQuickAdd(product: ProductSummary): boolean {
  return product.inStock && !product.hasVariants && !product.customKind;
}

function CategoryLinks() {
  const { data: categories, isPending } = useCategories();
  if (isPending) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {[24, 28, 20, 32].map((width, index) => (
          <Skeleton key={index} className="h-16 rounded-[18px]" style={{ width: `${width * 6}px` }} />
        ))}
      </div>
    );
  }
  const top = (categories ?? []).filter((category) => category.isActive && category.productCount > 0).slice(0, 8);
  if (top.length === 0) return null;
  return (
    <nav aria-label="Shop by category" className="grid gap-3">
      <h2 className="type-h3 italic uppercase">Start with a category</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {top.map((category) => {
          const Icon = iconForArtKind(category.artKind);
          return (
            <li key={category.id}>
              <Link
                to={`/shop/${category.slug}`}
                className="group focus-ring flex h-full items-center gap-3 rounded-[18px] bg-surface p-3 transition-colors duration-200 hover:bg-surface-2"
              >
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-raised text-ink transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-ink">
                  <Icon className="size-5" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="text-sm leading-tight font-bold">{category.name}</span>
                  <span className="text-xs text-muted tnum">{pluralize(category.productCount, 'part')}</span>
                </span>
                <ArrowRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function WishlistPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sharedIds = useMemo(() => parseIds(params.get('ids')), [params]);
  const isShared = sharedIds.length > 0;
  useDocumentMeta({ title: isShared ? 'A shared list of parts' : 'Saved parts', noindex: true });

  const savedIds = useWishlist((state) => state.ids);
  const setAll = useWishlist((state) => state.setAll);
  const { isSignedIn, isPending: mePending } = useMe();
  const vehicle = useActiveVehicle();
  const openPicker = useUi((state) => state.openVehiclePicker);
  const openCart = useUi((state) => state.openCart);

  const ids = isShared ? sharedIds : savedIds;
  const { data, isPending, isPlaceholderData, error, refetch } = useProductsByIds(ids);

  // A heart pressed on a card removes the part at once, before the next answer arrives.
  const products = useMemo(() => {
    if (!data) return undefined;
    const wanted = new Set(ids);
    return data.filter((product) => wanted.has(product.id));
  }, [data, ids]);

  const quickAdd = products?.filter(isQuickAdd) ?? [];
  const needsChoice = products?.filter((product) => product.inStock && !isQuickAdd(product)) ?? [];
  const soldOut = products?.filter((product) => !product.inStock).length ?? 0;
  const fitCount = vehicle && products ? products.filter((product) => product.fit !== null && FITS.has(product.fit)).length : null;
  const noFitCount = vehicle && products ? products.filter((product) => product.fit === 'no').length : 0;

  const addAllInStock = () => {
    const cart = useCart.getState();
    const inCart = new Set(cart.lines.filter((line) => !line.variantId && !line.custom).map((line) => line.productId));
    const toAdd = quickAdd.filter((product) => !inCart.has(product.id));
    for (const product of toAdd) cart.add({ productId: product.id, qty: 1 });
    const skipped = quickAdd.length - toAdd.length;
    const notes = [
      skipped > 0 ? `${pluralize(skipped, 'part')} already in the cart.` : null,
      needsChoice.length > 0 ? `${pluralize(needsChoice.length, 'part')} need a size or design chosen on the part's page.` : null,
    ].filter(Boolean);
    if (toAdd.length === 0) {
      toast.info('Nothing new to add', { description: notes.join(' ') || undefined });
      return;
    }
    toast.success(`Added ${pluralize(toAdd.length, 'part')} to the cart`, {
      description: notes.join(' ') || undefined,
      action: { label: 'View cart', onClick: openCart },
    });
  };

  const saveShared = () => {
    const merged = [...sharedIds.filter((id) => !savedIds.includes(id)), ...savedIds];
    const added = merged.length - savedIds.length;
    setAll(merged);
    toast.success(added > 0 ? `Saved ${pluralize(added, 'part')} to your list` : 'All of these were already saved');
    navigate('/wishlist', { replace: true });
  };

  const count = products?.length ?? ids.length;
  const shareUrl = `/wishlist?ids=${ids.join(',')}`;

  const fitLine =
    vehicle && fitCount !== null && products && products.length > 0
      ? `${fitCount} of ${products.length} fit your ${vehicle.model}${noFitCount > 0 ? `, ${noFitCount} do not` : ''}.`
      : null;

  const actions =
    products && products.length > 0 ? (
      <>
        {!isShared && (
          <ShareButton url={shareUrl} title="My saved parts" text={`${pluralize(products.length, 'part')} I have saved`}>
            Share list
          </ShareButton>
        )}
        {isShared ? (
          <Button iconLeft={<Heart />} onClick={saveShared}>
            Save all to my list
          </Button>
        ) : (
          <Button iconLeft={<ShoppingCart />} onClick={addAllInStock} disabled={quickAdd.length === 0}>
            Add everything in stock
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <div className="container-page pb-16 md:pb-24">
      <PageHeader
        title={isShared ? 'A shared list' : 'Saved parts'}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: isShared ? 'Shared list' : 'Saved parts' }]}
        meta={ids.length > 0 ? pluralize(count, 'part') : undefined}
        description={
          isShared
            ? 'Someone sent you these parts. Save them to your own list, or open any of them.'
            : ids.length > 0 && !vehicle
              ? 'Add your car to see which of these fit.'
              : (fitLine ?? undefined)
        }
        actions={actions}
      />

      {ids.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-3">
          {!vehicle && (
            <Button variant="dark" size="sm" iconLeft={<Car />} onClick={openPicker}>
              Add your car
            </Button>
          )}
          {products && !isShared && (
            <p className="type-small text-muted tnum">
              {quickAdd.length > 0 ? `${quickAdd.length} ready to add` : 'None ready to add in one go'}
              {needsChoice.length > 0 && `, ${needsChoice.length} need a choice first`}
              {soldOut > 0 && `, ${soldOut} sold out`}.
            </p>
          )}
          {isShared ? (
            <Link to="/wishlist" className="link type-small ml-auto">
              Show my own list
            </Link>
          ) : (
            !mePending && (
              <p className="type-small ml-auto text-muted">
                {isSignedIn ? (
                  'Kept with your account, on every device you sign in on.'
                ) : (
                  <>
                    Saved on this phone only.{' '}
                    <Link to="/login?next=%2Fwishlist" className="link text-ink">
                      Sign in
                    </Link>{' '}
                    to keep it everywhere.
                  </>
                )}
              </p>
            )
          )}
        </div>
      )}

      {ids.length === 0 ? (
        <div className="grid gap-10 border-t border-ink pt-8">
          <EmptyState
            art={<Heart aria-hidden className="size-8" />}
            title="Nothing saved yet"
            description="Press the heart on any part to keep it here. Handy for thinking it over, or for sending the list to whoever is paying."
            actions={<Button to="/shop">Browse the shop</Button>}
          />
          <CategoryLinks />
        </div>
      ) : error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load your saved parts" />
      ) : (
        <>
          {isShared && products && products.length < sharedIds.length && (
            <Callout tone="info" className="mb-6">
              {sharedIds.length - products.length === 1
                ? 'One part on this list is no longer sold.'
                : `${sharedIds.length - products.length} parts on this list are no longer sold.`}
            </Callout>
          )}
          <ProductGrid
            products={products}
            loading={isPending}
            updating={isPlaceholderData}
            skeletons={Math.min(Math.max(ids.length, 2), 8)}
            eagerCount={2}
            label={isShared ? 'Shared parts' : 'Saved parts'}
            empty={
              <EmptyState
                title="These parts are no longer sold"
                description="They have been taken off the shop since they were saved."
                actions={<Button to="/shop">Browse the shop</Button>}
              />
            }
          />
        </>
      )}
    </div>
  );
}
