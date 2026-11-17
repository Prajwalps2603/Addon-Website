import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { Link } from 'react-router';
import { CompoundRing, compoundFor } from '@/components/brand';
import { LEGALITY_WORDS } from '@/components/commerce';
import { Button, Checkbox, Chip, Field, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber } from '@/lib/format';
import type { Category, ProductFacets } from '@/types/api';
import { DIFFICULTY_LEVELS, tagLabel, type ShopFilters } from './shopQuery';

export interface FilterPanelProps {
  filters: ShopFilters;
  onChange: (next: ShopFilters) => void;
  facets: ProductFacets | undefined;
  /**
   * `link` lists categories as links to their pages (/shop), `param` narrows the search to one
   * category (/search), `none` leaves the section out (category pages carry their own chips).
   */
  categoryMode: 'none' | 'link' | 'param';
  /** The category tree, for parent names and paths. */
  tree: Category[] | undefined;
  /** The query string to carry over when following a category link. */
  carrySearch: string;
  /** Shows "In the Friday Five" while a drop is live. */
  dropLive: boolean;
  /** Field errors for the price range from the server (`minPrice`, `maxPrice`). */
  serverErrors?: Record<string, string>;
  /**
   * The phone sheet edits a draft: a typed price goes into it as soon as it is valid, so it is not
   * lost when the shopper presses "Show N parts" without "Set price". The sidebar waits for "Set price".
   */
  draft?: boolean;
  className?: string;
}

