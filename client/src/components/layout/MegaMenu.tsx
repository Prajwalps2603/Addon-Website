import { useId, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Link } from 'react-router';
import { iconForArtKind } from '@/components/commerce/categoryIcons';
import { ErrorState } from '@/components/commerce/ErrorState';
import { Button, Skeleton } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/cn';
import type { Category } from '@/types/api';
import { CategoryThumb } from './bits';
import { moveFocusWithin, useDisclosure } from './hooks';
import { categoryPath, partsCount, sortCategories } from './nav';

const triggerClass =
  'inline-flex h-11 items-center gap-1 rounded-control px-3 font-bold text-ink transition-colors dur-quick hover:bg-surface-2';

/**
 * "Shop": the category mega menu. Left, the nine categories; pointing at or focusing one shows
 * its subcategories, count and photo on the right. Arrow keys move through the list, Right goes
 * into the subcategories and Left comes back, Escape closes and returns to the button.
 */
export function MegaMenu() {
  const menu = useDisclosure<HTMLButtonElement>();
  const categories = useCategories();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const panelId = useId();

  const sorted = categories.data ? sortCategories(categories.data) : [];
  const active = sorted.find((category) => category.slug === activeSlug) ?? sorted[0] ?? null;

  const focusList = (which: 'first' | 'active') => {
    window.requestAnimationFrame(() => {
      const list = menu.panelRef.current?.querySelector<HTMLElement>('[data-mega-list]');
      const target =
        which === 'active'
          ? list?.querySelector<HTMLElement>('[aria-current="true"]')
          : list?.querySelector<HTMLElement>('a[href]');
      target?.focus();
    });
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      menu.setOpen(true);
      focusList('first');
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') {
      const first = menu.panelRef.current?.querySelector<HTMLElement>('[data-mega-detail] a[href]');
      if (first) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (moveFocusWithin(event.currentTarget, event.key, 'a[href]')) event.preventDefault();
  };

  const onDetailKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusList('active');
      return;
    }
    if (moveFocusWithin(event.currentTarget, event.key, 'a[href]')) event.preventDefault();
  };

  return (
    <div onBlur={menu.onBlur}>
      <button
        ref={menu.triggerRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={panelId}
        onClick={() => menu.setOpen(!menu.open)}
        onKeyDown={onTriggerKeyDown}
        className={cn(triggerClass, menu.open && 'bg-surface-2')}
      >
        Shop
        <ChevronDown aria-hidden className={cn('size-4 transition-transform dur-base', menu.open && 'rotate-180')} />
      </button>

      <div
        ref={menu.panelRef}
        id={panelId}
        hidden={!menu.open}
        onClick={menu.onPanelClick}
        className="absolute inset-x-0 top-full animate-fade-in border-y border-ink bg-raised text-ink shadow-pop"
      >
        <div className="container-page grid max-h-[calc(100dvh-6rem)] grid-cols-[17rem_minmax(0,1fr)] gap-8 overflow-y-auto py-6 xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
          {categories.isPending ? (
            <MegaSkeleton />
          ) : categories.error ? (
            <div className="col-span-full">
              <ErrorState error={categories.error} onRetry={() => void categories.refetch()} title="Could not load the categories" size="sm" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="col-span-full type-body text-muted">No categories are on sale yet.</p>
          ) : (
            <>
              <nav aria-label="Categories">
                <ul data-mega-list onKeyDown={onListKeyDown} className="grid border-t border-line">
                  {sorted.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      active={category.slug === active?.slug}
                      onPreview={() => setActiveSlug(category.slug)}
                    />
                  ))}
                </ul>
                <Link
                  to="/shop"
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  Everything in the shop
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </nav>
              {active && <CategoryDetail category={active} onKeyDown={onDetailKeyDown} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ category, active, onPreview }: { category: Category; active: boolean; onPreview: () => void }) {
  const Icon = iconForArtKind(category.artKind);
  return (
    <li className="border-b border-line">
      <Link
        to={categoryPath(category)}
        aria-current={active ? 'true' : undefined}
        onMouseEnter={onPreview}
        onFocus={onPreview}
        className={cn(
          'focus-ring-inset flex min-h-11 items-center gap-3 px-2 py-2 transition-colors dur-quick',
          active ? 'bg-brand-soft' : 'hover:bg-surface-2',
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-bold">{category.name}</span>
        <span className="type-small text-muted tnum">{category.productCount}</span>
      </Link>
    </li>
  );
}

function CategoryDetail({ category, onKeyDown }: { category: Category; onKeyDown: (event: KeyboardEvent<HTMLElement>) => void }) {
  const children = [...category.children].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return (
    <>
      <section data-mega-detail aria-label={category.name} onKeyDown={onKeyDown} className="grid content-start gap-5">
        <div className="flex items-start gap-5">
          <CategoryThumb image={category.image} artKind={category.artKind} alt="" className="size-24 border border-line xl:hidden" />
          <div className="grid gap-2">
            <p className="type-h2">{category.name}</p>
            {category.blurb && <p className="type-body max-w-prose text-muted">{category.blurb}</p>}
            <p className="type-small text-muted tnum">{partsCount(category.productCount)}</p>
          </div>
        </div>
        {children.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-8 border-t border-line">
            {children.map((child) => (
              <li key={child.id} className="border-b border-line">
                <Link
                  to={categoryPath(child, category)}
                  className="focus-ring-inset flex min-h-11 items-center justify-between gap-3 py-2 hover:underline hover:decoration-1 hover:underline-offset-4"
                >
                  <span className="min-w-0 truncate">{child.name}</span>
                  <span className="type-small text-muted tnum">{child.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button to={categoryPath(category)} variant="outline" size="sm" iconRight={<ArrowRight aria-hidden />}>
            All {category.name}
          </Button>
        </div>
      </section>
      <div className="hidden xl:block">
        <CategoryThumb
          image={category.image}
          artKind={category.artKind}
          alt={category.name}
          width={480}
          className="aspect-[4/3] w-full"
        />
      </div>
    </>
  );
}

function MegaSkeleton() {
  return (
    <>
      <div className="grid gap-px border-t border-line" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="flex h-11 items-center gap-3 border-b border-line px-2">
            <Skeleton className="size-5" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
      <div className="grid content-start gap-4" aria-hidden>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-5" />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading categories
      </span>
    </>
  );
}
