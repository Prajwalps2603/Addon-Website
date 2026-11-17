import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button, Callout, Field, Input, Segmented, Textarea } from '@/components/ui';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPhone, normalizePhone } from '@/lib/india';
import type { ProductDetail, QuestionInput, Vehicle } from '@/types/api';
import { CarChooser } from '../shared/CarChooser';

export type QuestionMode = 'general' | 'fitment';

const DEFAULT_FIT_QUESTION = 'Will this fit my car?';

const schema = z
  .object({
    kind: z.enum(['general', 'fitment']),
    authorName: z.string().trim().min(2, { error: 'Enter your name' }).max(60, { error: 'Keep the name to 60 characters' }),
    phone: z.string().trim(),
    vehicleId: z.number().int().positive().nullable(),
    question: z.string().trim().max(1000, { error: 'Keep the question to 1000 characters or fewer' }),
  })
  .superRefine((input, ctx) => {
    if (input.kind === 'fitment') {
      if (input.vehicleId === null) ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Choose your car' });
      if (!isValidPhone(input.phone)) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a 10 digit mobile number so we can send the answer' });
      }
      if (input.question && input.question.length < 5) {
        ctx.addIssue({ code: 'custom', path: ['question'], message: 'Add a little more, or leave it blank' });
      }
    } else if (input.question.length < 5) {
      ctx.addIssue({ code: 'custom', path: ['question'], message: 'Type your question' });
    }
  });

type FormValues = z.infer<typeof schema>;

export interface QuestionSent {
  kind: QuestionMode;
  vehicle: Vehicle | null;
}

export interface QuestionFormProps {
  product: ProductDetail;
  mode: QuestionMode;
  onModeChange: (mode: QuestionMode) => void;
  onSent: (sent: QuestionSent) => void;
  onCancel: () => void;
}

/**
 * Ask the shop. A general question is answered on this page; "Will it fit my car?" goes to the
 * Fitment Desk with the car and a phone number, and the answer is kept for every owner of that car.
 */
export function QuestionForm({ product, mode, onModeChange, onSent, onCancel }: QuestionFormProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { user } = useMe();
  const whatsapp = useSettings().data?.whatsapp ?? '';
  const [formError, setFormError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: mode, authorName: '', phone: '', vehicleId: null, question: '' },
  });

  useEffect(() => heading.current?.focus(), []);

  useEffect(() => {
    setValue('kind', mode);
    clearErrors();
  }, [mode, setValue, clearErrors]);

  useEffect(() => {
    if (!user) return;
    if (!getValues('authorName')) setValue('authorName', user.name);
    if (!getValues('phone') && user.phone) setValue('phone', user.phone);
  }, [user, getValues, setValue]);

  const fitment = mode === 'fitment';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body: QuestionInput =
      values.kind === 'fitment'
        ? {
            kind: 'fitment',
            authorName: values.authorName,
            phone: normalizePhone(values.phone) ?? values.phone,
            vehicleId: values.vehicleId ?? undefined,
            question: values.question || DEFAULT_FIT_QUESTION,
          }
        : { kind: 'general', authorName: values.authorName, question: values.question };
    try {
      await api.questions.create(product.slug, body);
      onSent({ kind: values.kind, vehicle: values.kind === 'fitment' ? vehicle : null });
    } catch (failure) {
      setFormError(applyApiError(failure, setError));
    }
  });

  return (
    <form id="ask-question" noValidate onSubmit={onSubmit} aria-labelledby={headingId} className="grid scroll-mt-24 gap-6 border border-ink p-4 sm:p-6">
      <div className="grid gap-4">
        <h3 id={headingId} ref={heading} tabIndex={-1} className="type-h3 outline-none">
          {fitment ? 'Will it fit my car' : 'Ask a question'}
        </h3>
        <Segmented<QuestionMode>
          label="Kind of question"
          value={mode}
          onChange={onModeChange}
          block
          className="sm:max-w-md"
          options={[
            { value: 'fitment', label: 'Will it fit my car' },
            { value: 'general', label: 'Something else' },
          ]}
        />
        <p className="max-w-prose text-muted">
          {fitment
            ? 'We check it against your exact car and reply. The answer is kept, so the next owner of the same car sees it straight away.'
            : 'About fitting, sizes, what is in the box. The shop answers here on the page, for everyone to read.'}
        </p>
      </div>

      {fitment && (
        <Controller
          control={control}
          name="vehicleId"
          render={({ field, fieldState }) => (
            <CarChooser
              value={field.value}
              onChange={(id, chosen) => {
                field.onChange(id);
                setVehicle(chosen);
              }}
              error={fieldState.error?.message}
            />
          )}
        />
      )}

      <Field
        label={fitment ? 'Anything we should know' : 'Your question'}
        optional={fitment}
        hint={fitment ? 'Variant, trim or anything already changed on the car.' : undefined}
        error={errors.question?.message}
      >
        <Textarea rows={fitment ? 2 : 4} {...register('question')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" hint="Shown with the question." error={errors.authorName?.message}>
          <Input autoComplete="name" {...register('authorName')} />
        </Field>
        {fitment && (
          <Field
            label="Mobile number"
            hint={whatsapp ? 'We send the answer to this number on WhatsApp. It is never shown.' : 'Only for sending you the answer. It is never shown.'}
            error={errors.phone?.message}
          >
            <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" {...register('phone')} />
          </Field>
        )}
      </div>

      {formError && (
        <Callout tone="danger" title="The question was not sent" live>
          {formError}
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" loading={isSubmitting}>
          {fitment ? 'Ask if it fits' : 'Send question'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
