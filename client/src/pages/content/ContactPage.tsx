import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import * as z from 'zod';
import { BoardWord, PitBoard } from '@/components/brand';
import { ErrorState, PageHeader, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, CopyButton, Field, Input, Skeleton, SkeletonText, Textarea } from '@/components/ui';
import { KindDropdown } from './KindDropdown';
import { useMe } from '@/hooks/useMe';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPhone, normalizePhone } from '@/lib/india';
import { useDocumentMeta } from '@/lib/seo';
import type { EnquiryInput, EnquiryKind, PublicSettings } from '@/types/api';
import { GrievanceBlock, StoreContactList, hasDirectContact } from './parts/StoreBlocks';
import { businessName, clean } from './parts/storeFacts';

const KINDS = ['contact', 'complaint', 'bulk', 'install', 'return'] as const satisfies readonly EnquiryKind[];

function isKind(value: string | null): value is EnquiryKind {
  return value !== null && (KINDS as readonly string[]).includes(value);
}

const CONTACT_MESSAGE = 'Give a mobile number or an email so we can reply.';

const schema = z
  .object({
    kind: z.enum(KINDS),
    name: z.string().trim().min(2, { error: 'Enter your name' }).max(80, { error: 'Keep the name to 80 characters or fewer.' }),
    phone: z
      .string()
      .trim()
      .refine((value) => value === '' || isValidPhone(value), { error: 'Enter a 10 digit mobile number.' }),
    email: z
      .string()
      .trim()
      .refine((value) => value === '' || z.email().safeParse(value).success, { error: 'Enter an email address like name@example.com.' }),
    subject: z.string().trim().max(120, { error: 'Keep the subject to 120 characters or fewer.' }),
    message: z
      .string()
      .trim()
      .min(5, { error: 'Type your message.' })
      .max(4000, { error: 'Keep the message to 4000 characters or fewer.' }),
    orderNumber: z.string().trim().max(40, { error: 'That is longer than any order number.' }),
  })
  .superRefine((values, ctx) => {
    if (!values.phone && !values.email) ctx.addIssue({ code: 'custom', path: ['phone'], message: CONTACT_MESSAGE });
    if (values.kind === 'return' && !values.orderNumber) {
      ctx.addIssue({ code: 'custom', path: ['orderNumber'], message: 'Add the order number of the part you want to return.' });
    }
  });

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Receipt {
  ticketNumber: string;
  kind: EnquiryKind;
  email: string;
  phone: string;
}

function kindOptions(settings: PublicSettings | undefined) {
  const windowDays = settings?.returns.windowDays ?? 0;
  return [
    { value: 'contact' as const, label: 'A question', description: 'About a part, an order or anything else.' },
    { value: 'install' as const, label: 'Fitting help', description: 'Stuck while fitting a part you bought from us.' },
    { value: 'return' as const, label: 'A return', description: windowDays > 0 ? `Within ${windowDays} days of delivery. Add the order number.` : 'Add the order number.' },
    { value: 'complaint' as const, label: 'A complaint', description: 'Goes to the grievance officer. Acknowledged within 48 hours.' },
    { value: 'bulk' as const, label: 'A bulk order', description: 'Several pieces, or parts for a garage or a fleet.' },
  ];
}

/* ------------------------------------------------------------------ after sending */

