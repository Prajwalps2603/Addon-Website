import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Car, CircleCheck, CircleHelp, CircleX, Clock, Mic, MicOff, Search, Wrench, X, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { describeFit, type FitState } from '@/components/commerce/FitBadge';
import { iconForArtKind } from '@/components/commerce/categoryIcons';
import { Button, IconButton, Input, Portal, Skeleton, useEscapeKey, useFocusTrap, usePresence, useScrollLock } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useCategories } from '@/hooks/useCategories';
import { useDebounce } from '@/hooks/useDebounce';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useUi } from '@/stores/ui';
import type { Category, ProductSummary, Vehicle } from '@/types/api';
import { CategoryThumb } from './bits';
import { categoryPath, sortCategories } from './nav';
import { clearRecentSearches, readRecentSearches, rememberSearch, searchPath, useVoiceInput } from './searchHelpers';

/** Is the key press meant for a text field? Then "/" is a character, not the shortcut. */
function typingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * The search overlay: opened from the header, the bottom bar or the "/" key.
 * Suggestions come from the suggest endpoint for the active car.
 */
export function SearchOverlay() {
  const open = useUi((state) => state.searchOpen);
  const presence = usePresence(open, 200);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (typingInto(event.target) || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      useUi.getState().openSearch();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!presence.mounted) return null;
  return <SearchPanel open={open} />;
}

interface Option {
  key: string;
  /** Where choosing it goes. */
  to?: string;
  /** Or what choosing it does. */
  run?: () => void;
  /** Saved to recent searches when chosen. */
  remember?: string;
  content: ReactNode;
}

interface Section {
  key: string;
  title: string;
  options: Option[];
}

const FIT_TONE: Record<string, string> = {
  fit: 'text-fit',
  warn: 'text-warn',
  stop: 'text-stop',
  info: 'text-info',
  plain: 'text-muted',
};

const FIT_ICON: Record<FitState, LucideIcon> = {
  direct: CircleCheck,
  universal: CircleCheck,
  with_work: Wrench,
  no: CircleX,
  unknown: CircleHelp,
  select: Car,
};

function findCategoryPath(tree: readonly Category[] | undefined, slug: string): string {
  for (const top of tree ?? []) {
    if (top.slug === slug) return categoryPath(top);
    const child = top.children.find((item) => item.slug === slug);
    if (child) return categoryPath(child, top);
  }
  return `/shop/${slug}`;
}

function carPath(vehicle: Pick<Vehicle, 'makeSlug' | 'modelSlug'>): string {
  return `/cars/${vehicle.makeSlug}/${vehicle.modelSlug}`;
}

