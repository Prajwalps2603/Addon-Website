import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Field, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { formatINR, pluralize } from '@/lib/format';
import { isValidPincode } from '@/lib/india';
import type { AdminSettings } from '@/types/api';
import { numberOf, optionalPincode, rupees, SettingsForm, ShopperPreview, useSectionForm, wholeNumber } from './shared';

const schema = z.object({
  shipping: z.object({
    originPincode: optionalPincode,
    dispatchDays: wholeNumber(30, 'days'),
    flatFee: rupees(),
    freeShippingThreshold: rupees(),
    bulkySurcharge: rupees(),
    freightSurcharge: rupees(),
  }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

const rupee = <span aria-hidden>₹</span>;

/** The delivery rules as one plain paragraph, from whatever is typed so far. */
function shopperSentence(values: Record<string, unknown> | undefined): string {
  const flat = numberOf(values?.flatFee);
  const free = numberOf(values?.freeShippingThreshold);
  const bulky = numberOf(values?.bulkySurcharge);
  const freight = numberOf(values?.freightSurcharge);
  const days = numberOf(values?.dispatchDays);
  const parts: string[] = [];

  if ([flat, free].some(Number.isNaN)) return 'Fill in the fee and the free-delivery amount to see the sentence.';
  if (free === 0 || flat === 0) parts.push('Delivery is free on every order.');
  else parts.push(`Delivery costs ${formatINR(flat)}, and is free on orders of ${formatINR(free)} or more.`);

  const extras: string[] = [];
  if (bulky > 0) extras.push(`${formatINR(bulky)} for a large item`);
  if (freight > 0) extras.push(`${formatINR(freight)} for an item sent by freight`);
  if (extras.length > 0) parts.push(`Add ${extras.join(', and ')}, even when delivery is free.`);

  if (!Number.isNaN(days)) {
    parts.push(days === 0 ? 'Orders leave the warehouse the same working day.' : `Orders leave the warehouse within ${pluralize(days, 'working day')}.`);
  }
  return parts.join(' ');
}

export function DeliverySection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ shipping: { ...s.shipping } }),
    toPatch: (values) => values,
    name: 'Delivery',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const values = useWatch({ control, name: 'shipping' }) as Record<string, unknown> | undefined;
  const e = errors.shipping;

  const [origin, setOrigin] = useState<string | null>(null);
  const originField = register('shipping.originPincode');
  const lookUp = async (pincode: string) => {
    setOrigin(null);
    if (!isValidPincode(pincode)) return;
    try {
      const estimate = await api.shipping.estimate(pincode);
      setOrigin(estimate.state ? `Ships from ${estimate.state}.` : null);
    } catch {
      setOrigin(null);
    }
  };

  return (
    <SettingsForm
      id="delivery"
      title="Delivery"
      description="What delivery costs and how fast orders leave. Delivery dates on product pages are counted from the dispatch days and the distance from your PIN code."
      section={section}
      saveLabel="Save delivery"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ships from PIN code" error={e?.originPincode?.message} hint={origin ?? 'Your warehouse or shop.'}>
          <Input
            inputMode="numeric"
            maxLength={6}
            mono
            {...originField}
            onChange={(event) => {
              void originField.onChange(event);
              const value = event.target.value.trim();
              if (value.length === 6) void lookUp(value);
              else setOrigin(null);
            }}
          />
        </Field>
        <Field label="Dispatch days" error={e?.dispatchDays?.message} hint="Working days from order to leaving your hands. 0 for the same day.">
          <Input inputMode="numeric" className="tnum" {...register('shipping.dispatchDays')} />
        </Field>
        <Field label="Delivery fee" error={e?.flatFee?.message} hint="Charged once per order below the free-delivery amount.">
          <Input inputMode="numeric" className="tnum" leading={rupee} {...register('shipping.flatFee')} />
        </Field>
        <Field label="Free delivery from" error={e?.freeShippingThreshold?.message} hint="Order value of the parts. 0 makes delivery always free.">
          <Input inputMode="numeric" className="tnum" leading={rupee} {...register('shipping.freeShippingThreshold')} />
        </Field>
        <Field label="Large item surcharge" error={e?.bulkySurcharge?.message} hint="Added once when the cart holds any item marked bulky. 0 for none.">
          <Input inputMode="numeric" className="tnum" leading={rupee} {...register('shipping.bulkySurcharge')} />
        </Field>
        <Field label="Freight surcharge" error={e?.freightSurcharge?.message} hint="Added once when the cart holds any item marked freight. 0 for none.">
          <Input inputMode="numeric" className="tnum" leading={rupee} {...register('shipping.freightSurcharge')} />
        </Field>
      </div>
      <ShopperPreview>{shopperSentence(values)}</ShopperPreview>
    </SettingsForm>
  );
}
