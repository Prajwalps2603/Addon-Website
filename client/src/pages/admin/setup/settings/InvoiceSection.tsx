import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { CircleCheck, CircleDashed } from 'lucide-react';
import { Badge, Field, Input, Textarea } from '@/components/ui';
import type { AdminSettings } from '@/types/api';
import { FieldGroup, optionalEmail, SettingsForm, text, useSectionForm } from './shared';

const schema = z.object({
  invoice: z.object({
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,4}$/, { error: 'Use 1 to 4 letters or digits.' }),
    footerNote: text(300),
  }),
  notifications: z.object({ orderEmail: optionalEmail }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

const SMTP_VARIABLES = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] as const;

/** '26-27': the Indian financial year (April to March) today falls in, as invoice numbers use it. */
function financialYear(now = new Date()): string {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const two = (year: number) => String(year % 100).padStart(2, '0');
  return `${two(start)}-${two(start + 1)}`;
}

export function InvoiceSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ invoice: { ...s.invoice }, notifications: { orderEmail: s.notifications.orderEmail } }),
    toPatch: (values) => values,
    name: 'Invoices and notifications',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const prefix = (useWatch({ control, name: 'invoice.prefix' }) ?? '').trim().toUpperCase();
  const note = useWatch({ control, name: 'invoice.footerNote' }) ?? '';
  const orderEmail = (useWatch({ control, name: 'notifications.orderEmail' }) ?? '').trim();
  const smtp = settings.notifications.smtpConfigured;
  const example = `${/^[A-Z0-9]{1,4}$/.test(prefix) ? prefix : 'ADN'}/${financialYear()}/0001`;

  return (
    <SettingsForm
      id="invoices"
      title="Invoices and notifications"
      description="What every tax invoice carries, and where news of a new order goes."
      section={section}
      saveLabel="Save invoices and notifications"
    >
      <FieldGroup title="Invoices">
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field
            label="Invoice prefix"
            error={errors.invoice?.prefix?.message}
            hint={
              <>
                The first invoice this year reads <span className="type-code text-ink">{example}</span>. Numbers restart each 1 April.
              </>
            }
          >
            <Input mono maxLength={4} autoCapitalize="characters" className="uppercase" {...register('invoice.prefix')} />
          </Field>
          <Field
            label="Footer note"
            optional
            error={errors.invoice?.footerNote?.message}
            hint={`Printed at the foot of every invoice: bank details, a thank-you, terms. ${300 - note.length} characters left.`}
          >
            <Textarea rows={3} maxLength={300} {...register('invoice.footerNote')} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="New order emails">
        <Field
          label="Send new orders to"
          optional
          error={errors.notifications?.orderEmail?.message}
          hint={orderEmail ? 'Each new order is emailed here.' : 'Blank: no email is sent. Orders still appear in the admin.'}
        >
          <Input type="email" inputMode="email" autoComplete="email" {...register('notifications.orderEmail')} />
        </Field>
        <div className="grid gap-3 border border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            {smtp ? (
              <Badge tone="fit" icon={<CircleCheck aria-hidden />}>
                Outgoing email is set up
              </Badge>
            ) : (
              <Badge tone="warn" icon={<CircleDashed aria-hidden />}>
                Outgoing email is not set up
              </Badge>
            )}
          </div>
          <p className="type-small max-w-prose text-muted">
            {smtp
              ? 'Order confirmations, status updates and password resets go out by email. The mail server is set in the server’s environment file.'
              : 'No email leaves the shop yet: order confirmations, status updates and these new-order emails are only written to the server log. Add the mail server to the server’s environment file (.env) and restart it.'}
          </p>
          <ul aria-label="Environment variables" className="flex flex-wrap gap-2">
            {SMTP_VARIABLES.map((name) => (
              <li key={name} className="type-code rounded-control bg-surface px-2 py-1">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </FieldGroup>
    </SettingsForm>
  );
}
