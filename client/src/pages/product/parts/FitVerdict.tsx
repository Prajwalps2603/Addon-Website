import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { BadgeCheck, Car, CircleCheck, CircleHelp, CircleX, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';
import { describeFit, fitsPath, type FitState } from '@/components/commerce';
import { StickerChip } from '@/components/brand';
import { Button } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';
import type { ProductDetail, Vehicle } from '@/types/api';
import { FitsTable } from './FitsTable';

export interface FitVerdictProps {
  product: ProductDetail;
  vehicle: Vehicle | null;
}

const ICONS: Record<FitState, LucideIcon> = {
  direct: CircleCheck,
  with_work: Wrench,
  universal: CircleCheck,
  no: CircleX,
  unknown: CircleHelp,
  select: Car,
};

const TONES = {
  fit: { box: 'border-fit bg-fit-soft', flag: 'bg-fit text-fit-ink' },
  warn: { box: 'border-warn bg-warn-soft', flag: 'bg-warn text-warn-ink' },
  stop: { box: 'border-stop bg-stop-soft', flag: 'bg-stop text-stop-ink' },
  info: { box: 'border-info bg-info-soft', flag: 'bg-info text-info-ink' },
  plain: { box: 'border-ink bg-surface', flag: 'bg-ink text-page' },
} as const;

/** Moves to the questions section's fitment form. A plain hash link, so the section hears `hashchange`. */
function askFitment(event: MouseEvent<HTMLAnchorElement>) {
  if (window.location.hash === '#ask-fitment') {
    // Already there once: the browser would do nothing, so nudge the section and scroll again.
    event.preventDefault();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    document.getElementById('ask-fitment')?.scrollIntoView({ block: 'start' });
  }
}

/**
 * The fit verdict for the shopper's car, as big as the price: one of six states, the car it was
 * worked out for, what to do next, and the Fit Promise when the shop has checked a direct fit.
 * Below it, every car we hold a verdict for.
 */
export function FitVerdict({ product, vehicle }: FitVerdictProps) {
  const settings = useSettings().data;
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const fit = describeFit(product, vehicle);
  if (!fit) return null;

  const Icon = fit.verified ? BadgeCheck : ICONS[fit.state];
  const tone = TONES[fit.tone];
  const car = vehicle?.model || 'car';
  const promise = settings?.fitPromise.enabled && fit.state === 'direct' && fit.verified;

  return (
    <section aria-labelledby="fit-verdict-title" className="grid gap-3">
      <div aria-live="polite" className={cn('overflow-hidden rounded-[14px] border', tone.box)}>
        <div className="flex items-start gap-3 p-4">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', tone.flag)}>
            <Icon aria-hidden className="size-6" />
          </span>
          <div className="grid min-w-0 flex-1 gap-1">
            <h2 id="fit-verdict-title" className="text-lg leading-snug font-bold">
              <span className="sr-only">Fit: </span>
              {fit.headline}
            </h2>
            {vehicle && fit.state !== 'select' && <p className="type-small font-bold text-muted">{vehicle.label}</p>}
            {fit.detail && <p className="type-small">{fit.detail}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-4 py-3 empty:hidden">
          {fit.verified && <StickerChip tone="fit">Shop verified</StickerChip>}
          {fit.state === 'no' && (
            <Button variant="dark" size="sm" to={fitsPath(product)}>
              See parts that fit your {car}
            </Button>
          )}
          {fit.state === 'unknown' && (
            <Button variant="dark" size="sm" href="#ask-fitment" onClick={askFitment}>
              Ask if this fits my car
            </Button>
          )}
          {fit.state === 'with_work' && (
            <a href="#ask-fitment" onClick={askFitment} className="link type-small font-bold">
              Ask us what the work involves
            </a>
          )}
          {fit.state === 'select' ? (
            <Button variant="dark" size="sm" onClick={openVehiclePicker} aria-haspopup="dialog" iconLeft={<Car aria-hidden />}>
              Select your car
            </Button>
          ) : (
            vehicle && (
              <Button variant="link" onClick={openVehiclePicker} aria-haspopup="dialog" className="[--button-text:0.875rem]">
                Change car
              </Button>
            )
          )}
        </div>

        {promise && (
          <div className="flex items-start gap-3 border-t border-line bg-page px-4 py-3">
            <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-fit" />
            <div className="grid gap-0.5">
              <p className="font-bold">It fits, or it is on us</p>
              {settings?.fitPromise.summary && <p className="type-small text-muted">{settings.fitPromise.summary}</p>}
              <Link to="/policies/returns" className="link type-small font-bold">
                How the Fit Promise works
              </Link>
            </div>
          </div>
        )}
      </div>

      <FitsTable product={product} activeVehicleId={vehicle?.id ?? null} />
    </section>
  );
}
