import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { IconButton, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface QuickEditProps {
  /** What the value is, e.g. "Stock of Addon Aero spoiler". Read by screen readers. */
  label: string;
  value: number;
  /** How the value reads when not being edited. */
  display: ReactNode;
  /** Rupees get a ₹ before the box. */
  money?: boolean;
  min?: number;
  /** Saves the new value. Resolve to close the editor, reject (or throw) to keep it open. */
  onSave: (value: number) => Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

/**
 * A number in a list row that can be changed in place: tap it, type, Enter saves, Escape cancels.
 * Made for a phone between calls: big targets, numeric keyboard, nothing else on the screen moves.
 */
export function QuickEdit({ label, value, display, money = false, min = 0, onSave, disabled = false, className }: QuickEditProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const close = (focusBack = true) => {
    setEditing(false);
    setProblem(null);
    if (focusBack) window.requestAnimationFrame(() => opener.current?.focus());
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed) || Number(trimmed) < min) {
      setProblem(`Enter a whole number${min > 0 ? ` from ${min}` : ''}.`);
      return;
    }
    const next = Number(trimmed);
    if (next === value) {
      close();
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      close();
    } catch {
      // The caller shows the reason in a toast; keep the box open to try again.
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        ref={opener}
        type="button"
        disabled={disabled}
        onClick={() => {
          setText(String(value));
          setEditing(true);
        }}
        className={cn(
          'focus-ring tap-44 group inline-flex min-h-9 items-center gap-1.5 rounded-control px-1.5 tnum transition-colors dur-quick',
          'hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent',
          className,
        )}
      >
        <span>{display}</span>
        {!disabled && <Pencil aria-hidden className="size-4 text-muted group-hover:text-ink" />}
        <span className="sr-only">Change {label}</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={cn('grid justify-items-end gap-1', className)} noValidate>
      <div className="flex items-center gap-1">
        <Input
          ref={input}
          aria-label={label}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
          }}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          leading={money ? <span className="type-small">₹</span> : undefined}
          invalid={problem !== null}
          className="w-28 tnum"
          disabled={saving}
        />
        <IconButton label={`Save ${label}`} type="submit" variant="dark" size="md" loading={saving}>
          <Check aria-hidden />
        </IconButton>
        <IconButton label="Cancel" onClick={() => close()} disabled={saving}>
          <X aria-hidden />
        </IconButton>
      </div>
      {problem && (
        <p role="alert" className="type-small text-stop">
          {problem}
        </p>
      )}
    </form>
  );
}
