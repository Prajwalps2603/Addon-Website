import type { ReactNode } from 'react';
import { ArrowRight, CircleCheck, CircleHelp, CircleX, Globe, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/commerce';
import { Button, Skeleton } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { useCategories } from '@/hooks/useCategories';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { useDocumentMeta } from '@/lib/seo';
import { MAX_GARAGE_CARS } from '@/stores/garage';
import { useUi } from '@/stores/ui';
import type { PublicSettings } from '@/types/api';
import { emiLabel, serviceCharge, slotSentences, studioOpen } from '@/components/layout/storeContact';
import { minutesLabel } from '@/lib/format';
import { DocSection, Facts, ReadingPage, ReadingSkeleton, type TocItem } from './parts/Reading';
import { StoreContactList } from './parts/StoreBlocks';
import { addressLines, clean, deliveryFeeSentence, listJoin, paymentMethods } from './parts/storeFacts';

/* ------------------------------------------------------------------ fit verdicts */

const VERDICTS: { Icon: LucideIcon; tone: string; words: string; meaning: string }[] = [
  { Icon: CircleCheck, tone: 'text-fit', words: 'Fits your car', meaning: 'Listed as a direct fit for your model. No modification needed.' },
  { Icon: Wrench, tone: 'text-warn', words: 'Fits with work', meaning: 'It goes on after a change, and the page says what the change is.' },
  { Icon: Globe, tone: 'text-fit', words: 'Universal fit', meaning: 'Not made for one model. Check the size against your car before ordering.' },
  { Icon: CircleX, tone: 'text-stop', words: 'Does not fit your car', meaning: 'With a link to the parts in the same group that do.' },
  { Icon: CircleHelp, tone: 'text-info', words: 'Not checked on your car yet', meaning: 'Ask us. We answer for your car, and the answer stays for the next person with it.' },
];

function VerdictList() {
  return (
    <ul className="border-t border-line">
      {VERDICTS.map(({ Icon, tone, words, meaning }) => (
        <li key={words} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 border-b border-line py-3">
          <Icon aria-hidden className={cn('mt-0.5 size-5', tone)} />
          <div className="grid gap-0.5">
            <p className={cn('font-bold', tone)}>{words}</p>
            <p className="type-small">{meaning}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ one part of "how it works" */

function Feature({ title, children, link }: { title: string; children: ReactNode; link?: { to: string; label: string } }) {
  return (
    <div className="grid gap-2 border-t border-line pt-4 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
      <h3 className="type-h3">{title}</h3>
      <div className="grid gap-3">
        {children}
        {link && (
          <Link to={link.to} className="link type-small inline-flex items-center gap-1.5 self-start font-bold">
            {link.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ what we sell, from the catalogue */

function CategoryList() {
  const { data, isPending, error, refetch } = useCategories();
  if (isPending) {
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the categories" size="sm" />;
  const top = data.filter((category) => category.isActive && category.parentId === null && category.productCount > 0);
  if (top.length === 0) return <p className="text-muted">The catalogue is being set up. Categories appear here as parts are added.</p>;
  return (
    <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
      {top.map((category) => (
        <li key={category.id} className="border-b border-line">
          <Link to={`/shop/${category.slug}`} className="focus-ring flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-surface">
            <span className="font-bold">{category.name}</span>
            <span className="type-small tnum text-muted">{category.productCount} parts</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ the page */

function AboutContent({ settings }: { settings: PublicSettings }) {
  const car = useActiveVehicle();
  const storeName = clean(settings.storeName) || 'Addon Automotive';
  const legal = clean(settings.legalName);
  const city = clean(settings.address.city);
  const state = clean(settings.address.state);
  const place = [city, state].filter(Boolean).join(', ');
  const methods = paymentMethods(settings);
  const gstin = clean(settings.gstin);
  const studio = studioOpen(settings);
  const rules = slotSentences(settings.studio);
  const emi = emiLabel(settings);
  const hasContact = Boolean(clean(settings.phone) || clean(settings.email) || addressLines(settings).length > 0 || settings.whatsapp);

  const toc: TocItem[] = [
    { id: 'what', label: 'What we sell' },
    ...(studio ? [{ id: 'studio', label: 'Fitted at our studio' }] : []),
    { id: 'how', label: 'How the shop works' },
    { id: 'buying', label: 'Paying and delivery' },
    { id: 'who', label: 'Who you are dealing with' },
  ];

  const primary = car ? (
    <Button to="/shop" iconRight={<ArrowRight />}>
      Shop parts for your {car.model}
    </Button>
  ) : (
    <Button onClick={() => useUi.getState().openVehiclePicker()}>Add your car</Button>
  );

  return (
    <ReadingPage
      title={`About ${storeName}`}
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'About' }]}
      description={`${storeName} is a car accessories shop${studio ? ' and fitting studio' : ''}${place ? ` in ${place}` : ' in India'}. We sell parts online, say plainly whether each one fits your car${studio ? ', and fit them at our studio' : ''}.`}
      toc={toc}
    >
      <DocSection id="what" title="What we sell">
        <p>
          Accessories for cars driven in India: Android stereos, speakers and subwoofers, seat covers, sun control film, fog lamps, headlights
          and tail lamps, spoilers, alloy wheels and wheel covers, and more.
        </p>
        <CategoryList />
      </DocSection>

      {studio && (
        <DocSection id="studio" title="Fitted at our studio">
          <p>
            Customers buy a part and have it fitted by our own team at the studio, in a slot they book, or have it delivered and fit it
            themselves. A fitting can also be booked on its own.
          </p>
          <Facts
            rows={settings.services.map((service) => ({
              term: service.name,
              value: (
                <span className="tnum">
                  {serviceCharge(service)}
                  {service.minutes > 0 ? `, about ${minutesLabel(service.minutes)}` : ''}
                </span>
              ),
            }))}
          />
          <p className="type-small text-muted">Charges include GST and are per part fitted.</p>
          {rules.length > 0 && <p>{rules.join(' ')}</p>}
          {settings.businessHours.trim() && <p>The studio is open {settings.businessHours.trim()}.</p>}
          {emi && <p>{settings.emi.note.trim() || `${emi} is available.`}</p>}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button to="/book-fitting" variant="dark">
              Book a fitting
            </Button>
            <Link to="/faq#studio" className="link font-bold">
              Studio questions
            </Link>
          </div>
        </DocSection>
      )}

      <DocSection id="how" title="How the shop works">
        <p>A few things work differently here from most accessory shops.</p>
        <div className="grid gap-6">
          <Feature title="Fit verdicts">
            <p>Tell us your car once. Every part then shows one of these, worked out for that car:</p>
            <VerdictList />
            <div className="pt-1">{primary}</div>
          </Feature>

          {settings.fitPromise.enabled && (
            <Feature title="The Fit Promise" link={{ to: '/policies/returns', label: 'Returns and the Fit Promise' }}>
              <p>{settings.fitPromise.summary || 'When we say a part fits your car and it does not, we take it back.'}</p>
            </Feature>
          )}

          <Feature title="The Straight Label" link={{ to: '/straight-label', label: 'How to read the label' }}>
            <p>
              Every product carries a panel of the facts a seller would rather not print: road legality, the effect on your car’s warranty, wiring,
              whether it can be undone, how hard it is to fit, how long it takes, and what a fair fitting charge is.
            </p>
          </Feature>

          <Feature title="Fitted Reports" link={{ to: '/straight-label#fitted-reports', label: 'What a report records' }}>
            <p>
              Instead of star ratings, people who bought a part from us report how fitting went: on which car, who fitted it, how long it took and
              what went wrong. Product cards show how often it fitted first time.
            </p>
          </Feature>

          <Feature title="Your garage" link={{ to: '/garage', label: 'Open your garage' }}>
            <p>
              Save up to {MAX_GARAGE_CARS} cars and switch between them. They stay on this device, and follow your account when you sign in.
            </p>
          </Feature>

          <Feature title="Plain Talk" link={{ to: '/glossary', label: 'Read the glossary' }}>
            <p>Words like PCD, offset and CANbus are underlined on product pages. Tap one for a two-line explanation.</p>
          </Feature>
        </div>
      </DocSection>

      <DocSection id="buying" title="Paying and delivery">
        {methods.length > 0 && <p>You can pay by {listJoin(methods, 'or')}. Every method is priced in rupees before you choose it.</p>}
        <p>{deliveryFeeSentence(settings)}</p>
        {settings.returns.windowDays > 0 && <p>You have {settings.returns.windowDays} days from delivery to ask for a return.</p>}
        <p>
          <Link to="/faq" className="link font-bold">
            Questions and answers
          </Link>{' '}
          has the details on fees, delivery times and returns.
        </p>
      </DocSection>

      <DocSection id="who" title="Who you are dealing with">
        {legal || gstin ? (
          <p>
            {legal ? <>The shop is run by {legal}.</> : null}
            {gstin ? (
              <>
                {legal ? ' ' : ''}GSTIN <span className="type-code">{gstin}</span>.
              </>
            ) : null}
          </p>
        ) : null}
        {hasContact ? (
          <StoreContactList settings={settings} className="border-y border-line" />
        ) : (
          <p>
            Write to us through the{' '}
            <Link to="/contact" className="link font-bold">
              contact page
            </Link>
            . Every message gets a ticket number.
          </p>
        )}
      </DocSection>
    </ReadingPage>
  );
}

export default function AboutPage() {
  const { data: settings, isPending, error, refetch } = useSettings();
  useDocumentMeta({
    title: 'About',
    description: 'A car accessories shop and fitting studio: what we sell and fit, studio charges and slots, fit verdicts for your car and the Straight Label.',
  });

  if (isPending) return <ReadingSkeleton sections={4} />;
  if (error || !settings) {
    return (
      <div className="container-page">
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load this page" />
      </div>
    );
  }
  return <AboutContent settings={settings} />;
}
