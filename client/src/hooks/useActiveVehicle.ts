import { useGarage, type GarageCar } from '@/stores/garage';
import type { Vehicle } from '@/types/api';

/** The car fit is being checked against: the active garage vehicle, or null when none is chosen. */
export function useActiveVehicle(): Vehicle | null {
  return useGarage((state) => state.vehicles.find((car) => car.vehicleId === state.activeVehicleId)?.vehicle ?? null);
}

/** The same car with the shopper's own year and nickname. */
export function useActiveCar(): GarageCar | null {
  return useGarage((state) => state.vehicles.find((car) => car.vehicleId === state.activeVehicleId) ?? null);
}
