import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { compoundFor } from '@/components/brand';
import { Button, Callout, Chip, Field, Input, RadioGroup, Textarea } from '@/components/ui';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { useMe } from '@/hooks/useMe';
import { api, isApiError } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPhone, normalizePhone } from '@/lib/india';
import { loginPath } from '@/lib/urls';
import { useGarage, type GarageCar } from '@/stores/garage';
import type { FittedBy, FittedReportInput, ProductDetail } from '@/types/api';
import { ScalePicker } from '../shared/ScalePicker';
import { FITTED_BY_LABELS } from '../shared/words';
import { PhotoPicker } from './PhotoPicker';

const FITTERS = ['self', 'local_garage', 'dealer', 'not_fitted'] as const satisfies readonly FittedBy[];

const schema = z
  .object({
    guest: z.boolean(),
    orderNumber: z.string().trim().max(40),
    phone: z.string().trim(),
    vehicle: z
      .string()
      .trim()
      .min(2, { error: 'Tell us which car you fitted it to' })
      .max(80, { error: 'Keep the car to 80 characters' }),
    fittedBy: z.enum(FITTERS, { error: 'Choose who fitted it' }),
    timeMinutes: z.string().trim(),
    difficulty: z.number().int().min(1).max(5).nullable(),
    fittedOk: z.enum(['yes', 'no'], { error: 'Tell us whether it fitted without problems' }),
    issues: z.string().trim().max(1000, { error: 'Keep this to 1000 characters' }),
    body: z.string().trim().max(2000, { error: 'Keep this to 2000 characters' }),
    photos: z.array(z.string()).max(3),
    rating: z.number({ error: 'Choose a rating from 1 to 5' }).int().min(1).max(5),
    authorName: z.string().trim().min(2, { error: 'Enter your name' }).max(60, { error: 'Keep the name to 60 characters' }),
  })
  .superRefine((input, ctx) => {
    if (input.guest) {
      if (!input.orderNumber) ctx.addIssue({ code: 'custom', path: ['orderNumber'], message: 'Enter the order number' });
      if (!isValidPhone(input.phone)) {
        ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter the 10 digit mobile number used on the order' });
      }
    }
    if (input.fittedBy !== 'not_fitted' && input.timeMinutes) {
      const minutes = Number(input.timeMinutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
        ctx.addIssue({ code: 'custom', path: ['timeMinutes'], message: 'Enter whole minutes, from 1 to 1440' });
      }
    }
    if (input.fittedOk === 'no' && !input.issues) {
      ctx.addIssue({ code: 'custom', path: ['issues'], message: 'Say what went wrong, so the next buyer knows' });
    }
  });

type FormValues = z.infer<typeof schema>;

const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5].map((level) => ({
  value: level,
  label: level,
  caption: compoundFor(level).label,
}));

const RATING_CAPTIONS: Record<number, string> = { 1: 'Poor', 2: 'Below par', 3: 'All right', 4: 'Good', 5: 'Very good' };
const RATING_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({ value, label: value, caption: RATING_CAPTIONS[value] }));

function carText(car: GarageCar): string {
  return car.year ? `${car.vehicle.make} ${car.vehicle.model} ${car.year}` : car.vehicle.label;
}

/** The server's 403 answers explain the exact reason; the headline is always the same rule. */
const ONLY_BUYERS = 'Only buyers who have received this part can file a report.';

export interface ReportFormProps {
  product: ProductDetail;
  onSent: () => void;
  onCancel: () => void;
  /** From a follow-up link (?report=ADN-...): the order number, filled in for a guest. */
  orderNumber?: string;
}

