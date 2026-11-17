import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/cn';
import { useEscapeKey, useFloatingPosition, type Placement } from './a11y';
import { Portal } from './Portal';

interface TargetProps {
  ref?: Ref<HTMLElement>;
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  'aria-describedby'?: string | undefined;
}

export interface TooltipProps {
  /** A few words. Plain text only. */
  content: ReactNode;
  /** One focusable element: a Button, IconButton or link. */
  children: ReactElement<TargetProps>;
  placement?: Placement;
  /** Milliseconds the pointer rests before the tip shows. Keyboard focus shows it at once. */
  delay?: number;
  className?: string;
}

/**
 * A short hint on hover and on keyboard focus. Touch screens have no hover, so a tooltip may only
 * repeat or expand what is already understandable without it: never the only place a fact lives.
 * For an explanation a shopper needs, use Popover.
 */
export function Tooltip({ content, children, placement = 'top', delay = 350, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();

  const show = (wait: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), wait);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const style = useFloatingPosition(anchor, tip, open, placement, 6);
  useEscapeKey(open, hide);

  const target = children.props;
  const wired = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node;
    },
    onMouseEnter: (event: MouseEvent<HTMLElement>) => {
      target.onMouseEnter?.(event);
      show(delay);
    },
    onMouseLeave: (event: MouseEvent<HTMLElement>) => {
      target.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      target.onFocus?.(event);
      if (event.target.matches(':focus-visible')) show(0);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      target.onBlur?.(event);
      hide();
    },
    'aria-describedby': open ? id : target['aria-describedby'],
  });

  return (
    <>
      {wired}
      {open && (
        <Portal>
          <div
            ref={tip}
            id={id}
            role="tooltip"
            data-floating
            data-print="hide"
            style={style}
            className={cn(
              'type-small pointer-events-none z-tooltip max-w-64 animate-fade-in rounded-control bg-ink px-2 py-1.5 font-medium text-page',
              className,
            )}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
