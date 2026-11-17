# Addon Auto Motive design guide: "Pit Board" in black, white and Tread Red

The working reference for everyone building pages. See it live at `/styleguide`
(`src/pages/dev/StyleguidePage.tsx`). Tokens live in `src/styles/index.css`.

## The idea

Run the shop like a race weekend: what fits, what it costs and when it arrives go up on the board.
Black on white with one red, the red of the tread on the owner's logo. Heavy italic capitals for things that move or shout (the offer poster's voice), upright type for anything a shopper reads to decide.
Addon is a shop and a fitting studio: parts are bought, then fitted at the studio in a booked slot, so the red goes on the step that moves a shopper towards that slot.
Every motif (board, compound ring, timing row, sticker, tread) carries real shopping data, or it is not drawn.

## Three rules before anything else

1. **Use only tokens and kit components.** No hex values, no `font-[...]`, no stock Tailwind colours (`bg-zinc-900` produces nothing here), no `dark:` variants: tokens already switch with the theme.
2. **Tread Red is a fill with white ink, and danger never looks like it.** Red fills the main action and brand moments. Errors, "does not fit" and sold out use the separate danger colour (`stop`) as an outlined, tinted box with an icon and words. Warnings are orange.
3. **Colour is never the only signal.** Every state has words, and an icon where it matters.

## Colour tokens

Use as `bg-*`, `text-*`, `border-*`. All pairs below hold WCAG AA in both themes.

