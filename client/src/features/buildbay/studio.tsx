/**
 * "Get it fitted at our studio": the fitting offer the interactive tools show beside their parts
 * (Build Bay, the kit planners, Light Lab). Charges and services come from settings.services; nothing
 * is shown while the studio is paused (settings.studio.enabled false).
 *
 * The parts go into the cart marked `fitAtStudio`; the cart prices the fitting (PricedLine.fittingCharge)
 * and checkout asks for the slot. A fitting service on its own is booked at /book-fitting.
 */
import type { ReactNode } from 'react';
import { CalendarClock, Wrench } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatINR, pluralize } from '@/lib/format';
import { cartLineKey, useCart } from '@/stores/cart';
import type { StudioService } from '@/types/api';

export const BOOK_FITTING_PATH = '/book-fitting';

/** A part the studio might fit: its subcategory decides the service. */
export interface StudioPart {
  productId: number;
  /** ProductSummary.categorySlug (the subcategory). */
  categorySlug: string;
  qty?: number;
}

/** The service that fits a part of this subcategory. The free consultation never applies to a part. */
export function fittingServiceFor(categorySlug: string, services: readonly StudioService[]): StudioService | null {
  return services.find((service) => service.id !== 'consult' && service.subcategorySlugs.includes(categorySlug)) ?? null;
}

export interface StudioQuote {
  /** Parts a studio service fits. */
  fitted: StudioPart[];
  /** Parts no service fits: they come as they are. */
  notFitted: StudioPart[];
  /** Fitting charges added up (charge × qty), GST included. */
  charge: number;
  /** The services involved, once each, in the order of settings.services. */
  services: StudioService[];
}

/** The same rule /cart/price uses: a part's subcategory names its service, and the charge is per unit fitted. */
export function studioQuote(parts: readonly StudioPart[], services: readonly StudioService[]): StudioQuote {
  const quote: StudioQuote = { fitted: [], notFitted: [], charge: 0, services: [] };
  const used = new Set<string>();
  for (const part of parts) {
    const service = fittingServiceFor(part.categorySlug, services);
    if (!service) {
      quote.notFitted.push(part);
      continue;
    }
    quote.fitted.push(part);
    quote.charge += service.charge * Math.max(1, part.qty ?? 1);
    used.add(service.id);
  }
  quote.services = services.filter((service) => used.has(service.id));
  return quote;
}

/**
 * Asks for these cart lines (plain lines: no size and no design) to be fitted at the studio.
 * Call it after adding the parts. Lines no service fits are priced without fitting by the server.
 */
export function markForStudio(productIds: readonly number[]): void {
  const keys = new Set(productIds.map((productId) => cartLineKey({ productId, variantId: null, custom: null })));
  useCart.setState((state) => ({
    lines: state.lines.map((line) => (keys.has(cartLineKey(line)) ? { ...line, fitAtStudio: true } : line)),
  }));
}

/** settings.studio and settings.services, or null while they load or while the studio is paused. */
export function useStudio(): { services: StudioService[] } | null {
  const { data } = useSettings();
  if (!data?.studio?.enabled) return null;
  return { services: data.services ?? [] };
}

