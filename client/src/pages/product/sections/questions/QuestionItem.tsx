import { CarFront, CircleCheck, CircleX, Wrench } from 'lucide-react';
import { DemoBadge } from '@/components/commerce';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { Question } from '@/types/api';
import { ANSWER_FIT_WORDS, type AnswerFit } from '../shared/words';

const FIT_ICONS: Record<AnswerFit, typeof CircleCheck> = { direct: CircleCheck, with_work: Wrench, no: CircleX };

/** One published question with the shop's answer. Fitment questions carry the car and the verdict. */
export function QuestionItem({ question }: { question: Question }) {
  const fit = question.answerFitType;
  const FitIcon = fit ? FIT_ICONS[fit] : null;

  return (
    <li className="grid gap-3 py-5">
      {question.kind === 'fitment' && (question.vehicleLabel || fit) && (
        <div className="flex flex-wrap items-center gap-2">
          {question.vehicleLabel && (
            <span className="type-small inline-flex items-center gap-1.5 font-bold">
              <CarFront aria-hidden className="size-4 shrink-0" />
              {question.vehicleLabel}
            </span>
          )}
          {fit && FitIcon && (
            <Badge tone={ANSWER_FIT_WORDS[fit].tone} variant="solid" icon={<FitIcon aria-hidden />}>
              {ANSWER_FIT_WORDS[fit].label}
            </Badge>
          )}
        </div>
      )}

      <p className="max-w-prose text-lg leading-snug font-bold whitespace-pre-line">{question.question}</p>
      <p className="type-small flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        <span>
          Asked by {question.authorName}, <time dateTime={question.createdAt}>{formatDate(question.createdAt)}</time>
        </span>
        {question.isDemo && <DemoBadge />}
      </p>

      {question.answer ? (
        <div className="grid max-w-prose gap-1 bg-surface px-4 py-3">
          <p className="type-small font-bold">
            The shop answered
            {question.answeredAt && (
              <span className="font-normal text-muted">
                , <time dateTime={question.answeredAt}>{formatDate(question.answeredAt)}</time>
              </span>
            )}
          </p>
          <p className="whitespace-pre-line">{question.answer}</p>
        </div>
      ) : (
        <p className="type-small text-muted">Not answered yet.</p>
      )}
    </li>
  );
}
