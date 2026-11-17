/**
 * The Fitment Desk's pieces: grouping waiting questions, the verdict card for a fitment
 * question, the answer card for a general one, the "send the answer" panel and the history list.
 */
import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CircleCheck, CircleX, ExternalLink, Wrench, type LucideIcon } from 'lucide-react';
import { DemoBadge } from '@/components/commerce';
import { Badge, Button, Field, Switch, Textarea, toast, type BadgeToneName } from '@/components/ui';
import { api, errorMessage, type ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { applyApiError } from '@/lib/forms';
import { formatPhone } from '@/lib/india';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import type { AdminQuestion, AdminQuestionAnswer, ProductSummary } from '@/types/api';
import { Ago, CustomerWhatsApp, ProductThumb, useCustomerWa, useDeskRefresh, useStoreName } from './common';
import { fitmentReply, questionReply } from './messages';

export type FitType = NonNullable<AdminQuestionAnswer['fitType']>;

export const FIT_WORDS: Record<FitType, { label: string; tone: BadgeToneName; Icon: LucideIcon }> = {
  direct: { label: 'Fits', tone: 'fit', Icon: CircleCheck },
  with_work: { label: 'Fits with work', tone: 'warn', Icon: Wrench },
  no: { label: 'Does not fit', tone: 'stop', Icon: CircleX },
};

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** Everyone waiting on the same part and the same car: one answer covers them all. */
export interface QuestionGroup {
  key: string;
  kind: AdminQuestion['kind'];
  productId: number;
  productName: string;
  productSlug: string;
  vehicleLabel: string;
  /** The server's count of everyone who asked (may be more than are on this page). */
  askCount: number;
  questions: AdminQuestion[];
}

export function groupQuestions(questions: readonly AdminQuestion[]): QuestionGroup[] {
  const groups = new Map<string, QuestionGroup>();
  for (const question of questions) {
    const key =
      question.kind === 'fitment' && question.vehicleId !== null ? `fit:${question.productId}:${question.vehicleId}` : `q:${question.id}`;
    const group = groups.get(key);
    if (group) {
      group.questions.push(question);
      group.askCount = Math.max(group.askCount, question.sameAskCount, group.questions.length);
    } else {
      groups.set(key, {
        key,
        kind: question.kind,
        productId: question.productId,
        productName: question.productName,
        productSlug: question.productSlug,
        vehicleLabel: question.vehicleLabel,
        askCount: Math.max(1, question.sameAskCount),
        questions: [question],
      });
    }
  }
  return [...groups.values()];
}

/** What just got answered, kept on screen so the owner can send the replies. */
export interface AnsweredGroup {
  key: string;
  kind: AdminQuestion['kind'];
  fitType: FitType | null;
  answer: string;
  questions: AdminQuestion[];
}

// ---------------------------------------------------------------------------
// Shared card parts
// ---------------------------------------------------------------------------

function CardHead({ group, product }: { group: QuestionGroup; product: ProductSummary | undefined }) {
  const isFitment = group.kind === 'fitment';
  return (
    <div className="flex gap-4">
      <ProductThumb product={product} name={group.productName} />
      <div className="grid min-w-0 flex-1 content-start gap-1">
        {isFitment && <p className="type-h3 break-words">{group.vehicleLabel || 'Car not given'}</p>}
        <Link
          to={`/p/${group.productSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'focus-ring inline-flex items-baseline gap-1 rounded-control break-words underline-offset-4 hover:underline',
            isFitment ? 'text-muted' : 'type-h3',
          )}
        >
          {group.productName}
          <ExternalLink aria-hidden className="size-3.5 shrink-0 self-center" />
          <span className="sr-only">(opens the product in a new tab)</span>
        </Link>
        {isFitment && group.askCount > 1 && (
          <p className="mt-1">
            <Badge tone="brand" variant="solid" className="tnum">
              {group.askCount} people asked about this car
            </Badge>
          </p>
        )}
      </div>
    </div>
  );
}

function AskList({ questions }: { questions: readonly AdminQuestion[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? questions : questions.slice(0, 3);
  return (
    <div className="grid gap-0">
      <ul className="grid divide-y divide-line border-y border-line">
        {shown.map((question) => (
          <li key={question.id} className="grid gap-1 py-3">
            <p className="type-small flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
              <span className="font-bold text-ink">{question.authorName || 'A shopper'}</span>
              <Ago iso={question.createdAt} />
              {question.phone && <span className="tnum">{formatPhone(question.phone)}</span>}
              {question.isDemo && <DemoBadge />}
            </p>
            <p className="max-w-prose break-words whitespace-pre-line">{question.question}</p>
          </li>
        ))}
      </ul>
      {questions.length > 3 && (
        <Button variant="link" size="sm" className="justify-self-start" onClick={() => setAll((open) => !open)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${questions.length} questions`}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fitment verdict card
// ---------------------------------------------------------------------------

const fitSchema = z
  .object({
    fitType: z.enum(['direct', 'with_work', 'no'], { error: 'Choose Fits, Fits with work or Does not fit.' }),
    answer: z.string().trim().max(1000, { error: 'Keep the note under 1,000 characters.' }),
    isVerified: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.fitType === 'with_work' && value.answer.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['answer'], message: 'Say what work it needs, so the shopper and their fitter know.' });
    }
  });

