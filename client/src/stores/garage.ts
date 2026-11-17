import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage, syncAcrossTabs } from '@/lib/storage';
import type { Vehicle } from '@/types/api';

const STORAGE_KEY = 'addon-garage-v1';

export const MAX_GARAGE_CARS = 8;

/** One saved car: the shopper's own details beside the catalogue vehicle it resolves to. */
export interface GarageCar {
  vehicleId: number;
  /** The year of the shopper's own car, when they gave it. */
  year: number | null;
  nickname: string;
  vehicle: Vehicle;
}

export interface AddCarOptions {
  year?: number | null;
  nickname?: string;
  /** Defaults to true: a car just picked becomes the one fit is checked against. */
  makeActive?: boolean;
}

interface GarageState {
  vehicles: GarageCar[];
  /** The car fit verdicts are shown for, or null for "no car chosen". */
  activeVehicleId: number | null;

  /** Saves a car (or updates its year and nickname when it is already saved). */
  add: (vehicle: Vehicle, options?: AddCarOptions) => void;
  remove: (vehicleId: number) => void;
  /** Pass null to browse without a car. Ids not in the garage are ignored. */
  setActive: (vehicleId: number | null) => void;
  clear: () => void;
  /** Replaces the whole garage (account sync). */
  setAll: (vehicles: GarageCar[], activeVehicleId: number | null) => void;
  /** Swaps in a fresh copy of a saved vehicle's catalogue record. */
  refresh: (vehicle: Vehicle) => void;
}

function isCar(value: unknown): value is GarageCar {
  if (typeof value !== 'object' || value === null) return false;
  const car = value as Partial<GarageCar>;
  return (
    typeof car.vehicleId === 'number' &&
    typeof car.vehicle === 'object' &&
    car.vehicle !== null &&
    car.vehicle.id === car.vehicleId &&
    typeof car.vehicle.label === 'string'
  );
}

function cleanCars(input: unknown): GarageCar[] {
  if (!Array.isArray(input)) return [];
  const cars = new Map<number, GarageCar>();
  for (const value of input) {
    if (!isCar(value) || cars.has(value.vehicleId)) continue;
    cars.set(value.vehicleId, {
      vehicleId: value.vehicleId,
      year: typeof value.year === 'number' ? value.year : null,
      nickname: typeof value.nickname === 'string' ? value.nickname : '',
      vehicle: value.vehicle,
    });
  }
  return [...cars.values()].slice(0, MAX_GARAGE_CARS);
}

function activeIn(cars: GarageCar[], id: unknown): number | null {
  return typeof id === 'number' && cars.some((car) => car.vehicleId === id) ? id : null;
}

export const useGarage = create<GarageState>()(
  persist(
    (set, get) => ({
      vehicles: [],
      activeVehicleId: null,

      add: (vehicle, options = {}) => {
        const { vehicles, activeVehicleId } = get();
        const existing = vehicles.find((car) => car.vehicleId === vehicle.id);
        const car: GarageCar = {
          vehicleId: vehicle.id,
          year: options.year === undefined ? (existing?.year ?? null) : options.year,
          nickname: options.nickname === undefined ? (existing?.nickname ?? '') : options.nickname.trim(),
          vehicle,
        };
        const next = existing
          ? vehicles.map((other) => (other.vehicleId === vehicle.id ? car : other))
          : [car, ...vehicles].slice(0, MAX_GARAGE_CARS);
        set({
          vehicles: next,
          activeVehicleId: options.makeActive === false ? activeIn(next, activeVehicleId) : vehicle.id,
        });
      },

      remove: (vehicleId) => {
        const vehicles = get().vehicles.filter((car) => car.vehicleId !== vehicleId);
        const wasActive = get().activeVehicleId === vehicleId;
        set({
          vehicles,
          activeVehicleId: wasActive ? (vehicles[0]?.vehicleId ?? null) : get().activeVehicleId,
        });
      },

      setActive: (vehicleId) => {
        if (vehicleId !== null && !get().vehicles.some((car) => car.vehicleId === vehicleId)) return;
        set({ activeVehicleId: vehicleId });
      },

      clear: () => set({ vehicles: [], activeVehicleId: null }),

      setAll: (vehicles, activeVehicleId) => {
        const cars = cleanCars(vehicles);
        set({ vehicles: cars, activeVehicleId: activeIn(cars, activeVehicleId) });
      },

      refresh: (vehicle) => {
        const current = get().vehicles.find((car) => car.vehicleId === vehicle.id);
        if (!current || JSON.stringify(current.vehicle) === JSON.stringify(vehicle)) return;
        set({ vehicles: get().vehicles.map((car) => (car.vehicleId === vehicle.id ? { ...car, vehicle } : car)) });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: persistStorage(),
      partialize: (state) => ({ vehicles: state.vehicles, activeVehicleId: state.activeVehicleId }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<GarageState>;
        const vehicles = cleanCars(stored.vehicles);
        return { ...current, vehicles, activeVehicleId: activeIn(vehicles, stored.activeVehicleId) };
      },
    },
  ),
);

syncAcrossTabs(useGarage, STORAGE_KEY);
