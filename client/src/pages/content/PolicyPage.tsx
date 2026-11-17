import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorState, PageHeader } from '@/components/commerce';
import { Button, EmptyState } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { useDocumentMeta } from '@/lib/seo';
import { POLICY_LINKS, buildPolicy, isPolicySlug, type PolicySlug } from './parts/policies';
import { DocSection, ReadingPage, ReadingSkeleton, type TocItem } from './parts/Reading';
import { GrievanceBlock, OwnerReviewNote } from './parts/StoreBlocks';

function OtherPolicies({ current }: { current: PolicySlug | null }) {
  const others = POLICY_LINKS.filter((policy) => policy.slug !== current);
  return (
    <nav aria-labelledby="other-policies" className="grid gap-3">
      <h2 id="other-policies" className="type-label text-muted">
        {current ? 'Other policies' : 'Our policies'}
      </h2>
      <ul className="border-t border-line">
        {others.map((policy) => (
          <li key={policy.slug} className="border-b border-line">
            <Link to={`/policies/${policy.slug}`} className="focus-ring flex min-h-11 items-center justify-between gap-3 py-2 font-bold hover:bg-surface">
              {policy.label}
              <ArrowRight aria-hidden className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PolicyNotFound() {
  useDocumentMeta({ title: 'Policy not found', noindex: true });
  return (
    <div className="container-page pb-16">
      <PageHeader title="Policy not found" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Policies' }]} />
      <div className="grid max-w-[44rem] gap-8">
        <EmptyState
          title="There is no policy at this address"
          description="The link may be mistyped, or the page may have moved. These are the store’s policies."
          actions={
            <Button variant="dark" to="/contact">
              Ask us instead
            </Button>
          }
          art={null}
          size="sm"
        />
        <OtherPolicies current={null} />
      </div>
    </div>
  );
}

function Policy({ slug }: { slug: PolicySlug }) {
  const { data: settings, isPending, error, refetch } = useSettings();
  const label = POLICY_LINKS.find((policy) => policy.slug === slug)?.label ?? 'Policy';
  const policy = settings ? buildPolicy(slug, settings) : null;
  useDocumentMeta({ title: policy?.title ?? label, description: policy?.summary });

  if (isPending) return <ReadingSkeleton sections={4} />;
  if (error || !settings || !policy) {
    return (
      <div className="container-page">
        <ErrorState error={error} onRetry={() => void refetch()} title={`Could not load the ${label.toLowerCase()} policy`} />
      </div>
    );
  }

  const toc: TocItem[] = [...policy.sections.map((section) => ({ id: section.id, label: section.title })), { id: 'grievance', label: 'Complaints' }];

  return (
    <ReadingPage
      title={policy.title}
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: policy.title }]}
      description={policy.summary}
      toc={toc}
      top={<OwnerReviewNote settings={settings} />}
    >
      {policy.sections.map((section) => (
        <DocSection key={section.id} id={section.id} title={section.title}>
          {section.body}
        </DocSection>
      ))}
      <GrievanceBlock settings={settings} id="grievance" />
      <OtherPolicies current={slug} />
    </ReadingPage>
  );
}

export default function PolicyPage() {
  const { slug } = useParams();
  if (!isPolicySlug(slug)) return <PolicyNotFound />;
  return <Policy key={slug} slug={slug} />;
}
