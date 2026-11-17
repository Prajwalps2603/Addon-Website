import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import { cn } from '@/lib/cn';
import { InstagramIcon } from '@/components/brand';
import { ScrollDots, SectionHeading } from '@/components/commerce';
import { instagramHandle } from '@/components/layout/storeContact';
import type { PublicSettings, StudioWorkItem } from '@/types/api';

const card = 'relative aspect-[9/16] w-36 shrink-0 snap-start sm:w-44 lg:w-52';

/**
 * Stand-in photos for jobs that have no photo or video of their own yet, picked by what the job
 * was about. Each job takes the next unused photo of its kind, so no two cards repeat a picture.
 * The owner replaces them by adding a poster or reel video to the job in Admin → Settings.
 */
const STAND_INS: { match: RegExp; folder: string; count: number }[] = [
  { match: /\bdash ?cam/i, folder: 'dash-cam', count: 4 },
  { match: /\bfog\b|projector|\blamps?\b|\blights?\b|\bled\b/i, folder: 'fog-light', count: 5 },
  { match: /climate|stereo|android|screen|electronic/i, folder: 'head-unit', count: 6 },
  { match: /sub ?woofer|speaker|\baudio\b|\bamp/i, folder: 'subwoofer', count: 5 },
  { match: /footstep|side step|running board|exterior/i, folder: 'side-step', count: 5 },
  { match: /diffuser|body ?kit|spoiler|skirt/i, folder: 'diffuser', count: 5 },
];
const WIDE = [
  '/editorial/modified-car-01-960.webp',
  '/editorial/car-meet-01-960.webp',
  '/editorial/night-city-02-960.webp',
  '/editorial/night-city-01-960.webp',
  '/editorial/workshop-01-960.webp',
  '/editorial/headlight-rain-01-960.webp',
  '/editorial/interior-ambient-02-960.webp',
  '/editorial/daily-car-02-960.webp',
];

/** One photo per job, never the same photo twice in the row. */
function standIns(items: StudioWorkItem[]): string[] {
  const used = new Set<string>();
  const nth = new Map<string, number>();
  let wide = 0;
  const nextWide = () => {
    for (let i = 0; i < WIDE.length; i += 1) {
      const photo = WIDE[(wide + i) % WIDE.length]!;
      if (!used.has(photo)) {
        wide += i + 1;
        return photo;
      }
    }
    return WIDE[wide++ % WIDE.length]!;
  };
  return items.map((item) => {
    if (item.poster) return item.poster;
    const text = `${item.title} ${item.kind}`;
    const kind = /build|custom/i.test(text) ? null : STAND_INS.find((s) => s.match.test(text));
    let photo = '';
    if (kind) {
      const n = nth.get(kind.folder) ?? 0;
      if (n < kind.count) {
        nth.set(kind.folder, n + 1);
        photo = `/catalog/${kind.folder}/${kind.folder}-${String(n + 1).padStart(2, '0')}-480.webp`;
      }
    }
    if (!photo || used.has(photo)) photo = nextWide();
    used.add(photo);
    return photo;
  });
}

/** The full-size photo: the card is tall and the drift zooms in, so the 480 px thumbnail would blur. */
const sharp = (url: string) => url.replace(/-(480|960).webp$/, '.webp');

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One job. With a reel video it plays muted while the pointer is over it (on a phone, while the card
 * is in view) and stops when it leaves. Without one, the photo drifts slowly on hover. Opens the post.
 */
