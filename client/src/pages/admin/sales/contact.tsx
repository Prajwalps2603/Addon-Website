import { Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand';
import { Button, IconButton, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { normalizePhone } from '@/lib/india';
import { waLink } from '@/lib/whatsapp';

/** WhatsApp is switched on for the store only once a number is set in Settings. */
export function useWhatsAppOn(): boolean {
  return Boolean(useSettings().data?.whatsapp);
}

/** wa.me link to a customer, or '' when the store has no WhatsApp or the record has no usable phone. */
export function useCustomerWaLink(phone: string | null | undefined, text: string): string {
  const on = useWhatsAppOn();
  return on ? waLink(phone, text) : '';
}

export interface CustomerWhatsAppProps {
  phone: string | null | undefined;
  text?: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  block?: boolean;
  className?: string;
}

/** Opens a chat with a customer with the message written. Renders nothing without a phone or a store WhatsApp number. */
export function CustomerWhatsApp({ phone, text = '', label = 'WhatsApp', variant = 'outline', size = 'sm', iconOnly = false, block, className }: CustomerWhatsAppProps) {
  const href = useCustomerWaLink(phone, text);
  if (!href) return null;
  const link = { href, target: '_blank', rel: 'noopener noreferrer' } as const;
  if (iconOnly) {
    return (
      <IconButton {...link} label={label} variant={variant} size={size} className={className}>
        <WhatsAppIcon />
      </IconButton>
    );
  }
  return (
    <Button {...link} variant={variant} size={size} block={block} iconLeft={<WhatsAppIcon />} className={className}>
      {label}
    </Button>
  );
}

/** tel: link for a ten digit Indian number. Renders nothing without a usable phone. */
export function CallButton({ phone, label = 'Call', iconOnly = false, size = 'sm', variant = 'outline' }: { phone: string | null | undefined; label?: string; iconOnly?: boolean; size?: ButtonSize; variant?: ButtonVariant }) {
  const digits = normalizePhone(phone ?? '');
  if (!digits) return null;
  const href = `tel:+91${digits}`;
  if (iconOnly) {
    return (
      <IconButton href={href} label={`${label} ${digits}`} variant={variant} size={size}>
        <Phone aria-hidden />
      </IconButton>
    );
  }
  return (
    <Button href={href} variant={variant} size={size} iconLeft={<Phone aria-hidden />}>
      {label}
    </Button>
  );
}
