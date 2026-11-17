import { BadgeCheck, Car, CircleCheck, CircleHelp, CircleX, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { StickerChip } from '@/components/brand';
import { Button } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';
import type { BodyType, FitmentType, FitStatus, Vehicle } from '@/types/api';

/** What a fit verdict is read from. A ProductSummary, a ProductDetail and a PricedLine all satisfy it. */
export interface FitSubject {
  fit: FitStatus;
  fitNote?: string;
  fitVerified?: boolean;
  fitmentType?: FitmentType;
  categorySlug?: string;
  parentCategorySlug?: string;
}

type FitVehicle = Pick<Vehicle, 'model'> & Partial<Pick<Vehicle, 'label' | 'bodyType'>>;

export type FitState = 'direct' | 'with_work' | 'universal' | 'no' | 'unknown' | 'select';
type FitTone = 'fit' | 'warn' | 'stop' | 'info' | 'plain';

export interface FitDescription {
  state: FitState;
  tone: FitTone;
  /** The verdict in full: "Fits your Swift". */
  headline: string;
  /** The same verdict cut to fit a product card. */
  short: string;
  /** One more line: what work is needed, why it does not fit, what "universal" means here. '' when there is nothing to add. */
  detail: string;
  verified: boolean;
}

const BODY_WORDS: Record<BodyType, string> = {
  hatchback: 'hatchbacks',
  sedan: 'sedans',
  suv: 'SUVs',
  muv: 'MUVs',
  pickup: 'pickups',
  coupe: 'coupes',
};

const UNIVERSAL_DETAIL = 'Not made for one model. Check the size against your car before ordering.';

function universalDetail(subject: FitSubject, vehicle: FitVehicle | null, car: string): string {
  if (subject.fitmentType === 'pcd' && vehicle) return `Matches the bolt pattern of your ${car}.`;
  if (subject.fitmentType === 'body_type') {
    return vehicle?.bodyType ? `Made for ${BODY_WORDS[vehicle.bodyType]} such as your ${car}.` : 'Made for this body type.';
  }
  return UNIVERSAL_DETAIL;
}

/**
 * Turns a fit verdict into words. Returns null when fit is not a question for this product
 * (merchandise). Use it wherever a verdict is shown without the FitBadge box: a compare table, a cart line.
 */
export function describeFit(subject: FitSubject, vehicle: FitVehicle | null): FitDescription | null {
  if (subject.fitmentType === 'none') return null;
  const car = vehicle?.model || 'car';
  const verified = subject.fit === 'direct' && subject.fitVerified === true;

  switch (subject.fit) {
    case 'direct':
      return {
        state: 'direct',
        tone: 'fit',
        headline: `Fits your ${car}`,
        short: `Fits your ${car}`,
        detail: verified ? 'Checked on this model by the shop.' : 'Listed as a direct fit for this model. No modification needed.',
        verified,
      };
    case 'with_work':
      return {
        state: 'with_work',
        tone: 'warn',
        headline: 'Fits with work',
        short: 'Fits with work',
        detail: subject.fitNote || `It can be fitted to your ${car}, but not straight out of the box. Ask us what is involved.`,
        verified,
      };
    case 'universal':
      return {
        state: 'universal',
        tone: 'fit',
        headline: 'Universal fit',
        short: 'Universal fit',
        detail: universalDetail(subject, vehicle, car),
        verified,
      };
    case 'no':
      return {
        state: 'no',
        tone: 'stop',
        headline: `Does not fit your ${car}`,
        short: `Does not fit your ${car}`,
        detail: subject.fitNote ?? '',
        verified,
      };
    case 'unknown':
      return {
        state: 'unknown',
        tone: 'info',
        headline: `Not checked on your ${car} yet`,
        short: `Not checked on your ${car} yet: ask us`,
        detail: 'Ask us and we will check it. The answer is saved, so the store knows from then on.',
        verified,
      };
    default:
      // No car chosen. A universal part fits whatever the car is, so there is nothing to select.
      if (subject.fitmentType === 'universal') {
        return { state: 'universal', tone: 'fit', headline: 'Universal fit', short: 'Universal fit', detail: UNIVERSAL_DETAIL, verified };
      }
      return {
        state: 'select',
        tone: 'plain',
        headline: 'Select your car to check fit',
        short: 'Check fit for my car',
        detail: 'Tell us the make, model and year once. Every part then says whether it fits.',
        verified,
      };
  }
}

/** The listing of the same category narrowed to parts that fit the shopper's car. */
export function fitsPath(subject: Pick<FitSubject, 'categorySlug' | 'parentCategorySlug'>): string {
  const segments = [subject.parentCategorySlug, subject.categorySlug].filter(Boolean);
  return `/shop${segments.map((segment) => `/${segment}`).join('')}?fitOnly=1`;
}

const ICONS: Record<FitState, LucideIcon> = {
  direct: CircleCheck,
  with_work: Wrench,
  universal: CircleCheck,
  no: CircleX,
  unknown: CircleHelp,
  select: Car,
};

const TEXT: Record<FitTone, string> = {
  fit: 'text-fit',
  warn: 'text-warn',
  stop: 'text-stop',
  info: 'text-info',
  plain: 'text-ink',
};

const BOX: Record<FitTone, { box: string; flag: string }> = {
  fit: { box: 'border-fit bg-fit-soft', flag: 'bg-fit text-fit-ink' },
  warn: { box: 'border-warn bg-warn-soft', flag: 'bg-warn text-warn-ink' },
  stop: { box: 'border-stop bg-stop-soft', flag: 'bg-stop text-stop-ink' },
  info: { box: 'border-info bg-info-soft', flag: 'bg-info text-info-ink' },
  plain: { box: 'border-line-strong bg-surface', flag: 'bg-ink text-page' },
};

export interface FitBadgeProps {
  /** The product (or cart line) whose verdict to show. */
  product: FitSubject;
  /** `compact` is one line for cards and rows. `full` is the boxed verdict on the product page. */
  variant?: 'compact' | 'full';
  /** The car the verdict was worked out for. Defaults to the active garage car; pass it when a page names another one. */
  vehicle?: FitVehicle | null;
  /** `full` only: shows "Ask if this fits" when we have not checked this car yet. */
  onAsk?: () => void;
  className?: string;
}

/**
 * The fit verdict for the shopper's own car, always as an icon, words and a colour together.
 * With no car chosen it becomes the control that opens the car picker.
 */
export function FitBadge({ product, variant = 'compact', vehicle, onAsk, className }: FitBadgeProps) {
  const active = useActiveVehicle();
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const car = vehicle === undefined ? active : vehicle;
  const fit = describeFit(product, car);
  if (!fit) return null;

  const Icon = fit.verified ? BadgeCheck : ICONS[fit.state];

  if (variant === 'compact') {
    const text = 'text-[0.8125rem] leading-snug font-bold';
    if (fit.state === 'select') {
      return (
        <button
          type="button"
          onClick={openVehiclePicker}
          aria-haspopup="dialog"
          className={cn(
            'tap-44 z-raised inline-flex items-center gap-1.5 self-start text-left underline decoration-1 underline-offset-4 hover:decoration-2',
            text,
            className,
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          {fit.short}
        </button>
      );
    }
    return (
      <p className={cn('flex items-start gap-1.5', text, TEXT[fit.tone], className)} title={fit.detail || undefined}>
        <Icon aria-hidden className="mt-px size-4 shrink-0" />
        <span>
          {fit.short}
          {fit.verified && <span className="sr-only">, verified by the shop</span>}
        </span>
      </p>
    );
  }

  const { box, flag } = BOX[fit.tone];
  const carName = car?.model || 'car';

  return (
    <div aria-live="polite" data-paper="" className={cn('flex items-start gap-3 rounded-control border p-3 text-ink', box, className)}>
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-control [&_svg]:size-4', flag)}>
        <Icon aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 gap-1 pt-0.5">
        <p className="leading-snug font-bold">{fit.headline}</p>
        {car?.label && fit.state !== 'select' && <p className="type-small text-muted">{car.label}</p>}
        {fit.detail && <p className="type-small">{fit.detail}</p>}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 empty:hidden">
          {fit.verified && <StickerChip tone="fit">Shop verified</StickerChip>}
          {fit.state === 'no' && (
            <Link to={fitsPath(product)} className="link type-small font-bold">
              See parts that fit your {carName}
            </Link>
          )}
          {fit.state === 'unknown' && onAsk && (
            <Button size="sm" variant="dark" onClick={onAsk}>
              Ask if this fits
            </Button>
          )}
          {fit.state === 'select' ? (
            <Button size="sm" variant="dark" onClick={openVehiclePicker} aria-haspopup="dialog" iconLeft={<Car aria-hidden />}>
              Select your car
            </Button>
          ) : (
            car && (
              <Button variant="link" onClick={openVehiclePicker} aria-haspopup="dialog" className="[--button-text:0.875rem]">
                Change car
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
