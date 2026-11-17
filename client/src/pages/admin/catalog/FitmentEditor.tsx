import { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { ErrorState } from '@/components/commerce';
import { Button, Checkbox, Drawer, EmptyState, Field, IconButton, Input, RadioGroup, Segmented, Skeleton } from '@/components/ui';
import { useVehicles } from '@/hooks/useVehicles';
import type { FitmentType, Vehicle, VehicleMake } from '@/types/api';
import { ChoiceChips } from './fields';
import { BODY_TYPES, type FitmentForm, type ProductForm } from './productForm';

const TYPES: { value: FitmentType; label: string; description: string }[] = [
  { value: 'vehicle', label: 'Specific cars', description: 'Made for named models. Cars not on the list read "not checked yet: ask us".' },
  { value: 'body_type', label: 'Body types', description: 'Fits every car of the body types you tick, such as all SUVs.' },
  { value: 'pcd', label: 'Wheel bolt pattern', description: 'Wheels and spacers: fits any car with the same bolt pattern (PCD).' },
  { value: 'universal', label: 'Universal', description: 'Fits any car: phone mounts, cleaning kits, most lighting.' },
  { value: 'none', label: 'Not a car part', description: 'Merchandise and accessories that do not go on a car.' },
];

const VERDICTS = [
  { value: 'direct', label: 'Fits' },
  { value: 'with_work', label: 'With work' },
  { value: 'no', label: 'Does not fit' },
] as const;

/** Fitment type, and the car-by-car list of verdicts. */
export function FitmentEditor() {
  const { control, register, formState } = useFormContext<ProductForm>();
  const errors = formState.errors;
  const type = useWatch({ control, name: 'fitmentType' });
  const { fields, append, remove } = useFieldArray({ control, name: 'fitments', keyName: 'key' });
  const [choosing, setChoosing] = useState(false);
  const chosenIds = fields.map((f) => f.vehicleId);

  const addVehicle = (vehicle: Vehicle) => {
    if (chosenIds.includes(vehicle.id)) return;
    append({ vehicleId: vehicle.id, vehicleLabel: vehicle.label, fitType: 'direct', note: '', isVerified: false });
  };

  return (
    <div className="grid gap-6">
      <Controller
        control={control}
        name="fitmentType"
        render={({ field }) => (
          <RadioGroup legend="What does it fit?" options={TYPES} value={field.value} onChange={field.onChange} variant="card" error={errors.fitmentType?.message} />
        )}
      />

      {type === 'body_type' && (
        <Controller
          control={control}
          name="bodyTypes"
          render={({ field }) => (
            <ChoiceChips legend="Body types it fits" options={BODY_TYPES} value={field.value} onChange={field.onChange} error={errors.bodyTypes?.message} />
          )}
        />
      )}

      {type === 'pcd' && (
        <Field label="Bolt pattern (PCD)" hint="Write it like 4x100 or 5x114.3." error={errors.pcd?.message} className="max-w-xs">
          <Input {...register('pcd')} autoComplete="off" placeholder="4x100" />
        </Field>
      )}

      {type !== 'none' && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1">
              <h3 className="type-h3">
                Car by car <span className="type-small font-normal text-muted tnum">{fields.length}</span>
              </h3>
              <p className="type-small max-w-prose text-muted">
                {type === 'vehicle'
                  ? 'The cars this part is made for. A verdict here is what shoppers with that car see.'
                  : 'Optional. A verdict here overrides the rule above for that one car.'}
              </p>
            </div>
            <Button variant="outline" iconLeft={<Plus aria-hidden />} onClick={() => setChoosing(true)}>
              Add cars
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="type-small border border-dashed border-line-strong p-4 text-muted">
              {type === 'vehicle' ? 'No cars yet. Add the cars this part is made for.' : 'No car-by-car verdicts.'}
            </p>
          ) : (
            <ul className="grid divide-y divide-line border-y border-line">
              {fields.map((field, index) => (
                <FitmentRow key={field.key} index={index} fitment={field} onRemove={() => remove(index)} />
              ))}
            </ul>
          )}
          {errors.fitments?.message && (
            <p role="alert" className="type-small text-stop">
              {errors.fitments.message}
            </p>
          )}
        </div>
      )}

      <VehicleChooser open={choosing} onClose={() => setChoosing(false)} chosenIds={chosenIds} onPick={addVehicle} />
    </div>
  );
}

