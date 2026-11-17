import { Car } from 'lucide-react';
import { Switch } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useUi } from '@/stores/ui';
import type { Vehicle } from '@/types/api';

export interface CarBarProps {
  vehicle: Vehicle | null;
  /** How many results fit the car (facets.fitsCount); undefined while loading. */
  fitsCount: number | undefined;
  /** All results under the other filters, before the car toggle. */
  total: number | undefined;
  fitOnly: boolean;
  onFitOnlyChange: (on: boolean) => void;
  className?: string;
}

/**
 * The shopper's car over the list. With a car: its name, how many of these parts fit it, and the
 * one-tap "Only parts for my car". Without one: a short prompt that opens the car picker.
 */
export function CarBar({ vehicle, fitsCount, total, fitOnly, onFitOnlyChange, className }: CarBarProps) {
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);

  if (!vehicle) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] bg-surface p-2.5 pl-3', className)}>
        <p className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-raised">
            <Car className="size-5" />
          </span>
          <span className="type-small">
            <span className="font-bold">Add your car</span> and every part here says whether it fits.
          </span>
        </p>
        <button
          type="button"
          onClick={openVehiclePicker}
          aria-haspopup="dialog"
          className="focus-ring h-10 rounded-full bg-ink px-5 text-sm font-bold text-page transition-colors hover:bg-brand hover:text-brand-ink"
        >
          Add your car
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Your car"
      className={cn('grid gap-x-6 gap-y-3 rounded-[18px] bg-surface p-2.5 pl-3 md:grid-cols-[1fr_auto] md:items-center md:pr-4', className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
          <Car className="size-5" />
        </span>
        <div className="grid min-w-0">
          <p className="truncate font-bold tnum">{vehicle.label}</p>
          <p className="text-xs text-muted tnum" aria-live="polite">
            {fitsCount === undefined || total === undefined ? (
              <span aria-hidden className="inline-block h-3 w-24 rounded-full bg-surface-2 align-middle" />
            ) : (
              <>
                <span className="font-bold text-fit">{formatNumber(fitsCount)}</span> of {formatNumber(total)} parts fit
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={openVehiclePicker}
          aria-haspopup="dialog"
          className="focus-ring ml-1 h-8 shrink-0 rounded-full bg-raised px-3 text-xs font-bold transition-colors hover:bg-ink hover:text-page"
        >
          Change car
        </button>
      </div>
      <Switch
        checked={fitOnly}
        onChange={(event) => onFitOnlyChange(event.target.checked)}
        label={<span className="font-bold">Only parts for my car</span>}
        labelFirst
        className="md:justify-end"
      />
    </section>
  );
}
