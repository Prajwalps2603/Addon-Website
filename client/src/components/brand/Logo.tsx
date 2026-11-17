import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';
import { LogoTyre, TYRE_BOX } from './logoTyre';

/*
 * The owner's logo, redrawn on the pixel grid of client/public/brand/addon-logo.png (1024 x 304)
 * and checked against it by overlay: heavy italic A, D, D, the tyre standing in for the O, then N,
 * with AUTO MOTIVE beneath. Letters take the text colour (black on light grounds, white on dark);
 * the tyre keeps its own colours: black rubber, Tread Red tread, silver alloy.
 */
const LETTERS =
  // A: flat top, triangular counter, and the slit that parts the bar from the right leg
  'M103 190L190 80Q196 72 205 72H233Q242 72 244 81L264 190H227L223 170L199 190ZM211 107L221 162H169Z' +
  // D
  'M277 190L318 77Q320 72 326 72H418C432 72 440 82 437 98C433 125 420 160 390 180C376 189 362 190 350 190Z' +
  'M347 102H389C394 102 396 107 394 113C388 135 375 155 352 162L333 163Z' +
  // second D: its back follows the curve of the first D's bowl
  'M395 190C420 175 437 140 444 98L447 78Q449 72 455 72H528C542 72 549 82 546 98C541 128 527 160 500 178C485 188 470 190 455 190Z' +
  'M457 102H503C508 102 510 107 508 113C502 135 488 155 465 162L432 163C445 145 452 125 457 102Z' +
  // N
  'M759 187L800 72H850L861 138L886 72H925L885 187H836L820 127L800 187Z';

// AUTO MOTIVE as single strokes, so it stays crisp at any size and needs no font.
const TAGLINE =
  'M106 231L125 210.5L144 231M113.5 224H137' +
  'M157.5 210.5L153.5 224C152 230 156 231 160 231H172C177 231 179 229 180 225L183.5 210.5' +
  'M190 211H222M206 211L201.5 231' +
  'M240 210.5H262C266 210.5 268 213 267 216L264 226C263 229 260 230.5 256 230.5H234C230 230.5 228 228 229 225L232 215C233 212 236 210.5 240 210.5Z' +
  'M298 231L304 210.5L320 225L340 210.5L335 231' +
  'M362 210.5H384C388 210.5 390 213 389 216L386 226C385 229 382 230.5 378 230.5H356C352 230.5 350 228 351 225L354 215C355 212 358 210.5 362 210.5Z' +
  'M383 211H420M401 211L396.5 231' +
  'M433 211L428.5 231' +
  'M447 210.5L462 230.5L487 210.5' +
  'M513 211H496L490 230.5H509M493 220.5H510';

const FULL_VIEWBOX = { x: 98, y: 24, width: 836, height: 232 };

export interface LogoProps extends Omit<SVGProps<SVGSVGElement>, 'height' | 'width' | 'viewBox'> {
  /** Rendered height in px. The full logo is 3.6 times as wide as it is tall; the mark is square. */
  height?: number;
  /** `full` is the wordmark with the tyre; `mark` is the tyre alone, for tight spaces. */
  variant?: 'full' | 'mark';
  /** AUTO MOTIVE under the wordmark. Turn it off below 28 px of height, where it cannot be read. */
  tagline?: boolean;
  /** `scroll` turns the alloy with the page's scroll progress (the Living O). Pure CSS, off under reduced motion. */
  roll?: 'none' | 'scroll';
  /** Accessible name. Pass '' when the logo sits inside a link or button that is already labelled. */
  label?: string;
}

/**
 * The store's logo. The letters follow the text colour, so they are black on the page and white in the
 * dark theme and on the board; the tyre always shows its red tread and silver alloy.
 */
export function Logo({
  height = 32,
  variant = 'full',
  tagline = true,
  roll = 'none',
  label = 'Addon Automotive',
  className,
  ...rest
}: LogoProps) {
  const a11y = label ? ({ role: 'img', 'aria-label': label } as const) : ({ 'aria-hidden': true } as const);
  const tyre = <LogoTyre roll={roll === 'scroll'} />;

  if (variant === 'mark') {
    const { x, y, size } = TYRE_BOX;
    return (
      <svg
        {...a11y}
        {...rest}
        viewBox={`${x} ${y} ${size} ${size}`}
        width={height}
        height={height}
        className={cn('shrink-0 text-ink', className)}
      >
        {tyre}
      </svg>
    );
  }

  const { x, y, width, height: boxHeight } = FULL_VIEWBOX;
  return (
    <svg
      {...a11y}
      {...rest}
      viewBox={`${x} ${y} ${width} ${boxHeight}`}
      width={Math.round((height * width) / boxHeight)}
      height={height}
      className={cn('shrink-0 text-ink', className)}
    >
      <path fill="currentColor" fillRule="evenodd" d={LETTERS} />
      {tagline && (
        <path fill="none" stroke="currentColor" strokeWidth={7.6} strokeLinejoin="round" d={TAGLINE} />
      )}
      {tyre}
    </svg>
  );
}
