import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, type ButtonSize, type ButtonVariant } from './Button';

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard permission refused or not a secure context: fall through to the selection method.
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

export interface CopyButtonProps {
  /** The text that lands on the clipboard. */
  value: string;
  /** Button text, e.g. "Copy code", "Copy link". */
  label?: string;
  copiedLabel?: string;
  /**
   * `button` is a plain button. `code` shows the value itself in Martian Mono with the button attached:
   * for a coupon code, an order number, a UPI ID.
   */
  variant?: 'button' | 'code';
  buttonVariant?: ButtonVariant;
  size?: ButtonSize;
  onCopied?: () => void;
  className?: string;
}

/** Copies a value and confirms it in place for two seconds. The confirmation is also announced. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  variant = 'button',
  buttonVariant = 'outline',
  size = 'sm',
  onCopied,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const button = (
    <Button
      variant={variant === 'code' ? 'dark' : buttonVariant}
      size={size}
      onClick={copy}
      iconLeft={copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      className={cn(variant === 'code' ? 'rounded-l-none' : className)}
    >
      {copied ? copiedLabel : label}
      <span aria-live="polite" className="sr-only">
        {copied ? `${copiedLabel}: ${value}` : ''}
      </span>
    </Button>
  );

  if (variant === 'button') return button;

  return (
    <span className={cn('inline-flex max-w-full items-stretch', className)}>
      <span className="type-code flex min-w-0 items-center truncate rounded-l-control border border-r-0 border-dashed border-line-strong bg-surface px-3 text-ink select-all">
        {value}
      </span>
      {button}
    </span>
  );
}
