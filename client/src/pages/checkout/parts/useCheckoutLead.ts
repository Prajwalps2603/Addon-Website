import { useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { normalizePhone } from '@/lib/india';
import { useCheckout } from '@/stores/checkout';
import type { CartLineInput } from '@/types/api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Posts the abandoned-checkout lead once the phone number is valid, and again (debounced) when the
 * name, email or cart change, so the shop can follow up an order that was never placed.
 * The token is kept in the checkout store and sent with the order, which marks the lead recovered.
 */
export function useCheckoutLead(contact: { name?: string; phone?: string; email?: string }, items: CartLineInput[], enabled: boolean) {
  const phone = normalizePhone(contact.phone ?? '');
  const name = (contact.name ?? '').trim();
  const email = (contact.email ?? '').trim();
  const snapshot = JSON.stringify({ phone, name, email: EMAIL.test(email) ? email : '', items });
  const settled = useDebounce(snapshot, 900);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const lead = JSON.parse(settled) as { phone: string | null; name: string; email: string; items: CartLineInput[] };
    if (!lead.phone || lead.items.length === 0 || sent.current === settled) return;
    sent.current = settled;
    const { leadToken, setLeadToken } = useCheckout.getState();
    api.checkout
      .lead({
        token: leadToken ?? undefined,
        phone: lead.phone,
        name: lead.name || undefined,
        email: lead.email || undefined,
        items: lead.items,
      })
      .then((response) => setLeadToken(response.token))
      .catch(() => {
        // A lead is a courtesy to the shop: never bother the shopper with it. Try again on the next change.
        sent.current = null;
      });
  }, [settled, enabled]);
}
