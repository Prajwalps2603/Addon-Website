import type { ReactNode } from 'react';
import { ArrowRight, BadgeCheck, Clock, CreditCard, ExternalLink, Mail, MapPin, MessageSquareWarning, Phone, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { InstagramIcon, WhatsAppIcon } from '@/components/brand';
import { emiLabel, instagramHandle, storePhones, studioAddress } from '@/components/layout/storeContact';
import { Callout } from '@/components/ui';
import { waLink } from '@/lib/whatsapp';
import type { PublicSettings } from '@/types/api';
import { addressLines, businessName, clean, phoneParts } from './storeFacts';

/* ------------------------------------------------------------------ one contact line */

interface LineProps {
  Icon: LucideIcon | typeof WhatsAppIcon;
  label: string;
  children: ReactNode;
}

function ContactLine({ Icon, label, children }: LineProps) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-3">
      <dt className="contents">
        <Icon aria-hidden className="mt-0.5 size-5 text-muted" />
        <span className="type-small text-muted">{label}</span>
      </dt>
      <dd className="col-start-2 grid min-w-0 gap-0.5 break-words">{children}</dd>
    </div>
  );
}

/** True when the store has published at least one way to reach it besides the form. */
export function hasDirectContact(settings: PublicSettings): boolean {
  return Boolean(
    storePhones(settings).length > 0 || waLink(settings.whatsapp) || clean(settings.email) || addressLines(settings).length > 0 || studioAddress(settings),
  );
}

/**
 * The store's phones, WhatsApp, Instagram, email, studio address with its map link, hours and EMI.
 * Blank settings are left out, and a store with none of them set shows nothing at all.
 */
