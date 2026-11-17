import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Callout, Field, Input } from '@/components/ui';
import type { AdminSettings } from '@/types/api';
import { displayPhone, optionalEmail, SettingsForm, text, useSectionForm } from './shared';

const schema = z.object({
  grievanceOfficer: z.object({ name: text(80), designation: text(80), email: optionalEmail, phone: displayPhone }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function GrievanceSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ grievanceOfficer: { ...s.grievanceOfficer } }),
    toPatch: (values) => values,
    name: 'Grievance officer',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const officer = useWatch({ control, name: 'grievanceOfficer' });
  const blank = !officer?.name?.trim() || (!officer?.email?.trim() && !officer?.phone?.trim());

  return (
    <SettingsForm
      id="grievance"
      title="Grievance officer"
      description="The Consumer Protection (E-Commerce) Rules, 2020 require an online seller to name a grievance officer and say how to reach them, so shoppers have someone accountable for complaints."
      section={section}
      saveLabel="Save grievance officer"
    >
      {blank && (
        <Callout tone="warn" title="No grievance officer yet">
          Add a name and at least an email or a phone number. It can be you.
        </Callout>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.grievanceOfficer?.name?.message}>
          <Input autoComplete="name" {...register('grievanceOfficer.name')} />
        </Field>
        <Field label="Designation" hint="The rules ask for it, for example Owner or Customer care manager." error={errors.grievanceOfficer?.designation?.message}>
          <Input autoComplete="organization-title" {...register('grievanceOfficer.designation')} />
        </Field>
        <Field label="Email" error={errors.grievanceOfficer?.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" {...register('grievanceOfficer.email')} />
        </Field>
        <Field label="Phone" error={errors.grievanceOfficer?.phone?.message}>
          <Input type="tel" inputMode="tel" autoComplete="tel" {...register('grievanceOfficer.phone')} />
        </Field>
      </div>
    </SettingsForm>
  );
}
