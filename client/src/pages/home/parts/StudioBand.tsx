import { ArrowRight, CalendarClock, CreditCard, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { emiLabel, serviceCharge, slotSentences, studioAddress, studioOpen } from '@/components/layout/storeContact';
import { Button } from '@/components/ui';
import { minutesLabel } from '@/lib/format';
import type { PublicSettings } from '@/types/api';

export interface StudioBandProps {
  settings: PublicSettings | undefined;
}

/**
 * "Fitted at our studio": every fitting service with its charge and time, the slot rules, the
 * studio address and the EMI partner, and the way to book. All from settings; nothing while the
 * studio is paused or has no services.
 */
export function StudioBand({ settings }: StudioBandProps) {
  if (!settings || !studioOpen(settings)) return null;
  const { studio, services } = settings;
  const rules = slotSentences(studio);
  const address = studioAddress(settings);
  const emi = emiLabel(settings);

  return (
    <section aria-labelledby="home-studio" className="section-y border-t border-line">
      <div className="container-page grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="grid content-start gap-5 lg:col-span-5">
          <h2 id="home-studio" className="type-h1">
            Fitted at our studio
          </h2>
          <p className="type-lead max-w-prose">
            Buy the part here and our own team fits it at the studio, in a slot you book. Already have the part? Book the fitting on its own.
          </p>

          {rules.length > 0 && (
            <div className="flex gap-3">
              <CalendarClock aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p className="type-small max-w-prose tnum">{rules.join(' ')}</p>
            </div>
          )}
          {(address || studio.mapUrl) && (
            <div className="flex gap-3">
              <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div className="type-small grid gap-1">
                {address && <address className="not-italic whitespace-pre-line">{address}</address>}
                {studio.mapUrl && (
                  <a href={studio.mapUrl} target="_blank" rel="noopener noreferrer" className="link w-fit font-bold">
                    Open the studio in Maps<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </div>
            </div>
          )}
          {emi && (
            <div className="flex gap-3">
              <CreditCard aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p className="type-small max-w-prose">{settings.emi.note.trim() || emi}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
            <Button to="/book-fitting" size="lg">
              Book a fitting
            </Button>
            <Link to="/faq#studio" className="link font-bold">
              How studio fitting works
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7">
          <h3 className="sr-only">Fitting services and charges</h3>
          <ul className="border-t border-ink">
            {services.map((service) => (
              <li key={service.id} className="border-b border-line">
                <Link
                  to={`/book-fitting?service=${encodeURIComponent(service.id)}`}
                  className="group focus-ring-inset grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 py-4 transition-colors dur-quick hover:bg-surface sm:px-2"
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="font-bold leading-snug">{service.name}</span>
                    {service.blurb && <span className="type-small text-muted">{service.blurb}</span>}
                  </span>
                  <span className="grid justify-items-end gap-1 text-right">
                    <span className="type-price">{serviceCharge(service)}</span>
                    {service.minutes > 0 && <span className="type-small text-muted tnum">About {minutesLabel(service.minutes)}</span>}
                  </span>
                  <span className="sr-only">. Book this fitting</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="type-small mt-3 flex items-center gap-1.5 text-muted">
            <ArrowRight aria-hidden className="size-4 shrink-0" />
            Charges include GST and are per part fitted. Choose a service to book it.
          </p>
        </div>
      </div>
    </section>
  );
}
