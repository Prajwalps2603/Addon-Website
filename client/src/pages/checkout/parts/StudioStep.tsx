import type { UseFormReturn } from 'react-hook-form';
import { CarChoice, StudioContact, type CarValue, type SlotValue } from '@/components/studio';
import SlotPicker from '@/components/studio/SlotPicker';
import { Field, Input } from '@/components/ui';
import type { PublicSettings } from '@/types/api';
import type { CheckoutValues } from './schema';

export interface StudioFittingStepProps {
  form: UseFormReturn<CheckoutValues>;
  car: CarValue | null;
  onCarChange: (car: CarValue | null) => void;
  carError: string | null;
  slot: SlotValue | null;
  onSlotChange: (slot: SlotValue | null) => void;
  slotError: string | null;
  settings: PublicSettings | undefined;
}

/** Studio fitting: which car comes in, its registration number, and the day and time. */
export function StudioFittingStep({ form, car, onCarChange, carError, slot, onSlotChange, slotError, settings }: StudioFittingStepProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h3 className="type-h3">Your car</h3>
        <CarChoice value={car} onChange={onCarChange} error={carError ?? undefined} />
        <Field
          label="Registration number"
          hint="As on the number plate, like KA 01 AB 1234. We use it to find your car at the studio."
          error={errors.registrationNumber?.message}
          required
          className="sm:max-w-xs"
        >
          <Input mono autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16} {...register('registrationNumber')} />
        </Field>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Day and time</h3>
        <p className="type-small max-w-prose text-muted">Times are India time. Bring your car at the start of the slot.</p>
        <SlotPicker value={slot} onChange={onSlotChange} error={slotError ?? undefined} />
      </div>

      {settings && <StudioWhere settings={settings} />}
    </div>
  );
}

/** Where the studio is, its hours and phones: for collection and for fitting. */
export function StudioWhere({ settings, intro }: { settings: PublicSettings; intro?: string }) {
  const hasAddress = settings.studio.address.trim() !== '';
  return (
    <div className="grid gap-3 border-t border-line pt-4">
      <h3 className="type-h3">The studio</h3>
      {intro && <p className="type-body max-w-prose">{intro}</p>}
      <StudioContact settings={settings} />
      {!hasAddress && <p className="type-small text-muted">Call us for directions to the studio.</p>}
    </div>
  );
}
