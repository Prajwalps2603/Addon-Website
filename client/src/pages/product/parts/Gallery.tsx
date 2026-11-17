import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { ProductFrame } from '@/components/commerce';
import { IconButton, Modal } from '@/components/ui';
import { cn } from '@/lib/cn';
import { imageVariant } from '@/lib/images';

export interface GalleryProps {
  images: readonly string[];
  name: string;
  artKind: string;
  /** Dims every photo: the sold-out state. */
  muted?: boolean;
}

/**
 * Product photos. On a phone: a swipeable strip with dots. From 768 px: the same strip with
 * arrows and a row of thumbnails. A press on a photo opens it large in a viewer.
 * The first photo loads eagerly; the rest are lazy.
 */
export function Gallery({ images, name, artKind, muted = false }: GalleryProps) {
  const photos = images.length > 0 ? images : [''];
  const count = photos.length;
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  // Follow the swipe: the slide whose centre is nearest the strip's centre is the current one.
  const onScroll = useCallback(() => {
    const node = strip.current;
    if (!node || node.clientWidth === 0) return;
    const next = Math.round(node.scrollLeft / node.clientWidth);
    setIndex(Math.max(0, Math.min(count - 1, next)));
  }, [count]);

  const goTo = useCallback(
    (target: number) => {
      const node = strip.current;
      const clamped = Math.max(0, Math.min(count - 1, target));
      setIndex(clamped);
      if (!node) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      node.scrollTo({ left: clamped * node.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    },
    [count],
  );

  // A new photo set starts at the first photo.
  const setKey = images.join('|');
  useEffect(() => {
    setIndex(0);
    strip.current?.scrollTo({ left: 0 });
  }, [setKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    }
  };

  const hasPhotos = images.length > 0;

  return (
    <div className={cn('grid gap-3', count > 1 && 'md:grid-cols-[4.25rem_minmax(0,1fr)] md:gap-3')}>
      <div className="relative md:col-start-2 md:row-start-1">
        <div
          ref={strip}
          onScroll={onScroll}
          onKeyDown={count > 1 ? onKeyDown : undefined}
          role={count > 1 ? 'region' : undefined}
          aria-roledescription={count > 1 ? 'carousel' : undefined}
          aria-label={count > 1 ? `Photos of ${name}` : undefined}
          tabIndex={count > 1 ? 0 : undefined}
          className="focus-ring no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain border border-line"
        >
          {photos.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="w-full shrink-0 snap-center snap-always"
              role={count > 1 ? 'group' : undefined}
              aria-roledescription={count > 1 ? 'slide' : undefined}
              aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
            >
              {hasPhotos ? (
                <button
                  type="button"
                  onClick={() => setViewer(i)}
                  className="focus-ring-inset group block w-full cursor-zoom-in"
                  aria-label={`Open photo ${i + 1} of ${count} full size`}
                  tabIndex={i === index ? 0 : -1}
                >
                  <ProductFrame
                    image={url}
                    alt={i === 0 ? name : `${name}, photo ${i + 1}`}
                    artKind={artKind}
                    variant="full"
                    eager={i === 0}
                    muted={muted}
                    sizes="(min-width: 64rem) 34vw, 100vw"
                    className="aspect-[4/3]"
                  >
                    <span className="absolute top-3 right-3 grid size-9 place-items-center bg-black/70 text-white opacity-0 dur-quick transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Expand aria-hidden className="size-4" />
                    </span>
                  </ProductFrame>
                </button>
              ) : (
                <ProductFrame image={null} alt={name} artKind={artKind} variant="full" muted={muted} className="aspect-[4/3]" />
              )}
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            {/* Slanted counter, in the same lean as the drop badges. */}
            <span
              aria-hidden
              className="lean-box pointer-events-none absolute bottom-3 left-3 bg-black px-3 py-1 font-mono text-xs font-bold text-white tnum"
            >
              <span className="lean-undo inline-block">
                <span className="text-brand">{String(index + 1).padStart(2, '0')}</span>
                <span className="opacity-60"> / {String(count).padStart(2, '0')}</span>
              </span>
            </span>
            <div className="absolute right-3 bottom-3 hidden gap-1 md:flex">
              <IconButton
                label="Previous photo"
                variant="outline"
                size="sm"
                onClick={() => goTo(index - 1)}
                disabled={index === 0}
                className="border-black bg-black text-white hover:bg-brand disabled:opacity-40"
              >
                <ChevronLeft aria-hidden />
              </IconButton>
              <IconButton
                label="Next photo"
                variant="outline"
                size="sm"
                onClick={() => goTo(index + 1)}
                disabled={index === count - 1}
                className="border-black bg-black text-white hover:bg-brand disabled:opacity-40"
              >
                <ChevronRight aria-hidden />
              </IconButton>
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <>
          {/* Dots on a phone: each is a real button with a 44 px hit area. */}
          <div className="flex items-center justify-center gap-1 md:hidden">
            {photos.map((url, i) => (
              <button
                key={`dot-${url}-${i}`}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photo ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                className="focus-ring grid h-8 w-6 place-items-center"
              >
                <span
                  aria-hidden
                  className={cn('block h-1.5 rounded-full dur-base transition-transform', i === index ? 'w-4 bg-ink' : 'w-1.5 bg-line-strong')}
                />
              </button>
            ))}
          </div>

          {/* Thumbnails from 768 px: a vertical rail beside the photo, as tall as the photo. */}
          <div className="relative hidden md:col-start-1 md:row-start-1 md:block">
            <div className="no-scrollbar absolute inset-0 flex flex-col gap-2 overflow-y-auto">
              {photos.map((url, i) => (
                <button
                  key={`thumb-${url}-${i}`}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Show photo ${i + 1} of ${count}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'focus-ring-inset relative shrink-0 border-2 dur-quick transition-[border-color,opacity]',
                    i === index ? 'border-brand' : 'border-transparent opacity-60 hover:opacity-100',
                  )}
                >
                  <ProductFrame image={url} alt="" artKind={artKind} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {hasPhotos && (
        <PhotoViewer
          images={photos}
          name={name}
          artKind={artKind}
          index={viewer}
          onIndex={setViewer}
          onClose={() => {
            if (viewer !== null) goTo(viewer);
            setViewer(null);
          }}
        />
      )}
    </div>
  );
}

interface PhotoViewerProps {
  images: readonly string[];
  name: string;
  artKind: string;
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}

/** The large view: one photo at a time with arrows (and arrow keys). Built on the kit Modal for focus and Escape. */
function PhotoViewer({ images, name, artKind, index, onIndex, onClose }: PhotoViewerProps) {
  const open = index !== null;
  const current = index ?? 0;
  const count = images.length;

  useEffect(() => {
    if (!open || count < 2) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'ArrowRight') onIndex(Math.min(count - 1, current + 1));
      if (event.key === 'ArrowLeft') onIndex(Math.max(0, current - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, count, current, onIndex]);

  // Warm the neighbours so the arrows feel instant.
  useEffect(() => {
    if (!open) return;
    for (const neighbour of [images[current + 1], images[current - 1]]) {
      if (neighbour) {
        const img = new Image();
        img.src = imageVariant(neighbour, 1200);
      }
    }
  }, [open, current, images]);

  return (
    <Modal open={open} onClose={onClose} title={name} description={count > 1 ? `Photo ${current + 1} of ${count}` : undefined} size="lg">
      <div className="grid gap-3">
        <ProductFrame
          key={images[current]}
          image={images[current]}
          alt={current === 0 ? name : `${name}, photo ${current + 1}`}
          artKind={artKind}
          variant="full"
          eager
          sizes="(min-width: 48rem) 46rem, 100vw"
          className="mx-auto w-full max-w-[min(100%,70dvh)]"
        />
        {count > 1 && (
          <div className="flex items-center justify-between gap-3">
            <IconButton label="Previous photo" variant="outline" disabled={current === 0} onClick={() => onIndex(current - 1)}>
              <ChevronLeft aria-hidden />
            </IconButton>
            <p className="type-small text-muted tnum" aria-live="polite">
              {current + 1} / {count}
            </p>
            <IconButton label="Next photo" variant="outline" disabled={current === count - 1} onClick={() => onIndex(current + 1)}>
              <ChevronRight aria-hidden />
            </IconButton>
          </div>
        )}
      </div>
    </Modal>
  );
}
