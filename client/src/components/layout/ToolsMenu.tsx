import { useId, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { moveFocusWithin, useDisclosure } from './hooks';
import { TOOLS } from './nav';

/** "Tools": New Car planner and Pocket Builds, each with what it does. */
export function ToolsMenu() {
  const menu = useDisclosure<HTMLButtonElement>();
  const panelId = useId();

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    menu.setOpen(true);
    window.requestAnimationFrame(() => menu.panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus());
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (moveFocusWithin(event.currentTarget, event.key, 'a[href]')) event.preventDefault();
  };

  return (
    <div className="relative" onBlur={menu.onBlur}>
      <button
        ref={menu.triggerRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={panelId}
        onClick={() => menu.setOpen(!menu.open)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline-flex h-11 items-center gap-1 rounded-control px-3 font-bold text-ink transition-colors dur-quick hover:bg-surface-2',
          menu.open && 'bg-surface-2',
        )}
      >
        Tools
        <ChevronDown aria-hidden className={cn('size-4 transition-transform dur-base', menu.open && 'rotate-180')} />
      </button>
      <div
        ref={menu.panelRef}
        id={panelId}
        hidden={!menu.open}
        onKeyDown={onPanelKeyDown}
        onClick={menu.onPanelClick}
        className="absolute top-full left-0 mt-2 w-[22rem] animate-pop-in rounded-control border border-ink bg-raised p-1.5 text-ink shadow-pop"
      >
        <ul className="grid">
          {TOOLS.map(({ to, name, blurb, Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="focus-ring-inset flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors dur-quick hover:bg-surface-2"
              >
                <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span className="grid gap-0.5">
                  <span className="font-bold">{name}</span>
                  <span className="type-small text-muted">{blurb}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
