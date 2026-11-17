import { zodResolver } from '@hookform/resolvers/zod';
import { useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Callout, Field, Input, Switch, Textarea } from '@/components/ui';
import type { AdminSettings } from '@/types/api';
import { FieldGroup, numberOf, SettingsForm, text, useSectionForm, wholeNumber } from './shared';

const schema = z.object({
  returns: z.object({ windowDays: wholeNumber(90, 'days'), summary: text(600) }),
  fitPromise: z.object({ enabled: z.boolean(), summary: text(600) }),
});

type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function PromisesSection({ settings }: { settings: AdminSettings }) {
  const section = useSectionForm<Input, Output>({
    settings,
    resolver: zodResolver(schema),
    toForm: (s) => ({ returns: { ...s.returns }, fitPromise: { ...s.fitPromise } }),
    toPatch: (values) => values,
    name: 'Promises',
  });
  const {
    register,
    control,
    formState: { errors },
  } = section.form;
  const fitOn = Boolean(useWatch({ control, name: 'fitPromise.enabled' }));
  const days = numberOf(useWatch({ control, name: 'returns.windowDays' }));
  const returnSummary = useWatch({ control, name: 'returns.summary' }) ?? '';
  const fitSummary = useWatch({ control, name: 'fitPromise.summary' }) ?? '';

  return (
    <SettingsForm
      id="promises"
      title="Promises"
      description="What the shop commits to after the sale. Shoppers read these on product pages and in the returns policy, so write only what you will do."
      section={section}
      saveLabel="Save promises"
    >
      <FieldGroup title="Returns">
        <Field
          label="Return window"
          error={errors.returns?.windowDays?.message}
          hint={days === 0 ? 'No returns accepted. Say so plainly in the summary.' : 'Days after delivery. 0 means no returns.'}
        >
          <Input inputMode="numeric" className="tnum sm:max-w-40" trailing={<span aria-hidden>days</span>} {...register('returns.windowDays')} />
        </Field>
        <Field
          label="Returns summary"
          error={errors.returns?.summary?.message}
          hint={`What can come back, in what state, and who pays. ${600 - returnSummary.length} characters left.`}
        >
          <Textarea rows={4} maxLength={600} {...register('returns.summary')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="The Fit Promise">
        <Switch
          labelFirst
          label="Promise “It fits, or it is on us”"
          description="Shown on product pages when the part is a fit you have verified for the shopper’s car."
          {...register('fitPromise.enabled')}
        />
        {fitOn && (
          <Callout tone="warn" title="This is a commitment">
            While it is on, when a part you marked as a verified fit does not fit the shopper’s car, the shop takes it back free and pays the
            return shipping. Mark a fitment verified only when you have checked it on that car.
          </Callout>
        )}
        <Field
          label="Fit Promise text"
          error={errors.fitPromise?.summary?.message}
          hint={`Shown under the promise. ${600 - fitSummary.length} characters left.`}
        >
          <Textarea rows={3} maxLength={600} {...register('fitPromise.summary')} />
        </Field>
      </FieldGroup>
    </SettingsForm>
  );
}
