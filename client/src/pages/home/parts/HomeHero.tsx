import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CalendarCheck, ChevronDown, CreditCard, ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useVehicles } from '@/hooks/useVehicles';
import { useGarage, type GarageCar } from '@/stores/garage';
import { cn } from '@/lib/cn';

export interface HomeHeroProps {
  /** The active garage car, or null. */
  car: GarageCar | null;
}

const PHOTO = '/editorial/workshop-01.webp';
const PHOTO_SMALL = '/editorial/workshop-01-960.webp';

/**
 * The first screen, in the mood of the owner's poster: a dark studio photograph, a short headline,
 * and a one-line car finder (make, model, year, go). The headline paints without waiting for data.
 */
export function HomeHero({ car }: HomeHeroProps) {
  const settings = useSettings().data;
  const tagline = settings?.tagline?.trim() || 'Upgrade your ride. Elevate your style.';
  const [first, ...rest] = tagline.split(/(?<=\.)\s+/);
  const second = rest.join(' ');

  const facts = [
    settings?.studio?.enabled ? { icon: Wrench, text: 'Fitted at our studio' } : null,
    settings?.emi?.enabled ? { icon: CreditCard, text: `EMI with ${settings.emi.partner}` } : null,
    settings?.fitPromise?.enabled ? { icon: ShieldCheck, text: 'It fits, or it is on us' } : null,
  ].filter((fact): fact is { icon: typeof Wrench; text: string } => fact !== null);

  return (
    <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden bg-black text-white">
      <img
        src={PHOTO}
        srcSet={`${PHOTO_SMALL} 960w, ${PHOTO} 1920w`}
        sizes="100vw"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-20 size-full object-cover object-[70%_center]"
      />
      {/* Darkens the left half for the text and the bottom edge for the finder. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(12_13_15/0.96)_0%,rgb(12_13_15/0.85)_38%,rgb(12_13_15/0.35)_72%,rgb(12_13_15/0.15)_100%),linear-gradient(0deg,rgb(12_13_15/0.9)_0%,transparent_45%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1 bg-brand" />

      <div className="container-page flex min-h-[min(88svh,46rem)] flex-col justify-end gap-8 pb-10 pt-16 md:pb-14 md:pt-24">
        <div className="max-w-2xl">
          <p className="type-label inline-flex items-center gap-2 text-white/80">
            <span aria-hidden="true" className="h-0.5 w-8 -skew-x-12 bg-brand" />
            Car accessories and fitting studio
          </p>
          <h1
            id="home-hero-title"
            className="mt-4 font-display text-[clamp(2.4rem,7.5vw,4.75rem)] font-black italic uppercase leading-[0.92] tracking-[-0.02em] [font-stretch:82%]"
          >
            {car ? (
              <>
                Parts that fit
                <span className="block text-brand">your {car.vehicle.model}.</span>
              </>
            ) : (
              <>
                {first}
                {second && <span className="block text-brand">{second}</span>}
              </>
            )}
          </h1>
          <p className="type-lead mt-5 max-w-xl text-white/80">
            Stereos, speakers, lights, alloys, seat covers and body kits for Indian cars. Pick your car and every part tells you
            whether it fits, then get it delivered or fitted by our team.
          </p>
        </div>

        <CarFinder car={car} />

        {facts.length > 0 && (
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-2">
                <Icon aria-hidden="true" className="size-4 text-brand" />
                {text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Make, model and year as three plain selects on one bar, then "Find parts". */
function CarFinder({ car }: { car: GarageCar | null }) {
  const navigate = useNavigate();
  const vehicles = useVehicles();
  const add = useGarage((state) => state.add);
  const [makeSlug, setMakeSlug] = useState('');
  const [modelSlug, setModelSlug] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  const makes = vehicles.data ?? [];
  const make = makes.find((m) => m.slug === makeSlug) ?? null;
  const model = make?.models.find((m) => m.slug === modelSlug) ?? null;
  const generations = useMemo(() => model?.generations ?? [], [model]);
  const generation = generations.length === 1 ? generations[0] : generations.find((g) => String(g.id) === vehicleId) ?? null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!generation) return;
    add(generation, { makeActive: true });
    navigate('/shop?fitOnly=1');
  }

  if (car) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button to="/shop?fitOnly=1" size="lg">
          Show parts for my {car.vehicle.model} <ArrowRight aria-hidden="true" className="size-5" />
        </Button>
        <Button to="/book-fitting" size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-black">
          <CalendarCheck aria-hidden="true" className="size-5" /> Book a fitting
        </Button>
        <button
          type="button"
          onClick={() => useGarage.getState().setActive(null)}
          className="tap-44 text-sm font-bold text-white/80 underline underline-offset-4 hover:text-white"
        >
          Not a {car.vehicle.make} {car.vehicle.model}? Change car
        </button>
      </div>
    );
  }

  const loading = vehicles.isPending;

  return (
    <form
      onSubmit={submit}
      aria-label="Find parts for your car"
      className="grid max-w-4xl gap-px overflow-hidden rounded-sm border border-white/15 bg-white/15 shadow-2xl sm:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <FinderSelect
        label="Make"
        value={makeSlug}
        disabled={loading}
        placeholder={loading ? 'Loading' : 'Choose make'}
        onChange={(value) => {
          setMakeSlug(value);
          setModelSlug('');
          setVehicleId('');
        }}
        options={makes.map((m) => ({ value: m.slug, label: m.name }))}
      />
      <FinderSelect
        label="Model"
        value={modelSlug}
        disabled={!make}
        placeholder="Choose model"
        onChange={(value) => {
          setModelSlug(value);
          setVehicleId('');
        }}
        options={(make?.models ?? []).map((m) => ({ value: m.slug, label: m.name }))}
      />
      <FinderSelect
        label="Year"
        value={generations.length === 1 ? String(generations[0].id) : vehicleId}
        disabled={generations.length < 2}
        placeholder={generations.length === 1 ? yearsOf(generations[0]) : 'Choose year'}
        onChange={setVehicleId}
        options={generations.map((g) => ({ value: String(g.id), label: yearsOf(g) }))}
      />
      <button
        type="submit"
        disabled={!generation}
        className="focus-ring inline-flex min-h-16 items-center justify-center gap-2 bg-brand px-7 font-display text-base font-black italic uppercase text-brand-ink transition-colors hover:bg-brand-press disabled:cursor-not-allowed disabled:opacity-60"
      >
        Find parts <ArrowRight aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}

function yearsOf(v: { yearFrom: number; yearTo: number | null }): string {
  return v.yearTo ? `${v.yearFrom} to ${v.yearTo}` : `${v.yearFrom} onwards`;
}

interface FinderSelectProps {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FinderSelect({ label, value, placeholder, disabled, options, onChange }: FinderSelectProps) {
  return (
    <label className={cn('relative block bg-black/75 backdrop-blur-sm', disabled && 'opacity-70')}>
      <span className="type-label pointer-events-none absolute left-4 top-2.5 text-white/60">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring-inset min-h-16 w-full cursor-pointer appearance-none bg-transparent px-4 pb-2 pt-6 pr-10 text-base font-bold text-white disabled:cursor-not-allowed [&>option]:bg-black [&>option]:text-white"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-white/70" />
    </label>
  );
}