export function ReportForm({ product, onSent, onCancel, orderNumber = '' }: ReportFormProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { user, isSignedIn, isPending: mePending } = useMe();
  const activeCar = useActiveCar();
  const garage = useGarage((state) => state.vehicles);
  const [formError, setFormError] = useState<{ title: string; detail: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      guest: true,
      orderNumber,
      phone: '',
      vehicle: activeCar ? carText(activeCar) : '',
      timeMinutes: '',
      difficulty: null,
      issues: '',
      body: '',
      photos: [],
      authorName: '',
    },
  });

  useEffect(() => heading.current?.focus(), []);

  // Signed-in buyers prove nothing more: the server finds their delivered order.
  useEffect(() => {
    if (mePending) return;
    setValue('guest', !isSignedIn);
    if (user?.name) setValue('authorName', user.name.split(' ')[0] ?? user.name);
  }, [mePending, isSignedIn, user, setValue]);

  const fittedBy = watch('fittedBy');
  const fittedOk = watch('fittedOk');
  const vehicle = watch('vehicle');
  const notFitted = fittedBy === 'not_fitted';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body: FittedReportInput = {
      authorName: values.authorName,
      vehicle: values.vehicle,
      rating: values.rating,
      fittedBy: values.fittedBy,
      timeMinutes: notFitted || !values.timeMinutes ? null : Number(values.timeMinutes),
      difficulty: notFitted ? null : values.difficulty,
      fittedOk: values.fittedOk === 'yes',
      issues: values.issues,
      body: values.body,
      photos: values.photos,
    };
    if (values.guest) {
      body.orderNumber = values.orderNumber.toUpperCase();
      body.phone = normalizePhone(values.phone) ?? values.phone;
    }
    try {
      await api.reports.create(product.slug, body);
      onSent();
    } catch (failure) {
      const message = applyApiError(failure, setError, { 'photos.0': 'photos', 'photos.1': 'photos', 'photos.2': 'photos' });
      if (isApiError(failure) && failure.status === 403) {
        setFormError({ title: ONLY_BUYERS, detail: message });
      } else if (isApiError(failure) && failure.status === 409) {
        setFormError({ title: 'This report is already in', detail: message });
      } else {
        setFormError({ title: 'The report was not sent', detail: message });
      }
    }
  });

  const otherCars = garage.filter((car) => carText(car) !== vehicle);

  return (
    <form noValidate onSubmit={onSubmit} aria-labelledby={headingId} className="grid gap-8 border border-ink p-4 sm:p-6">
      <div className="grid gap-2">
        <h3 id={headingId} ref={heading} tabIndex={-1} className="type-h3 outline-none">
          File a fitted report
        </h3>
        <p className="max-w-prose text-muted">
          About a minute. Reports come only from people who bought this part from us, and we read each one before it goes up.
        </p>
      </div>

      {!mePending && !isSignedIn && (
        <fieldset className="grid gap-4">
          <legend className="mb-3 font-bold">Your order</legend>
          <p className="type-small -mt-2 max-w-prose text-muted">
            So we know you received the part.{' '}
            <Link to={loginPath(`/p/${product.slug}#fitted-reports`)} className="link font-bold">
              Sign in
            </Link>{' '}
            instead and we will find the order ourselves.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Order number" hint="On your order email and invoice." error={errors.orderNumber?.message}>
              <Input mono autoComplete="off" spellCheck={false} {...register('orderNumber')} />
            </Field>
            <Field label="Mobile number" hint="The one used on the order." error={errors.phone?.message}>
              <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" {...register('phone')} />
            </Field>
          </div>
        </fieldset>
      )}

      <fieldset className="grid gap-5">
        <legend className="mb-3 font-bold">The fitting</legend>
        <div className="grid gap-2">
          <Field label="Car" hint="Make, model and year." error={errors.vehicle?.message}>
            <Input autoComplete="off" {...register('vehicle')} />
          </Field>
          {otherCars.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Cars in your garage">
              {otherCars.map((car) => (
                <Chip key={car.vehicleId} size="sm" onClick={() => setValue('vehicle', carText(car), { shouldValidate: true })}>
                  {carText(car)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <Controller
          control={control}
          name="fittedBy"
          render={({ field, fieldState }) => (
            <RadioGroup
              legend="Who fitted it"
              variant="card"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              options={FITTERS.map((value) => ({ value, label: FITTED_BY_LABELS[value] }))}
            />
          )}
        />

        {!notFitted && (
          <>
            <Field label="How long it took" hint="In minutes. An hour and a half is 90." optional error={errors.timeMinutes?.message}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                step={1}
                trailing={<span className="type-small text-muted">min</span>}
                className="sm:max-w-48"
                {...register('timeMinutes')}
              />
            </Field>
            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <ScalePicker
                  legend="How hard it was"
                  hint="1 is plug in, 5 is a workshop job."
                  optional
                  options={DIFFICULTY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        )}

        <Controller
          control={control}
          name="fittedOk"
          render={({ field, fieldState }) => (
            <RadioGroup
              legend="Did it fit without problems"
              orientation="horizontal"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No, something went wrong' },
              ]}
            />
          )}
        />

        <Field label="What went wrong" optional={fittedOk !== 'no'} hint={fittedOk === 'no' ? 'Holes that did not line up, a missing clip, a fault later.' : undefined} error={errors.issues?.message}>
          <Textarea rows={3} {...register('issues')} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-3 font-bold">Your verdict</legend>
        <Controller
          control={control}
          name="photos"
          render={({ field, fieldState }) => (
            <PhotoPicker value={field.value} onChange={field.onChange} onBusyChange={setUploading} error={fieldState.error?.message} />
          )}
        />
        <Field label="Anything else" optional hint="Tips for the next person fitting it." error={errors.body?.message}>
          <Textarea rows={4} {...register('body')} />
        </Field>
        <Controller
          control={control}
          name="rating"
          render={({ field, fieldState }) => (
            <ScalePicker
              legend="Overall, how happy are you with it"
              options={RATING_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Field label="Your name" hint="Shown on the report. A first name is enough." error={errors.authorName?.message}>
          <Input autoComplete="given-name" className="sm:max-w-sm" {...register('authorName')} />
        </Field>
      </fieldset>

      {formError && (
        <Callout tone="danger" title={formError.title} live icon={formError.title === ONLY_BUYERS ? <Lock aria-hidden /> : undefined}>
          {formError.detail !== formError.title && <p>{formError.detail}</p>}
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="dark" loading={isSubmitting} disabled={uploading}>
          Send report
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        {uploading && <span className="type-small text-muted" aria-live="polite">Waiting for the photos to upload.</span>}
      </div>
    </form>
  );
}
