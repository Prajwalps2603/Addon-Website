import { useId, useState, type ReactNode } from 'react';
import { BadgeCheck, ChevronDown } from 'lucide-react';
import { Jargon } from '@/components/commerce';
import { cn } from '@/lib/cn';
import type { BodyType, ProductDetail, ProductFitment } from '@/types/api';

export interface FitsTableProps {
  product: ProductDetail;
  activeVehicleId: number | null;
}

const BODY_WORDS: Record<BodyType, string> = {
  hatchback: 'Hatchbacks',
  sedan: 'Sedans',
  suv: 'SUVs',
  muv: 'MUVs',
  pickup: 'Pickups',
  coupe: 'Coupes',
};

const FIT_WORDS: Record<ProductFitment['fitType'], { label: string; text: string }> = {
  direct: { label: 'Direct fit', text: 'text-fit' },
  with_work: { label: 'With work', text: 'text-warn' },
  no: { label: 'Does not fit', text: 'text-stop' },
};

function years(fitment: ProductFitment): string {
  const { yearFrom, yearTo } = fitment.vehicle;
  return yearTo ? `${yearFrom} to ${yearTo}` : `${yearFrom} onwards`;
}

/**
 * "Fits these cars": every car we hold a verdict for, grouped by make, behind a disclosure.
 * Parts sold by body type or bolt pattern say that instead.
 */
export function FitsTable({ product, activeVehicleId }: FitsTableProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  let summary: string;
  let body: ReactNode;

  if (product.fitmentType === 'body_type' && product.bodyTypes.length > 0) {
    summary = 'Which cars it suits';
    body = (
      <p className="type-body">
        Made for {product.bodyTypes.map((type) => BODY_WORDS[type].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1')}. Any car of that
        body type takes it; check the size against yours.
      </p>
    );
  } else if (product.fitmentType === 'pcd' && product.pcd) {
    summary = 'Which cars it suits';
    body = (
      <p className="type-body">
        Fits any car with a <Jargon term="PCD">bolt pattern</Jargon> of <span className="font-bold tnum">{product.pcd}</span>. Check{' '}
        <Jargon term="Offset">offset</Jargon> and <Jargon term="Centre bore">centre bore</Jargon> too.
      </p>
    );
  } else if (product.fitments.length > 0) {
    const fits = product.fitments.filter((f) => f.fitType !== 'no').length;
    summary = `Fits these cars (${fits})`;
    const groups = new Map<string, ProductFitment[]>();
    for (const fitment of product.fitments) {
      const list = groups.get(fitment.vehicle.make) ?? [];
      list.push(fitment);
      groups.set(fitment.vehicle.make, list);
    }
    const makes = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    body = (
      <div className="grid gap-4">
        {makes.map(([make, list]) => (
          <div key={make} className="grid gap-1">
            <h3 className="type-label text-muted">{make}</h3>
            <ul className="divide-y divide-line border-y border-line">
              {list
                .sort((a, b) => a.vehicle.model.localeCompare(b.vehicle.model) || a.vehicle.yearFrom - b.vehicle.yearFrom)
                .map((fitment) => {
                  const words = FIT_WORDS[fitment.fitType];
                  const mine = fitment.vehicle.id === activeVehicleId;
                  return (
                    <li key={fitment.vehicle.id} className={cn('grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2.5', mine && 'bg-brand-soft px-2')}>
                      <p className="font-bold">
                        {fitment.vehicle.model}
                        {fitment.vehicle.generation && <span className="font-normal text-muted"> {fitment.vehicle.generation}</span>}
                        {mine && <span className="type-small font-normal text-muted"> (your car)</span>}
                      </p>
                      <p className={cn('type-small inline-flex items-center gap-1 text-right font-bold', words.text)}>
                        {fitment.isVerified && fitment.fitType === 'direct' && <BadgeCheck aria-label="Verified by the shop" className="size-4" />}
                        {words.label}
                      </p>
                      <p className="type-small text-muted tnum">{years(fitment)}</p>
                      {fitment.note && <p className="type-small col-span-2">{fitment.note}</p>}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    );
  } else {
    return null;
  }

  return (
    <div className="border-y border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex min-h-12 w-full items-center justify-between gap-3 text-left font-bold"
      >
        {summary}
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 dur-base transition-transform', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="pb-4">
        {body}
      </div>
    </div>
  );
}
