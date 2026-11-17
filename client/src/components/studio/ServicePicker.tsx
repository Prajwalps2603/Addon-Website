import { useId, type ReactNode } from 'react';
import {
  Armchair,
  Check,
  CircleAlert,
  CircleDot,
  Clock,
  Lightbulb,
  MessagesSquare,
  Radio,
  Speaker,
  Sun,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { minutesLabel } from '@/lib/format';
import type { StudioService } from '@/types/api';
import { CONSULT_ID, chargeLabel } from './studioTime';

export interface ServicePickerProps {
  services: readonly StudioService[];
  value: string | null;
  onChange: (serviceId: string) => void;
  error?: ReactNode;
  className?: string;
}

/** An icon for a service, picked from words in its name. */
function iconFor(service: StudioService): LucideIcon {
  if (service.id === CONSULT_ID) return MessagesSquare;
  const n = service.name.toLowerCase();
  if (/stereo|android|head ?unit/.test(n)) return Radio;
  if (/speaker|woofer|amp/.test(n)) return Speaker;
  if (/led|fog|lamp|light/.test(n)) return Lightbulb;
  if (/spoiler|skirt|body|splitter/.test(n)) return Wind;
  if (/seat/.test(n)) return Armchair;
  if (/film|tint|sun/.test(n)) return Sun;
  if (/wheel|alloy|tyre|tire/.test(n)) return CircleDot;
  return Wrench;
}

function Tick({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-200',
        checked ? 'scale-100 border-brand bg-brand text-brand-ink' : 'border-line-strong bg-raised text-transparent',
      )}
    >
      <Check className="size-3.5" strokeWidth={3.5} />
    </span>
  );
}

function ServiceOption({ name, service, checked, onChange }: { name: string; service: StudioService; checked: boolean; onChange: () => void }) {
  const time = minutesLabel(service.minutes);
  const Icon = iconFor(service);
  return (
    <label
      className={cn(
        'group/svc relative flex h-full cursor-pointer flex-col gap-3 rounded-[18px] border-2 p-4 transition-[border-color,background-color] duration-200',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus',
        checked ? 'border-brand bg-brand-soft' : 'border-transparent bg-surface hover:border-line-strong',
      )}
    >
      <input type="radio" name={name} value={service.id} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-[12px] transition-colors duration-200',
            checked ? 'bg-brand text-brand-ink' : 'bg-raised text-ink group-hover/svc:text-brand-text',
          )}
        >
          <Icon className="size-5" />
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="leading-snug font-bold">{service.name}</span>
          {service.blurb && <span className="text-sm leading-snug text-muted">{service.blurb}</span>}
        </span>
        <Tick checked={checked} />
      </span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pl-14">
        {time ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted tnum">
            <Clock aria-hidden className="size-3.5" />
            About {time}
          </span>
        ) : (
          <span />
        )}
        <span className={cn('rounded-full px-3 py-1 text-sm font-bold tnum', checked ? 'bg-raised text-ink' : 'bg-raised')}>{chargeLabel(service)}</span>
      </span>
    </label>
  );
}

function ConsultOption({ name, service, checked, onChange }: { name: string; service: StudioService; checked: boolean; onChange: () => void }) {
  const time = minutesLabel(service.minutes);
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-[20px] border-2 bg-ink p-5 text-page transition-colors duration-200 md:p-6',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus',
        checked ? 'border-brand' : 'border-transparent hover:border-line-strong',
      )}
    >
      <input type="radio" name={name} value={service.id} checked={checked} onChange={onChange} className="sr-only" />
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-brand/25 blur-3xl" />
      <span aria-hidden className="relative grid size-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
        <MessagesSquare className="size-5" />
      </span>
      <span className="relative grid min-w-0 flex-1 gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-lg leading-snug font-bold">{service.name}</span>
          <span className="rounded-full bg-brand px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.08em] text-brand-ink uppercase">Free</span>
        </span>
        {service.blurb && <span className="text-sm text-page/70">{service.blurb}</span>}
        {time && (
          <span className="inline-flex items-center gap-1.5 text-sm text-page/70 tnum">
            <Clock aria-hidden className="size-3.5" />
            About {time}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative grid size-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200',
          checked ? 'border-brand bg-brand text-brand-ink' : 'border-page/40 text-transparent',
        )}
      >
        <Check className="size-4" strokeWidth={3.5} />
      </span>
    </label>
  );
}

/**
 * The studio's services as radio cards, from settings.services. The free consultation comes first
 * at full width: it is the way in for anyone not sure what their car needs.
 */
export function ServicePicker({ services, value, onChange, error, className }: ServicePickerProps) {
  const name = useId();
  const errorId = `${name}-error`;
  const consult = services.find((service) => service.id === CONSULT_ID);
  const rest = services.filter((service) => service.id !== CONSULT_ID);

  return (
    <fieldset className={cn('grid min-w-0 gap-3', className)} aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="sr-only">Service</legend>
      {consult && <ConsultOption name={name} service={consult} checked={value === consult.id} onChange={() => onChange(consult.id)} />}
      {rest.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rest.map((service) => (
            <li key={service.id}>
              <ServiceOption name={name} service={service} checked={value === service.id} onChange={() => onChange(service.id)} />
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={errorId} role="alert" className="type-small mt-1 flex items-start gap-1.5 font-medium text-stop">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
