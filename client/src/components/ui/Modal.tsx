import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDialog } from './a11y';
import { IconButton } from './IconButton';
import { Portal } from './Portal';

const WIDTHS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-3xl',
} as const;

export interface ModalProps {
  open: boolean;
  /** Called by the close button, Escape and a press on the backdrop. */
  onClose: () => void;
  /** Names the dialog. Always required, even when hidden. */
  title: ReactNode;
  /** Keeps the title for screen readers only. */
  titleHidden?: boolean;
  description?: ReactNode;
  /** The action row, right aligned: the confirming Button last. */
  footer?: ReactNode;
  size?: keyof typeof WIDTHS;
  /** Turn off while an action cannot be interrupted (a payment being confirmed). Hides the close button too. */
  dismissible?: boolean;
  /** Where focus lands on opening. Default: the dialog itself, or an element marked `data-autofocus`. */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
}

/**
 * A dialog that takes over the page: for a decision that must be made before going on
 * (confirm a cancellation, acknowledge the show-plate terms). Focus is trapped inside, Escape
 * closes it, the page behind does not scroll, and focus returns to where it was.
 * On a phone it rises from the bottom edge. If the content could live in the page, put it in the page.
 */
export function Modal({
  open,
  onClose,
  title,
  titleHidden = false,
  description,
  footer,
  size = 'md',
  dismissible = true,
  initialFocus,
  className,
  children,
}: ModalProps) {
  const dialog = useDialog({ open, onClose, dismissible, initialFocus, exitMs: 200 });
  if (!dialog.mounted) return null;
  const closing = dialog.state === 'closed';

  return (
    <Portal>
      <div data-print="hide" className="fixed inset-0 z-overlay flex items-end justify-center sm:items-center sm:p-6">
        <div
          aria-hidden
          onClick={dialog.onBackdrop}
          className={cn('absolute inset-0 bg-overlay', closing ? 'animate-fade-out' : 'animate-fade-in')}
        />
        <div
          ref={dialog.panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialog.titleId}
          aria-describedby={description ? dialog.descriptionId : undefined}
          tabIndex={-1}
          data-state={dialog.state}
          className={cn(
            'relative flex max-h-[92dvh] w-full flex-col border border-line bg-raised text-ink shadow-sheet outline-hidden',
            closing ? 'animate-sheet-out-bottom sm:animate-pop-out' : 'animate-sheet-in-bottom sm:animate-pop-in',
            WIDTHS[size],
            className,
          )}
        >
          <header
            className={cn(
              'flex items-start justify-between gap-4 px-4 pt-4 sm:px-6 sm:pt-5',
              titleHidden && !description ? 'absolute top-0 right-0 z-raised' : 'border-b border-line pb-3',
            )}
          >
            <div className="grid min-w-0 gap-1">
              <h2 id={dialog.titleId} className={cn('type-h3', titleHidden && 'sr-only')}>
                {title}
              </h2>
              {description && (
                <p id={dialog.descriptionId} className="type-small text-muted">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <IconButton label="Close" onClick={onClose} className="-mt-1.5 -mr-2 shrink-0">
                <X aria-hidden />
              </IconButton>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
}
