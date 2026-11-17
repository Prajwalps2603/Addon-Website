import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Search } from 'lucide-react';
import { ErrorState, PageHeader, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Field, Input, Skeleton, SkeletonText, Textarea } from '@/components/ui';
import SlotPicker, { type SlotValue } from '@/components/studio/SlotPicker';
import { CarChoice, carLabel, type CarValue } from '@/components/studio/CarChoice';
import { ServicePicker } from '@/components/studio/ServicePicker';
import { StudioPaused } from '@/components/studio/StudioPaused';
import { StudioContact } from '@/components/studio/StudioContact';
import { bookingPath } from '@/components/studio/BookingView';
import { chargeLabel, longDate, slotLabel } from '@/components/studio/studioTime';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { api, isApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { minutesLabel } from '@/lib/format';
import { isValidPhone, normalizePhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { useCheckout } from '@/stores/checkout';
import type { BookingRequest, PublicSettings, StudioService } from '@/types/api';

const schema = z.object({
  name: z.string().trim().min(2, { error: 'Enter your name.' }).max(80, { error: 'Keep the name to 80 characters or fewer.' }),
  phone: z
    .string()
    .trim()
    .min(1, { error: 'Enter your mobile number.' })
    .refine(isValidPhone, { error: 'Enter a 10 digit Indian mobile number.' })
    .transform((value) => normalizePhone(value) ?? value),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.email().safeParse(value).success, { error: 'Enter an email address like name@example.com.' }),
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .max(16, { error: 'Keep the registration number to 16 characters.' })
    .regex(/^[A-Z0-9 -]*$/, { error: 'Use letters, numbers, spaces and hyphens, for example KA 01 AB 1234.' }),
  notes: z.string().trim().max(400, { error: 'Keep the notes to 400 characters or fewer.' }),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

type Section = 'service' | 'car' | 'slot';
type SectionErrors = Partial<Record<Section, string>>;

const SECTION_FIELDS: Record<string, Section> = {
  serviceId: 'service',
  vehicleId: 'car',
  vehicleLabel: 'car',
  date: 'slot',
  slot: 'slot',
};

function Step({ id, title, hint, children }: { id: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="grid min-w-0 gap-4 border-t border-ink pt-4">
      <div className="grid gap-1">
        <h2 id={`${id}-heading`} tabIndex={-1} className="type-h2 outline-none">
          {title}
        </h2>
        {hint && <p className="type-small max-w-prose text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value, empty }: { label: string; value: ReactNode; empty: string }) {
  return (
    <div className="grid gap-0.5 border-b border-line py-2.5">
      <dt className="type-label text-muted">{label}</dt>
      <dd className={cn('type-body min-w-0 break-words', !value && 'text-muted')}>{value || empty}</dd>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-hidden>
      <div className="grid gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </div>
      <SkeletonText lines={5} className="hidden lg:grid" />
    </div>
  );
}

/** "Already booked?": the number and phone open the booking page. */
function FindBooking() {
  const navigate = useNavigate();
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<{ number?: string; phone?: string }>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: { number?: string; phone?: string } = {};
    const cleanNumber = number.trim().toUpperCase();
    const cleanPhone = normalizePhone(phone);
    if (!cleanNumber) next.number = 'Enter the booking number.';
    if (!cleanPhone) next.phone = 'Enter the 10 digit mobile number you booked with.';
    setError(next);
    if (next.number || next.phone || !cleanPhone) return;
    navigate(bookingPath({ bookingNumber: cleanNumber, phone: cleanPhone }));
  };

  return (
    <section aria-labelledby="find-booking" className="grid gap-3 border-t border-line pt-4">
      <h2 id="find-booking" className="type-h3">
        Already booked?
      </h2>
      <form noValidate onSubmit={submit} className="grid gap-3">
        <Field label="Booking number" hint="It looks like ADN-B-000123." error={error.number}>
          <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} value={number} onChange={(event) => setNumber(event.target.value)} />
        </Field>
        <Field label="Phone number" error={error.phone}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            leading={<span className="type-small text-muted">+91</span>}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <div>
          <Button type="submit" variant="outline" iconLeft={<Search aria-hidden />}>
            Find my booking
          </Button>
        </div>
      </form>
    </section>
  );
}

function BookingForm({ settings }: { settings: PublicSettings }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const { user } = useMe();
  const activeCar = useActiveCar();

  const services = settings.services;
  const wanted = params.get('service');
  const [serviceId, setServiceId] = useState<string | null>(() =>
    wanted && services.some((service) => service.id === wanted) ? wanted : null,
  );
  const [car, setCar] = useState<CarValue | null>(() =>
    activeCar ? { kind: 'catalogue', vehicle: activeCar.vehicle, year: activeCar.year } : null,
  );
  const [slot, setSlot] = useState<SlotValue | null>(null);
  const [sectionErrors, setSectionErrors] = useState<SectionErrors>({});
  const [formError, setFormError] = useState<ReactNode>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const service: StudioService | undefined = services.find((item) => item.id === serviceId);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: (() => {
      const contact = useCheckout.getState().contact;
      return { name: contact.name, phone: contact.phone, email: contact.email, registrationNumber: '', notes: '' };
    })(),
  });

  // A signed-in customer's details fill whatever is still empty.
  useEffect(() => {
    if (!user) return;
    const current = getValues();
    if (!current.name) setValue('name', user.name);
    if (!current.phone && user.phone) setValue('phone', user.phone);
    if (!current.email) setValue('email', user.email);
  }, [user, getValues, setValue]);

  const clearSection = (section: Section) => setSectionErrors((previous) => (previous[section] ? { ...previous, [section]: undefined } : previous));

  const onSlotChange = useCallback((value: SlotValue | null) => {
    setSlot(value);
    if (value) setSectionErrors((previous) => (previous.slot ? { ...previous, slot: undefined } : previous));
  }, []);

  const book = useMutation({ mutationFn: (body: BookingRequest) => api.studio.book(body) });

  const focusSection = (section: Section) => {
    const heading = document.getElementById(`${section}-heading`);
    heading?.focus();
    heading?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const checkSections = (): SectionErrors => {
    const next: SectionErrors = {};
    if (!service) next.service = 'Choose the work you want done.';
    if (!car || (car.kind === 'typed' && car.label.trim().length < 2)) {
      next.car = car?.kind === 'typed' ? 'Type the make, model and year of your car.' : 'Tell us which car you are bringing.';
    }
    if (!slot) next.slot = 'Choose a day and a time.';
    return next;
  };

  const onSubmit = (event: FormEvent) => {
    setFormError(null);
    const missing = checkSections();
    setSectionErrors(missing);
    const firstMissing = (['service', 'car', 'slot'] as const).find((section) => missing[section]);
    void handleSubmit(
      async (values) => {
        if (firstMissing || !service || !car || !slot) {
          if (firstMissing) focusSection(firstMissing);
          return;
        }
        const yearNote = car.kind === 'catalogue' && car.year ? `Model year ${car.year}.` : '';
        const body: BookingRequest = {
          serviceId: service.id,
          date: slot.date,
          slot: slot.slot,
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          vehicleId: car.kind === 'catalogue' ? car.vehicle.id : undefined,
          vehicleLabel: carLabel(car).slice(0, 80),
          registrationNumber: values.registrationNumber || undefined,
          notes: [yearNote, values.notes].filter(Boolean).join(' ') || undefined,
        };
        try {
          const booking = await book.mutateAsync(body);
          queryClient.setQueryData(queryKeys.studio.booking(booking.bookingNumber, booking.phone), booking);
          void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
          useCheckout.getState().setContact({ name: values.name, phone: values.phone, email: values.email });
          navigate(`${bookingPath(booking)}&new=1`);
        } catch (error) {
          handleBookingError(error);
        }
      },
      () => {
        if (firstMissing) focusSection(firstMissing);
      },
    )(event);
  };

  const handleBookingError = (error: unknown) => {
    if (!isApiError(error)) {
      setFormError('Something went wrong. Try again in a minute.');
      return;
    }
    if (error.code === 'slot_unavailable') {
      setSlot(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.studio.diary() });
      setSectionErrors((previous) => ({ ...previous, slot: 'That slot has just been taken. Pick another time.' }));
      focusSection('slot');
      return;
    }
    if (error.code === 'duplicate_booking') {
      setFormError('This phone number already has a booking in that slot. Look it up below, or pick another time.');
      errorRef.current?.focus();
      return;
    }
    if (error.hasFields) {
      const fromServer: SectionErrors = {};
      let firstField = true;
      for (const [field, message] of Object.entries(error.fields)) {
        const section = SECTION_FIELDS[field];
        if (section) {
          fromServer[section] = message;
        } else if (field in schema.shape) {
          setError(field as keyof FormInput, { type: 'server', message }, { shouldFocus: firstField });
          firstField = false;
        }
      }
      setSectionErrors((previous) => ({ ...previous, ...fromServer }));
      setFormError(error.message);
      return;
    }
    if (error.status === 429) setFormError('Too many tries in a short time. Wait a few minutes and try again.');
    else if (error.status === 0) setFormError('You seem to be offline. Check your connection and try again.');
    else setFormError(error.message);
    errorRef.current?.focus();
  };

  const serviceMeta = service ? [chargeLabel(service), minutesLabel(service.minutes) && `about ${minutesLabel(service.minutes)}`].filter(Boolean).join(', ') : '';

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid min-w-0 content-start gap-10">
        <Step
          id="service"
          title="The work"
          hint="Fitting charges are per part fitted and include GST. Not sure what your car needs? Book the free consultation."
        >
          <ServicePicker
            services={services}
            value={serviceId}
            onChange={(id) => {
              setServiceId(id);
              clearSection('service');
            }}
            error={sectionErrors.service}
          />
        </Step>

        <Step id="car" title="Your car" hint="So the team has the right fittings ready.">
          <CarChoice
            value={car}
            onChange={(value) => {
              setCar(value);
              if (value && (value.kind === 'catalogue' || value.label.trim().length >= 2)) clearSection('car');
            }}
            error={sectionErrors.car}
          />
          <Field label="Registration number" optional hint="For example KA 01 AB 1234." error={errors.registrationNumber?.message} className="checkout-soft max-w-xs">
            <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16} {...register('registrationNumber')} />
          </Field>
        </Step>

        <Step
          id="slot"
          title="Day and time"
          hint={`Times are India time. Each slot takes ${settings.studio.carsPerSlot === 1 ? 'one car' : `${settings.studio.carsPerSlot} cars`}.`}
        >
          <SlotPicker value={slot} onChange={onSlotChange} error={sectionErrors.slot} />
        </Step>

        <Step id="contact" title="Your details" hint="We confirm the slot on this number.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}>
              <Input autoComplete="name" {...register('name')} />
            </Field>
            <Field label="Mobile number" error={errors.phone?.message}>
              <Input type="tel" inputMode="tel" autoComplete="tel" leading={<span className="type-small text-muted">+91</span>} {...register('phone')} />
            </Field>
            <Field label="Email" optional hint="We email a copy of the booking." error={errors.email?.message} className="sm:col-span-2">
              <Input type="email" inputMode="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field
              label="Notes for the studio"
              optional
              hint="The part you are bringing, anything already fitted, a time you cannot make."
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              <Textarea rows={3} maxLength={400} {...register('notes')} />
            </Field>
          </div>
        </Step>
      </div>

      <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-24 lg:self-start">
        <div className="grid gap-4 border-t border-ink pt-4">
          <h2 id="summary-heading" className="type-h3">
            Your booking
          </h2>
          <dl>
            <SummaryRow
              label="Work"
              empty="Not chosen yet"
              value={
                service && (
                  <>
                    {service.name}
                    <span className="type-small block text-muted tnum">{serviceMeta}</span>
                  </>
                )
              }
            />
            <SummaryRow label="Car" empty="Not chosen yet" value={car && carLabel(car)} />
            <SummaryRow
              label="Slot"
              empty="Not chosen yet"
              value={slot && <span className="tnum">{`${longDate(slot.date).replace(/ \d{4}$/, '')}, ${slotLabel(slot.slot)}`}</span>}
            />
          </dl>

          {formError && (
            <div ref={errorRef} tabIndex={-1} className="outline-none">
              <Callout tone="danger" live>
                {formError}
              </Callout>
            </div>
          )}

          <Button type="submit" size="lg" block loading={book.isPending} iconLeft={<CalendarCheck aria-hidden />}>
            Book this slot
          </Button>
          <p className="type-small text-muted">Nothing to pay now. The studio confirms every booking with you.</p>
          <WhatsAppButton variant="ghost" size="sm" text="Hi, I have a question about booking a fitting at your studio.">
            Questions? WhatsApp the studio
          </WhatsAppButton>
        </div>
      </aside>
    </form>
  );
}

