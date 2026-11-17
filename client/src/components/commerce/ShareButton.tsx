import type { ReactNode } from 'react';
import { Share2 } from 'lucide-react';
import { Button, IconButton, toast, type ButtonSize, type ButtonVariant } from '@/components/ui';

export interface ShareButtonProps {
  /** The address to share. Defaults to the page being viewed. A path such as '/p/slug' is made absolute. */
  url?: string;
  /** The name of the thing shared: a product name, "My build". */
  title?: string;
  /** A line to go with the link, where the receiving app takes one. */
  text?: string;
  /** The label. Defaults to "Share". */
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows only the icon. The label becomes the accessible name. */
  iconOnly?: boolean;
  className?: string;
}

function absoluteUrl(url: string | undefined): string {
  if (!url) return window.location.href;
  try {
    return new URL(url, window.location.origin).href;
  } catch {
    return window.location.href;
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard permission refused, or not a secure context: fall through to the selection method.
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

/**
 * Opens the phone's own share sheet (WhatsApp, Instagram, Messages) where the browser has one,
 * and copies the link everywhere else.
 */
export function ShareButton({ url, title, text, children = 'Share', variant = 'outline', size = 'md', iconOnly = false, className }: ShareButtonProps) {
  const share = async () => {
    const link = absoluteUrl(url);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url: link, ...(title ? { title } : {}), ...(text ? { text } : {}) });
        return;
      } catch (error) {
        // Closing the share sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    if (await copyText(link)) toast.success('Link copied', { id: 'share' });
    else toast.error('Could not copy the link', { description: link, id: 'share' });
  };

  if (iconOnly) {
    return (
      <IconButton label={typeof children === 'string' ? children : 'Share'} variant={variant} size={size} onClick={share} className={className}>
        <Share2 aria-hidden />
      </IconButton>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={share} iconLeft={<Share2 aria-hidden />} className={className}>
      {children}
    </Button>
  );
}
