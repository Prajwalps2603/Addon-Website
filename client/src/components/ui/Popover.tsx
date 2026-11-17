import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/cn';
import { getFocusable, useEscapeKey, useFloatingPosition, useOutsidePress, type Placement } from './a11y';
import { Portal } from './Portal';

interface TriggerProps {
  ref?: Ref<HTMLElement>;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
  'aria-controls'?: string | undefined;
}

export interface PopoverProps {
  /** One Button, IconButton or Chip. It gets the click handler and the ARIA wiring. */
  trigger: ReactElement<TriggerProps>;
  /** Names the panel for screen readers, e.g. "Sort by" or "What PCD means". */
  label: string;
  /** Panel content, or a function that receives `close`. */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  placement?: Placement;
  /** Controlled open state. Leave out to let the popover manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Classes for the panel, e.g. a width. */
  className?: string;
}

/**
 * A small panel anchored to its trigger: sort menus, a two-line explanation of a technical word,
 * share options. It flips to stay on screen, moves focus in when opened, and closes on Escape,
 * on a press outside, and when focus leaves. Focus then returns to the trigger.
 * For anything longer than a few lines, use a Drawer.
 */
export function Popover({ trigger, label, children, placement = 'bottom-start', open: controlled, onOpenChange, className }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const anchor = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const id = useId();

  const setOpen = (next: boolean) => {
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const close = () => {
    setOpen(false);
    anchor.current?.focus({ preventScroll: true });
  };

  const style = useFloatingPosition(anchor, panel, open, placement);
  useEscapeKey(open, close);
  useOutsidePress([anchor, panel], open, () => setOpen(false));

  useEffect(() => {
    if (!open || !panel.current) return;
    (getFocusable(panel.current)[0] ?? panel.current).focus({ preventScroll: true });
  }, [open]);

  // Tabbing past either end hands focus back to the trigger instead of dropping it at the end of the page.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !panel.current) return;
    const items = getFocusable(panel.current);
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (items.length === 0 || document.activeElement === edge || document.activeElement === panel.current) {
      event.preventDefault();
      close();
    }
  };

  const triggerProps = trigger.props;
  const wired = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node;
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event);
      if (!event.defaultPrevented) setOpen(!open);
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
  });

  return (
    <>
      {wired}
      {open && (
        <Portal>
          <div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            data-floating
            data-print="hide"
            style={style}
            onKeyDown={onKeyDown}
            className={cn(
              'z-popover max-w-[calc(100vw-1rem)] min-w-48 animate-pop-in rounded-control border border-ink bg-raised p-3 text-ink shadow-pop outline-hidden',
              className,
            )}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>
        </Portal>
      )}
    </>
  );
}