interface StudioFitOfferProps {
  parts: readonly StudioPart[];
  /** Adds the parts to the cart marked for fitting. Left out where the parts cannot be added from here. */
  onAddForFitting?: () => void;
  /** What the add button says. */
  addLabel?: string;
  /** Extra line under the offer (for example, parts that need a size chosen first). */
  note?: ReactNode;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/**
 * The offer for a set of parts: how many the studio fits and the total fitting charge, a way to add them
 * for fitting, and the way to book a slot for a fitting on its own.
 */
export function StudioFitOffer({ parts, onAddForFitting, addLabel = 'Add and fit at our studio', note, headingLevel = 'h3', className }: StudioFitOfferProps) {
  const studio = useStudio();
  if (!studio || parts.length === 0) return null;
  const quote = studioQuote(parts, studio.services);
  const Heading = headingLevel;

  return (
    <section aria-label="Get it fitted at our studio" className={cn('grid gap-3 border border-line p-4', className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-page">
          <Wrench className="size-4" />
        </span>
        <div className="grid min-w-0 gap-1">
          <Heading className="type-h3">Get it fitted at our studio</Heading>
          {quote.fitted.length > 0 ? (
            <p className="type-small text-muted">
              Our own team fits {quote.fitted.length === parts.length ? (parts.length === 1 ? 'this part' : `all ${parts.length} parts`) : `${quote.fitted.length} of the ${parts.length} parts`} in a slot you book.
              {quote.notFitted.length === 1 && ' The other part comes ready to use or to fit yourself.'}
              {quote.notFitted.length > 1 && ` The other ${quote.notFitted.length} parts come ready to use or to fit yourself.`}
            </p>
          ) : (
            <p className="type-small text-muted">None of these parts is on the studio's fitting list. You can still book a slot for another fitting service.</p>
          )}
        </div>
      </div>

      {quote.fitted.length > 0 && (
        <div className="grid gap-1 border-t border-line pt-3">
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-bold">Fitting</span>
            <span className="type-price tnum">{quote.charge > 0 ? formatINR(quote.charge) : 'Included'}</span>
          </p>
          <p className="type-small text-muted">
            {quote.charge > 0 ? 'GST included. ' : 'No fitting charge for these parts. '}
            {quote.services.length === 1 ? 'Service' : 'Services'}: {quote.services.map((service) => service.name).join('; ')}. You choose the day and
            time at checkout.
          </p>
        </div>
      )}

      {note && <div className="type-small text-muted">{note}</div>}

      <div className="flex flex-wrap gap-2">
        {onAddForFitting && quote.fitted.length > 0 && (
          <Button variant="dark" iconLeft={<Wrench />} onClick={onAddForFitting}>
            {addLabel}
          </Button>
        )}
        <Button to={BOOK_FITTING_PATH} variant="outline" iconLeft={<CalendarClock />}>
          Book a fitting slot
        </Button>
      </div>
    </section>
  );
}

/**
 * The fitting services for a kind of part (Light Lab's lamps), each with its charge and time, and the way to
 * book one. For pages that show categories of parts rather than a chosen set.
 */
export function StudioServiceOffer({ categorySlugs, intro, className }: { categorySlugs: readonly string[]; intro: string; className?: string }) {
  const studio = useStudio();
  if (!studio) return null;
  const services = studio.services.filter((service) => service.id !== 'consult' && service.subcategorySlugs.some((slug) => categorySlugs.includes(slug)));
  if (services.length === 0) return null;

  return (
    <section aria-label="Get it fitted at our studio" className={cn('grid gap-3 border border-line p-4', className)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-page">
          <Wrench className="size-4" />
        </span>
        <div className="grid min-w-0 gap-1">
          <h3 className="type-h3">Get it fitted at our studio</h3>
          <p className="type-small text-muted">{intro}</p>
        </div>
      </div>
      <ul className="grid border-t border-line">
        {services.map((service) => (
          <li key={service.id} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="grid gap-0.5">
              <span className="font-bold">{service.name}</span>
              {service.minutes > 0 && <span className="type-small text-muted">About {pluralize(service.minutes, 'minute')}</span>}
            </span>
            <span className="type-price tnum">{service.charge > 0 ? formatINR(service.charge) : 'Included'}</span>
          </li>
        ))}
      </ul>
      <p className="type-small text-muted">Fitting charges include GST. Ask for studio fitting on the parts in your cart, or book a slot for parts you already have.</p>
      <Button to={BOOK_FITTING_PATH} variant="outline" iconLeft={<CalendarClock />} className="justify-self-start">
        Book a fitting slot
      </Button>
    </section>
  );
}
