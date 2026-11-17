/**
 * Lead cards: an abandoned checkout and a saved kit, each with its WhatsApp follow-up and status actions.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Phone } from 'lucide-react';
import { ProductFrame } from '@/components/commerce';
import { Badge, Button, type BadgeToneName } from '@/components/ui';
import { formatDate, formatINR, pluralize } from '@/lib/format';
import { formatPhone } from '@/lib/india';
import type { CheckoutLead, ProductSummary, SavedKit } from '@/types/api';
import { Ago, CustomerWhatsApp, useStoreName } from './common';
import { kitFollowUp, kitGoalLabel, leadReminder } from './messages';

export type LeadStatus = CheckoutLead['status'];
export type KitStatus = SavedKit['status'];

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: BadgeToneName }> = {
  open: { label: 'Not contacted', tone: 'brand' },
  contacted: { label: 'Contacted', tone: 'info' },
  recovered: { label: 'Recovered', tone: 'fit' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

export const KIT_STATUS: Record<KitStatus, { label: string; tone: BadgeToneName }> = {
  open: { label: 'Not contacted', tone: 'brand' },
  contacted: { label: 'Contacted', tone: 'info' },
  ordered: { label: 'Ordered', tone: 'fit' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
};

function Who({ name, phone, email, createdAt, badge }: { name: string; phone: string; email?: string; createdAt: string; badge: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="grid min-w-0 gap-0.5">
        <h3 className="text-lg font-bold break-words">{name || 'No name given'}</h3>
        <p className="type-small flex flex-wrap gap-x-3 gap-y-1 text-muted">
          {phone && (
            <a href={`tel:${phone}`} className="focus-ring inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-0.5 text-ink transition-colors hover:bg-ink hover:text-page">
              <Phone aria-hidden className="size-3.5" />
              <span className="tnum">{formatPhone(phone)}</span>
            </a>
          )}
          {email && <span className="break-all">{email}</span>}
          <Ago iso={createdAt} />
        </p>
      </div>
      {badge}
    </header>
  );
}

function StatusButtons<S extends string>({
  current,
  options,
  busy,
  onChange,
}: {
  current: S;
  options: { value: S; label: string }[];
  busy: S | null;
  onChange: (status: S) => void;
}) {
  return (
    <>
      {options
        .filter((option) => option.value !== current)
        .map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            className="rounded-full bg-raised hover:bg-ink hover:text-page"
            onClick={() => onChange(option.value)}
            loading={busy === option.value}
            disabled={busy !== null}
          >
            {option.label}
          </Button>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Abandoned checkout
// ---------------------------------------------------------------------------

export interface LeadCardProps {
  lead: CheckoutLead;
  busy: LeadStatus | null;
  onStatus: (status: LeadStatus) => void;
  /** The reminder was opened in WhatsApp. */
  onReminded: () => void;
}

