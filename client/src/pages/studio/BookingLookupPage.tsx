import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Search } from 'lucide-react';
import { ErrorState, PageHeader, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Field, Input, Skeleton, SkeletonText } from '@/components/ui';
import { BookingView } from '@/components/studio/BookingView';
import { useSettings } from '@/hooks/useSettings';
import { api, isApiError } from '@/lib/api';
import { formatPhone, normalizePhone } from '@/lib/india';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';

function LookupSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12" aria-hidden>
      <div className="grid content-start gap-6">
        <Skeleton className="h-44" />
        <SkeletonText lines={2} />
        <SkeletonText lines={6} />
      </div>
      <SkeletonText lines={4} />
    </div>
  );
}

/** Asks for the phone the booking was made with. Shown when the link has none, or it did not match. */
function PhoneForm({ bookingNumber, initialPhone, onSubmit, message }: { bookingNumber: string; initialPhone: string; onSubmit: (phone: string) => void; message?: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = normalizePhone(phone);
    if (!clean) {
      setError('Enter the 10 digit mobile number you booked with.');
      inputRef.current?.focus();
      return;
    }
    setError(undefined);
    onSubmit(clean);
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:gap-16">
      <form noValidate onSubmit={submit} className="grid content-start gap-5">
        {message && (
          <Callout tone="danger" live>
            {message}
          </Callout>
        )}
        <Field label="Booking number">
          <Input mono value={bookingNumber} readOnly />
        </Field>
        <Field label="Phone number" hint="The mobile number given when booking." error={error}>
          <Input
            ref={inputRef}
            inputSize="lg"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            leading={<span className="type-small text-muted">+91</span>}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" block iconLeft={<Search aria-hidden />}>
          Show my booking
        </Button>
      </form>
      <aside aria-labelledby="lookup-help" className="grid content-start gap-3 border-t border-ink pt-4 lg:border-t-0 lg:border-l lg:border-line lg:pt-0 lg:pl-8">
        <h2 id="lookup-help" className="type-h3">
          Why we ask
        </h2>
        <p className="type-body max-w-prose text-muted">
          A booking shows your name, phone and car, so we only open it for the phone it was made with.
        </p>
        <div>
          <WhatsAppButton text={`Hi, I need help with my fitting booking ${bookingNumber}.`}>Ask on WhatsApp</WhatsAppButton>
        </div>
      </aside>
    </div>
  );
}

/** /book-fitting/:number?phone= : one studio booking, opened with the phone it was made with. */
export default function BookingLookupPage() {
  const { number = '' } = useParams();
  const bookingNumber = number.trim().toUpperCase();
  const [params, setParams] = useSearchParams();
  const phone = normalizePhone(params.get('phone')) ?? '';
  const justBooked = params.get('new') === '1';
  const settings = useSettings();

  const booking = useQuery({
    queryKey: queryKeys.studio.booking(bookingNumber, phone),
    queryFn: ({ signal }) => api.studio.booking(bookingNumber, phone, { signal }),
    enabled: Boolean(bookingNumber && phone),
    staleTime: 60_000,
  });

  useDocumentMeta({
    title: booking.data ? `Booking ${booking.data.bookingNumber}` : 'Your fitting booking',
    noindex: true,
  });

  const openWithPhone = (next: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set('phone', next);
    nextParams.delete('new');
    setParams(nextParams, { replace: true });
  };

  const notMatched = isApiError(booking.error) && (booking.error.status === 404 || booking.error.status === 400);
  const title = justBooked && booking.data ? 'Booking received' : 'Your fitting booking';

  let body;
  if (!phone || notMatched) {
    body = (
      <PhoneForm
        key={phone}
        bookingNumber={bookingNumber}
        initialPhone={phone ? formatPhone(phone) : ''}
        onSubmit={openWithPhone}
        message={notMatched ? 'No booking matches that number and phone. Check both: the number is in your confirmation, and the phone is the one you booked with.' : undefined}
      />
    );
  } else if (booking.isPending || settings.isPending) {
    body = <LookupSkeleton />;
  } else if (booking.isError) {
    body = <ErrorState error={booking.error} onRetry={() => void booking.refetch()} title="Could not load the booking" />;
  } else if (settings.isError) {
    body = <ErrorState error={settings.error} onRetry={() => void settings.refetch()} title="Could not load the studio details" />;
  } else {
    body = (
      <BookingView
        booking={booking.data}
        settings={settings.data}
        justBooked={justBooked}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" to="/book-fitting" iconLeft={<CalendarPlus aria-hidden />}>
              Book another fitting
            </Button>
            <Button variant="ghost" to="/shop">
              Browse parts
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="container-page pb-16">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Book a fitting', to: '/book-fitting' }, { label: bookingNumber || 'Booking' }]}
        description={booking.data ? `${booking.data.serviceName} for ${booking.data.name}.` : phone && !notMatched ? undefined : 'Enter the phone you booked with to see the booking.'}
      />
      {body}
    </div>
  );
}