function SearchPanel({ open }: { open: boolean }) {
  const close = useUi((state) => state.closeSearch);
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const navigate = useNavigate();
  const vehicle = useActiveVehicle();
  const categories = useCategories();
  const baseId = useId();
  const listId = `${baseId}-list`;

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useScrollLock(true);
  useFocusTrap(panelRef, open, inputRef);
  useEscapeKey(open, close);

  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches());
  const [active, setActive] = useState(-1);
  const term = useDebounce(q.trim(), 200);
  const typed = term.length >= 2;

  const suggest = useQuery({
    queryKey: queryKeys.products.suggest(term, vehicle?.id),
    queryFn: ({ signal }) => api.catalog.suggest({ q: term, vehicleId: vehicle?.id }, { signal }),
    enabled: typed,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const submit = (query: string) => {
    const clean = query.trim();
    if (!clean) {
      inputRef.current?.focus();
      return;
    }
    rememberSearch(clean);
    close();
    navigate(searchPath(clean));
  };

  const voice = useVoiceInput({
    onText: (text) => setQ(text),
    onDone: (text) => submit(text),
  });

  const sections = useMemo<Section[]>(() => {
    const list: Section[] = [];

    if (!typed) {
      if (recent.length > 0) {
        list.push({
          key: 'recent',
          title: 'Recent searches',
          options: [
            ...recent.map((item) => ({
              key: `recent-${item}`,
              to: searchPath(item),
              remember: item,
              content: (
                <span className="flex items-center gap-3">
                  <Clock aria-hidden className="size-5 shrink-0 text-muted" />
                  <span className="min-w-0 truncate">{item}</span>
                </span>
              ),
            })),
            {
              key: 'recent-clear',
              run: () => {
                clearRecentSearches();
                setRecent([]);
                setActive(-1);
                inputRef.current?.focus();
              },
              content: <span className="type-small font-bold underline decoration-1 underline-offset-4">Clear recent searches</span>,
            },
          ],
        });
      }

      if (vehicle) {
        list.push({
          key: 'your-car',
          title: 'Your car',
          options: [
            {
              key: 'your-car',
              to: carPath(vehicle),
              content: <CarRow vehicle={vehicle} />,
            },
          ],
        });
      }

      const popular = categories.data
        ? sortCategories(categories.data)
            .filter((category) => category.productCount > 0)
            .sort((a, b) => b.productCount - a.productCount)
            .slice(0, 6)
        : [];
      if (popular.length > 0) {
        list.push({
          key: 'popular',
          title: 'Popular categories',
          options: popular.map((category) => {
            const Icon = iconForArtKind(category.artKind);
            return {
              key: `popular-${category.slug}`,
              to: categoryPath(category),
              content: (
                <span className="flex items-center gap-3">
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-bold">{category.name}</span>
                  <span className="type-small text-muted tnum">{category.productCount}</span>
                </span>
              ),
            };
          }),
        });
      }
      return list;
    }

    const data = suggest.data;
    if (data) {
      if (data.products.length > 0) {
        list.push({
          key: 'products',
          title: 'Parts',
          options: data.products.map((product) => ({
            key: `product-${product.id}`,
            to: `/p/${product.slug}`,
            remember: term,
            content: <ProductRow product={product} vehicle={vehicle} />,
          })),
        });
      }
      if (data.categories.length > 0) {
        list.push({
          key: 'categories',
          title: 'Categories',
          options: data.categories.map((category) => ({
            key: `category-${category.slug}`,
            to: findCategoryPath(categories.data, category.slug),
            remember: term,
            content: (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-bold">{category.name}</span>
                {category.parentName && <span className="type-small truncate text-muted">in {category.parentName}</span>}
              </span>
            ),
          })),
        });
      }
      if (data.vehicles.length > 0) {
        list.push({
          key: 'cars',
          title: 'Cars',
          options: data.vehicles.map((car) => ({
            key: `car-${car.id}`,
            to: carPath(car),
            remember: term,
            content: <CarRow vehicle={car} />,
          })),
        });
      }
    }
    list.push({
      key: 'all',
      title: 'Everything',
      options: [
        {
          key: 'all',
          to: searchPath(term),
          remember: term,
          content: (
            <span className="flex items-center gap-3 font-bold">
              <Search aria-hidden className="size-5 shrink-0" />
              <span className="min-w-0 truncate">Search all parts for “{term}”</span>
              <ArrowRight aria-hidden className="ml-auto size-4 shrink-0" />
            </span>
          ),
        },
      ],
    });
    return list;
  }, [typed, recent, vehicle, categories.data, suggest.data, term]);

  const options = useMemo(() => sections.flatMap((section) => section.options), [sections]);
  const optionId = (index: number) => `${baseId}-option-${index}`;

  // A new set of suggestions starts with nothing highlighted, so Enter searches what was typed.
  useEffect(() => {
    setActive(-1);
  }, [term, typed]);

  useEffect(() => {
    if (active >= 0) document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, baseId]);

  const choose = (option: Option) => {
    if (option.run) {
      option.run();
      return;
    }
    if (option.remember) rememberSearch(option.remember);
    close();
    if (option.to) navigate(option.to);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && options.length > 0) {
      event.preventDefault();
      setActive((now) => (now + 1) % options.length);
    } else if (event.key === 'ArrowUp' && options.length > 0) {
      event.preventDefault();
      setActive((now) => (now <= 0 ? options.length - 1 : now - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = active >= 0 ? options[active] : undefined;
      if (option) choose(option);
      else submit(q);
    }
  };

  const showSkeleton = typed && suggest.isPending;
  const noMatches =
    typed && suggest.data && suggest.data.products.length + suggest.data.categories.length + suggest.data.vehicles.length === 0;
  const closing = !open;
  let index = -1;

  return (
    <Portal>
      <div data-print="hide" className="fixed inset-0 z-overlay">
        <div aria-hidden onClick={close} className={cn('absolute inset-0 bg-overlay', closing ? 'animate-fade-out' : 'animate-fade-in')} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          tabIndex={-1}
          data-state={open ? 'open' : 'closed'}
          className={cn(
            'absolute inset-0 flex flex-col bg-raised text-ink outline-hidden',
            'md:bottom-auto md:max-h-[min(46rem,calc(100dvh-3rem))] md:border-b md:border-ink md:shadow-sheet',
            closing ? 'animate-fade-out' : 'animate-fade-in',
          )}
        >
          <div className="border-b border-line">
            <div className="container-page">
              <form
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(q);
                }}
                className="mx-auto flex w-full max-w-3xl items-center gap-2 py-1"
              >
                <Input
                  ref={inputRef}
                  inputSize="lg"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Parts, brands or your car"
                  aria-label="Search parts, categories and cars"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={options.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? optionId(active) : undefined}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  inputMode="search"
                  className={cn(
                    // A plain command bar: no box, no outline, the header's bottom line does the framing.
                    'h-14 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0',
                    'focus-within:border-0 focus-within:outline-0 focus-within:outline-offset-0',
                    '[&_input]:px-3 [&_input]:text-base',
                  )}
                  leading={<Search aria-hidden className="!size-[1.125rem] text-muted" />}
                  trailing={
                    <span className="flex items-center">
                      {q && (
                        <IconButton
                          label="Clear the search"
                          size="sm"
                          onClick={() => {
                            setQ('');
                            inputRef.current?.focus();
                          }}
                        >
                          <X aria-hidden />
                        </IconButton>
                      )}
                      {voice.supported && (
                        <IconButton
                          label={voice.state === 'listening' ? 'Stop listening' : 'Search by voice'}
                          size="sm"
                          aria-pressed={voice.state === 'listening'}
                          onClick={voice.state === 'listening' ? voice.stop : voice.start}
                          className={cn(voice.state === 'listening' && 'bg-brand text-brand-ink hover:bg-brand-press')}
                        >
                          {voice.state === 'listening' ? <MicOff aria-hidden /> : <Mic aria-hidden />}
                        </IconButton>
                      )}
                    </span>
                  }
                />
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close search"
                  title="Close (Esc)"
                  className="focus-ring tap-44 grid h-7 min-w-9 shrink-0 place-items-center rounded-[8px] border border-line bg-surface px-2 font-sans text-[0.6875rem] font-semibold text-ink shadow-[inset_0_-1.5px_0_var(--line)] transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
                >
                  <span aria-hidden className="hidden md:inline">Esc</span>
                  <X aria-hidden className="size-3.5 md:hidden" />
                </button>
              </form>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="container-page">
              <div className="mx-auto grid w-full max-w-3xl gap-4 pt-3 pb-8">
                <p aria-live="polite" className={cn('type-small', voice.state === 'error' ? 'text-stop' : 'text-muted', !voice.error && voice.state !== 'listening' && 'sr-only')}>
                  {voice.state === 'listening' ? 'Listening. Say a part or your car.' : voice.error}
                </p>

                <CarLine vehicle={vehicle} onChange={openVehiclePicker} />

                {typed && suggest.data?.understoodAs && (
                  <p className="type-small" aria-live="polite">
                    Showing results for <strong className="font-bold">{suggest.data.understoodAs}</strong>
                  </p>
                )}

                {typed && suggest.error && !suggest.data ? (
                  <div role="alert" className="grid gap-3 border-y border-line py-4">
                    <p className="font-bold">Suggestions did not load</p>
                    <p className="type-small text-muted">{errorMessage(suggest.error)} You can still press Enter to search.</p>
                    <div className="flex gap-2">
                      <Button variant="dark" size="sm" onClick={() => void suggest.refetch()}>
                        Try again
                      </Button>
                    </div>
                  </div>
                ) : showSkeleton ? (
                  <SuggestSkeleton />
                ) : (
                  noMatches && (
                    <p className="type-body" role="status">
                      Nothing matched “{term}”. Try a shorter word, the part’s everyday name, or search the whole catalogue.
                    </p>
                  )
                )}

                <div
                  id={listId}
                  role="listbox"
                  aria-label="Suggestions"
                  aria-busy={(typed && suggest.isFetching) || undefined}
                  className={cn('grid gap-5 transition-opacity dur-base', typed && suggest.isPlaceholderData && 'opacity-60')}
                >
                  {sections.map((section) => (
                    <div key={section.key} role="group" aria-labelledby={`${baseId}-${section.key}`} className="grid">
                      <p id={`${baseId}-${section.key}`} role="presentation" className="type-label border-b border-line pb-2 text-muted">
                        {section.title}
                      </p>
                      {section.options.map((option) => {
                        index += 1;
                        const position = index;
                        const selected = position === active;
                        const rowClass = cn(
                          'flex min-h-12 w-full items-center gap-3 border-b border-line px-2 py-2 text-left transition-colors dur-quick',
                          selected ? 'bg-brand-soft' : 'hover:bg-surface-2',
                        );
                        return option.to ? (
                          <Link
                            key={option.key}
                            id={optionId(position)}
                            role="option"
                            aria-selected={selected}
                            tabIndex={-1}
                            to={option.to}
                            onMouseMove={() => setActive(position)}
                            onClick={() => {
                              if (option.remember) rememberSearch(option.remember);
                              close();
                            }}
                            className={rowClass}
                          >
                            {option.content}
                          </Link>
                        ) : (
                          <div
                            key={option.key}
                            id={optionId(position)}
                            role="option"
                            aria-selected={selected}
                            onMouseMove={() => setActive(position)}
                            onClick={() => choose(option)}
                            className={cn(rowClass, 'cursor-pointer')}
                          >
                            {option.content}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function CarLine({ vehicle, onChange }: { vehicle: Vehicle | null; onChange: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-small">
      <Car aria-hidden className="size-4 shrink-0" />
      {vehicle ? (
        <span>
          Fit is checked against your <strong className="font-bold">{vehicle.label}</strong>.
        </span>
      ) : (
        <span className="text-muted">Add your car and every part says whether it fits.</span>
      )}
      <button type="button" onClick={onChange} className="min-h-11 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
        {vehicle ? 'Change car' : 'Add your car'}
      </button>
    </div>
  );
}

function CarRow({ vehicle }: { vehicle: Vehicle }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Car aria-hidden className="size-5 shrink-0" />
      <span className="grid min-w-0">
        <span className="truncate font-bold">
          Shop parts for {vehicle.make} {vehicle.model}
        </span>
        <span className="type-small truncate text-muted">{vehicle.label}</span>
      </span>
    </span>
  );
}

function ProductRow({ product, vehicle }: { product: ProductSummary; vehicle: Vehicle | null }) {
  const fit = vehicle ? describeFit(product, vehicle) : null;
  const FitIcon = fit ? FIT_ICON[fit.state] : null;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <CategoryThumb image={product.image} artKind={product.artKind} width={480} className="size-14 border border-line" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="line-clamp-2 leading-snug font-bold">{product.name}</span>
        {fit && FitIcon && fit.state !== 'select' && (
          <span className={cn('type-small flex items-center gap-1 font-bold', FIT_TONE[fit.tone])}>
            <FitIcon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{fit.short}</span>
          </span>
        )}
        {!product.inStock && <span className="type-small font-bold text-stop">Sold out</span>}
      </span>
      <span className="grid shrink-0 justify-items-end self-start pt-0.5">
        <span className="type-price">
          {product.hasVariants && <span className="type-small font-normal text-muted">from </span>}
          {formatINR(product.price)}
        </span>
        {product.mrp > product.price && <span className="type-mrp">{formatINR(product.mrp)}</span>}
      </span>
    </span>
  );
}

function SuggestSkeleton() {
  return (
    <div className="grid" aria-hidden>
      <Skeleton className="mb-2 h-3 w-16" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line py-2">
          <Skeleton className="size-14" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}