function ReceiptPanel({ receipt, onAnother }: { receipt: Receipt; onAnother: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  // Break the number before its digits so the board wraps cleanly on a phone.
  const boardText = receipt.ticketNumber.replace(/-(?=\d+$)/, ' ');

  return (
    <section aria-labelledby="receipt-title" className="grid gap-6">
      <PitBoard title="Your ticket" aside={<CopyButton value={receipt.ticketNumber} label="Copy" />}>
        <BoardWord text={boardText} tone="brand" size="sm" className="sm:hidden" />
        <BoardWord text={boardText} tone="brand" size="md" className="hidden sm:inline-flex" />
      </PitBoard>
      <div className="grid gap-4">
        <h2 id="receipt-title" ref={heading} tabIndex={-1} className="type-h2 outline-none">
          Message received
        </h2>
        <p className="type-body max-w-prose">
          Keep the ticket number <span className="type-code">{receipt.ticketNumber}</span>. Quote it if you call or message us about this.
        </p>
        <h3 className="type-h3">What happens next</h3>
        <ol className="type-body grid max-w-prose list-decimal gap-2 pl-5 marker:font-bold">
          <li>
            We acknowledge it within 48 hours{receipt.email ? ` by email to ${receipt.email}` : receipt.phone ? ` on ${receipt.phone}` : ''}.
          </li>
          {receipt.kind === 'complaint' && <li>The grievance officer looks into it and resolves it within one month.</li>}
          {receipt.kind === 'return' && <li>We check the order and reply with how to send the part back.</li>}
          {receipt.kind === 'bulk' && <li>We reply with prices and stock for the quantity you asked about.</li>}
          {receipt.kind === 'install' && <li>We reply with what to try next, or ask for a photo of where you are stuck.</li>}
          {receipt.kind === 'contact' && <li>The shop replies with an answer, or with what we need from you to give one.</li>}
          {receipt.email && <li>A copy of your message goes to {receipt.email}.</li>}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="dark" to="/shop">
          Back to the shop
        </Button>
        <Button variant="ghost" onClick={onAnother}>
          Send another message
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ the form */

function ContactForm({ settings, onSent }: { settings: PublicSettings | undefined; onSent: (receipt: Receipt) => void }) {
  const [params] = useSearchParams();
  const { user } = useMe();
  const [formError, setFormError] = useState<string | null>(null);
  const kindParam = params.get('kind');
  const initialOrder = clean(params.get('order')).toUpperCase().slice(0, 40);

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: isKind(kindParam) ? kindParam : initialOrder ? 'return' : 'contact',
      name: '',
      phone: '',
      email: '',
      subject: '',
      message: '',
      orderNumber: initialOrder,
    },
  });

  // Fill in what the account already knows, without overwriting anything typed.
  useEffect(() => {
    if (!user) return;
    const now = getValues();
    if (!now.name && user.name) setValue('name', user.name);
    if (!now.email && user.email) setValue('email', user.email);
    if (!now.phone && user.phone) setValue('phone', user.phone);
  }, [user, getValues, setValue]);

  // A link on this same page (Raise a complaint) changes ?kind=: follow it and bring the form into view.
  const formRef = useRef<HTMLFormElement>(null);
  const seenKind = useRef(kindParam);
  useEffect(() => {
    if (seenKind.current === kindParam) return;
    seenKind.current = kindParam;
    if (!isKind(kindParam)) return;
    setValue('kind', kindParam);
    formRef.current?.scrollIntoView({ block: 'start' });
  }, [kindParam, setValue]);

  const send =useMutation({ mutationFn: (body: EnquiryInput) => api.inbound.enquiry(body) });
  const kind = watch('kind');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const phone = values.phone ? (normalizePhone(values.phone) ?? values.phone) : '';
    const body: EnquiryInput = {
      kind: values.kind,
      name: values.name,
      message: values.message,
      ...(phone ? { phone } : {}),
      ...(values.email ? { email: values.email } : {}),
      ...(values.subject ? { subject: values.subject } : {}),
      ...(values.orderNumber ? { orderNumber: values.orderNumber.toUpperCase() } : {}),
    };
    try {
      const receipt = await send.mutateAsync(body);
      onSent({ ticketNumber: receipt.ticketNumber, kind: values.kind, email: values.email, phone });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const orderNeeded = kind === 'return';

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-labelledby="contact-form-title" className="checkout-soft grid scroll-mt-24 gap-6">
      <h2 id="contact-form-title" className="type-h2">
        Write to us
      </h2>

      <Controller
        control={control}
        name="kind"
        render={({ field }) => (
          <KindDropdown
            label="What is it about?"
            options={kindOptions(settings)}
            value={field.value}
            onChange={field.onChange}
            error={errors.kind?.message}
          />
        )}
      />

      <Field label="Your name" required error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number" hint="Give this, an email, or both." error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="tel-national" leading={<span className="type-small text-muted">+91</span>} {...register('phone')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" {...register('email')} />
        </Field>
      </div>

      <Field label="Order number" optional={!orderNeeded} required={orderNeeded} hint="On your order email and the order page." error={errors.orderNumber?.message}>
        <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} {...register('orderNumber')} />
      </Field>

      <Field label="Subject" optional error={errors.subject?.message}>
        <Input autoComplete="off" placeholder="For example: LED bulbs for a 2019 Swift" {...register('subject')} />
      </Field>

      <Field label="Message" required hint="Your car, the part and what happened help us answer in one go." error={errors.message?.message}>
        <Textarea rows={6} {...register('message')} />
      </Field>

      {formError && (
        <Callout tone="danger" live title="Your message was not sent">
          {formError}
        </Callout>
      )}

      <div className="grid gap-3 sm:flex sm:items-center sm:gap-4">
        <Button type="submit" size="lg" loading={isSubmitting} iconRight={<Send />} className="!rounded-full px-8">
          Send message
        </Button>
        <p className="type-small text-muted">You get a ticket number straight away.</p>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ the store's own details */

function StoreDetails({ settings, isPending, error, onRetry }: { settings: PublicSettings | undefined; isPending: boolean; error: unknown; onRetry: () => void }) {
  if (isPending) {
    return (
      <div className="grid gap-4" aria-hidden>
        <Skeleton className="h-6 w-40" />
        <SkeletonText lines={4} />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error || !settings) {
    return <ErrorState error={error} onRetry={onRetry} title="Could not load the shop’s details" size="sm" />;
  }

  const gstin = clean(settings.gstin);
  const legal = clean(settings.legalName);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="reach-title" className="grid gap-3">
        <h2 id="reach-title" className="type-h3">
          Reach the shop
        </h2>
        {hasDirectContact(settings) || clean(settings.businessHours) ? (
          <StoreContactList settings={settings} className="border-y border-line" />
        ) : (
          <p className="type-body text-muted">The shop has not published a phone number or address yet. The form reaches the owner directly.</p>
        )}
        <WhatsAppButton text="Hello, I have a question." block className="!rounded-full !border-[#1fa855] !bg-[#25d366] !text-white hover:!bg-[#1fa855]" />
        {(legal || gstin) && (
          <dl className="type-small grid gap-1 pt-1 text-muted">
            {legal && (
              <div>
                <dt className="inline">Registered name: </dt>
                <dd className="inline text-ink">{legal}</dd>
              </div>
            )}
            {gstin && (
              <div>
                <dt className="inline">GSTIN: </dt>
                <dd className="type-code inline text-ink">{gstin}</dd>
              </div>
            )}
          </dl>
        )}
      </section>
      <GrievanceBlock settings={settings} id="grievance" />
    </div>
  );
}

export default function ContactPage() {
  useDocumentMeta({
    title: 'Contact',
    description: 'Ask a question, get fitting help, raise a return or a complaint. Every message gets a ticket number.',
  });
  const { data: settings, isPending, error, refetch } = useSettings();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const name = settings ? businessName(settings) : 'the shop';

  return (
    <div className="container-page pb-16">
      <PageHeader
        title="Contact"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contact' }]}
        description={`Questions, fitting help, returns and complaints all reach ${name} here. Every message gets a ticket number.`}
      />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="max-w-[40rem] min-w-0">
          {receipt ? <ReceiptPanel receipt={receipt} onAnother={() => setReceipt(null)} /> : <ContactForm settings={settings} onSent={setReceipt} />}
        </div>
        <aside className="min-w-0" aria-label="The shop’s contact details">
          <StoreDetails settings={settings} isPending={isPending} error={error} onRetry={() => void refetch()} />
        </aside>
      </div>
    </div>
  );
}
