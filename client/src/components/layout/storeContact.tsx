import type { ReactNode } from 'react';
import { Clock, CreditCard, MapPin, Phone } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from '@/components/brand';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';
import type { PublicSettings, StudioService, StudioSettings } from '@/types/api';

/** The store's phone numbers as written in settings: the main one first, blanks and repeats left out. */
export function storePhones(settings: Pick<PublicSettings, 'phone' | 'phones'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [settings.phone, ...(settings.phones ?? [])]) {
    const phone = (raw ?? '').trim();
    const key = phone.replace(/\D/g, '');
    if (!phone || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(phone);
  }
  return out;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** '13:00' → '1 pm', '11:30' → '11:30 am', '' for anything that is not a time. */
export function slotTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return '';
  const h = Number(match[1]);
  const m = match[2];
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === '00' ? `${h12} ${suffix}` : `${h12}:${m} ${suffix}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "10 am, 11:30 am, 1 pm and 2:30 pm" */
function listTimes(slots: string[]): string {
  const times = slots.map(slotTime).filter(Boolean);
  if (times.length <= 1) return times.join('');
  return `${times.slice(0, -1).join(', ')} and ${times[times.length - 1]}`;
}

/** The studio's slot rules as short sentences, from settings only. */
export function slotSentences(studio: StudioSettings): string[] {
  const out: string[] = [];
  const times = listTimes(studio.slots);
  if (times) out.push(`Slots start at ${times}.`);
  if (studio.carsPerSlot > 0) out.push(`We take ${studio.carsPerSlot} ${studio.carsPerSlot === 1 ? 'car' : 'cars'} in each slot.`);
  const closed = studio.closedWeekdays.filter((day) => day >= 0 && day <= 6).map((day) => WEEKDAYS[day]);
  if (closed.length > 0) out.push(`Closed on ${closed.join(' and ')}.`);
  if (studio.sundayLastSlot && !studio.closedWeekdays.includes(0)) {
    out.push(`Sunday is a half day: the last slot starts at ${slotTime(studio.sundayLastSlot)}.`);
  }
  if (studio.minNoticeMinutes > 0) {
    const notice = minutesLabel(studio.minNoticeMinutes);
    out.push(`Same-day slots need ${notice === '1 hr' ? 'an hour' : notice} of notice.`);
  }
  if (studio.maxDaysAhead > 0) out.push(`Book up to ${studio.maxDaysAhead} days ahead.`);
  return out;
}

/** "₹799"; "Free" for the consultation; "No extra charge" for a service whose fitting comes with the part (film). */
export function serviceCharge(service: StudioService): string {
  if (service.charge > 0) return formatINR(service.charge);
  return service.id === 'consult' ? 'Free' : 'No extra charge';
}

/** The studio address: the studio's own block when set, else the store's postal address. '' when neither is set. */
export function studioAddress(settings: Pick<PublicSettings, 'studio' | 'address'>): string {
  const own = settings.studio?.address?.trim() ?? '';
  if (own) return own;
  const { line1, line2, city, state, pincode } = settings.address;
  const cityLine = [city, state].filter((part) => part.trim()).join(', ');
  return [line1, line2, [cityLine, pincode].filter((part) => part.trim()).join(' ')]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

/** "EMI with Bajaj Finserv" while EMI is switched on and a partner is named, else ''. */
export function emiLabel(settings: Pick<PublicSettings, 'emi'>): string {
  const emi = settings.emi;
  if (!emi?.enabled) return '';
  return emi.partner.trim() ? `EMI with ${emi.partner.trim()}` : 'EMI available';
}

/** True when the studio takes bookings and has at least one service to book. */
export function studioOpen(settings: Pick<PublicSettings, 'studio' | 'services'>): boolean {
  return Boolean(settings.studio?.enabled) && (settings.services?.length ?? 0) > 0;
}

/**
 * The ways to reach the shop, each only when it is set: phones, WhatsApp, Instagram, hours, the
 * studio address with its map link, and the EMI line. `compact` is the one-line strip above the header.
 */
export function StoreContact({
  settings,
  compact = false,
  showAddress = true,
  className,
}: {
  settings: PublicSettings;
  compact?: boolean;
  showAddress?: boolean;
  className?: string;
}) {
  const phones = storePhones(settings);
  const whatsapp = waLink(settings.whatsapp, 'Hi, I have a question.');
  const instagram = settings.social.instagram.trim();
  const hours = settings.businessHours.trim();
  const address = showAddress ? studioAddress(settings) : '';
  const mapUrl = settings.studio?.mapUrl?.trim() ?? '';
  const emi = emiLabel(settings);

  if (compact) {
    return (
      <ul className={cn('flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1', className)}>
        {phones.length > 0 && (
          <li className="flex items-center gap-1.5">
            <Phone aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Call</span>
            {phones.map((phone, index) => (
              <span key={phone} className="flex items-center gap-1.5">
                {index > 0 && <span aria-hidden className="text-muted">/</span>}
                <a href={telHref(phone)} className="tnum hover:underline hover:underline-offset-4">
                  {phone}
                </a>
              </span>
            ))}
          </li>
        )}
        {whatsapp && (
          <li>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline hover:underline-offset-4">
              <WhatsAppIcon size={16} />
              WhatsApp<span className="sr-only"> (opens WhatsApp)</span>
            </a>
          </li>
        )}
        {instagram && (
          <li>
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline hover:underline-offset-4">
              <InstagramIcon size={16} />
              Instagram<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        )}
        {hours && (
          <li className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Open </span>
            {hours}
          </li>
        )}
        {emi && (
          // Below 1280 px the strip keeps to one line; the EMI partner is still in the footer and the menu.
          <li className="hidden items-center gap-1.5 xl:flex">
            <CreditCard aria-hidden className="size-4 shrink-0" />
            {emi}
          </li>
        )}
      </ul>
    );
  }

  return (
    <dl className={cn('type-small grid gap-2', className)}>
      {phones.length > 0 && (
        <Row term="Call" icon={<Phone aria-hidden className="size-4" />}>
          <span className="grid">
            {phones.map((phone) => (
              <a key={phone} href={telHref(phone)} className="link w-fit tnum">
                {phone}
              </a>
            ))}
          </span>
        </Row>
      )}
      {whatsapp && (
        <Row term="WhatsApp" icon={<WhatsAppIcon size={16} />}>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="link w-fit">
            Message us<span className="sr-only"> on WhatsApp (opens WhatsApp)</span>
          </a>
        </Row>
      )}
      {instagram && (
        <Row term="Instagram" icon={<InstagramIcon size={16} />}>
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="link w-fit break-all">
            {instagramHandle(instagram)}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Row>
      )}
      {hours && (
        <Row term="Hours" icon={<Clock aria-hidden className="size-4" />}>
          {hours}
        </Row>
      )}
      {address && (
        <Row term="Studio" icon={<MapPin aria-hidden className="size-4" />}>
          <address className="not-italic whitespace-pre-line">{address}</address>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="link w-fit font-bold">
              Open in Maps<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </Row>
      )}
      {!address && mapUrl && (
        <Row term="Studio" icon={<MapPin aria-hidden className="size-4" />}>
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="link w-fit font-bold">
            Find the studio on the map<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Row>
      )}
      {emi && (
        <Row term="EMI" icon={<CreditCard aria-hidden className="size-4" />}>
          {settings.emi.note.trim() || emi}
        </Row>
      )}
    </dl>
  );
}

/** '@addonautomotive' from an Instagram profile address; the address itself when it does not look like one. */
export function instagramHandle(url: string): string {
  const match = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(url);
  return match ? `@${match[1]}` : url;
}

function Row({ term, icon, children }: { term: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2">
      <dt className="mt-0.5 text-muted">
        {icon}
        <span className="sr-only">{term}</span>
      </dt>
      <dd className="grid gap-0.5">{children}</dd>
    </div>
  );
}
