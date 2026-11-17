import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { slotLabel } from '@/components/studio';
import { Button, Callout, Checkbox, Field, IconButton, Input, Select, Switch, Textarea } from '@/components/ui';
import { pluralize } from '@/lib/format';
import type { AdminSettings, StudioSettings } from '@/types/api';
import { FieldGroup, numberOf, optionalLink, SettingsForm, ShopperPreview, text, useSectionForm, wholeNumber } from './shared';

const MAX_SLOTS = 16;
const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
] as const;

const clock = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use a time such as 10:00 or 17:30.' });

const schema = z
  .object({
    studio: z.object({
      enabled: z.boolean(),
      address: text(300),
      mapUrl: optionalLink,
      slots: z
        .array(z.object({ time: clock }))
        .min(1, { error: 'Add at least one slot time.' })
        .max(MAX_SLOTS, { error: `Keep it to ${MAX_SLOTS} slots.` }),
      carsPerSlot: wholeNumber(20, 'cars').refine((value) => value >= 1, { error: 'At least one car per slot.' }),
      sundayLastSlot: z.string(),
      closedWeekdays: z.array(z.number()).max(6, { error: 'Keep the studio open on at least one day.' }),
      minNoticeMinutes: wholeNumber(7 * 24 * 60, 'minutes'),
      maxDaysAhead: wholeNumber(365, 'days').refine((value) => value >= 1, { error: 'Open bookings at least one day ahead.' }),
    }),
  })
  .superRefine((values, ctx) => {
    const times = values.studio.slots.map((row) => row.time.trim());
    times.forEach((time, index) => {
      if (times.indexOf(time) !== index) ctx.addIssue({ code: 'custom', path: ['studio', 'slots', index, 'time'], message: 'This time is already in the list.' });
    });
    const last = values.studio.sundayLastSlot;
    if (last && !times.includes(last)) {
      ctx.addIssue({ code: 'custom', path: ['studio', 'sundayLastSlot'], message: 'Choose one of the slot times above, or all slots.' });
    }
  });

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

function toForm(s: AdminSettings): Input {
  return {
    studio: {
      ...s.studio,
      slots: s.studio.slots.map((time) => ({ time })),
      closedWeekdays: [...s.studio.closedWeekdays],
    },
  };
}

function toPatch(values: Output): { studio: StudioSettings } {
  const studio = values.studio;
  return {
    studio: {
      ...studio,
      address: studio.address.trim(),
      slots: [...new Set(studio.slots.map((row) => row.time.trim()))].sort(),
      closedWeekdays: [...new Set(studio.closedWeekdays)].sort(),
    },
  };
}

/** 'studio.slots.2' (a string on the server) → 'studio.slots.2.time' here. */
function fieldFor(serverField: string): string {
  return /^studio\.slots\.\d+$/.test(serverField) ? `${serverField}.time` : serverField;
}

