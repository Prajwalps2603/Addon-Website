import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Portal, useEscapeKey, useFloatingPosition, useOutsidePress } from '@/components/ui';
import { cn } from '@/lib/cn';
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryCategory, type GlossaryEntry } from '@/data/glossary';

/* ------------------------------------------------------------------ the glossary */

/** A short all-capital code (PCD, RC, H4, IP67) only counts when it is written that way. */
function isCode(word: string): boolean {
  return /^[A-Z0-9]{2,6}$/.test(word);
}

interface Needle {
  entry: GlossaryEntry;
  /** Set for codes: the text must match this spelling exactly. */
  exact: string | null;
}

const NEEDLES = new Map<string, Needle>();
for (const entry of GLOSSARY) {
  for (const word of [entry.term, ...entry.aliases]) {
    const key = word.toLowerCase();
    if (!NEEDLES.has(key)) NEEDLES.set(key, { entry, exact: isCode(word) ? word : null });
  }
}

function findEntry(word: string): GlossaryEntry | undefined {
  return NEEDLES.get(word.trim().replace(/\s+/g, ' ').toLowerCase())?.entry;
}

export interface Glossary {
  /** Every entry, grouped in the order of `categories`. */
  entries: readonly GlossaryEntry[];
  categories: readonly { id: GlossaryCategory; label: string }[];
  /** Looks a word up by its term or any alias, ignoring case. */
  find: (word: string) => GlossaryEntry | undefined;
  /** The entries of one category. */
  inCategory: (category: GlossaryCategory) => GlossaryEntry[];
}

const GLOSSARY_API: Glossary = {
  entries: GLOSSARY,
  categories: GLOSSARY_CATEGORIES,
  find: findEntry,
  inCategory: (category) => GLOSSARY.filter((entry) => entry.category === category),
};

/** The Plain Talk glossary: the entries, their categories and a lookup. Each entry's anchor is `/glossary#<id>`. */
export function useGlossary(): Glossary {
  return GLOSSARY_API;
}

/* ------------------------------------------------------------------ one word */

export interface JargonProps {
  /** The glossary word to explain. Defaults to the text inside. */
  term?: string;
  /** The words shown. Defaults to the term as the glossary writes it. */
  children?: ReactNode;
  className?: string;
}

type Mode = 'closed' | 'peek' | 'pinned';

/**
 * Wraps a technical word. A tap, a click or keyboard focus opens a two-line explanation in plain
 * language, with a link to the full glossary entry. A word the glossary does not know is left as plain text,
 * so it is always safe to wrap one.
 */
export function Jargon({ term, children, className }: JargonProps) {
  const word = term ?? (typeof children === 'string' ? children : '');
  const entry = findEntry(word);
  const [mode, setMode] = useState<Mode>('closed');
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const open = mode !== 'closed';

  const close = () => {
    if (panel.current?.contains(document.activeElement)) anchor.current?.focus({ preventScroll: true });
    setMode('closed');
  };

  const style = useFloatingPosition(anchor, panel, open, 'bottom-start', 6);
  useEscapeKey(open, close);
  useOutsidePress([anchor, panel], open, () => setMode('closed'));

  if (!entry) return <>{children ?? term}</>;

  // Focus from the keyboard shows the explanation without moving focus. A press pins it open,
  // and only then does Tab step into the panel to reach the glossary link.
  const onFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.target.matches(':focus-visible')) setMode((now) => (now === 'closed' ? 'peek' : now));
  };
  const onBlur = () => setMode((now) => (now === 'peek' ? 'closed' : now));
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Tab' || mode !== 'pinned') return;
    const link = event.shiftKey ? null : panel.current?.querySelector<HTMLAnchorElement>('a');
    if (link) {
      event.preventDefault();
      link.focus({ preventScroll: true });
    } else {
      setMode('closed');
    }
  };
  const onLinkKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    close();
  };

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setMode((now) => (now === 'pinned' ? 'closed' : 'pinned'))}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'inline cursor-help rounded-control text-left underline decoration-dotted decoration-1 underline-offset-4 hover:decoration-solid',
          className,
        )}
      >
        {children ?? entry.term}
      </button>
      {open && (
        <Portal>
          <div
            ref={panel}
            id={id}
            role="note"
            data-floating
            data-print="hide"
            style={style}
            className="z-popover grid w-72 max-w-[calc(100vw-1rem)] animate-pop-in gap-1 rounded-control border border-ink bg-raised p-3 text-ink shadow-pop"
          >
            <p className="type-small font-bold">{entry.term}</p>
            <p className="type-small">{entry.short}</p>
            <Link
              to={`/glossary#${entry.id}`}
              tabIndex={mode === 'pinned' ? 0 : -1}
              onClick={() => setMode('closed')}
              onKeyDown={onLinkKeyDown}
              className="link type-small mt-1 justify-self-start text-muted"
            >
              More in the glossary
            </Link>
          </div>
        </Portal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ running text */

type Piece = string | { text: string; entry: GlossaryEntry };

let pattern: RegExp | null = null;

/** One expression for every term and alias, longest first, matched only as whole words. */
function matcher(): RegExp {
  if (!pattern) {
    const phrases = [...NEEDLES.keys()]
      .sort((a, b) => b.length - a.length)
      .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${phrases.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  }
  return pattern;
}

function split(text: string): Piece[] {
  const pieces: Piece[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const match of text.matchAll(matcher())) {
    const found = match[0];
    const needle = NEEDLES.get(found.toLowerCase());
    if (!needle || (needle.exact !== null && found !== needle.exact) || seen.has(needle.entry.id)) continue;
    seen.add(needle.entry.id);
    const at = match.index ?? 0;
    if (at > last) pieces.push(text.slice(last, at));
    pieces.push({ text: found, entry: needle.entry });
    last = at + found.length;
  }
  if (last < text.length) pieces.push(text.slice(last));
  return pieces;
}

export interface JargonTextProps {
  /** Plain text from the catalogue: a spec value, a fit note, a line of a description. */
  text: string;
}

/**
 * Finds the glossary words in a piece of text and makes each one tappable, the first time it appears.
 * Everything else is passed through untouched.
 */
export function JargonText({ text }: JargonTextProps) {
  const pieces = useMemo(() => split(text), [text]);
  return (
    <>
      {pieces.map((piece, index) =>
        typeof piece === 'string' ? (
          piece
        ) : (
          <Jargon key={`${index}-${piece.entry.id}`} term={piece.entry.term}>
            {piece.text}
          </Jargon>
        ),
      )}
    </>
  );
}
