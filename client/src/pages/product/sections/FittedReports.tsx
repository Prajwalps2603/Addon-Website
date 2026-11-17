import { lazy, Suspense, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { ClipboardPen } from 'lucide-react';
import { ErrorState, SectionHeading } from '@/components/commerce';
import { Button, Callout, EmptyState, Pagination, Skeleton, SkeletonText } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductDetail } from '@/types/api';
import { ReportItem } from './fitted/ReportItem';
import { ReportSummary } from './fitted/ReportSummary';

// Opened on a tap; it brings the form libraries, so it is not part of the product page's first load.
const ReportForm = lazy(() => import('./fitted/ReportForm').then((m) => ({ default: m.ReportForm })));

export interface FittedReportsProps {
  product: ProductDetail;
}

const PAGE_SIZE = 5;

function ReportsSkeleton() {
  return (
    <div aria-hidden className="grid gap-6">
      <Skeleton className="h-64 sm:h-52" />
      {[0, 1].map((key) => (
        <div key={key} className="grid gap-4 border-t border-line pt-6 md:grid-cols-[16rem_1fr] md:gap-10">
          <SkeletonText lines={3} />
          <SkeletonText lines={4} />
        </div>
      ))}
    </div>
  );
}

/**
 * Fitted reports in place of star reviews: a summary board of what buyers found when they fitted it,
 * then the reports themselves, newest first, five to a page. Buyers who received the part can file one.
 */
/** An order number as the follow-up message writes it, e.g. ADN-2026-000123. Anything else is ignored. */
function readOrderNumber(value: string | null): string {
  const text = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(text) ? text : '';
}

export default function FittedReports({ product }: FittedReportsProps) {
  const [searchParams] = useSearchParams();
  // The review follow-up links to /p/<slug>?report=<orderNumber>#fitted-reports: open the form at once.
  const [linkedOrder] = useState(() => readOrderNumber(searchParams.get('report')));
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(() => linkedOrder !== '');
  const [sent, setSent] = useState(false);
  const listTop = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLDivElement>(null);
  const query = { page, limit: PAGE_SIZE };

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: queryKeys.reports.list(product.slug, query),
    queryFn: ({ signal }) => api.reports.list(product.slug, query, { signal }),
    placeholderData: keepPreviousData,
  });

  const openForm = () => {
    setSent(false);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    // The button comes back on the next render; return focus to it then.
    requestAnimationFrame(() => opener.current?.querySelector<HTMLElement>('button')?.focus());
  };

  const goTo = (next: number) => {
    setPage(next);
    listTop.current?.scrollIntoView({ block: 'start' });
    listTop.current?.focus({ preventScroll: true });
  };

  const fileButton = (
    <Button variant="outline" iconLeft={<ClipboardPen />} onClick={openForm}>
      File a fitted report
    </Button>
  );
  const isEmpty = data !== undefined && data.total === 0;
  // The response carries the total, not the page count.
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section id="fitted-reports" aria-labelledby="fitted-reports-heading" className="grid scroll-mt-24 gap-6">
      <div ref={opener}>
        <SectionHeading
          id="fitted-reports-heading"
          title="Fitted reports"
          description="Not star ratings. Buyers who received this part tell you their car, who fitted it, how long it took and what went wrong."
          action={!formOpen && !isEmpty ? fileButton : undefined}
        />
      </div>

      {sent && (
        <Callout tone="good" title="Report received" live>
          Thank you. We read every report before it goes up, so yours will appear here after review.
        </Callout>
      )}

      {formOpen && (
        <Suspense fallback={<Skeleton className="h-40" />}>
          <ReportForm
            product={product}
            orderNumber={linkedOrder}
            onCancel={closeForm}
            onSent={() => {
              setFormOpen(false);
              setSent(true);
            }}
          />
        </Suspense>
      )}

      {isPending ? (
        <ReportsSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the fitted reports" size="sm" />
      ) : data.total === 0 ? (
        !formOpen && (
          <EmptyState
            size="sm"
            title="No fitted reports yet"
            description={
              <>
                A fitted report is a short account from someone who bought this part and fitted it: the car, who fitted it,
                how long it took, how hard it was and anything that went wrong. Only buyers who have received the part can
                file one. If you have, yours would be the first.
              </>
            }
            actions={sent ? undefined : fileButton}
          />
        )
      ) : (
        <>
          <ReportSummary data={data} hasSample={data.items.some((report) => report.isDemo)} />
          <div ref={listTop} tabIndex={-1} className="scroll-mt-24 outline-none">
            <h3 className="sr-only">
              Reports, page {page} of {pageCount}
            </h3>
            <ul
              aria-busy={isPlaceholderData}
              className={cn('divide-y divide-line border-y border-line transition-opacity dur-base', isPlaceholderData && 'opacity-60')}
            >
              {data.items.map((report) => (
                <ReportItem key={report.id} report={report} />
              ))}
            </ul>
          </div>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={goTo} label="Fitted reports" />}
        </>
      )}
    </section>
  );
}
