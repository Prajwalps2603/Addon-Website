import type { ReactNode } from 'react';
import { WhatsAppIcon } from '@/components/brand';
import { Button, IconButton, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { waLink, waShareLink } from '@/lib/whatsapp';

export interface WhatsAppButtonProps {
  /** The message that is ready to send when WhatsApp opens. Build it with the helpers in `@/lib/whatsapp`. */
  text?: string;
  /**
   * `store` opens a chat with the shop. `share` opens WhatsApp with the message written and lets the
   * shopper pick who gets it ("Ask the gang", "Send cart to payer").
   */
  to?: 'store' | 'share';
  /** The label. Defaults to "Chat on WhatsApp", or "Share on WhatsApp" when sharing. */
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows only the icon. The label becomes the accessible name. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * A link that opens WhatsApp. It renders nothing until the store has set a WhatsApp number
 * in Admin, Settings: a store that is not on WhatsApp shows no WhatsApp controls at all.
 */
export function WhatsAppButton({ text = '', to = 'store', children, variant = 'outline', size = 'md', block = false, iconOnly = false, className }: WhatsAppButtonProps) {
  const whatsapp = useSettings().data?.whatsapp ?? '';
  const storeLink = waLink(whatsapp, text);
  if (!storeLink) return null;

  const href = to === 'share' ? waShareLink(text) : storeLink;
  const label = children ?? (to === 'share' ? 'Share on WhatsApp' : 'Chat on WhatsApp');
  const link = { href, target: '_blank', rel: 'noopener noreferrer' } as const;

  if (iconOnly) {
    return (
      <IconButton {...link} label={typeof label === 'string' ? label : 'WhatsApp'} variant={variant} size={size} className={className}>
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
