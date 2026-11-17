import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { CompoundRing, StraightLabelPanel } from '@/components/commerce';
import { Button } from '@/components/ui';
import { useDocumentMeta } from '@/lib/seo';
import type { StraightLabel } from '@/types/api';
import { DocSection, Facts, ReadingPage, type FactRow, type TocItem } from './parts/Reading';

/** An illustration of a filled-in label. Not a catalogue product: the page says so beside it. */
const EXAMPLE_LABEL: StraightLabel = {
  legality: 'off_road_only',
  legalityNote: '',
  warrantyImpact: 'possible',
  warrantyNote: '',
  wiring: 'splice',
  reversible: true,
  skipIf: 'Skip this if the car rarely leaves the city. You cannot switch it on in traffic.',
  installDifficulty: 4,
  installTimeMin: 90,
  installTimeMax: 150,
  proInstall: true,
  fittingCostMin: 800,
  fittingCostMax: 1500,
};

const TOC: TocItem[] = [
  { id: 'rows', label: 'The nine rows' },
  { id: 'example', label: 'A filled-in label' },
  { id: 'fitted-reports', label: 'Fitted Reports' },
  { id: 'why', label: 'Why the red rows stay' },
];

const LABEL_ROWS: FactRow[] = [
  { term: 'Road legality', value: 'Whether you can use it on a public road as sold. Off-road only means private land, tracks and shows.' },
  { term: 'Car warranty', value: 'Whether a dealer could refuse warranty work because of it.' },
  { term: 'Wiring', value: 'None; plug and play into sockets already in the car; or splice, where a wire of the car is cut.' },
  { term: 'Can it be undone', value: 'Whether the car is back to original once the part comes off.' },
  {
    term: 'Fitting difficulty',
    value: (
      <div className="grid gap-3">
        <p>Graded like tyre compounds. S is minutes with few tools; H is a workshop job.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <CompoundRing difficulty={1} size={32} />
          <CompoundRing difficulty={3} size={32} />
          <CompoundRing difficulty={5} size={32} />
        </div>
      </div>
    ),
  },
  { term: 'Fitting time', value: 'How long it takes someone who has done it before. Allow more the first time.' },
  { term: 'Who should fit it', value: 'You or any local garage, or a trained fitter when a mistake is costly.' },
  { term: 'Fair labour charge', value: 'What a local garage should charge to fit it. It is not part of our price.' },
  { term: 'Skip this if', value: 'The one honest reason not to buy it.' },
];

const REPORT_ROWS: FactRow[] = [
  { term: 'Car', value: 'The make, model and year it went on.' },
  { term: 'Who fitted it', value: 'The buyer, a local garage, a dealer, or nobody yet.' },
  { term: 'Time taken', value: 'Real minutes, not the estimate on the box.' },
  { term: 'How hard', value: 'The same S, M and H scale as the label.' },
  { term: 'Fitted first time', value: 'Yes or no. Across all reports this becomes the line on product cards, such as “92% fitted first time”.' },
  { term: 'What went wrong', value: 'Anything that did not go to plan, in their words.' },
  { term: 'Photos', value: 'The part on the car.' },
];

export default function StraightLabelPage() {
  useDocumentMeta({
    title: 'The Straight Label',
    description: 'How to read the Straight Label and Fitted Reports on every product: road legality, warranty, wiring, fitting difficulty, time and fair labour cost.',
  });

  return (
    <ReadingPage
      title="The Straight Label"
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'The Straight Label' }]}
      description="Every part we sell carries a label of the facts a seller would usually leave out. This is how to read it."
      toc={TOC}
    >
      <DocSection id="rows" title="The nine rows">
        <p>Each row answers a question worth asking before you pay.</p>
        <Facts rows={LABEL_ROWS} />
      </DocSection>

      <DocSection id="example" title="A filled-in label">
        <p>
          This is the label for a roof light bar, filled in the way we fill in every product. It is an example, not a listing.
        </p>
        <StraightLabelPanel label={EXAMPLE_LABEL} headingLevel="h3" />
      </DocSection>

      <DocSection id="fitted-reports" title="Fitted Reports">
        <p>
          We do not show star ratings. After delivery, the buyer can file a short report on how fitting went. Only someone who bought the part
          from us can file one: signed in, or with the order number and phone.
        </p>
        <Facts rows={REPORT_ROWS} />
        <p className="text-muted">Reports added to show how the page works are marked Sample.</p>
      </DocSection>

      <DocSection id="why" title="Why the red rows stay">
        <p>
          A shop earns when you buy, so most product pages list only reasons to buy. That is how people end up with a light bar they cannot use in
          town, or a spliced wire the service centre blames for the next electrical fault.
        </p>
        <p>
          We print the bad news in the same place, at the same size, as the good. Off-road only is red because it is a hard no on the road.
          Warranty risk and cut wires are orange because they are a cost to weigh, not a ban.
        </p>
        <p>
          If a part is wrong for your car or the way you drive, we would rather you skip it than send it back. The same facts show as chips on
          product cards, so you can compare before opening a page.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <Button to="/shop" iconRight={<ArrowRight />}>
            Browse the shop
          </Button>
          <Link to="/glossary" className="link font-bold">
            Words on the label, explained
          </Link>
        </div>
      </DocSection>
    </ReadingPage>
  );
}
