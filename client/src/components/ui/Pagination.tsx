import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, type To } from 'react-router';
import { cn } from '@/lib/cn';

export interface PaginationProps {
  /** Current page, starting at 1. */
  page: number;
  pageCount: number;
  /** Called with the new page. Use this, or `hrefFor`, or both. */
  onPageChange?: (page: number) => void;
  /** Builds a link for a page, so pages are real URLs that can be shared and crawled. */
  hrefFor?: (page: number) => To;
  /** Pages shown on each side of the current one. */
  siblings?: number;
  /** Names the list being paged, e.g. "Products". */
  label?: string;
  className?: string;
}

type Slot = number | 'gap-start' | 'gap-end';

function slots(page: number, pageCount: number, siblings: number): Slot[] {
  const first = Math.max(2, page - siblings);
  const last = Math.min(pageCount - 1, page + siblings);
  const list: Slot[] = [1];
  if (first > 2) list.push('gap-start');
  for (let p = first; p <= last; p += 1) list.push(p);
  if (last < pageCount - 1) list.push('gap-end');
  if (pageCount > 1) list.push(pageCount);
  return list;
}

const cell =
  'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-sm font-bold tnum transition-colors dur-quick';

/**
 * Page numbers as board tiles: the current page is the red one. On a phone it shrinks to
 * previous, "Page 3 of 12", next. Renders nothing when there is only one page.
 */
export function Pagination({ page, pageCount, onPageChange, hrefFor, siblings = 1, label = 'Results', className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(pageCount, Math.max(1, page));

  const go = (target: number, content: ReactNode, extra: { className?: string; 'aria-label'?: string; 'aria-current'?: 'page' }) => {
    const disabled = target < 1 || target > pageCount;
    const className = cn(cell, extra.className);
    if (disabled) {
      return (
        <span aria-disabled className={cn(className, 'text-muted opacity-45')} aria-label={extra['aria-label']}>
          {content}
        </span>
      );
    }
    if (hrefFor) {
      return (
        <Link to={hrefFor(target)} onClick={() => onPageChange?.(target)} {...extra} className={className}>
          {content}
        </Link>
      );
    }
    return (
      <button type="button" onClick={() => onPageChange?.(target)} {...extra} className={className}>
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={`${label} pages`} className={cn('flex items-center justify-between gap-2 sm:justify-start', className)}>
      {go(
        current - 1,
        <>
          <ChevronLeft aria-hidden className="size-5" />
          <span className="max-sm:sr-only">Previous</span>
        </>,
        { className: 'text-ink hover:bg-surface-2 sm:pr-3', 'aria-label': 'Previous page' },
      )}

      <p className="type-small text-muted tnum sm:hidden" aria-live="polite">
        Page <span className="font-bold text-ink">{current}</span> of {pageCount}
      </p>

      <ol className="hidden items-center gap-1 sm:flex">
        {slots(current, pageCount, siblings).map((slot) =>
          typeof slot === 'number' ? (
            <li key={slot}>
              {go(slot, slot, {
                'aria-label': `Page ${slot}`,
                ...(slot === current ? { 'aria-current': 'page' as const } : {}),
                className: slot === current ? 'bg-brand text-brand-ink' : 'text-ink hover:bg-surface-2',
              })}
            </li>
          ) : (
            <li key={slot} aria-hidden className={cn(cell, 'min-w-6 px-0 text-muted')}>
              …
            </li>
          ),
        )}
      </ol>

      {go(
        current + 1,
        <>
          <span className="max-sm:sr-only">Next</span>
          <ChevronRight aria-hidden className="size-5" />
        </>,
        { className: 'text-ink hover:bg-surface-2 sm:pl-3', 'aria-label': 'Next page' },
      )}
    </nav>
  );
}
