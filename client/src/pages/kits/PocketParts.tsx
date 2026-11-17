import { useId } from 'react';
import { ArrowDown, ArrowUp, Car, Plus } from 'lucide-react';
import { Chip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import { useGarage } from '@/stores/garage';
import { useUi } from '@/stores/ui';
import type { BodyType, KitRequest } from '@/types/api';
import { BODY_TYPES, VIBES, type Vibe } from './kitShared';
import { useKitBuild } from './useKits';

// ---------------------------------------------------------------------------- vibe

export interface VibePickerProps {
  value: Vibe | null;
  onChange: (vibe: Vibe) => void;
}

/** Six vibes as native radios laid out in a grid: arrow keys move between them, Tab reaches the group once. */
export function VibePicker({ value, onChange }: VibePickerProps) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="type-h3 mb-3">Pick a vibe</legend>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 lg:grid-cols-3">
        {VIBES.map((vibe) => {
          const checked = vibe.value === value;
          return (
            <label
              key={vibe.value}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors dur-quick',
                'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus',
                checked ? 'border-ink bg-brand-soft' : 'border-line-strong hover:border-ink',
              )}
            >
              <span className="relative mt-px grid size-5 shrink-0 place-items-center">
                <input
                  type="radio"
                  name={name}
                  value={vibe.value}
                  checked={checked}
                  onChange={() => onChange(vibe.value)}
                  className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full border border-line-strong bg-page transition-colors dur-quick checked:border-ink checked:bg-ink"
                />
                <span aria-hidden className="relative size-2 rounded-full bg-page opacity-0 peer-checked:opacity-100" />
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="leading-snug font-bold">{vibe.label}</span>
                <span className="type-small text-muted">{vibe.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------- the car, or a body type

export interface CarChoiceProps {
  vehicleId: number | null;
  bodyType: BodyType | null;
  onCar: (vehicleId: number) => void;
  onBody: (body: BodyType) => void;
}

/** A car from the garage, a new one through the picker, or just a body type when there is no car to name. */
export function CarChoice({ vehicleId, bodyType, onCar, onBody }: CarChoiceProps) {
  const cars = useGarage((state) => state.vehicles);
  const openPicker = useUi((state) => state.openVehiclePicker);

  return (
    <fieldset className="grid min-w-0 gap-4">
      <legend className="type-h3 mb-3">For which car</legend>
      <div className="grid gap-2">
        <p className="type-label text-muted">Your cars</p>
        <div className="flex flex-wrap gap-2">
          {cars.map((car) => (
            <Chip key={car.vehicleId} selected={car.vehicleId === vehicleId} icon={<Car aria-hidden />} onClick={() => onCar(car.vehicleId)}>
              {car.vehicle.model}
            </Chip>
          ))}
          <Chip icon={<Plus aria-hidden />} onClick={openPicker} aria-haspopup="dialog">
            {cars.length > 0 ? 'Another car' : 'Add your car'}
          </Chip>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="type-label text-muted">Or just the body type</p>
        <div role="group" aria-label="Body type" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {BODY_TYPES.map((body) => (
            <Chip key={body.value} selected={!vehicleId && bodyType === body.value} onClick={() => onBody(body.value)}>
              {body.label}
            </Chip>
          ))}
        </div>
        <p className="type-small max-w-prose text-muted">
          {vehicleId
            ? 'Parts are checked against this car.'
            : bodyType
              ? 'With a body type only, the kits use universal parts and parts made for that body type.'
              : 'With no car and no body type, the kits use universal parts only.'}
        </p>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------- tighter and looser

export const POCKET_MIN = 1_000;
export const POCKET_MAX = 50_000;

function nudgeBudgets(budget: number): { tighter: number | null; looser: number | null } {
  const step = budget < 5_000 ? 500 : 1_000;
  const tighter = Math.max(POCKET_MIN, Math.round((budget * 0.7) / step) * step);
  const looser = Math.min(POCKET_MAX, Math.round((budget * 1.4) / step) * step);
  return { tighter: tighter < budget ? tighter : null, looser: looser > budget ? looser : null };
}

function NudgeButton({ request, budget, direction, onUse }: { request: KitRequest; budget: number; direction: 'tighter' | 'looser'; onUse: (budget: number) => void }) {
  const { data, isPending } = useKitBuild({ ...request, budget }, { keepPrevious: false });
  const most = data ? Math.max(0, ...data.kits.map((kit) => kit.items.length)) : null;
  const Icon = direction === 'tighter' ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onUse(budget)}
      className="focus-ring flex min-h-11 items-center gap-2.5 rounded-control border border-line-strong px-3 py-2 text-left transition-colors dur-quick hover:border-ink"
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="grid gap-0.5">
        <span className="font-bold tnum">
          {direction === 'tighter' ? 'Tighter' : 'Looser'}: {formatINR(budget)}
        </span>
        <span className="type-small text-muted tnum" aria-live="polite">
          {isPending ? 'Checking what it buys' : most === null ? '' : most === 0 ? 'Too little for a kit' : `Up to ${pluralize(most, 'part')} in a kit`}
        </span>
      </span>
    </button>
  );
}

/** Two nearby budgets, each with what it buys, worked out by the planner itself. */
export function BudgetNudges({ request, onUse }: { request: KitRequest; onUse: (budget: number) => void }) {
  const { tighter, looser } = nudgeBudgets(request.budget);
  if (!tighter && !looser) return null;
  return (
    <div role="group" aria-label="Try another budget" className="flex flex-wrap gap-2">
      {tighter && <NudgeButton request={request} budget={tighter} direction="tighter" onUse={onUse} />}
      {looser && <NudgeButton request={request} budget={looser} direction="looser" onUse={onUse} />}
    </div>
  );
}
