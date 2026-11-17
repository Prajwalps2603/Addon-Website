import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { moveItem } from './utils';

export interface FormSectionProps {
  id: string;
  title: string;
  /** One plain line on what this section decides. */
  description?: ReactNode;
  /** Sits opposite the heading: a count, a switch. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** One titled part of a long admin form. A strong rule opens it; the heading names it in capitals. */
export function FormSection({ id, title, description, aside, className, children }: FormSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cn('scroll-mt-24 border-t border-ink pt-5 pb-10 md:pt-6', className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="grid max-w-prose gap-1.5">
          <h2 id={`${id}-heading`} className="type-h2">
            {title}
          </h2>
          {description && <p className="type-small text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

/** A group name inside a section, set as a small label with a hairline. */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('type-label border-b border-line pb-2 text-muted', className)}>{children}</h3>;
}

export interface RowToolsProps {
  index: number;
  count: number;
  /** Names the item for screen readers: "step 2", "photo 3". */
  name: string;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  className?: string;
}

/** Up, down and remove for one item of a list. Buttons, so they work by touch and keyboard alike. */
export function RowTools({ index, count, name, onMove, onRemove, className }: RowToolsProps) {
  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      <IconButton label={`Move ${name} up`} size="sm" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp aria-hidden />
      </IconButton>
      <IconButton label={`Move ${name} down`} size="sm" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown aria-hidden />
      </IconButton>
      <IconButton label={`Remove ${name}`} size="sm" onClick={onRemove}>
        <Trash2 aria-hidden />
      </IconButton>
    </div>
  );
}

export interface StringListProps {
  /** The list's name, used for the add box label and screen-reader names. */
  label: string;
  /** What one item is called: "highlight", "tool". */
  itemName: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
  /** `chips` for short words (tags); `rows` for sentences that need reordering. */
  variant?: 'rows' | 'chips';
  /** Messages keyed by item index, from the form's errors. */
  itemErrors?: Record<number, string | undefined>;
  error?: string;
  hint?: ReactNode;
}

/** Edits a list of short texts: type and press Enter (or Add), reorder, remove. */
export function StringList({
  label,
  itemName,
  value,
  onChange,
  placeholder,
  max = 30,
  variant = 'rows',
  itemErrors = {},
  error,
  hint,
}: StringListProps) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const full = value.length >= max;

  const add = () => {
    const parts = variant === 'chips' ? draft.split(',') : [draft];
    const clean = parts.map((p) => p.trim()).filter(Boolean);
    if (clean.length === 0) return;
    const next = [...value];
    for (const item of clean) {
      if (next.length >= max) break;
      if (variant === 'chips' && next.some((v) => v.toLowerCase() === item.toLowerCase())) continue;
      next.push(item);
    }
    onChange(next);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || (variant === 'chips' && event.key === ',')) {
      event.preventDefault();
      add();
    } else if (variant === 'chips' && event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="type-small flex items-baseline justify-between gap-3 font-bold">
        <span>{label}</span>
        <span className="font-normal text-muted tnum">
          {value.length} of {max}
        </span>
      </label>

      {variant === 'chips' && value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((item, index) => (
            <li key={`${item}-${index}`}>
              <span className="inline-flex h-9 items-center gap-1 rounded-control border border-line-strong pr-0.5 pl-3 text-sm font-bold">
                {item}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="focus-ring tap-44 inline-flex size-8 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">Remove {itemName} {item}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {variant === 'rows' && value.length > 0 && (
        <ol className="grid gap-2" aria-label={label}>
          {value.map((item, index) => (
            <li key={index} className="grid gap-1">
              <div className="flex items-center gap-1">
                <Input
                  aria-label={`${itemName} ${index + 1}`}
                  value={item}
                  invalid={Boolean(itemErrors[index])}
                  onChange={(event) => onChange(value.map((v, i) => (i === index ? event.target.value : v)))}
                  className="min-w-0 flex-1"
                />
                <RowTools
                  index={index}
                  count={value.length}
                  name={`${itemName} ${index + 1}`}
                  onMove={(from, to) => onChange(moveItem(value, from, to))}
                  onRemove={() => onChange(value.filter((_, i) => i !== index))}
                />
              </div>
              {itemErrors[index] && (
                <p role="alert" className="type-small text-stop">
                  {itemErrors[index]}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {!full && (
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => variant === 'chips' && add()}
            placeholder={placeholder}
            className="min-w-0 flex-1"
            enterKeyHint="enter"
            autoComplete="off"
          />
          <Button variant="outline" onClick={add} disabled={draft.trim() === ''} iconLeft={<Plus aria-hidden />}>
            Add
          </Button>
        </div>
      )}
      {hint && <p className="type-small text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="type-small text-stop">
          {error}
        </p>
      )}
    </div>
  );
}

/** A tick-box chip set for a handful of fixed choices (body types, kit goals). */
export function ChoiceChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  error?: string;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="type-small mb-2 font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== option.value) : [...value, option.value])}
              className={cn(
                'focus-ring inline-flex h-11 items-center rounded-control border px-4 text-sm font-bold transition-colors dur-quick',
                on ? 'border-ink bg-ink text-page' : 'border-line-strong hover:border-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="type-small text-stop">
          {error}
        </p>
      )}
    </fieldset>
  );
}