export function StoreContactList({ settings, className }: { settings: PublicSettings; className?: string }) {
  const phones = storePhones(settings)
    .map(phoneParts)
    .filter((phone): phone is NonNullable<typeof phone> => phone !== null);
  const whatsapp = waLink(settings.whatsapp);
  const instagram = clean(settings.social.instagram);
  const email = clean(settings.email);
  const studio = studioAddress(settings);
  const postal = addressLines(settings);
  const mapUrl = clean(settings.studio.mapUrl);
  const hours = clean(settings.businessHours);
  const emi = emiLabel(settings);
  if (phones.length === 0 && !whatsapp && !instagram && !email && !studio && !mapUrl && !hours) return null;

  return (
    <dl className={className ? `divide-y divide-line ${className}` : 'divide-y divide-line'}>
      {phones.length > 0 && (
        <ContactLine Icon={Phone} label={phones.length > 1 ? 'Phones' : 'Phone'}>
          {phones.map((phone) => (
            <a key={phone.href} href={phone.href} className="link w-fit tnum font-bold">
              {phone.label}
            </a>
          ))}
        </ContactLine>
      )}
      {whatsapp && (
        <ContactLine Icon={WhatsAppIcon} label="WhatsApp">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="link w-fit font-bold">
            Message us on WhatsApp
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        </ContactLine>
      )}
      {instagram && (
        <ContactLine Icon={InstagramIcon} label="Instagram">
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="link w-fit font-bold">
            {instagramHandle(instagram)}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </ContactLine>
      )}
      {email && (
        <ContactLine Icon={Mail} label="Email">
          <a href={`mailto:${email}`} className="link w-fit font-bold">
            {email}
          </a>
        </ContactLine>
      )}
      {(studio || mapUrl) && (
        <ContactLine Icon={MapPin} label="Studio">
          {studio && (
            <address className="not-italic">
              {businessName(settings)}
              <span className="block whitespace-pre-line">{studio}</span>
            </address>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="link inline-flex w-fit items-center gap-1.5 font-bold">
              Open in Maps
              <ExternalLink aria-hidden className="size-4" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </ContactLine>
      )}
      {postal.length > 0 && clean(settings.studio.address) && (
        <ContactLine Icon={Mail} label="Postal address">
          <address className="not-italic">
            {postal.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </ContactLine>
      )}
      {hours && (
        <ContactLine Icon={Clock} label="Hours">
          {hours}
        </ContactLine>
      )}
      {emi && (
        <ContactLine Icon={CreditCard} label="EMI">
          {clean(settings.emi.note) || emi}
        </ContactLine>
      )}
    </dl>
  );
}

/* ------------------------------------------------------------------ grievance officer */

/**
 * The grievance officer, as the Consumer Protection (E-Commerce) Rules ask: name and contact,
 * the 48-hour acknowledgement and one-month resolution, the ticket route, and the national helpline.
 * Blank officer details fall back to the store's own email and phone, and then to the form alone.
 */
export function GrievanceBlock({ settings, headingLevel: Heading = 'h2', id }: { settings: PublicSettings; headingLevel?: 'h2' | 'h3'; id?: string }) {
  const officer = settings.grievanceOfficer;
  const name = clean(officer.name);
  const email = clean(officer.email) || clean(settings.email);
  const phone = phoneParts(clean(officer.phone) || settings.phone);
  const headingId = id ? `${id}-title` : undefined;
  const row =
    'group/row flex items-center gap-3 rounded-[14px] border border-line bg-raised px-3.5 py-3 transition-colors hover:border-line-strong';
  const badge = 'grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink';

  return (
    <section id={id} aria-labelledby={headingId} className="grid scroll-mt-24 content-start gap-5 rounded-[20px] bg-surface p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
          <ShieldCheck className="size-5" />
        </span>
        <div className="grid gap-1">
          <Heading id={headingId} className="text-lg leading-snug font-bold">
            Complaints and the grievance officer
          </Heading>
          <p className="text-sm text-muted">Not happy with an order, a refund or how we handled something? Raise it as a complaint.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-semibold">
          <Clock aria-hidden className="size-3.5 text-brand-text" />
          Acknowledged in 48 hours
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-semibold">
          <BadgeCheck aria-hidden className="size-3.5 text-brand-text" />
          Resolved within a month
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-xs font-semibold">
          <Ticket aria-hidden className="size-3.5 text-brand-text" />
          Ticket number for each
        </span>
      </div>

      <div className="grid gap-2">
        {name && (
          <p className="px-1 text-sm">
            <span className="text-muted">Grievance officer: </span>
            <span className="font-bold">{name}</span>
          </p>
        )}
        <Link to="/contact?kind=complaint" className={row}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
            <MessageSquareWarning aria-hidden className="size-4" />
          </span>
          <span className="grid min-w-0 flex-1">
            <span className="font-bold">Raise a complaint</span>
            <span className="text-xs text-muted">In writing, with a ticket number</span>
          </span>
          <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover/row:translate-x-0.5" />
        </Link>
        {phone && (
          <a href={phone.href} className={row}>
            <span className={badge}>
              <Phone aria-hidden className="size-4" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="font-bold tnum">{phone.label}</span>
              <span className="text-xs text-muted">Call us</span>
            </span>
            <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover/row:translate-x-0.5" />
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} className={row}>
            <span className={badge}>
              <Mail aria-hidden className="size-4" />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-bold">{email}</span>
              <span className="text-xs text-muted">Email us</span>
            </span>
            <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover/row:translate-x-0.5" />
          </a>
        )}
      </div>

      <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
        Still not resolved? Call the National Consumer Helpline on{' '}
        <a href="tel:1915" className="font-bold text-ink underline underline-offset-2 tnum">
          1915
        </a>{' '}
        or file it at{' '}
        <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink underline underline-offset-2">
          consumerhelpline.gov.in
          <ExternalLink aria-hidden className="size-3" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        .
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ draft note */

/** Shown only while the store still holds sample data: a reminder to the owner that this text is a draft. */
export function OwnerReviewNote({ settings }: { settings: PublicSettings }) {
  if (!settings.hasDemoData) return null;
  return (
    <Callout tone="warn" title="Draft for the owner to review">
      This page is written from how the store is set up today. Before launch, read it against how you actually work, change what does not
      match, and have it checked by your lawyer. This note goes away once the sample data is cleared in Admin.
    </Callout>
  );
}