| Utility | Use |
|---|---|
| `bg-page` | The page. White / near-black |
| `bg-surface`, `bg-surface-2` | Quiet panels and bars; insets, hover |
| `bg-raised` | Sheets, menus, dialogs |
| `bg-frame` + `text-frame-ink` | Photo frame: white in **both** themes |
| `text-ink`, `bg-ink` + `text-page` | Text; the dark fill. `bg-ink-2` is its hover |
| `text-muted` | Secondary text (AA on every ground) |
| `border-line` | 1 px rules between things (the default border colour) |
| `border-line-strong` | Outlines of controls (3:1) |
| `bg-brand` + `text-brand-ink` | Tread Red fill (#d71920) with white ink. `bg-brand-press` hover and pressed. `bg-brand-soft` selected row or chosen option |
| `text-brand-text` | Red words, at display size only (a word in a `type-display` or `type-poster` line). Never body text, links, prices or warnings |
| `text-red`, `bg-red` | The fixed Tread Red that does not flip on the red plane. Logo and print marks only |
| `text-fit`, `bg-fit` + `text-fit-ink`, `bg-fit-soft` | Green: fits, in stock, price drop |
| `text-warn`, `bg-warn` + `text-warn-ink`, `bg-warn-soft` | Orange: low stock, needs a workshop, check rules |
| `text-stop`, `bg-stop` + `text-stop-ink`, `bg-stop-soft` | Danger: does not fit, sold out, off-road only, errors. Nothing else. Deep oxblood (#8f0f1c) in the light theme, pale rose (#ffa3ab) in the dark theme: never the brand red |
| `text-info`, `bg-info` + `text-info-ink`, `bg-info-soft` | Blue: neutral information |
| `text-best`, `bg-best` + `text-best-ink`, `bg-best-soft` | Purple: a genuine best only (lowest price in 30 days, top seller this week) |
| `bg-overlay` | Scrim behind modals and drawers |

**Deprecated names, still working.** The yellow era's names now resolve to the red set, so nothing breaks; write the new names in new code and when you touch a page:

| Old | New |
|---|---|
| `bg-pit`, `text-pit-ink`, `bg-pit-press`, `bg-pit-soft`, `fill-pit`, `border-pit-ink` | `bg-brand`, `text-brand-ink`, `bg-brand-press`, `bg-brand-soft`, `fill-brand`, `border-brand` |
| `plane-pit`, `Card variant="pit"` | `plane-brand`, `Card variant="brand"` |
| `tone="pit"` on Badge, Roundel, StickerChip, BoardTile, BoardWord | `tone="brand"` |
| CSS `--yellow`, `--yellow-press`, `--pit*` | `--red`, `--red-press`, `--brand*` |

### Brand red and danger: do and don't

Contrast (WCAG AA, checked for every text pair on every ground in both themes and on every plane): white on Tread Red 5.2:1; Tread Red against the light page 5.2:1 and the dark page 3.8:1 (a shape, needs 3:1); danger text 9.3:1 on white and 10.3:1 on the dark page; danger and brand red differ in lightness by 1.8:1, so they part even in greyscale.

| Do | Don't |
|---|---|
| One red fill per view: the primary Button ("Add to cart", "Book a fitting slot") | Two red buttons side by side, or a red button on the red plane (it turns black there by itself) |
| Red for brand moments: a live offer badge, the current step roundel, the selected tab bar, the saved heart, a progress tread | Red for small text, links, prices or warnings |
| Danger as `Callout tone="danger"`, `Badge tone="stop"` (outlined), `Button variant="danger"` (outlined), FitBadge for "does not fit", each with an icon and words | A solid red box for an error, a sold-out tag or a delete button: that is the brand's look |
| Say what is wrong in words: "Does not fit your Swift", "Sold out" | Colour alone: a red border on a field with no message, a red dot |
| Checkboxes, radios and switches in ink (black by day, white at night) | Red form controls: a red tick reads as an error next to a red error message |

**Planes.** Depth comes from flat planes, not shadows. A plane sets its own ground and re-scopes every token inside it, so the same classes and components stay correct:

| Class | What it is |
|---|---|
| `plane-board` | The pit board: black in the light theme, paper in the dark theme. Status, the car selector, toasts |
| `plane-brand` | The red plane, white ink in both themes (`plane-pit` is its old name). At most one region per page: a hero, an offer band. Inside it `bg-brand` is black, so a primary Button becomes the black button. State colours do not read as text on red: put them in a Badge (its soft ground is white here). Callout and the full FitBadge keep the light set by themselves (`data-paper`) |
| `plane-frame` | White in both themes, for photographs |

## Typography

Archivo Variable for everything; Martian Mono for codes; Noto Sans Devanagari for Hindi. Each `type-*` class is a complete recipe (family, weight, slant, size, leading, tracking, case): add a colour and nothing else. Do not combine a recipe with `text-xl`, `font-bold`, `italic` or `uppercase`.

| Class | Looks like | Use |
|---|---|---|
| `type-display` | 900 italic caps, 40 to 88 px | One per page at most. Four words or fewer per line: "TELL THE BOARD YOUR CAR." |
| `type-poster` | 900 condensed italic caps, 36 to 80 px | The offer poster's voice ("UPGRADE YOUR RIDE"), for a brand moment on the board or the red plane. Condensed on desktop only; keep it short |
| `type-h1` | 800 italic caps, 28 to 48 px | Page headline: "WHAT FITS YOUR SWIFT" |
| `type-h2` | 800 italic caps, 22 to 32 px | Section heading: "THE FRIDAY FIVE" |
| `type-title` | 800 upright, 24 to 36 px | Product names, order numbers, admin page titles |
| `type-h3` | 700 upright, 18 to 20 px | Sub-headings, card and dialog titles |
| `type-lead` / `type-body` / `type-small` | 17-18 / 16 / 14 px | Opening paragraph / everything read / hints and meta |
| `type-label` | 700 caps 12 px | Chips, table headers, field-group names |
| `type-button` | 800 italic caps 15 px | Set by Button; rarely needed directly |
| `type-code` | Martian Mono 500 caps 12 px | SKU, order number, PIN code, coupon |
| `type-price-xl` / `type-price` / `type-mrp` | 800 28 px / 700 17 px / struck 13 px muted | Prices: always upright, always tabular |
| `type-stat`, `type-board` | 800 tabular | KPI figures; board tiles |
| `tnum` | tabular lining figures | Any other number that sits in a column or changes |

Rules:
- Italic capitals shout: headlines and buttons only. Names, specs, prices and anything in Hindi are upright.
- Never set a rupee amount in mono: Martian Mono has no ₹ glyph. Format with `formatINR` from `@/lib/format` (`₹1,19,999`).
- No small capital label floating above a heading. No decorative 01 / 02 / 03.
- Hindi: put `lang="hi"` on the element; it takes `font-hindi` and looser leading by itself. Never italic or all-caps display type for Hindi.
- Body copy stays under about 70 characters a line: wrap it in `max-w-prose` or `container-prose`.
- Icons: lucide-react only, default 2 px stroke, at `size-4`, `size-5` or `size-6`. Brand icons come from `@/components/brand`.

## Layout

| Thing | Rule |
|---|---|
| Container | `container-page`: max 1280 px content, gutter 16 px (360) / 24 px (768) / 32 px (1280). `container-prose` for reading pages |
| Section rhythm | `section-y` between page sections. Inside: gaps of 4, 8, 12, 16, 24, 32, 48, 64 px (`gap-1` to `gap-16`). Vary it: tight inside a group, generous between groups |
| Product grid | Use `ProductGrid` from the commerce components (2 columns at 360, 3 at 768, 4 at 1280, optionally 5). For another grid with the same rhythm: `grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4` |
| Corners | `rounded-control` (2 px) on controls and chips; square on cards, boards and frames; `rounded-full` on roundels and stickers. No other radius exists |
| Rules | 1 px `border-line`; `border-ink` to open a table or total. Never thicker than 1 px, never a coloured stripe down an edge |
| Shadows | None in the page. `shadow-pop` and `shadow-sheet` are for floating layers and are already applied by the kit |
| Stacking | `z-raised` 10, `z-sticky` 20, `z-header` 40, `z-floating` 45, `z-overlay` 50, `z-popover` 60, `z-toast` 70, `z-tooltip` 80 |
| Breakpoints | Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Write the 360 px layout first |
| Alignment | Left aligned. Centre only inside a centred container (a drawer's empty state). No centred hero with two buttons |

## UI kit: `import { ... } from '@/components/ui'`

| Component | Props (defaults first) | Use |
|---|---|---|
| `Button` | `variant` primary, dark, outline, ghost, danger, link; `size` md, sm, lg; `loading`; `block`; `iconLeft`; `iconRight`; `to` (router link) or `href` | `<Button size="lg" loading={saving}>Add to cart</Button>`. One primary per view. Label is a verb |
| `IconButton` | `label` (required), `variant` ghost..., `size`, `to` | `<IconButton label="Search"><Search /></IconButton>` |
| `CopyButton` | `value`, `label`, `variant` button, code | `<CopyButton variant="code" value="ADDON10" label="Copy code" />` |
| `Field` | `label`, `hint`, `error`, `optional`, `required`, `labelHidden` | Wraps one control and wires label, hint and error: `<Field label="PIN code" error={errors.pincode?.message}><Input {...register('pincode')} /></Field>` |
| `Input` | `inputSize` md, lg; `leading`; `trailing`; `mono`; `invalid` | Set `type`, `inputMode`, `autoComplete`: they pick the phone keyboard |
| `Textarea` | `rows` 4, `invalid` | Free text |
| `Select` | `options`, `placeholder`, `selectSize`, `invalid` | Native select. Five choices or fewer: use RadioGroup or Segmented |
| `Checkbox` | `label`, `description`, `indeterminate`, `invalid` | A choice confirmed by a Save or Continue button |
| `Switch` | `label`, `description`, `labelFirst` | A setting that applies at once: "Only parts for my car" |
| `RadioGroup` | `legend`, `options[{value,label,description,trailing}]`, `value`, `onChange`, `variant` plain, card; `error` | `card` for payment methods and delivery options with a price in `trailing` |
| `Segmented` | `label`, `options`, `value`, `onChange`, `size`, `block` | Two to five views of the same thing: Grid / List |
| `Badge` | `tone` neutral, ink, brand, fit, warn, stop, info, best (`pit` = brand); `variant` soft, solid, outline; `size`; `icon` | `<Badge tone="warn" icon={<TriangleAlert />}>3 left</Badge>`. Real data only. `stop` is always outlined or keylined and always takes an icon. `BadgeTone` (for lookup tables) does not list `brand` yet; `BadgeToneName` does |
| `Chip` | `selected`, `count`, `icon`, `removable`, `size` | A filter toggle: `<Chip selected={on} count={42} onClick={toggle}>Fits my car</Chip>`. A `removable` chip is a remove button: not announced as pressed, and screen readers hear "remove" |
| `Slider` | `value`, `onChange`, `min` 0, `max` 100, `step` 1, `format`, `valueText` | A range inside a Field: `<Slider value={budget} onChange={setBudget} min={5000} max={100000} step={2500} format={formatINR} />`. For an exact figure use Input |
| `Callout` | `tone` info, warn, danger, good; `title`; `actions`; `live` | A boxed message in the flow of the page. Say what happened and what to do |
| `Countdown` | `to` (ISO), `label`, `variant` tiles, inline; `size`; `onEnd` | Only a real deadline: a drop's `endsAt`, a quote's expiry |
| `Card` (+ `CardHeader`, `CardBody`, `CardFooter`) | `variant` outline, surface, raised, board, brand (`pit` = brand); `padding` md, none, sm, lg; `interactive`; `as` | A flat square region. Never a card inside a card |
| `Divider` | `orientation`, `tone` line, strong; `label` | A 1 px rule. Section breaks use `TreadDivider` |
| `Tabs`, `TabList`, `Tab`, `TabPanel` | `defaultValue` or `value` + `onValueChange`; `Tab value count` | Views of one thing (Specs / Fitment) |
| `Accordion`, `AccordionItem` | `type` single, multiple; `defaultOpen`; item `value`, `title`, `aside` | FAQs, spec groups |
| `Table` | `columns[{key,header,cell,numeric,primary}]`, `rows`, `rowKey`, `caption`, `loading`, `empty`, `dense` | A table from 768 px, stacked cards below. Mark the naming column `primary` |
| `Stat` | `label`, `value`, `delta{label,direction,good}`, `hint`, `to`, `loading` | Admin KPI tile |
| `EmptyState` | `title`, `description`, `actions`, `art`, `align` start, `size` md | Always offer the next step |
| `Skeleton`, `SkeletonText` | `className` for size; `lines` | Loading: lay skeletons out like the finished content |
| `Breadcrumbs` | `items[{label,to}]` | Above the page headline on catalogue pages |
| `Pagination` | `page`, `pageCount`, `onPageChange`, `hrefFor` | Pass `hrefFor` so pages are real links |
| `Stepper` | `steps[{label,description}]`, `current`, `onStepClick` | Checkout and order progress |
| `Modal` | `open`, `onClose`, `title`, `description`, `footer`, `size`, `dismissible` | A decision that must be made before going on. If it can live in the page, it does |
| `Drawer` | same as Modal plus `side` right, left; `toolbar`; `height` auto, full | Cart, filters, pickers. Right panel from 768 px, bottom sheet below. `full` fills a phone screen (the menu) |
| `Popover` | `trigger`, `label`, `placement`, children or `({ close }) => ...` | Sort menus, a two-line explanation |
| `Tooltip` | `content`, one focusable child | A hint that repeats what is already clear. Touch has no hover |
| `toast`, `Toaster` | `toast.success(msg, { description, action, duration })`, `.error`, `.info` | Brief feedback after an action. Errors a shopper must fix go in the page |
| `Kbd`, `VisuallyHidden`, `Portal` | | Key hints; text for screen readers only |

Focus trap, Escape, scroll lock and focus return are built into Modal and Drawer. Do not hand-roll overlays; the hooks are exported from `@/components/ui` if a new one is truly needed.

## Brand components: `import { ... } from '@/components/brand'`

| Component | Props | Rule for use |
|---|---|---|
| `Logo` | `height` 32, `variant` full, mark; `tagline`; `roll` none, scroll; `label` | The owner's logo redrawn on the grid of `public/brand/addon-logo.png`: letters in the text colour (black, white in the dark theme and on the board), the tyre always black with a Tread Red tread and a silver alloy. Never retype ADDON in a font. Under 28 px tall set `tagline={false}`. `roll="scroll"` turns the alloy. Static files: `public/brand/addon-logo.svg` (for light grounds), `addon-logo-light.svg` (dark grounds), `addon-mark.svg` |
| `LogoTyre` | `roll` | The logo's tyre as bare SVG shapes in the logo's pixel space, for a custom lockup. Most pages want `Logo variant="mark"` |
| `RollingTyre` | `size`, `mode` spin, scroll, still; `label` | The only loader. Pages load with skeletons; the tyre is for a route or a working button |
| `TreadDivider` | `tone` ink, brand, muted, line; `size`; `progress` 0 to 1 + `label` | The break between major sections; `brand` is the logo's red tread, once a page at most. With `progress`, a real progress track that fills red |
| `PitBoard`, `BoardWord`, `BoardTile`, `BoardSlot` | board `title`, `aside`; word `text`, `tone` paper, brand, blank (`pit` = brand); `size` sm to xl; slot `label`, `value`, `placeholder` | Where the store reports a status: the car selector, cart total, order tracking. A few words at most |
| `CompoundRing` | `difficulty` 1 to 5, `size`, `showLabel` | Install difficulty as S / M / H. Keep the label unless space forces it out |
| `TimingTower`, `TimingRow` | tower `label`; row `position`, `title`, `subtitle`, `media`, `value`, `delta{label,tone}`, `to` | Lists ranked by real numbers only. No data yet: show an unranked row of picks |
| `Roundel` | `tone` paper, brand, ink, ghost (`pit` = brand); `size` | A real position or step number. Never beside a heading for decoration |
| `StickerChip` | `tone` fit, ink, brand, paper (`pit` = brand); `shape` lozenge, round; `tilt`; `pop`; `icon` | A fact the shop has verified ("Fits Swift 2018 to 2023"). Otherwise use Badge |
| `InstagramIcon`, `FacebookIcon`, `YouTubeIcon`, `WhatsAppIcon` | `size`, `title` | lucide has no brand icons |
| `PaymentMark`, `PaymentMarks` | `kind` / `methods` upi, card, netbanking, cod; `compact` | Show only what the store really accepts |

## Commerce components: `import { ... } from '@/components/commerce'`

The shopping building blocks. Every one takes the API shapes from `@/types/api` as they arrive: do not reshape data to feed them.
All are live on `/styleguide` (section "Commerce") with sample data. `CompoundRing` and `EmptyState` are re-exported here too.

### Products

| Component | Props (defaults first) | Use |
|---|---|---|
| `ProductCard` | `product` (ProductSummary), `eager`, `vehicle`, `compare`, `fittedOkPercent` | `<ProductCard product={p} />`. Photo, house line, name (2 lines), price, fit verdict, label chips, report line, low stock, save, quick add. Usually drawn by ProductGrid or ProductRail |
| `ProductGrid` | `products`, `loading`, `updating`, `columns` 4, 5; `skeletons` 8, `eagerCount` 0, `empty`, `vehicle`, `compare`, `label` | `<ProductGrid products={data?.items} loading={isPending} updating={isPlaceholderData} empty={<EmptyState ... />} />`. Two columns at 360 px. Draws its own skeletons and empty state |
| `ProductRail` | `title`, `products`, `loading`, `description`, `seeAll {to,label}`, `vehicle`, `compare`, `as` h2, h3 | `<ProductRail title="Works well with" products={items} seeAll={{ to: '/shop/lighting' }} />`. One scroll-snap row with arrows from 768 px. Renders nothing when empty |
| `ProductCardSkeleton` | `className` | A card-shaped placeholder for a custom layout. ProductGrid and ProductRail already use it |
| `ProductFrame` | `image`, `alt`, `artKind`, `variant` thumb, full, tiny; `eager`, `sizes`, `muted`, children | `<ProductFrame image={p.image} alt={p.name} artKind={p.artKind} />`. The 1:1 white frame. `full` for galleries (srcSet up to 1200 px). No photo or a broken one: the category icon and "Photo coming soon". `tiny` for frames under 64 px (search rows, order items): the icon alone. `iconForArtKind(artKind)` gives that icon alone, for category tiles and menus |
| `Price` | `price`, `mrp`, `regularPrice`, `drop`, `from`, `lowest30Days`, `size` md, sm, lg; `showDropChip` true | `<Price size="lg" price={p.price} mrp={p.mrp} regularPrice={p.regularPrice} drop={p.drop} lowest30Days={p.lowest30Days} />`. `lg` adds "Inclusive of all taxes". In a drop: regular price struck, the reason on demand. Pass `showDropChip={false}` where a full DropBadge already states the percent. `percentBelow(price, mrp)` is exported |
| `StockNote` | `stock`, `inStock`, `lowStock`, `variant` compact, full | `<StockNote variant="full" stock={v.stock} inStock={v.inStock} />`. "Sold out", "Only 3 left", "In stock". Real stock only |
| `DropBadge` | `drop {percentOff, endsAt, reason?}`, `variant` compact, full | `<DropBadge variant="full" drop={p.drop} />`. Counts down to the real `endsAt`, then removes itself and refetches prices. The only countdown allowed |
| `DemoBadge` | `variant` outline, solid; `className` | `<DemoBadge />` beside anything with `isDemo: true` (reports, questions, builds). Reads "Sample". `solid` is a white label that reads on a photo or a dark stage |

### Fit and the garage

| Component | Props | Use |
|---|---|---|
| `FitBadge` | `product` (anything with `fit`: a product or a PricedLine), `variant` compact, full; `vehicle`, `onAsk` | `<FitBadge variant="full" product={product} onAsk={openQuestionForm} />`. The six verdicts as icon, words and colour. With no car it opens the picker. `describeFit(subject, vehicle)` gives the words alone; `fitsPath(product)` is the "parts that fit" link |
| `VehiclePicker` | none | Mounted once by `App.tsx`. Never mount it in a page. Open it with `useUi.getState().openVehiclePicker()` |
| `VehicleSteps` | `onDone(vehicle)`, `wide`, `className` | The make, model and year steps alone, for a page that holds its own car (the planner). Does not follow the garage car |
| `VehiclePickerInline` | `onSelect(vehicle)`, children (node or `(car) => node`), `className` | The same make, model, year board in the page (home hero). Children are the call to action shown once a car is set |
| `GarageButton` | `compact`, `className` | `<GarageButton />` in the header: the white plate reading the active car, or "Add your car". Opens the picker |

### The Straight Label and Plain Talk

| Component | Props | Use |
|---|---|---|
| `StraightLabelChips` | `product` (legality, warrantyImpact, installDifficulty, proInstall) | On cards and rows. The difficulty ring always; a chip only for a catch (not road legal, fitter advised, warranty risk) |
| `StraightLabelPanel` | `label` (ProductDetail.label), `headingLevel` h2, h3 | `<StraightLabelPanel label={product.label} />`. All nine rows, always. Links to `/straight-label` |
| `Jargon` | `term`, children | `<Jargon term="PCD">bolt pattern</Jargon>` or `<Jargon>offset</Jargon>`. A press or keyboard focus opens the two-line explanation. Unknown words render as plain text |
| `JargonText` | `text` | `<JargonText text={spec.value} />`. Finds glossary words in catalogue text and makes the first of each tappable |
| `useGlossary()` | | `{ entries, categories, find(word), inCategory(id) }` from `src/data/glossary.ts`. Each entry's anchor is `/glossary#<entry.id>` |

`LEGALITY_WORDS`, `WARRANTY_WORDS` and `WIRING_WORDS` hold the one wording of each label value (`label`, `chip`, `level`, `detail`): use them wherever those values are shown (compare table, cart advice, admin).

### Buying

| Component | Props | Use |
|---|---|---|
| `AddToCartButton` | `productId`, `variantId`, `qty` 1, `custom`, `productName`, `blocked`, `variant` button, icon; `tone` primary, dark, outline; `size`, `block`, `disabled`, `openCart` true, `onAdded(key)`, children | `<AddToCartButton size="lg" block productId={p.id} variantId={variant?.id} qty={qty} blocked={p.hasVariants && !variant ? 'Choose a size first' : null} />`. Confirms in place, opens the cart drawer, explains in a toast when it cannot add |
| `QtyStepper` | `value`, `onChange`, `min` 1, `max` 99, `size` md, sm; `label`, `disabled` | `<QtyStepper value={line.qty} max={line.maxQty} onChange={(qty) => setQty(cartLineKey(line), qty)} />` |
| `WishlistButton` | `productId`, `productName`, `variant` icon, button; `size`, `onPhoto` | A pressed toggle on the wishlist store |
| `CompareButton` | `productId`, `productName`, `variant` icon, button, text; `size`, `onPhoto` | A pressed toggle on the compare store (four at most). Offers the way to `/compare` |
| `PincodeCheck` | `codEligible` true, `onEstimate(estimate)`, `label` | `<PincodeCheck codEligible={product.codEligible} />`. Real delivery dates and COD for a PIN code. Remembers it in the cart store |
| `CustomSummary` | `custom`, `heading` true | `<CustomSummary custom={line.custom} />` on a cart line or order item with a designer payload. Reads any shape; `kind` names the design |

### Sharing and page furniture

| Component | Props | Use |
|---|---|---|
| `WhatsAppButton` | `text`, `to` store, share; children, `variant` outline, `size`, `block`, `iconOnly` | `<WhatsAppButton text={askAboutProduct({ product, vehicle })}>Ask about this part</WhatsAppButton>`. Renders nothing while `settings.whatsapp` is blank |
| `ShareButton` | `url`, `title`, `text`, children, `variant`, `size`, `iconOnly` | The share sheet of the phone, or copies the link |
| `PageHeader` | `title`, `breadcrumbs`, `description`, `meta`, `actions`, `variant` headline, plain | The one `<h1>` of a page. No container of its own: place it inside `container-page`. `plain` for order numbers, product names and admin pages |
| `SectionHeading` | `title`, `description`, `seeAll {to,label}`, `action`, `as` h2, h3; `id` | The heading of a page section, with the way to the full list |
| `ErrorState` | `error`, `onRetry`, `title`, `notFoundAction`, `size` md, sm; `align` | `if (error) return <ErrorState error={error} onRetry={refetch} />`. Chooses retry, a way onward (404) or sign in (401) from the ApiError |

### Rules for these

- **A card is one link.** ProductCard stretches its name link over the whole card. Anything pressable you add inside a card needs `relative z-raised`, or the press opens the product instead.
- **The fit verdict belongs to the car the API was asked about.** Fetch with the active car (`useProducts`, `useProduct` do it) and FitBadge names that car. On a page about another car, pass `vehicle`.
- **The Straight Label uses danger once.** Off-road only is the one label value shown in the danger colour (with its icon): it is a hard no for road use. Everything else on the label is green or orange.
- **The report line is labelled Sample** while `settings.hasDemoData` is true, because ProductSummary cannot say which reports are seeded.
- **Links these components make:** `/p/<slug>`, `/shop/<parent>/<category>?fitOnly=1`, `/glossary#<id>`, `/straight-label`, `/compare`, `/garage`, `/login?next=...`. The pages behind them must honour those addresses.

## Motifs: each one only with real data

| Motif | Means | Never |
|---|---|---|
| Pit board | A live status about *this* shopper: their car, their cart, their order | A slogan on a black box |
| Compound ring | Install difficulty from the product's `installDifficulty` | A generic rating |
| Timing row + roundel | A rank computed from sales or price history | Hand-picked lists, "01 02 03" decoration |
| Sticker | A shop-verified fact (`fitVerified`, invoice, COD eligibility) | Marketing claims |
| Sector colours | Green gain, danger-red loss, purple best, orange low | Colour without the words |
| Tread | The section break; a progress track with real progress | A border on every card |
| The lean (20 degrees, `--lean`) | Motion: the end of a red band (`lean-end`), the foot of a full-width plane (`lean-bottom`), a small flag (`lean-box` + `lean-undo`) | Slanted cards, tables, forms or photos. Information stays square |
| Chequered flag | The order-confirmed screen, once | Anywhere else |

## Motion

- Transform, opacity and clip-path only. Durations: `dur-quick` 120 ms (hover, press), `dur-base` 200, `dur-settle` 280 (sheets, toasts), `dur-slow` 420 (progress). Nothing longer.
- Easing: `ease-settle` for arrivals, `ease-pop` for the sticker only.
- Ready-made: `animate-lean-in`, `animate-pop-in`, `animate-fade-in`, `animate-sheet-in-bottom`, `-right`, `-left` (each with an `-out`), `animate-sticker`, `animate-tile-roll`, `animate-wipe`, `animate-shimmer`, `animate-ticker`, `animate-roll`, and `roll-scroll` (turns with scroll, pure CSS).
- Content is visible by default. Animate from a visible state, on the user's action; never hide a section until a script reveals it, and never fade every section in on scroll.
- Reduced motion is handled globally in CSS and by `<MotionConfig reducedMotion="user">`. Do not add motion that bypasses them.
- No parallax, scroll-jacking, cursor effects, tilt cards, auto-rotating carousels or looping decoration. One ticker per page at most.

## Photos

- Product frames are 1:1 on `plane-frame` (white in both themes) with `object-cover`. Use the commerce `ProductFrame`; do not build your own.
- Always set `width` and `height` (or an aspect-ratio box), `alt` that says what is shown, `loading="lazy"` and `decoding="async"` below the fold. The first product image and the hero load eagerly.
- Use `imageVariant(url, 480)` for thumbnails.
- No photo: the placeholder frame with the category icon and "Photo coming soon". Never a grey box, a broken-image icon or a stretched image.
- No text set over a photograph. No filters, duotones or gradients over photos. Stickers sit in the corner of the frame.

## Mobile

- Most shoppers are on a mid-range Android phone. Build at 360 px first, then widen.
- Touch targets are at least 44 px: kit controls already are (`sm` sizes carry an invisible 44 px hit area via `tap-44`).
- Inputs are 16 px text so the page never zooms on focus. Use the right `type`, `inputMode` and `autoComplete`.
- A fixed five-slot bar sits at the bottom (56 px, `--bottom-bar-h`). Anything fixed to the bottom must clear it and the safe area (`pb-safe`). Toasts already do.
- Pickers and filters open in a `Drawer` (a bottom sheet on a phone), not a full page and not a tiny dropdown.
- Tables become stacked cards (`Table` does it). Long rows of chips or tabs scroll sideways with `no-scrollbar`; they do not wrap into a wall.
- Nothing may cause horizontal page scroll at 360 px.

## Printable pages (invoice, fitting card)

Print always uses the light tokens. Hide chrome with `print:hidden`; overlays hide themselves. Keep fills that matter (tiles, QR codes) with `print-exact`.

## Voice

Plain, direct Indian English, a little dry. Short sentences. Rupees as `₹1,19,999`. No exclamation marks, no emoji, no hype ("premium", "unleash", "seamless"). Buttons say what they do. Errors say what went wrong and how to fix it. Sample data is labelled Sample.

## Never

1. A hex colour, an arbitrary font, or a stock Tailwind palette class in a page.
2. Brand red as small text, as a warning or as the look of an error. Danger (`stop`) for anything but errors, sold out, "does not fit" and "off-road only". Any leftover yellow.
3. Gradients (especially purple or blue), glass or blur panels, glows, carbon-fibre or metal textures.
4. Rounded cards, drop shadows on page content, thick outlines, offset block shadows, a coloured stripe down a card's edge.
5. A card inside a card. A modal for something that could be inline.
6. A centred hero with a headline, a subhead and two buttons. Three identical icon cards in a row. A stats strip of invented numbers.
7. A small caps label above every heading. Decorative numbering. Mono type as a costume.
8. Fake urgency or social proof: a countdown without a real end time, "only 2 left" without stock data, star ratings, "X people viewing".
9. A motif with no data behind it: a timing tower of hand-picked items, a sticker for a claim nobody verified.
10. Spinners for page loads (use skeletons), speedometer loaders, chequered borders.
11. Emoji as icons. Icons from a second icon set.
12. A price in Martian Mono. A price without tabular figures. An MRP that is not real.
13. Italic or all-caps Hindi. Browser-faked italics or bold.
14. Motion on layout properties, or content that starts hidden and waits for JavaScript.
15. Hand-rolled buttons, inputs, overlays or toasts when the kit has one.
