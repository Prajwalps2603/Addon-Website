import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { EmptyState, Tab, TabList, TabPanel, Tabs, toast } from '@/components/ui';
import { api, type ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentMeta } from '@/lib/seo';
import type { AdminQuestion } from '@/types/api';
import { DeskPage, ListError, ListPager, QueueSkeleton, useConfirm, useDeskRefresh, usePageParam, useParamState, useProductMap } from './desk/common';
import {
  AnsweredPanel,
  FitmentCard,
  GeneralQuestionCard,
  groupQuestions,
  HistoryRow,
  useRejectGroup,
  type AnsweredGroup,
  type QuestionGroup,
} from './desk/fitment';

const VIEWS = ['waiting', 'answered', 'rejected'] as const;
type View = (typeof VIEWS)[number];
const PAGE_SIZE = 100;
const HISTORY_SIZE = 30;

/**
 * The Answer-Once Fitment Desk. Waiting fitment questions come first, the most-asked first,
 * grouped by part and car so one verdict answers everyone; general questions follow.
 */
export default function FitmentDeskPage() {
  useDocumentMeta({ title: 'Fitment desk', noindex: true });
  const [view, setView] = useParamState<View>('tab', VIEWS, 'waiting');

  const waitingCount = useQuery({
    queryKey: queryKeys.admin.questions.list({ status: 'pending', limit: 1 }),
    queryFn: ({ signal }) => api.admin.questions.list({ status: 'pending', limit: 1 }, { signal }),
  });

  return (
    <DeskPage
      title="Fitment desk"
      meta={waitingCount.data ? `${pluralize(waitingCount.data.total, 'question')} waiting` : undefined}
    >
      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabList label="Questions">
          <Tab value="waiting" count={waitingCount.data?.total}>
            Waiting
          </Tab>
          <Tab value="answered">Answered</Tab>
          <Tab value="rejected">Rejected</Tab>
        </TabList>
      <TabPanel value={view} className="pt-6">{view === 'waiting' ? <WaitingQueue /> : <History status={view === 'answered' ? 'published' : 'rejected'} />}</TabPanel>
      </Tabs>
    </DeskPage>
  );
}

function HowItWorks() {
  return (
    <div className="grid gap-1 border-y border-ink py-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
      <p className="type-h3">Answer once</p>
      <p className="max-w-prose text-muted">
        Your verdict is saved against that car. Every shopper who asked about the same part and car is answered in one go, and the
        store shows that verdict to anyone with that car from now on. Then send each of them the reply on WhatsApp.
      </p>
    </div>
  );
}

