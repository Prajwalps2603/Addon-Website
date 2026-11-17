import { Link } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  Cable,
  CircleAlert,
  Clock3,
  Gavel,
  IndianRupee,
  OctagonX,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { ErrorState, SectionHeading } from '@/components/commerce';
import { Button, Skeleton } from '@/components/ui';
import { useOnScreen } from '@/hooks/useOnScreen';
import { useProduct } from '@/hooks/useProduct';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel } from '@/lib/format';
import { imageVariant } from '@/lib/images';
import type { ProductDetail, ProductSummary, StraightLabel } from '@/types/api';

const CALLOUTS: { name: string; says: string; Icon: LucideIcon }[] = [
  { name: 'Road legality', says: 'Legal as sold, check the local rules, or off-road only.', Icon: Gavel },
  { name: 'Car warranty', says: 'Whether a dealer could use it to refuse a claim.', Icon: ShieldCheck },
  { name: 'Fitting', says: 'How hard, how long, and what a garage should charge.', Icon: Clock3 },
  { name: 'Skip this if', says: 'The one honest reason not to buy it.', Icon: OctagonX },
];

type Tone = 'good' | 'warn' | 'bad';

/** Verdict colours on the dark sheet: bright enough to read on black, always paired with an icon and words. */
const TONE: Record<Tone, { text: string; bar: string; Icon: LucideIcon }> = {
  good: { text: 'text-[#5ee08f]', bar: 'bg-[#5ee08f]', Icon: BadgeCheck },
  warn: { text: 'text-[#ffad5c]', bar: 'bg-[#ffad5c]', Icon: TriangleAlert },
  bad: { text: 'text-[#ff7276]', bar: 'bg-[#ff7276]', Icon: CircleAlert },
};

function verdicts(label: StraightLabel): { name: string; Icon: LucideIcon; tone: Tone; says: string }[] {
  return [
    {
      name: 'Road legality',
      Icon: Gavel,
      ...(label.legality === 'road_legal'
        ? { tone: 'good' as const, says: 'Road legal' }
        : label.legality === 'check_rules'
          ? { tone: 'warn' as const, says: 'Check the rules' }
          : { tone: 'bad' as const, says: 'Off-road only' }),
    },
    {
      name: 'Car warranty',
      Icon: ShieldCheck,
      ...(label.warrantyImpact === 'none'
        ? { tone: 'good' as const, says: 'Not affected' }
        : label.warrantyImpact === 'possible'
          ? { tone: 'warn' as const, says: 'May be affected' }
          : { tone: 'bad' as const, says: 'Likely affected' }),
    },
    {
      name: 'Wiring',
      Icon: Cable,
      ...(label.wiring === 'none'
        ? { tone: 'good' as const, says: 'None needed' }
        : label.wiring === 'plug_and_play'
          ? { tone: 'good' as const, says: 'Plug and play' }
          : { tone: 'warn' as const, says: 'Cuts into wiring' }),
    },
    {
      name: 'Undo it later',
      Icon: RotateCcw,
      ...(label.reversible ? { tone: 'good' as const, says: 'Fully reversible' } : { tone: 'warn' as const, says: 'Permanent change' }),
    },
  ];
}

