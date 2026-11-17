import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { BellRing, CircleCheck } from 'lucide-react';
import { Button, Callout, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { applyApiError } from '@/lib/forms';
import { isValidPhone, normalizePhone } from '@/lib/india';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const schema = z.object({
  contact: z
    .string()
    .trim()
    .min(1, { error: 'Enter a mobile number or an email address' })
    .refine((value) => (value.includes('@') ? EMAIL.test(value) : isValidPhone(value)), {
      error: 'Enter a 10 digit mobile number or a valid email address',
    }),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export interface StockAlertFormProps {
  productId: number;
  variantId?: number | null;
  /** "this colour" when a variant is sold out, else the part. */
  what: string;
}

/** Replaces the buy controls while a part is sold out: one field, phone or email, and a promise to tell them. */
export function StockAlertForm({ productId, variantId = null, what }: StockAlertFormProps) {
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { contact: '' } });

  const onSubmit = handleSubmit(async ({ contact }) => {
    setFormError(null);
    const email = contact.includes('@');
    try {
      await api.inbound.stockAlert({
        productId,
        variantId,
        ...(email ? { email: contact } : { phone: normalizePhone(contact) ?? contact }),
      });
      setDone(email ? contact : `+91 ${normalizePhone(contact) ?? contact}`);
    } catch (error) {
      setFormError(applyApiError(error, setError, { phone: 'contact', email: 'contact' }));
    }
  });

  if (done) {
    return (
      <Callout tone="good" icon={<CircleCheck aria-hidden />} title="We will tell you when it is back" live>
        A message goes to {done} once {what} is in stock again. Nothing else.
      </Callout>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 border border-line-strong p-4">
      <div className="grid gap-1">
        <p className="type-h3">Sold out for now</p>
        <p className="type-small text-muted">Leave a number or an email and we will tell you when {what} is back. One message, no list.</p>
      </div>
      <Field label="Mobile number or email" error={errors.contact?.message}>
        <Input {...register('contact')} inputMode="email" autoComplete="email" />
      </Field>
      {formError && !errors.contact && (
        <p role="alert" className="type-small font-bold text-stop">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" block loading={isSubmitting} iconLeft={<BellRing aria-hidden />}>
        Tell me when it is back
      </Button>
    </form>
  );
}
