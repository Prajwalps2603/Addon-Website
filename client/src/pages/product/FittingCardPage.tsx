import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, CircleX, Printer, Square, TriangleAlert, Wrench } from 'lucide-react';
import { CompoundRing, Logo, Roundel } from '@/components/brand';
import {
  ErrorState,
  LEGALITY_WORDS,
  ProductFrame,
  ShareButton,
  WARRANTY_WORDS,
  WhatsAppButton,
  WIRING_WORDS,
} from '@/components/commerce';
import { Button, Callout, Segmented, Skeleton, SkeletonText } from '@/components/ui';
import { useActiveCar } from '@/hooks/useActiveVehicle';
import { useProduct } from '@/hooks/useProduct';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel } from '@/lib/format';
import { qrPath } from '@/lib/qr';
import { SITE_NAME, useDocumentMeta } from '@/lib/seo';
import { readJSON, writeJSON } from '@/lib/storage';
import { siteUrl } from '@/lib/urls';
import { askAboutProduct } from '@/lib/whatsapp';
import type { ProductDetail } from '@/types/api';
import type { GarageCar } from '@/stores/garage';
import { fittingServiceFor } from './parts/studio';

type Language = 'en' | 'hi' | 'both';

const LANGUAGE_KEY = 'addon-fitting-language';

/** Screen shows the chosen language; print always carries both. */
function shows(language: Language, which: 'en' | 'hi'): string {
  return language === 'both' || language === which ? '' : 'hidden print:block';
}

/** Hindi wording for the card's own furniture. Product text comes from the catalogue. */
const HI = {
  tools: 'ज़रूरी औज़ार',
  steps: 'फ़िट करने का तरीका',
  time: 'अनुमानित समय',
  charge: 'उचित मज़दूरी',
  notes: 'सुरक्षा और वारंटी',
};

function chargeText(min: number, max: number): { en: string; hi: string } | null {
  if (min <= 0 && max <= 0) return null;
  const low = Math.min(min || max, max || min);
  const high = Math.max(min, max);
  const amount = low === high ? formatINR(high) : `${formatINR(low)} to ${formatINR(high)}`;
  const amountHi = low === high ? formatINR(high) : `${formatINR(low)} से ${formatINR(high)}`;
  return {
    en: `A fair charge for this job is ${amount}.`,
    hi: `इस काम की उचित मज़दूरी ${amountHi} है।`,
  };
}

function SectionTitle({ en, hi, language }: { en: string; hi: string; language: Language }) {
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-ink pb-2">
      <span className={cn('type-h2', shows(language, 'en'))}>{en}</span>
      <span lang="hi" className={cn('text-xl font-bold', shows(language, 'hi'))}>
        {hi}
      </span>
    </h2>
  );
}

function CardSkeleton() {
  return (
    <div aria-hidden className="grid gap-8">
      <div className="flex gap-4">
        <Skeleton className="size-24 shrink-0 sm:size-32" />
        <div className="grid flex-1 content-start gap-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-28" />
      <SkeletonText lines={3} />
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex gap-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <SkeletonText lines={2} className="flex-1" />
        </div>
      ))}
    </div>
  );
}

