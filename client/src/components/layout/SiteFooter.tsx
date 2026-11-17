import type { ReactNode } from 'react';
import { Banknote, CalendarClock, CreditCard, Landmark, Smartphone, Store, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { FacebookIcon, InstagramIcon, Logo, YouTubeIcon } from '@/components/brand';
import { ErrorState } from '@/components/commerce/ErrorState';
import { Skeleton, SkeletonText } from '@/components/ui';
import { useCategories } from '@/hooks/useCategories';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import type { PublicSettings } from '@/types/api';
import { categoryPath, HELP_LINKS, POLICY_LINKS, sortCategories, TOOLS } from './nav';
import { StudioCard } from './StudioCard';
import { telHref } from './storeContact';

// On hover the link nudges right, turns red, and an arrow slides in after it.
const linkClass = [
  'inline-block py-2.5 leading-snug md:py-1.5',
  'transition-[color,translate] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:translate-x-1 hover:text-brand-text focus-visible:text-brand-text',
  "after:ml-1.5 after:inline-block after:text-brand-text after:content-['→'] after:opacity-0 after:-translate-x-2",
  'after:transition-[opacity,translate] after:duration-300 after:ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:after:translate-x-0 hover:after:opacity-100 focus-visible:after:translate-x-0 focus-visible:after:opacity-100',
  'motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:after:transition-none',
].join(' ');

function Column({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn('grid content-start gap-2', className)}>
      <h2 className="type-label text-muted">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The foot of every storefront page: the category and help links, the store's own
 * details (anything blank in settings is left out), the grievance officer and the consumer helpline,
 * the tax line, the ways to pay, and social links that are set.
 */
export function SiteFooter() {
  const settings = useSettings();
  const categories = useCategories();
  const s = settings.data;
  const sorted = categories.data ? sortCategories(categories.data) : [];
  const year = new Date().getFullYear();

  return (
    <footer data-print="hide" className="mt-12 border-t border-ink bg-surface text-ink print:hidden">
      <div className="container-page grid gap-10 py-10 md:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]">
          <Column title="Shop">
            {categories.isPending ? (
              <SkeletonText lines={6} className="max-w-40 pt-2" />
            ) : categories.error ? (
              <ErrorState error={categories.error} onRetry={() => void categories.refetch()} title="Categories did not load" size="sm" />
            ) : (
              <ul className="grid">
                {sorted.map((category) => (
                  <li key={category.id}>
                    <Link to={categoryPath(category)} className={linkClass}>
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/shop" className={cn(linkClass, 'font-bold')}>
                    Everything
                  </Link>
                </li>
              </ul>
            )}
          </Column>

          <Column title="Studio and tools">
            <ul className="grid">
              <li>
                <Link to="/book-fitting" className={cn(linkClass, 'font-bold')}>
                  Book a fitting
                </Link>
              </li>
              <li>
                <Link to="/cars" className={linkClass}>
                  Shop by car
                </Link>
              </li>
              <li>
                <Link to="/garage" className={linkClass}>
                  My garage
                </Link>
              </li>
              {TOOLS.map((tool) => (
                <li key={tool.to}>
                  <Link to={tool.to} className={linkClass}>
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>

          <Column title="Help">
            <ul className="grid">
              {HELP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>

          <Column title="Policies">
            <ul className="grid">
              {POLICY_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>

          <div className="col-span-2 grid content-start gap-6 md:col-span-4 lg:col-span-1">
            {settings.isPending ? (
              <div className="grid gap-3" aria-hidden>
                <Skeleton className="h-3 w-24" />
                <SkeletonText lines={4} className="max-w-64" />
              </div>
            ) : s ? (
              <StoreDetails settings={s} />
            ) : (
              settings.error && (
                <ErrorState error={settings.error} onRetry={() => void settings.refetch()} title="Store details did not load" size="sm" />
              )
            )}
          </div>
        </div>

        {s?.hasDemoData && (
          <p className="type-small border-y border-line py-3 text-muted">
            The catalogue is showing sample products while the shop adds its own. Sample reports, questions and builds are marked Sample.
          </p>
        )}

        <div className="border-t border-ink pt-8">

          <div className="grid gap-7 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-12">
            <div className="grid gap-3">
              <Link to="/" aria-label="Addon Automotive, home" className="inline-flex w-fit rounded-control">
                <Logo height={52} label="" />
              </Link>
              {s?.tagline && <p className="font-display text-sm font-black uppercase italic text-muted [font-stretch:85%]">{s.tagline}</p>}
            </div>

            <div className="grid gap-5 lg:justify-items-end">
              {s && <PayWays settings={s} />}
              {s && <SocialLinks social={s.social} />}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-line pt-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {s?.legalName || s?.storeName || 'Addon Automotive'}. Made for Indian roads.
            </p>
            <p className="inline-flex items-center gap-2 font-bold text-ink">
              <span aria-hidden className="h-0.5 w-5 -skew-x-12 bg-brand" />
              All prices are MRP inclusive of all taxes
            </p>
          </div>
        </div>

        {/* The tagline as a big sign-off, ink to red. */}
        <p
          aria-hidden
          className="flag-sign pointer-events-none -mx-2 overflow-hidden pt-2 pb-[0.12em] text-center font-display text-[clamp(2.25rem,8.6vw,7.75rem)] leading-[0.85] font-black whitespace-nowrap select-none uppercase italic [font-stretch:80%]"
        >
          {(s?.tagline || 'Upgrade your ride').replace(/\..*$/, '')}
        </p>
      </div>
    </footer>
  );
}

function StoreDetails({ settings }: { settings: PublicSettings }) {
  const { address, grievanceOfficer: officer } = settings;
  const postal = [address.line1, address.line2, [address.city, address.state].filter(Boolean).join(', '), address.pincode].filter(
    (line) => line.trim() !== '',
  );
  // StoreContact shows the studio address (or the postal one when the studio has none); repeat the postal one only when it differs.
  const showPostal = postal.length > 0 && settings.studio.address.trim() !== '';
  const hasOfficer = Boolean(officer.name || officer.email || officer.phone);

  return (
    <>
      <StudioCard settings={settings} />
      {(showPostal || settings.email || settings.gstin) && (
        <div>
            <dl className="type-small grid gap-1">
              {showPostal && (
                <DetailRow term="Post">
                  <address className="not-italic">
                    {postal.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </DetailRow>
              )}
              {settings.email && (
                <DetailRow term="Email">
                  <a href={`mailto:${settings.email}`} className="link break-all">
                    {settings.email}
                  </a>
                </DetailRow>
              )}
              {settings.gstin && (
                <DetailRow term="GSTIN">
                  <span className="type-code">{settings.gstin}</span>
                </DetailRow>
              )}
            </dl>
        </div>
      )}

      <Column title="Complaints">
        <div className="type-small grid gap-2">
          {hasOfficer && (
            <div className="grid gap-0.5">
              <p className="font-bold">Grievance officer{officer.name ? `: ${officer.name}` : ''}</p>
              {officer.designation && <p className="text-muted">{officer.designation}</p>}
              {officer.email && (
                <a href={`mailto:${officer.email}`} className="link w-fit break-all">
                  {officer.email}
                </a>
              )}
              {officer.phone && (
                <a href={telHref(officer.phone)} className="link w-fit tnum">
                  {officer.phone}
                </a>
              )}
            </div>
          )}
          <p>
            Not resolved? Call the National Consumer Helpline on{' '}
            <a href="tel:1915" className="link font-bold tnum">
              1915
            </a>{' '}
            or use{' '}
            <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer" className="link">
              consumerhelpline.gov.in
            </a>
            .
          </p>
        </div>
      </Column>
    </>
  );
}

function DetailRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-muted">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Every way the shop takes money right now, as chips. Only what is switched on in settings. */
function PayWays({ settings }: { settings: PublicSettings }) {
  const ways: { label: string; Icon: LucideIcon; tone?: string }[] = [];
  if (settings.payments.upi || settings.payments.razorpay) ways.push({ label: 'UPI', Icon: Smartphone });
  if (settings.payments.razorpay) ways.push({ label: 'Cards', Icon: CreditCard }, { label: 'Netbanking', Icon: Landmark });
  if (settings.cod.enabled) ways.push({ label: 'Cash on delivery', Icon: Banknote });
  if (settings.studio.enabled) ways.push({ label: 'Pay at the studio', Icon: Store });
  if (settings.emi.enabled) ways.push({ label: settings.emi.partner ? `EMI with ${settings.emi.partner}` : 'EMI', Icon: CalendarClock, tone: 'brand' });
  if (ways.length === 0) return null;

  return (
    <div className="grid gap-2 lg:justify-items-end">
      <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted uppercase">Ways to pay</p>
      <ul className="flex flex-wrap gap-2 lg:justify-end">
        {ways.map(({ label, Icon, tone }) => (
          <li
            key={label}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold',
              tone === 'brand' ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-page text-ink',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SOCIAL_HOVER: Record<string, string> = {
  Instagram: 'hover:border-transparent hover:bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)] hover:text-white',
  Facebook: 'hover:border-transparent hover:bg-[#1877f2] hover:text-white',
  YouTube: 'hover:border-transparent hover:bg-[#ff0000] hover:text-white',
};

function SocialLinks({ social }: { social: PublicSettings['social'] }) {
  const links = [
    { href: social.instagram, label: 'Instagram', Icon: InstagramIcon },
    { href: social.facebook, label: 'Facebook', Icon: FacebookIcon },
    { href: social.youtube, label: 'YouTube', Icon: YouTubeIcon },
  ].filter((link) => link.href.trim() !== '');
  if (links.length === 0) return null;
  return (
    <ul className="flex items-center gap-2" aria-label="Follow the shop">
      {links.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} (opens in a new tab)`}
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-page px-4 text-sm font-bold text-ink transition-colors duration-300',
              SOCIAL_HOVER[label],
            )}
          >
            <Icon size={18} />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
