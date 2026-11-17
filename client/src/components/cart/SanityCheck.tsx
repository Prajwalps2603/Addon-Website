import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Car, CircleCheck, Lightbulb, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { useActiveVehicle } from '@/hooks/useActiveVehicle';
import { cn } from '@/lib/cn';
import { useUi } from '@/stores/ui';
import type { CartAdvice, PricedLine } from '@/types/api';

type Severity = CartAdvice['severity'];

const SEVERITY: Record<Severity, { word: string; plural: string; Icon: LucideIcon; text: string; flag: string }> = {
  // Outlined, tinted flags: danger never takes the look of the brand's solid red fill.
  problem: { word: 'Problem', plural: 'Problems', Icon: OctagonAlert, text: 'text-stop', flag: 'border border-stop bg-stop-soft text-stop' },
  warning: { word: 'Warning', plural: 'Warnings', Icon: TriangleAlert, text: 'text-warn', flag: 'border border-warn bg-warn-soft text-warn' },
  tip: { word: 'Tip', plural: 'Tips', Icon: Lightbulb, text: 'text-info', flag: 'border border-info bg-info-soft text-info' },
  good: { word: 'All good', plural: 'All good', Icon: CircleCheck, text: 'text-fit', flag: 'border border-fit bg-fit-soft text-fit' },
};

const ORDER: Severity[] = ['problem', 'warning', 'tip', 'good'];

/** Action labels name a part, so they may run long: let them wrap instead of widening the page. */
const WRAP = 'h-auto min-h-9 max-w-full py-1.5 text-left whitespace-normal';

/** Turns "/fitting/<slug>" in an advice message into a link to the fitting card. */
function withLinks(message: string, onNavigate?: () => void): ReactNode {
  const parts = message.split(/(?:the fitting card at\s+)?(\/fitting\/[a-z0-9-]+)/i);
  if (parts.length === 1) return message;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <Link key={index} to={part} onClick={onNavigate} className="font-bold underline underline-offset-4 hover:decoration-2 focus-ring">
        the fitting card
      </Link>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

export interface SanityCheckProps {
  advice: CartAdvice[];
  lines: PricedLine[];
  onRemoveProduct: (productId: number, name: string) => void;
  onAddProduct: (productId: number, label: string) => void;
  /** Drawer: problems and warnings only, with a link to the full check. */
  compact?: boolean;
  /** Closes the drawer before a link is followed. */
  onNavigate?: () => void;
  /** Heading id, for aria-labelledby and the drawer's link. */
  id?: string;
  className?: string;
}

/**
 * The Sanity Check: the server's advice on this cart, grouped by how much it matters, each with
 * its one-tap fix. With no car chosen it asks for the car first, because fit cannot be checked.
 */
export function SanityCheck({ advice, lines, onRemoveProduct, onAddProduct, compact = false, onNavigate, id = 'sanity-check', className }: SanityCheckProps) {
  const vehicle = useActiveVehicle();
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const shown = compact ? advice.filter((item) => item.severity === 'problem' || item.severity === 'warning') : advice;
  const nameFor = (productId: number) => lines.find((line) => line.productId === productId)?.name ?? 'This part';

  const noCar = !vehicle && (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border border-line-strong p-3">
      <p className="flex items-start gap-2">
        <Car aria-hidden className="mt-0.5 size-5 shrink-0" />
        <span>Pick your car and this cart is checked part by part for fit.</span>
      </p>
      <Button variant="outline" size="sm" onClick={openVehiclePicker} aria-haspopup="dialog">
        Choose your car
      </Button>
    </div>
  );

  if (compact) {
    if (!vehicle && shown.length === 0) return <div className={className}>{noCar}</div>;
    if (shown.length === 0) return null;
  }

  return (
    <section id={compact ? undefined : id} aria-labelledby={`${id}-heading`} className={cn('grid min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className={compact ? 'type-h3' : 'type-h2'}>
          Sanity check
        </h2>
        {vehicle && <p className="type-small text-muted">Checked against your {vehicle.label}</p>}
      </div>

      {noCar}

      {shown.length === 0 && vehicle && !compact && (
        <p className="flex items-start gap-2 text-muted">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-fit" />
          Nothing to flag in this cart.
        </p>
      )}

      {ORDER.map((severity) => {
        const items = shown.filter((item) => item.severity === severity);
        if (items.length === 0) return null;
        const { word, plural, Icon, text, flag } = SEVERITY[severity];
        return (
          <div key={severity} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
            <h3 className={cn('type-label flex items-center gap-1.5', text)}>
              <Icon aria-hidden className="size-4" />
              {items.length === 1 || severity === 'good' ? word : plural}
              {severity !== 'good' && <span className="tnum">({items.length})</span>}
            </h3>
            <ul className="grid border-t border-line">
              {items.map((item, index) => (
                <li key={`${item.code}-${index}`} className="flex items-start gap-3 border-b border-line py-3">
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-control [&_svg]:size-3.5', flag)}>
                    <Icon aria-hidden />
                  </span>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <p className="leading-snug break-words">
                      <span className="sr-only">{word}: </span>
                      {withLinks(item.message, onNavigate)}
                    </p>
                    {item.action && (
                      <div>
                        {item.action.type === 'remove' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => item.action && onRemoveProduct(item.action.productId, nameFor(item.action.productId))}
                          >
                            {item.action.label}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" className={WRAP} onClick={() => item.action && onAddProduct(item.action.productId, item.action.label)}>
                            {item.action.label}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {compact && (
        <Link
          to="/cart#sanity-check"
          onClick={onNavigate}
          className="type-small inline-flex items-center gap-1 justify-self-start font-bold underline underline-offset-4 hover:decoration-2 focus-ring"
        >
          See the full check
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </section>
  );
}
