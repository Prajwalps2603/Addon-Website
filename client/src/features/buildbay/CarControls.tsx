import { useId } from 'react';
import type { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button, Segmented, Slider, toast } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import type { BuildSlot } from '@/types/api';
import { BUILD_SLOT_LABELS } from '@/features/buildbay/contract';
import type { BuildBodyType } from '@/features/buildbay/contract';
import { PAINTS } from '@/features/buildbay/stage/styles';
import { useBuildBay } from './store';
import { Swatches } from './Swatches';

export const BODY_LABELS: Record<BuildBodyType, string> = { hatchback: 'Hatchback', sedan: 'Sedan', suv: 'SUV' };

const RIDE_OPTIONS = [
  { value: '-2', label: '−2' },
  { value: '-1', label: '−1' },
  { value: '0', label: 'Stock' },
  { value: '1', label: '+1' },
  { value: '2', label: '+2' },
] as const;

const RIDE_WORDS: Record<string, string> = { '-2': 'Slammed', '-1': 'Lowered', '0': 'Stock height', '1': 'Raised', '2': 'Lifted' };

const WHEEL_OPTIONS = [
  { value: '0', label: 'Stock' },
  { value: '1', label: '+1 inch' },
  { value: '2', label: '+2 inch' },
] as const;

export function announceRemoved(removed: BuildSlot[], bodyType: BuildBodyType): void {
  if (removed.length === 0) return;
  const names = removed.map((slot) => BUILD_SLOT_LABELS[slot].toLowerCase()).join(', ');
  toast.info(`Took off the ${names}`, { description: `Not offered on a ${BODY_LABELS[bodyType].toLowerCase()}. Undo brings it back.`, id: 'build-removed' });
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2.5 border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-label text-muted">{title}</h3>
        {hint && <span className="type-small font-bold">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** The car itself: body, paint, light, ride height, wheel size and tint. */
export function CarControls() {
  const build = useBuildBay((s) => s.build);
  const change = useBuildBay((s) => s.change);
  const setBody = useBuildBay((s) => s.setBody);
  const vehicle = useActiveVehicle();
  const tintId = useId();

  const garageBody = vehicle && (vehicle.bodyType === 'hatchback' || vehicle.bodyType === 'sedan' || vehicle.bodyType === 'suv') ? vehicle.bodyType : null;
  const lowered = Boolean(build.parts.lowering);

  const chooseBody = (bodyType: BuildBodyType) => {
    const removed = setBody(bodyType);
    announceRemoved(removed, bodyType);
  };

  return (
    <div className="grid">
      <Group title="Body">
        <Segmented<BuildBodyType>
          label="Body type"
          block
          options={(['hatchback', 'sedan', 'suv'] as const).map((value) => ({ value, label: BODY_LABELS[value] }))}
          value={build.bodyType}
          onChange={chooseBody}
        />
        {vehicle && garageBody && garageBody !== build.bodyType && (
          <p className="type-small text-muted">
            Your {vehicle.model} is a {BODY_LABELS[garageBody].toLowerCase()}.{' '}
            <Button variant="link" className="[--button-text:0.875rem]" onClick={() => chooseBody(garageBody)}>
              Use {BODY_LABELS[garageBody].toLowerCase()}
            </Button>
          </p>
        )}
      </Group>

      <Group title="Paint">
        <Swatches label="Paint colour" colours={PAINTS} value={build.paint} onChange={(paint) => change('paint', (s) => ({ ...s, paint }))} />
      </Group>

      <Group title="Light">
        <Segmented<string>
          label="Light in the garage"
          block
          options={[
            { value: 'night', label: 'Night', icon: <Moon aria-hidden /> },
            { value: 'day', label: 'Day', icon: <Sun aria-hidden /> },
          ]}
          value={build.night ? 'night' : 'day'}
          onChange={(value) => change('light', (s) => ({ ...s, night: value === 'night' }))}
        />
      </Group>

      <Group title="Ride height" hint={RIDE_WORDS[String(build.rideHeight)]}>
        <Segmented<string>
          label="Ride height"
          block
          options={RIDE_OPTIONS.map((option) => ({ ...option, disabled: lowered && Number(option.value) > -1 }))}
          value={String(build.rideHeight)}
          onChange={(value) => change('ride height', (s) => ({ ...s, rideHeight: Number(value) }))}
        />
        {lowered && <p className="type-small text-muted">Lowering parts are fitted, so the car sits at −1 or −2. Remove them to raise it.</p>}
      </Group>

      <Group title="Wheel size" hint={build.wheelSize === 0 ? 'Stock size' : `${build.wheelSize} inch over stock`}>
        <Segmented<string>
          label="Wheel size"
          block
          options={WHEEL_OPTIONS}
          value={String(build.wheelSize)}
          onChange={(value) => change('wheel size', (s) => ({ ...s, wheelSize: Number(value) }))}
        />
        <p className="type-small text-muted">A bigger rim with a lower-profile tyre, so the overall size stays close to stock.</p>
      </Group>

      <Group title="Window tint" hint={build.tint === 0 ? 'Clear' : `${build.tint}% darker`}>
        <label htmlFor={tintId} className="sr-only">
          Window tint, percent darker
        </label>
        <Slider
          id={tintId}
          min={0}
          max={60}
          step={5}
          value={build.tint}
          format={(tint) => (tint === 0 ? 'Clear' : `${tint}%`)}
          valueText={(tint) => (tint === 0 ? 'Clear glass' : `${tint} percent darker`)}
          onChange={(tint) => change('tint', (s) => ({ ...s, tint }))}
        />
        <p className="type-small text-muted">Tint film on car windows is restricted on Indian roads. Check your State&apos;s rules before fitting any.</p>
      </Group>
    </div>
  );
}
