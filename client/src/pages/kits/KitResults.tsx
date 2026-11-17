import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { CircleCheck, Repeat2, ShoppingCart, Undo2, X } from 'lucide-react';
import { Link } from 'react-router';
import { BoardTile, TreadDivider } from '@/components/brand';
import { FitBadge, ProductFrame, StraightLabelChips } from '@/components/commerce';
import { Button, Skeleton, SkeletonText, prefersReducedMotion } from '@/components/ui';
import { useProductsByIds } from '@/hooks/useProducts';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import type { BodyType, KitItem, ProductSummary, Vehicle } from '@/types/api';
import { StudioFitOffer } from '@/features/buildbay/studio';
import { addKitToCart, blurbOf, bodyPlural, needsChoice, type KitTier, type ShownKit } from './kitShared';

// ---------------------------------------------------------------------------- one part

interface PartRowProps {
  item: KitItem;
  vehicle: Vehicle | null;
  bodyType: BodyType | null;
  busy: boolean;
  disabled: boolean;
  onSwap: (product: ProductSummary) => void;
  onRemove: (product: ProductSummary) => void;
}

/** The fit line: the verdict for the car the kit was built for, or what the part is made for when there is no car. */
function FitLine({ product, vehicle, bodyType }: { product: ProductSummary; vehicle: Vehicle | null; bodyType: BodyType | null }) {
  if (vehicle) return <FitBadge product={product} vehicle={vehicle} />;
  if (bodyType && product.fitmentType === 'body_type') {
    return (
      <p className="flex items-start gap-1.5 text-[0.8125rem] leading-snug font-bold text-fit">
        <CircleCheck aria-hidden className="mt-px size-4 shrink-0" />
        Made for {bodyPlural(bodyType)}
      </p>
    );
  }
  return <FitBadge product={product} vehicle={null} />;
}

