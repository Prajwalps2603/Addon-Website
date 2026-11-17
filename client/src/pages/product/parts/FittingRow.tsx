import { Link } from 'react-router';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { formatINR, minutesLabel } from '@/lib/format';
import type { ProductDetail } from '@/types/api';

/**
 * One row to the printable Fitting Card for the local mechanic, with the fair labour charge on it.
 * `elsewhere`: the studio can fit this part too, so the card is offered to those who fit it elsewhere.
 */
export function FittingRow({ product, elsewhere = false }: { product: ProductDetail; elsewhere?: boolean }) {
  const { fittingCostMin, fittingCostMax, installTimeMin, installTimeMax } = product.label;
  const needsFitter = fittingCostMin > 0 || fittingCostMax > 0;
  const cost =
    !needsFitter
      ? 'No fitter needed'
      : fittingCostMin === fittingCostMax || fittingCostMin === 0
        ? `Fair labour ${formatINR(fittingCostMax || fittingCostMin)}`
        : `Fair labour ${formatINR(fittingCostMin)} to ${formatINR(fittingCostMax)}`;
  const time = minutesLabel(installTimeMin, installTimeMax);
  const hasSteps = product.fittingSteps.length > 0 || product.fittingTools.length > 0;

  return (
    <Link
      to={`/fitting/${product.slug}`}
      className="focus-ring group flex items-center gap-3 border border-line-strong p-4 dur-quick transition-colors hover:border-ink hover:bg-surface"
    >
      <ClipboardList aria-hidden className="size-6 shrink-0" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-bold">{elsewhere ? 'Fitting it elsewhere? The Fitting Card' : 'The Fitting Card'}</span>
        <span className="type-small text-muted">
          {hasSteps ? 'Tools, steps and time for your mechanic, in English and Hindi. ' : 'For your mechanic, in English and Hindi. '}
          <span className="font-bold text-ink tnum">{cost}</span>
          {time && <span className="tnum">, {time}</span>}.
        </span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 dur-quick transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
