import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes the boundary clears its error. Routes pass the pathname. */
  resetKey?: string;
  /** Replace the built-in message. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** After a deploy the browser may ask for a page chunk that no longer exists. A reload fixes it. */
function isStaleChunk(error: Error): boolean {
  return /dynamically imported module|importing a module script failed|error loading dynamically imported/i.test(error.message);
}

/**
 * Catches render errors below it and shows a plain way out instead of a blank screen.
 * routes.tsx wraps every page in one, so the site chrome stays up when a page breaks.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page error:', error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.retry);

    const stale = isStaleChunk(error);
    return (
      <div role="alert" className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-bold">{stale ? 'The site has been updated' : 'This page hit a problem'}</h1>
        <p className="mt-3">
          {stale
            ? 'Reload to get the current version. Your cart is saved.'
            : 'Something broke while showing this page. Your cart is saved. Try again, or reload the page.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          {!stale && (
            <button type="button" onClick={this.retry} className="min-h-11 border px-4 font-semibold">
              Try again
            </button>
          )}
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 border px-4 font-semibold">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