/** /book-fitting: book a fitting service at the studio on its own. */
export default function BookFittingPage() {
  const settings = useSettings();

  useDocumentMeta({
    title: 'Book a fitting slot',
    description: 'Book a slot at the Addon Automotive fitting studio: stereo, speakers, lights, body kits, seat covers, sun film and alloy wheels, or a free upgrade consultation.',
  });

  const content = (() => {
    if (settings.isPending) return <PageSkeleton />;
    if (settings.isError) return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} title="Could not load the studio" />;
    const data = settings.data;
    if (!data.studio.enabled) return <StudioPaused settings={data} />;
    if (data.services.length === 0) {
      return (
        <div className="grid gap-4">
          <Callout tone="info" title="No services listed yet">
            The studio has not listed its fitting services online. Message us and we will book you in.
          </Callout>
          <StudioContact settings={data} showAddress={false} />
        </div>
      );
    }
    return <BookingForm settings={data} />;
  })();

  return (
    <div className="container-page pb-16">
      <PageHeader
        title="Book a fitting slot"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Book a fitting' }]}
        description="Choose the work, your car and a time. Our team fits it at the Addon studio."
      />
      {content}
      {settings.data?.studio.enabled && (
        <div className="mt-12 max-w-md">
          <FindBooking />
        </div>
      )}
    </div>
  );
}
