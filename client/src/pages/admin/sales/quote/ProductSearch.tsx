import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleX, Plus, Search, X } from 'lucide-react';
import { useId, useState } from 'react';
import { ErrorState, ProductFrame } from '@/components/commerce';
import { Badge, Field, IconButton, Input, Skeleton } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { api, type AdminProductQuery } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR, formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminProduct } from '@/types/api';

export interface ProductSearchProps {
  onAdd: (product: AdminProduct) => void;
  disabled?: boolean;
}

/** Find a part by name, SKU or trade word and add it to the quote. */
export function ProductSearch({ onAdd, disabled = false }: ProductSearchProps) {
  const [text, setText] = useState('');
  const q = useDebounce(text.trim(), 250);
  const resultsId = useId();
  const query: AdminProductQuery = { q, status: 'active', limit: 8 };

  const results = useQuery({
    queryKey: queryKeys.admin.products.list(query),
    queryFn: ({ signal }) => api.admin.products.list(query, { signal }),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });

  const items = results.data?.items ?? [];
  const searching = q.length >= 2;

  return (
    <div className="grid gap-2">
      <Field label="Add a part" hint="Name, SKU or the word the customer used.">
        <Input
          type="search"
          inputSize="lg"
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Swift spoiler, LED H4"
          leading={<Search aria-hidden />}
          trailing={
            text ? (
              <IconButton label="Clear search" size="sm" onClick={() => setText('')}>
                <X aria-hidden />
              </IconButton>
            ) : undefined
          }
          autoComplete="off"
          enterKeyHint="search"
          aria-controls={resultsId}
        />
      </Field>

      <div id={resultsId} aria-live="polite" className={cn(results.isPlaceholderData && 'opacity-60')}>
        {!searching ? null : results.isPending ? (
          <ul className="grid gap-1" aria-busy="true">
            {[0, 1, 2].map((key) => (
              <li key={key} className="grid grid-cols-[3rem_1fr] items-center gap-3 border border-line p-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-4 w-2/3" />
              </li>
            ))}
          </ul>
        ) : results.error ? (
          <ErrorState size="sm" error={results.error} onRetry={() => void results.refetch()} title="Could not search the catalogue" />
        ) : items.length === 0 ? (
          <p className="type-small border border-line p-3 text-muted">No active part matches “{q}”.</p>
        ) : (
          <ul className="grid max-h-96 gap-1 overflow-y-auto overscroll-contain">
            {items.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAdd(product)}
                  className="focus-ring grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border border-line p-2 text-left transition-colors dur-quick hover:border-ink hover:bg-surface"
                >
                  <ProductFrame image={product.image} alt="" artKind={product.artKind} />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate font-bold">{product.name}</span>
                    <span className="type-small flex flex-wrap items-center gap-x-2 text-muted">
                      <span className="type-code">{product.sku}</span>
                      <span className="tnum">{formatINR(product.price)}</span>
                      <span className="tnum">Cost {product.costPrice === null ? 'not set' : formatINR(product.costPrice)}</span>
                      {product.hasVariants && <span>{formatNumber(product.variants.length)} variants</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {!product.inStock && (
                      <Badge tone="stop" size="sm" icon={<CircleX aria-hidden />}>
                        Sold out
                      </Badge>
                    )}
                    <span className="grid size-9 place-items-center rounded-control border border-ink">
                      <Plus aria-hidden className="size-4" />
                      <span className="sr-only">Add {product.name}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
