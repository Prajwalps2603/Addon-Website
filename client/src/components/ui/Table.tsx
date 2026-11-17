import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface TableColumn<T> {
  /** Unique within the table. */
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Right aligned tabular figures: prices, counts, dates in figures. */
  numeric?: boolean;
  align?: 'left' | 'center' | 'right';
  /**
   * The column that names the row (order number, product). On a phone it becomes the card's
   * heading and loses its label.
   */
  primary?: boolean;
  /** Extra classes for this column's cells on desktop, e.g. a width. */
  className?: string;
}

export interface TableProps<T> {
  columns: ReadonlyArray<TableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T, index: number) => string | number;
  /** Names the table for screen readers. */
  caption: string;
  /** Shown instead of rows when there are none. Use an EmptyState with size="sm". */
  empty?: ReactNode;
  /** Shows skeleton rows in the table's own layout. */
  loading?: boolean;
  /** Number of skeleton rows while loading. */
  skeletonRows?: number;
  /** Tighter rows for long admin lists. */
  dense?: boolean;
  className?: string;
}

const ALIGN = { left: 'md:text-left', center: 'md:text-center', right: 'md:text-right' } as const;

/**
 * A data table that becomes a stack of cards below 768 px: each row turns into a card, each
 * cell into a "label: value" line. One set of markup, with ARIA roles kept so the stacked
 * layout still reads as a table to assistive technology.
 */
export function Table<T>({ columns, rows, rowKey, caption, empty, loading = false, skeletonRows = 4, dense = false, className }: TableProps<T>) {
  const pad = dense ? 'md:py-2' : 'md:py-3';

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  const body = loading
    ? Array.from({ length: skeletonRows }, (_, index) => ({ key: `skeleton-${index}`, row: null, index }))
    : rows.map((row, index) => ({ key: rowKey(row, index), row, index }));

  return (
    <div className="min-w-0 max-md:contents md:overflow-x-auto md:overscroll-x-contain">
    <table role="table" className={cn('w-full border-collapse text-left max-md:block', className)}>
      <caption className="sr-only">{caption}</caption>
      <thead role="rowgroup" className="max-md:sr-only">
        <tr role="row">
          {columns.map((column) => (
            <th
              key={column.key}
              role="columnheader"
              scope="col"
              className={cn(
                'type-label bg-surface-2 px-4 py-3 whitespace-nowrap text-muted first:rounded-l-[12px] last:rounded-r-[12px]',
                column.numeric ? 'text-right' : ALIGN[column.align ?? 'left'],
                column.className,
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup" className="max-md:grid max-md:gap-2">
        {body.map(({ key, row, index }) => (
          <tr
            key={key}
            role="row"
            className="border-line max-md:grid max-md:gap-1.5 max-md:rounded-[16px] max-md:bg-surface max-md:p-4 md:border-b md:transition-colors md:last:border-b-0 md:hover:bg-surface/60"
          >
            {columns.map((column) => (
              <td
                key={column.key}
                role="cell"
                className={cn(
                  'align-top max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 md:px-4',
                  pad,
                  column.primary && 'max-md:block max-md:pb-1 max-md:font-bold',
                  column.numeric ? 'tnum md:text-right' : ALIGN[column.align ?? 'left'],
                  column.className,
                )}
              >
                {!column.primary && (
                  <span aria-hidden className="type-label shrink-0 text-muted md:hidden">
                    {column.header}
                  </span>
                )}
                <span className={cn('min-w-0', !column.primary && 'max-md:text-right')}>
                  {row === null ? <Skeleton className="inline-block h-4 w-20 align-middle" /> : column.cell(row, index)}
                </span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