function WaitingQueue() {
  const [answered, setAnswered] = useState<AnsweredGroup[]>([]);
  const query = useQuery({
    queryKey: queryKeys.admin.questions.list({ status: 'pending', limit: PAGE_SIZE }),
    queryFn: ({ signal }) => api.admin.questions.list({ status: 'pending', limit: PAGE_SIZE }, { signal }),
  });
  const items = query.data?.items ?? [];
  const groups = groupQuestions(items);
  const fitment = groups.filter((group) => group.kind === 'fitment');
  const general = groups.filter((group) => group.kind === 'general');
  const { map } = useProductMap(items.map((question) => question.productId));

  const reject = useRejectGroup();
  const { ask, dialog } = useConfirm();

  const onAnswered = (next: AnsweredGroup) => setAnswered((list) => [next, ...list.filter((item) => item.key !== next.key)]);
  const onReject = (group: QuestionGroup) => {
    if (group.questions.length === 1) {
      reject.mutate(group);
      return;
    }
    ask({
      title: `Reject ${group.questions.length} questions?`,
      description: `Everyone who asked about ${group.productName} on the ${group.vehicleLabel || 'same car'} gets no answer. Use this for spam, not for a part that does not fit.`,
      confirmLabel: 'Reject all',
      run: () => reject.mutateAsync(group),
    });
  };

  const answeredPanels = answered.length > 0 && (
    <div className="grid gap-3">
      {answered.map((item) => (
        <AnsweredPanel key={item.key} answered={item} onDone={() => setAnswered((list) => list.filter((entry) => entry.key !== item.key))} />
      ))}
    </div>
  );

  if (query.isPending) {
    return (
      <div className="grid gap-6">
        <HowItWorks />
        <QueueSkeleton />
      </div>
    );
  }
  if (query.error) return <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the questions" />;

  return (
    <div className="grid gap-8">
      {answeredPanels}
      {groups.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          description="Every question has an answer. New ones from the product pages land here, fitment questions first."
        />
      ) : (
        <>
          <HowItWorks />
          {fitment.length > 0 && (
            <section aria-labelledby="desk-fitment" className="grid gap-3">
              <h2 id="desk-fitment" className="type-h2">
                Does it fit
              </h2>
              {fitment.map((group) => (
                <FitmentCard key={group.key} group={group} product={map.get(group.productId)} onAnswered={onAnswered} onReject={onReject} />
              ))}
            </section>
          )}
          {general.length > 0 && (
            <section aria-labelledby="desk-general" className="grid gap-3">
              <h2 id="desk-general" className="type-h2">
                Other questions
              </h2>
              {general.map((group) => (
                <GeneralQuestionCard key={group.key} group={group} product={map.get(group.productId)} onAnswered={onAnswered} onReject={onReject} />
              ))}
            </section>
          )}
          {query.data.total > items.length && (
            <p className="type-small text-muted tnum">
              Showing the first {items.length} of {query.data.total}. Answer these and the rest move up.
            </p>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}

function History({ status }: { status: 'published' | 'rejected' }) {
  const [page, setPage] = usePageParam();
  const refresh = useDeskRefresh();
  const { ask, dialog } = useConfirm();
  const listQuery = { status, page, limit: HISTORY_SIZE } as const;
  const query = useQuery({
    queryKey: queryKeys.admin.questions.list(listQuery),
    queryFn: ({ signal }) => api.admin.questions.list(listQuery, { signal }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];
  const { map } = useProductMap(items.map((question) => question.productId));

  const remove = useMutation<unknown, ApiError, AdminQuestion>({
    mutationFn: (question) => api.admin.questions.remove(question.id),
    onSuccess: async () => {
      toast.success('Question deleted');
      await refresh(queryKeys.admin.questions.all());
    },
    onError: (error) => toast.error('Could not delete', { description: error.message }),
  });
  const restore = useMutation<unknown, ApiError, AdminQuestion>({
    mutationFn: (question) => api.admin.questions.answer(question.id, { status: 'pending' }),
    onSuccess: async () => {
      toast.success('Back in the queue');
      await refresh(queryKeys.admin.questions.all());
    },
    onError: (error) => toast.error('Could not move it', { description: error.message }),
  });

  const onDelete = (question: AdminQuestion) =>
    ask({
      title: 'Delete this question?',
      description:
        status === 'published'
          ? 'It and its answer disappear from the product page. The fit verdict saved for the car stays.'
          : 'It is removed for good.',
      confirmLabel: 'Delete',
      run: () => remove.mutateAsync(question),
    });

  if (query.isPending) return <QueueSkeleton count={4} />;
  if (query.error) return <ListError error={query.error} onRetry={() => query.refetch()} title="Could not load the questions" />;
  if (items.length === 0) {
    return (
      <EmptyState
        title={status === 'published' ? 'No answered questions yet' : 'No rejected questions'}
        description={status === 'published' ? 'Questions you answer show here, with the reply ready to send again.' : 'Questions you reject show here.'}
      />
    );
  }

  return (
    <div className={cn('transition-opacity dur-base', query.isPlaceholderData && 'opacity-60')}>
      <ul className="grid divide-y divide-line border-y border-line">
        {items.map((question) => (
          <HistoryRow
            key={question.id}
            question={question}
            product={map.get(question.productId)}
            onDelete={onDelete}
            onRestore={status === 'rejected' ? (item) => restore.mutate(item) : undefined}
            restoring={restore.isPending && restore.variables?.id === question.id}
          />
        ))}
      </ul>
      <ListPager page={page} pages={query.data.pages} onPage={setPage} label="Questions" />
      {dialog}
    </div>
  );
}
