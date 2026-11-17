import { BoardTile, CompoundRing, PitBoard } from '@/components/brand';
import { pluralize } from '@/lib/format';
import type { FittedBy, FittedReportsResponse } from '@/types/api';
import { durationLabel, FITTED_BY_SHORT } from '../shared/words';

export interface ReportSummaryProps {
  data: FittedReportsResponse;
  /** Seeded sample reports are in the mix: the board says so. */
  hasSample: boolean;
}

const FITTER_ORDER: FittedBy[] = ['self', 'local_garage', 'dealer', 'not_fitted'];

/**
 * The fitted reports totted up like a timing board: how many, how often it fitted first time,
 * the median time, the average difficulty and who did the fitting. Every reading is computed by the server
 * from approved reports.
 */
export function ReportSummary({ data, hasSample }: ReportSummaryProps) {
  const fitters = FITTER_ORDER.filter((key) => key !== 'not_fitted' || data.byFitter.not_fitted > 0);
  const fittedCount = FITTER_ORDER.reduce((sum, key) => sum + (key === 'not_fitted' ? 0 : data.byFitter[key]), 0);
  const largest = Math.max(1, ...fitters.map((key) => data.byFitter[key]));
  const time = durationLabel(data.medianTimeMinutes);

  return (
    <PitBoard
      as="section"
      aria-label="Fitted reports summary"
      title={hasSample ? 'From buyers, including sample reports' : 'From buyers who received it'}
      aside={data.average > 0 ? <span className="tnum">Rated {data.average.toFixed(1)} of 5 overall</span> : undefined}
      className="print-exact"
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <BoardTile tone="paper" size="lg">
          {data.total}
        </BoardTile>
        <span className="type-h2">{data.total === 1 ? 'fitted report' : 'fitted reports'}</span>
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-4 lg:grid-cols-[auto_auto_auto_minmax(14rem,1fr)] lg:gap-x-10">
        <div className="grid content-start gap-2">
          <dt className="order-2 type-small font-bold">Fitted first time</dt>
          <dd className="order-1">
            {data.fittedOkPercent === null ? (
              <BoardTile tone="blank" size="lg">
                -
              </BoardTile>
            ) : (
              <BoardTile tone="brand" size="lg">
                {data.fittedOkPercent}%
              </BoardTile>
            )}
          </dd>
          {data.fittedOkPercent !== null && (
            <dd className="order-3 type-small text-muted">Out of {pluralize(fittedCount, 'fitting')}</dd>
          )}
        </div>

        <div className="grid content-start gap-2">
          <dt className="order-2 type-small font-bold">Median fitting time</dt>
          <dd className="order-1">
            <BoardTile tone={time ? 'paper' : 'blank'} size="lg" className="px-2 text-xl whitespace-nowrap sm:text-3xl">
              {time ? time.toUpperCase() : '-'}
            </BoardTile>
          </dd>
        </div>

        <div className="grid content-start gap-2">
          <dt className="order-2 type-small font-bold">Average difficulty</dt>
          <dd className="order-1 flex h-14 items-center gap-3">
            {data.averageDifficulty === null ? (
              <BoardTile tone="blank" size="lg">
                -
              </BoardTile>
            ) : (
              <>
                <CompoundRing difficulty={data.averageDifficulty} size={52} showLabel={false} />
                <span className="text-3xl leading-none font-extrabold tnum">
                  {data.averageDifficulty.toFixed(1)}
                  <span className="type-small font-bold text-muted"> of 5</span>
                </span>
              </>
            )}
          </dd>
        </div>

        <div className="col-span-2 grid content-start gap-2 lg:col-span-1">
          <dt className="type-small font-bold">Who fitted it</dt>
          <dd>
            <ul className="grid gap-1.5">
              {fitters.map((key) => {
                const count = data.byFitter[key];
                return (
                  <li key={key} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3">
                    <span className="type-small">{FITTED_BY_SHORT[key]}</span>
                    <span aria-hidden className="h-3 bg-surface-2 print-exact">
                      <span className="block h-full bg-ink print-exact" style={{ width: `${(count / largest) * 100}%` }} />
                    </span>
                    <span className="text-right font-bold tnum">{count}</span>
                  </li>
                );
              })}
            </ul>
          </dd>
        </div>
      </dl>
    </PitBoard>
  );
}
