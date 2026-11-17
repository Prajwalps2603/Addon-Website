import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { CompoundRing, compoundFor } from '@/components/brand';
import { LEGALITY_WORDS, StraightLabelPanel, WARRANTY_WORDS, WIRING_WORDS } from '@/components/commerce';
import { Field, Input, RadioGroup, Segmented, Switch, Textarea } from '@/components/ui';
import type { Legality, WarrantyImpact, Wiring } from '@/types/api';
import { GroupLabel } from './fields';
import { labelFromForm, type ProductForm } from './productForm';

const LEGALITY: Legality[] = ['road_legal', 'check_rules', 'off_road_only'];
const WARRANTY: WarrantyImpact[] = ['none', 'possible', 'likely'];
const WIRING: Wiring[] = ['none', 'plug_and_play', 'splice'];
const DIFFICULTY = ['1', '2', '3', '4', '5'] as const;

/** The Straight Label fields, with the panel the shopper will see drawn live beside them. */
export function LabelEditor() {
  const { control, register, formState } = useFormContext<ProductForm>();
  const e = formState.errors.label;
  const label = useWatch({ control, name: 'label' });
  const difficulty = compoundFor(label.installDifficulty);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Controller
            control={control}
            name="label.legality"
            render={({ field }) => (
              <RadioGroup
                legend="Road legality"
                options={LEGALITY.map((value) => ({ value, label: LEGALITY_WORDS[value].label, description: LEGALITY_WORDS[value].detail }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Field
            label="Legality note"
            optional={label.legality === 'road_legal'}
            hint="One line in your own words, e.g. Legal in white or amber only. Blue and red are not allowed."
            error={e?.legalityNote?.message}
          >
            <Textarea rows={2} {...register('label.legalityNote')} />
          </Field>
        </div>

        <div className="grid gap-3">
          <Controller
            control={control}
            name="label.warrantyImpact"
            render={({ field }) => (
              <RadioGroup
                legend="Car warranty"
                options={WARRANTY.map((value) => ({ value, label: WARRANTY_WORDS[value].label, description: WARRANTY_WORDS[value].detail }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Field label="Warranty note" optional={label.warrantyImpact === 'none'} error={e?.warrantyNote?.message}>
            <Textarea rows={2} {...register('label.warrantyNote')} />
          </Field>
        </div>

        <div className="grid gap-3">
          <GroupLabel>Wiring and undoing it</GroupLabel>
          <Controller
            control={control}
            name="label.wiring"
            render={({ field }) => (
              <div className="grid gap-1.5">
                <Segmented
                  label="Wiring"
                  options={WIRING.map((value) => ({ value, label: value === 'splice' ? 'Wires cut' : WIRING_WORDS[value].chip }))}
                  value={field.value}
                  onChange={field.onChange}
                  block
                />
                <p className="type-small text-muted">{WIRING_WORDS[field.value].detail}</p>
              </div>
            )}
          />
          <Controller
            control={control}
            name="label.reversible"
            render={({ field }) => (
              <Switch
                label="Reversible"
                description="The car can be put back as it was, with no marks."
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
        </div>

        <Field label="Skip this if" optional hint="One honest line, e.g. your car is still under the dealer's warranty." error={e?.skipIf?.message}>
          <Input {...register('label.skipIf')} autoComplete="off" />
        </Field>

        <div className="grid gap-3">
          <GroupLabel>Fitting</GroupLabel>
          <Controller
            control={control}
            name="label.installDifficulty"
            render={({ field }) => (
              <div className="grid gap-2">
                <span className="type-small font-bold" id="difficulty-label">
                  Difficulty, 1 (plug in) to 5 (workshop job)
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <Segmented
                    label="Difficulty"
                    options={DIFFICULTY.map((value) => ({ value, label: value }))}
                    value={String(field.value) as (typeof DIFFICULTY)[number]}
                    onChange={(value) => field.onChange(Number(value))}
                  />
                  <span className="flex items-center gap-2">
                    <CompoundRing difficulty={field.value} size={36} showLabel={false} />
                    <span className="grid">
                      <span className="font-bold">{difficulty.label}</span>
                      <span className="type-small text-muted">{difficulty.detail}</span>
                    </span>
                  </span>
                </div>
              </div>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shortest time" hint="Minutes" error={e?.installTimeMin?.message}>
              <Input {...register('label.installTimeMin')} inputMode="numeric" trailing={<span className="type-small pr-3">min</span>} className="tnum" />
            </Field>
            <Field label="Longest time" hint="Minutes" error={e?.installTimeMax?.message}>
              <Input {...register('label.installTimeMax')} inputMode="numeric" trailing={<span className="type-small pr-3">min</span>} className="tnum" />
            </Field>
          </div>
          <Controller
            control={control}
            name="label.proInstall"
            render={({ field }) => (
              <Switch
                label="Fitter advised"
                description="Tell shoppers to have a fitter or workshop do it."
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fair labour, from" hint="0 and 0 = no fitter needed" error={e?.fittingCostMin?.message}>
              <Input {...register('label.fittingCostMin')} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" />
            </Field>
            <Field label="Fair labour, up to" error={e?.fittingCostMax?.message}>
              <Input {...register('label.fittingCostMax')} inputMode="numeric" leading={<span className="type-small">₹</span>} className="tnum" />
            </Field>
          </div>
        </div>
      </div>

      <aside aria-label="Preview of the label shoppers see" className="grid gap-2 lg:sticky lg:top-4">
        <p className="type-label text-muted">What shoppers see</p>
        <div className="pointer-events-none select-none" inert>
          <StraightLabelPanel label={labelFromForm(label)} headingLevel="h3" />
        </div>
      </aside>
    </div>
  );
}
