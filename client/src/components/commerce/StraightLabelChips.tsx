import { Ban, ShieldAlert, TriangleAlert, Wrench } from 'lucide-react';
import { CompoundRing } from '@/components/brand';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ProductSummary } from '@/types/api';
import { LEGALITY_WORDS, WARRANTY_WORDS } from './labelWords';

export interface StraightLabelChipsProps {
  product: Pick<ProductSummary, 'legality' | 'warrantyImpact' | 'installDifficulty' | 'proInstall'>;
  className?: string;
}

/**
 * The Straight Label cut down for a product card: fitting difficulty always, and the awkward facts
 * only when they apply (not road legal, a fitter is advised, the car warranty may be affected).
 * Good news takes no chip, so a card with one ring and nothing else is a part with no catches.
 */
export function StraightLabelChips({ product, className }: StraightLabelChipsProps) {
  const legality = LEGALITY_WORDS[product.legality];
  const warranty = WARRANTY_WORDS[product.warrantyImpact];

  return (
    <ul className={cn('flex flex-wrap items-center gap-x-2 gap-y-1.5', className)}>
      <li className="flex">
        <CompoundRing difficulty={product.installDifficulty} size={24} className="gap-1.5" />
      </li>
      {product.legality !== 'road_legal' && (
        <li className="flex">
          <Badge
            size="sm"
            tone={legality.level === 'stop' ? 'stop' : 'warn'}
            icon={legality.level === 'stop' ? <Ban aria-hidden /> : <TriangleAlert aria-hidden />}
          >
            {legality.chip}
          </Badge>
        </li>
      )}
      {product.proInstall && (
        <li className="flex">
          <Badge size="sm" variant="outline" icon={<Wrench aria-hidden />}>
            Fitter advised
          </Badge>
        </li>
      )}
      {product.warrantyImpact !== 'none' && (
        <li className="flex">
          <Badge size="sm" tone="warn" variant={product.warrantyImpact === 'likely' ? 'solid' : 'soft'} icon={<ShieldAlert aria-hidden />}>
            {warranty.chip}
          </Badge>
        </li>
      )}
    </ul>
  );
}
