import type { ReactNode } from 'react';
import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CalloutTone = 'info' | 'warn' | 'danger' | 'good';

const TONES: Record<CalloutTone, { box: string; flag: string; Icon: LucideIcon }> = {
  info: { box: 'border-info bg-info-soft', flag: 'bg-info text-info-ink', Icon: Info },
  warn: { box: 'border-warn bg-warn-soft', flag: 'bg-warn text-warn-ink', Icon: TriangleAlert },
  danger: { box: 'border-stop bg-stop-soft', flag: 'bg-stop text-stop-ink', Icon: OctagonAlert },
  good: { box: 'border-fit bg-fit-soft', flag: 'bg-fit text-fit-ink', Icon: CircleCheck },
};

export interface CalloutProps {
  /**
   * `info` something worth knowing. `warn` read this before you buy (road rules, warranty, workshop needed).
   * `danger` something is wrong or will not work. `good` confirmed (it fits, payment received).
   */
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons or links under the text. */
  actions?: ReactNode;
  /** Replaces the tone's icon. */
  icon?: ReactNode;
  /** Announce it to screen readers the moment it appears: for errors and results that arrive after an action. */
  live?: boolean;
  className?: string;
}

/**
 * A boxed message inside the page. The square flag carries an icon, so the tone never rests on colour alone.
 * Say what happened and what to do next. Keep it in the flow: do not use a Modal for this.
 */
export function Callout({ tone = 'info', title, children, actions, icon, live = false, className }: CalloutProps) {
  const { box, flag, Icon } = TONES[tone];
  const role = live ? (tone === 'danger' ? 'alert' : 'status') : 'note';
  return (
    // data-paper: on the red plane the box keeps the light set, so its ink and tint stay legible.
    <div role={role} data-paper="" className={cn('flex items-start gap-3 rounded-control border p-3 text-ink', box, className)}>
      <span className={cn('grid size-7 shrink-0 place-items-center rounded-control [&_svg]:size-4', flag)}>
        {icon ?? <Icon aria-hidden />}
      </span>
      <div className="grid min-w-0 flex-1 gap-1 pt-0.5">
        {title && <p className="leading-snug font-bold">{title}</p>}
        {children && <div className="type-small">{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
