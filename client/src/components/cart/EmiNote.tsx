import { Landmark } from 'lucide-react';
import { storePhones } from '@/components/studio';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export interface EmiNoteProps {
  /** The order total the shopper is looking at. */
  total: number;
  className?: string;
}

/**
 * EMI as information only: the finance partner, the minimum, and how to apply (at the studio or on a
 * call). Nothing is applied for online. Renders nothing while EMI is off in settings.
 */
export function EmiNote({ total, className }: EmiNoteProps) {
  const settings = useSettings().data;
  const emi = settings?.emi;
  if (!settings || !emi?.enabled) return null;
  const partner = emi.partner.trim();
  const phones = storePhones(settings);
  const eligible = total >= emi.minAmount;
  const note = emi.note.trim();

  return (
    <section aria-label="EMI" className={cn('grid gap-1.5 border border-line p-3', className)}>
      <p className="flex items-start gap-2 font-bold">
        <Landmark aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>{partner ? `EMI through ${partner}` : 'EMI available'}</span>
      </p>
      <p className="type-small text-muted">
        {eligible
          ? emi.minAmount > 0
            ? `This order qualifies: EMI is offered on orders from ${formatINR(emi.minAmount)}.`
            : 'This order can be paid in EMIs.'
          : `EMI is offered on orders from ${formatINR(emi.minAmount)}. This one is ${formatINR(emi.minAmount - total)} short.`}{' '}
        {note || 'Apply at the studio or on a call with us; it is not part of paying online here.'}
      </p>
      {eligible && phones.length > 0 && (
        <p className="type-small">
          Call{' '}
          {phones.map((phone, index) => (
            <span key={phone}>
              {index > 0 && (index === phones.length - 1 ? ' or ' : ', ')}
              <a href={telHref(phone)} className="link font-bold tnum">
                {phone}
              </a>
            </span>
          ))}{' '}
          to ask about a plan.
        </p>
      )}
    </section>
  );
}
