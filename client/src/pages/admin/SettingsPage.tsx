import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Skeleton, SkeletonText } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import { DeliverySection } from './setup/settings/DeliverySection';
import { EmiSection } from './setup/settings/EmiSection';
import { GrievanceSection } from './setup/settings/GrievanceSection';
import { HomeSection } from './setup/settings/HomeSection';
import { InvoiceSection } from './setup/settings/InvoiceSection';
import { PaymentsSection } from './setup/settings/PaymentsSection';
import { PromisesSection } from './setup/settings/PromisesSection';
import { SampleDataSection } from './setup/settings/SampleDataSection';
import { SearchWordsSection } from './setup/settings/SearchWordsSection';
import { ServicesSection } from './setup/settings/ServicesSection';
import { StoreSection } from './setup/settings/StoreSection';
import { StudioSection } from './setup/settings/StudioSection';
import { StudioWorkSection } from './setup/settings/StudioWorkSection';

const SECTIONS = [
  { id: 'store', label: 'Store' },
  { id: 'studio', label: 'Studio' },
  { id: 'services', label: 'Fitting services' },
  { id: 'grievance', label: 'Grievance officer' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'payments', label: 'Payments' },
  { id: 'emi', label: 'EMI' },
  { id: 'promises', label: 'Promises' },
  { id: 'home', label: 'Home page' },
  { id: 'studio-work', label: 'From the studio' },
  { id: 'search-words', label: 'Search words' },
  { id: 'invoices', label: 'Invoices and email' },
  { id: 'sample-data', label: 'Sample data' },
] as const;

/** The section nearest the top of the screen, for the jump list. */
function useCurrentSection(enabled: boolean): string {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
        const first = SECTIONS.find((section) => seen.get(section.id));
        if (first) setCurrent(first.id);
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    for (const section of SECTIONS) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [enabled]);
  return current;
}

/**
 * Store settings: thirteen sections, each with its own Save, so a change to the COD fee never
 * sends the address along with it. Each Save PUTs only that section's part of AdminSettings.
 */
export default function SettingsPage() {
  useDocumentMeta({ title: 'Settings', noindex: true });
  const { data, error, refetch } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: ({ signal }) => api.admin.settings.get({ signal }),
  });
  const current = useCurrentSection(Boolean(data));
  const { hash } = useLocation();

  // A link such as /admin/settings#studio lands before the sections exist: scroll once they do.
  const loaded = Boolean(data);
  useEffect(() => {
    if (!loaded || !hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    target?.scrollIntoView({ block: 'start' });
  }, [loaded, hash]);

  return (
    <div className="container-page">
      <PageHeader
        variant="plain"
        title="Settings"
        description="How the shop introduces itself, runs the fitting studio, charges for delivery, takes payment and keeps its promises. Each section saves on its own."
      />

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the settings" />
      ) : !data ? (
        <SettingsSkeleton />
      ) : (
        <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
          <nav
            aria-label="Settings sections"
            className="sticky top-14 z-sticky -mx-4 mb-6 border-b border-line bg-page md:-mx-6 lg:top-6 lg:mx-0 lg:mb-0 lg:self-start lg:border-b-0"
          >
            <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 md:px-6 lg:grid lg:gap-0.5 lg:overflow-visible lg:p-0">
              {SECTIONS.map((section) => {
                const active = section.id === current;
                return (
                  <li key={section.id} className="shrink-0">
                    <a
                      href={`#${section.id}`}
                      aria-current={active ? 'location' : undefined}
                      className={cn(
                        'focus-ring-inset flex min-h-11 items-center rounded-control px-3 text-sm font-bold whitespace-nowrap transition-colors dur-quick',
                        active ? 'bg-brand-soft text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {section.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="grid min-w-0 gap-14 pb-16">
            <StoreSection settings={data} />
            <StudioSection settings={data} />
            <ServicesSection settings={data} />
            <GrievanceSection settings={data} />
            <DeliverySection settings={data} />
            <PaymentsSection settings={data} />
            <EmiSection settings={data} />
            <PromisesSection settings={data} />
            <HomeSection settings={data} />
            <StudioWorkSection settings={data} />
            <SearchWordsSection settings={data} />
            <InvoiceSection settings={data} />
            <SampleDataSection settings={data} />
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div aria-hidden className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <div className="mb-6 flex gap-2 lg:mb-0 lg:grid lg:content-start">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 lg:w-full" />
        ))}
      </div>
      <div className="grid gap-14">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="grid gap-5 border-t border-line pt-5">
            <Skeleton className="h-8 w-48" />
            <SkeletonText lines={2} className="max-w-prose" />
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, j) => (
                <div key={j} className="grid gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
