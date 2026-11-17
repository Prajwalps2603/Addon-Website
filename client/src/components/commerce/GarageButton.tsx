import { Car, ChevronDown, Plus } from 'lucide-react';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';

export interface GarageButtonProps {
  /** Drops the small "My car" caption and keeps one line: for a crowded header on a phone. */
  compact?: boolean;
  className?: string;
}

/**
 * The "My car" control for the header: a red car badge and the active car read back in words
 * ("BMW X5"), or "Add your car". Pressing it opens the car picker.
 */
export function GarageButton({ compact = false, className }: GarageButtonProps) {
  const car = useActiveCar();
  const open = useUi((state) => state.vehiclePickerOpen);
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const Icon = car ? Car : Plus;

  return (
    <button
      type="button"
      onClick={openVehiclePicker}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={car ? `${car.vehicle.label}. Change car` : 'Add your car'}
      className={cn(
        'group inline-flex h-11 max-w-56 shrink-0 items-center gap-2.5 rounded-full py-1 pr-3 pl-1 text-left text-ink transition-colors dur-quick hover:bg-surface-2',
        open && 'bg-surface-2',
        className,
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full transition-colors dur-quick',
          car ? 'bg-brand text-brand-ink' : 'border border-dashed border-line-strong text-ink group-hover:border-ink',
        )}
      >
        <Icon aria-hidden className="size-[1.125rem]" />
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className={compact ? 'sr-only' : 'text-[0.6875rem] font-semibold text-muted'}>{car ? 'Shopping for' : 'My car'}</span>
        <span className="truncate text-[0.9375rem] font-bold">
          {car ? `${car.vehicle.make} ${car.vehicle.model}` : 'Add your car'}
        </span>
      </span>
      <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  );
}
