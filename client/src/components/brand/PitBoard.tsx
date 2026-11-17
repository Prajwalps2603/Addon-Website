import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/*
 * The pit board: a slab holding separate slotted tiles with large tabular characters.
 * It appears where the store tells you a status: the car selector, the cart total, order tracking.
 * The board is its own plane (black in the light theme, paper in the dark theme), so everything
 * placed on it picks up the right ink, lines and focus ring by itself.
 */

export interface PitBoardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'div' | 'section' | 'aside' | 'form';
  /** A short line at the top of the board saying what it reports, e.g. "Your car". */
  title?: ReactNode;
  /** Sits opposite the title: a "Change" link, a count. */
  aside?: ReactNode;
}

export function PitBoard({ as: Tag = 'div', title, aside, className, children, ...rest }: PitBoardProps) {
  return (
    <Tag {...rest} className={cn('plane-board flex flex-col gap-3 p-3 sm:p-4', className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3">
          {title && <div className="type-label text-muted">{title}</div>}
          {aside && <div className="type-small ml-auto">{aside}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

const TILE_SIZES = {
  sm: 'h-8 min-w-6 text-lg',
  md: 'h-11 min-w-8 text-2xl',
  lg: 'h-14 min-w-10 text-4xl',
  /** Hero size: scales with the viewport. */
  xl: 'h-[1.5em] min-w-[1.05em] type-board',
} as const;

const TILE_TONES = {
  /** Red plate, white character: the reading that matters. */
  brand: 'bg-brand text-brand-ink',
  /** Deprecated name of `brand`. */
  pit: 'bg-brand text-brand-ink',
  /** White plate on the black board (it inverts with the board in the dark theme). */
  paper: 'bg-ink text-page',
  /** An empty slot. */
  blank: 'bg-surface-2 text-muted',
} as const;

export interface BoardTileProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TILE_TONES;
  size?: keyof typeof TILE_SIZES;
}

/** One slotted plate: a single character, or a short reading such as "P1" or "24". */
export function BoardTile({ tone = 'paper', size = 'md', className, children, ...rest }: BoardTileProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-grid place-items-center rounded-control px-[0.16em] font-extrabold uppercase leading-none tnum print-exact',
        TILE_SIZES[size],
        TILE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface BoardWordProps {
  /** The reading, e.g. "SWIFT 2019" or "186 PARTS FIT". Keep it short: a board holds a few words. */
  text: string;
  tone?: keyof typeof TILE_TONES;
  size?: keyof typeof TILE_SIZES;
  className?: string;
}

/**
 * A reading spelt out one tile per character. When the text changes, only the tiles that
 * changed roll in, left to right. The first render never animates.
 */
export function BoardWord({ text, tone = 'paper', size = 'md', className }: BoardWordProps) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);

  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  let index = 0;
  return (
    <span className={cn('inline-flex flex-wrap gap-y-0.5', WORD_GAPS[size], className)}>
      <span className="sr-only">{text}</span>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} aria-hidden className="inline-flex gap-0.5">
          {Array.from(word).map((char) => {
            const position = index;
            index += 1;
            // The key changes with the character, so a changed tile is a new tile and rolls in once.
            return (
              <RollingTile key={`${position}-${char}`} tone={tone} size={size} roll={mounted.current} delay={position * 30}>
                {char}
              </RollingTile>
            );
          })}
        </span>
      ))}
    </span>
  );
}

const WORD_GAPS = {
  sm: 'gap-x-2',
  md: 'gap-x-3',
  lg: 'gap-x-4',
  xl: 'gap-x-[0.4em] type-board',
} as const;

interface RollingTileProps {
  tone: keyof typeof TILE_TONES;
  size: keyof typeof TILE_SIZES;
  /** Whether the board was already on screen when this tile was created. */
  roll: boolean;
  delay: number;
  children: ReactNode;
}

function RollingTile({ tone, size, roll, delay, children }: RollingTileProps) {
  // Decided once, when the tile is created, so later renders neither restart nor cut the animation.
  const [rolls] = useState(roll);
  return (
    <BoardTile
      tone={tone}
      size={size}
      className={rolls ? 'animate-tile-roll' : undefined}
      style={rolls ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </BoardTile>
  );
}

export interface BoardSlotProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** What the slot holds: "Make", "Model", "Year". */
  label: string;
  /** The chosen value. Empty shows the placeholder and the slot reads as unfilled. */
  value?: string | null;
  placeholder?: string;
}

/**
 * A slot on the board that opens a picker: the make, model and year controls of the car selector.
 * A real button, at least 56 px tall.
 */
export const BoardSlot = forwardRef<HTMLButtonElement, BoardSlotProps>(function BoardSlot(
  { label, value, placeholder = 'Choose', className, type = 'button', ...rest },
  ref,
) {
  const filled = Boolean(value);
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cn(
        'flex min-h-14 w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left',
        'transition-colors dur-quick active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45',
        filled ? 'bg-ink text-page' : 'bg-surface-2 text-ink hover:bg-line',
        className,
      )}
    >
      <span className="flex min-w-0 flex-col gap-1">
        <span className={cn('type-label', filled ? 'opacity-70' : 'text-muted')}>{label}</span>
        <span className="truncate text-lg leading-none font-extrabold uppercase tnum">{value || placeholder}</span>
      </span>
      <ChevronDown aria-hidden className="size-5 shrink-0" />
    </button>
  );
});
