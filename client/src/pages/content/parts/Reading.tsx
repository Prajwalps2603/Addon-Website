import type { ReactNode } from 'react';
import { ArrowUp } from 'lucide-react';
import { PageHeader } from '@/components/commerce';
import { Skeleton, SkeletonText, type Crumb } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

export interface TocItem {
  id: string;
  label: string;
  /** A real count shown beside the entry (terms in a group, photos of a subject). */
  count?: number;
}

/* ------------------------------------------------------------------ contents list */

function TocLinks({ items }: { items: readonly TocItem[] }) {
  return (
    <ol className="grid">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="focus-ring flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 text-left leading-snug hover:bg-surface lg:min-h-0 lg:py-1.5"
          >
            <span className="min-w-0">{item.label}</span>
            {item.count !== undefined && <span className="type-small tnum shrink-0 text-muted">{item.count}</span>}
          </a>
        </li>
      ))}
    </ol>
  );
}

/**
 * The page's contents. On a phone it is a closed list under the header (open it to jump);
 * from 1024 px it stands open in a sticky column beside the text.
 */
export function Contents({ items, label = 'On this page', openOnPhone = false }: { items: readonly TocItem[]; label?: string; openOnPhone?: boolean }) {
  const wide = useMediaQuery('(min-width: 1024px)');
  if (items.length === 0) return null;
  if (wide) {
    return (
      <nav aria-label={label} className="sticky top-24 grid max-h-[calc(100dvh-7rem)] gap-2 overflow-y-auto pb-4">
        <p className="type-label text-muted">{label}</p>
        <TocLinks items={items} />
        <a href="#main" className="link type-small mt-2 inline-flex items-center gap-1.5 self-start">
          <ArrowUp aria-hidden className="size-4" />
          Back to top
        </a>
      </nav>
    );
  }
  return (
    <nav aria-label={label}>
      <details open={openOnPhone} className="group border-y border-ink">
        <summary className="focus-ring-inset flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden">
          <span>{label}</span>
          <span className="type-small font-normal text-muted">
            <span className="group-open:hidden">Show {items.length}</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="pb-3">
          <TocLinks items={items} />
        </div>
      </details>
    </nav>
  );
}

/* ------------------------------------------------------------------ page shell */

export interface ReadingPageProps {
  title: string;
  description?: ReactNode;
  breadcrumbs?: ReadonlyArray<Crumb>;
  meta?: ReactNode;
  actions?: ReactNode;
  /** The contents list. Leave out for a short page. */
  toc?: readonly TocItem[];
  /** Above the text, under the header: a draft note, a search box. */
  top?: ReactNode;
  /** Text column width: `prose` for reading, `wide` for lists and forms. */
  width?: 'prose' | 'wide';
  children: ReactNode;
}

/** A reading page: header, a contents list beside (or above) the text, and the text at a readable measure. */
export function ReadingPage({ title, description, breadcrumbs, meta, actions, toc, top, width = 'prose', children }: ReadingPageProps) {
  const hasToc = Boolean(toc && toc.length > 0);
  return (
    <div className="container-page pb-16">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} meta={meta} actions={actions} />
      <div className={cn('grid gap-8', hasToc && 'lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:gap-16')}>
        {hasToc && (
          <div className="min-w-0">
            <Contents items={toc ?? []} />
          </div>
        )}
        <div className={cn('grid min-w-0 content-start gap-10 md:gap-12', width === 'prose' && 'max-w-[44rem]')}>
          {top}
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ text pieces */

export interface DocSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}

/** A titled part of a reading page. Its id is the anchor the contents list jumps to. */
export function DocSection({ id, title, children, className }: DocSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('grid scroll-mt-24 content-start gap-4 border-t border-ink pt-5', className)}>
      <h2 id={`${id}-title`} className="type-h2">
        {title}
      </h2>
      <div className="type-body grid gap-4">{children}</div>
    </section>
  );
}

/** A plain bulleted list for reading pages. */
export function Bullets({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('grid list-disc gap-2 pl-5 marker:text-muted', className)}>{children}</ul>;
}

export interface FactRow {
  term: ReactNode;
  value: ReactNode;
}

/** Two columns of facts: what, then the detail. Stacks on a phone. */
export function Facts({ rows, className }: { rows: readonly FactRow[]; className?: string }) {
  return (
    <dl className={cn('border-t border-line', className)}>
      {rows.map((row, i) => (
        <div key={i} className="grid gap-x-6 gap-y-1 border-b border-line py-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <dt className="font-bold">{row.term}</dt>
          <dd className="min-w-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ loading */

/** The shape of a reading page while its settings load. */
export function ReadingSkeleton({ sections = 3, withToc = true }: { sections?: number; withToc?: boolean }) {
  return (
    <div className="container-page pb-16" aria-busy="true">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="grid gap-3 pt-4 pb-6 md:pt-6 md:pb-8">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-4/5 max-w-lg md:h-12" />
        <SkeletonText lines={2} className="max-w-xl" />
      </div>
      <div className={cn('grid gap-8', withToc && 'lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:gap-16')}>
        {withToc && (
          <div className="grid content-start gap-2">
            <Skeleton className="h-12 w-full lg:h-4 lg:w-24" />
            <div className="hidden gap-3 lg:grid">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </div>
        )}
        <div className="grid max-w-[44rem] content-start gap-10">
          {Array.from({ length: sections }, (_, i) => (
            <div key={i} className="grid gap-4 border-t border-line pt-5">
              <Skeleton className="h-7 w-1/2" />
              <SkeletonText lines={4} />
              <SkeletonText lines={3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
