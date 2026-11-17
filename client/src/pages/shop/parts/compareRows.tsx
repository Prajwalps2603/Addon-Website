import type { ReactNode } from 'react';
import { BadgeCheck, CircleCheck, CircleHelp, CircleX, OctagonAlert, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import { CompoundRing } from '@/components/brand';
import { describeFit, DemoBadge, LEGALITY_WORDS, Price, StockNote, WARRANTY_WORDS, WIRING_WORDS, type LabelLevel } from '@/components/commerce';
import { Badge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel, pluralize } from '@/lib/format';
import type { FittedReportsResponse, ProductDetail, ProductSummary, Vehicle } from '@/types/api';

export interface CompareRow {
  key: string;
  label: ReactNode;
  /** Plain values used to decide whether the products differ on this row. null = not stated. */
  values: (string | null)[];
  cells: ReactNode[];
  /** Some cells are still loading: the row is never marked as differing until they arrive. */
  loading?: boolean;
}

export interface CompareGroup {
  key: string;
  title: string;
  /** The Straight Label group is set as the ink band, like the panel on the product page. */
  band?: boolean;
  rows: CompareRow[];
}

export function rowDiffers(row: CompareRow): boolean {
  if (row.loading || row.values.length < 2) return false;
  return new Set(row.values.map((value) => (value ?? '').trim().toLowerCase())).size > 1;
}

const LEVELS: Record<LabelLevel, { Icon: LucideIcon; text: string; spoken: string }> = {
  good: { Icon: CircleCheck, text: 'text-fit', spoken: 'Good: ' },
  caution: { Icon: TriangleAlert, text: 'text-warn', spoken: 'Caution: ' },
  stop: { Icon: OctagonAlert, text: 'text-stop', spoken: 'Warning: ' },
};

function Verdict({ level, children }: { level?: LabelLevel; children: ReactNode }) {
  const mark = level ? LEVELS[level] : null;
  return (
    <span className={cn('flex items-start gap-1.5 leading-snug font-bold', mark?.text)}>
      {mark && <mark.Icon aria-hidden className="mt-0.5 size-4 shrink-0" />}
      <span className="min-w-0">
        {mark && <span className="sr-only">{mark.spoken}</span>}
        {children}
      </span>
    </span>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <span className="type-small mt-1 block text-muted">{children}</span>;
}

function Loading() {
  return <Skeleton className="h-4 w-4/5" />;
}

function NotStated() {
  return <span className="text-muted">Not stated</span>;
}

const FIT_ICONS: Record<string, LucideIcon> = {
  direct: CircleCheck,
  with_work: Wrench,
  universal: CircleCheck,
  no: CircleX,
  unknown: CircleHelp,
  select: CircleHelp,
};

const FIT_TEXT: Record<string, string> = {
  fit: 'text-fit',
  warn: 'text-warn',
  stop: 'text-stop',
  info: 'text-info',
  plain: 'text-ink',
};

function costLabel(min: number, max: number): string {
  const low = Math.min(min, max) || Math.max(min, max);
  const high = Math.max(min, max);
  return low === high ? formatINR(high) : `${formatINR(low)} to ${formatINR(high)}`;
}

export interface BuildRowsInput {
  products: ProductSummary[];
  /** Details by product id, once loaded. */
  details: Map<number, ProductDetail>;
  /** Fitted report summaries by product id, once loaded. */
  reports: Map<number, FittedReportsResponse>;
  /** Whether each detail / report query has settled (loaded or failed). */
  detailsSettled: (id: number) => boolean;
  reportsSettled: (id: number) => boolean;
  vehicle: Vehicle | null;
  /** True while the catalogue holds seeded sample data: reports are labelled Sample. */
  sample: boolean;
  /** The "Select your car" control, placed in the fit row's label when there is no car. */
  selectCar: ReactNode;
}

/** The rows of the comparison, grouped: at a glance, the Straight Label, fitted reports, specifications. */
export function buildCompareGroups(input: BuildRowsInput): CompareGroup[] {
  const { products, details, reports, detailsSettled, reportsSettled, vehicle, sample, selectCar } = input;

  // ------------------------------------------------------------ at a glance
  const prices = products.map((product) => product.price);
  const lowest = Math.min(...prices);
  const lowestIsUnique = products.length > 1 && prices.filter((price) => price === lowest).length === 1;

  const glance: CompareRow[] = [
    {
      key: 'price',
      label: 'Price',
      values: products.map((product) => String(product.price)),
      cells: products.map((product) => (
        <div className="grid gap-1.5">
          <Price price={product.price} mrp={product.mrp} regularPrice={product.regularPrice} drop={product.drop} from={product.hasVariants} />
          {lowestIsUnique && product.price === lowest && (
            <Badge tone="best" size="sm" className="justify-self-start">
              Lowest here
            </Badge>
          )}
        </div>
      )),
    },
    {
      key: 'fit',
      label: (
        <>
          {vehicle ? `Fit on your ${vehicle.model}` : 'Fit on your car'}
          {!vehicle && <span className="mt-1 block font-normal">{selectCar}</span>}
        </>
      ),
      values: products.map((product) => describeFit(product, vehicle)?.state ?? 'none'),
      cells: products.map((product) => {
        const fit = describeFit(product, vehicle);
        if (!fit) return <span className="text-muted">Not a fitted part</span>;
        const Icon = fit.verified ? BadgeCheck : (FIT_ICONS[fit.state] ?? CircleHelp);
        return (
          <>
            <span className={cn('flex items-start gap-1.5 leading-snug font-bold', FIT_TEXT[fit.tone])}>
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                {fit.headline}
                {fit.verified && <span className="sr-only">, verified by the shop</span>}
              </span>
            </span>
            {fit.state !== 'select' && fit.detail && <Note>{fit.detail}</Note>}
          </>
        );
      }),
    },
    {
      key: 'stock',
      label: 'Stock',
      values: products.map((product) => (product.inStock ? (product.lowStock ? 'low' : 'in') : 'out')),
      cells: products.map((product) => <StockNote variant="full" stock={product.stock} inStock={product.inStock} lowStock={product.lowStock} />),
    },
  ];

  // ------------------------------------------------------------ the straight label
  const labelRow = (
    key: string,
    label: ReactNode,
    read: (detail: ProductDetail) => { value: string; cell: ReactNode },
  ): CompareRow => {
    const loading = products.some((product) => !details.has(product.id) && !detailsSettled(product.id));
    return {
      key,
      label,
      loading,
      values: products.map((product) => {
        const detail = details.get(product.id);
        return detail ? read(detail).value : null;
      }),
      cells: products.map((product) => {
        const detail = details.get(product.id);
        if (detail) return read(detail).cell;
        return detailsSettled(product.id) ? <NotStated /> : <Loading />;
      }),
    };
  };

  const straight: CompareRow[] = [
    labelRow('legality', 'Road legality', ({ label }) => {
      const words = LEGALITY_WORDS[label.legality];
      return { value: label.legality, cell: <Verdict level={words.level}>{words.label}</Verdict> };
    }),
    labelRow('warranty', 'Car warranty', ({ label }) => {
      const words = WARRANTY_WORDS[label.warrantyImpact];
      return { value: label.warrantyImpact, cell: <Verdict level={words.level}>{words.label}</Verdict> };
    }),
    labelRow('wiring', 'Wiring', ({ label }) => {
      const words = WIRING_WORDS[label.wiring];
      return { value: label.wiring, cell: <Verdict level={words.level}>{words.label}</Verdict> };
    }),
    labelRow('reversible', 'Can it be undone', ({ label }) => ({
      value: String(label.reversible),
      cell: <Verdict level={label.reversible ? 'good' : 'caution'}>{label.reversible ? 'Fully reversible' : 'A permanent change'}</Verdict>,
    })),
    labelRow('difficulty', 'Fitting difficulty', ({ label }) => ({
      value: String(label.installDifficulty),
      cell: <CompoundRing difficulty={label.installDifficulty} size={28} />,
    })),
    labelRow('time', 'Fitting time', ({ label }) => {
      const time = minutesLabel(label.installTimeMin, label.installTimeMax);
      return { value: time, cell: <span className="font-bold tnum">{time || 'Nothing to fit'}</span> };
    }),
    labelRow('who', 'Who should fit it', ({ label }) => ({
      value: String(label.proInstall),
      cell: <Verdict level={label.proInstall ? 'caution' : 'good'}>{label.proInstall ? 'A trained fitter' : 'You, or any local garage'}</Verdict>,
    })),
    labelRow('labour', 'Fair labour charge', ({ label }) => {
      const needsFitter = label.fittingCostMin > 0 || label.fittingCostMax > 0;
      const text = needsFitter ? costLabel(label.fittingCostMin, label.fittingCostMax) : 'No fitter needed';
      return { value: text, cell: <span className="font-bold tnum">{text}</span> };
    }),
    labelRow('skip', 'Skip this if', ({ label }) => ({
      value: label.skipIf,
      cell: label.skipIf ? <span>{label.skipIf}</span> : <span className="text-muted">We know of no reason to skip this one.</span>,
    })),
  ];

  // ------------------------------------------------------------ fitted reports
  const reportsLoading = products.some((product) => !reports.has(product.id) && !reportsSettled(product.id));
  const fitted: CompareRow[] = [
    {
      key: 'reports',
      label: 'What buyers reported',
      loading: reportsLoading,
      values: products.map((product) => {
        const summary = reports.get(product.id);
        return summary ? `${summary.total}:${summary.fittedOkPercent ?? ''}` : null;
      }),
      cells: products.map((product) => {
        const summary = reports.get(product.id);
        if (!summary) return reportsSettled(product.id) ? <span className="text-muted">Not available right now</span> : <Loading />;
        if (summary.total === 0) return <span className="text-muted">No fitted reports yet</span>;
        const time = minutesLabel(summary.medianTimeMinutes);
        return (
          <div className="grid gap-0.5">
            {summary.fittedOkPercent !== null && (
              <span className="font-bold tnum">{summary.fittedOkPercent}% fitted first time</span>
            )}
            <span className="type-small text-muted tnum">
              {pluralize(summary.total, 'report')}
              {time && `, usually ${time} to fit`}
              {summary.averageDifficulty !== null && `, felt ${summary.averageDifficulty.toFixed(1)} of 5 to fit`}
            </span>
            {sample && <DemoBadge className="mt-1 justify-self-start" />}
          </div>
        );
      }),
    },
  ];

  // ------------------------------------------------------------ specifications (the union)
  const specLabels: { key: string; label: string }[] = [];
  for (const product of products) {
    for (const spec of details.get(product.id)?.specs ?? []) {
      const key = spec.label.trim().toLowerCase();
      if (key && !specLabels.some((row) => row.key === key)) specLabels.push({ key, label: spec.label.trim() });
    }
  }
  const specsLoading = products.some((product) => !details.has(product.id) && !detailsSettled(product.id));
  const specs: CompareRow[] = specLabels.map(({ key, label }) => ({
    key: `spec:${key}`,
    label,
    loading: specsLoading,
    values: products.map((product) => details.get(product.id)?.specs.find((spec) => spec.label.trim().toLowerCase() === key)?.value ?? null),
    cells: products.map((product) => {
      const detail = details.get(product.id);
      if (!detail) return detailsSettled(product.id) ? <NotStated /> : <Loading />;
      const value = detail.specs.find((spec) => spec.label.trim().toLowerCase() === key)?.value;
      return value ? <span className="tnum">{value}</span> : <NotStated />;
    }),
  }));

  const groups: CompareGroup[] = [
    { key: 'glance', title: 'At a glance', rows: glance },
    { key: 'label', title: 'The Straight Label', band: true, rows: straight },
    { key: 'reports', title: 'Fitted reports', rows: fitted },
  ];
  if (specs.length > 0 || specsLoading) groups.push({ key: 'specs', title: 'Specifications', rows: specs });
  return groups;
}
