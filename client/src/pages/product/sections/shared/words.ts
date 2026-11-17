import type { FittedBy, Question } from '@/types/api';

/** Who fitted the part, as a report states it. */
export const FITTED_BY_LABELS: Record<FittedBy, string> = {
  self: 'Fitted it myself',
  local_garage: 'Local garage',
  dealer: 'Car dealer',
  not_fitted: 'Not fitted yet',
};

/** The same, short, for the summary board. */
export const FITTED_BY_SHORT: Record<FittedBy, string> = {
  self: 'Self',
  local_garage: 'Local garage',
  dealer: 'Dealer',
  not_fitted: 'Not fitted yet',
};

export type AnswerFit = NonNullable<Question['answerFitType']>;

/** The shop's verdict on a fitment question. */
export const ANSWER_FIT_WORDS: Record<AnswerFit, { label: string; tone: 'fit' | 'warn' | 'stop' }> = {
  direct: { label: 'Fits', tone: 'fit' },
  with_work: { label: 'Fits with work', tone: 'warn' },
  no: { label: 'Does not fit', tone: 'stop' },
};

/** '45 min', '1 hr 30 min', '2 hr'. */
export function durationLabel(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '';
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
