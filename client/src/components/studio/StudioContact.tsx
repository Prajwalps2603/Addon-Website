import { Clock, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { PublicSettings } from '@/types/api';

export interface StudioContactProps {
  settings: PublicSettings;
  /** Show the studio address and map link (when the owner has set them). Default true. */
  showAddress?: boolean;
  className?: string;
}

/** 'tel:' link for a number written for display: '+91 89211 68071' → 'tel:+918921168071'. */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

/** Every phone the store lists, the main one first, without repeats. */
export function storePhones(settings: Pick<PublicSettings, 'phone' | 'phones'>): string[] {
  return [...new Set([settings.phone, ...settings.phones].map((phone) => phone.trim()).filter(Boolean))];
}

/**
 * Where the studio is and how to reach it, from settings only. Anything the owner has not filled in
 * (address, map) is left out rather than guessed.
 */
export function StudioContact({ settings, showAddress = true, className }: StudioContactProps) {
  const phones = storePhones(settings);
  const address = settings.studio.address.trim();
  const mapUrl = settings.studio.mapUrl.trim();

  return (
    <div className={cn('grid gap-4', className)}>
      {showAddress && (address || mapUrl) && (
        <div className="flex items-start gap-3">
          <MapPin aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="grid gap-2">
            {address && <p className="type-body whitespace-pre-line">{address}</p>}
            {mapUrl && (
              <div>
                <Button variant="outline" size="sm" href={mapUrl} target="_blank" rel="noopener noreferrer" iconLeft={<MapPin aria-hidden />}>
                  Open the map
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {settings.businessHours && (
        <div className="flex items-start gap-3">
          <Clock aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p className="type-body">{settings.businessHours}</p>
        </div>
      )}
      {phones.length > 0 && (
        <div className="flex items-start gap-3">
          <Phone aria-hidden className="mt-0.5 size-5 shrink-0" />
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {phones.map((phone) => (
              <li key={phone}>
                <a href={telHref(phone)} className="link type-body font-bold tnum">
                  {phone}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
