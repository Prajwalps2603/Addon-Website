import { Banknote, ReceiptText, RotateCcw, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { formatINR } from '@/lib/format';
import type { PublicSettings } from '@/types/api';

interface Fact {
  key: string;
  Icon: LucideIcon;
  title: string;
  detail: string;
  link?: { to: string; label: string };
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/\.(\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
}

/** Only facts the owner has actually set. A switched-off or blank setting is left out. */
function factsFrom(settings: PublicSettings): Fact[] {
  const facts: Fact[] = [];

  if (settings.returns.windowDays > 0) {
    facts.push({
      key: 'returns',
      Icon: RotateCcw,
      title: `${settings.returns.windowDays} days to return`,
      detail: firstSentence(settings.returns.summary),
      link: { to: '/policies/returns', label: 'Returns policy' },
    });
  }

  const threshold = settings.shipping.freeShippingThreshold;
  if (threshold > 0) {
    facts.push({
      key: 'delivery',
      Icon: Truck,
      title: `Free delivery over ${formatINR(threshold)}`,
      detail: settings.shipping.flatFee > 0 ? `Below that, ${formatINR(settings.shipping.flatFee)} for delivery.` : 'Delivery is charged below that.',
      link: { to: '/policies/shipping', label: 'Delivery details' },
    });
  }

  if (settings.cod.enabled) {
    const terms = [
      settings.cod.fee > 0 ? `A ${formatINR(settings.cod.fee)} fee, shown before you order.` : 'No extra fee.',
      settings.cod.advancePercent > 0 ? `${settings.cod.advancePercent}% is paid online first.` : '',
      settings.cod.maxOrder > 0 ? `On orders up to ${formatINR(settings.cod.maxOrder)}.` : '',
    ];
    facts.push({ key: 'cod', Icon: Banknote, title: 'Cash on delivery', detail: terms.filter(Boolean).join(' ') });
  }

  if (settings.gstin.trim()) {
    facts.push({
      key: 'gst',
      Icon: ReceiptText,
      title: 'GST invoice',
      detail: 'With every order. Add your GSTIN at checkout to claim input credit.',
    });
  }

  return facts;
}

export interface StoreFactsProps {
  settings: PublicSettings | undefined;
}

/** The store's terms in one row, built only from real settings. */
export function StoreFacts({ settings }: StoreFactsProps) {
  const facts = settings ? factsFrom(settings) : [];
  if (facts.length === 0) return null;

  return (
    <section aria-labelledby="home-facts" className="container-page pb-[clamp(2.5rem,7vw,5rem)]">
      <h2 id="home-facts" className="sr-only">
        Delivery, payment and returns
      </h2>
      <ul className="grid border-t border-ink sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
        {facts.map(({ key, Icon, title, detail, link }) => (
          <li key={key} className="flex gap-3 border-b border-line py-5 sm:pr-6 lg:border-b-0">
            <Icon aria-hidden className="mt-0.5 size-6 shrink-0" />
            <div className="grid content-start gap-1">
              <p className="font-bold tnum">{title}</p>
              {detail && <p className="type-small text-muted tnum">{detail}</p>}
              {link && (
                <Link to={link.to} className="link type-small font-bold">
                  {link.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
