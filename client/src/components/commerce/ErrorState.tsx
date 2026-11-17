import type { ReactNode } from 'react';
import { CloudOff, Lock, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router';
import { Button, EmptyState } from '@/components/ui';
import { errorMessage, isApiError } from '@/lib/api';
import { loginPath } from '@/lib/urls';

export interface ErrorStateProps {
  /** Whatever the query or mutation threw. An ApiError gives the best message; anything else gets a safe one. */
  error: unknown;
  /** Runs the request again, usually the query's `refetch`. Offered for failures that may pass, never for "not found". */
  onRetry?: () => void;
  /** Replaces the title chosen for the kind of error, e.g. "Could not load your orders". */
  title?: string;
  /** For a 404: what to offer instead of retrying. Defaults to a link to the shop. */
  notFoundAction?: ReactNode;
  /** `sm` inside a panel or drawer, `md` for a whole page area. */
  size?: 'sm' | 'md';
  align?: 'start' | 'center';
  className?: string;
}

interface Kind {
  Icon: LucideIcon;
  title: string;
  description: string | null;
}

function kindOf(error: unknown): Kind & { status: number } {
  const status = isApiError(error) ? error.status : -1;
  const message = errorMessage(error);
  if (status === 0) return { status, Icon: CloudOff, title: 'No connection', description: message };
  if (status === 404) {
    return { status, Icon: SearchX, title: 'We could not find that', description: 'It may have been removed, or the link may be wrong.' };
  }
  if (status === 401) return { status, Icon: Lock, title: 'Sign in to continue', description: 'This page is for signed-in customers.' };
  if (status === 403) return { status, Icon: Lock, title: 'You do not have access to this', description: message };
  return { status, Icon: TriangleAlert, title: 'Something went wrong', description: message };
}

/**
 * What a page or panel shows when its data did not load. It reads the kind of failure from the
 * error: offline and server faults get "Try again", a missing page gets a way onward, and a
 * signed-out visitor gets the sign-in link that brings them back here.
 */
export function ErrorState({ error, onRetry, title, notFoundAction, size = 'md', align = 'start', className }: ErrorStateProps) {
  const location = useLocation();
  const kind = kindOf(error);

  let actions: ReactNode = null;
  if (kind.status === 404) {
    actions = notFoundAction ?? (
      <Button variant="dark" to="/shop">
        Browse the shop
      </Button>
    );
  } else if (kind.status === 401) {
    actions = (
      <Button variant="dark" to={loginPath(location.pathname + location.search)}>
        Sign in
      </Button>
    );
  } else if (kind.status !== 403 && onRetry) {
    actions = (
      <Button variant="dark" onClick={onRetry}>
        Try again
      </Button>
    );
  }

  return (
    <div role="alert" className={className}>
      <EmptyState
        title={title ?? kind.title}
        description={kind.description}
        actions={actions}
        art={<kind.Icon aria-hidden strokeWidth={1.5} className={size === 'md' ? 'size-14 text-line-strong' : 'size-10 text-line-strong'} />}
        size={size}
        align={align}
      />
    </div>
  );
}
