import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Field, Input, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { isValidGstin, isValidPincode, isValidState, STATE_NAMES, STATES } from '@/lib/india';
import { waLink } from '@/lib/whatsapp';
import type { AdminSettings } from '@/types/api';
import {
  displayPhone,
  FieldGroup,
  normalizeWhatsapp,
  optionalEmail,
  optionalLink,
  optionalPincode,
  SettingsForm,
  text,
  useSectionForm,
  whatsappNumber,
} from './shared';

const schema = z.object({
  storeName: text(80).min(1, { error: 'The store needs a name.' }),
  legalName: text(120),
  tagline: text(140),
  phone: displayPhone,
  /** The second number, shown beside the main one (settings.phones[0]). */
  phone2: displayPhone,
  whatsapp: whatsappNumber,
  email: optionalEmail,
  businessHours: text(120),
  address: z.object({
    line1: text(120),
    line2: text(120),
    city: text(60),
    state: z.string().refine((value) => value === '' || isValidState(value), { error: 'Choose a State from the list.' }),
    pincode: optionalPincode,
  }),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === '' || isValidGstin(value), {
      error: 'This is not a valid GSTIN. Check the 15 characters against your GST certificate.',
    }),
  social: z.object({ instagram: optionalLink, facebook: optionalLink, youtube: optionalLink }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toForm(s: AdminSettings): Input {
  return {
    storeName: s.storeName,
    legalName: s.legalName,
    tagline: s.tagline,
    phone: s.phone,
    phone2: s.phones[0] ?? '',
    whatsapp: s.whatsapp,
    email: s.email,
    businessHours: s.businessHours,
    address: { ...s.address },
    gstin: s.gstin,
    social: { ...s.social },
  };
}

/** '919876543210' → '+91 98765 43210'; other countries as '+' and the digits. */
function showWhatsapp(digits: string): string {
  if (/^91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return `+${digits}`;
}

export function StoreSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm,
    toPatch: ({ phone2, ...values }) => ({
      ...values,
      // The second number replaces the first of the extra numbers; any others are kept as they are.
      phones: [phone2, ...settings.phones.slice(1)].map((value) => value.trim()).filter(Boolean),
    }),
    name: 'Store details',
    fieldFor: (field) => (field === 'phones.0' ? 'phone2' : field),
  });
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = section.form;

  const whatsapp = useWatch({ control, name: 'whatsapp' }) ?? '';
  const gstin = (useWatch({ control, name: 'gstin' }) ?? '').trim().toUpperCase();
  const state = useWatch({ control, name: 'address.state' }) ?? '';

  const [pinNote, setPinNote] = useState<string | null>(null);
  const pincodeField = register('address.pincode');

  const lookUpState = async (pincode: string) => {
    setPinNote(null);
    if (!isValidPincode(pincode)) return;
    try {
      const estimate = await api.shipping.estimate(pincode.trim());
      if (estimate.state && isValidState(estimate.state)) {
        if (estimate.state !== state) setValue('address.state', estimate.state, { shouldDirty: true, shouldValidate: true });
        setPinNote(`${estimate.state}, from the PIN code.`);
      } else {
        setPinNote('We could not tell the State from this PIN code. Choose it below.');
      }
    } catch {
      setPinNote('Could not look up the State just now. Choose it below.');
    }
  };

  const waNumber = normalizeWhatsapp(whatsapp);
  const waTest = waNumber ? waLink(waNumber, '') : '';
  const gstState = isValidGstin(gstin) ? STATES.find((s) => s.code === gstin.slice(0, 2))?.name : undefined;
  const gstMismatch = gstState && state && gstState !== state;

  return (
    <SettingsForm
      id="store"
      title="Store"
      description="Who the shop is and how to reach it. Anything left blank stays hidden on the store, so leave out what you do not want shown."
      section={section}
      saveLabel="Save store details"
    >
      <FieldGroup title="Name">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Store name" error={errors.storeName?.message} required>
            <Input autoComplete="organization" {...register('storeName')} />
          </Field>
          <Field label="Legal name" optional hint="As on your GST certificate. Printed on invoices." error={errors.legalName?.message}>
            <Input {...register('legalName')} />
          </Field>
        </div>
        <Field label="Tagline" optional hint="One line under the logo." error={errors.tagline?.message}>
          <Input {...register('tagline')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Phone" optional hint="The number shoppers call." error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
          </Field>
          <Field label="Second phone" optional hint="Shown beside the main number, for example the studio line." error={errors.phone2?.message}>
            <Input type="tel" inputMode="tel" autoComplete="off" {...register('phone2')} />
          </Field>
          <Field
            label="WhatsApp number"
            optional
            error={errors.whatsapp?.message}
            hint={
              waNumber ? (
                <>
                  Shoppers will message {showWhatsapp(waNumber)}.{' '}
                  {waTest && (
                    <a href={waTest} target="_blank" rel="noreferrer" className="focus-ring rounded-control font-bold text-ink underline underline-offset-4">
                      Test it in WhatsApp
                    </a>
                  )}
                </>
              ) : (
                'Digits with the country code and no spaces: 919876543210 for an Indian mobile. Leave it blank to hide every WhatsApp button on the store.'
              )
            }
          >
            <Input type="tel" inputMode="numeric" autoComplete="off" placeholder="919876543210" {...register('whatsapp')} />
          </Field>
          <Field label="Email" optional hint="Shown to shoppers for questions." error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Business hours" optional hint="For example: Mon to Sat, 10 am to 7 pm" error={errors.businessHours?.message}>
            <Input {...register('businessHours')} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Address" description="Shown to shoppers and used on invoices. The State also decides whether an order is charged CGST and SGST or IGST.">
        <Field label="Address line 1" optional error={errors.address?.line1?.message}>
          <Input autoComplete="address-line1" {...register('address.line1')} />
        </Field>
        <Field label="Address line 2" optional error={errors.address?.line2?.message}>
          <Input autoComplete="address-line2" {...register('address.line2')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="City" optional error={errors.address?.city?.message}>
            <Input autoComplete="address-level2" {...register('address.city')} />
          </Field>
          <Field label="PIN code" optional error={errors.address?.pincode?.message} hint={pinNote ?? 'Fills in the State.'}>
            <Input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              mono
              {...pincodeField}
              onChange={(event) => {
                void pincodeField.onChange(event);
                const value = event.target.value.trim();
                if (value.length === 6) void lookUpState(value);
                else setPinNote(null);
              }}
            />
          </Field>
        </div>
        <Field label="State" optional error={errors.address?.state?.message}>
          <Select placeholder="Choose a State" options={STATE_NAMES.map((name) => ({ value: name, label: name }))} {...register('address.state')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Tax">
        <Field
          label="GSTIN"
          optional
          error={errors.gstin?.message}
          hint={
            gstMismatch
              ? `This GSTIN is registered in ${gstState}, but the address above is in ${state}. Check both.`
              : 'Fifteen characters. Printed on every invoice. Leave blank if you are not registered.'
          }
        >
          <Input mono autoComplete="off" maxLength={15} className="uppercase" {...register('gstin')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Social links" description="Full links to your pages. Blank ones are not shown.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Instagram" optional error={errors.social?.instagram?.message}>
            <Input type="url" inputMode="url" placeholder="https://instagram.com/…" {...register('social.instagram')} />
          </Field>
          <Field label="Facebook" optional error={errors.social?.facebook?.message}>
            <Input type="url" inputMode="url" placeholder="https://facebook.com/…" {...register('social.facebook')} />
          </Field>
          <Field label="YouTube" optional error={errors.social?.youtube?.message}>
            <Input type="url" inputMode="url" placeholder="https://youtube.com/…" {...register('social.youtube')} />
          </Field>
        </div>
      </FieldGroup>
    </SettingsForm>
  );
}
