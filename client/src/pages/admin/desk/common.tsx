/**
 * Shared pieces for the admin desk pages (fitment desk, reports, enquiries, leads, stock alerts,
 * builds): the page frame, list states, WhatsApp links to customers, confirmation,
 * product thumbnails and time labels.
 */
import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { WhatsAppIcon } from '@/components/brand';
import { ErrorState, PageHeader, ProductFrame } from '@/components/commerce';
import { Button, Modal, Pagination, Skeleton, SkeletonText, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { waLink } from '@/lib/whatsapp';
import type { ProductSummary } from '@/types/api';

// ---------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------

export interface DeskPageProps {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** The frame of every desk page: container, the plain admin title, then the page. */
export function DeskPage({ title, description, meta, actions, children }: DeskPageProps) {
  return (
    <div className="container-page pb-10">
      <PageHeader variant="plain" title={title} description={description} meta={meta} actions={actions} />
      {children}
    </div>
  );
}

/** Loading placeholder laid out like a stack of queue cards. */
export function QueueSkeleton({ count = 3, media = true }: { count?: number; media?: boolean }) {
  return (
    <div role="status" aria-label="Loading" className="grid gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="grid gap-4 rounded-[22px] bg-surface p-5">
          <div className="flex gap-4">
            {media && <Skeleton className="size-16 shrink-0 sm:size-20" />}
            <div className="grid flex-1 content-start gap-2">
              <Skeleton className="h-5 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          </div>
          <SkeletonText lines={2} />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-28" />
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The error state of a desk list, with retry. */
export function ListError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title?: string }) {
  return <ErrorState error={error} onRetry={onRetry} title={title} size="sm" className="py-8" />;
}

/** Page links under a list, only when there is more than one page. */
export function ListPager({ page, pages, onPage, label }: { page: number; pages: number; onPage: (page: number) => void; label: string }) {
  if (pages <= 1) return null;
  return <Pagination page={page} pageCount={pages} onPageChange={onPage} label={label} className="mt-6" />;
}

// ---------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------

/**
 * A view key kept in the URL (`?tab=answered`), so the back button and a reload keep the view.
 * Changing it also resets `page`.
 */
export function useParamState<T extends string>(name: string, allowed: readonly T[], fallback: T): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(name);
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;
  const set = (next: T) => {
    setParams(
      (prev) => {
        const copy = new URLSearchParams(prev);
        if (next === fallback) copy.delete(name);
        else copy.set(name, next);
        copy.delete('page');
        return copy;
      },
      { replace: true },
    );
  };
  return [value, set];
}

/** `?page=` as a number from 1. */
export function usePageParam(): [number, (page: number) => void] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const set = (next: number) => {
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next <= 1) copy.delete('page');
      else copy.set('page', String(next));
      return copy;
    });
    window.scrollTo({ top: 0 });
  };
  return [page, set];
}

// ---------------------------------------------------------------------------
// Cache refresh
// ---------------------------------------------------------------------------

/**
 * After a desk change: refresh the lists named, the pending counts in the admin menu and the
 * follow-ups screen (answered questions, back-in-stock requests and leads all appear there).
 */
export function useDeskRefresh() {
  const queryClient = useQueryClient();
  return (...keys: QueryKey[]) =>
    Promise.all(
      [...keys, ['admin', 'stats'], queryKeys.admin.followups()].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

// ---------------------------------------------------------------------------
// WhatsApp to a customer
// ---------------------------------------------------------------------------

/**
 * The wa.me link to a customer, or '' when it cannot be offered: the customer left no usable
 * number, or the store has no WhatsApp number set (then the store shows no WhatsApp at all).
 */
export function useCustomerWa(): (phone: string | null | undefined, text: string) => string {
  const storeWhatsapp = useSettings().data?.whatsapp ?? '';
  return (phone, text) => (storeWhatsapp ? waLink(phone, text) : '');
}

/** The store's name for messages, with a plain fallback while settings load. */
export function useStoreName(): string {
  return useSettings().data?.storeName || 'Addon Automotive';
}

export interface CustomerWhatsAppProps {
  phone: string | null | undefined;
  text: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  onOpen?: () => void;
}

/** "WhatsApp" with the message written. Renders nothing when there is no number to send to. */
export function CustomerWhatsApp({ phone, text, children = 'WhatsApp', variant = 'outline', size = 'md', block, className, onOpen }: CustomerWhatsAppProps) {
  const linkFor = useCustomerWa();
  const href = linkFor(phone, text);
  if (!href) return null;
  return (
    <Button
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      size={size}
      block={block}
      className={className}
      iconLeft={<WhatsAppIcon />}
      onClick={onOpen}
    >
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Confirmation
// ---------------------------------------------------------------------------

export interface ConfirmState {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  run: () => Promise<unknown>;
}

/**
 * One confirmation dialog for a page. `ask({ title, description, confirmLabel, run })` opens it;
 * the dialog stays open with the button working until `run` settles.
 */
export function useConfirm(): { ask: (state: ConfirmState) => void; dialog: ReactNode } {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    if (!busy) setState(null);
  };
  const confirm = async () => {
    if (!state) return;
    setBusy(true);
    try {
      await state.run();
      setState(null);
    } catch {
      // The action shows its own error toast; keep the dialog so it can be tried again.
    } finally {
      setBusy(false);
    }
  };
  const dialog = (
    <Modal
      open={state !== null}
      onClose={close}
      size="sm"
      title={state?.title ?? ''}
      description={state?.description}
      dismissible={!busy}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirm} loading={busy}>
            {state?.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      }
    />
  );
  return { ask: setState, dialog };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * Product summaries for a set of ids (photos and prices the desk lists do not carry), as a map.
 * Shares the products cache; no car, so no fit verdicts are asked for.
 */
export function useProductMap(ids: readonly number[]): { map: Map<number, ProductSummary>; isPending: boolean } {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  const query = useQuery({
    queryKey: queryKeys.products.byIds(unique, null),
    queryFn: ({ signal }) => api.products.byIds(unique, {}, { signal }),
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
  });
  const map = new Map<number, ProductSummary>();
  for (const product of query.data ?? []) map.set(product.id, product);
  return { map, isPending: unique.length > 0 && query.isPending };
}

/** A small square product photo (or the "Photo coming soon" frame). */
export function ProductThumb({ product, name, className }: { product: ProductSummary | undefined; name: string; className?: string }) {
  return (
    <ProductFrame
      image={product?.image ?? null}
      alt={name}
      artKind={product?.artKind ?? null}
      className={cn('size-16 shrink-0 border border-line sm:size-20', className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "12 min", "5 h", "3 days": how long something has waited. */
export function durationLabel(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < HOUR) return `${Math.max(1, Math.round(abs / MINUTE))} min`;
  if (abs < 2 * DAY) return `${Math.round(abs / HOUR)} h`;
  return `${Math.round(abs / DAY)} days`;
}

/** "5 h ago", "3 days ago", or the date once it is over a week old. */
export function agoLabel(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  if (ms < MINUTE) return 'just now';
  if (ms > 7 * DAY) return formatDate(iso);
  return `${durationLabel(ms)} ago`;
}

/** A date-time for a deadline: "today, 4:30 pm" when it is today, else "18 Nov 2026, 4:30 pm". */
export function whenLabel(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const today = new Date(now);
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? `today, ${formatTime(iso)}` : formatDateTime(iso);
}

/** A <time> element with the full date in its title. */
export function Ago({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={cn('tnum', className)}>
      {agoLabel(iso)}
    </time>
  );
}