function WorkCard({ item, photo }: { item: StudioWorkItem; photo: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cardRef = useRef<HTMLLIElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const hasVideo = Boolean(item.video);

  const play = () => {
    const video = videoRef.current;
    if (!video || reducedMotion()) return;
    video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };
  const stop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setPlaying(false);
  };

  // Touch screens cannot hover: play while most of the card is on screen instead.
  useEffect(() => {
    const el = cardRef.current;
    if (!hasVideo || !el || canHover() || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => (entry && entry.intersectionRatio >= 0.6 ? play() : stop()), { threshold: [0, 0.6] });
    observer.observe(el);
    return () => observer.disconnect();
    // play and stop only touch refs and a setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVideo]);

  const Wrapper = item.url ? 'a' : 'div';
  return (
    <li ref={cardRef} className={card}>
      <Wrapper
        {...(item.url ? { href: item.url, target: '_blank', rel: 'noopener noreferrer' } : {})}
        onMouseEnter={hasVideo ? play : undefined}
        onMouseLeave={hasVideo ? stop : undefined}
        onFocus={hasVideo ? play : undefined}
        onBlur={hasVideo ? stop : undefined}
        className="focus-ring group relative block size-full overflow-hidden rounded-[14px] bg-black text-white"
      >
        <img
          src={sharp(photo)}
          alt=""
          width={360}
          height={640}
          loading="lazy"
          decoding="async"
          className={cn(
            'absolute inset-0 size-full scale-100 transform-gpu object-cover transition-[scale,opacity] duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] will-change-[scale] group-hover:scale-[1.08] group-focus-visible:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100',
            playing && 'opacity-0',
          )}
        />
        {hasVideo && (
          <video
            ref={videoRef}
            src={item.video}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', playing ? 'opacity-100' : 'opacity-0')}
          />
        )}
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(12_13_15/0.95)_0%,rgb(12_13_15/0.55)_38%,rgb(12_13_15/0.1)_70%)]" />
        <span className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          {item.kind && (
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[0.625rem] font-bold tracking-wide uppercase backdrop-blur-sm">{item.kind}</span>
          )}
          {item.url && (
            <span className="ml-auto grid size-8 shrink-0 place-items-center rounded-full bg-white/90 text-black transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <ArrowUpRight aria-hidden className="size-4" />
            </span>
          )}
        </span>
        {hasVideo && !playing && (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black transition-transform group-hover:scale-110"
          >
            <Play className="ml-0.5 size-5 fill-current" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 grid gap-1 p-3.5">
          <span className="text-[0.9375rem] leading-tight font-bold sm:text-base">{item.title}</span>
          {item.car && (
            <span className="flex items-center gap-2 text-xs font-semibold text-white/75">
              <span aria-hidden className="h-0.5 w-4 -skew-x-12 bg-brand" />
              {item.car}
            </span>
          )}
        </span>
        {item.url && <span className="sr-only"> (opens on Instagram in a new tab)</span>}
      </Wrapper>
    </li>
  );
}

export interface StudioWorkProps {
  settings: PublicSettings | undefined;
}

/** "From the studio": the owner's real recent jobs from settings, in their order. Nothing when there are none. */
export function StudioWork({ settings }: StudioWorkProps) {
  const scroller = useRef<HTMLUListElement | null>(null);
  const items = (settings?.studioWork ?? []).filter((item) => item.title.trim());
  if (!settings || items.length === 0) return null;
  const instagram = settings.social.instagram.trim();
  const photos = standIns(items);

  return (
    <section aria-labelledby="home-studio-work" className="pb-[clamp(2.5rem,7vw,5rem)]">
      <div className="container-page grid gap-6">
        <SectionHeading
          id="home-studio-work"
          title="From the studio"
          description="Recent jobs our team has fitted, from our Instagram."
          action={
            instagram ? (
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring group/ig relative inline-flex items-center gap-3 rounded-full border border-line bg-raised py-1.5 pr-1.5 pl-1.5 shadow-[0_4px_18px_-10px_rgb(12_13_15/0.35)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)] hover:border-transparent hover:shadow-[0_10px_30px_-12px_rgb(214_41_118/0.55)]"
              >
                {/* The story ring: Instagram's gradient around the shop's mark, slowly turning on hover. */}
                <span className="relative grid size-11 shrink-0 place-items-center">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[conic-gradient(from_210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)] transition-transform duration-[1600ms] ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover/ig:rotate-180 motion-reduce:transition-none"
                  />
                  <span className="relative grid size-[2.35rem] place-items-center overflow-hidden rounded-full border-2 border-raised bg-white">
                    <img src="/brand/addon-mark.svg" alt="" width={28} height={28} className="size-7 object-contain" />
                  </span>
                </span>
                <span className="grid leading-tight">
                  <span className="text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">Watch our work</span>
                  <span className="font-bold text-ink">{instagramHandle(instagram)}</span>
                </span>
                <span className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-[linear-gradient(90deg,#d62976,#962fbf)] px-4 text-sm font-bold text-white transition-[filter] duration-300 group-hover/ig:brightness-110">
                  <InstagramIcon size={15} />
                  Follow
                </span>
                <span className="sr-only"> on Instagram (opens in a new tab)</span>
              </a>
            ) : undefined
          }
        />
        <ul ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:-mx-6 md:scroll-px-6 md:px-6 xl:-mx-8 xl:scroll-px-8 xl:px-8">
          {items.map((item, index) => (
            <WorkCard key={item.id} item={item} photo={photos[index] ?? WIDE[0]!} />
          ))}
        </ul>
        <ScrollDots target={scroller} label="From the studio" />
      </div>
    </section>
  );
}
