import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  /** Names the choice for screen readers, e.g. "View" or "Body type". */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Stretch across the container with equal segments. */
  block?: boolean;
  className?: string;
}

/**
 * Two to five choices where exactly one is always on: grid or list, hatchback / sedan / SUV,
 * English or Hindi. Works as a radio group: Tab reaches it once, arrow keys change it.
 */
export function Segmented<T extends string = string>({ label, options, value, onChange, size = 'md', block = false, className }: SegmentedProps<T>) {
  const group = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((option) => !option.disabled);
    const at = enabled.findIndex((option) => option.value === value);
    let next = at;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % enabled.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else return;
    event.preventDefault();
    const target = enabled[next];
    if (!target) return;
    onChange(target.value);
    group.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(target.value)}"]`)?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('inline-flex gap-1 rounded-full bg-surface p-1', block && 'flex w-full', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            data-value={option.value}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap select-none',
              'transition-colors dur-quick disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
              size === 'sm' ? 'h-8 px-2.5 text-[0.8125rem]' : 'h-10 px-3.5 text-sm',
              block && 'flex-1',
              checked ? 'bg-ink text-page shadow-sm' : 'text-muted hover:bg-raised hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
