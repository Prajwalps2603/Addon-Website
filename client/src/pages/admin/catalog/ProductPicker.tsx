import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Plus, Search } from 'lucide-react';
import { ErrorState, ProductFrame } from '@/components/commerce';
import { Badge, Button, Drawer, EmptyState, Field, Input, Skeleton } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { api, type AdminProductQuery } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminProduct } from '@/types/api';

export interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (product: AdminProduct) => void;
  title: string;
  description?: string;
  /** Only products in this category (slug). */
  category?: string;
  /** Only products on sale in the shop. */
  activeOnly?: boolean;
  /** Ids already chosen: shown as added and not pickable again. */
  chosenIds?: readonly number[];
  /** Ids that may not be chosen at all (the product being edited). */
  excludeIds?: readonly number[];
  /** Keep the sheet open after a pick, for adding several. */
  multiple?: boolean;
}

/** A searchable sheet of catalogue products for the admin: name or SKU, with photo, price and stock. */
export function ProductPicker({
  open,
  onClose,
  onPick,
  title,
  description,
  category,
  activeOnly = false,
  chosenIds = [],
  excludeIds = [],
  multiple = false,
}: ProductPickerProps) {
  const [text, setText] = useState('');
  const q = useDebounce(text.trim(), 250);
  const query: AdminProductQuery = { q: q || undefined, category, status: activeOnly ? 'active' : undefined, limit: 30 };
  const { data, isPending, isPlaceholderData, error, refetch } = useQuery({
    queryKey: queryKeys.admin.products.list(query),
    queryFn: ({ signal }) => api.admin.products.list(query, { signal }),
    placeholderData: keepPreviousData,
    enabled: open,
  });

  const items = (data?.items ?? []).filter((p) => !excludeIds.includes(p.id));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      toolbar={
        <Field label="Search by name or SKU" labelHidden>
          <Input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Name or SKU"
            leading={<Search aria-hidden />}
            autoComplete="off"
            enterKeyHint="search"
          />
        </Field>
      }
      footer={
        multiple ? (
          <Button variant="dark" block onClick={onClose}>
            Done
          </Button>
        ) : undefined
      }
    >
      {isPending ? (
        <ul className="grid gap-2" aria-label="Loading products">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="size-14 shrink-0" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} size="sm" title="Could not load products" />
      ) : items.length === 0 ? (
        <EmptyState
          size="sm"
          title={q ? `Nothing matches "${q}"` : 'No products here yet'}
          description={q ? 'Try part of the name, or the SKU.' : activeOnly ? 'Only products on sale in the shop can be chosen.' : undefined}
        />
      ) : (
        <ul className={cn('grid divide-y divide-line transition-opacity dur-quick', isPlaceholderData && 'opacity-60')}>
          {items.map((product) => {
            const chosen = chosenIds.includes(product.id);
            return (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={chosen}
                  onClick={() => {
                    onPick(product);
                    if (!multiple) onClose();
                  }}
                  className="focus-ring flex min-h-16 w-full items-center gap-3 py-2 text-left transition-colors dur-quick hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <ProductFrame image={product.image} alt="" artKind={product.artKind} className="size-14 shrink-0" />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="line-clamp-2 leading-snug font-bold">{product.name}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="type-code text-muted">{product.sku}</span>
                      <span className="type-small tnum">
                        {product.hasVariants && 'From '}
                        {formatINR(product.regularPrice)}
                      </span>
                      <span className={cn('type-small tnum', product.stock <= 0 ? 'text-stop' : 'text-muted')}>
                        {product.stock <= 0 ? 'Sold out' : `${product.stock} in stock`}
                      </span>
                      {!product.isActive && (
                        <Badge size="sm" tone="neutral" variant="outline">
                          Hidden
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span className="flex size-11 shrink-0 items-center justify-center" aria-hidden>
                    {chosen ? <Check className="size-5 text-fit" /> : <Plus className="size-5" />}
                  </span>
                  <span className="sr-only">{chosen ? 'Already added' : 'Choose'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {data && data.total > items.length && !error && (
        <p className="type-small mt-3 text-muted">
          Showing {items.length} of {data.total}. Search to narrow it down.
        </p>
      )}
    </Drawer>
  );
}
