import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Field, IconButton, Input } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Filters kept in the query string, so a list can be shared, bookmarked and survives Back.
 * Setting any filter other than `page` sends the list back to page 1.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const set = (patch: Partial<Record<K | 'page', string | number | null>>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(patch) as [string, string | number | null | undefined][]) {
          if (value === null || value === undefined || value === '' || (key === 'page' && Number(value) <= 1)) next.delete(key);
          else next.set(key, String(value));
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const hrefFor = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    const query = next.toString();
    return query ? `?${query}` : '?';
  };

  return { values, page, set, hrefFor };
}

export interface SearchBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onSearch: (value: string) => void;
  className?: string;
}

/** A search field that writes to the URL 300 ms after typing stops. */
export function SearchBox({ label, placeholder, value, onSearch, className }: SearchBoxProps) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, 300);
  const latest = useRef(onSearch);
  latest.current = onSearch;

  // Follow the URL when it changes from outside (Back, a link).
  useEffect(() => {
    setText((current) => (current.trim() === value ? current : value));
  }, [value]);

  const lastSent = useRef(value);
  useEffect(() => {
    const next = debounced.trim();
    if (next !== lastSent.current) {
      lastSent.current = next;
      latest.current(next);
    }
  }, [debounced]);
  useEffect(() => {
    lastSent.current = value;
  }, [value]);

  return (
    <Field label={label} labelHidden className={className}>
      <Input
        type="search"
        inputSize="lg"
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
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
      />
    </Field>
  );
}
