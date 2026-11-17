import { Banknote, CreditCard, Landmark, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type PaymentKind = 'upi' | 'card' | 'netbanking' | 'cod';

const MARKS: Record<PaymentKind, { label: string; name: string; Icon: LucideIcon | null }> = {
  upi: { label: 'UPI', name: 'UPI', Icon: null },
  card: { label: 'Cards', name: 'Credit and debit cards', Icon: CreditCard },
  netbanking: { label: 'Netbanking', name: 'Netbanking', Icon: Landmark },
  cod: { label: 'COD', name: 'Cash on delivery', Icon: Banknote },
};

export interface PaymentMarkProps {
  kind: PaymentKind;
  /** Hide the word and keep the glyph (UPI always shows its letters). */
  compact?: boolean;
  className?: string;
}

/**
 * A neutral mark for a way to pay. These are our own plain tiles, not the logos of any
 * bank, network or app: the store shows what it accepts without borrowing a brand.
 */
export function PaymentMark({ kind, compact = false, className }: PaymentMarkProps) {
  const { label, name, Icon } = MARKS[kind];
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1 rounded-control border border-line-strong bg-raised px-1.5 text-ink',
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-4" />}
      {(!compact || !Icon) && (
        <span aria-hidden className={cn('type-label', kind === 'upi' && 'italic font-extrabold tracking-wider')}>
          {label}
        </span>
      )}
    </span>
  );
}

export interface PaymentMarksProps {
  /** Which ways to pay are really on offer, in the order to show them. */
  methods?: PaymentKind[];
  compact?: boolean;
  className?: string;
}

/** A row of payment marks for the footer, the cart and checkout. Pass only what the store accepts. */
export function PaymentMarks({ methods = ['upi', 'card', 'netbanking', 'cod'], compact, className }: PaymentMarksProps) {
  return (
    <ul aria-label="Ways to pay" className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {methods.map((kind) => (
        <li key={kind} className="flex">
          <PaymentMark kind={kind} compact={compact} />
        </li>
      ))}
    </ul>
  );
}