function PartRow({ item, vehicle, bodyType, busy, disabled, onSwap, onRemove }: PartRowProps) {
  const { product, reason } = item;
  const href = `/p/${product.slug}`;
  return (
    <li className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-[16px] bg-raised p-3 transition-opacity', busy && 'opacity-60')}>
      <Link to={href} tabIndex={-1} aria-hidden className="block self-start overflow-hidden rounded-[12px]">
        <ProductFrame image={product.image} alt="" artKind={product.artKind} className="w-18" />
      </Link>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <Link to={href} className="line-clamp-2 leading-snug font-bold hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
          <span className="shrink-0 text-right font-bold tnum">{formatINR(product.price)}</span>
        </div>
        <p className="text-sm text-muted">{reason}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <FitLine product={product} vehicle={vehicle} bodyType={bodyType} />
          <StraightLabelChips product={product} />
        </div>
        {needsChoice(product) && (
          <p className="type-small text-muted">
            Comes in sizes.{' '}
            <Link to={href} className="link font-bold text-ink">
              Choose one on its page
            </Link>
          </p>
        )}
        <div className="mt-0.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || busy}
            aria-label={`Swap ${product.name} for another option`}
            onClick={() => onSwap(product)}
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold transition-colors hover:bg-ink hover:text-page disabled:opacity-50"
          >
            <Repeat2 aria-hidden className={cn('size-3.5', busy && 'animate-spin')} />
            Swap
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${product.name} from the kit`}
            onClick={() => onRemove(product)}
            className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-muted transition-colors hover:bg-stop-soft hover:text-stop disabled:opacity-50"
          >
            <X aria-hidden className="size-3.5" />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------- one kit

interface KitPanelProps {
  shown: ShownKit;
  budget: number;
  chosen: boolean;
  onChoose: () => void;
  note?: ReactNode;
  vehicle: Vehicle | null;
  bodyType: BodyType | null;
  swappingId: number | null;
  updating: boolean;
  onSwap: (product: ProductSummary) => void;
  onRemove: (product: ProductSummary) => void;
  onRestoreKit: () => void;
  id: string;
}

function KitPanel({ shown, budget, chosen, onChoose, note, vehicle, bodyType, swappingId, updating, onSwap, onRemove, onRestoreKit, id }: KitPanelProps) {
  const { kit, items, total, mrpTotal } = shown;
  const left = budget - total;
  const headingId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-tier={kit.tier}
      className={cn(
        'relative flex w-[86%] max-w-md shrink-0 snap-center flex-col gap-3 rounded-[24px] border-2 bg-surface p-3 transition-colors duration-200 sm:w-[60%] lg:w-auto lg:max-w-none',
        chosen ? 'border-brand' : 'border-transparent',
      )}
    >
      <header className={cn('grid gap-3 rounded-[18px] p-4', chosen ? 'bg-ink text-page' : 'bg-raised')}>
        <div className="flex items-center justify-between gap-3">
          <h3 id={headingId} className="type-h3 italic uppercase">
            {kit.title}
          </h3>
          {chosen ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-brand-ink">
              <CircleCheck aria-hidden className="size-3.5" />
              Your pick
            </span>
          ) : (
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted tnum">{pluralize(items.length, 'part')}</span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="type-price-xl">{formatINR(total)}</span>
          {mrpTotal > total && (
            <span className={cn('text-sm line-through tnum', chosen ? 'text-page/55' : 'text-muted')}>
              <span className="sr-only">MRP total </span>
              {formatINR(mrpTotal)}
            </span>
          )}
        </div>
        <div className="grid gap-1.5">
          <TreadDivider size="sm" progress={budget > 0 ? total / budget : 0} label={`${kit.title} kit: share of the budget used`} />
          <p className={cn('-mt-0.5 flex justify-between text-[0.6875rem] font-semibold tnum', chosen ? 'text-page/50' : 'text-muted')}>
            <span>₹0</span>
            <span>{formatINR(budget)}</span>
          </p>
          <p className={cn('text-xs tnum', chosen ? 'text-page/65' : 'text-muted')}>
            {left > 0 ? `${formatINR(left)} left of ${formatINR(budget)}` : `Uses the whole ${formatINR(budget)}`}
          </p>
        </div>
        <p className={cn('text-sm', chosen ? 'text-page/80' : 'text-muted')}>{blurbOf(kit)}</p>
        {note}
        {!chosen && (
          <div className="hidden lg:block">
            <button
              type="button"
              onClick={onChoose}
              aria-describedby={headingId}
              className="focus-ring h-10 w-full rounded-full bg-ink text-sm font-bold text-page transition-colors hover:bg-brand hover:text-brand-ink"
            >
              Pick this kit
            </button>
          </div>
        )}
      </header>

      {items.length > 0 ? (
        <ul aria-label={`Parts in the ${kit.title} kit`} className="grid gap-2">
          {items.map((item) => (
            <PartRow
              key={item.product.id}
              item={item}
              vehicle={vehicle}
              bodyType={bodyType}
              busy={swappingId === item.product.id}
              disabled={updating}
              onSwap={onSwap}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <div className="grid justify-items-start gap-3 rounded-[16px] bg-raised p-4">
          <p>Every part of this kit has been taken out.</p>
          <Button variant="outline" size="sm" iconLeft={<Undo2 aria-hidden />} onClick={onRestoreKit}>
            Put them back
          </Button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------- the set of kits

export interface KitResultsProps {
  shown: ShownKit[];
  selected: KitTier;
  onSelect: (tier: KitTier) => void;
  budget: number;
  vehicle: Vehicle | null;
  bodyType?: BodyType | null;
  /** A swap or new budget is loading: the old kits stay, dimmed. */
  updating: boolean;
  swappingId: number | null;
  onSwap: (product: ProductSummary) => void;
  onRemove: (product: ProductSummary) => void;
  onRestore: (ids: number[]) => void;
  /** An extra line under a kit's total (the dealer comparison). */
  kitNote?: (shown: ShownKit) => ReactNode;
  idPrefix: string;
}

/**
 * Up to three kits side by side from 1024 px, and below that one panel per screen that swipes
 * sideways, with a row of buttons naming each kit and its total. Swiping picks the kit in view.
 */
export function KitResults({
  shown,
  selected,
  onSelect,
  budget,
  vehicle,
  bodyType = null,
  updating,
  swappingId,
  onSwap,
  onRemove,
  onRestore,
  kitNote,
  idPrefix,
}: KitResultsProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const tiers = shown.map((entry) => entry.kit.tier).join(',');

  const panelFor = useCallback(
    (tier: KitTier) => scroller.current?.querySelector<HTMLElement>(`[data-tier="${tier}"]`) ?? null,
    [],
  );

  const scrollTo = useCallback(
    (tier: KitTier, smooth: boolean) => {
      const box = scroller.current;
      const panel = panelFor(tier);
      if (!box || !panel || box.scrollWidth <= box.clientWidth) return;
      const left = panel.offsetLeft - box.offsetLeft - (box.clientWidth - panel.clientWidth) / 2;
      box.scrollTo({ left, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    },
    [panelFor],
  );

  // Show the chosen kit when the set of kits first appears on a phone.
  // Only when the set of kits changes, not on every pick: a pick has already scrolled there.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    scrollTo(selectedRef.current, false);
  }, [tiers, scrollTo]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  // When a swipe comes to rest, the kit nearest the middle becomes the pick.
  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const box = scroller.current;
      if (!box || box.scrollWidth <= box.clientWidth) return;
      const middle = box.scrollLeft + box.clientWidth / 2 + box.offsetLeft;
      let best: KitTier | null = null;
      let distance = Infinity;
      for (const entry of shown) {
        const panel = panelFor(entry.kit.tier);
        if (!panel) continue;
        const gap = Math.abs(panel.offsetLeft + panel.clientWidth / 2 - middle);
        if (gap < distance) {
          distance = gap;
          best = entry.kit.tier;
        }
      }
      if (best && best !== selected) onSelect(best);
    }, 140);
  };

  const columns = shown.length >= 3 ? 'lg:grid-cols-3' : shown.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1 lg:max-w-xl';

  return (
    <div className="grid gap-3">
      {shown.length > 1 && (
        <div role="group" aria-label="Kits" className="grid auto-cols-fr grid-flow-col gap-1 lg:hidden">
          {shown.map((entry) => {
            const on = entry.kit.tier === selected;
            return (
              <button
                key={entry.kit.tier}
                type="button"
                aria-pressed={on}
                aria-controls={`${idPrefix}-${entry.kit.tier}`}
                onClick={() => {
                  onSelect(entry.kit.tier);
                  scrollTo(entry.kit.tier, true);
                }}
                className={cn(
                  'focus-ring grid min-h-14 content-center gap-0.5 rounded-control border px-2 py-1.5 text-left transition-colors dur-quick',
                  on ? 'border-ink bg-ink text-page' : 'border-line-strong hover:border-ink',
                )}
              >
                <span className="type-label">{entry.kit.title}</span>
                <span className="text-[0.9375rem] leading-tight font-bold tnum">{formatINR(entry.total)}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scroller}
        onScroll={onScroll}
        aria-busy={updating || undefined}
        className={cn(
          'no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-1 transition-opacity dur-base md:-mx-6 md:px-6',
          'lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0',
          columns,
          updating && 'opacity-60',
        )}
      >
        {shown.map((entry) => (
          <KitPanel
            key={entry.kit.tier}
            id={`${idPrefix}-${entry.kit.tier}`}
            shown={entry}
            budget={budget}
            chosen={entry.kit.tier === selected}
            onChoose={() => onSelect(entry.kit.tier)}
            note={kitNote?.(entry)}
            vehicle={vehicle}
            bodyType={bodyType}
            swappingId={swappingId}
            updating={updating}
            onSwap={onSwap}
            onRemove={onRemove}
            onRestoreKit={() => onRestore(entry.kit.items.map((item) => item.product.id))}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- parts taken out

export interface TakenOutProps {
  removed: readonly number[];
  swapped: readonly number[];
  onPutBack: (ids: number[]) => void;
  onUnswap: (ids: number[]) => void;
  disabled?: boolean;
}

/** The parts the shopper removed or swapped out, by name, each with a way back. */
export function TakenOut({ removed, swapped, onPutBack, onUnswap, disabled = false }: TakenOutProps) {
  const ids = [...new Set([...removed, ...swapped])].sort((a, b) => a - b);
  const { data } = useProductsByIds(ids, { withVehicle: false });
  if (ids.length === 0) return null;
  const names = new Map((data ?? []).map((product) => [product.id, product.name]));
  const nameOf = (id: number) => names.get(id) ?? 'A part';

  const row = (id: number, kind: 'removed' | 'swapped') => (
    <li key={`${kind}-${id}`} className="flex min-h-11 items-center justify-between gap-3 border-t border-line py-1.5">
      <span className="min-w-0">
        <span className="font-bold">{nameOf(id)}</span>
        <span className="type-small text-muted"> {kind === 'removed' ? 'removed' : 'swapped out'}</span>
      </span>
      <Button
        variant="link"
        size="sm"
        disabled={disabled}
        onClick={() => (kind === 'removed' ? onPutBack([id]) : onUnswap([id]))}
        aria-label={`Put ${nameOf(id)} back`}
      >
        Put back
      </Button>
    </li>
  );

  return (
    <section aria-label="Parts you took out" className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-h3">Taken out</h3>
        {ids.length > 1 && (
          <Button
            variant="link"
            size="sm"
            disabled={disabled}
            onClick={() => {
              if (removed.length) onPutBack([...removed]);
              if (swapped.length) onUnswap([...swapped]);
            }}
          >
            Put all back
          </Button>
        )}
      </div>
      <ul className="max-w-2xl">
        {removed.map((id) => row(id, 'removed'))}
        {swapped.filter((id) => !removed.includes(id)).map((id) => row(id, 'swapped'))}
      </ul>
      {swapped.length > 0 && (
        <p className="type-small max-w-prose text-muted">Swapped parts are left out when the kits are built, so the next option in the range takes their place.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------- the running total

export interface KitDockProps {
  shown: ShownKit;
  budget: number;
  /** A swap is loading: adding now would add the old parts. */
  busy?: boolean;
}

/**
 * The chosen kit's total against the budget, kept in sight while the kits scroll by, with the
 * page's one main action. Sits above the phone's bottom bar.
 */
export function KitDock({ shown, budget, busy = false }: KitDockProps) {
  const { kit, items, total } = shown;
  return (
    <div className="sticky z-sticky -mx-4 md:mx-0" style={{ bottom: 'calc(var(--bottom-bar-h) + env(safe-area-inset-bottom))' }}>
      <div className="plane-board flex items-center gap-3 px-4 py-3 md:px-5" aria-live="polite">
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="type-label text-muted">
            {kit.title} kit, {pluralize(items.length, 'part')}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <BoardTile tone="brand" size="md" className="px-2">
              {formatINR(total)}
            </BoardTile>
            <span className="type-small text-muted tnum">of {formatINR(budget)}</span>
          </span>
        </div>
        <Button
          iconLeft={<ShoppingCart aria-hidden />}
          disabled={items.length === 0 || busy}
          onClick={() => addKitToCart(items, kit.title)}
          className="shrink-0"
        >
          <span className="sm:hidden">Add kit</span>
          <span className="hidden sm:inline">Add kit to cart</span>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- studio fitting

/**
 * The studio fitting option for the chosen kit: the total fitting charge for its parts (from the store's
 * fitting services) and a way to add the kit marked for fitting at the studio.
 */
export function KitStudioOffer({ shown, busy = false }: { shown: ShownKit; busy?: boolean }) {
  const { kit, items } = shown;
  const sized = items.filter((item) => needsChoice(item.product));
  return (
    <StudioFitOffer
      headingLevel="h2"
      parts={items.map((item) => ({ productId: item.product.id, categorySlug: item.product.categorySlug }))}
      onAddForFitting={busy ? undefined : () => addKitToCart(items, kit.title, { fitAtStudio: true })}
      addLabel={`Add the ${kit.title} kit for fitting`}
      note={
        sized.length > 0
          ? `${sized.map((item) => item.product.name).join(', ')} ${sized.length === 1 ? 'comes' : 'come'} in sizes: add ${sized.length === 1 ? 'it' : 'them'} from ${sized.length === 1 ? 'its page' : 'their pages'} and ask for fitting in the cart.`
          : undefined
      }
      className="max-w-2xl"
    />
  );
}

// ---------------------------------------------------------------------------- loading

/** Laid out like the kits: tabs on a phone, three columns from 1024 px. */
export function KitSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden>
      <div className="grid grid-cols-3 gap-1 lg:hidden">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-14" />
        ))}
      </div>
      <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:-mx-6 md:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:px-0">
        {[0, 1, 2].map((key) => (
          <div key={key} className="grid w-[86%] max-w-md shrink-0 content-start gap-0 border border-line sm:w-[60%] lg:w-auto lg:max-w-none">
            <div className="grid gap-3 border-b border-line p-4">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-2 w-full" />
              <SkeletonText lines={2} />
            </div>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-t border-line px-4 py-4 first:border-t-0">
                <Skeleton className="aspect-square w-18" />
                <div className="grid content-start gap-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="h-3.5 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
