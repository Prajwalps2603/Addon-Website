import type { ReactNode } from 'react';
import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

const TONES = {
  /** Fitment confirmed by the shop. */
  fit: 'bg-fit text-fit-ink',
  /** Paperwork facts: invoice, warranty. */
  ink: 'bg-ink text-page',
  /** Payment and delivery facts: COD, free delivery, EMI. Tread Red. */
  brand: 'bg-brand text-brand-ink',
  /** Deprecated name of `brand`. */
  pit: 'bg-brand text-brand-ink',
  /** On a coloured ground. */
  paper: 'bg-frame text-frame-ink',
} as const;

export interface StickerChipProps {
  /** The verified fact, four words or fewer: "Fits Swift 2018 to 2023", "Invoice + warranty". */
  children: ReactNode;
  tone?: keyof typeof TONES;
  /** Replaces the default tick. Pass null for no icon. */
  icon?: ReactNode;
  /** `round` is a disc for a reading of one to three characters, such as "COD". */
  shape?: 'lozenge' | 'round';
  /** Sits a few degrees off level, like a sticker pressed on by hand. For stickers on a product frame. */
  tilt?: boolean;
  /** Plays the small press-on pop once when it appears (after an action, not on page load). */
  pop?: boolean;
  className?: string;
}

/**
 * The scrutineering sticker: a fact the shop has checked and stands behind.
 * A sticker with nothing true behind it is not printed. For ordinary status use Badge.
 */
export function StickerChip({
  children,
  tone = 'fit',
  icon,
  shape = 'lozenge',
  tilt = false,
  pop = false,
  className,
}: StickerChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full type-label whitespace-nowrap print-exact',
        // The keyline set in from the edge is what makes it read as a printed sticker.
        'outline-1 -outline-offset-[3px] outline-current/45',
        shape === 'round' ? 'size-11 text-[0.6875rem]' : 'h-7 pr-3 pl-2',
        TONES[tone],
        tilt && '-rotate-3',
        pop && 'animate-sticker',
        className,
      )}
    >
      {shape === 'lozenge' && (icon === undefined ? <BadgeCheck aria-hidden className="size-4 shrink-0" /> : icon)}
      {children}
    </span>
  );
}
