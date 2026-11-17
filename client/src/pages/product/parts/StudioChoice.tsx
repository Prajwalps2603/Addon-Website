import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Package, Wrench } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel } from '@/lib/format';
import type { StudioService } from '@/types/api';
import type { FitChoice } from './studio';

export interface StudioChoiceProps {
  service: StudioService;
  value: FitChoice;
  onChange: (value: FitChoice) => void;
  /** The car model, when the part is known not to fit it: the studio option is then switched off. */
  doesNotFit?: string | null;
}

/** The fitting charge beside the option: "+ ₹799", or "Included". */
export function chargeLabel(service: StudioService): string {
  return service.charge > 0 ? `+ ${formatINR(service.charge)}` : 'Included';
}

/**
 * "Fit it at our studio" beside "Send it to me", as two tiles side by side: the studio service that
 * fits this part, with its charge and time. The slot is chosen at checkout. Native radios underneath,
 * so arrow keys move between the tiles.
 */
export function StudioChoice({ service, value, onChange, doesNotFit = null }: StudioChoiceProps) {
  const name = useId();
  const time = minutesLabel(service.minutes);
  const current = doesNotFit ? 'self' : value;

  return (
    <div className="grid gap-3">
      <fieldset role="radiogroup" className="min-w-0">
        <legend className="sr-only">Fitting</legend>
        <div className="grid gap-2">
          <Tile
            name={name}
            value="self"
            checked={current === 'self'}
            onChange={onChange}
            icon={<Package aria-hidden className="size-5" />}
            title="Deliver to me"
            tag="Free"
            meta="Fit it yourself or at your garage"
            description="The Fitting Card has every step."
          />
          <Tile
            name={name}
            value="studio"
            checked={current === 'studio'}
            disabled={Boolean(doesNotFit)}
            onChange={onChange}
            icon={<Wrench aria-hidden className="size-5" />}
            title="Fit it at our studio"
            tag={
              <>
                {chargeLabel(service)}
                {service.charge > 0 && <span className="sr-only"> for fitting</span>}
              </>
            }
            meta={time ? `About ${time}` : undefined}
            description={
              doesNotFit
                ? `Our records say this part does not fit your ${doesNotFit}, so we cannot book it in.`
                : `${service.name}. ${service.charge > 0 ? 'Charge added in the cart.' : 'No extra charge.'} Pick your slot at checkout.`
            }
          />
        </div>
      </fieldset>
      <p className="type-small text-muted">
        Only want the fitting?{' '}
        <Link to={`/book-fitting?service=${encodeURIComponent(service.id)}`} className="link font-bold">
          Book a slot on its own
        </Link>
      </p>
    </div>
  );
}

interface TileProps {
  name: string;
  value: FitChoice;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: FitChoice) => void;
  icon: ReactNode;
  title: string;
  tag: ReactNode;
  meta?: string;
  description: string;
}

function Tile({ name, value, checked, disabled = false, onChange, icon, title, tag, meta, description }: TileProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-[12px] border-2 p-3.5 transition-colors dur-quick has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        disabled ? 'cursor-not-allowed border-line opacity-50' : 'cursor-pointer',
        !disabled && (checked ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong'),
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} className="sr-only" />
      {/* A real-looking radio dot. */}
      <span
        aria-hidden
        className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', checked ? 'border-brand' : 'border-line-strong')}
      >
        {checked && <span className="size-2.5 rounded-full bg-brand" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="inline-flex items-center gap-2 font-bold">
            <span className="text-muted [&>svg]:size-4">{icon}</span>
            {title}
          </span>
          <span className="font-bold tnum">{tag}</span>
        </span>
        <span className="text-sm text-muted">
          {meta ? `${meta}. ` : ''}
          {description}
        </span>
      </span>
    </label>
  );
}
