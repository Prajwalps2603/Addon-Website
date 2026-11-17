import type { ReactNode, RefObject } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDialog } from './a11y';
import { IconButton } from './IconButton';
import { Portal } from './Portal';

const WIDTHS = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-xl',
} as const;

export interface DrawerProps {
  open: boolean;
  /** Called by the close button, Escape and a press on the backdrop. */
  onClose: () => void;
  /** Names the drawer. Always required, even when hidden. */
  title: ReactNode;
  titleHidden?: boolean;
  description?: ReactNode;
  /** Sits under the title, above the scrolling body: a search box, tabs. */
  toolbar?: ReactNode;
  /** Pinned to the bottom edge: the total and the main action. */
  footer?: ReactNode;
  /** The edge it slides from on desktop. On a phone it is always a bottom sheet. */
  side?: 'right' | 'left';
  size?: keyof typeof WIDTHS;
  /** `auto` grows with its content up to 90% of a phone screen. `full` fills a phone screen (the menu). */
  height?: 'auto' | 'full';
  dismissible?: boolean;
  /** Where focus lands on opening. Default: the drawer itself, or an element marked `data-autofocus`. */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
}

/**
 * A panel that slides over the page and keeps the page in sight: the cart, filters, the car picker,
 * the category sheet. From 768 px it is a full-height panel on the right (or left); below that it is
 * a bottom sheet, the reach of a thumb. Same keyboard behaviour as Modal.
 */
export function Drawer({
  open,
  onClose,
  title,
  titleHidden = false,
  description,
  toolbar,
  footer,
  side = 'right',
  size = 'md',
  height = 'auto',
  dismissible = true,
  initialFocus,
  className,
  children,
}: DrawerProps) {
  const dialog = useDialog({ open, onClose, dismissible, initialFocus, exitMs: 200 });
  if (!dialog.mounted) return null;
  const closing = dialog.state === 'closed';
  const right = side === 'right';

  return (
    <Portal>
      <div data-print="hide" className="fixed inset-0 z-overlay">
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
            'absolute inset-x-0 bottom-0 flex max-h-[90dvh] w-full flex-col border-t border-line bg-raised text-ink shadow-sheet outline-hidden',
            'md:inset-y-0 md:max-h-none md:border-t-0',
            right ? 'md:right-0 md:left-auto md:border-l' : 'md:right-auto md:left-0 md:border-r',
            closing
              ? cn('animate-sheet-out-bottom', right ? 'md:animate-sheet-out-right' : 'md:animate-sheet-out-left')
              : cn('animate-sheet-in-bottom', right ? 'md:animate-sheet-in-right' : 'md:animate-sheet-in-left'),
            WIDTHS[size],
            height === 'full' && 'h-dvh max-h-dvh border-t-0',
            className,
          )}
        >
          {/* The grip says "sheet" on a phone. It is not a control: the close button and the backdrop are. */}
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" />
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 pt-2 pb-3 md:px-5 md:pt-4">
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
              <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2 shrink-0">
                <X aria-hidden />
              </IconButton>
            )}
          </header>
          {toolbar && <div className="border-b border-line px-4 py-3 md:px-5">{toolbar}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">{children}</div>
          {footer && (
            <footer className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
}