export function LeadCard({ lead, busy, onStatus, onReminded }: LeadCardProps) {
  const storeName = useStoreName();
  const shown = lead.cart.slice(0, 4);
  const more = lead.cart.length - shown.length;
  const active = lead.status === 'open' || lead.status === 'contacted';

  return (
    <article className="grid content-start gap-4 rounded-[22px] bg-surface p-5">
      <Who
        name={lead.name}
        phone={lead.phone}
        email={lead.email}
        createdAt={lead.createdAt}
        badge={
          <Badge tone={LEAD_STATUS[lead.status].tone} variant="soft">
            {LEAD_STATUS[lead.status].label}
          </Badge>
        }
      />

      {lead.cart.length > 0 ? (
        <div className="grid gap-2">
          <ul className="grid gap-1.5">
            {shown.map((line) => (
              <li key={line.key} className="flex items-center gap-3 rounded-[14px] bg-raised p-2 pr-3">
                <ProductFrame image={line.image} alt="" artKind={line.artKind} className="size-12 shrink-0 overflow-hidden rounded-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words">
                    {line.qty > 1 && <span className="tnum font-bold">{line.qty} x </span>}
                    {line.name}
                    {line.variantName && <span className="text-muted"> ({line.variantName})</span>}
                  </span>
                </span>
                <span className="shrink-0 font-bold tnum">{formatINR(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-between gap-3 rounded-[14px] bg-ink px-4 py-3 text-page">
            <span className="grid">
              <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-page/60 uppercase">Cart total</span>
              <span className="text-xs text-page/70">
                {more > 0 ? `and ${pluralize(more, 'more item')}` : pluralize(lead.cart.length, 'item')}
              </span>
            </span>
            <span className="text-xl font-black tnum">{formatINR(lead.cartTotal)}</span>
          </p>
        </div>
      ) : (
        <p className="type-small text-muted">The cart was empty when they left.</p>
      )}

      {lead.orderNumber && (
        <p className="type-small">
          Ordered:{' '}
          <Link to={`/admin/orders/${encodeURIComponent(lead.orderNumber)}`} className="focus-ring type-code rounded-control underline underline-offset-4">
            {lead.orderNumber}
          </Link>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {active && lead.cart.length > 0 && (
          <CustomerWhatsApp
            phone={lead.phone}
            text={leadReminder(lead, storeName)}
            variant={lead.status === 'open' ? 'primary' : 'outline'}
            className="rounded-full max-sm:w-full"
            onOpen={onReminded}
          >
            Send cart reminder
          </CustomerWhatsApp>
        )}
        <StatusButtons<LeadStatus>
          current={lead.status}
          busy={busy}
          onChange={onStatus}
          options={
            active
              ? [
                  { value: 'contacted', label: 'Mark contacted' },
                  { value: 'recovered', label: 'Recovered' },
                  { value: 'dismissed', label: 'Dismiss' },
                ]
              : [{ value: 'open', label: 'Reopen' }]
          }
        />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Saved kit
// ---------------------------------------------------------------------------

export interface KitCardProps {
  kit: SavedKit;
  products: Map<number, ProductSummary>;
  productsLoading: boolean;
  busy: KitStatus | null;
  onStatus: (status: KitStatus) => void;
  onMessaged: () => void;
}

export function KitCard({ kit, products, productsLoading, busy, onStatus, onMessaged }: KitCardProps) {
  const storeName = useStoreName();
  const parts = kit.productIds.map((id) => ({ id, product: products.get(id) }));
  const names = parts.map((part) => part.product?.name).filter((name): name is string => Boolean(name));
  const active = kit.status === 'open' || kit.status === 'contacted';
  const saving = kit.dealerQuote > 0 && kit.total > 0 ? kit.dealerQuote - kit.total : null;

  return (
    <article className="grid content-start gap-4 rounded-[22px] bg-surface p-5">
      <Who
        name={kit.name}
        phone={kit.phone}
        createdAt={kit.createdAt}
        badge={
          <Badge tone={KIT_STATUS[kit.status].tone} variant="soft">
            {KIT_STATUS[kit.status].label}
          </Badge>
        }
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[14px] bg-raised p-3 sm:grid-cols-3">
        <Fact label="Car">{kit.vehicleLabel || 'Not given'}</Fact>
        <Fact label="Goal">{kitGoalLabel(kit.goal)}</Fact>
        <Fact label="Budget">
          <span className="tnum">{kit.budget > 0 ? formatINR(kit.budget) : 'Not given'}</span>
        </Fact>
        <Fact label="Car arrives">
          <span className="tnum">{kit.deliveryDate ? formatDate(kit.deliveryDate) : 'Not given'}</span>
        </Fact>
        <Fact label="Dealer quoted">
          <span className="tnum">{kit.dealerQuote > 0 ? formatINR(kit.dealerQuote) : 'Not given'}</span>
        </Fact>
        <Fact label="This kit">
          <span className="tnum font-bold">{formatINR(kit.total)}</span>
          {saving !== null && saving > 0 && <span className="type-small block text-fit tnum">{formatINR(saving)} under the dealer</span>}
        </Fact>
      </dl>

      {kit.productIds.length > 0 && (
        <ul aria-label="Parts in the kit" className="grid gap-2">
          {parts.map(({ id, product }) => (
            <li key={id} className="flex items-center gap-3">
              <ProductFrame image={product?.image ?? null} alt="" artKind={product?.artKind ?? null} className="size-10 shrink-0 overflow-hidden rounded-[10px]" />
              <span className="min-w-0 flex-1 line-clamp-2 break-words">
                {product ? (
                  <Link to={`/p/${product.slug}`} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-control underline-offset-4 hover:underline">
                    {product.name}
                  </Link>
                ) : productsLoading ? (
                  <span className="text-muted">Loading</span>
                ) : (
                  <span className="text-muted">Product {id} (no longer listed)</span>
                )}
              </span>
              {product && <span className="shrink-0 tnum">{formatINR(product.price)}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {active && (
          <CustomerWhatsApp
            phone={kit.phone}
            text={kitFollowUp(kit, names, storeName)}
            variant={kit.status === 'open' ? 'primary' : 'outline'}
            className="rounded-full max-sm:w-full"
            onOpen={onMessaged}
          >
            WhatsApp the kit
          </CustomerWhatsApp>
        )}
        <StatusButtons<KitStatus>
          current={kit.status}
          busy={busy}
          onChange={onStatus}
          options={
            active
              ? [
                  { value: 'contacted', label: 'Mark contacted' },
                  { value: 'ordered', label: 'Ordered' },
                  { value: 'dismissed', label: 'Dismiss' },
                ]
              : [{ value: 'open', label: 'Reopen' }]
          }
        />
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-0.5">
      <dt className="type-label text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
