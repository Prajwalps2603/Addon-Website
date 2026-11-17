import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { imageSrcSet, imageVariant } from '@/lib/images';
import type { PromoBanner } from '@/types/api';

const PANEL: Record<PromoBanner['tone'], { panel: string; button: 'primary' | 'dark' }> = {
  // 'yellow' is the old name of the brand tone. The red plane belongs to the hero, so a brand promo is a quiet panel with the red button.
  yellow: { panel: 'bg-surface', button: 'primary' },
  dark: { panel: 'plane-board', button: 'primary' },
  light: { panel: 'bg-page', button: 'dark' },
};

function Banner({ promo, flip }: { promo: PromoBanner; flip: boolean }) {
  const tone = PANEL[promo.tone] ?? PANEL.light;
  const photo = promo.image ? imageVariant(promo.image, 960) : '';

  return (
    <article aria-label={promo.eyebrow || promo.title} className="grid overflow-hidden border border-line md:grid-cols-12">
      {photo && (
        <div className={cn('relative aspect-[16/9] bg-surface-2 md:col-span-7 md:aspect-auto md:min-h-80', flip && 'md:order-last')}>
          <img
            src={photo}
            srcSet={imageSrcSet(promo.image)}
            sizes="(min-width: 48rem) 58vw, 100vw"
            alt=""
            width={960}
            height={540}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </div>
      )}
      {/* The words sit on their own solid panel beside the photo, never over it, so they read in any light. */}
      <div className={cn('grid content-center gap-4 p-5 sm:p-8', tone.panel, photo ? 'md:col-span-5' : 'md:col-span-12')}>
        <h2 className="type-h2">{promo.title}</h2>
        {promo.subtitle && <p className="max-w-prose">{promo.subtitle}</p>}
        {promo.ctaLabel && promo.ctaHref && (
          <div>
            <Button to={promo.ctaHref} variant={tone.button}>
              {promo.ctaLabel}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

export interface PromoBannersProps {
  promos: PromoBanner[];
}

/** The owner's promos from Settings, as wide photo banners. Nothing is drawn when there are none. */
export function PromoBanners({ promos }: PromoBannersProps) {
  const live = promos.filter((promo) => promo.title.trim());
  if (live.length === 0) return null;
  return (
    <div className="container-page grid gap-6 pb-[clamp(2.5rem,7vw,5rem)]">
      {live.map((promo, index) => (
        <Banner key={promo.id} promo={promo} flip={index % 2 === 1} />
      ))}
    </div>
  );
}