type FitInput = z.input<typeof fitSchema>;
type FitOutput = z.output<typeof fitSchema>;

export interface FitmentCardProps {
  group: QuestionGroup;
  product: ProductSummary | undefined;
  onAnswered: (answered: AnsweredGroup) => void;
  onReject: (group: QuestionGroup) => void;
}

export function FitmentCard({ group, product, onAnswered, onReject }: FitmentCardProps) {
  const refresh = useDeskRefresh();
  const [formError, setFormError] = useState('');
  const lead = group.questions[0]!;
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FitInput, unknown, FitOutput>({
    resolver: zodResolver(fitSchema),
    defaultValues: { fitType: undefined, answer: '', isVerified: false },
  });
  const fitType = watch('fitType');
  const car = group.vehicleLabel || 'this car';

  const onSubmit: SubmitHandler<FitOutput> = async (values) => {
    setFormError('');
    try {
      const saved = await api.admin.questions.answer(lead.id, {
        fitType: values.fitType,
        answer: values.answer || undefined,
        isVerified: values.isVerified,
      });
      toast.success(`Answered for the ${car}`, {
        description:
          group.askCount > 1 ? `${pluralize(group.askCount, 'shopper')} answered. The store now gives this verdict for this car.` : 'The store now gives this verdict for this car.',
      });
      onAnswered({ key: group.key, kind: 'fitment', fitType: values.fitType, answer: saved.answer ?? values.answer, questions: group.questions });
      await refresh(queryKeys.admin.questions.all(), queryKeys.products.all());
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  };

  const noteHint =
    fitType === 'with_work'
      ? 'Required. Say what it takes: spacers, a wiring harness, trimming the bumper.'
      : fitType === 'no'
        ? 'Optional. Why it does not fit, or what does. Blank sends "No, this does not fit".'
        : 'Optional. Blank sends "Yes, this fits as it comes".';

  return (
    <article aria-labelledby={`fit-${group.key}`} className="grid gap-4 rounded-[22px] bg-surface p-5">
      <h3 id={`fit-${group.key}`} className="sr-only">
        {group.productName} on the {car}
      </h3>
      <CardHead group={group} product={product} />
      <AskList questions={group.questions} />

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <fieldset aria-describedby={errors.fitType ? `fit-${group.key}-err` : undefined}>
          <legend className="type-label mb-2 text-muted">Does it fit the {car}?</legend>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(FIT_WORDS) as FitType[]).map((value) => {
              const { label, Icon } = FIT_WORDS[value];
              return (
                <label
                  key={value}
                  className={cn(
                    'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border border-line-strong px-2 py-2 text-center font-bold leading-tight',
                    'transition-colors dur-quick hover:border-ink',
                    'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--focus)',
                    value === 'direct' && 'has-checked:border-fit has-checked:bg-fit has-checked:text-fit-ink',
                    value === 'with_work' && 'has-checked:border-warn has-checked:bg-warn has-checked:text-warn-ink',
                    value === 'no' && 'has-checked:border-stop has-checked:bg-stop-soft has-checked:text-stop',
                  )}
                >
                  <input type="radio" value={value} className="sr-only" {...register('fitType')} />
                  <Icon aria-hidden className="size-6" />
                  <span className="text-sm sm:text-base">{label}</span>
                </label>
              );
            })}
          </div>
          {errors.fitType && (
            <p id={`fit-${group.key}-err`} role="alert" className="type-small mt-2 font-bold text-stop">
              {errors.fitType.message}
            </p>
          )}
        </fieldset>

        <Field
          label={fitType === 'with_work' ? 'What work it needs' : 'Note for the shopper'}
          hint={noteHint}
          error={errors.answer?.message}
          required={fitType === 'with_work'}
          optional={fitType !== 'with_work'}
        >
          <Textarea rows={2} {...register('answer')} />
        </Field>

        <Switch
          {...register('isVerified')}
          label="We have test-fitted this"
          description="Shown as shop-verified on the product page. Only switch on if the shop has fitted it to this car."
        />

        {formError && !errors.answer && !errors.fitType && (
          <p role="alert" className="type-small font-bold text-stop">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" loading={isSubmitting} className="max-sm:flex-1">
            {group.askCount > 1 ? `Answer all ${group.askCount}` : 'Answer'}
          </Button>
          <Button variant="ghost" onClick={() => onReject(group)} disabled={isSubmitting}>
            Reject
          </Button>
        </div>
      </form>
    </article>
  );
}

// ---------------------------------------------------------------------------
// General question card
// ---------------------------------------------------------------------------

const generalSchema = z.object({
  answer: z.string().trim().min(2, { error: 'Write the answer first.' }).max(1000, { error: 'Keep the answer under 1,000 characters.' }),
});
type GeneralInput = z.input<typeof generalSchema>;
type GeneralOutput = z.output<typeof generalSchema>;

export interface GeneralQuestionCardProps {
  group: QuestionGroup;
  product: ProductSummary | undefined;
  onAnswered: (answered: AnsweredGroup) => void;
  onReject: (group: QuestionGroup) => void;
}

export function GeneralQuestionCard({ group, product, onAnswered, onReject }: GeneralQuestionCardProps) {
  const refresh = useDeskRefresh();
  const [formError, setFormError] = useState('');
  const question = group.questions[0]!;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GeneralInput, unknown, GeneralOutput>({ resolver: zodResolver(generalSchema), defaultValues: { answer: '' } });

  const onSubmit: SubmitHandler<GeneralOutput> = async (values) => {
    setFormError('');
    try {
      await api.admin.questions.answer(question.id, { answer: values.answer, status: 'published' });
      toast.success('Answer published', { description: `Shown under ${group.productName}.` });
      onAnswered({ key: group.key, kind: 'general', fitType: null, answer: values.answer, questions: group.questions });
      await refresh(queryKeys.admin.questions.all(), queryKeys.questions(group.productSlug));
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  };

  return (
    <article aria-labelledby={`q-${group.key}`} className="grid gap-4 rounded-[22px] bg-surface p-5">
      <h3 id={`q-${group.key}`} className="sr-only">
        Question on {group.productName}
      </h3>
      <CardHead group={group} product={product} />
      <AskList questions={group.questions} />
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
        <Field label="Your answer" hint="Published under the product for every shopper to read." error={errors.answer?.message}>
          <Textarea rows={3} {...register('answer')} />
        </Field>
        {formError && !errors.answer && (
          <p role="alert" className="type-small font-bold text-stop">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" loading={isSubmitting} className="max-sm:flex-1">
            Publish
          </Button>
          <Button variant="outline" size="lg" onClick={() => onReject(group)} disabled={isSubmitting}>
            Reject
          </Button>
        </div>
      </form>
    </article>
  );
}

// ---------------------------------------------------------------------------
// After answering: send the replies
// ---------------------------------------------------------------------------

export function AnsweredPanel({ answered, onDone }: { answered: AnsweredGroup; onDone: () => void }) {
  const storeName = useStoreName();
  const linkFor = useCustomerWa();
  const first = answered.questions[0]!;
  const withPhone = answered.questions.filter((question) => linkFor(question.phone, 'x') !== '');
  const words = answered.fitType ? FIT_WORDS[answered.fitType] : null;

  const textFor = (question: AdminQuestion) =>
    answered.fitType ? fitmentReply(question, answered.fitType, answered.answer, storeName) : questionReply(question, answered.answer, storeName);

  return (
    <section aria-label={`Answered: ${first.productName}`} className="plane-board grid gap-3 p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <p className="flex flex-wrap items-center gap-2">
            {words && (
              <Badge tone={words.tone} variant="solid" icon={<words.Icon />}>
                {words.label}
              </Badge>
            )}
            <span className="font-bold break-words">
              {first.productName}
              {answered.kind === 'fitment' && first.vehicleLabel ? ` on the ${first.vehicleLabel}` : ''}
            </span>
          </p>
          <p className="type-small text-muted">
            {withPhone.length > 0
              ? 'Answered. Send the reply on WhatsApp, or find it later in Follow-ups.'
              : 'Answered. The answer is on the product page for them to read.'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
      {withPhone.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {withPhone.map((question) => (
            <li key={question.id}>
              <CustomerWhatsApp phone={question.phone} text={textFor(question)} variant="primary" block>
                Reply to {question.authorName || formatPhone(question.phone)}
              </CustomerWhatsApp>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// History (answered, rejected)
// ---------------------------------------------------------------------------

export interface HistoryRowProps {
  question: AdminQuestion;
  product: ProductSummary | undefined;
  onDelete: (question: AdminQuestion) => void;
  onRestore?: (question: AdminQuestion) => void;
  restoring?: boolean;
}

export function HistoryRow({ question, product, onDelete, onRestore, restoring }: HistoryRowProps) {
  const storeName = useStoreName();
  const words = question.answerFitType ? FIT_WORDS[question.answerFitType] : null;
  const reply =
    question.answer && question.status === 'published'
      ? question.answerFitType
        ? fitmentReply(question, question.answerFitType, question.answer, storeName)
        : questionReply(question, question.answer, storeName)
      : '';
  return (
    <li className="grid gap-3 py-4">
      <div className="flex gap-3">
        <ProductThumb product={product} name={question.productName} className="size-14 sm:size-14" />
        <div className="grid min-w-0 flex-1 content-start gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold break-words">{question.productName}</span>
            {question.isDemo && <DemoBadge />}
          </p>
          <p className="type-small text-muted">
            {question.kind === 'fitment' ? `${question.vehicleLabel || 'Car not given'} · ` : 'General · '}
            {question.authorName || 'A shopper'} · <Ago iso={question.answeredAt ?? question.createdAt} />
          </p>
        </div>
      </div>
      <p className="max-w-prose break-words whitespace-pre-line text-muted">{question.question}</p>
      {question.answer && (
        <div className="grid gap-1 bg-surface p-3">
          {words && (
            <Badge tone={words.tone} icon={<words.Icon />} className="justify-self-start">
              {words.label}
            </Badge>
          )}
          <p className="max-w-prose break-words whitespace-pre-line">{question.answer}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {reply && (
          <CustomerWhatsApp phone={question.phone} text={reply} size="sm">
            Send answer
          </CustomerWhatsApp>
        )}
        {onRestore && (
          <Button variant="outline" size="sm" onClick={() => onRestore(question)} loading={restoring}>
            Back to the queue
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDelete(question)}>
          Delete
        </Button>
      </div>
    </li>
  );
}

/** Reject every question in a group (one shopper, or everyone who asked about the same car). */
export function useRejectGroup(onDone?: () => void) {
  const refresh = useDeskRefresh();
  return useMutation<unknown, ApiError, QuestionGroup>({
    mutationFn: (group) => Promise.all(group.questions.map((question) => api.admin.questions.answer(question.id, { status: 'rejected' }))),
    onSuccess: async (_data, group) => {
      onDone?.();
      toast.success(group.questions.length > 1 ? `${group.questions.length} questions rejected` : 'Question rejected', {
        description: 'Hidden from the product page. Find it under Rejected.',
        action: {
          label: 'Undo',
          onClick: () => {
            Promise.all(group.questions.map((question) => api.admin.questions.answer(question.id, { status: 'pending' })))
              .then(() => refresh(queryKeys.admin.questions.all()))
              .catch((error: unknown) => toast.error('Could not undo', { description: errorMessage(error) }));
          },
        },
      });
      await refresh(queryKeys.admin.questions.all());
    },
    onError: (error) => toast.error('Could not reject', { description: error.message }),
  });
}
