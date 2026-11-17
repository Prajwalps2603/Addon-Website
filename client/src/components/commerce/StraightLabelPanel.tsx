import { useId, type ReactNode } from 'react';
import { ArrowRight, CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { CompoundRing, compoundFor } from '@/components/brand';
import { cn } from '@/lib/cn';
import { formatINR, minutesLabel } from '@/lib/format';
import type { StraightLabel } from '@/types/api';
import { Jargon, JargonText } from './Jargon';
import { LEGALITY_WORDS, WARRANTY_WORDS, WIRING_WORDS, type LabelLevel } from './labelWords';

export interface StraightLabelPanelProps {
  /** `ProductDetail.label`. */
  label: StraightLabel;
  /** The heading element, to suit the page outline. */
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

const LEVELS: Record<LabelLevel, { Icon: LucideIcon; text: string; spoken: string }> = {
  good: { Icon: CircleCheck, text: 'text-fit', spoken: 'Good: ' },
  caution: { Icon: TriangleAlert, text: 'text-warn', spoken: 'Caution: ' },
  stop: { Icon: OctagonAlert, text: 'text-stop', spoken: 'Warning: ' },
};

interface RowProps {
  name: ReactNode;
  /** Leave out for a plain fact that is neither good nor bad (a time, a cost). */
  level?: LabelLevel;
  value: ReactNode;
  note?: ReactNode;
}

function Row({ name, level, value, note }: RowProps) {
  const mark = level ? LEVELS[level] : null;
  return (
    <div className="grid gap-x-4 gap-y-1 border-t border-line px-4 py-3 sm:grid-cols-[10rem_1fr]">
      <dt className="type-small font-bold text-muted">{name}</dt>
      <dd className="grid min-w-0 gap-1">
        <div className={cn('flex items-start gap-2 leading-snug font-bold', mark?.text)}>
          {mark && <mark.Icon aria-hidden className="mt-0.5 size-5 shrink-0" />}
          <span className="min-w-0">
            {mark && <span className="sr-only">{mark.spoken}</span>}
            {value}
          </span>
        </div>
        {note && <p className="type-small">{note}</p>}
      </dd>
    </div>
  );
}

function costLabel(min: number, max: number): string {
  const low = Math.min(min, max) || Math.max(min, max);
  const high = Math.max(min, max);
  return low === high ? formatINR(high) : `${formatINR(low)} to ${formatINR(high)}`;
}

/**
 * The Straight Label: the facts a seller would rather not print, set out like the label on a food packet.
 * Every row is always present, and a row with bad news is stated as plainly as one with good news.
 */
export function StraightLabelPanel({ label, headingLevel: Heading = 'h2', className }: StraightLabelPanelProps) {
  const headingId = useId();
  const legality = LEGALITY_WORDS[label.legality];
  const warranty = WARRANTY_WORDS[label.warrantyImpact];
  const wiring = WIRING_WORDS[label.wiring];
  const compound = compoundFor(label.installDifficulty);
  const time = minutesLabel(label.installTimeMin, label.installTimeMax);
  const needsFitter = label.fittingCostMin > 0 || label.fittingCostMax > 0;

  return (
    <section aria-labelledby={headingId} className={cn('border border-ink', className)}>
      <header className="bg-ink px-4 py-3 text-page print-exact">
        <Heading id={headingId} className="type-h2">
          The Straight Label
        </Heading>
        <p className="type-small mt-1 opacity-80">What we would want to know before buying it ourselves.</p>
      </header>

      <dl>
        <Row
          name="Road legality"
          level={legality.level}
          value={label.legality === 'off_road_only' ? <Jargon term="Off-road only">{legality.label}</Jargon> : legality.label}
          note={<JargonText text={label.legalityNote || legality.detail} />}
        />
        <Row
          name={<Jargon term="Car warranty">Car warranty</Jargon>}
          level={warranty.level}
          value={warranty.label}
          note={<JargonText text={label.warrantyNote || warranty.detail} />}
        />
        <Row
          name="Wiring"
          level={wiring.level}
          value={wiring.term ? <Jargon term={wiring.term}>{wiring.label}</Jargon> : wiring.label}
          note={wiring.detail}
        />
        <Row
          name="Can it be undone"
          level={label.reversible ? 'good' : 'caution'}
          value={label.reversible ? 'Fully reversible' : 'A permanent change'}
          note={
            label.reversible
              ? 'Take it off and the car is back to original.'
              : 'Fitting it means drilling, cutting or sticking something that will not come off cleanly.'
          }
        />
        <Row
          name="Fitting difficulty"
          value={<CompoundRing difficulty={label.installDifficulty} size={32} />}
          note={`${compound.detail} S is easy, M is in between, H is a workshop job.`}
        />
        <Row name="Fitting time" value={time || 'Nothing to fit'} note={time ? 'For someone who has done it before. Allow more the first time.' : undefined} />
        <Row
          name="Who should fit it"
          level={label.proInstall ? 'caution' : 'good'}
          value={label.proInstall ? 'A trained fitter' : 'You, or any local garage'}
          note={
            label.proInstall
              ? 'It can be done at home, but a mistake here is costly. We advise a workshop.'
              : 'The fitting card lists the tools and the steps.'
          }
        />
        <Row
          name="Fair labour charge"
          value={needsFitter ? <span className="tnum">{costLabel(label.fittingCostMin, label.fittingCostMax)}</span> : 'No fitter needed'}
          note={needsFitter ? 'What a local garage should charge to fit it. Not included in our price.' : undefined}
        />
        <div className="border-t border-line bg-surface px-4 py-3">
          <dt className="type-small font-bold text-muted">Skip this if</dt>
          <dd className="mt-1 font-medium">
            {label.skipIf ? <JargonText text={label.skipIf} /> : 'We know of no reason to skip this one.'}
          </dd>
        </div>
      </dl>

      <footer className="border-t border-line px-4 py-3">
        <Link to="/straight-label" className="link type-small inline-flex items-center gap-1.5 font-bold">
          How we fill in this label
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </footer>
    </section>
  );
}
