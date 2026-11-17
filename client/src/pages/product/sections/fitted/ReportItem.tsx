import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleCheck, CircleMinus, TriangleAlert } from 'lucide-react';
import { CompoundRing, StickerChip } from '@/components/brand';
import { DemoBadge } from '@/components/commerce';
import { Button, Modal } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { imageVariant } from '@/lib/images';
import type { FittedReport } from '@/types/api';
import { durationLabel, FITTED_BY_LABELS } from '../shared/words';

function Verdict({ report }: { report: FittedReport }) {
  if (report.fittedBy === 'not_fitted') {
    return (
      <p className="flex items-center gap-2 font-bold text-muted">
        <CircleMinus aria-hidden className="size-5 shrink-0" />
        Not fitted yet
      </p>
    );
  }
  return report.fittedOk ? (
    <p className="flex items-center gap-2 font-bold text-fit">
      <CircleCheck aria-hidden className="size-5 shrink-0" />
      Fitted first time, no problems
    </p>
  ) : (
    <p className="flex items-center gap-2 font-bold text-warn">
      <TriangleAlert aria-hidden className="size-5 shrink-0" />
      Fitted, but not without problems
    </p>
  );
}

/** One fitted report: the car and the fitting facts on the left, what the buyer said on the right. */
export function ReportItem({ report }: { report: FittedReport }) {
  const [photo, setPhoto] = useState<number | null>(null);
  const time = durationLabel(report.timeMinutes);
  const count = report.photos.length;
  const shown = photo === null ? null : report.photos[photo];

  return (
    <li className="grid gap-4 py-6 md:grid-cols-[16rem_1fr] md:gap-10">
      <div className="grid content-start gap-3">
        <p className="type-h3">{report.vehicle}</p>
        <dl className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3 md:block">
            <dt className="type-small text-muted">Who fitted it</dt>
            <dd className="font-bold">{FITTED_BY_LABELS[report.fittedBy]}</dd>
          </div>
          {time && (
            <div className="flex items-baseline justify-between gap-3 md:block">
              <dt className="type-small text-muted">Time taken</dt>
              <dd className="font-bold tnum">{time}</dd>
            </div>
          )}
          {report.difficulty !== null && (
            <div className="flex items-center justify-between gap-3 md:block">
              <dt className="type-small text-muted md:mb-1">How hard</dt>
              <dd>
                <CompoundRing difficulty={report.difficulty} size={32} />
              </dd>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 md:block">
            <dt className="type-small text-muted">Overall</dt>
            <dd className="font-bold tnum">{report.rating} of 5</dd>
          </div>
        </dl>
      </div>

      <div className="grid min-w-0 content-start gap-3">
        <Verdict report={report} />
        {report.issues && (
          <div className="bg-warn-soft px-3 py-2.5">
            <p className="type-small font-bold">What went wrong</p>
            <p className="mt-1 max-w-prose whitespace-pre-line">{report.issues}</p>
          </div>
        )}
        {report.body && <p className="max-w-prose whitespace-pre-line">{report.body}</p>}

        {count > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Photos from this report">
            {report.photos.map((url, index) => (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => setPhoto(index)}
                  className="plane-frame block size-20 overflow-hidden border border-line transition-transform dur-quick hover:scale-[1.03] sm:size-24"
                  aria-label={`Enlarge photo ${index + 1} of ${count}`}
                >
                  <img
                    src={imageVariant(url, 480)}
                    alt=""
                    width={96}
                    height={96}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="type-small flex flex-wrap items-center gap-x-3 gap-y-2 text-muted">
          <span className="font-bold text-ink">{report.authorName}</span>
          <time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time>
          {report.isVerifiedPurchase && (
            <StickerChip tone="ink" className="text-xs">
              Verified buyer
            </StickerChip>
          )}
          {report.isDemo && <DemoBadge />}
        </div>
      </div>

      <Modal
        open={photo !== null}
        onClose={() => setPhoto(null)}
        size="lg"
        title={`Photo ${(photo ?? 0) + 1} of ${count}`}
        description={`${report.authorName}, ${report.vehicle}`}
        footer={
          count > 1 ? (
            <>
              <Button
                variant="outline"
                iconLeft={<ChevronLeft />}
                onClick={() => setPhoto((current) => ((current ?? 0) - 1 + count) % count)}
              >
                Previous
              </Button>
              <Button variant="outline" iconRight={<ChevronRight />} onClick={() => setPhoto((current) => ((current ?? 0) + 1) % count)}>
                Next
              </Button>
            </>
          ) : undefined
        }
      >
        {shown && (
          <div className="plane-frame grid place-items-center">
            <img
              src={shown}
              alt={`Photo ${(photo ?? 0) + 1} from ${report.authorName}'s fitted report on a ${report.vehicle}`}
              className="max-h-[70vh] w-full object-contain"
            />
          </div>
        )}
      </Modal>
    </li>
  );
}
