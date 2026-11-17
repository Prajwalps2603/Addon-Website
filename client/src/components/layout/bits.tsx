import type { SVGProps } from 'react';
import { iconForArtKind } from '@/components/commerce/categoryIcons';
import { cn } from '@/lib/cn';
import { imageVariant } from '@/lib/images';
import { badgeCount } from './nav';

/** The small red count on the cart and saved icons. Hidden at zero; the control's label carries the number for screen readers. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.6875rem] leading-none font-extrabold text-brand-ink tnum',
        className,
      )}
    >
      {badgeCount(count)}
    </span>
  );
}

/**
 * A category's photo, or its icon on a quiet ground when it has none. Small enough for menus and
 * search rows, where the "Photo coming soon" frame would not fit its words.
 */
export function CategoryThumb({
  image,
  artKind,
  alt = '',
  className,
  width = 480,
}: {
  image: string | null | undefined;
  artKind: string | null | undefined;
  alt?: string;
  className?: string;
  /** Rendition to load. */
  width?: number;
}) {
  const src = imageVariant(image, width);
  const Icon = iconForArtKind(artKind);
  return (
    <span className={cn('plane-frame relative grid shrink-0 place-items-center overflow-hidden', className)}>
      {src ? (
        <img src={src} alt={alt} width={width} height={width} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <Icon aria-hidden strokeWidth={1.5} className="size-1/2 max-h-10 max-w-10 text-line-strong" />
      )}
    </span>
  );
}

/**
 * The dashboard headlamp tell-tale (a lamp with dipped beams), drawn on lucide's 24 px grid.
 * `lit` draws the beams: the lights are on, the site is in its night theme.
 */
export function HeadlampIcon({ lit, ...rest }: SVGProps<SVGSVGElement> & { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d="M13 5.5c4.4 0 8 2.9 8 6.5s-3.6 6.5-8 6.5c-.6 0-1-.4-1-1v-11c0-.6.4-1 1-1Z" fill={lit ? 'currentColor' : 'none'} />
      <path d="M3 9.5 9 8" opacity={lit ? 1 : 0.35} />
      <path d="M3 13.5 9 12" opacity={lit ? 1 : 0.35} />
      <path d="M3 17.5 9 16" opacity={lit ? 1 : 0.35} />
    </svg>
  );
}
