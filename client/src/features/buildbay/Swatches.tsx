import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { NamedColour } from '@/features/buildbay/stage/styles';

export interface SwatchesProps {
  /** Names the group: "Paint", "Underglow colour". */
  label: string;
  colours: readonly NamedColour[];
  value: string | null | undefined;
  onChange: (hex: string) => void;
  className?: string;
}

/**
 * A row of colour chips that works as a radio group: Tab reaches it once, arrow keys move the choice.
 * The colour name is always written beside the row, so colour is never the only signal.
 */
export function Swatches({ label, colours, value, onChange, className }: SwatchesProps) {
  const group = useRef<HTMLDivElement>(null);
  const current = colours.find((colour) => colour.hex.toLowerCase() === (value ?? '').toLowerCase());

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = Math.max(0, colours.findIndex((colour) => colour === current));
    let next = at;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % colours.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + colours.length) % colours.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = colours.length - 1;
    else return;
    event.preventDefault();
    const target = colours[next];
    onChange(target.hex);
    group.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-label text-muted">{label}</span>
        <span className="type-small font-bold" aria-hidden>
          {current?.name ?? 'Custom'}
        </span>
      </div>
      <div ref={group} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex flex-wrap gap-1.5">
        {colours.map((colour, index) => {
          const checked = colour === current;
          const focusable = checked || (!current && index === 0);
          return (
            <button
              key={colour.hex}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={colour.name}
              title={colour.name}
              tabIndex={focusable ? 0 : -1}
              onClick={() => onChange(colour.hex)}
              className={cn(
                'focus-ring grid size-11 place-items-center rounded-control border transition-transform dur-quick active:scale-95',
                checked ? 'border-ink' : 'border-line',
              )}
            >
              <span
                aria-hidden
                className={cn('grid size-8 place-items-center rounded-full border border-line-strong', checked && 'size-9')}
                style={{ backgroundColor: colour.hex }}
              >
                {checked && (
                  <span className="grid size-5 place-items-center rounded-full bg-ink text-page">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