function Fact({ label, labelHi, language, children }: { label: string; labelHi: string; language: Language; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 p-4 print:p-3">
      <dt className="type-small font-bold text-muted">
        <span className={shows(language, 'en')}>{label}</span>
        <span lang="hi" className={cn('font-bold', language === 'both' && 'ms-2', shows(language, 'hi'))}>
          {labelHi}
        </span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

function CarLine({ car, product }: { car: GarageCar; product: ProductDetail }) {
  const name = car.year ? `${car.vehicle.label}, ${car.year}` : car.vehicle.label;
  return (
    <div className="grid gap-2">
      <p className="type-small text-muted">
        For the car: <span className="text-base font-bold text-ink">{name}</span>
      </p>
      {product.fit === 'no' && (
        <Callout tone="danger" title={`Our records say this part does not fit the ${car.vehicle.model}`}>
          {product.fitNote || 'Check with us before fitting it.'}
        </Callout>
      )}
      {product.fit === 'with_work' && product.fitNote && (
        <Callout tone="warn" title={`Extra work on the ${car.vehicle.model}`}>
          {product.fitNote}
        </Callout>
      )}
    </div>
  );
}

function Notes({ product }: { product: ProductDetail }) {
  const label = product.label;
  const legality = LEGALITY_WORDS[label.legality];
  const warranty = WARRANTY_WORDS[label.warrantyImpact];
  const wiring = WIRING_WORDS[label.wiring];
  const rows: { name: string; value: string; note: string; tone: 'good' | 'caution' | 'stop' }[] = [
    { name: 'Road use', value: legality.label, note: label.legalityNote || legality.detail, tone: legality.level },
    { name: 'Car warranty', value: warranty.label, note: label.warrantyNote || warranty.detail, tone: warranty.level },
    { name: 'Wiring', value: wiring.label, note: wiring.detail, tone: wiring.level },
    {
      name: 'Undoing it',
      value: label.reversible ? 'Fully reversible' : 'A permanent change',
      note: label.reversible
        ? 'Keep the original parts and fixings so the car can be put back.'
        : 'Drilling, cutting or sticking that will not come off cleanly. Confirm with the owner before starting.',
      tone: label.reversible ? 'good' : 'caution',
    },
  ];
  if (label.proInstall) {
    rows.push({
      name: 'Who should fit it',
      value: 'A trained fitter',
      note: 'A mistake here is costly. Do not attempt it without the right tools and experience.',
      tone: 'caution',
    });
  }
  return (
    <dl className="grid divide-y divide-line border-b border-line">
      {rows.map((row) => (
        <div key={row.name} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4 print:grid-cols-[9rem_1fr] print:py-1.5">
          <dt className="type-small font-bold text-muted">{row.name}</dt>
          <dd>
            <p className={cn('flex items-center gap-1.5 font-bold', row.tone === 'stop' && 'text-stop', row.tone === 'caution' && 'text-warn')}>
              {row.tone === 'stop' && <CircleX aria-hidden className="size-4 shrink-0" />}
              {row.tone === 'caution' && <TriangleAlert aria-hidden className="size-4 shrink-0" />}
              {row.value}
            </p>
            <p className="type-small mt-0.5 max-w-prose">{row.note}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QrBlock({ slug }: { slug: string }) {
  const url = siteUrl(`/p/${slug}`);
  const { size, path } = qrPath(url, { level: 'Q' });
  return (
    <figure className="flex items-center gap-3">
      {/* Dark on white in both themes: the frame plane is white and its ink is near-black, as scanners need. */}
      <span className="plane-frame block shrink-0 bg-frame p-1 text-frame-ink print-exact">
        <svg viewBox={`0 0 ${size} ${size}`} width={96} height={96} shapeRendering="crispEdges" role="img" aria-label="QR code for the product page">
          <path d={path} fill="currentColor" />
        </svg>
      </span>
      <figcaption className="type-small max-w-40 text-muted">
        Scan for the product page, photos and fitted reports.
      </figcaption>
    </figure>
  );
}

function FittingCard({ product, language }: { product: ProductDetail; language: Language }) {
  const settings = useSettings().data;
  const car = useActiveCar();
  const storeName = settings?.storeName || SITE_NAME;
  const label = product.label;
  const time = minutesLabel(label.installTimeMin, label.installTimeMax);
  const charge = chargeText(label.fittingCostMin, label.fittingCostMax);
  const steps = product.fittingSteps.filter((step) => step.en || step.hi);
  const tools = product.fittingTools.filter(Boolean);

  return (
    <article className="grid gap-8 print:gap-5">
      <header className="grid gap-5 print:gap-3">
        <div className="flex items-center justify-between gap-4 border-b border-ink pb-3">
          <div className="flex items-center gap-3">
            <Logo height={28} tagline={false} label={storeName} />
            {storeName !== SITE_NAME && <span className="font-bold">{storeName}</span>}
          </div>
          <p className="type-small text-right text-muted">
            {settings?.phone ? <span className="tnum">Questions: {settings.phone}</span> : siteUrl('/').replace(/^https?:\/\//, '')}
          </p>
        </div>

        <div className="flex gap-4 sm:gap-6">
          <ProductFrame image={product.image} alt={product.name} artKind={product.artKind} eager className="w-24 shrink-0 sm:w-32 print:w-24" />
          <div className="grid min-w-0 content-start gap-2">
            <h1 className="type-h1">Fitting card</h1>
            <p className="type-title text-balance">{product.name}</p>
            <p className="type-code text-muted">{product.sku}</p>
          </div>
        </div>

        {car && <CarLine car={car} product={product} />}
      </header>

      <dl className="grid border border-ink sm:grid-cols-3 sm:divide-x sm:divide-line max-sm:divide-y max-sm:divide-line print:grid-cols-3 print:divide-x">
        <Fact label="Expected time" labelHi={HI.time} language={language}>
          <span className="text-2xl font-extrabold tnum">{time || 'A few minutes'}</span>
          {time && <span className="type-small block text-muted">For someone who has done it before.</span>}
        </Fact>
        <Fact label="Difficulty" labelHi="कठिनाई" language={language}>
          <CompoundRing difficulty={label.installDifficulty} size={36} />
        </Fact>
        <Fact label="Fair labour charge" labelHi={HI.charge} language={language}>
          {charge ? (
            <>
              <p className={cn('text-lg leading-snug font-bold tnum', shows(language, 'en'))}>{charge.en}</p>
              <p lang="hi" className={cn('text-lg font-bold tnum', shows(language, 'hi'))}>
                {charge.hi}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold">No fitter needed</p>
          )}
        </Fact>
      </dl>

      {tools.length > 0 && (
        <section className="grid gap-3">
          <SectionTitle en="Tools needed" hi={HI.tools} language={language} />
          <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 print:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool} className="flex items-start gap-2.5 text-lg print:text-base">
                <Square aria-hidden className="mt-1 size-5 shrink-0 text-muted" />
                {tool}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4">
        <SectionTitle en="Steps" hi={HI.steps} language={language} />
        {steps.length === 0 ? (
          <NoSteps product={product} />
        ) : (
          <ol className="grid gap-6 print:gap-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <Roundel size="lg" tone="ink" className="print-exact print:size-7 print:text-sm">
                  {index + 1}
                </Roundel>
                <div className="grid min-w-0 gap-2 pt-1.5 print:gap-0.5 print:pt-1">
                  {step.en && <p className={cn('text-xl leading-snug font-medium sm:text-2xl print:text-base', shows(language, 'en'))}>{step.en}</p>}
                  {step.hi && (
                    <p lang="hi" className={cn('text-xl sm:text-2xl print:text-base', language === 'both' && 'text-muted print:text-ink', shows(language, 'hi'))}>
                      {step.hi}
                    </p>
                  )}
                  {language === 'hi' && !step.hi && <p className="type-small text-muted">Hindi not written for this step yet: {step.en}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-3">
        <SectionTitle en="Safety and warranty" hi={HI.notes} language={language} />
        <Notes product={product} />
      </section>

      <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-ink pt-4">
        <QrBlock slug={product.slug} />
        <p className="type-small max-w-xs text-muted">
          Steps are a guide for a competent fitter. If something does not line up, stop and contact {storeName} before forcing it.
        </p>
      </footer>
    </article>
  );
}

function NoSteps({ product }: { product: ProductDetail }) {
  const settings = useSettings().data;
  const car = useActiveCar();
  return (
    <Callout
      tone="info"
      title="We have not written fitting steps for this part yet"
      actions={
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <WhatsAppButton text={askAboutProduct({ product, vehicle: car?.vehicle ?? null })}>Ask us how to fit it</WhatsAppButton>
          {!settings?.whatsapp && settings?.phone && (
            <Button variant="outline" href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}>
              Call {settings.phone}
            </Button>
          )}
        </div>
      }
    >
      Ask us and we will talk your fitter through it, step by step.
    </Callout>
  );
}

/** On screen only: the studio can fit this part instead, for a shopper who would rather not do it. */
function StudioOffer({ product }: { product: ProductDetail }) {
  const service = fittingServiceFor(product, useSettings().data);
  if (!service || product.fit === 'no') return null;
  const time = minutesLabel(service.minutes);
  return (
    <p className="type-small flex items-start gap-2 border-y border-line py-3 print:hidden" data-print="hide">
      <Wrench aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        Rather have us fit it? {service.name} at our studio:{' '}
        <span className="font-bold tnum">{service.charge > 0 ? formatINR(service.charge) : 'no extra charge'}</span>
        {time ? `, about ${time}` : ''}.{' '}
        <Link to={`/book-fitting?service=${encodeURIComponent(service.id)}`} className="link font-bold">
          Book a fitting slot
        </Link>
      </span>
    </p>
  );
}

/**
 * /fitting/:slug: the card a shopper hands to their mechanic. Big type, English and Hindi,
 * the tools, the steps, the time and a fair labour charge. Prints on one A4 page; the controls do not print.
 */
export default function FittingCardPage() {
  const { slug } = useParams();
  const { data: product, isPending, error, refetch } = useProduct(slug);
  const settings = useSettings().data;
  const car = useActiveCar();
  const [language, setLanguage] = useState<Language>(() => {
    const saved = readJSON<string>(LANGUAGE_KEY, 'both');
    return saved === 'en' || saved === 'hi' ? saved : 'both';
  });

  useDocumentMeta({
    title: product ? `Fitting card: ${product.name}` : 'Fitting card',
    description: product ? `Tools, steps, time and a fair labour charge for fitting ${product.name}, in English and Hindi.` : undefined,
    image: product?.image ?? null,
  });

  const choose = (next: Language) => {
    setLanguage(next);
    writeJSON(LANGUAGE_KEY, next);
  };

  const shareText = product
    ? [
        car ? `Fitting card for my ${car.vehicle.model}: ${product.name}` : `Fitting card: ${product.name}`,
        'Tools, steps and a fair labour charge, in English and Hindi.',
        siteUrl(`/fitting/${product.slug}`),
      ].join('\n')
    : '';

  return (
    <div className="min-h-dvh bg-page text-ink">
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-4 sm:px-6 sm:py-6 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 print:hidden" data-print="hide">
          <Button variant="ghost" size="sm" to={slug ? `/p/${slug}` : '/shop'} iconLeft={<ArrowLeft />}>
            Back to the part
          </Button>
          {product && (
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<Language>
                label="Language"
                size="sm"
                value={language}
                onChange={choose}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'hi', label: <span lang="hi">हिन्दी</span> },
                  { value: 'both', label: 'Both' },
                ]}
              />
            </div>
          )}
        </div>

        {product && (
          <div className="flex flex-wrap gap-2 print:hidden" data-print="hide">
            {settings?.whatsapp ? (
              <WhatsAppButton to="share" text={shareText} variant="primary">
                Send to my mechanic
              </WhatsAppButton>
            ) : (
              <ShareButton url={`/fitting/${product.slug}`} title={`Fitting card: ${product.name}`} text={shareText} variant="primary">
                Send to my mechanic
              </ShareButton>
            )}
            <Button variant="outline" iconLeft={<Printer />} onClick={() => window.print()}>
              Print
            </Button>
          </div>
        )}

        {product && <StudioOffer product={product} />}

        <main id="main">
          {isPending ? (
            <CardSkeleton />
          ) : error ? (
            <ErrorState
              error={error}
              onRetry={() => void refetch()}
              title={error.isNotFound ? 'There is no fitting card at this address' : 'Could not load the fitting card'}
              notFoundAction={
                <Button variant="outline" to="/shop">
                  Browse the shop
                </Button>
              }
            />
          ) : (
            <FittingCard product={product} language={language} />
          )}
        </main>

        {product && (
          <p className="type-small text-muted print:hidden">
            Printing gives one A4 page with both English and Hindi, whichever you choose here.
          </p>
        )}
      </div>
    </div>
  );
}
