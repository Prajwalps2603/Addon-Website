import { useState, type FormEvent } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { RollingTyre } from '@/components/brand';
import { ErrorState } from '@/components/commerce/ErrorState';
import { Button, Field, Input, Skeleton } from '@/components/ui';
import { CategoryThumb } from '@/components/layout/bits';
import { categoryPath, partsCount, sortCategories } from '@/components/layout/nav';
import { rememberSearch, searchPath } from '@/components/layout/searchHelpers';
import { useCategories } from '@/hooks/useCategories';
import { useDocumentMeta } from '@/lib/seo';

/**
 * Any address the store does not know. Says so plainly, shows where the visitor tried to go,
 * and offers the three ways on: search, the categories, or home.
 */
export default function NotFoundPage() {
  useDocumentMeta({ title: 'Page not found', noindex: true });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = q.trim();
    if (!clean) {
      setError('Type a part, a brand or your car.');
      return;
    }
    rememberSearch(clean);
    navigate(searchPath(clean));
  };

  return (
    <div className="container-page section-y grid gap-12 md:gap-16">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-16">
        <div className="grid gap-5">
          <h1 className="type-display">Wrong turn.</h1>
          <p className="type-lead max-w-prose">
            There is nothing at <span className="type-code break-all align-middle">{pathname}</span>. The link may be old, or the
            part may have moved to a new address.
          </p>
          {/* The tyre track runs out where the road does. */}
          <div aria-hidden className="flex max-w-md items-center gap-2 text-line-strong">
            <span className="tread h-2.5 flex-1" />
            <RollingTyre mode="still" size={36} className="text-ink" />
          </div>
        </div>

        <form role="search" onSubmit={onSubmit} noValidate className="grid gap-3">
          <Field label="Search the shop" error={error}>
            <Input
              inputSize="lg"
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                if (error) setError('');
              }}
              placeholder="Parts, brands or your car"
              leading={<Search aria-hidden />}
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" size="lg">
              Search
            </Button>
            <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
              Back to the home page
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </form>
      </section>

      <MainCategories />
    </div>
  );
}

function MainCategories() {
  const categories = useCategories();
  const sorted = categories.data ? sortCategories(categories.data) : [];

  return (
    <section aria-labelledby="lost-categories" className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink pb-3">
        <h2 id="lost-categories" className="type-h2">
          Or start from a category
        </h2>
        <Link to="/cars" className="inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">
          Shop by car instead
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      {categories.isPending ? (
        <ul aria-hidden className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 border-b border-line py-3">
              <Skeleton className="size-16" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : categories.error ? (
        <ErrorState error={categories.error} onRetry={() => void categories.refetch()} title="The categories did not load" />
      ) : sorted.length === 0 ? (
        <p className="type-body text-muted">No categories are on sale yet. Try the search above, or go back to the home page.</p>
      ) : (
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((category) => (
            <li key={category.id} className="border-b border-line">
              <Link to={categoryPath(category)} className="group flex items-center gap-4 py-3">
                <CategoryThumb image={category.image} artKind={category.artKind} className="size-16 border border-line" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-bold group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {category.name}
                  </span>
                  <span className="type-small text-muted tnum">{partsCount(category.productCount)}</span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-5 shrink-0 transition-transform dur-quick group-hover:translate-x-1 motion-reduce:transition-none"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
