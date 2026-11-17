import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { SectionHeading } from '@/components/commerce';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { imageVariant } from '@/lib/images';
import { pluralize } from '@/lib/format';
import type { Category } from '@/types/api';

const GRID = 'grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5';

/** One category: a rounded photo with the name and part count laid over a dark fade. */
function Tile({ category, eager }: { category: Category; eager: boolean }) {
  const photo = category.image ? imageVariant(category.image, 480) : '';
  return (
    <li className="min-w-0">
      <Link
        to={`/shop/${category.slug}`}
        className="focus-ring group relative block aspect-[4/5] transform-gpu overflow-hidden rounded-[14px] bg-black transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgb(12_13_15/0.5)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:aspect-[4/3]"
      >
        {photo && (
          <img
            src={photo}
            srcSet={category.image ? `${photo} 480w, ${category.image} 1200w` : undefined}
            sizes="(min-width: 48rem) 33vw, 50vw"
            alt=""
            width={480}
            height={360}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="absolute inset-0 size-full transform-gpu object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgb(12_13_15/0.92)_0%,rgb(12_13_15/0.55)_38%,rgb(12_13_15/0.05)_70%)] transition-opacity duration-300"
        />
        <span
          aria-hidden
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 text-black translate-y-1 opacity-0 transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:hidden"
        >
          <ArrowUpRight className="size-4" />
        </span>
        <span className="absolute inset-x-0 bottom-0 grid gap-1 p-3.5 text-white sm:p-5">
          <span className="font-display text-[clamp(1.05rem,2.4vw,1.5rem)] leading-[1.05] font-black uppercase italic [font-stretch:85%]">
            {category.name}
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold text-white/75 sm:text-sm">
            <span className="h-0.5 w-5 -skew-x-12 bg-brand" aria-hidden />
            {pluralize(category.productCount, 'part')}
          </span>
        </span>
      </Link>
    </li>
  );
}

export interface CategoryTilesProps {
  categories: Category[] | undefined;
  loading: boolean;
}

export function CategoryTiles({ categories, loading }: CategoryTilesProps) {
  const items = categories ?? [];

  if (loading && items.length === 0) {
    return (
      <Shell>
        <ul aria-hidden className={GRID}>
          {Array.from({ length: 9 }, (_, index) => (
            <li key={index}>
              <Skeleton className="aspect-[4/5] w-full rounded-[14px] sm:aspect-[4/3]" />
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  if (items.length === 0) {
    return (
      <Shell>
        <EmptyState
          size="sm"
          title="No categories to show yet"
          description="The shop is still being stocked. Search for a part, or look at everything listed so far."
          actions={<Button to="/shop" variant="dark">Browse the shop</Button>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className={GRID}>
        {items.map((category, index) => (
          <Tile key={category.id} category={category} eager={index < 3} />
        ))}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="home-categories" className="section-y">
      <div className="container-page grid gap-8">
        <SectionHeading id="home-categories" title="Shop by part" seeAll={{ to: '/shop', label: 'Everything' }} />
        {children}
      </div>
    </section>
  );
}
