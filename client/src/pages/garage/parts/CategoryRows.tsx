import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { iconForArtKind } from '@/components/commerce';
import { Skeleton } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { pluralize } from '@/lib/format';
import type { ProductFacets } from '@/types/api';

export interface CategoryRowsProps {
  /** The category facet of a fit-only listing for the car. */
  facets: ProductFacets['categories'] | undefined;
  loading?: boolean;
  /** Names the car in each link for screen readers. */
  carName: string;
}

/**
 * The top-level categories with how many parts in each suit the car, as a ruled list of links
 * into the shop with "Only parts for my car" already on.
 */
export function CategoryRows({ facets, loading = false, carName }: CategoryRowsProps) {
  const { data: categories } = useCategories();
  const artFor = new Map((categories ?? []).map((category) => [category.slug, category.artKind]));
  const tops = (facets ?? []).filter((facet) => facet.parentSlug === null && facet.count > 0);

  if (loading && tops.length === 0) {
    return (
      <ul aria-hidden className="grid border-t border-line md:grid-cols-2 md:gap-x-8 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex min-h-16 items-center gap-3 border-b border-line py-3">
            <Skeleton className="size-6" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ml-auto h-4 w-14" />
          </li>
        ))}
      </ul>
    );
  }

  if (tops.length === 0) return null;

  return (
    <ul className="grid border-t border-line md:grid-cols-2 md:gap-x-8 xl:grid-cols-3">
      {tops.map((facet) => {
        const Icon = iconForArtKind(artFor.get(facet.slug));
        return (
          <li key={facet.slug} className="border-b border-line">
            <Link
              to={`/shop/${facet.slug}?fitOnly=1`}
              className="group focus-ring-inset flex min-h-16 items-center gap-3 py-3 pr-1"
            >
              <Icon aria-hidden className="size-6 shrink-0 text-muted transition-colors dur-quick group-hover:text-ink" />
              <span className="min-w-0 flex-1 font-bold group-hover:underline group-hover:underline-offset-4">
                {facet.name}
                <span className="sr-only"> for your {carName}</span>
              </span>
              <span className="type-small shrink-0 text-muted tnum">{pluralize(facet.count, 'part')}</span>
              <ArrowRight aria-hidden className="size-4 shrink-0 transition-transform dur-quick group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
