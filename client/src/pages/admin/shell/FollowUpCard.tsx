import { useId, useState } from 'react';
import { Check, ChevronDown, ExternalLink, PencilLine, Phone } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand';
import { CopyButton, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { capitalize, relativeDay } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import { waLink } from '@/lib/whatsapp';
import type { FollowUp } from '@/types/api';
import { Link } from 'react-router';

export const FOLLOW_UP_TYPES: Record<FollowUp['type'], { label: string; open: string }> = {
  cod_confirm: { label: 'COD orders to confirm', open: 'Open order' },
  upi_verify: { label: 'UPI payments to check', open: 'Open order' },
  abandoned_checkout: { label: 'Left at checkout', open: 'Open lead' },
  fitment_answered: { label: 'Fitment answers to send', open: 'Open question' },
  back_in_stock: { label: 'Back in stock', open: 'Open product' },
  quote_expiring: { label: 'Quotes about to expire', open: 'Open quote' },
  new_enquiry: { label: 'New enquiries', open: 'Open enquiry' },
  review_request: { label: 'Ask for a fitted report', open: 'Open order' },
  saved_kit: { label: 'Saved kits', open: 'Open kit' },
};

export interface FollowUpCardProps {
  item: FollowUp;
  onDone: (item: FollowUp) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

const pill = 'focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-page [&_svg]:size-4';

/** One person to message: who, why, the message (editable) and the actions, as a rounded card. */
export function FollowUpCard({ item, onDone }: FollowUpCardProps) {
  const [message, setMessage] = useState(item.message);
  const [editing, setEditing] = useState(false);
  const [sent, setSent] = useState(false);
  const messageId = useId();
  const link = waLink(item.phone, message);
  const edited = message !== item.message;
  const name = item.name || 'No name given';

  return (
    <li className={cn('grid content-start gap-4 rounded-[22px] p-5 transition-colors', sent ? 'bg-fit/8' : 'bg-surface')}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-page">
          {initials(item.name || '')}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="truncate text-lg leading-tight font-bold">{name}</p>
            <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs font-semibold text-muted">{capitalize(relativeDay(item.createdAt))}</span>
          </div>
          {item.phone && (
            <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1 justify-self-start text-sm text-muted tnum hover:text-ink">
              <Phone aria-hidden className="size-3.5" />
              {formatPhone(item.phone)}
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-1">
        <p className="font-bold">{item.title}</p>
        {item.detail && <p className="line-clamp-2 text-sm text-muted" title={item.detail}>{item.detail}</p>}
      </div>

      {editing ? (
        <div className="grid gap-2">
          <label htmlFor={messageId} className="text-xs font-bold tracking-[0.08em] text-muted uppercase">
            Message
          </label>
          <Textarea id={messageId} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(false)} className={pill}>
              Close editor
            </button>
            {edited && (
              <button type="button" onClick={() => setMessage(item.message)} className={pill}>
                Undo my changes
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="focus-ring group grid gap-2 rounded-[18px] rounded-tl-[6px] bg-fit/10 p-4 text-left text-[0.9375rem] text-ink transition-colors hover:bg-fit/15"
        >
          <span className="line-clamp-3 whitespace-pre-line">{message}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold opacity-70 group-hover:opacity-100">
            <PencilLine aria-hidden className="size-3.5" />
            {edited ? 'Edited. Tap to change again' : 'Read in full or edit'}
            <ChevronDown aria-hidden className="size-3.5" />
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSent(true)}
            className={cn(
              'focus-ring inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors max-sm:w-full max-sm:justify-center [&_svg]:size-5',
              sent ? 'bg-raised text-ink hover:bg-surface-2' : 'bg-[#1fa855] text-white hover:bg-[#178a45]',
            )}
          >
            <WhatsAppIcon aria-hidden />
            {sent ? 'Send again' : 'Send on WhatsApp'}
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        ) : (
          <p className="text-sm text-muted">No phone number on this record. Copy the message or open the record.</p>
        )}
        <CopyButton value={message} label="Copy" buttonVariant="ghost" className="rounded-full" />
        {item.href && (
          <Link to={item.href} className={pill}>
            <ExternalLink aria-hidden />
            {FOLLOW_UP_TYPES[item.type]?.open ?? 'Open'}
          </Link>
        )}
        <button
          type="button"
          onClick={() => onDone(item)}
          className={cn(
            'focus-ring ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors [&_svg]:size-4',
            sent ? 'bg-fit text-white hover:opacity-90' : 'bg-ink text-page hover:bg-brand hover:text-brand-ink',
          )}
        >
          <Check aria-hidden />
          {sent ? 'Sent. Mark done' : 'Done'}
        </button>
      </div>
    </li>
  );
}
