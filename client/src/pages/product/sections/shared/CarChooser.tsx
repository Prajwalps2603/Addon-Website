import { useEffect, useMemo, useState } from 'react';
import { Field, RadioGroup, Select, Skeleton } from '@/components/ui';
import { useVehicles } from '@/hooks/useVehicles';
import { useGarage } from '@/stores/garage';
import type { Vehicle } from '@/types/api';

export interface CarChooserProps {
  value: number | null;
  onChange: (vehicleId: number | null, vehicle: Vehicle | null) => void;
  error?: string;
}

const OTHER = 'other';

/**
 * Which car a fitment question is about: one of the shopper's saved cars, or any other
 * car picked by make, model and generation. Nothing is written to the garage.
 */
export function CarChooser({ value, onChange, error }: CarChooserProps) {
  const garage = useGarage((state) => state.vehicles);
  const activeId = useGarage((state) => state.activeVehicleId);
  const inGarage = value !== null && garage.some((car) => car.vehicleId === value);
  const [mode, setMode] = useState<string>(() => (garage.length > 0 ? String(value ?? activeId ?? garage[0]?.vehicleId) : OTHER));

  // Start on a saved car when there is one, so most shoppers have nothing to pick.
  useEffect(() => {
    if (value === null && mode !== OTHER) {
      const car = garage.find((item) => String(item.vehicleId) === mode);
      if (car) onChange(car.vehicleId, car.vehicle);
    }
    // Runs once on mount only: later changes come from the shopper.
  }, []);

  if (garage.length === 0) {
    return <VehicleSelects value={value} onChange={onChange} error={error} />;
  }

  return (
    <div className="grid gap-3">
      <RadioGroup
        legend="Your car"
        variant="card"
        value={inGarage ? String(value) : mode}
        onChange={(next) => {
          setMode(next);
          if (next === OTHER) {
            onChange(null, null);
            return;
          }
          const car = garage.find((item) => String(item.vehicleId) === next);
          onChange(car?.vehicleId ?? null, car?.vehicle ?? null);
        }}
        options={[
          ...garage.map((car) => ({
            value: String(car.vehicleId),
            label: car.nickname || car.vehicle.label,
            description: car.nickname ? car.vehicle.label : car.year ? `Year ${car.year}` : undefined,
          })),
          { value: OTHER, label: 'Another car' },
        ]}
        error={mode !== OTHER ? error : undefined}
      />
      {mode === OTHER && <VehicleSelects value={value} onChange={onChange} error={error} />}
    </div>
  );
}

interface VehicleSelectsProps {
  value: number | null;
  onChange: (vehicleId: number | null, vehicle: Vehicle | null) => void;
  error?: string;
}

/** Make, then model, then generation, as three native selects (the phone's own picker). */
function VehicleSelects({ value, onChange, error }: VehicleSelectsProps) {
  const { data: makes, isPending, isError, refetch } = useVehicles();
  const [makeSlug, setMakeSlug] = useState('');
  const [modelSlug, setModelSlug] = useState('');

  // When a car is already chosen (a saved car switched to "Another car" keeps nothing), show its make and model.
  useEffect(() => {
    if (!makes || value === null) return;
    for (const make of makes) {
      for (const model of make.models) {
        if (model.generations.some((generation) => generation.id === value)) {
          setMakeSlug(make.slug);
          setModelSlug(model.slug);
          return;
        }
      }
    }
  }, [makes, value]);

  const make = useMemo(() => makes?.find((item) => item.slug === makeSlug) ?? null, [makes, makeSlug]);
  const model = useMemo(() => make?.models.find((item) => item.slug === modelSlug) ?? null, [make, modelSlug]);

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }
  if (isError || !makes) {
    return (
      <p className="type-small text-muted">
        The list of cars did not load.{' '}
        <button type="button" className="link font-bold" onClick={() => void refetch()}>
          Try again
        </button>
      </p>
    );
  }

  const pick = (generationId: string) => {
    const vehicle = model?.generations.find((item) => String(item.id) === generationId) ?? null;
    onChange(vehicle?.id ?? null, vehicle);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Make" error={!makeSlug ? error : undefined}>
        <Select
          value={makeSlug}
          placeholder="Choose make"
          options={makes.map((item) => ({ value: item.slug, label: item.name }))}
          onChange={(event) => {
            setMakeSlug(event.target.value);
            setModelSlug('');
            onChange(null, null);
          }}
        />
      </Field>
      <Field label="Model" error={makeSlug && !modelSlug ? error : undefined}>
        <Select
          value={modelSlug}
          placeholder="Choose model"
          disabled={!make}
          options={(make?.models ?? []).map((item) => ({ value: item.slug, label: item.name }))}
          onChange={(event) => {
            setModelSlug(event.target.value);
            const next = make?.models.find((item) => item.slug === event.target.value);
            // One generation only: choose it straight away.
            const only = next && next.generations.length === 1 ? next.generations[0] : undefined;
            onChange(only?.id ?? null, only ?? null);
          }}
        />
      </Field>
      <Field label="Years" error={modelSlug && value === null ? error : undefined}>
        <Select
          value={value !== null && model?.generations.some((item) => item.id === value) ? String(value) : ''}
          placeholder="Choose years"
          disabled={!model}
          options={(model?.generations ?? []).map((item) => ({ value: String(item.id), label: generationLabel(item) }))}
          onChange={(event) => pick(event.target.value)}
        />
      </Field>
    </div>
  );
}

function generationLabel(vehicle: Vehicle): string {
  const years = vehicle.yearTo ? `${vehicle.yearFrom} to ${vehicle.yearTo}` : `${vehicle.yearFrom} onwards`;
  return vehicle.generation ? `${years} (${vehicle.generation})` : years;
}
