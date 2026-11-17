import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Car,
  CircleCheck,
  CircleX,
  Heart,
  IndianRupee,
  LayoutGrid,
  List,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  BoardSlot,
  BoardTile,
  BoardWord,
  CompoundRing,
  FacebookIcon,
  InstagramIcon,
  Logo,
  PaymentMarks,
  PitBoard,
  RollingTyre,
  Roundel,
  StickerChip,
  TimingRow,
  TimingTower,
  TreadDivider,
  WhatsAppIcon,
  YouTubeIcon,
} from '@/components/brand';
import {
  AddToCartButton,
  CompareButton,
  CustomSummary,
  DemoBadge,
  DropBadge,
  ErrorState,
  FitBadge,
  GarageButton,
  Jargon,
  JargonText,
  PageHeader,
  PincodeCheck,
  Price,
  ProductFrame,
  ProductGrid,
  ProductRail,
  QtyStepper,
  SectionHeading,
  ShareButton,
  StockNote,
  StraightLabelChips,
  StraightLabelPanel,
  VehiclePickerInline,
  WhatsAppButton,
  WishlistButton,
} from '@/components/commerce';
import {
  Accordion,
  AccordionItem,
  Badge,
  Breadcrumbs,
  Button,
  Callout,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Chip,
  CopyButton,
  Countdown,
  Divider,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  Modal,
  Pagination,
  Popover,
  RadioGroup,
  Segmented,
  Slider,
  Select,
  Skeleton,
  SkeletonText,
  Stat,
  Stepper,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  toast,
  type BadgeTone,
  type TableColumn,
} from '@/components/ui';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatINR } from '@/lib/format';
import { useDocumentMeta } from '@/lib/seo';
import { useTheme, type Theme } from '@/stores/theme';
import { useUi } from '@/stores/ui';
import {
  SAMPLE_CUSTOM,
  SAMPLE_FITS,
  SAMPLE_JARGON,
  SAMPLE_LABEL,
  SAMPLE_LABEL_HARD,
  SAMPLE_PRODUCTS,
  SAMPLE_VEHICLE,
} from './commerceSamples';

/* ------------------------------------------------------------------ page furniture */

const SECTIONS = [
  ['brand', 'Logo'],
  ['colour', 'Colour'],
  ['planes', 'Planes'],
  ['type', 'Type'],
  ['layout', 'Layout'],
  ['motion', 'Motion'],
  ['motifs', 'Motifs'],
  ['buttons', 'Buttons'],
  ['forms', 'Forms'],
  ['status', 'Status'],
  ['structure', 'Structure'],
  ['navigation', 'Navigation'],
  ['overlays', 'Overlays'],
  ['commerce', 'Commerce'],
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="section-y border-t border-line">
      <div className="container-page">
        <h2 className="type-h1">{title}</h2>
        <p className="type-lead mt-3 max-w-prose text-muted">{intro}</p>
        <div className="mt-10 grid gap-12">{children}</div>
      </div>
    </section>
  );
}

function Specimen({ title, note, children, className }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <h3 className="type-h3">{title}</h3>
      {note && <p className="type-small mt-1 max-w-prose text-muted">{note}</p>}
      <div className={cn('mt-4', className)}>{children}</div>
    </div>
  );
}

/** A class name exactly as it is typed. */
function Cls({ children }: { children: ReactNode }) {
  return <code className="rounded-control bg-surface px-1 py-0.5 font-mono text-[0.6875rem] text-ink">{children}</code>;
}

/** The same content in both themes, side by side. */
function ThemePair({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {(['light', 'dark'] as const).map((theme) => (
        <div key={theme} data-theme={theme} className="min-w-0 border border-line bg-page p-4 text-ink">
          <p className="type-label mb-3 text-muted">{theme} theme</p>
          {children}
        </div>
      ))}
    </div>
  );
}

function Swatch({ box, name, use }: { box: string; name: string; use: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('size-10 shrink-0 border border-line', box)} />
      <span className="grid min-w-0 gap-0.5">
        <Cls>{name}</Cls>
        <span className="type-small text-muted">{use}</span>
      </span>
    </div>
  );
}

function SliderDemo() {
  const [budget, setBudget] = useState(25000);
  return (
    <Field label="Budget" hint="Up to this much, fitting included.">
      <Slider value={budget} onChange={setBudget} min={5000} max={100000} step={2500} format={formatINR} />
    </Field>
  );
}

/** Replays a one-shot animation by remounting its child. */
function Replay({ label, children }: { label: string; children: ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
        Play
      </Button>
      <div key={run} className="min-w-0">
        {children}
      </div>
      <Cls>{label}</Cls>
    </div>
  );
}

/* ------------------------------------------------------------------ sample data (invented for this page only) */

const STATE_TONES: Array<{ tone: BadgeTone; solid: string; soft: string; means: string }> = [
  { tone: 'fit', solid: 'bg-fit text-fit-ink', soft: 'bg-fit-soft text-fit', means: 'Fits, in stock, price drop' },
  { tone: 'warn', solid: 'bg-warn text-warn-ink', soft: 'bg-warn-soft text-warn', means: 'Low stock, needs a workshop, check rules' },
  { tone: 'stop', solid: 'bg-stop text-stop-ink', soft: 'border border-stop bg-stop-soft text-stop', means: 'Danger: does not fit, sold out, errors. Oxblood by day, pale rose at night, always with an icon' },
  { tone: 'info', solid: 'bg-info text-info-ink', soft: 'bg-info-soft text-info', means: 'Neutral information' },
  { tone: 'best', solid: 'bg-best text-best-ink', soft: 'bg-best-soft text-best', means: 'A genuine best only' },
];

const TYPE_RECIPES: Array<{ cls: string; sample: string; use: string }> = [
  { cls: 'type-display', sample: 'Tell the board your car.', use: 'One per page at most. Four words or fewer a line.' },
  { cls: 'type-poster', sample: 'Upgrade your ride.', use: 'The offer poster’s voice: condensed heavy italic. Brand moments on the board or the red plane.' },
  { cls: 'type-h1', sample: 'What fits your Swift', use: 'Page headline.' },
  { cls: 'type-h2', sample: 'The Friday Five', use: 'Section heading.' },
  { cls: 'type-title', sample: 'Addon Aero front lip, gloss black', use: 'Upright: product names, order numbers, admin titles.' },
  { cls: 'type-h3', sample: 'Fitting time and labour', use: 'Sub-heading, card and dialog titles.' },
  { cls: 'type-lead', sample: 'Every part gets a straight answer: does it fit your car, and what will fitting cost.', use: 'Opening paragraph.' },
  { cls: 'type-body', sample: 'Gloss black ABS. Fits with the factory clips and six screws supplied in the box.', use: 'Everything read.' },
  { cls: 'type-small', sample: 'Inclusive of all taxes. Delivery charge is shown before checkout.', use: 'Hints, captions, meta.' },
  { cls: 'type-label', sample: 'In stock', use: 'Chips, table headers. Never a kicker above a heading.' },
  { cls: 'type-button', sample: 'Add to cart', use: 'Filled buttons (set by Button).' },
  { cls: 'type-code', sample: 'ADN-LIP-0412', use: 'SKU, order number, PIN code, coupon. Never a price.' },
];

interface SampleOrder {
  number: string;
  customer: string;
  placed: string;
  items: number;
  total: number;
  status: 'Packed' | 'Out for delivery' | 'Payment pending';
}

const ORDERS: SampleOrder[] = [
  { number: 'AD-241117-0042', customer: 'Rohan Kulkarni', placed: '17 Nov', items: 3, total: 12499, status: 'Packed' },
  { number: 'AD-241117-0041', customer: 'Sneha Iyer', placed: '17 Nov', items: 1, total: 119999, status: 'Out for delivery' },
  { number: 'AD-241116-0038', customer: 'Imran Shaikh', placed: '16 Nov', items: 2, total: 3298, status: 'Payment pending' },
];

const ORDER_COLUMNS: Array<TableColumn<SampleOrder>> = [
  { key: 'number', header: 'Order', primary: true, cell: (o) => <span className="type-code">{o.number}</span> },
  { key: 'customer', header: 'Customer', cell: (o) => o.customer },
  { key: 'placed', header: 'Placed', cell: (o) => o.placed },
  { key: 'items', header: 'Items', numeric: true, cell: (o) => o.items },
  { key: 'total', header: 'Total', numeric: true, cell: (o) => <span className="font-bold">{formatINR(o.total)}</span> },
  {
    key: 'status',
    header: 'Status',
    cell: (o) => (
      <Badge tone={o.status === 'Payment pending' ? 'warn' : o.status === 'Packed' ? 'info' : 'fit'}>{o.status}</Badge>
    ),
  },
];

