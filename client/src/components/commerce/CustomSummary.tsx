import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { capitalize, formatNumber } from '@/lib/format';

export interface CustomSummaryProps {
  /** `PricedLine.custom` or `OrderItem.custom`: whatever the designer saved. Nothing is rendered when it is empty. */
  custom: Record<string, unknown> | null | undefined;
  /** Shows the design's name ("Show plate design") above the details. On by default. */
  heading?: boolean;
  className?: string;
}

interface Row {
  key: string;
  label: string;
  value: ReactNode;
}

/** Bookkeeping fields a shopper has no use for. */
const HIDDEN = new Set(['kind', 'type', 'version', 'v', 'id']);
/** Fields whose value is the shopper's own wording: shown exactly as typed. */
const FREE_TEXT = /text|line|name|note|message|title/i;
const HEX_COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const MAX_TEXT = 160;
const MAX_DEPTH = 2;

/** 'frameColor', 'frame_color' and 'frame-color' all become 'Frame colour'. */
function words(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\bcolor\b/g, 'colour');
  return capitalize(spaced);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalar(key: string, value: unknown): ReactNode {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? (Number.isInteger(value) ? formatNumber(value) : String(value)) : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  // Embedded previews and other bulk are not details.
  if (text === '' || text.length > MAX_TEXT || /^(data|blob):/i.test(text)) return null;
  if (HEX_COLOUR.test(text)) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 shrink-0 rounded-full border border-line-strong print-exact" style={{ backgroundColor: text }} />
        <span className="font-mono text-[0.75rem] uppercase">{text}</span>
      </span>
    );
  }
  // An option key such as 'gloss-black' reads better as words; what the shopper typed stays as typed.
  return FREE_TEXT.test(key) || /[A-Z\s]/.test(text) ? text : words(text);
}

function rowsOf(record: Record<string, unknown>, prefix: string, depth: number): Row[] {
  const rows: Row[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (HIDDEN.has(key) || key.startsWith('_') || value === null || value === undefined) continue;
    const label = prefix ? `${prefix} ${words(key).toLowerCase()}` : words(key);
    const path = prefix ? `${prefix}.${key}` : key;

    if (isRecord(value)) {
      if (depth < MAX_DEPTH) rows.push(...rowsOf(value, label, depth + 1));
      continue;
    }
    if (Array.isArray(value)) {
      const items = value.map((item) => scalar(key, item)).filter((item) => typeof item === 'string');
      if (items.length > 0) rows.push({ key: path, label, value: items.join(', ') });
      continue;
    }
    const shown = scalar(key, value);
    if (shown !== null) rows.push({ key: path, label, value: shown });
  }
  return rows;
}

/**
 * A customised product's design in readable form: the saved designer output (show plate text, size,
 * style and so on) as a short list of label and value. It reads any shape, so a new designer
 * needs no change here.
 */
export function CustomSummary({ custom, heading = true, className }: CustomSummaryProps) {
  if (!isRecord(custom)) return null;
  const rows = rowsOf(custom, '', 1);
  if (rows.length === 0) return null;
  const kind = typeof custom.kind === 'string' && custom.kind.trim() ? words(custom.kind) : 'Custom';

  return (
    <div className={cn('grid gap-1', className)}>
      {heading && <p className="type-label text-muted">{kind} design</p>}
      <dl className="type-small grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {rows.map((row) => (
          <Fragment key={row.key}>
            <dt className="text-muted">{row.label}</dt>
            <dd className="font-medium break-words">{row.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