function FitmentRow({ index, fitment, onRemove }: { index: number; fitment: FitmentForm; onRemove: () => void }) {
  const { control, register, formState } = useFormContext<ProductForm>();
  const fitType = useWatch({ control, name: `fitments.${index}.fitType` });
  const e = formState.errors.fitments?.[index];
  return (
    <li className="grid gap-3 py-3 md:grid-cols-[minmax(0,14rem)_auto_minmax(0,1fr)_auto] md:items-start md:gap-4">
      <div className="flex items-start justify-between gap-2 md:min-h-11 md:items-center">
        <span className="leading-snug font-bold">{fitment.vehicleLabel}</span>
        <IconButton label={`Remove ${fitment.vehicleLabel}`} size="sm" onClick={onRemove} className="md:hidden">
          <Trash2 aria-hidden />
        </IconButton>
      </div>
      <Controller
        control={control}
        name={`fitments.${index}.fitType`}
        render={({ field }) => (
          <Segmented label={`Verdict for ${fitment.vehicleLabel}`} options={VERDICTS} value={field.value} onChange={field.onChange} block className="md:w-auto" />
        )}
      />
      <div className="grid gap-2">
        <Field label={`Note for ${fitment.vehicleLabel}`} labelHidden error={e?.note?.message ?? e?.vehicleId?.message}>
          <Input
            {...register(`fitments.${index}.note`)}
            placeholder={fitType === 'with_work' ? 'What work, e.g. two holes drilled in the boot lid' : fitType === 'no' ? 'Why not, e.g. different bolt pattern' : 'Note (optional)'}
            autoComplete="off"
          />
        </Field>
        <Controller
          control={control}
          name={`fitments.${index}.isVerified`}
          render={({ field }) => (
            <Checkbox
              label="Verified by us"
              description={fitType === 'direct' ? 'Test-fitted or confirmed: the Fit Promise applies.' : undefined}
              checked={field.value}
              onChange={(event) => field.onChange(event.target.checked)}
            />
          )}
        />
      </div>
      <IconButton label={`Remove ${fitment.vehicleLabel}`} onClick={onRemove} className="hidden md:inline-flex">
        <Trash2 aria-hidden />
      </IconButton>
    </li>
  );
}

interface VehicleChooserProps {
  open: boolean;
  onClose: () => void;
  chosenIds: readonly number[];
  onPick: (vehicle: Vehicle) => void;
}

