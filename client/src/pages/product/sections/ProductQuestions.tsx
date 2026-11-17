import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircleQuestion } from 'lucide-react';
import { ErrorState, SectionHeading } from '@/components/commerce';
import { Button, Callout, EmptyState, Skeleton, SkeletonText } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductDetail } from '@/types/api';
import type { QuestionMode, QuestionSent } from './questions/QuestionForm';
import { QuestionItem } from './questions/QuestionItem';

// Opened on a tap; it brings the form libraries, so it is not part of the product page's first load.
const QuestionForm = lazy(() => import('./questions/QuestionForm').then((m) => ({ default: m.QuestionForm })));

export interface ProductQuestionsProps {
  product: ProductDetail;
}

/** The address other parts of the product page link to for "Ask if this fits my car". */
export const ASK_FITMENT_HASH = '#ask-fitment';
const FIRST_SHOWN = 5;

function QuestionsSkeleton() {
  return (
    <div aria-hidden className="grid divide-y divide-line border-y border-line">
      {[0, 1, 2].map((key) => (
        <div key={key} className="grid gap-3 py-5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-40" />
          <SkeletonText lines={2} className="max-w-prose" />
        </div>
      ))}
    </div>
  );
}

/**
 * Published questions with the shop's answers, and the form to ask one: a general question, or
 * "Will it fit my car?" for the Fitment Desk. Opening the page at #ask-fitment scrolls here and opens that form.
 */
export default function ProductQuestions({ product }: ProductQuestionsProps) {
  const section = useRef<HTMLElement>(null);
  const [formMode, setFormMode] = useState<QuestionMode | null>(null);
  const [sent, setSent] = useState<QuestionSent | null>(null);
  const [showAll, setShowAll] = useState(false);
  const whatsapp = useSettings().data?.whatsapp ?? '';

  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.questions(product.slug),
    queryFn: ({ signal }) => api.questions.list(product.slug, { signal }),
  });

  // #ask-fitment, on arrival or when another control on the page sets it.
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== ASK_FITMENT_HASH) return;
      setSent(null);
      setFormMode('fitment');
      requestAnimationFrame(() => section.current?.scrollIntoView({ block: 'start' }));
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const open = (mode: QuestionMode) => {
    setSent(null);
    setFormMode(mode);
  };

  const close = () => {
    setFormMode(null);
    if (window.location.hash === ASK_FITMENT_HASH) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  };

  const items = data ?? [];
  const shown = showAll ? items : items.slice(0, FIRST_SHOWN);

  const askButtons = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" iconLeft={<MessageCircleQuestion />} onClick={() => open('general')}>
        Ask a question
      </Button>
      <Button variant="ghost" onClick={() => open('fitment')}>
        Will it fit my car?
      </Button>
    </div>
  );

  return (
    <section ref={section} id="questions" aria-labelledby="questions-heading" className="grid scroll-mt-24 gap-6">
      <span id={ASK_FITMENT_HASH.slice(1)} aria-hidden className="sr-only" />
      <SectionHeading
        id="questions-heading"
        title="Questions"
        description="Asked by shoppers, answered by the shop. Fit answers name the car they were checked against."
      />

      {sent && (
        <Callout tone="good" title={sent.kind === 'fitment' ? 'Fit check sent' : 'Question sent'} live>
          {sent.kind === 'fitment'
            ? `We will check this part against ${sent.vehicle ? `the ${sent.vehicle.label}` : 'your car'} and send the answer to your mobile${whatsapp ? ' on WhatsApp' : ''}. It will also appear here.`
            : 'The answer will appear here once the shop has replied.'}
        </Callout>
      )}

      {formMode ? (
        <Suspense fallback={<Skeleton className="h-40" />}>
          <QuestionForm
            key={product.slug}
            product={product}
            mode={formMode}
            onModeChange={setFormMode}
            onCancel={close}
            onSent={(result) => {
              close();
              setSent(result);
            }}
          />
        </Suspense>
      ) : (
        items.length > 0 && askButtons
      )}

      {isPending ? (
        <QuestionsSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not load the questions" size="sm" />
      ) : items.length === 0 ? (
        !formMode && (
          <EmptyState
            size="sm"
            title="No questions yet"
            description="Not sure it suits your car, or what fitting it involves? Ask. The answer goes up here for the next person too."
            actions={askButtons}
          />
        )
      ) : (
        <div className="grid gap-4">
          <ul className="divide-y divide-line border-y border-line">
            {shown.map((question) => (
              <QuestionItem key={question.id} question={question} />
            ))}
          </ul>
          {items.length > FIRST_SHOWN && (
            <Button variant="link" className="justify-self-start" onClick={() => setShowAll((value) => !value)}>
              {showAll ? 'Show fewer questions' : `Show all ${items.length} questions`}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
