import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Boxes, Check, ChevronDown, MessageCircleQuestion, RotateCcw, ShieldAlert, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface KindOption<T extends string> {
  value: T;
  label: string;
  description: string;
}

const ICONS: Record<string, LucideIcon> = {
  contact: MessageCircleQuestion,
  install: Wrench,
  return: RotateCcw,
  complaint: ShieldAlert,
  bulk: Boxes,
};

export interface KindDropdownProps<T extends string> {
  label: string;
  options: KindOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
}

/**
 * A styled dropdown for "What is it about?": a rounded button showing the choice and its line of
 * explanation, opening a rounded list with an icon per option. A real listbox: arrows, Enter, Escape.
 */
export function KindDropdown<T extends string>({ label, options, value, onChange, error }: KindDropdownProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const chosen = options.find((o) => o.value === value) ?? options[0];
  const ChosenIcon = (chosen && ICONS[chosen.value]) || MessageCircleQuestion;

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) pick(active);
      else setOpen(true);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative grid gap-1.5 sm:max-w-md">
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex w-full items-center gap-3 rounded-[14px] border-[1.5px] bg-surface px-3.5 py-3 text-left transition-colors hover:bg-surface-2',
          open ? 'border-line-strong bg-surface-2' : 'border-transparent',
          error && 'border-stop',
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised text-brand-text">
          <ChosenIcon aria-hidden className="size-4" />
        </span>
        <span id={`${id}-value`} className="grid min-w-0 flex-1">
          <span className="font-semibold">{chosen?.label}</span>
          <span className="truncate text-sm text-muted">{chosen?.description}</span>
        </span>
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="absolute top-full right-0 left-0 z-popover mt-2 grid animate-pop-in gap-0.5 rounded-[16px] border border-line bg-raised p-1.5 shadow-[0_18px_40px_-14px_rgb(12_13_15/0.3)]"
        >
          {options.map((option, index) => {
            const Icon = ICONS[option.value] ?? MessageCircleQuestion;
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors',
                  index === active ? 'bg-surface' : '',
                )}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', selected ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-ink')}>
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="font-semibold">{option.label}</span>
                  <span className="text-sm text-muted">{option.description}</span>
                </span>
                {selected && <Check aria-hidden className="size-4 shrink-0 text-brand-text" strokeWidth={3} />}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="text-sm text-stop">{error}</p>}
    </div>
  );
}