/** Make, then model, then generation; or type to find a generation straight away. Stays open to add several. */
function VehicleChooser({ open, onClose, chosenIds, onPick }: VehicleChooserProps) {
  const { data, isPending, error, refetch } = useVehicles();
  const [text, setText] = useState('');
  const [makeSlug, setMakeSlug] = useState<string | null>(null);
  const [modelSlug, setModelSlug] = useState<string | null>(null);

  const make = data?.find((m) => m.slug === makeSlug) ?? null;
  const model = make?.models.find((m) => m.slug === modelSlug) ?? null;

  const matches = useMemo(() => searchVehicles(data, text), [data, text]);

  const row = (vehicle: Vehicle) => {
    const chosen = chosenIds.includes(vehicle.id);
    return (
      <li key={vehicle.id}>
        <button
          type="button"
          disabled={chosen}
          onClick={() => onPick(vehicle)}
          className="focus-ring flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="grid gap-0.5">
            <span className="font-bold">{vehicle.label}</span>
            <span className="type-small text-muted capitalize">
              {vehicle.bodyType}
              {vehicle.pcd && ` · PCD ${vehicle.pcd}`}
            </span>
          </span>
          {chosen ? (
            <span className="type-small flex items-center gap-1 text-fit">
              <Check aria-hidden className="size-4" /> Added
            </span>
          ) : (
            <Plus aria-hidden className="size-5" />
          )}
        </button>
      </li>
    );
  };

  const navButton = (label: string, aside: string, onClick: () => void) => (
    <li key={label}>
      <button type="button" onClick={onClick} className="focus-ring flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left hover:bg-surface">
        <span className="font-bold">{label}</span>
        <span className="type-small flex items-center gap-1 text-muted">
          {aside}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </button>
    </li>
  );

  let content;
  if (isPending) {
    content = (
      <div className="grid gap-3" aria-label="Loading cars">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    content = <ErrorState error={error} onRetry={() => refetch()} size="sm" title="Could not load the car list" />;
  } else if (text.trim()) {
    content =
      matches.length === 0 ? (
        <EmptyState size="sm" title={`No car matches "${text.trim()}"`} description="Try the make or the model alone." />
      ) : (
        <ul className="grid divide-y divide-line">{matches.slice(0, 60).map(row)}</ul>
      );
  } else if (model) {
    content = <ul className="grid divide-y divide-line">{model.generations.map(row)}</ul>;
  } else if (make) {
    content = (
      <ul className="grid divide-y divide-line">
        {make.models.map((m) => navButton(m.name, `${m.generations.length} ${m.generations.length === 1 ? 'generation' : 'generations'}`, () => setModelSlug(m.slug)))}
      </ul>
    );
  } else {
    content = (
      <ul className="grid divide-y divide-line">
        {(data ?? []).map((m) => navButton(m.name, `${m.models.length} ${m.models.length === 1 ? 'model' : 'models'}`, () => setMakeSlug(m.slug)))}
      </ul>
    );
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add cars"
      description="Each car starts as Fits. Set the verdict in the list."
      toolbar={
        <div className="grid gap-2">
          <Field label="Search cars" labelHidden>
            <Input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Make, model or year, e.g. Swift 2019"
              leading={<Search aria-hidden />}
              autoComplete="off"
            />
          </Field>
          {!text.trim() && make && (
            <nav aria-label="Car list position" className="type-small flex flex-wrap items-center gap-1">
              <button
                type="button"
                className="link focus-ring"
                onClick={() => {
                  setMakeSlug(null);
                  setModelSlug(null);
                }}
              >
                All makes
              </button>
              <ChevronRight aria-hidden className="size-3.5 text-muted" />
              {model ? (
                <>
                  <button type="button" className="link focus-ring" onClick={() => setModelSlug(null)}>
                    {make.name}
                  </button>
                  <ChevronRight aria-hidden className="size-3.5 text-muted" />
                  <span aria-current="page" className="font-bold">
                    {model.name}
                  </span>
                </>
              ) : (
                <span aria-current="page" className="font-bold">
                  {make.name}
                </span>
              )}
            </nav>
          )}
        </div>
      }
      footer={
        <Button variant="dark" block onClick={onClose}>
          Done
        </Button>
      }
    >
      {content}
    </Drawer>
  );
}

function searchVehicles(makes: readonly VehicleMake[] | undefined, text: string): Vehicle[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!makes || words.length === 0) return [];
  const out: Vehicle[] = [];
  for (const make of makes) {
    for (const model of make.models) {
      for (const vehicle of model.generations) {
        const years = vehicle.yearTo ? `${vehicle.yearFrom} ${vehicle.yearTo}` : `${vehicle.yearFrom}`;
        const hay = `${vehicle.label} ${make.name} ${model.name} ${vehicle.generation} ${vehicle.bodyType} ${years}`.toLowerCase();
        const fitsYear = (word: string) => {
          if (!/^\d{4}$/.test(word)) return false;
          const year = Number(word);
          return year >= vehicle.yearFrom && year <= (vehicle.yearTo ?? 9999);
        };
        if (words.every((word) => hay.includes(word) || fitsYear(word))) out.push(vehicle);
      }
    }
  }
  return out;
}
