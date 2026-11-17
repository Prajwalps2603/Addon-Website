import { Car } from 'lucide-react';
import { Button, RadioGroup, type RadioOption } from '@/components/ui';
import { useGarage, type GarageCar } from '@/stores/garage';
import { useUi } from '@/stores/ui';

export const NO_CAR = 'none';

function carName(car: GarageCar): string {
  return car.nickname || `${car.vehicle.make} ${car.vehicle.model}`;
}

export interface VehicleSectionProps {
  /** False when the shopper says the order is not for a particular car. */
  forCar: boolean;
  onForCarChange: (forCar: boolean) => void;
}

/** Which car the parts are for: the active garage car, another saved car, or none. Sent with the order as vehicleId. */
export function VehicleSection({ forCar, onForCarChange }: VehicleSectionProps) {
  const cars = useGarage((state) => state.vehicles);
  const activeId = useGarage((state) => state.activeVehicleId);
  const openPicker = () => useUi.getState().openVehiclePicker();

  if (cars.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 border border-line p-4">
        <p className="flex max-w-prose items-start gap-3">
          <Car aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
          <span>
            No car saved. You can order without one, but with it we check every part against your car before we pack.
          </span>
        </p>
        <Button variant="outline" size="sm" onClick={openPicker}>
          Add your car
        </Button>
      </div>
    );
  }

  const value = forCar && activeId !== null ? String(activeId) : NO_CAR;
  const options: RadioOption[] = [
    ...cars.map((car) => ({
      value: String(car.vehicleId),
      label: carName(car),
      description: [car.vehicle.label, car.year ? `your car is a ${car.year}` : null].filter(Boolean).join(', '),
    })),
    { value: NO_CAR, label: 'Not for a particular car', description: 'Gifts, spares, or parts that fit any car' },
  ];

  return (
    <div className="grid gap-3">
      <RadioGroup
        legend="This order is for"
        legendHidden
        variant="card"
        options={options}
        value={value}
        onChange={(next) => {
          if (next === NO_CAR) {
            onForCarChange(false);
            return;
          }
          useGarage.getState().setActive(Number(next));
          onForCarChange(true);
        }}
      />
      <Button variant="link" size="sm" onClick={openPicker} className="justify-self-start">
        Add another car
      </Button>
    </div>
  );
}
