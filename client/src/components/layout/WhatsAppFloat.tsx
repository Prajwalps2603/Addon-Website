import { useLocation } from 'react-router';
import { WhatsAppIcon } from '@/components/brand';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { siteUrl } from '@/lib/urls';
import { waLink } from '@/lib/whatsapp';

/**
 * The floating WhatsApp button, bottom right, clear of the phone's bottom bar and safe area.
 * The message names the page the shopper was on. Nothing at all while no number is set.
 */
export function WhatsAppFloat({ className }: { className?: string }) {
  const { data } = useSettings();
  const { pathname } = useLocation();
  const href = waLink(data?.whatsapp, `Hi, I have a question.\n${siteUrl(pathname)}`);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the shop on WhatsApp (opens WhatsApp)"
      data-print="hide"
      style={{ bottom: 'calc(var(--bottom-bar-h) + env(safe-area-inset-bottom) + 1rem)' }}
      className={cn(
        'group fixed right-4 z-floating inline-flex size-13 items-center justify-center gap-2 rounded-full bg-ink text-page shadow-pop print:hidden',
        'transition-[background-color,transform] dur-quick hover:bg-ink-2 active:scale-[0.96] md:right-6',
        className,
      )}
    >
      <WhatsAppIcon size={24} />
    </a>
  );
}
