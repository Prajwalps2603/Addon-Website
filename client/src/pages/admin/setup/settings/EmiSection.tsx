import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Field, Input, Switch } from '@/components/ui';
import { formatINR } from '@/lib/format';
import type { AdminSettings } from '@/types/api';
import { numberOf, rupees, SettingsForm, ShopperPreview, text, useSectionForm } from './shared';

const schema = z
  .object({
    emi: z.object({
      enabled: z.boolean(),
      partner: text(80),
      minAmount: rupees(),
      note: text(300),
    }),
  })
  .superRefine((values, ctx) => {
    if (values.emi.enabled && values.emi.partner === '') {
      ctx.addIssue({ code: 'custom', path: ['emi', 'partner'], message: 'Name the finance partner, or switch EMI off.' });
    }
  });

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function EmiSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ emi: { ...s.emi } }),
    toPatch: (values) => values,
    name: 'EMI',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const emi = useWatch({ control, name: 'emi' });
  const e = errors.emi;
  const min = numberOf(emi?.minAmount);
  const partner = emi?.partner?.trim() ?? '';

  return (
    <SettingsForm
      id="emi"
      title="EMI"
      description="Monthly instalments through a finance partner. The shop only says EMI is available and shows your note; the plan itself is set up with the partner."
      section={section}
      saveLabel="Save EMI"
    >
      <Switch label="Offer EMI" description="Shows the EMI line beside prices and at checkout on orders from the amount below." labelFirst {...register('emi.enabled')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Finance partner" error={e?.partner?.message} hint="For example Bajaj Finserv.">
          <Input maxLength={80} {...register('emi.partner')} />
        </Field>
        <Field label="EMI from" error={e?.minAmount?.message} hint="The smallest order total EMI is offered on. 0 for every order.">
          <Input inputMode="numeric" className="tnum" leading={<span aria-hidden>₹</span>} {...register('emi.minAmount')} />
        </Field>
      </div>
      <Field label="Note for shoppers" optional error={e?.note?.message} hint="One plain line. Say how to ask for the plans; do not promise a rate.">
        <Input maxLength={300} {...register('emi.note')} />
      </Field>
      <ShopperPreview>
        {!emi?.enabled
          ? 'No EMI line is shown.'
          : [
              partner ? `EMI available through ${partner}` : 'EMI available',
              !Number.isNaN(min) && min > 0 ? ` on orders of ${formatINR(min)} or more.` : '.',
              emi.note?.trim() ? ` ${emi.note.trim()}` : '',
            ].join('')}
      </ShopperPreview>
    </SettingsForm>
  );
}