const CARS = ['SWIFT 2019', 'CRETA 2022', 'THAR 2021', 'POLO 2017'];

const formSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, { error: 'Enter a 10 digit mobile number' }),
  pincode: z.string().regex(/^[1-9]\d{5}$/, { error: 'Enter a 6 digit PIN code' }),
});
type FormValues = z.infer<typeof formSchema>;

/* ------------------------------------------------------------------ sections with state */

function LiveForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { phone: '', pincode: '' } });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => toast.success('Form is valid', { description: `${values.phone}, PIN ${values.pincode}` }))}
      className="grid max-w-md gap-4"
    >
      <Field label="Mobile number" hint="10 digits. We send order updates here." error={errors.phone?.message}>
        <Input type="tel" inputMode="numeric" autoComplete="tel-national" leading="+91" {...register('phone')} />
      </Field>
      <Field label="PIN code" error={errors.pincode?.message}>
        <Input inputMode="numeric" autoComplete="postal-code" maxLength={6} mono {...register('pincode')} />
      </Field>
      <Button type="submit" loading={isSubmitting} className="justify-self-start">
        Check delivery
      </Button>
    </form>
  );
}

function BoardDemo() {
  const [car, setCar] = useState(0);
  const text = CARS[car % CARS.length] ?? CARS[0] ?? '';
  const [model = '', year = ''] = text.split(' ');
  return (
    <PitBoard title="Your car" aside={<button type="button" className="link" onClick={() => setCar((n) => n + 1)}>Change car</button>} className="max-w-xl">
      <BoardWord text={text} tone="brand" size="lg" />
      <div className="grid gap-0.5 sm:grid-cols-3">
        <BoardSlot label="Make" value={model === 'SWIFT' ? 'Maruti Suzuki' : model === 'CRETA' ? 'Hyundai' : model === 'THAR' ? 'Mahindra' : 'Volkswagen'} />
        <BoardSlot label="Model" value={model} />
        <BoardSlot label="Year" value={year} />
      </div>
      <div className="grid gap-0.5 sm:grid-cols-3">
        <BoardSlot label="Make" />
        <BoardSlot label="Model" disabled />
        <BoardSlot label="Year" disabled />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Show what fits</Button>
        <Button variant="outline">Browse everything</Button>
        <span className="type-small text-muted">Muted text, lines and focus rings re-scope on the board.</span>
      </div>
    </PitBoard>
  );
}

