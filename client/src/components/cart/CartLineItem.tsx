import { Link } from 'react-router';
import { CircleAlert, Info, PackageX, Trash2, Wrench } from 'lucide-react';
import { CustomSummary, FitBadge, ProductFrame, QtyStepper } from '@/components/commerce';
import { Button, Skeleton, Switch } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import type { PricedLine } from '@/types/api';
import { isShowPlate, SHOW_PLATE_NOTE } from './lineNotes';
import { fittingTerms, setLineFitAtStudio } from './studioFit';
import type { CartRow } from './useCartRows';

export interface CartLineItemProps {
  row: CartRow;
  onQty: (row: CartRow, qty: number) => void;
  onRemove: (row: CartRow) => void;
  /** A newer price is on its way: the money dims, the controls stay live. */
  updating?: boolean;
  /** Drawer layout: smaller photo, design details folded into one line. */
  compact?: boolean;
  /** Called before following the product link (the drawer closes itself). */
  onNavigate?: () => void;
}

function issueText(line: PricedLine): { text: string; tone: 'stop' | 'warn' } | null {
  switch (line.issue) {
    case 'out_of_stock':
      return { text: 'Out of stock. It is not counted in your total. Remove it to check out.', tone: 'stop' };
    case 'unavailable':
      return { text: 'Cannot be bought as it is. Open the part to choose again, or remove it.', tone: 'stop' };
    case 'insufficient_stock':
      return { text: `Only ${line.maxQty} left. Your quantity is more than we have.`, tone: 'warn' };
    default:
      return null;
  }
}

/**
 * "Fit at our studio" for a line whose part the studio fits. Applies at once (the cart re-prices);
 * the charge for the whole line shows once it is on.
 */
function StudioFitToggle({ row, line, qty, compact }: { row: CartRow; line: PricedLine; qty: number; compact: boolean }) {
  const service = line.fittingService;
  if (!service) return null;
  // The store's flag shows at once; the server's answer follows.
  const on = row.input.fitAtStudio ?? line.fitAtStudio;
  const charge = service.charge * qty;
  return (
    <div className={cn('grid gap-0.5 border-t border-line pt-1', on && 'border-ink')}>
      <Switch
        checked={on}
        onChange={(event) => setLineFitAtStudio(row.key, event.target.checked)}
        label={
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <Wrench aria-hidden className="size-4 shrink-0" />
              Fit at our studio
            </span>
            {on && <span className="type-price tnum">{charge > 0 ? `+${formatINR(charge)}` : 'No charge'}</span>}
          </span>
        }
        description={compact ? fittingTerms(service) : `${service.name}. ${fittingTerms(service)}, GST included.`}
      />
    </div>
  );
}

/** One line of the cart: photo, name, option, design, fit, price, quantity, studio fitting, remove, and anything wrong with it. */
export function CartLineItem({ row, onQty, onRemove, updating = false, compact = false, onNavigate }: CartLineItemProps) {
  const vehicle = useActiveVehicle();
  const line = row.priced;
  if (!line) return <CartLineSkeleton compact={compact} />;

  const qty = row.input.qty;
  const issue = issueText(line);
  const counted = line.issue === null || line.issue === 'insufficient_stock';
  // Optimistic: the store's quantity at the server's unit price, until the new total arrives.
  const lineTotal = counted ? line.unitPrice * Math.min(qty, line.maxQty > 0 ? line.maxQty : qty) : 0;
  const name = line.variantName ? `${line.name} (${line.variantName})` : line.name;
  const soldOut = line.issue === 'out_of_stock' || line.issue === 'unavailable';

  return (
    <article
      aria-label={name}
      className={cn('grid gap-x-3 gap-y-2', compact ? 'grid-cols-[4.5rem_minmax(0,1fr)]' : 'grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)]')}
    >
      <Link to={`/p/${line.slug}`} onClick={onNavigate} tabIndex={-1} aria-hidden className="block self-start">
        <ProductFrame image={line.image} alt="" artKind={line.artKind} muted={soldOut} />
      </Link>

      <div className="grid min-w-0 content-start gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-0.5">
            <Link
              to={`/p/${line.slug}`}
              onClick={onNavigate}
              className="line-clamp-2 leading-snug font-bold underline-offset-4 hover:underline focus-ring"
            >
              {line.name}
            </Link>
            {line.variantName && <p className="type-small text-muted">{line.variantName}</p>}
          </div>
          <div className={cn('grid shrink-0 justify-items-end text-right transition-opacity dur-base', updating && 'opacity-60')}>
            <span className={cn('type-price tnum', !counted && 'text-muted line-through')}>{formatINR(counted ? lineTotal : line.unitPrice * qty)}</span>
            {qty > 1 && <span className="type-small text-muted tnum">{formatINR(line.unitPrice)} each</span>}
          </div>
        </div>

        {line.custom && <CustomSummary custom={line.custom} heading={!compact} />}
        {isShowPlate(line.custom) && (
          <p className="type-small flex items-start gap-1.5 text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{SHOW_PLATE_NOTE}</span>
          </p>
        )}

        {vehicle && line.fit !== null && <FitBadge product={line} />}

        {issue && (
          <p
            className={cn('type-small flex items-start gap-1.5 font-medium', issue.tone === 'stop' ? 'border border-stop bg-stop-soft px-2 py-1.5 text-stop' : 'text-warn')}
          >
            {issue.tone === 'stop' ? <PackageX aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
            <span>{issue.text}</span>
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {soldOut ? null : (
            <QtyStepper
              size="sm"
              value={qty}
              min={1}
              max={Math.max(1, line.maxQty)}
              label={`Quantity of ${name}`}
              onChange={(next) => onQty(row, next)}
            />
          )}
          {line.issue === 'insufficient_stock' && line.maxQty > 0 && (
            <Button variant="outline" size="sm" onClick={() => onQty(row, line.maxQty)}>
              Set to {line.maxQty}
            </Button>
          )}
          <button
            type="button"
            onClick={() => onRemove(row)}
            aria-label={`Remove ${name}`}
            className="focus-ring tap-44 inline-flex items-center gap-1 type-small font-medium text-muted transition-colors dur-quick hover:text-stop"
          >
            <Trash2 aria-hidden className="size-3.5" />
            Remove
          </button>
        </div>

        {!soldOut && <StudioFitToggle row={row} line={line} qty={qty} compact={compact} />}
      </div>
    </article>
  );
}

export function CartLineSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className={cn('grid gap-3', compact ? 'grid-cols-[4.5rem_minmax(0,1fr)]' : 'grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[7rem_minmax(0,1fr)]')}>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="grid content-start gap-2">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="mt-2 h-9 w-28" />
      </div>
    </div>
  );
}
