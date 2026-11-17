import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BadgeCheck, CircleCheck, CircleX, ExternalLink, Lightbulb } from 'lucide-react';
import { CompoundRing } from '@/components/brand';
import { DemoBadge } from '@/components/commerce';
import { Badge, Button, EmptyState, Tab, TabList, TabPanel, Tabs, toast } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, minutesLabel, pluralize } from '@/lib/format';
import { imageVariant } from '@/lib/images';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminReport, FittedBy, ProductSummary } from '@/types/api';
import { DeskPage, ListError, ListPager, ProductThumb, QueueSkeleton, useConfirm, useDeskRefresh, usePageParam, useParamState, useProductMap } from './desk/common';

const VIEWS = ['pending', 'approved', 'rejected'] as const;
type View = (typeof VIEWS)[number];
const PAGE_SIZE = 20;

const FITTED_BY: Record<FittedBy, string> = {
  self: 'Fitted it themselves',
  local_garage: 'Local garage',
  dealer: 'Dealer workshop',
  not_fitted: 'Not fitted yet',
};

/** Fitted reports from buyers, waiting for the owner to approve or reject them. */
export default function ReportsPage() {
  useDocumentMeta({ title: 'Fitted reports', noindex: true });
  const [view, setView] = useParamState<View>('tab', VIEWS, 'pending');
  const [page, setPage] = usePageParam();
  const refresh = useDeskRefresh();
  const { ask, dialog } = useConfirm();

  const waiting = useQuery({
    queryKey: queryKeys.admin.reports.list({ status: 'pending', limit: 1 }),
    queryFn: ({ signal }) => api.admin.reports.list({ status: 'pending', limit: 1 }, { signal }),
  });
  const listQuery = { status: view, page, limit: PAGE_SIZE };
  const query = useQuery({
    queryKey: queryKeys.admin.reports.list(listQuery),
    queryFn: ({ signal }) => api.admin.reports.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];
  const { map } = useProductMap(items.map((report) => report.productId));

  const afterChange = (report: AdminReport) => refresh(queryKeys.admin.reports.all(), queryKeys.reports.all(report.productSlug), queryKeys.products.all());

  const setStatus = useMutation<AdminReport, ApiError, { report: AdminReport; status: AdminReport['status'] }>({
    mutationFn: ({ report, status }) => api.admin.reports.update(report.id, { status }),
    onSuccess: async (_saved, { report, status }) => {
      toast.success(status === 'approved' ? 'Report approved' : status === 'rejected' ? 'Report rejected' : 'Report moved back', {
        description: status === 'approved' ? `Now on ${report.productName}.` : status === 'rejected' ? 'Hidden from the product page.' : undefined,
        action:
          status !== report.status
            ? { label: 'Undo', onClick: () => setStatus.mutate({ report: { ...report, status }, status: report.status }) }
            : undefined,
      });
      await afterChange(report);
    },
    onError: (error) => toast.error('Could not change the report', { description: error.message }),
  });

  const remove = useMutation<unknown, ApiError, AdminReport>({
    mutationFn: (report) => api.admin.reports.remove(report.id),
    onSuccess: async (_data, report) => {
      toast.success('Report deleted');
      await afterChange(report);
    },
    onError: (error) => toast.error('Could not delete the report', { description: error.message }),
  });

  const onDelete = (report: AdminReport) =>
    ask({
      title: 'Delete this report?',
      description: `${report.authorName}'s report on ${report.productName} is removed for good, photos included. To hide it but keep a record, reject it instead.`,
      confirmLabel: 'Delete',
      run: () => remove.mutateAsync(report),
    });

  const busyId = setStatus.isPending ? setStatus.variables?.report.id : undefined;

  let body;
  if (query.isPending) body = <QueueSkeleton count={2} />;
  else if (query.error) body = <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the reports" />;
  else if (items.length === 0)
    body = (
      <EmptyState
        title={view === 'pending' ? 'No reports waiting' : view === 'approved' ? 'No approved reports yet' : 'No rejected reports'}
        description={
          view === 'pending'
            ? 'Buyers can file a report once their order is delivered. New ones wait here before they go on the product page.'
            : undefined
        }
      />
    );
  else
    body = (
      <div className={cn('grid gap-3 transition-opacity dur-base', query.isPlaceholderData && 'opacity-60')}>
        {items.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            product={map.get(report.productId)}
            busy={busyId === report.id}
            onStatus={(status) => setStatus.mutate({ report, status })}
            onDelete={() => onDelete(report)}
          />
        ))}
        <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Reports" />
      </div>
    );

  return (
    <DeskPage title="Fitted reports" meta={waiting.data ? `${pluralize(waiting.data.total, 'report')} waiting` : undefined}>
      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabList label="Reports">
          <Tab value="pending" count={waiting.data?.total}>
            Waiting
          </Tab>
          <Tab value="approved">Approved</Tab>
          <Tab value="rejected">Rejected</Tab>
        </TabList>
      <TabPanel value={view} className="grid gap-6 pt-6">
        {view === 'pending' && (
          <div className="flex items-start gap-3 rounded-[20px] bg-warn/10 p-4 md:p-5">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-warn text-white">
              <Lightbulb className="size-5" />
            </span>
            <p className="grid gap-0.5">
              <strong>Approve the bad ones too.</strong>
              <span className="text-sm text-muted">
                A report that says the part did not fit, or took three hours, is what makes the good ones believable. Reject only abuse,
                spam or a report about some other product.
              </span>
            </p>
          </div>
        )}
        {body}
      </TabPanel>
      </Tabs>
      {dialog}
    </DeskPage>
  );
}