function OverlayDemos() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState<'right' | 'left' | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="dark" onClick={() => setModal(true)}>
        Open modal
      </Button>
      <Button variant="outline" onClick={() => setDrawer('right')}>
        Open drawer
      </Button>
      <Button variant="outline" onClick={() => setDrawer('left')}>
        Drawer from the left
      </Button>
      <Popover
        label="Sort by"
        trigger={
          <Button variant="outline" iconLeft={<SlidersHorizontal aria-hidden />}>
            Popover
          </Button>
        }
      >
        {({ close }) => (
          <div className="grid w-56 gap-1">
            <p className="type-label px-2 pb-1 text-muted">Sort by</p>
            {['Most popular', 'Price: low to high', 'Newest first'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={close}
                className="focus-ring-inset flex min-h-11 items-center rounded-control px-2 text-left hover:bg-surface-2"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </Popover>
      <Tooltip content="Save for later">
        <IconButton label="Save" variant="outline">
          <Heart aria-hidden />
        </IconButton>
      </Tooltip>
      <Button variant="ghost" onClick={() => toast.success('Added to cart', { action: { label: 'View cart', onClick: () => undefined } })}>
        Success toast
      </Button>
      <Button variant="ghost" onClick={() => toast.error('Could not save the address', { description: 'Check your connection and try again.' })}>
        Error toast
      </Button>
      <Button variant="ghost" onClick={() => toast.info('Prices updated while you were away')}>
        Info toast
      </Button>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Cancel this order?"
        description="AD-241117-0042, 3 items"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Keep order
            </Button>
            <Button variant="danger" onClick={() => setModal(false)}>
              Cancel order
            </Button>
          </>
        }
      >
        <p>The parts go back on the shelf and any amount paid is refunded to the same payment method within 5 to 7 working days.</p>
        <p className="type-small mt-3 text-muted">
          Tab stays inside this dialog. <Kbd>Esc</Kbd> closes it and focus returns to the button that opened it.
        </p>
      </Modal>

      <Drawer
        open={drawer !== null}
        side={drawer ?? 'right'}
        onClose={() => setDrawer(null)}
        title="Filters"
        description="A bottom sheet on a phone, a side panel from 768 px."
        footer={
          <Button block onClick={() => setDrawer(null)}>
            Show 42 parts
          </Button>
        }
      >
        <div className="grid gap-2">
          <Switch label="Only parts for my car" defaultChecked />
          <Divider />
          <Checkbox label="In stock" defaultChecked />
          <Checkbox label="I can fit it myself" description="Compound S only" />
          <Checkbox label="Road legal" />
        </div>
      </Drawer>
    </div>
  );
}

/* ------------------------------------------------------------------ commerce components */

const OFFLINE = new ApiError(0, 'network_error', 'Could not reach the store. Check your connection and try again.');
const NOT_FOUND = new ApiError(404, 'not_found', 'We could not find that product.');

function CommerceSection() {
  const [qty, setQty] = useState(1);
  const [gridState, setGridState] = useState<'ready' | 'loading' | 'empty'>('ready');
  const openVehiclePicker = useUi((state) => state.openVehiclePicker);
  const [spoiler, bulbs, alloy] = SAMPLE_PRODUCTS;
  if (!spoiler || !bulbs || !alloy) return null;

  return (
    <Section
      id="commerce"
      title="Commerce"
      intro={
        <>
          The shopping building blocks, from <Cls>@/components/commerce</Cls>. Every product, price and report below is a sample in the
          exact shape the API returns. Pressing save or add on a sample card writes a sample id to the wishlist or cart of this browser.
        </>
      }
    >
      <Specimen
        title="ProductCard in a ProductGrid"
        note={
          <>
            Card props: <Cls>product</Cls> <Cls>eager</Cls> <Cls>vehicle</Cls> <Cls>compare</Cls> <Cls>fittedOkPercent</Cls>. Grid props:{' '}
            <Cls>products</Cls> <Cls>loading</Cls> <Cls>updating</Cls> <Cls>columns</Cls> <Cls>skeletons</Cls> <Cls>eagerCount</Cls> <Cls>empty</Cls>.
            The six cards show: a verified fit in a live drop, fits with work and low stock, a universal fit that needs a fitter, does not fit,
            sold out, and a designer product with no photo yet.
          </>
        }
      >
        <Segmented
          label="Grid state"
          size="sm"
          value={gridState}
          onChange={setGridState}
          options={[
            { value: 'ready', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'empty', label: 'Empty' },
          ]}
          className="mb-5"
        />
        <ProductGrid
          label="Sample products"
          products={gridState === 'ready' ? SAMPLE_PRODUCTS : gridState === 'empty' ? [] : undefined}
          loading={gridState === 'loading'}
          skeletons={4}
          vehicle={SAMPLE_VEHICLE}
          compare
          empty={
            <EmptyState
              size="sm"
              title="No parts match these filters"
              description="Remove a filter, or look at everything that fits your car."
              actions={<Button onClick={() => setGridState('ready')}>Clear filters</Button>}
            />
          }
        />
      </Specimen>

      <Specimen
        title="ProductRail"
        note={
          <>
            Props: <Cls>title</Cls> <Cls>products</Cls> <Cls>loading</Cls> <Cls>description</Cls> <Cls>seeAll</Cls>. Swipe, use the arrows, or Tab
            through the cards. With no products and not loading it renders nothing.
          </>
        }
      >
        <ProductRail
          as="h3"
          title="Works well with"
          description="Parts other Swift owners bought with this one."
          products={SAMPLE_PRODUCTS}
          vehicle={SAMPLE_VEHICLE}
          seeAll={{ to: '/shop' }}
        />
      </Specimen>

      <div className="grid gap-12 lg:grid-cols-2">
        <Specimen
          title="Price"
          note={
            <>
              Props: <Cls>price</Cls> <Cls>mrp</Cls> <Cls>regularPrice</Cls> <Cls>drop</Cls> <Cls>from</Cls> <Cls>lowest30Days</Cls> <Cls>size</Cls>.
              The large size adds the tax line. In a drop the regular price is struck and the reason opens on demand.
            </>
          }
          className="grid gap-5"
        >
          <Price size="sm" price={bulbs.price} mrp={bulbs.mrp} from />
          <Price price={alloy.price} mrp={alloy.mrp} />
          <Price price={spoiler.price} mrp={spoiler.mrp} regularPrice={spoiler.regularPrice} drop={spoiler.drop} />
          <Price size="lg" price={bulbs.price} mrp={bulbs.mrp} lowest30Days={2299} />
          <Price size="lg" price={spoiler.price} mrp={spoiler.mrp} regularPrice={spoiler.regularPrice} drop={spoiler.drop} lowest30Days={3799} />
          <Price size="lg" price={899} mrp={899} />
        </Specimen>

        <Specimen
          title="StockNote, DropBadge, DemoBadge"
          note={
            <>
              <Cls>StockNote</Cls> speaks only from real stock. <Cls>DropBadge</Cls> counts down to the real end of the drop and removes itself
              when it passes. <Cls>DemoBadge</Cls> sits beside any seeded sample content.
            </>
          }
          className="grid gap-5"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StockNote variant="full" stock={14} inStock />
            <StockNote variant="full" stock={3} inStock lowStock />
            <StockNote variant="full" stock={0} inStock={false} />
          </div>
          {spoiler.drop && (
            <div className="flex flex-wrap items-start gap-8">
              <DropBadge drop={spoiler.drop} />
              <DropBadge drop={spoiler.drop} variant="full" />
            </div>
          )}
          <p className="type-small">
            Fitted by a local garage in 40 minutes. No issues. <DemoBadge />
          </p>
        </Specimen>
      </div>

      <Specimen
        title="FitBadge"
        note={
          <>
            Props: <Cls>product</Cls> <Cls>variant</Cls> compact, full; <Cls>vehicle</Cls> (defaults to the active garage car); <Cls>onAsk</Cls>.
            The six verdicts, each as an icon, words and a colour. With no car it opens the car picker.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SAMPLE_FITS.map((product) => {
            const car = product.fit === null ? null : SAMPLE_VEHICLE;
            return (
              <div key={product.id} className="grid content-start gap-3">
                <FitBadge product={product} vehicle={car} />
                <FitBadge variant="full" product={product} vehicle={car} onAsk={() => toast.info('The product page opens its question form here')} />
              </div>
            );
          })}
        </div>
      </Specimen>

      <Specimen
        title="The Straight Label"
        note={
          <>
            <Cls>StraightLabelChips</Cls> takes a <Cls>product</Cls> and goes on cards: the difficulty ring always, the catches only when they
            apply. <Cls>StraightLabelPanel</Cls> takes <Cls>label</Cls> from a ProductDetail: every row is always present, and the hard news is
            printed as plainly as the good.
          </>
        }
      >
        <div className="mb-6 grid gap-3">
          {SAMPLE_PRODUCTS.slice(0, 5).map((product) => (
            <div key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="type-small w-40 shrink-0 truncate text-muted">{product.categoryName}</span>
              <StraightLabelChips product={product} />
            </div>
          ))}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <StraightLabelPanel headingLevel="h3" label={SAMPLE_LABEL} />
          <StraightLabelPanel headingLevel="h3" label={SAMPLE_LABEL_HARD} />
        </div>
      </Specimen>

      <div className="grid gap-12 lg:grid-cols-2">
        <Specimen
          title="AddToCartButton, QtyStepper, WishlistButton, CompareButton"
          note={
            <>
              <Cls>AddToCartButton</Cls>: <Cls>productId</Cls> <Cls>variantId</Cls> <Cls>qty</Cls> <Cls>custom</Cls> <Cls>blocked</Cls>{' '}
              <Cls>variant</Cls> button, icon; <Cls>tone</Cls>; <Cls>openCart</Cls>. It confirms in place and opens the cart drawer.{' '}
              <Cls>QtyStepper</Cls>: <Cls>value</Cls> <Cls>onChange</Cls> <Cls>min</Cls> <Cls>max</Cls>.
            </>
          }
          className="grid gap-5"
        >
          <div className="flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} max={5} label="Quantity of the sample spoiler" />
            <AddToCartButton productId={spoiler.id} qty={qty} productName={spoiler.name} openCart={false} size="lg" />
            <span className="type-small text-muted">Stock for this sample is 5.</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton productId={spoiler.id} productName={spoiler.name} openCart={false} tone="dark" />
            <AddToCartButton productId={bulbs.id} productName={bulbs.name} blocked="Choose a bulb type first" tone="outline">
              Blocked add
            </AddToCartButton>
            <AddToCartButton variant="icon" productId={spoiler.id} productName={spoiler.name} openCart={false} />
            <QtyStepper size="sm" value={qty} onChange={setQty} min={0} max={5} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <WishlistButton productId={spoiler.id} productName={spoiler.name} />
            <WishlistButton variant="button" productId={spoiler.id} productName={spoiler.name} />
            <CompareButton productId={spoiler.id} productName={spoiler.name} />
            <CompareButton variant="button" productId={bulbs.id} productName={bulbs.name} />
          </div>
        </Specimen>

        <Specimen
          title="PincodeCheck, CustomSummary"
          note={
            <>
              <Cls>PincodeCheck</Cls> asks the API for real delivery dates and remembers the PIN code in the cart store. Props:{' '}
              <Cls>codEligible</Cls> <Cls>onEstimate</Cls>. <Cls>CustomSummary</Cls> prints the saved output of a designer from{' '}
              <Cls>custom</Cls> on a cart line or order item.
            </>
          }
          className="grid gap-6"
        >
          <PincodeCheck />
          <CustomSummary custom={SAMPLE_CUSTOM} />
        </Specimen>
      </div>

      <Specimen
        title="VehiclePicker, VehiclePickerInline, GarageButton"
        note={
          <>
            The picker is mounted once in App.tsx and opened with <Cls>useUi.getState().openVehiclePicker()</Cls>. <Cls>GarageButton</Cls> is the
            header control (<Cls>compact</Cls> for a crowded phone header). <Cls>VehiclePickerInline</Cls> is the same selector for the home hero:
            props <Cls>onSelect</Cls> and children for the call to action once a car is set. Both read the real list of cars from the API.
          </>
        }
      >
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <GarageButton />
          <GarageButton compact />
          <Button variant="outline" onClick={openVehiclePicker}>
            Open the car picker
          </Button>
        </div>
        <div className="plane-brand p-4 md:p-6">
          <p className="type-h2 mb-4">Tell the board your car.</p>
          <VehiclePickerInline className="max-w-2xl" />
        </div>
      </Specimen>

      <div className="grid gap-12 lg:grid-cols-2">
        <Specimen
          title="Jargon, JargonText"
          note={
            <>
              <Cls>{'<Jargon term="PCD">'}</Cls> wraps one word; <Cls>{'<JargonText text={...} />'}</Cls> finds the glossary words in a sentence.
              Tap, click or focus a dotted word. <Cls>useGlossary()</Cls> returns the entries for the /glossary page.
            </>
          }
          className="grid max-w-prose gap-3"
        >
          <p>
            The <Jargon term="PCD">bolt pattern</Jargon> is 4x100, the <Jargon>offset</Jargon> is ET38 and the wheel needs a{' '}
            <Jargon>hub ring</Jargon> on this car.
          </p>
          <p>
            <JargonText text={SAMPLE_JARGON} />
          </p>
        </Specimen>

        <Specimen
          title="ShareButton, WhatsAppButton"
          note={
            <>
              <Cls>ShareButton</Cls> opens the share sheet of the phone, or copies the link. <Cls>WhatsAppButton</Cls> takes <Cls>text</Cls> and{' '}
              <Cls>to</Cls> store, share. It renders nothing until a WhatsApp number is set in Admin, Settings, so it may be absent here.
            </>
          }
          className="flex flex-wrap items-center gap-3"
        >
          <ShareButton url={`/p/${spoiler.slug}`} title={spoiler.name} />
          <ShareButton iconOnly variant="ghost" url={`/p/${spoiler.slug}`} title={spoiler.name} />
          <WhatsAppButton text={`Hi, I have a question about ${spoiler.name}.`}>Ask about this part</WhatsAppButton>
          <WhatsAppButton to="share" text={`What do you think of this? ${spoiler.name}`}>
            Ask the gang
          </WhatsAppButton>
        </Specimen>
      </div>

      <Specimen
        title="ProductFrame"
        note={
          <>
            Props: <Cls>image</Cls> <Cls>alt</Cls> <Cls>artKind</Cls> <Cls>variant</Cls> thumb, full; <Cls>eager</Cls> <Cls>muted</Cls>, and children
            for stickers and buttons. A missing or broken photo becomes the placeholder with the category icon.
          </>
        }
      >
        <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <ProductFrame image={alloy.image} alt={alloy.name} artKind={alloy.artKind} className="border border-line" />
          <ProductFrame image={null} alt="Alloy wheel" artKind="alloy-wheel" className="border border-line" />
          <ProductFrame image="/catalog/missing/photo.webp" alt="LED bulb" artKind="led-bulb" className="border border-line" />
          <ProductFrame image={null} alt="Seat cover" artKind="seat-cover" muted className="border border-line" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProductFrame variant="tiny" image={alloy.image} alt={alloy.name} artKind={alloy.artKind} className="size-14 border border-line" />
          <ProductFrame variant="tiny" image={null} alt="Fog lamp" artKind="fog-lamp" className="size-14 border border-line" />
          <span className="type-small text-muted"><Cls>variant="tiny"</Cls> under 64 px: the icon alone</span>
        </div>
      </Specimen>

      <Specimen
        title="PageHeader, SectionHeading"
        note={
          <>
            <Cls>PageHeader</Cls>: <Cls>title</Cls> <Cls>breadcrumbs</Cls> <Cls>description</Cls> <Cls>meta</Cls> <Cls>actions</Cls>{' '}
            <Cls>variant</Cls> headline, plain. <Cls>SectionHeading</Cls>: <Cls>title</Cls> <Cls>description</Cls> <Cls>seeAll</Cls>{' '}
            <Cls>action</Cls> <Cls>as</Cls>.
          </>
        }
        className="grid gap-8"
      >
        <div className="border border-line px-4">
          <PageHeader
            title="Spoilers and wings"
            breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Exterior styling', to: '/shop/exterior-styling' }, { label: 'Spoilers and wings' }]}
            description="Roof, boot lip and ducktail spoilers. Each one says which cars it was made for."
            meta="42 parts"
            actions={<ShareButton size="sm" />}
          />
        </div>
        <div className="border border-line p-4">
          <SectionHeading as="h3" title="New this week" description="Six parts added since Monday." seeAll={{ to: '/shop?isNew=1' }} />
        </div>
      </Specimen>

      <Specimen
        title="ErrorState"
        note={
          <>
            Props: <Cls>error</Cls> (what the query threw) <Cls>onRetry</Cls> <Cls>title</Cls> <Cls>notFoundAction</Cls> <Cls>size</Cls>. It reads
            the kind of failure: offline gets a retry, a missing page gets a way onward, a signed-out visitor gets the sign-in link.
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border border-line px-4">
            <ErrorState size="sm" error={OFFLINE} title="Could not load the products" onRetry={() => toast.info('The page calls refetch() here')} />
          </div>
          <div className="border border-line px-4">
            <ErrorState size="sm" error={NOT_FOUND} />
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

/* ------------------------------------------------------------------ the page */

export default function StyleguidePage() {
  useDocumentMeta({ title: 'Styleguide', noindex: true });
  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);

  const [chips, setChips] = useState<string[]>(['In stock']);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [body, setBody] = useState<'hatchback' | 'sedan' | 'suv'>('hatchback');
  const [payment, setPayment] = useState<'upi' | 'card' | 'cod'>('upi');
  const [delivery, setDelivery] = useState<'standard' | 'express'>('standard');
  const [page, setPage] = useState(3);
  const [step, setStep] = useState(1);
  const [progress, setProgress] = useState(0.4);
  // A stand-in deadline two days from when the page opened. Real pages pass a drop's endsAt.
  const [deadline] = useState(() => new Date(Date.now() + (2 * 24 + 4) * 3_600_000).toISOString());

  const toggleChip = (name: string) => setChips((now) => (now.includes(name) ? now.filter((c) => c !== name) : [...now, name]));

  return (
    <div className="bg-page text-ink">
      {/* ---- masthead ---- */}
      <header className="plane-brand lean-bottom pb-[clamp(2.5rem,7vw,5.5rem)]">
        <div className="container-page pt-8 md:pt-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Logo height={44} />
            <Segmented<Theme>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <h1 className="type-display mt-10">
            Pit board.
            <br />
            Design system.
          </h1>
          <p className="type-lead mt-4 max-w-prose">
            Every token, component and motif the store is built from. Pages use only what is on this page; the rules are in
            client/DESIGN.md.
          </p>
        </div>
      </header>

      <nav aria-label="Sections" className="sticky top-0 z-sticky border-b border-line bg-page">
        <div className="container-page no-scrollbar flex gap-1 overflow-x-auto py-2">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="focus-ring-inset flex h-9 shrink-0 items-center rounded-control px-3 text-sm font-bold hover:bg-surface-2">
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* ---- logo ---- */}
      <Section id="brand" title="Logo" intro="The owner's logo redrawn as SVG on the grid of the original file. The letters take the text colour (black on the page, white on the board and in the dark theme); the tyre keeps its Tread Red tread and silver alloy everywhere.">
        <Specimen title="Original and redrawn" note="The owner's PNG above, the Logo component below, at the same size. Use the component: it stays sharp at any size and follows the theme.">
          <div className="grid max-w-3xl gap-2 border border-line bg-frame p-4">
            <img src="/brand/addon-logo.png" alt="The owner's original logo file" width={1024} height={304} className="h-auto w-full" />
            <Logo height={160} className="h-auto w-full text-frame-ink" label="The Logo component" />
          </div>
        </Specimen>
        <Specimen title="Logo" note={<>Props: <Cls>height</Cls> <Cls>variant</Cls> <Cls>tagline</Cls> <Cls>roll</Cls> <Cls>label</Cls>. Below 28 px tall, turn the tagline off.</>}>
          <div className="grid gap-0.5 md:grid-cols-3">
            <div className="grid place-items-center border border-line p-8">
              <Logo height={56} />
            </div>
            <div className="plane-board grid place-items-center p-8">
              <Logo height={56} />
            </div>
            <div className="plane-brand grid place-items-center p-8">
              <Logo height={56} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-end gap-8">
            <Logo height={32} />
            <Logo height={24} tagline={false} />
            <Logo variant="mark" height={40} />
            <Logo variant="mark" height={24} />
            <span className="flex items-center gap-2">
              <Logo height={32} roll="scroll" />
              <span className="type-small text-muted">roll=&quot;scroll&quot;: the alloy turns as you scroll</span>
            </span>
          </div>
        </Specimen>
      </Section>

      {/* ---- colour ---- */}
      <Section id="colour" title="Colour" intro="Black, white and Tread Red, the red of the logo's tread. Red is a fill with white ink for the main action and brand moments. Danger is a different, deeper colour drawn as an outlined box, and it always travels with an icon and words.">
        <Specimen title="Brand red and danger, side by side" note="They must never be confused. Brand red is a solid fill with white italic capitals. Danger is oxblood (pale rose at night) in an outlined, tinted box, with an icon and words that say what is wrong.">
          <ThemePair>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid content-start gap-3">
                <p className="type-label">Brand: do this</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Book a fitting slot</Button>
                  <Badge tone="brand" variant="solid">
                    Up to 30% off
                  </Badge>
                  <Roundel tone="brand" size="sm">
                    2
                  </Roundel>
                </div>
                <p className="type-small text-muted">The next action, a running offer, the live step. One red fill per view, plus small markers.</p>
              </div>
              <div className="grid content-start gap-3">
                <p className="type-label">Danger: always icon and words</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="danger" iconLeft={<Trash2 aria-hidden />}>
                    Delete
                  </Button>
                  <Badge tone="stop" icon={<CircleX aria-hidden />}>
                    Does not fit
                  </Badge>
                  <StockNote stock={0} inStock={false} />
                </div>
                <p className="type-small text-muted">Errors, does not fit, sold out, off-road only. Never a plain red fill, never colour alone.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-2 border-t border-line pt-4">
              <p className="type-label">Do not</p>
              <ul className="type-small grid list-disc gap-1 pl-5 text-muted">
                <li>Set small text in red, or use red for a link, a price or a warning.</li>
                <li>Fill an error, a sold-out tag or a delete button with solid red: that is the brand's look.</li>
                <li>Put two red fills side by side, or a red primary button on the red plane (it turns black there by itself).</li>
              </ul>
            </div>
          </ThemePair>
        </Specimen>
        <Specimen title="Tokens in both themes" note="Use these utilities only. There is no default Tailwind palette: bg-zinc-900 produces nothing.">
          <ThemePair>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="grid content-start gap-3">
                <Swatch box="bg-page" name="bg-page" use="The page" />
                <Swatch box="bg-surface" name="bg-surface" use="Bars, quiet panels" />
                <Swatch box="bg-surface-2" name="bg-surface-2" use="Insets, hover" />
                <Swatch box="bg-raised" name="bg-raised" use="Sheets, menus, dialogs" />
                <Swatch box="bg-frame" name="bg-frame" use="Photo frame: white in both themes" />
                <Swatch box="bg-line" name="border-line" use="Rules between things" />
                <Swatch box="bg-line-strong" name="border-line-strong" use="Control outlines" />
              </div>
              <div className="grid content-start gap-3">
                <Swatch box="bg-ink" name="text-ink / bg-ink" use="Text, the dark fill" />
                <Swatch box="bg-muted" name="text-muted" use="Secondary text" />
                <Swatch box="bg-brand" name="bg-brand text-brand-ink" use="Tread Red: fills with white ink" />
                <Swatch box="bg-brand-press" name="bg-brand-press" use="Red, hovered or pressed" />
                <Swatch box="bg-brand-soft" name="bg-brand-soft" use="Selected row, chosen option" />
                <Swatch box="bg-brand-text" name="text-brand-text" use="Red words at display size only" />
                <Swatch box="bg-focus" name="outline-focus" use="Focus ring (set globally)" />
              </div>
            </div>
            <div className="mt-6 grid gap-2">
              {STATE_TONES.map(({ tone, solid, soft, means }) => (
                <div key={tone} className="flex flex-wrap items-center gap-2">
                  <span className={cn('type-label inline-flex h-7 w-24 items-center justify-center rounded-control', solid)}>{tone}</span>
                  <span className={cn('type-label inline-flex h-7 w-24 items-center justify-center rounded-control', soft)}>{tone}-soft</span>
                  <span className="type-small text-muted">{means}</span>
                </div>
              ))}
            </div>
          </ThemePair>
        </Specimen>
      </Section>

      {/* ---- planes ---- */}
      <Section id="planes" title="Planes" intro="Depth comes from flat planes, not shadows. A plane sets its ground and re-scopes every token inside it: the same components, the same class names, the right colours.">
        <Specimen title="plane-board, plane-brand, plane-frame" note="The same markup sits in each. On red the primary button turns black by itself, and state badges sit on white.">
          <div className="grid gap-0.5 md:grid-cols-3">
            {(
              [
                ['plane-board', 'The pit board. Black here, paper in the dark theme.'],
                ['plane-brand', 'The red plane, white ink. One region a page, at most.'],
                ['plane-frame border border-line', 'The photo frame. White in both themes.'],
              ] as const
            ).map(([plane, text]) => (
              <div key={plane} className={cn(plane, 'grid content-start gap-3 p-5')}>
                <span>
                  <Cls>{plane.split(' ')[0]}</Cls>
                </span>
                <p className="type-h3">186 parts fit</p>
                <p className="type-small text-muted">{text}</p>
                <div className="border-t border-line pt-3">
                  <Badge tone="fit" icon={<CircleCheck aria-hidden />}>
                    Fits your Swift
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm">Primary</Button>
                  <Button size="sm" variant="outline">
                    Outline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Specimen>
      </Section>

      {/* ---- type ---- */}
      <Section id="type" title="Type" intro="Archivo throughout. Heavy italic capitals for things that move or shout; upright for anything a shopper reads to decide. Martian Mono for codes only.">
        <Specimen title="Recipes" note="Each type-* class is complete: family, weight, slant, size, leading, tracking and case. Add a colour and nothing else.">
          <div className="grid divide-y divide-line border-y border-line">
            {TYPE_RECIPES.map(({ cls, sample, use }) => (
              <div key={cls} className="grid gap-2 py-4 md:grid-cols-[14rem_1fr] md:items-baseline md:gap-6">
                <div className="grid gap-1">
                  <span>
                    <Cls>{cls}</Cls>
                  </span>
                  <span className="type-small text-muted">{use}</span>
                </div>
                <p className={cn(cls, 'min-w-0')}>{sample}</p>
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen title="Figures" note={<>Every price, count and timer is tabular: <Cls>type-price-xl</Cls> <Cls>type-price</Cls> <Cls>type-mrp</Cls> <Cls>type-stat</Cls> <Cls>type-board</Cls> or <Cls>tnum</Cls>. Rupees use lakh grouping from formatINR.</>}>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="grid content-start gap-2">
              <p className="type-price-xl">{formatINR(119999)}</p>
              <p className="flex items-baseline gap-2">
                <span className="type-price">{formatINR(2499)}</span>
                <span className="type-mrp">{formatINR(3199)}</span>
                <Badge tone="fit" size="sm">
                  22% off
                </Badge>
              </p>
              <p className="type-small text-muted">Inclusive of all taxes</p>
            </div>
            <table className="w-full max-w-60 self-start">
              <tbody className="tnum">
                {[1299, 24999, 119999, 849].map((amount) => (
                  <tr key={amount} className="border-b border-line">
                    <td className="type-small py-1.5 text-muted">Line</td>
                    <td className="py-1.5 text-right font-bold">{formatINR(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid content-start gap-3">
              <p className="type-stat">1,284</p>
              <p className="type-board">P1 24</p>
            </div>
          </div>
        </Specimen>

        <Specimen title="Families" note={<>Four font utilities exist: <Cls>font-sans</Cls> (default) <Cls>font-display</Cls> <Cls>font-mono</Cls> <Cls>font-hindi</Cls>. Text marked lang=&quot;hi&quot; takes the Hindi face and looser leading by itself.</>}>
          <div className="grid gap-4 md:grid-cols-3">
            <p className="font-mono text-sm">ORDER AD-241117-0042 · PIN 411045 · ADDON10</p>
            <p lang="hi" className="text-lg">
              फिटिंग का समय: 45 मिनट। सही मज़दूरी ₹300 से ₹500।
            </p>
            <p className="italic">Italic in running text is real Archivo Italic, never a browser slant.</p>
          </div>
        </Specimen>
      </Section>

      {/* ---- layout ---- */}
      <Section id="layout" title="Layout" intro="Mobile first. One container, a 4 px spacing scale, and a product grid that is two columns at 360 px.">
        <Specimen title="Container, radius, rules" note={<><Cls>container-page</Cls> max 1280 px with a 16 / 24 / 32 px gutter. <Cls>container-prose</Cls> for reading. <Cls>section-y</Cls> between sections. Corners are <Cls>rounded-control</Cls> (2 px) on controls, square on cards and frames, <Cls>rounded-full</Cls> on roundels and stickers.</>}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {['360: 2 columns', '768: 3 columns', '1280: 4 columns', 'gap 12 px'].map((label) => (
              <div key={label} className="grid gap-2">
                <div className="plane-frame grid aspect-square place-items-center border border-line">
                  <span className="type-small text-muted">1:1 frame</span>
                </div>
                <span className="type-small text-muted">{label}</span>
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen title="Elevation and stacking" note={<>Two shadows exist and only floating layers use them: <Cls>shadow-pop</Cls> (popovers, toasts) and <Cls>shadow-sheet</Cls> (modals, drawers). Stacking: <Cls>z-raised</Cls> <Cls>z-sticky</Cls> <Cls>z-header</Cls> <Cls>z-floating</Cls> <Cls>z-overlay</Cls> <Cls>z-popover</Cls> <Cls>z-toast</Cls> <Cls>z-tooltip</Cls>.</>}>
          <div className="flex flex-wrap gap-6">
            <div className="grid h-20 w-40 place-items-center border border-ink bg-raised shadow-pop">
              <Cls>shadow-pop</Cls>
            </div>
            <div className="grid h-20 w-40 place-items-center border border-line bg-raised shadow-sheet">
              <Cls>shadow-sheet</Cls>
            </div>
          </div>
        </Specimen>
      </Section>

      {/* ---- motion ---- */}
      <Section id="motion" title="Motion" intro="Lean and settle. Transform, opacity and clip-path only, 120 to 420 ms, all of it removed under reduced motion. Things arrive from a visible state: nothing waits on script to appear.">
        <Specimen title="Durations and easings" note={<><Cls>dur-quick</Cls> 120 ms (hover, press) <Cls>dur-base</Cls> 200 ms <Cls>dur-settle</Cls> 280 ms (sheets, toasts) <Cls>dur-slow</Cls> 420 ms (progress). <Cls>ease-settle</Cls> for arrivals, <Cls>ease-pop</Cls> for the sticker only.</>}>
          <div className="grid gap-4">
            <Replay label="animate-lean-in">
              <span className="plane-board inline-flex h-11 animate-lean-in items-center px-4 font-bold">Added to cart</span>
            </Replay>
            <Replay label="animate-pop-in">
              <span className="inline-flex h-11 animate-pop-in items-center border border-ink bg-raised px-4 shadow-pop">Menu</span>
            </Replay>
            <Replay label="animate-sticker">
              <StickerChip pop>Fits Swift 2018 to 2023</StickerChip>
            </Replay>
            <Replay label="animate-wipe">
              <span className="relative inline-flex h-11 items-center overflow-hidden bg-ink px-5 text-page">
                <span className="absolute inset-0 animate-wipe bg-brand" />
                <span className="type-button relative text-brand-ink">Added</span>
              </span>
            </Replay>
            <Replay label="animate-tile-roll">
              <span className="inline-flex gap-0.5">
                {Array.from('P1').map((char, i) => (
                  <BoardTile key={char} tone="brand" className="animate-tile-roll" style={{ animationDelay: `${i * 30}ms` }}>
                    {char}
                  </BoardTile>
                ))}
              </span>
            </Replay>
          </div>
        </Specimen>
      </Section>

      {/* ---- motifs ---- */}
      <Section id="motifs" title="Motifs" intro="Each motif carries real shopping data. If there is no data behind it, it is not drawn.">
        <Specimen title="PitBoard, BoardWord, BoardTile, BoardSlot" note="Where the store reports a status: the car selector, the cart total, order tracking. Press Change car to see the tiles roll.">
          <BoardDemo />
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <BoardWord text="186 parts fit" size="sm" />
            <BoardWord text="Out for delivery" size="md" tone="brand" />
            <span className="inline-flex gap-0.5">
              <BoardTile size="lg" tone="brand">
                P1
              </BoardTile>
              <BoardTile size="lg">24</BoardTile>
              <BoardTile size="lg" tone="blank">
                -
              </BoardTile>
            </span>
          </div>
        </Specimen>

        <Specimen title="CompoundRing" note="Install difficulty 1 to 5 as a tyre compound: S soft and easy, M medium, H hard. The letter and the words carry the meaning; colour repeats it.">
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {[1, 2, 3, 4, 5].map((level) => (
              <CompoundRing key={level} difficulty={level} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <CompoundRing difficulty={3} size={24} showLabel={false} />
            <CompoundRing difficulty={5} size={56} showLabel={false} />
            <span className="type-small text-muted">showLabel=false keeps the words as the accessible name.</span>
          </div>
        </Specimen>

        <Specimen title="TimingTower, TimingRow, Roundel" note="Only for lists ranked by real numbers. Until sales data exists, show an unranked row of picks instead. The figures below are samples.">
          <TimingTower label="Sample ranking: best sellers this week, by units" className="max-w-xl">
            <TimingRow position={1} title="LED fog lamp pair, 6000 K" subtitle="Lighting" value={formatINR(2499)} delta={{ label: 'Lowest in 30 days', tone: 'best' }} to="/styleguide#motifs" />
            <TimingRow position={2} title="Gloss black front lip" subtitle="Exterior" value={formatINR(3299)} delta={{ label: `-${formatINR(400)}`, tone: 'gain' }} to="/styleguide#motifs" />
            <TimingRow position={3} title="7D floor mats, 5 seater" subtitle="Interior" value={formatINR(4199)} delta={{ label: `+${formatINR(150)}`, tone: 'loss' }} to="/styleguide#motifs" />
            <TimingRow position={4} title="Microfibre cloth, pack of 5" subtitle="Care" value={formatINR(349)} />
          </TimingTower>
          <div className="mt-4 flex items-center gap-2">
            <Roundel tone="paper">2</Roundel>
            <Roundel tone="brand">1</Roundel>
            <Roundel tone="ink">3</Roundel>
            <Roundel tone="ghost">4</Roundel>
            <Roundel size="sm">5</Roundel>
            <Roundel size="lg">6</Roundel>
          </div>
        </Specimen>

        <Specimen title="StickerChip" note="The scrutineering sticker: a fact the shop has checked. For ordinary status use Badge.">
          <div className="flex flex-wrap items-center gap-3">
            <StickerChip>Fits Swift 2018 to 2023</StickerChip>
            <StickerChip tone="ink">Invoice + warranty</StickerChip>
            <StickerChip tone="brand" icon={<Truck aria-hidden className="size-4" />}>
              Free delivery
            </StickerChip>
            <StickerChip tone="paper" className="border border-frame-ink">
              Shop verified
            </StickerChip>
            <StickerChip tone="brand" shape="round">
              COD
            </StickerChip>
            <div className="plane-frame relative grid size-28 place-items-center border border-line">
              <span className="type-small text-muted">Photo</span>
              <StickerChip tilt className="absolute bottom-2 left-2">
                Verified fit
              </StickerChip>
            </div>
          </div>
        </Specimen>

        <Specimen title="Tread and lean" note={<><Cls>TreadDivider</Cls> is the section break and the progress track. <Cls>lean-end</Cls> cuts the end of a band at the logo&apos;s 20 degrees; <Cls>lean-bottom</Cls> cuts the foot of a full-width plane (see the masthead). Slant means motion; cards, tables and forms stay square.</>}>
          <div className="grid gap-5">
            <TreadDivider />
            <TreadDivider tone="muted" size="sm" />
            <TreadDivider tone="line" size="lg" />
            <div className="flex flex-wrap items-center gap-4">
              <TreadDivider progress={progress} label="Sample progress" className="max-w-md flex-1" />
              <Button size="sm" variant="outline" onClick={() => setProgress((p) => (p >= 1 ? 0 : Math.min(1, p + 0.2)))}>
                Advance
              </Button>
            </div>
            <div className="flex">
              <div className="plane-brand lean-end mr-10 flex h-12 items-center pr-2 pl-4">
                <span className="type-button">Dispatch today till 4 pm</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="lean-box inline-block bg-ink px-3 py-1 text-page">
                <span className="lean-undo type-label inline-block">New</span>
              </span>
              <Cls>lean-box + lean-undo</Cls>
            </div>
          </div>
        </Specimen>

        <Specimen title="RollingTyre" note="The only loading indicator, and the scroll mark. Pages load with skeletons; the tyre is for a button at work or a route loading.">
          <div className="flex flex-wrap items-center gap-8">
            <RollingTyre />
            <RollingTyre size={40} label="Loading parts" />
            <RollingTyre mode="scroll" size={40} />
            <RollingTyre mode="still" size={40} className="text-line-strong" />
          </div>
        </Specimen>

        <Specimen title="SocialIcons and PaymentMarks" note="lucide has no brand icons, so these four are drawn on lucide's grid. Payment marks are plain tiles, not anyone's logo.">
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-3">
              <InstagramIcon title="Instagram" />
              <FacebookIcon title="Facebook" />
              <YouTubeIcon title="YouTube" />
              <WhatsAppIcon title="WhatsApp" />
              <WhatsAppIcon size={28} className="text-fit" />
            </span>
            <PaymentMarks />
            <PaymentMarks methods={['upi', 'cod']} compact />
          </div>
        </Specimen>
      </Section>

      {/* ---- buttons ---- */}
      <Section id="buttons" title="Buttons" intro="Filled buttons shout in italic capitals; ghost and link speak in sentence case. One primary per view. The label is a verb that says what happens.">
        <Specimen title="Button" note={<>Props: <Cls>variant</Cls> <Cls>size</Cls> <Cls>loading</Cls> <Cls>block</Cls> <Cls>iconLeft</Cls> <Cls>iconRight</Cls> <Cls>to</Cls> <Cls>href</Cls> and every button attribute.</>}>
          <div className="grid gap-4">
            {(['primary', 'dark', 'outline', 'ghost', 'danger', 'link'] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-3">
                <span className="w-20">
                  <Cls>{variant}</Cls>
                </span>
                <Button variant={variant} size="lg">
                  Add to cart
                </Button>
                <Button variant={variant}>Add to cart</Button>
                <Button variant={variant} size="sm">
                  Add to cart
                </Button>
                <Button variant={variant} iconRight={<ArrowRight aria-hidden />}>
                  Show what fits
                </Button>
                <Button variant={variant} loading>
                  Placing order
                </Button>
                <Button variant={variant} disabled>
                  Sold out
                </Button>
              </div>
            ))}
            <div className="grid max-w-sm gap-2">
              <Button block size="lg" iconLeft={<ShoppingCart aria-hidden />}>
                Add to cart
              </Button>
              <Button block variant="outline" to="/styleguide#buttons">
                A router link (to)
              </Button>
            </div>
          </div>
        </Specimen>

        <Specimen title="IconButton" note={<>Square, icon only. <Cls>label</Cls> is required: it is the accessible name and the tooltip.</>}>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton label="Search">
              <Search aria-hidden />
            </IconButton>
            <IconButton label="Save" variant="outline">
              <Heart aria-hidden />
            </IconButton>
            <IconButton label="Open cart" variant="primary">
              <ShoppingCart aria-hidden />
            </IconButton>
            <IconButton label="My car" variant="dark" size="lg">
              <Car aria-hidden />
            </IconButton>
            <IconButton label="Remove" variant="ghost" size="sm">
              <Trash2 aria-hidden />
            </IconButton>
            <IconButton label="Save" variant="outline" disabled>
              <Heart aria-hidden />
            </IconButton>
          </div>
        </Specimen>

        <Specimen title="CopyButton">
          <div className="flex flex-wrap items-center gap-4">
            <CopyButton value="ADDON10" label="Copy code" variant="code" />
            <CopyButton value="https://example.com/p/front-lip" label="Copy link" />
          </div>
        </Specimen>
      </Section>

      {/* ---- forms ---- */}
      <Section id="forms" title="Forms" intro="Labels above, 44 px controls, 16 px text. Hints stay visible. An error says what is wrong and how to fix it, with an icon as well as red.">
        <Specimen title="Field with react-hook-form and Zod" note="Field wires the label, hint and error to the control inside it. Submit it empty to see the errors.">
          <LiveForm />
        </Specimen>

        <Specimen title="Input, Textarea, Select" className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input placeholder="As on the delivery address" autoComplete="name" />
          </Field>
          <Field label="Search" labelHidden>
            <Input inputSize="lg" type="search" placeholder="Part, brand or car" leading={<Search aria-hidden />} />
          </Field>
          <Field label="Budget" hint="Whole rupees.">
            <Input inputMode="numeric" leading={<IndianRupee aria-hidden />} defaultValue="15000" className="tnum" />
          </Field>
          <Field label="GSTIN" optional>
            <Input mono placeholder="27ABCDE1234F1Z5" />
          </Field>
          <Field label="Email" error="Enter a valid email address">
            <Input type="email" defaultValue="rohan@" />
          </Field>
          <Field label="Coupon" hint="Not available on this order.">
            <Input disabled defaultValue="ADDON10" mono />
          </Field>
          <Field label="State">
            <Select placeholder="Choose a state" options={[{ value: 'MH', label: 'Maharashtra' }, { value: 'KA', label: 'Karnataka' }, { value: 'DL', label: 'Delhi' }]} />
          </Field>
          <Field label="Sort" error="Choose how to sort">
            <Select defaultValue="">
              <option value="">Choose</option>
              <option value="popular">Most popular</option>
            </Select>
          </Field>
          <Field label="What went wrong?" hint="Two or three lines is plenty." className="md:col-span-2">
            <Textarea placeholder="The clips on the left side did not line up" />
          </Field>
        </Specimen>

        <Specimen title="Checkbox, Switch" className="grid gap-x-8 md:grid-cols-2">
          <div>
            <Checkbox label="In stock only" defaultChecked />
            <Checkbox label="I understand this is a decorative show plate" description="It is not for use on public roads." />
            <Checkbox label="Select all" indeterminate />
            <Checkbox label="Unavailable for this PIN code" disabled />
            <Checkbox label="Accept the terms" invalid />
          </div>
          <div>
            <Switch label="Only parts for my car" defaultChecked />
            <Switch label="Cash on delivery" description="A fee of ₹49 applies." />
            <Switch label="Show on the storefront" labelFirst />
            <Switch label="Prepaid discount" disabled />
          </div>
        </Specimen>

        <Specimen title="Slider" note={<>Props: <Cls>value</Cls> <Cls>onChange</Cls> <Cls>min</Cls> <Cls>max</Cls> <Cls>step</Cls> <Cls>format</Cls> <Cls>valueText</Cls>. Wrap it in a Field. For an exact figure, use Input.</>}>
          <div className="max-w-md">
            <SliderDemo />
          </div>
        </Specimen>

        <Specimen title="RadioGroup, Segmented" className="grid gap-8 md:grid-cols-2">
          <RadioGroup
            legend="How would you like to pay?"
            variant="card"
            value={payment}
            onChange={setPayment}
            options={[
              { value: 'upi', label: 'UPI', description: 'Any UPI app. 2% off.', trailing: <span className="font-bold">{formatINR(12249)}</span> },
              { value: 'card', label: 'Card or netbanking', trailing: <span className="font-bold">{formatINR(12499)}</span> },
              { value: 'cod', label: 'Cash on delivery', description: 'Fee ₹49.', trailing: <span className="font-bold">{formatINR(12548)}</span> },
            ]}
          />
          <div className="grid content-start gap-6">
            <RadioGroup
              legend="Delivery"
              value={delivery}
              onChange={setDelivery}
              options={[
                { value: 'standard', label: 'Standard, 4 to 6 days' },
                { value: 'express', label: 'Express, 2 days', disabled: true },
              ]}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label="View"
                value={view}
                onChange={setView}
                options={[
                  { value: 'grid', label: 'Grid', icon: <LayoutGrid aria-hidden /> },
                  { value: 'list', label: 'List', icon: <List aria-hidden /> },
                ]}
              />
              <Segmented
                label="Body type"
                size="sm"
                value={body}
                onChange={setBody}
                options={[
                  { value: 'hatchback', label: 'Hatchback' },
                  { value: 'sedan', label: 'Sedan' },
                  { value: 'suv', label: 'SUV' },
                ]}
              />
            </div>
          </div>
        </Specimen>
      </Section>

      {/* ---- status ---- */}
      <Section id="status" title="Status" intro="State is said in words, backed by an icon, then coloured. Every badge, chip and countdown comes from real data.">
        <Specimen title="Badge" note={<>Tones by meaning. Variants: <Cls>soft</Cls> (default) <Cls>solid</Cls> <Cls>outline</Cls>.</>}>
          <div className="grid gap-3">
            {(['soft', 'solid', 'outline'] as const).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-2">
                <Badge variant={variant} tone="fit" icon={<CircleCheck aria-hidden />}>
                  Fits your Swift
                </Badge>
                <Badge variant={variant} tone="warn" icon={<TriangleAlert aria-hidden />}>
                  3 left
                </Badge>
                <Badge variant={variant} tone="stop">
                  Sold out
                </Badge>
                <Badge variant={variant} tone="info">
                  Universal fit
                </Badge>
                <Badge variant={variant} tone="best">
                  Lowest in 30 days
                </Badge>
                <Badge variant={variant} tone="brand">
                  Friday Five
                </Badge>
                <Badge variant={variant} tone="ink">
                  New
                </Badge>
                <Badge variant={variant} tone="neutral">
                  Sample
                </Badge>
                <Badge variant={variant} tone="fit" size="sm">
                  22% off
                </Badge>
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen title="Chip" note="A filter toggle. Selected chips turn to ink and announce themselves as pressed.">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['In stock', 128],
                ['Fits my car', 42],
                ['Road legal', 97],
              ] as const
            ).map(([name, count]) => (
              <Chip key={name} selected={chips.includes(name)} count={count} onClick={() => toggleChip(name)}>
                {name}
              </Chip>
            ))}
            <Chip selected removable>
              Under {formatINR(2000)}
            </Chip>
            <Chip size="sm" icon={<SlidersHorizontal aria-hidden />}>
              Filters
            </Chip>
            <Chip disabled>Express delivery</Chip>
          </div>
        </Specimen>

        <Specimen title="Callout" className="grid gap-3 md:grid-cols-2">
          <Callout tone="good" title="It fits, or it is on us">
            Shop verified for the Swift 2018 to 2023. If it does not fit, we take it back and pay the return.
          </Callout>
          <Callout tone="warn" title="Check your state&apos;s rules">
            Light bars above the roof line are for off-road use. Keep them covered on public roads.
          </Callout>
          <Callout tone="danger" title="Does not fit your Creta" actions={<Button size="sm" variant="outline">See lips that fit</Button>}>
            This lip is made for the Swift bumper only.
          </Callout>
          <Callout tone="info" title="Photos are placeholders">
            The part you receive is the one described. The credits page lists every photograph.
          </Callout>
        </Specimen>

        <Specimen title="Countdown" note="Only for a real deadline: a drop's end time, a quote's expiry. The clock below uses a stand-in two days from now.">
          <div className="flex flex-wrap items-end gap-8">
            <Countdown to={deadline} />
            <Countdown to={deadline} size="sm" label="Drop ends in" />
            <Countdown to={deadline} variant="inline" />
            <Countdown to="2020-01-01T00:00:00Z" />
            <span className="flex items-center gap-1.5">
              <Kbd>/</Kbd>
              <span className="type-small text-muted">to search,</span>
              <Kbd>Esc</Kbd>
              <span className="type-small text-muted">to close</span>
            </span>
          </div>
        </Specimen>
      </Section>

      {/* ---- structure ---- */}
      <Section id="structure" title="Structure" intro="Square corners, 1 px rules, flat planes. No card inside a card, no shadow on anything that sits in the page.">
        <Specimen title="Card" className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="type-h3">outline</p>
            <p className="type-small mt-1 text-muted">The default: a rule around content.</p>
          </Card>
          <Card variant="surface">
            <p className="type-h3">surface</p>
            <p className="type-small mt-1 text-muted">A grey plane for quieter groups.</p>
          </Card>
          <Card variant="outline" interactive>
            <p className="type-h3">interactive</p>
            <p className="type-small mt-1 text-muted">The rule turns to ink on hover.</p>
          </Card>
          <Card variant="board">
            <p className="type-h3">board</p>
            <p className="type-small mt-1 text-muted">The pit board plane.</p>
          </Card>
          <Card variant="brand">
            <p className="type-h3">brand</p>
            <p className="type-small mt-1 text-muted">The red plane. (`pit` still works as its old name.)</p>
          </Card>
          <Card padding="none">
            <CardHeader>
              <p className="font-bold">Delivery address</p>
              <Button variant="link">Change</Button>
            </CardHeader>
            <CardBody>
              <p className="type-small text-muted">CardHeader, CardBody, CardFooter with padding=&quot;none&quot;.</p>
            </CardBody>
            <CardFooter>
              <Button size="sm">Deliver here</Button>
            </CardFooter>
          </Card>
        </Specimen>

        <Specimen title="Tabs and Accordion" className="grid gap-8 md:grid-cols-2">
          <Tabs defaultValue="specs">
            <TabList label="Product details">
              <Tab value="specs">Specs</Tab>
              <Tab value="fitment" count={12}>
                Fitment
              </Tab>
              <Tab value="box">In the box</Tab>
              <Tab value="video" disabled>
                Video
              </Tab>
            </TabList>
            <TabPanel value="specs">
              <p className="type-small text-muted">Arrow keys move along the tabs. Home and End jump to the ends.</p>
            </TabPanel>
            <TabPanel value="fitment">
              <p className="type-small text-muted">Twelve cars are listed for this part.</p>
            </TabPanel>
            <TabPanel value="box">
              <p className="type-small text-muted">Lip, six screws, fitting card.</p>
            </TabPanel>
          </Tabs>
          <Accordion defaultOpen={['delivery']}>
            <AccordionItem value="delivery" title="How long does delivery take?">
              <p className="text-muted">Four to six working days to most PIN codes. The estimate for yours is on every product page.</p>
            </AccordionItem>
            <AccordionItem value="returns" title="Can I return a part that does not fit?" aside="7 days">
              <p className="text-muted">Yes. If we said it fits and it does not, the return is on us.</p>
            </AccordionItem>
            <AccordionItem value="cod" title="Is cash on delivery available?">
              <p className="text-muted">On most orders. Any fee is shown in rupees before checkout.</p>
            </AccordionItem>
          </Accordion>
        </Specimen>

        <Specimen title="Table" note="A table from 768 px, a stack of cards below it. Narrow the window to see it change. Sample rows.">
          <Table columns={ORDER_COLUMNS} rows={ORDERS} rowKey={(order) => order.number} caption="Sample orders" />
          <div className="mt-6">
            <Table columns={ORDER_COLUMNS} rows={[]} rowKey={(order) => order.number} caption="Loading orders" loading skeletonRows={2} />
          </div>
        </Specimen>

        <Specimen title="Stat" note="Admin KPI tiles. Sample figures." className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Revenue today" value={formatINR(48250)} delta={{ label: '+12% on last Tuesday', direction: 'up' }} />
          <Stat label="Orders" value="37" delta={{ label: '4 fewer', direction: 'down' }} hint="vs yesterday" to="/styleguide#structure" />
          <Stat label="Returns" value="2" delta={{ label: 'No change', direction: 'flat' }} icon={<Truck aria-hidden />} />
          <Stat label="Fitted first time" value="92%" loading />
        </Specimen>

        <Specimen title="EmptyState, Skeleton, Divider" className="grid gap-8 md:grid-cols-2">
          <EmptyState
            size="sm"
            title="Nothing saved yet"
            description="Tap the heart on any part to keep it here for later."
            actions={<Button to="/shop">Browse parts</Button>}
          />
          <div className="grid content-start gap-4">
            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <Skeleton className="aspect-square" />
              <SkeletonText lines={3} />
            </div>
            <Divider />
            <Divider label="or" />
            <Divider tone="strong" />
            <div className="flex h-6 items-center gap-3">
              <span className="type-small">Shipping</span>
              <Divider orientation="vertical" />
              <span className="type-small">Returns</span>
            </div>
          </div>
        </Specimen>
      </Section>

      {/* ---- navigation ---- */}
      <Section id="navigation" title="Navigation" intro="Where you are, and the way on.">
        <Specimen title="Breadcrumbs">
          <Breadcrumbs items={[{ label: 'Shop', to: '/shop' }, { label: 'Exterior', to: '/shop/exterior' }, { label: 'Front lips', to: '/shop/exterior/front-lips' }, { label: 'Addon Aero front lip' }]} />
        </Specimen>
        <Specimen title="Pagination" note="The current page is the red tile. On a phone it folds to previous, a page count, next.">
          <Pagination page={page} pageCount={12} onPageChange={setPage} label="Products" />
        </Specimen>
        <Specimen title="Stepper" note="Roundels joined by tread. Finished steps can be revisited; steps ahead cannot.">
          <Stepper
            label="Checkout"
            current={step}
            onStepClick={setStep}
            steps={[{ label: 'Cart' }, { label: 'Address', description: 'Pune 411045' }, { label: 'Payment' }, { label: 'Done' }]}
          />
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            <Button size="sm" variant="dark" onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Continue
            </Button>
          </div>
        </Specimen>
      </Section>

      {/* ---- overlays ---- */}
      <Section id="overlays" title="Overlays" intro="Modal and Drawer trap focus, close on Escape, lock the page behind and hand focus back. Toasts are small boards that lean in above the bottom bar.">
        <Specimen title="Modal, Drawer, Popover, Tooltip, Toast" note={<>Raise a toast from anywhere with <Cls>toast.success()</Cls> <Cls>toast.error()</Cls> <Cls>toast.info()</Cls>. <Cls>{'<Toaster />'}</Cls> is mounted once, in App.tsx.</>}>
          <OverlayDemos />
        </Specimen>
      </Section>

      {/* ---- commerce ---- */}
      <CommerceSection />

      <div className="container-page pb-16">
        <TreadDivider />
        <p className="type-small mt-4 text-muted">Addon Auto Motive design system. Names, prices and orders on this page are samples.</p>
      </div>
    </div>
  );
}
