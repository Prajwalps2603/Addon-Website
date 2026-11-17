import { useId, useState, type ReactNode } from 'react';
import { Car, Check, CircleAlert, PencilLine, Plus, type LucideIcon } from 'lucide-react';
import { VehicleSteps } from '@/components/commerce';
import { Drawer, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useGarage } from '@/stores/garage';
import type { Vehicle } from '@/types/api';

export type CarValue =
  | { kind: 'catalogue'; vehicle: Vehicle; year: number | null }
  | { kind: 'typed'; label: string };

export interface CarChoiceProps {
  value: CarValue | null;
  onChange: (value: CarValue | null) => void;
  error?: ReactNode;
  className?: string;
}

/** 'Honda City (2020 onwards), 2022' for the studio's diary. */
export function carLabel(value: CarValue): string {
  if (value.kind === 'typed') return value.label.trim();
  return value.year ? `${value.vehicle.label}, ${value.year}` : value.vehicle.label;
}

function CarOption({
  name,
  checked,
  onChange,
  title,
  detail,
  icon: Icon = Car,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <label
      className={cn(
        'group/car flex min-h-16 cursor-pointer items-center gap-3 rounded-[18px] border-2 p-3.5 transition-[border-color,background-color] duration-200',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus',
        checked ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface hover:border-line-strong',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-[12px] transition-colors duration-200',
          checked ? 'bg-brand text-brand-ink' : 'bg-raised text-ink group-hover/car:text-brand-text',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1">
        <span className="leading-snug font-bold">{title}</span>
        {detail && <span className="text-sm text-muted">{detail}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200',
          checked ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-raised text-transparent',
        )}
      >
        <Check className="size-3.5" strokeWidth={3.5} />
      </span>
    </label>
  );
}

/**
 * Which car is coming in: one from the shopper's garage, one picked from the catalogue (the garage
 * is not changed), or typed in when it is not in the catalogue.
 */
export function CarChoice({ value, onChange, error, className }: CarChoiceProps) {
  const name = useId();
  const errorId = `${name}-error`;
  const typedId = `${name}-typed`;
  const garage = useGarage((state) => state.vehicles);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A car picked from the list stays on offer when the shopper switches back to a garage car.
  const [picked, setPicked] = useState<{ vehicle: Vehicle; year: number | null } | null>(() =>
    value?.kind === 'catalogue' && !garage.some((car) => car.vehicleId === value.vehicle.id) ? { vehicle: value.vehicle, year: value.year } : null,
  );
  const [typed, setTyped] = useState(value?.kind === 'typed' ? value.label : '');

  const selectedId = value?.kind === 'catalogue' ? value.vehicle.id : null;
  const pickedInGarage = picked !== null && garage.some((car) => car.vehicleId === picked.vehicle.id);

  return (
    <fieldset className={cn('grid min-w-0 gap-3 sm:grid-cols-2', className)} aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="sr-only">Your car</legend>

      {garage.map((car) => (
        <CarOption
          key={car.vehicleId}
          name={name}
          checked={selectedId === car.vehicleId}
          onChange={() => onChange({ kind: 'catalogue', vehicle: car.vehicle, year: car.year })}
          title={car.nickname || car.vehicle.label}
          detail={[car.nickname ? car.vehicle.label : '', car.year ? `Model year ${car.year}` : ''].filter(Boolean).join(', ') || 'From your garage'}
        />
      ))}

      {picked && !pickedInGarage && (
        <CarOption
          name={name}
          checked={selectedId === picked.vehicle.id}
          onChange={() => onChange({ kind: 'catalogue', ...picked })}
          title={picked.vehicle.label}
          detail={picked.year ? `Model year ${picked.year}` : 'Chosen from the list'}
        />
      )}

      <CarOption
        name={name}
        checked={value?.kind === 'typed'}
        onChange={() => onChange({ kind: 'typed', label: typed })}
        title="My car is not in the list"
        detail="Type the make, model and year"
        icon={PencilLine}
      />
      {value?.kind === 'typed' && (
        <div className="checkout-soft grid gap-1.5 sm:col-span-2">
          <label htmlFor={typedId} className="type-small font-bold">
            Make, model and year
          </label>
          <Input
            id={typedId}
            value={typed}
            maxLength={80}
            autoComplete="off"
            placeholder="For example, Tata Punch 2023"
            leading={<PencilLine aria-hidden className="size-4 text-muted" />}
            invalid={Boolean(error)}
            onChange={(event) => {
              setTyped(event.target.value);
              onChange({ kind: 'typed', label: event.target.value });
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="group/add flex min-h-16 items-center gap-3 rounded-[18px] border-2 border-dashed border-line-strong p-3.5 text-left transition-colors duration-200 hover:border-brand hover:bg-brand-soft"
      >
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-surface text-ink transition-colors duration-200 group-hover/add:bg-brand group-hover/add:text-brand-ink">
          <Plus className="size-5" />
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="leading-snug font-bold">{garage.length > 0 || picked ? 'Choose another car' : 'Choose your car'}</span>
          <span className="text-sm text-muted">Pick the make, model and year</span>
        </span>
      </button>

      {error && (
        <p id={errorId} role="alert" className="type-small flex sm:col-span-2 items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <Drawer open={pickerOpen} onClose={() => setPickerOpen(false)} title="Which car is coming in?" description="Pick the make, model and year. Your garage is not changed.">
        <VehicleSteps
          onDone={(vehicle, year) => {
            setPicked({ vehicle, year });
            onChange({ kind: 'catalogue', vehicle, year });
            setPickerOpen(false);
          }}
        />
      </Drawer>
    </fieldset>
  );
}