interface ReportCardProps {
  report: AdminReport;
  product: ProductSummary | undefined;
  busy: boolean;
  onStatus: (status: AdminReport['status']) => void;
  onDelete: () => void;
}

function ReportCard({ report, product, busy, onStatus, onDelete }: ReportCardProps) {
  return (
    <article aria-labelledby={`report-${report.id}`} className="grid gap-4 border border-line p-4 sm:p-5">
      <header className="flex gap-4">
        <ProductThumb product={product} name={report.productName} />
        <div className="grid min-w-0 flex-1 content-start gap-1">
          <h2 id={`report-${report.id}`} className="type-h3 break-words">
            <Link
              to={`/p/${report.productSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring inline-flex items-baseline gap-1 rounded-control underline-offset-4 hover:underline"
            >
              {report.productName}
              <ExternalLink aria-hidden className="size-3.5 shrink-0 self-center" />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          </h2>
          <p className="type-small text-muted">
            <span className="font-bold text-ink">{report.authorName}</span> · {report.vehicle || 'Car not given'} ·{' '}
            <time dateTime={report.createdAt} className="tnum">
              {formatDate(report.createdAt)}
            </time>
          </p>
          <p className="flex flex-wrap items-center gap-2 pt-1">
            {report.isVerifiedPurchase ? (
              <Badge tone="fit" variant="solid" icon={<BadgeCheck />}>
                Verified buyer
              </Badge>
            ) : (
              <Badge tone="neutral" variant="outline">
                Purchase not verified
              </Badge>
            )}
            {report.orderNumber && <span className="type-code text-muted">{report.orderNumber}</span>}
            {report.isDemo && <DemoBadge />}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-3 sm:grid-cols-5">
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">First time</dt>
          <dd className={cn('flex items-center gap-1.5 font-bold', report.fittedOk ? 'text-fit' : 'text-stop')}>
            {report.fittedOk ? <CircleCheck aria-hidden className="size-4" /> : <CircleX aria-hidden className="size-4" />}
            {report.fittedOk ? 'Fitted fine' : 'Had problems'}
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">Who fitted</dt>
          <dd>{FITTED_BY[report.fittedBy] ?? report.fittedBy}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">Time taken</dt>
          <dd className="tnum">{report.timeMinutes ? minutesLabel(report.timeMinutes) : 'Not given'}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">How hard</dt>
          <dd>{report.difficulty ? <CompoundRing difficulty={report.difficulty} size={28} /> : 'Not given'}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="type-label text-muted">Overall</dt>
          <dd className="tnum">{report.rating} of 5</dd>
        </div>
      </dl>

      {report.issues && (
        <div className="grid gap-1">
          <h3 className="type-label text-muted">What went wrong</h3>
          <p className="max-w-prose break-words whitespace-pre-line">{report.issues}</p>
        </div>
      )}
      {report.body && (
        <div className="grid gap-1">
          <h3 className="type-label text-muted">Their report</h3>
          <p className="max-w-prose break-words whitespace-pre-line">{report.body}</p>
        </div>
      )}
      {!report.issues && !report.body && <p className="type-small text-muted">No written comments, only the details above.</p>}

      {report.photos.length > 0 && (
        <ul aria-label="Photos" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {report.photos.map((photo, index) => (
            <li key={photo}>
              <a
                href={photo}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring plane-frame block aspect-square overflow-hidden border border-line"
              >
                <img
                  src={imageVariant(photo, 480)}
                  alt={`Photo ${index + 1} from ${report.authorName}`}
                  width={480}
                  height={480}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {report.status !== 'approved' && (
          <Button size="lg" onClick={() => onStatus('approved')} loading={busy} className="max-sm:flex-1">
            Approve
          </Button>
        )}
        {report.status !== 'rejected' && (
          <Button variant="outline" size="lg" onClick={() => onStatus('rejected')} disabled={busy}>
            Reject
          </Button>
        )}
        <Button variant="ghost" onClick={onDelete} disabled={busy} className="ml-auto">
          Delete
        </Button>
      </div>
    </article>
  );
}