/** The catch as a sentence: without a repeated "Skip this if", starting with a capital. */
function sentence(text: string): string {
  const rest = text.trim().replace(/^skip this if[:,]?s*/i, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

const COMPOUND = ['S', 'S', 'M', 'H', 'H'] as const;
const COMPOUND_WORDS: Record<string, string> = { S: 'Easy DIY', M: 'Some skill', H: 'Workshop job' };

/** The label as a dark spec sheet: four verdict tiles, a difficulty gauge, time and labour as big numbers, and the catch. */
function LabelSheet({ product }: { product: ProductDetail }) {
  const label = product.label;
  const level = label.installDifficulty;
  const compound = COMPOUND[level - 1] ?? 'M';
  const time = minutesLabel(label.installTimeMin, label.installTimeMax);
  const noFitter = label.fittingCostMin <= 0 && label.fittingCostMax <= 0;
  const cost = noFitter
    ? 'Do it yourself'
    : label.fittingCostMin === label.fittingCostMax
      ? formatINR(label.fittingCostMax)
      : `${formatINR(label.fittingCostMin)}–${formatINR(label.fittingCostMax).replace('₹', '')}`;
  const photo = product.image ? imageVariant(product.image, 480) : '';

  return (
    <article className="relative overflow-hidden rounded-[22px] bg-black text-white shadow-[0_30px_60px_-30px_rgb(12_13_15/0.6)]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />

      {/* Header: the product the label belongs to. */}
      <header className="flex items-center gap-4 border-b border-white/10 p-5 sm:p-6">
        {photo && (
          <img src={photo} alt="" width={64} height={64} loading="lazy" decoding="async" className="size-16 shrink-0 rounded-[12px] object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none font-black uppercase italic [font-stretch:85%] sm:text-2xl">The Straight Label</p>
          <Link to={`/p/${product.slug}`} className="mt-1.5 line-clamp-1 text-sm text-white/65 underline-offset-4 hover:text-white hover:underline">
            {product.name}
          </Link>
        </div>
      </header>

      {/* Four verdicts, each a tile with its colour bar. */}
      <ul className="grid grid-cols-2 gap-px bg-white/10">
        {verdicts(label).map(({ name, Icon, tone, says }) => {
          const t = TONE[tone];
          return (
            <li key={name} className="relative bg-black p-4 sm:p-5">
              <span aria-hidden className={cn('absolute top-0 left-4 h-0.5 w-8 sm:left-5', t.bar)} />
              <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-wide text-white/55 uppercase">
                <Icon aria-hidden className="size-3.5" />
                {name}
              </p>
              <p className={cn('mt-2 flex items-center gap-1.5 text-[0.9375rem] font-bold sm:text-base', t.text)}>
                <t.Icon aria-hidden className="size-4 shrink-0" />
                {says}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Fitting: the gauge, then time and labour as numbers. */}
      <div className="grid gap-5 border-t border-white/10 p-5 sm:grid-cols-[1.1fr_1fr_1fr] sm:p-6">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-wide text-white/55 uppercase">Fitting difficulty</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border-[3px] border-brand font-display text-base font-black italic">
              {compound}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex gap-1" role="img" aria-label={`Difficulty ${level} of 5`}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <span key={step} className={cn('h-2 flex-1 -skew-x-12 rounded-[2px]', step <= level ? 'bg-brand' : 'bg-white/15')} />
                ))}
              </div>
              <p className="mt-1.5 text-sm font-bold">{COMPOUND_WORDS[compound]}</p>
            </div>
          </div>
        </div>
        <Stat Icon={Clock3} name="Fitting time" value={time || 'Varies'} />
        <Stat Icon={IndianRupee} name="Fair labour" value={cost} hint={noFitter ? undefined : label.proInstall ? 'Fitter advised' : 'Any local garage'} />
      </div>

      {/* The catch. */}
      {label.skipIf && (
        <div className="border-t border-white/10 p-5 sm:p-6">
          <div className="relative rounded-[12px] bg-white/[0.06] p-4 pl-5">
            <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r bg-brand" />
            <p className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-wide text-brand uppercase">
              <OctagonX aria-hidden className="size-3.5" />
              Skip this if
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-snug text-white/90">{sentence(label.skipIf)}</p>
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
        <span className="text-xs text-white/50">On every part in the shop</span>
        <Link to={`/p/${product.slug}`} className="group/l inline-flex items-center gap-1.5 text-sm font-bold">
          See the full label
          <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover/l:translate-x-1" />
        </Link>
      </footer>
    </article>
  );
}

function Stat({ Icon, name, value, hint }: { Icon: LucideIcon; name: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide text-white/55 uppercase">
        <Icon aria-hidden className="size-3.5" />
        {name}
      </p>
      <p className="mt-2.5 font-display text-2xl leading-none font-black italic tnum [font-stretch:85%]">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-white/55">{hint}</p>}
    </div>
  );
}

/** The featured product with the most to say on its label: the hardest to fit. */
function pickExample(products: readonly ProductSummary[]): ProductSummary | null {
  let best: ProductSummary | null = null;
  for (const product of products) {
    if (!best || product.installDifficulty > best.installDifficulty) best = product;
  }
  return best;
}

export interface StraightLabelExplainerProps {
  /** Candidates for the example label, usually the featured products. */
  products: readonly ProductSummary[];
}

/** The Straight Label explained in one screen: a real label for one product as a spec sheet, with short notes beside it. */
export function StraightLabelExplainer({ products }: StraightLabelExplainerProps) {
  const example = pickExample(products);
  const [ref, near] = useOnScreen<HTMLDivElement>({ once: true, rootMargin: '300px' });
  const detail = useProduct(example?.slug, { enabled: near && example !== null });

  return (
    <section aria-labelledby="home-label" className="section-y border-t border-line">
      <div className="container-page grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="grid content-start gap-7 lg:col-span-5">
          <SectionHeading
            id="home-label"
            title="The catch, in writing"
            description="Every part carries the Straight Label: the facts a seller would rather not print, set out like the label on a food packet."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {CALLOUTS.map(({ name, says, Icon }) => (
              <li key={name} className="rounded-[16px] border border-line p-4">
                <span className="grid size-9 place-items-center rounded-full bg-brand text-brand-ink">
                  <Icon aria-hidden className="size-4" />
                </span>
                <p className="mt-3 font-bold">{name}</p>
                <p className="type-small mt-1 text-muted">{says}</p>
              </li>
            ))}
          </ul>
          <div>
            <Button to="/straight-label" variant="outline">
              How we fill in the label
            </Button>
          </div>
        </div>

        <div ref={ref} className="min-w-0 lg:col-span-7">
          {!example ? null : detail.data ? (
            <LabelSheet product={detail.data} />
          ) : detail.error ? (
            <ErrorState size="sm" error={detail.error} title="Could not load this label" onRetry={() => void detail.refetch()} />
          ) : (
            <Skeleton aria-hidden className="h-[34rem] w-full rounded-[22px]" />
          )}
        </div>
      </div>
    </section>
  );
}
