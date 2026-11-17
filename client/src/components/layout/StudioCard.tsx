import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CalendarCheck, Clock3, CreditCard, MapPin, Phone } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from '@/components/brand';
import { cn } from '@/lib/cn';
import { waLink } from '@/lib/whatsapp';
import type { PublicSettings } from '@/types/api';
import { emiLabel, instagramHandle, storePhones, studioAddress, telHref } from './storeContact';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** "9:30 am" → minutes after midnight, or null. */
function minutesOf(text: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(text.trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3]!.toLowerCase() === 'pm') hour += 12;
  return hour * 60 + Number(m[2] ?? 0);
}

/**
 * Reads hours written the way the shop writes them ("Mon to Sat 9:30 am to 8 pm, Sun 10 am to 2 pm")
 * into opening times per weekday. Anything it cannot read is left out, so the badge simply does not show.
 */
function parseHours(text: string): Map<number, [number, number]> {
  const week = new Map<number, [number, number]>();
  for (const part of text.split(/[,;|]/)) {
    const m = /^\s*([a-z]{3})[a-z]*(?:\s*(?:to|-|–)\s*([a-z]{3})[a-z]*)?\s*:?\s*(.+?)\s*(?:to|-|–)\s*(.+?)\s*$/i.exec(part);
    if (!m) continue;
    const from = DAYS.indexOf(m[1]!.toLowerCase());
    const to = m[2] ? DAYS.indexOf(m[2].toLowerCase()) : from;
    const open = minutesOf(m[3]!);
    const close = minutesOf(m[4]!);
    if (from < 0 || to < 0 || open === null || close === null) continue;
    for (let d = from; ; d = (d + 1) % 7) {
      week.set(d, [open, close]);
      if (d === to) break;
    }
  }
  return week;
}

/** Open now? Worked out in India time, whatever the visitor's clock says. Null when the hours cannot be read. */
function useOpenNow(hours: string): { open: boolean; until: string } | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const week = parseHours(hours);
  if (week.size === 0) return null;
  const ist = new Date(now + (330 + new Date(now).getTimezoneOffset()) * 60_000);
  const today = week.get(ist.getDay());
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  if (today && minutes >= today[0] && minutes < today[1]) {
    const h = Math.floor(today[1] / 60);
    const m = today[1] % 60;
    return { open: true, until: `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'pm' : 'am'}` };
  }
  return { open: false, until: '' };
}

const row = 'inline-flex items-start gap-2.5 py-1 hover:underline hover:decoration-1 hover:underline-offset-4';
const icon = 'mt-0.5 size-4 shrink-0 text-brand';

/** The shop and studio as a plain footer column: open-now status, phones, WhatsApp, Instagram, hours, EMI, booking. */
export function StudioCard({ settings }: { settings: PublicSettings }) {
  const phones = storePhones(settings);
  const wa = settings.whatsapp ? waLink(settings.whatsapp, `Hi ${settings.storeName}, `) : '';
  const instagram = settings.social.instagram.trim();
  const address = studioAddress(settings);
  const status = useOpenNow(settings.businessHours);
  const emi = settings.emi.enabled ? emiLabel(settings) : '';

  return (
    <section aria-label="The shop and studio" className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-label text-muted">Visit the studio</h2>
        {status && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-bold',
              status.open ? 'bg-fit-soft text-fit' : 'bg-surface-2 text-muted',
            )}
          >
            <span className={cn('size-1.5 rounded-full', status.open ? 'animate-pulse bg-fit' : 'bg-muted')} />
            {status.open ? `Open till ${status.until}` : 'Closed now'}
          </span>
        )}
      </div>
      <p className="font-bold">{settings.legalName || settings.storeName}</p>

      <ul className="grid">
        {phones.map((phone) => (
          <li key={phone}>
            <a href={telHref(phone)} className={cn(row, 'tnum')}>
              <Phone aria-hidden className={icon} />
              {phone}
            </a>
          </li>
        ))}
        {wa && (
          <li>
            <a href={wa} target="_blank" rel="noopener noreferrer" className={row}>
              <WhatsAppIcon size={16} className="mt-0.5 shrink-0 text-[#1fa855]" />
              Chat on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        )}
        {instagram && (
          <li>
            <a href={instagram} target="_blank" rel="noopener noreferrer" className={row}>
              <InstagramIcon size={16} className="mt-0.5 shrink-0 text-[#d62976]" />
              {instagramHandle(instagram)}
              <span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
          </li>
        )}
      </ul>

      <ul className="type-small grid gap-2 text-muted">
        {settings.businessHours && (
          <li className="flex gap-2.5">
            <Clock3 aria-hidden className={icon} />
            {settings.businessHours}
          </li>
        )}
        {address && (
          <li className="flex gap-2.5">
            <MapPin aria-hidden className={icon} />
            {settings.studio.mapUrl ? (
              <a href={settings.studio.mapUrl} target="_blank" rel="noopener noreferrer" className="link">
                {address}
              </a>
            ) : (
              address
            )}
          </li>
        )}
        {emi && (
          <li className="flex gap-2.5">
            <CreditCard aria-hidden className={icon} />
            {emi}
          </li>
        )}
      </ul>

      {settings.studio.enabled && (
        <Link to="/book-fitting" className="inline-flex w-fit items-center gap-2 py-1 font-bold text-brand-text hover:underline hover:underline-offset-4">
          <CalendarCheck aria-hidden className="size-4" />
          Book a fitting slot
        </Link>
      )}
    </section>
  );
}
