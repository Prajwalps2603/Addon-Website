import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ShareButton, WhatsAppButton } from '@/components/commerce';
import { Button, Callout, Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatINR, pluralize } from '@/lib/format';
import { applyApiError } from '@/lib/forms';
import { formatPhone, normalizePhone } from '@/lib/india';
import { siteUrl } from '@/lib/urls';
import type { KitGoal, SaveKitRequest, Vehicle } from '@/types/api';
import { kitShareText, type ShownKit } from './kitShared';

const saveSchema = z.object({
  name: z.string().trim().min(2, { error: 'Enter your name.' }).max(80, { error: 'Keep the name under 80 letters.' }),
  phone: z
    .string()
    .trim()
    .refine((value) => normalizePhone(value) !== null, { error: 'Enter a 10 digit Indian mobile number.' })
    .transform((value) => normalizePhone(value) as string),
});

type SaveInput = z.input<typeof saveSchema>;
type SaveOutput = z.output<typeof saveSchema>;

export interface KeepKitProps {
  shown: ShownKit;
  goal: KitGoal;
  budget: number;
  vehicle: Vehicle | null;
  /** Used when there is no car: 'Any hatchback'. */
  vehicleLabel: string;
  dealerQuote?: number | null;
  deliveryDate?: string | null;
  /** First line of the shared message. */
  shareHeading: string;
  /** Path and query of this page: the shared link opens the same kit. */
  path: string;
}

/** Save the chosen kit with a name and number so the shop can follow up, and share it. */
export function KeepKit({ shown, goal, budget, vehicle, vehicleLabel, dealerQuote, deliveryDate, shareHeading, path }: KeepKitProps) {
  const [saved, setSaved] = useState<{ phone: string; kit: string } | null>(null);
  const [formError, setFormError] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SaveInput, unknown, SaveOutput>({ resolver: zodResolver(saveSchema), defaultValues: { name: '', phone: '' } });

  const save = useMutation({ mutationFn: (body: SaveKitRequest) => api.kits.save(body) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError('');
    const body: SaveKitRequest = {
      name: values.name,
      phone: values.phone,
      vehicleLabel,
      goal,
      budget,
      productIds: shown.items.map((item) => item.product.id),
    };
    if (dealerQuote) body.dealerQuote = dealerQuote;
    if (deliveryDate) body.deliveryDate = deliveryDate;
    try {
      await save.mutateAsync(body);
      setSaved({ phone: values.phone, kit: shown.kit.title });
    } catch (error) {
      setFormError(applyApiError(error, setError));
    }
  });

  const text = kitShareText({ shown, heading: shareHeading, vehicle, path });
  const empty = shown.items.length === 0;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12">
      <section aria-labelledby="keep-kit-title" className="grid content-start gap-4">
        <div className="grid gap-2">
          <h2 id="keep-kit-title" className="type-h2">
            Save this kit
          </h2>
          <p className="max-w-prose text-muted">
            Leave a name and number and the shop will send you the {shown.kit.title} kit ({pluralize(shown.items.length, 'part')},{' '}
            {formatINR(shown.total)}){deliveryDate ? ` before the car arrives on ${formatDate(deliveryDate, { year: false })}` : ''}. Nothing is
            charged or held for you.
          </p>
        </div>

        {saved ? (
          <Callout
            tone="good"
            title="Kit saved"
            live
            actions={
              <Button variant="link" size="sm" onClick={() => setSaved(null)}>
                Save another kit
              </Button>
            }
          >
            The {saved.kit} kit is saved against {formatPhone(saved.phone)}. Expect a message from the shop about it. Keep this page's link to come
            back to the same kit.
          </Callout>
        ) : (
          <form noValidate onSubmit={onSubmit} className="grid max-w-xl gap-4 sm:grid-cols-2">
            <Field label="Your name" error={errors.name?.message}>
              <Input autoComplete="name" {...register('name')} />
            </Field>
            <Field label="Mobile number" error={errors.phone?.message}>
              <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" {...register('phone')} />
            </Field>
            {formError && (
              <Callout tone="danger" live className="sm:col-span-2">
                {formError}
              </Callout>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" variant="dark" loading={save.isPending} disabled={empty} iconLeft={<BellRing aria-hidden />}>
                Save and remind me
              </Button>
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="share-kit-title" className="grid content-start gap-4 border-t border-line pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-8">
        <div className="grid gap-2">
          <h2 id="share-kit-title" className="type-h3">
            Ask someone first
          </h2>
          <p className="type-small max-w-prose text-muted">The link opens this page with the same car, budget and parts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <WhatsAppButton to="share" text={text}>
            Share on WhatsApp
          </WhatsAppButton>
          <ShareButton url={siteUrl(path)} title={shareHeading} text={text}>
            Share link
          </ShareButton>
        </div>
      </section>
    </div>
  );
}