/** The rules as a shopper would read them, from what is typed so far. */
function rulesSentence(values: Input['studio'] | undefined): string {
  if (!values) return '';
  if (!values.enabled) return 'Studio bookings are paused. Shoppers cannot book a slot, collect from the studio or ask for fitting at checkout.';
  const times = [...new Set((values.slots ?? []).map((row) => row.time).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort();
  if (times.length === 0) return 'Add a slot time to see the sentence.';
  const cars = numberOf(values.carsPerSlot);
  const notice = numberOf(values.minNoticeMinutes);
  const ahead = numberOf(values.maxDaysAhead);
  const closed = WEEKDAYS.filter((day) => (values.closedWeekdays ?? []).includes(day.value)).map((day) => `${day.label}s`);
  const parts = [`Slots start at ${times.map(slotLabel).join(', ')}.`];
  if (!Number.isNaN(cars) && cars > 0) parts.push(`The studio takes ${pluralize(cars, 'car')} in each slot.`);
  if (values.sundayLastSlot && !(values.closedWeekdays ?? []).includes(0)) parts.push(`On Sundays the last slot starts at ${slotLabel(values.sundayLastSlot)}.`);
  if (closed.length > 0) parts.push(`Closed on ${closed.join(' and ')}.`);
  if (!Number.isNaN(notice) && notice > 0) {
    parts.push(notice % 60 === 0 ? `Same-day slots need ${pluralize(notice / 60, 'hour')} notice.` : `Same-day slots need ${notice} minutes notice.`);
  }
  if (!Number.isNaN(ahead) && ahead > 0) parts.push(`Book up to ${pluralize(ahead, 'day')} ahead.`);
  return parts.join(' ');
}

export function StudioSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm,
    toPatch,
    name: 'Studio',
    fieldFor,
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const slots = useFieldArray({ control, name: 'studio.slots' });
  const values = useWatch({ control, name: 'studio' });
  const e = errors.studio;
  const times = [...new Set((values?.slots ?? []).map((row) => row.time).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort();
  const mapUrl = values?.mapUrl?.trim() ?? '';

  return (
    <SettingsForm
      id="studio"
      title="Studio"
      description="Where the fitting studio is and how its diary runs. Shoppers book a slot for a fitting service, or for the parts in their order. Times are India time."
      section={section}
      saveLabel="Save studio"
    >
      <Switch
        label="Take studio bookings"
        description="Off pauses booking a slot, collecting from the studio and fitting at checkout. Bookings already made stay in the diary."
        labelFirst
        {...register('studio.enabled')}
      />
      {values && !values.enabled && (
        <Callout tone="warn" title="Bookings are paused">
          Save to take the studio off the shop. Switch it back on to open the diary again.
        </Callout>
      )}

      <FieldGroup title="Where it is" description="Shown on the booking page, in booking emails and in the WhatsApp messages to customers.">
        <Field label="Studio address" optional error={e?.address?.message} hint="As you would tell a customer, with a landmark. Leave blank until it is fixed.">
          <Textarea rows={3} maxLength={300} autoComplete="street-address" {...register('studio.address')} />
        </Field>
        <Field
          label="Map link"
          optional
          error={e?.mapUrl?.message}
          hint={
            mapUrl && /^https?:\/\//.test(mapUrl) ? (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-1 rounded-control font-bold text-ink underline underline-offset-4">
                Open the link to check it
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : (
              'The Share link from Google Maps, starting with https://'
            )
          }
        >
          <Input type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" {...register('studio.mapUrl')} />
        </Field>
      </FieldGroup>

      <FieldGroup title={`Slots, ${slots.fields.length} of ${MAX_SLOTS}`} description="The start time of each slot. They are put in order when you save.">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.fields.map((row, index) => (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
              <Field label={`Slot ${index + 1}`} labelHidden error={e?.slots?.[index]?.time?.message}>
                <Input type="time" step={300} className="tnum" {...register(`studio.slots.${index}.time`)} />
              </Field>
              <IconButton label={`Remove slot ${index + 1}`} disabled={slots.fields.length <= 1} onClick={() => slots.remove(index)}>
                <Trash2 aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
        {(e?.slots?.root?.message || e?.slots?.message) && <p className="type-small font-bold text-stop">{e?.slots?.root?.message ?? e?.slots?.message}</p>}
        <div>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<Plus aria-hidden />}
            disabled={slots.fields.length >= MAX_SLOTS}
            onClick={() => slots.append({ time: '' }, { shouldFocus: true })}
          >
            Add a slot
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cars per slot" error={e?.carsPerSlot?.message} hint="How many bays the team can work on at once.">
            <Input inputMode="numeric" className="tnum" {...register('studio.carsPerSlot')} />
          </Field>
          <Field label="Last slot on Sunday" error={e?.sundayLastSlot?.message} hint="Sunday is a half day: no slot starts after this time.">
            <Select
              options={[{ value: '', label: 'Every slot, no half day' }, ...times.map((time) => ({ value: time, label: slotLabel(time) }))]}
              {...register('studio.sundayLastSlot')}
            />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Closed days" description="Weekdays the studio takes no cars. Leave all unticked to open every day.">
        <Controller
          control={control}
          name="studio.closedWeekdays"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {WEEKDAYS.map((day) => {
                const checked = (field.value ?? []).includes(day.value);
                return (
                  <Checkbox
                    key={day.value}
                    label={day.label}
                    checked={checked}
                    onChange={(event) =>
                      field.onChange(event.target.checked ? [...(field.value ?? []), day.value] : (field.value ?? []).filter((value) => value !== day.value))
                    }
                  />
                );
              })}
            </div>
          )}
        />
        {e?.closedWeekdays?.message && <p className="type-small font-bold text-stop">{e.closedWeekdays.message}</p>}
      </FieldGroup>

      <FieldGroup title="Booking window">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notice for same-day slots" error={e?.minNoticeMinutes?.message} hint="In minutes: 60 is one hour. 0 lets shoppers book a slot right up to its start.">
            <Input inputMode="numeric" className="tnum" trailing={<span className="type-small text-muted">min</span>} {...register('studio.minNoticeMinutes')} />
          </Field>
          <Field label="Book ahead up to" error={e?.maxDaysAhead?.message} hint="How far ahead the diary opens to shoppers.">
            <Input inputMode="numeric" className="tnum" trailing={<span className="type-small text-muted">days</span>} {...register('studio.maxDaysAhead')} />
          </Field>
        </div>
      </FieldGroup>

      <ShopperPreview>{rulesSentence(values)}</ShopperPreview>
    </SettingsForm>
  );
}
