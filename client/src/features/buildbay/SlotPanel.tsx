import { Check, CircleX, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { StraightLabelChips } from '@/components/commerce';
import { ErrorState, FitBadge, Price, ProductFrame } from '@/components/commerce';
import { Badge, Button, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import type { ApiError } from '@/lib/api';
import type { BuildPart, BuildSlot, ProductSummary } from '@/types/api';
import { BUILD_SLOT_LABELS, buildStylesFor } from '@/features/buildbay/contract';
import type { BuildStyleOption } from '@/features/buildbay/contract';
import { GLOW_COLOURS, WHEEL_FINISHES } from '@/features/buildbay/stage/styles';
import { defaultColourFor } from './codec';
import { useBuildBay } from './store';
import { Swatches } from './Swatches';

export interface SlotPanelProps {
  slot: BuildSlot;
  products: ProductSummary[];
  isPending: boolean;
  error: ApiError | null;
  onRetry: () => void;
}

const SLOT_NOTES: Partial<Record<BuildSlot, string>> = {
  lowering: 'Lowering springs set the ride height to −1, coilovers to −2.',
  underglow: 'Glows at night. Switch the garage to night to see it.',
  lightBar: 'Lights up at night.',
};

/** The colour of a part from a product: its finish, where the part is drawn in a colour. */
function colourFrom(option: BuildStyleOption, product: ProductSummary | null, current: BuildPart | undefined): string | undefined {
  if (!option.takesColor) return undefined;
  if (product && /^#[0-9a-fA-F]{6}$/.test(product.finishColor)) return product.finishColor;
  return current?.color ?? defaultColourFor(option.slot);
}

function ProductRow({
  product,
  chosen,
  onChoose,
}: {
  product: ProductSummary;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <li className={cn('grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]', chosen && 'bg-brand-soft -mx-3 px-3')}>
      <Link to={`/p/${product.slug}`} className="focus-ring block" tabIndex={-1} aria-hidden>
        <ProductFrame image={product.image} alt="" artKind={product.artKind} variant="thumb" sizes="72px" />
      </Link>
      <div className="grid min-w-0 content-start gap-1">
        <Link to={`/p/${product.slug}`} className="link line-clamp-2 font-bold leading-snug">
          {product.name}
        </Link>
        <Price size="sm" price={product.price} mrp={product.mrp} regularPrice={product.regularPrice} drop={product.drop} from={product.hasVariants} />
        <FitBadge product={product} />
        <StraightLabelChips product={product} />
        {!product.inStock && (
          <p className="type-small inline-flex items-center gap-1.5 font-bold text-stop">
            <CircleX aria-hidden className="size-4 shrink-0" />
            Sold out
          </p>
        )}
      </div>
      <div className="col-span-2 sm:col-span-1 sm:self-center">
        <Button
          size="sm"
          variant={chosen ? 'dark' : 'outline'}
          aria-pressed={chosen}
          onClick={onChoose}
          iconLeft={chosen ? <Check aria-hidden /> : <Plus aria-hidden />}
          block
          className="sm:w-auto"
        >
          {chosen ? 'On the build' : 'Use this part'}
        </Button>
      </div>
    </li>
  );
}

/** One slot: every style the art offers on this body, the catalogue parts mapped to each, and the colour. */
export function SlotPanel({ slot, products, isPending, error, onRetry }: SlotPanelProps) {
  const build = useBuildBay((s) => s.build);
  const setPart = useBuildBay((s) => s.setPart);
  const part = build.parts[slot];
  const options = buildStylesFor(slot, build.bodyType);
  const slotLabel = BUILD_SLOT_LABELS[slot];
  const colourOption = part ? options.find((option) => option.style === part.style && option.takesColor) : undefined;

  const chooseStyle = (option: BuildStyleOption) => {
    setPart(slot, { style: option.style, ...(option.takesColor ? { color: colourFrom(option, null, part) } : {}), productId: null });
  };
  const chooseProduct = (option: BuildStyleOption, product: ProductSummary) => {
    setPart(slot, { style: option.style, ...(option.takesColor ? { color: colourFrom(option, product, part) } : {}), productId: product.id });
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="type-h3">{slotLabel}</h2>
          {SLOT_NOTES[slot] && <p className="type-small text-muted">{SLOT_NOTES[slot]}</p>}
        </div>
        {part && (
          <Button size="sm" variant="ghost" onClick={() => setPart(slot, null)} iconLeft={<Trash2 aria-hidden />}>
            Remove {slotLabel.toLowerCase()}
          </Button>
        )}
      </div>

      {colourOption && part && (
        <Swatches
          label={slot === 'wheels' ? 'Wheel finish' : `${slotLabel} colour`}
          colours={slot === 'wheels' ? WHEEL_FINISHES : GLOW_COLOURS}
          value={part.color}
          onChange={(color) => setPart(slot, { ...part, color }, `${slot} colour`)}
        />
      )}
      {colourOption && part?.productId && slot !== 'wheels' && (
        <p className="-mt-3 type-small text-muted">The colour here is a preview. The part&apos;s own colour is on its product page.</p>
      )}

      {error && !isPending && products.length === 0 && (
        <ErrorState size="sm" error={error} onRetry={onRetry} title="Could not load the parts for this slot" />
      )}

      <ul className="grid gap-4">
        {options.map((option) => {
          const matches = products.filter((product) => product.buildStyle === option.style);
          const styleOn = part?.style === option.style;
          const styleOnly = styleOn && !part?.productId;
          return (
            <li key={option.style} className="border-t border-ink pt-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="grid gap-0.5">
                  <h3 className="font-bold leading-snug">{option.label}</h3>
                  <p className="type-small text-muted tnum">
                    {isPending ? 'Looking in the catalogue' : matches.length ? `${pluralize(matches.length, 'part')} in the catalogue` : 'No matching part in the catalogue yet'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={styleOnly ? 'dark' : 'ghost'}
                  aria-pressed={styleOnly}
                  onClick={() => chooseStyle(option)}
                  iconLeft={styleOnly ? <Check aria-hidden /> : undefined}
                >
                  {styleOnly ? 'Style on the car' : 'Try the style'}
                </Button>
              </div>

              {isPending ? (
                <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 py-3" aria-hidden>
                  <Skeleton className="aspect-square" />
                  <div className="grid content-start gap-2">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ) : matches.length > 0 ? (
                <ul className="divide-y divide-line">
                  {matches.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      chosen={styleOn && part?.productId === product.id}
                      onChoose={() => chooseProduct(option, product)}
                    />
                  ))}
                </ul>
              ) : (
                styleOnly && (
                  <p className="mt-2">
                    <Badge tone="neutral" size="sm">
                      On the car as a style only
                    </Badge>
                  </p>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
