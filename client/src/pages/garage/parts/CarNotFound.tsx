import type { ReactNode } from 'react';
import { SearchX } from 'lucide-react';
import { WhatsAppButton } from '@/components/commerce';
import { Button, EmptyState } from '@/components/ui';

export interface CarNotFoundProps {
  title: string;
  description: ReactNode;
  /** The nearest real page: the make's models, or every make. */
  back: { to: string; label: string };
  /** What the shopper was looking for, for the WhatsApp message. */
  asked: string;
}

/** A make or model we do not list: say so, offer the nearest list, and the shop's WhatsApp when it has one. */
export function CarNotFound({ title, description, back, asked }: CarNotFoundProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      art={<SearchX aria-hidden strokeWidth={1.5} className="size-14 text-line-strong" />}
      actions={
        <>
          <Button variant="dark" to={back.to}>
            {back.label}
          </Button>
          <WhatsAppButton text={`Hi, do you have parts for a ${asked}?`}>Ask us about your car</WhatsAppButton>
        </>
      }
    />
  );
}

/** Turns a URL slug into words for a message: 'grand-vitara' → 'Grand Vitara'. */
export function slugWords(slug: string | undefined): string {
  return (slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
