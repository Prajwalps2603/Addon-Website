import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

// A plain check rather than zod: the shop page is a landing page, and zod alone is about 30 KB gzipped.
interface SearchInput {
  q: string;
}

function checkQuery(value: string): true | string {
  const q = value.trim();
  if (q.length < 2) return 'Type at least two letters';
  if (q.length > 80) return 'Keep it under 80 characters';
  return true;
}

export interface SearchBoxProps {
  /** The current query, so the box shows what was searched. */
  value: string;
  onSearch: (q: string) => void;
  /** A server error about the query (`fields.q`). */
  serverError?: string;
  autoFocus?: boolean;
  className?: string;
}

/** The search field on the results page: refine the words without leaving the list. */
export function SearchBox({ value, onSearch, serverError, autoFocus, className }: SearchBoxProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SearchInput>({ defaultValues: { q: value } });

  useEffect(() => reset({ q: value }), [value, reset]);
  useEffect(() => {
    if (serverError) setError('q', { type: 'server', message: serverError });
  }, [serverError, setError]);

  return (
    <form role="search" noValidate onSubmit={handleSubmit((values) => onSearch(values.q.trim()))} className={cn('flex items-start gap-2', className)}>
      <Field label="Search the shop" labelHidden error={errors.q?.message} className="min-w-0 flex-1">
        <Input
          {...register('q', { validate: checkQuery })}
          type="search"
          inputSize="lg"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Part name, brand or the word your mechanic uses"
          leading={<Search aria-hidden />}
        />
      </Field>
      <Button type="submit" size="lg" variant="dark">
        Search
      </Button>
    </form>
  );
}