function Group({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid gap-2 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="type-label">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A checkbox row whose label carries its count on the right. */
function CountedCheckbox({
  label,
  count,
  checked,
  onToggle,
}: {
  label: ReactNode;
  count?: number;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  const empty = count === 0 && !checked;
  return (
    <Checkbox
      checked={checked}
      disabled={empty}
      onChange={(event) => onToggle(event.target.checked)}
      className="py-1.5 [&>span:last-child]:flex-1"
      label={
        <span className="flex w-full items-baseline justify-between gap-3">
          <span>{label}</span>
          {count !== undefined && <span className="type-small text-muted tnum">{formatNumber(count)}</span>}
        </span>
      }
    />
  );
}

// ---------------------------------------------------------------------------- price

// Plain checks rather than zod: the shop page is a landing page, and zod alone is about 30 KB gzipped.
interface PriceInput {
  min: string;
  max: string;
}
type PriceOutput = PriceInput;

const RUPEES = /^\d{0,7}$/;

/** The trimmed prices, or the message for each field that is wrong. */
function checkPrice(values: Partial<PriceInput>): { data: PriceOutput } | { errors: Partial<Record<keyof PriceInput, string>> } {
  const min = (values.min ?? '').trim();
  const max = (values.max ?? '').trim();
  const errors: Partial<Record<keyof PriceInput, string>> = {};
  if (!RUPEES.test(min)) errors.min = 'Whole rupees, digits only';
  if (!RUPEES.test(max)) errors.max = 'Whole rupees, digits only';
  if (!errors.min && !errors.max && min && max && Number(min) > Number(max)) errors.max = 'The highest price is below the lowest';
  return errors.min || errors.max ? { errors } : { data: { min, max } };
}

const priceResolver: Resolver<PriceInput, unknown, PriceOutput> = (values) => {
  const checked = checkPrice(values);
  if ('data' in checked) return { values: checked.data, errors: {} };
  const errors: Partial<Record<keyof PriceInput, { type: string; message: string }>> = {};
  for (const [name, message] of Object.entries(checked.errors) as [keyof PriceInput, string][]) {
    errors[name] = { type: 'validate', message };
  }
  return { values: {}, errors };
};

function toRupees(value: string | undefined): number | null {
  const text = value?.trim() ?? '';
  return text ? Number(text) : null;
}

function PriceRange({
  filters,
  onChange,
  bounds,
  serverErrors,
  instant = false,
}: {
  filters: ShopFilters;
  onChange: (next: ShopFilters) => void;
  bounds: { min: number; max: number } | undefined;
  serverErrors?: Record<string, string>;
  /** Pass each valid price straight to onChange (the phone sheet's draft). */
  instant?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    setError,
    formState: { errors },
  } = useForm<PriceInput, unknown, PriceOutput>({
    resolver: priceResolver,
    defaultValues: { min: filters.minPrice?.toString() ?? '', max: filters.maxPrice?.toString() ?? '' },
  });

  // The fields follow the filters: a removed chip, Back or "Clear all" clears them. Values the
  // shopper is typing already match, so they are left alone (no jumping caret).
  useEffect(() => {
    const typed = getValues();
    if (toRupees(typed.min) === filters.minPrice && toRupees(typed.max) === filters.maxPrice) return;
    reset({ min: filters.minPrice?.toString() ?? '', max: filters.maxPrice?.toString() ?? '' });
  }, [filters.minPrice, filters.maxPrice, reset, getValues]);

  const latest = useRef({ filters, onChange });
  latest.current = { filters, onChange };
  useEffect(() => {
    if (!instant) return;
    const subscription = watch((values) => {
      const parsed = checkPrice(values);
      if (!('data' in parsed)) return;
      const minPrice = toRupees(parsed.data.min);
      const maxPrice = toRupees(parsed.data.max);
      const current = latest.current.filters;
      if (current.minPrice === minPrice && current.maxPrice === maxPrice) return;
      latest.current.onChange({ ...current, minPrice, maxPrice });
    });
    return () => subscription.unsubscribe();
  }, [instant, watch]);

  useEffect(() => {
    if (serverErrors?.minPrice) setError('min', { type: 'server', message: serverErrors.minPrice });
    if (serverErrors?.maxPrice) setError('max', { type: 'server', message: serverErrors.maxPrice });
  }, [serverErrors, setError]);

  const submit = handleSubmit((values) => {
    onChange({
      ...filters,
      minPrice: values.min ? Number(values.min) : null,
      maxPrice: values.max ? Number(values.max) : null,
    });
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="From" error={errors.min?.message}>
          <Input
            {...register('min')}
            inputMode="numeric"
            autoComplete="off"
            leading="₹"
            placeholder={bounds ? formatNumber(bounds.min) : '0'}
            className="tnum"
          />
        </Field>
        <Field label="To" error={errors.max?.message}>
          <Input
            {...register('max')}
            inputMode="numeric"
            autoComplete="off"
            leading="₹"
            placeholder={bounds ? formatNumber(bounds.max) : 'Any'}
            className="tnum"
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        {bounds && bounds.max > 0 ? (
          <p className="type-small text-muted tnum">
            {formatINR(bounds.min)} to {formatINR(bounds.max)} here
          </p>
        ) : (
          <span />
        )}
        {!instant && (
          <Button type="submit" size="sm" variant="dark" className="rounded-full">
            Set price
          </Button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------- categories

interface CategoryOption {
  slug: string;
  name: string;
  count: number;
  path: string;
}

interface CategoryGroup {
  slug: string | null;
  name: string | null;
  options: CategoryOption[];
}

function groupCategories(facets: ProductFacets['categories'], tree: Category[] | undefined): CategoryGroup[] {
  const parents = new Map((tree ?? []).map((category) => [category.slug, category]));
  const groups = new Map<string, CategoryGroup>();
  // A facet row for a top-level category stands for the whole group; its children are listed under it.
  const subRows = facets.filter((row) => row.parentSlug !== null);
  const rows = subRows.length > 0 ? subRows : facets;
  for (const row of rows) {
    const parentSlug = row.parentSlug;
    const key = parentSlug ?? '';
    let group = groups.get(key);
    if (!group) {
      group = {
        slug: parentSlug,
        name: parentSlug ? (parents.get(parentSlug)?.name ?? facets.find((f) => f.slug === parentSlug)?.name ?? null) : null,
        options: [],
      };
      groups.set(key, group);
    }
    group.options.push({
      slug: row.slug,
      name: row.name,
      count: row.count,
      path: parentSlug ? `/shop/${parentSlug}/${row.slug}` : `/shop/${row.slug}`,
    });
  }
  return [...groups.values()];
}

function CategoryOptions({
  mode,
  facets,
  tree,
  selected,
  carrySearch,
  onSelect,
}: {
  mode: 'link' | 'param';
  facets: ProductFacets['categories'];
  tree: Category[] | undefined;
  selected: string | null;
  carrySearch: string;
  onSelect: (slug: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups = groupCategories(facets, tree);
  const total = groups.reduce((sum, group) => sum + group.options.length, 0);
  const limit = expanded ? Infinity : 10;
  let shown = 0;

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const options = group.options.filter(() => shown++ < limit);
        if (options.length === 0) return null;
        return (
          <div key={group.slug ?? 'top'} className="grid gap-0.5">
            {group.name && <p className="type-small font-bold text-muted">{group.name}</p>}
            <ul className="-mx-2 grid">
              {options.map((option) => {
                const isSelected = selected === option.slug;
                const disabled = option.count === 0 && !isSelected;
                const row = (
                  <>
                    <span className="min-w-0 truncate">{option.name}</span>
                    <span className="type-small text-muted tnum">{formatNumber(option.count)}</span>
                  </>
                );
                const rowClass = cn(
                  'focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-2 text-left',
                  'transition-colors dur-quick hover:bg-surface-2',
                  isSelected && 'bg-brand-soft font-bold',
                  disabled && 'pointer-events-none opacity-45',
                );
                return (
                  <li key={option.slug}>
                    {mode === 'link' ? (
                      <Link
                        to={{ pathname: option.path, search: carrySearch }}
                        aria-disabled={disabled || undefined}
                        tabIndex={disabled ? -1 : undefined}
                        className={rowClass}
                      >
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        disabled={disabled}
                        onClick={() => onSelect(isSelected ? null : option.slug)}
                        className={rowClass}
                      >
                        {row}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {total > 10 && (
        <Button variant="link" onClick={() => setExpanded((open) => !open)} className="justify-self-start [--button-text:0.875rem]">
          {expanded ? 'Show fewer' : `Show all ${total} categories`}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- the panel

const LEGALITY_ORDER = ['road_legal', 'check_rules', 'off_road_only'] as const;

/** The words for "I can fit it myself" at each level, shared with the applied-filter chips. */
export function difficultyLabel(level: number): string {
  if (level <= 1) return 'Plug in only';
  if (level === 2) return 'Easy DIY or easier';
  if (level === 3) return 'DIY with tools or easier';
  return `Difficulty ${level} or easier`;
}

/**
 * Every filter the facets support. Used twice: as the sidebar on a desktop (each change applies at
 * once) and inside the filter sheet on a phone (changes go to a draft until "Show N parts").
 */
export function FilterPanel({
  filters,
  onChange,
  facets,
  categoryMode,
  tree,
  carrySearch,
  dropLive,
  serverErrors,
  draft = false,
  className,
}: FilterPanelProps) {
  const [allTags, setAllTags] = useState(false);
  const set = (patch: Partial<ShopFilters>) => onChange({ ...filters, ...patch });

  const tags = facets?.tags ?? [];
  // Selected tags stay visible even when the current results no longer carry them.
  const tagRows = [
    ...tags,
    ...filters.tags.filter((tag) => !tags.some((row) => row.tag === tag)).map((tag) => ({ tag, count: 0 })),
  ];
  const visibleTags = allTags ? tagRows : tagRows.slice(0, 8);
  const legalityCounts = new Map((facets?.legality ?? []).map((row) => [row.value, row.count]));
  const showCategories = categoryMode !== 'none' && (facets?.categories.length ?? 0) > 0;

  return (
    <div className={cn('grid', className)}>
      {showCategories && (
        <Group title="Category">
          <CategoryOptions
            mode={categoryMode === 'link' ? 'link' : 'param'}
            facets={facets?.categories ?? []}
            tree={tree}
            selected={filters.category}
            carrySearch={carrySearch}
            onSelect={(slug) => set({ category: slug })}
          />
        </Group>
      )}

      <Group title="Price">
        <PriceRange filters={filters} onChange={onChange} bounds={facets?.price} serverErrors={serverErrors} instant={draft} />
      </Group>

      <Group title="Availability">
        <div className="grid">
          <CountedCheckbox label="In stock" count={facets?.inStockCount} checked={filters.inStock} onToggle={(on) => set({ inStock: on })} />
          <CountedCheckbox label="On sale" count={facets?.onSaleCount} checked={filters.onSale} onToggle={(on) => set({ onSale: on })} />
          {(dropLive || filters.inDrop) && (
            <CountedCheckbox label="In the Friday Five" checked={filters.inDrop} onToggle={(on) => set({ inDrop: on })} />
          )}
          {/* Reached from the home page's links; shown while on so they can be taken off here too. */}
          {filters.isNew && <CountedCheckbox label="New in" checked onToggle={(on) => set({ isNew: on })} />}
          {filters.featured && <CountedCheckbox label="Featured" checked onToggle={(on) => set({ featured: on })} />}
        </div>
      </Group>

      <Group title="Road legality">
        <div className="flex flex-wrap gap-2">
          {LEGALITY_ORDER.map((value) => {
            const count = legalityCounts.get(value) ?? 0;
            const selected = filters.legality === value;
            return (
              <Chip
                key={value}
                size="sm"
                selected={selected}
                count={facets ? count : undefined}
                disabled={Boolean(facets) && count === 0 && !selected}
                onClick={() => set({ legality: selected ? null : value })}
              >
                {LEGALITY_WORDS[value].chip}
              </Chip>
            );
          })}
        </div>
      </Group>

      <Group title="I can fit it myself">
        <div className="grid gap-1">
          {DIFFICULTY_LEVELS.map((level) => {
            const selected = filters.maxDifficulty === level;
            const info = compoundFor(level);
            return (
              <button
                key={level}
                type="button"
                aria-pressed={selected}
                onClick={() => set({ maxDifficulty: selected ? null : level })}
                className={cn(
                  'focus-ring -mx-2 flex min-h-11 items-center gap-3 rounded-control px-2 text-left transition-colors dur-quick hover:bg-surface-2',
                  selected && 'bg-brand-soft',
                )}
              >
                <span aria-hidden>
                  <CompoundRing difficulty={level} size={24} showLabel={false} />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className={cn('leading-snug', selected && 'font-bold')}>
                    {difficultyLabel(level)}
                  </span>
                  <span className="type-small text-muted">{info.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Group>

      {tagRows.length > 0 && (
        <Group title="Features">
          <div className="grid">
            {visibleTags.map((row) => (
              <CountedCheckbox
                key={row.tag}
                label={tagLabel(row.tag)}
                count={row.count}
                checked={filters.tags.includes(row.tag)}
                onToggle={(on) =>
                  set({ tags: on ? [...filters.tags, row.tag] : filters.tags.filter((tag) => tag !== row.tag) })
                }
              />
            ))}
          </div>
          {tagRows.length > 8 && (
            <Button variant="link" onClick={() => setAllTags((open) => !open)} className="justify-self-start [--button-text:0.875rem]">
              {allTags ? 'Show fewer' : `Show all ${tagRows.length}`}
            </Button>
          )}
        </Group>
      )}
    </div>
  );
}
