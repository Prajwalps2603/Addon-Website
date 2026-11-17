import { useId, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import * as z from 'zod';
import { BoardWord } from '@/components/brand';
import { Button, Field, Input, Modal, Select, toast } from '@/components/ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/cn';
import { useGarage, type GarageCar } from '@/stores/garage';
import { BODY_SINGULAR, modelYears, yearsLabel } from './carText';

const NICKNAME_MAX = 24;

function makeSchema(years: readonly number[]) {
  return z.object({
    nickname: z.string().trim().max(NICKNAME_MAX, { error: `Keep the nickname to ${NICKNAME_MAX} characters` }),
    year: z
      .string()
      .refine((value) => value === '' || years.includes(Number(value)), { error: 'Choose a year this model was sold' })
      .transform((value) => (value === '' ? null : Number(value))),
  });
}

type PlateForm = z.input<ReturnType<typeof makeSchema>>;
type PlateValues = z.output<ReturnType<typeof makeSchema>>;

/** What the plate reads in tiles: the model, and the shopper's own year when they gave it. */
export function plateReading(car: GarageCar): string {
  return car.year ? `${car.vehicle.model} ${car.year}` : car.vehicle.model;
}

interface EditFormProps {
  car: GarageCar;
  onDone: () => void;
}

function EditDetails({ car, onDone }: EditFormProps) {
  const years = modelYears(car.vehicle);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlateForm, unknown, PlateValues>({
    resolver: zodResolver(makeSchema(years)),
    defaultValues: { nickname: car.nickname, year: car.year ? String(car.year) : '' },
  });

  const save: SubmitHandler<PlateValues> = (values) => {
    useGarage.getState().add(car.vehicle, { year: values.year, nickname: values.nickname, makeActive: false });
    toast.success(`Saved the details of your ${car.vehicle.model}`, { id: 'garage-edit' });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="grid gap-4 border-t border-line pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nickname" optional hint="So you can tell two cars apart, e.g. Dad's car" error={errors.nickname?.message}>
          <Input {...register('nickname')} autoComplete="off" maxLength={NICKNAME_MAX + 8} autoFocus />
        </Field>
        <Field label="Model year" optional hint={`This generation: ${yearsLabel(car.vehicle)}`} error={errors.year?.message}>
          <Select {...register('year')} placeholder="Not given" options={years.map((year) => ({ value: String(year), label: String(year) }))} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          Save details
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export interface CarPlateProps {
  car: GarageCar;
  active: boolean;
  /** The large plate at the top of the garage. */
  featured?: boolean;
  /** Under the details: the live readout and the way on, for the car in use. */
  children?: ReactNode;
  className?: string;
}

/**
 * One saved car as a pit-board plate: the model in slotted tiles (Tread Red for the car in use),
 * the generation and years, the shopper's own year and nickname (editable in place),
 * one press to switch to it, and removal behind a confirmation.
 */
export function CarPlate({ car, active, featured = false, children, className }: CarPlateProps) {
  const headingId = useId();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { vehicle } = car;

  const use = () => {
    useGarage.getState().setActive(car.vehicleId);
    toast.success(`Showing what fits your ${vehicle.model}`, { id: 'garage' });
  };

  const remove = () => {
    const before = useGarage.getState();
    const snapshot = { vehicles: before.vehicles, active: before.activeVehicleId };
    before.remove(car.vehicleId);
    setConfirming(false);
    // This plate (and the button that opened the dialog) is gone: put focus on the page heading,
    // so keyboard and screen reader users carry on from the top of the garage, not from the body.
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => {
        const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1');
        if (!heading) return;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: false });
      }),
    );
    toast.info(`Removed the ${vehicle.model} from your garage`, {
      id: 'garage-remove',
      action: { label: 'Undo', onClick: () => useGarage.getState().setAll(snapshot.vehicles, snapshot.active) },
    });
  };

  const details: { label: string; value: string }[] = [
    { label: 'Generation', value: vehicle.generation || 'Not listed' },
    { label: 'Sold', value: yearsLabel(vehicle) },
    { label: 'Your model year', value: car.year ? String(car.year) : 'Not given' },
    { label: 'Nickname', value: car.nickname || 'None' },
  ];

  const Heading = featured ? 'h2' : 'h3';
  const tileSize = featured && !isMobile ? 'lg' : featured ? 'md' : 'sm';

  return (
    <article aria-labelledby={headingId} className={cn('plane-board flex min-w-0 flex-col gap-4', featured ? 'p-4 sm:p-6' : 'p-4', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="type-label text-muted">
          {vehicle.make}
          <span aria-hidden> / </span>
          {BODY_SINGULAR[vehicle.bodyType]}
        </p>
        {active ? (
          <span className="type-label inline-flex items-center gap-1 rounded-control bg-brand px-2 py-1 text-brand-ink">
            <Check aria-hidden className="size-4" />
            In use
          </span>
        ) : (
          <Button variant="outline" size="sm" onClick={use} aria-describedby={headingId}>
            Use this car
          </Button>
        )}
      </div>

      <Heading id={headingId} className="min-w-0">
        <BoardWord text={plateReading(car)} tone={active ? 'brand' : 'paper'} size={tileSize} />
        {car.nickname && <span className="sr-only">, {car.nickname}</span>}
      </Heading>

      {editing ? (
        <EditDetails car={car} onDone={() => setEditing(false)} />
      ) : (
        <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4', featured && 'sm:grid-cols-4')}>
          {details.map((item) => (
            <div key={item.label} className="grid min-w-0 gap-0.5">
              <dt className="type-label text-muted">{item.label}</dt>
              <dd className="truncate font-bold tnum">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {!editing && (
        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1">
          <Button variant="link" size="sm" iconLeft={<Pencil aria-hidden />} onClick={() => setEditing(true)}>
            Edit year and nickname
          </Button>
          <Button variant="link" size="sm" iconLeft={<Trash2 aria-hidden />} onClick={() => setConfirming(true)}>
            Remove
          </Button>
        </div>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Remove the ${vehicle.model}?`}
        description={
          active
            ? 'Parts will stop showing whether they fit this car. Another saved car takes its place, if you have one.'
            : 'Parts will stop showing whether they fit this car. You can add it again any time.'
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove}>
              Remove car
            </Button>
          </>
        }
      >
        <p className="font-bold">{vehicle.label}</p>
      </Modal>
    </article>
  );
}
