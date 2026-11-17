import { useState, type ReactNode } from 'react';
import { Car, Check, RotateCcw } from 'lucide-react';
import { BoardWord, PitBoard } from '@/components/brand';
import { Button, Drawer, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useGarage, type GarageCar } from '@/stores/garage';
import { useUi } from '@/stores/ui';
import type { Vehicle } from '@/types/api';
import { VehicleSteps } from './VehicleSteps';

/** 'Maruti Suzuki Swift (2018-2024)', with the shopper's own year or nickname when they gave one. */
function carDetail(car: GarageCar): string {
  return [car.nickname, car.year ? `${car.year} model` : ''].filter(Boolean).join(', ');
}

function saveCar(vehicle: Vehicle, year: number | null): void {
  useGarage.getState().add(vehicle, { year });
  toast.success(`Showing what fits your ${vehicle.model}`, { id: 'garage' });
}

interface SavedCarsProps {
  cars: readonly GarageCar[];
  activeId: number | null;
  onPick: (car: GarageCar) => void;
}

/** The cars already in the garage: one tap makes one of them the car fit is checked against. */
function SavedCars({ cars, activeId, onPick }: SavedCarsProps) {
  return (
    <ul className="grid gap-2">
      {cars.map((car) => {
        const active = car.vehicleId === activeId;
        const detail = carDetail(car);
        return (
          <li key={car.vehicleId}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onPick(car)}
              className={cn(
                'focus-ring flex min-h-14 w-full items-center gap-3 rounded-control border px-3 py-2.5 text-left transition-colors dur-quick',
                active ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-surface',
              )}
            >
              <Car aria-hidden className="size-5 shrink-0 text-muted" />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-bold">{car.vehicle.label}</span>
                {detail && <span className="type-small truncate text-muted">{detail}</span>}
              </span>
              {active ? (
                <span className="flex shrink-0 items-center gap-1 type-small font-bold text-brand-text">
                  <Check aria-hidden className="size-4" />
                  Selected
                </span>
              ) : (
                <span className="type-small shrink-0 font-bold text-brand-text">Use this</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The car picker, opened from anywhere with `useUi.getState().openVehiclePicker()` (GarageButton and
 * FitBadge do). Saved cars sit at the top for one-tap switching; below them the make, model and year
 * board adds a new one. The choice goes to the garage store, and every product then shows its fit.
 * App.tsx mounts it once for the whole app: do not mount it in a page.
 */
export function VehiclePicker() {
  const open = useUi((state) => state.vehiclePickerOpen);
  const close = useUi((state) => state.closeVehiclePicker);
  const cars = useGarage((state) => state.vehicles);
  const activeId = useGarage((state) => state.activeVehicleId);

  const switchTo = (car: GarageCar) => {
    useGarage.getState().setActive(car.vehicleId);
    toast.success(`Showing what fits your ${car.vehicle.model}`, { id: 'garage' });
    close();
  };

  // Bumping the key remounts the make, model and year steps, so they start again from the make.
  const [stepsKey, setStepsKey] = useState(0);
  const reset = () => {
    useGarage.getState().setActive(null);
    setStepsKey((key) => key + 1);
  };

  const shopWithoutCar = () => {
    useGarage.getState().setActive(null);
    close();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Your car"
      description="Tell us once. Every part then says whether it fits."
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Button variant="link" onClick={shopWithoutCar}>
            Shop without a car
          </Button>
          {cars.length > 0 && (
            <Button variant="link" to="/garage" onClick={close}>
              Manage my garage
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-6">
        {cars.length > 0 && (
          <section aria-label="Saved cars" className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="type-small font-bold">Saved cars</h3>
              <button
                type="button"
                onClick={reset}
                className="focus-ring tap-44 inline-flex items-center gap-1 type-small font-bold text-brand-text hover:underline"
              >
                <RotateCcw aria-hidden className="size-3.5" />
                Reset
              </button>
            </div>
            <SavedCars cars={cars} activeId={activeId} onPick={switchTo} />
          </section>
        )}
        <section aria-label="Add a car" className="grid gap-2">
          {cars.length > 0 && (
            <h3 className="type-small font-bold">Add another car</h3>
          )}
          <VehicleSteps
            key={stepsKey}
            onDone={(vehicle, year) => {
              saveCar(vehicle, year);
              close();
            }}
          />
        </section>
      </div>
    </Drawer>
  );
}

export interface VehiclePickerInlineProps {
  /** Called when a car is chosen or switched to, so the page can move on ("Show what fits"). */
  onSelect?: (vehicle: Vehicle) => void;
  /**
   * What sits under the car once one is set: the page's own call to action and a real count.
   * A function receives the active car. Defaults to a "Show what fits" button to the shop.
   */
  children?: ReactNode | ((car: GarageCar) => ReactNode);
  className?: string;
}

/**
 * The same selector laid out in the page, for the home hero. With no car chosen it shows the make,
 * model and year board. Once a car is set, the board reads it back in tiles and offers the way on.
 */
export function VehiclePickerInline({ onSelect, children, className }: VehiclePickerInlineProps) {
  const cars = useGarage((state) => state.vehicles);
  const activeId = useGarage((state) => state.activeVehicleId);
  const [changing, setChanging] = useState(false);
  const active = cars.find((car) => car.vehicleId === activeId) ?? null;

  if (active && !changing) {
    return (
      <PitBoard
        as="section"
        aria-label="Your car"
        title="Your car"
        aside={
          <button type="button" onClick={() => setChanging(true)} className="tap-44 font-bold underline underline-offset-4 hover:decoration-2">
            Change car
          </button>
        }
        className={className}
      >
        <BoardWord text={active.year ? `${active.vehicle.model} ${active.year}` : active.vehicle.model} size="lg" />
        <p className="type-small text-muted">{active.vehicle.label}</p>
        <div className="flex flex-wrap items-center gap-3">
          {typeof children === 'function'
            ? children(active)
            : (children ?? (
                <Button to="/shop?fitOnly=1" size="lg">
                  Show what fits
                </Button>
              ))}
        </div>
      </PitBoard>
    );
  }

  const others = cars.filter((car) => car.vehicleId !== activeId);

  return (
    <div className={cn('grid min-w-0 gap-4', className)}>
      <VehicleSteps
        wide
        onDone={(vehicle, year) => {
          saveCar(vehicle, year);
          setChanging(false);
          onSelect?.(vehicle);
        }}
      />
      {(others.length > 0 || active) && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          {others.map((car) => (
            <Button
              key={car.vehicleId}
              variant="outline"
              size="sm"
              iconLeft={<Car aria-hidden />}
              onClick={() => {
                useGarage.getState().setActive(car.vehicleId);
                setChanging(false);
                onSelect?.(car.vehicle);
              }}
            >
              Use my {car.vehicle.model}
            </Button>
          ))}
          {active && (
            <Button variant="ghost" size="sm" onClick={() => setChanging(false)}>
              Keep my {active.vehicle.model}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
