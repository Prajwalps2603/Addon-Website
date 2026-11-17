import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { imageSources, imageVariant } from '@/lib/images';
import { iconForArtKind } from './categoryIcons';

export interface ProductFrameProps {
  /** The photo URL from the API, or null when the product has none yet. */
  image: string | null | undefined;
  /** What the photo shows: usually the product name. */
  alt: string;
  /** Picks the placeholder icon when there is no photo. */
  artKind?: string | null;
  /**
   * `thumb` loads the 480 px rendition (cards, cart lines). `full` loads up to 1200 px with a srcSet (galleries).
   * `tiny` is for frames under about 64 px (search rows, order items): the 480 px photo, and with no photo the
   * category icon alone, since the words would not fit.
   */
  variant?: 'thumb' | 'full' | 'tiny';
  /** Load at once and at high priority: the first product image of a page. Everything else is lazy. */
  eager?: boolean;
  /** CSS `sizes` for the `full` variant. */
  sizes?: string;
  /** Dims the photo: the sold-out state. */
  muted?: boolean;
  className?: string;
  /** Furniture placed over the frame: stickers, the save button, quick add. Position each with `absolute`. */
  children?: ReactNode;
}

const DEFAULT_SIZES = '(min-width: 64rem) 50vw, 100vw';

/**
 * The 1:1 photo frame every product sits in: white in both themes, the photo cropped to fill.
 * With no photo, or one that fails to load, it shows the category icon and "Photo coming soon"
 * instead of a grey box or a broken image.
 */
export function ProductFrame({
  image,
  alt,
  artKind,
  variant = 'thumb',
  eager = false,
  sizes = DEFAULT_SIZES,
  muted = false,
  className,
  children,
}: ProductFrameProps) {
  const full = variant === 'full';
  const source = full ? imageSources(image, sizes) : { src: imageVariant(image, 480), srcSet: undefined, sizes: undefined };
  // Remembered per URL, so a new photo gets a fresh chance to load.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = source.src !== '' && failedSrc !== source.src;
  const Icon = iconForArtKind(artKind);
  const edge = full ? 1200 : 480;

  return (
    <div className={cn('plane-frame relative aspect-square overflow-hidden', className)}>
      {showPhoto ? (
        <img
          // A cached failure can settle before React attaches onError: catch it when the element mounts.
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0) setFailedSrc(source.src);
          }}
          src={source.src}
          srcSet={source.srcSet}
          sizes={source.sizes}
          alt={alt}
          width={edge}
          height={edge}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(source.src)}
          className={cn('size-full object-cover', muted && 'opacity-45')}
        />
      ) : (
        variant === 'tiny' ? (
          <div className={cn('grid size-full place-items-center', muted && 'opacity-45')}>
            <Icon aria-hidden strokeWidth={1.5} className="size-3/5 text-line-strong" />
            <span className="sr-only">Photo coming soon</span>
          </div>
        ) : (
        <div className={cn('flex size-full flex-col items-center justify-center gap-2 p-3 text-center', muted && 'opacity-45')}>
          <span className="grid size-[38%] max-h-24 max-w-24 place-items-center rounded-full border border-line">
            <Icon aria-hidden strokeWidth={1.5} className="size-1/2 text-line-strong" />
          </span>
          <span className="type-label text-muted">Photo coming soon</span>
        </div>
        )
      )}
      {children}
    </div>
  );
}
