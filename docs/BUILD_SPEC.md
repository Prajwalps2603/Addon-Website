# Addon Auto Motive: build specification

This is the shared brief for everyone building the store. Read it fully before writing code.
The three contract files are law; this document explains how the pieces fit.

| Contract | File |
|---|---|
| Database | [server/src/db/schema.sql](../server/src/db/schema.sql) |
| JSON shapes | [client/src/types/api.ts](../client/src/types/api.ts) |
| Endpoints | [docs/API.md](API.md) |

Research you can open when your area needs it (all under
`D:/cache/claude-tmp/claude/d6c9c5d930eb4fba/bf82bf23-97d7-4701-8dbb-dd3b43b785c1/scratchpad/research/`):
`stack.md` (exact package versions, tested setup files, API gotchas: **read the parts for every library you use**),
`design.md` (the visual direction and tokens), `india-commerce.md` (Razorpay, UPI, COD, GST, mandatory disclosures,
show-plate wording), `competitors.md`, `reference-site.md`, `catalog.json` (also copied to `server/src/seed/data/catalog.json`).

## 1. What we are building

An online store for **Addon Auto Motive**, an Indian seller of car accessories and modification parts.
Customers browse, check that a part fits their car, and order with UPI, cards or cash on delivery.
The owner runs everything from an admin panel on a phone.

It must be visibly more creative and more useful than a template storefront. The brand has a point of view:

1. **It fits, or it is on us.** Every product gives an honest fit verdict for the shopper's own car.
2. **The straight label.** Every product states the uncomfortable facts: road legality, warranty impact, how hard it is to fit, what fitting should cost, and when to skip it.
3. **You add on.** The name is the interaction: Build Bay lets you dress a car part by part.

### Honesty rules (non-negotiable, they are the brand)

- No fake urgency: no countdowns except a real drop end time, no invented "X people viewing", stock warnings only from real stock.
- No invented social proof. Seeded fitted reports, questions and builds have `is_demo = 1` and the UI labels them **Sample**.
- MRP is real and labelled "inclusive of all taxes". A reduced price shows the lowest price of the previous 30 days when history exists.
- Any COD fee is shown before checkout, in rupees.
- Photos are placeholders from open-licence sources; the `/credits` page lists every one.
- Number plates: we sell decorative **show plates** only. Never imply road use.

### Voice

Plain, direct, a little dry, like a good mechanic who will not sell you something you do not need.
Short sentences. Indian English, rupees as `₹1,19,999` (lakh grouping). No hype words, no exclamation marks,
no emoji in UI copy. Labels say what the control does.

## 2. Stack (verified, see stack.md)

- **Server**: Node 24, plain ESM JavaScript, Express 5.3, `node:sqlite` (built in), Zod 4, bcryptjs, jsonwebtoken (httpOnly cookie), helmet, express-rate-limit, multer 2 + sharp (image processing), nodemailer, razorpay. Tests: `node:test` + global `fetch`.
- **Client**: React 19.3, Vite 8, TypeScript 7, Tailwind CSS 4 (CSS-first), React Router 8 (import from `react-router`), TanStack Query 5, Zustand 5 (persist), `motion` (import from `motion/react`), lucide-react 1.x (no brand icons), react-hook-form + Zod 4, recharts (admin only), qrcode-generator.
- Dev: API on **:4000**, Vite on **:5173** with `/api`, `/uploads` proxied to the API.
- Not an npm workspace: `/`, `/server`, `/client` each have their own `package.json` and `node_modules`.

Things most often written wrong from memory (details in stack.md section 0):
`react-router-dom` does not exist in v8; Tailwind 4 has no config file; `framer-motion` import path is wrong; lucide has no Instagram/Facebook icons;
Zod 4 uses `.issues` and `z.record(key, value)`; Express 5 needs named wildcards and forwards async errors itself;
`node:sqlite` cannot bind booleans, `undefined` or Dates; TypeScript 7 has no `baseUrl`.

## 3. Design direction: "Pit Board"

Race-weekend information design: black on white with one pit-board yellow, heavy italic headlines, and motifs that carry real shopping data.
Full detail in `design.md` (Direction A and section 8.3 tokens). After the foundation is built, the working reference is
`client/DESIGN.md` plus the `/styleguide` page.

- **Colour**: white and near-black, Pit Yellow `#FFD500` as a *fill* with black text (never yellow text on white), orange for warnings, green for "fits", red only for errors and "does not fit". Light theme first, dark theme supported through tokens.
- **Type**: Archivo Variable (heavy italic for display, regular for body, tabular figures for prices). Martian Mono for SKUs, order numbers and codes only (it has no ₹ glyph: never set a price in it).
- **Motifs with a job**: the pit board (the make / model / year selector), tyre-compound rings for install difficulty (S, M, H), timing-tower rows for real ranked lists, scrutineering-sticker chips for verified facts, tread-pattern dividers, the rolling tyre from the logo as the loader and scroll mark.
- **Motion**: transform, opacity and clip-path only, 120 to 420 ms, all removed under `prefers-reduced-motion`. No smooth-scroll hijacking.
- **Mobile first**: most visitors are on a mid-range Android phone. Two-column product grid at 360px, 44px touch targets, a fixed five-slot bottom bar (Shop, Search, My car, Saved, Cart) that becomes a sticky buy bar on product pages.
- **Photos**: every product has photographs (see section 8). Product frames are 1:1 with `object-cover`. Products with no photo show a neat placeholder frame with the category icon and "Photo coming soon".
- **Banned** (they read as machine-made): Inter, purple or blue-purple gradients, red-and-black carbon-fibre textures, glassmorphism cards, pill labels floating above headings, decorative 01/02/03 numbering, auto-rotating hero carousels, generic stock "hero with centred headline and two buttons", emoji as icons.

Use only the semantic tokens and components from the foundation. Never hard-code a hex colour, a font family or an arbitrary Tailwind palette class (`bg-zinc-900`) in a page.

## 4. Repository layout and who owns what

```
/package.json  .env.example  .gitignore  README.md        foundation-server
/docs/                                                    contract (do not edit unless told)
/scripts/optimize-photos.mjs                              done
/server
  package.json
  src/index.js  app.js  context.js  config.js             foundation-server
  src/db/schema.sql                                       contract
  src/db/index.js                                         foundation-server
  src/lib/                                                foundation-server (shared helpers), plus named files owned by builders
  src/routes/*.js  src/routes/admin/*.js                  one owner each (stubs from foundation-server)
  src/seed/                                               seed agents
  test/helpers.js                                         foundation-server
  test/*.test.js                                          each builder writes tests for their own routes
  uploads/                                                runtime
/client
  package.json  vite.config.ts  tsconfig*.json  index.html   foundation-client
  public/catalog  public/editorial                        photos (do not edit)
  src/main.tsx  App.tsx  routes.tsx                       foundation-client
  src/styles/                                             foundation-client
  src/types/api.ts                                        contract
  src/lib/  src/stores/  src/hooks/                       foundation-client
  src/components/ui/  components/brand/                   foundation-client
  src/components/commerce/                                foundation-commerce
  src/components/layout/                                  builder: layout
  src/components/cart/  components/payment/               builders: cart, checkout
  src/features/buildbay/                                  builders: build bay
  src/pages/<area>/                                       one builder per area (stubs from foundation-client)
```

### Rules for working in parallel (many agents edit this repo at once)

1. **Only create or edit files inside the paths you were given.** If you need a change elsewhere (a shared component, a type, an endpoint), do not make it: work around it inside your area and describe the change you want in your final report. A later pass applies those.
2. **Never run `npm install`, `npm update` or add a dependency.** Everything you may use is already installed. If something is truly missing, say so in your report.
3. **Never run `vite build`, `npm run dev`, or start a long-running server.** Other agents share this folder and these ports.
   - Client check: `npx tsc --noEmit -p tsconfig.json` from `client/` (safe to run concurrently). Other agents' unfinished files may show errors: fix only errors in your own files.
   - Server check: `node --disable-warning=ExperimentalWarning --test test/<your-file>.test.js` from `server/`. Tests use an in-memory database and a random port, so they never collide.
4. **The contract files are read-only.** If a shape is wrong or missing, report it; do not invent a parallel shape.
5. Stub files exist for every route and page. Replace the stub you own; keep its path and its default export.
6. Do not reformat or "tidy" files you do not own. Do not create README or notes files.
7. Windows machine, project path contains a space: quote paths in shell commands.

## 5. Server architecture

Every route module default-exports a factory that receives the shared context and returns an Express `Router`:

```js
// server/src/routes/catalog.js
import { Router } from 'express';
export default function catalogRoutes(ctx) {
  const router = Router();
  router.get('/categories', (req, res) => { ... });
  return router;
}
```

`ctx` (built by `createContext()` in `server/src/context.js`):

| Member | What it is |
|---|---|
| `ctx.db` | SQLite wrapper: `get(sql, params)`, `all(sql, params)`, `run(sql, params)` → `{ changes, lastInsertRowid }`, `exec(sql)`, `tx(fn)` (transaction, rolls back on throw). Params may be an array or a named object; booleans, `undefined` and Dates are converted for you. |
| `ctx.config` | Parsed environment: `port`, `isProd`, `jwtSecret`, `dbPath`, `uploadsDir`, `clientDist`, `publicUrl`, `razorpay { keyId, keySecret, webhookSecret }`, `smtp {...}`, `admin { email, password }`. |
| `ctx.settings` | `get()` full settings object (cached), `public()` → `PublicSettings`, `admin()` → `AdminSettings`, `update(partial)`. |
| `ctx.mailer` | `send({ to, subject, text, html })`. Logs to the console when SMTP is not configured; never throws. |
| `ctx.now()` | Current time as an ISO string (tests can override it). |

Shared helpers written by the foundation in `server/src/lib/` (use them, do not duplicate them):

- `errors.js`: `HttpError`, `badRequest(message, fields)`, `unauthorized()`, `forbidden()`, `notFound(what)`, `conflict(message, code)`.
- `validate.js`: `parse(schema, data)` → throws a 400 `validation_error` with `fields` from Zod issues. Common schemas: `phoneSchema`, `pincodeSchema`, `emailSchema`, `idParam`, `pagination`.
- `auth.js`: `optionalAuth`, `requireAuth`, `requireAdmin` middlewares (set `req.user`), `setSessionCookie(res, user)`, `clearSessionCookie(res)`, `hashPassword`, `verifyPassword`.
- `mappers.js`: row → API shape for every type in api.ts (`toProductSummary`, `toProductDetail`, `toVariant`, `toCategory`, `toVehicle`, `toOrder`, `toUser`, `toAddress`, `toCoupon`, `toReport`, `toQuestion`, `toBuild`, ...). JSON columns are parsed here. **All routes return shapes through these.**
- `catalog.js`: read helpers on `v_products`: `findProducts(ctx, { where, params, orderBy, limit, offset, vehicleId })`, `getProductsByIds(ctx, ids, { vehicleId })`, `getProductRow(ctx, idOrSlug)`, `getProductDetail(ctx, slug, { vehicleId })`, `getVehicle(ctx, id)`, `fitVerdict(productRow, vehicle, fitmentRow)` (the rule in API.md), `categoryTree(ctx, { includeInactive })`.
- `india.js`: `STATES` (name, GST state code), `stateFromPincode(pincode)`, `normalizePhone(input)` → 10 digits or null, `isValidGstin`.
- `ids.js`: `slugify`, `uniqueSlug(ctx, table, base)`, `randomToken(bytes)`, `orderNumber()`, `ticketNumber(ctx)`.
- `money.js`: `taxBreakdown(lines, { storeState, shipState })`, `percentOff(price, mrp)`, `applyDrop(price, percent)`, `formatINR(n)`.
- `uploads.js`: `imageUpload({ maxFiles, maxSizeMb })` multer middleware and `saveImages(ctx, files)` → URLs (sharp: WebP 1200px + `-480` thumbnail).
- `rateLimit.js`: `limiters.auth`, `limiters.forms`, `limiters.lookup` ready-made.

Modules owned by builders that others call (signatures are fixed):

- `lib/pricing.js` (cart builder): `priceCart(ctx, request, { user })` → `PricedCart`, and `priceCartDetailed(...)` → `{ cart, rows }` where `rows` carries the product and variant rows for each line (the order builder needs them).
- `lib/shipping.js` (cart builder): `estimateShipping(ctx, pincode)` → `ShippingEstimate`.
- `lib/orders.js` (orders builder): `createOrder(ctx, request, { user })`, `loadOrder(ctx, orderNumber)`, `markPaid(ctx, orderNumber, { amount, method, reference })`, `changeStatus(ctx, orderNumber, update, { actor })`, `cancelOrder(...)`. Admin order routes call these.
- `lib/notify.js` (orders builder): `orderPlaced(ctx, order)`, `orderStatusChanged(ctx, order)`, `enquiryReceived(ctx, enquiry)`.
- `lib/search.js` (catalog builder): `expandQuery(ctx, q)` → `{ terms, understoodAs }`.

Tests: `test/helpers.js` gives `startTestApp()` → `{ ctx, url, api(path, { method, body, cookie }), asAdmin(), asCustomer(), fixtures, close() }` with a small fixture catalogue
(two categories, three vehicles, six products including one with variants, one out of stock and one show plate, one coupon, an admin and a customer).

## 6. Client architecture

- `src/lib/api.ts`: one typed function per endpoint (`api.products.list(query)`, `api.cart.price(body)`, `api.admin.orders.update(...)`). It throws `ApiError` (`status`, `code`, `message`, `fields`). **Pages never call `fetch` directly.**
- `src/lib/queryKeys.ts` and hooks in `src/hooks/` (`useSettings`, `useMe`, `useCategories`, `useVehicles`, `usePricedCart`, `useActiveVehicle`): use these for shared data so caches are shared.
- Stores (Zustand, persisted to localStorage): `useCart` (lines as `CartLineInput[]`, coupon, pincode), `useWishlist`, `useGarage` (vehicles + active one), `useCompare`, `useRecentlyViewed`, `useUi` (cart drawer, search overlay, vehicle picker, mobile menu), `useTheme`.
- `src/lib/format.ts` (`formatINR`, `formatDate`, `relativeDay`), `src/lib/images.ts` (`imageVariant(url, width)`), `src/lib/whatsapp.ts` (`waLink(phone, text)`, message builders), `src/lib/seo.ts` (`useDocumentMeta({ title, description, image })`), `src/lib/india.ts` (states, pincode and phone checks).
- UI kit in `src/components/ui/` and commerce components in `src/components/commerce/` (ProductCard, ProductGrid, ProductRail, ProductFrame, Price, FitBadge, StraightLabelChips, CompoundRing, VehiclePicker, AddToCartButton, WishlistButton, QtyStepper, Jargon, WhatsAppButton, CustomSummary, EmptyState, SectionHeading, PageHeader). Read `client/DESIGN.md` for their props.
- Data fetching with TanStack Query; forms with react-hook-form + Zod; every page sets its title with `useDocumentMeta`.
- Every page handles loading (skeletons, not spinners), empty and error states, and works at 360px wide.
- Accessibility: real buttons and links, labels on inputs, visible focus, `aria-live` for cart and toast changes, colour is never the only signal.

### Routes (file paths are fixed; each is a lazy route with a default export)

Storefront, inside the main layout:

| Path | File (under `client/src/pages/`) | Owner |
|---|---|---|
| `/` | `home/HomePage.tsx` | home |
| `/friday-five` | `home/FridayFivePage.tsx` | home |
| `/shop`, `/shop/:category`, `/shop/:category/:sub`, `/search` | `shop/ShopPage.tsx` | shop |
| `/compare` | `shop/ComparePage.tsx` | shop |
| `/p/:slug` | `product/ProductPage.tsx` | product |
| `/fitting/:slug` | `product/FittingCardPage.tsx` (no site chrome, printable) | reports |
| `/cars`, `/cars/:make`, `/cars/:make/:model` | `garage/CarsPage.tsx` | garage |
| `/garage` | `garage/GaragePage.tsx` | garage |
| `/wishlist` | `account/WishlistPage.tsx` | account |
| `/cart` | `cart/CartPage.tsx` | cart |
| `/checkout` | `checkout/CheckoutPage.tsx` | checkout |
| `/quote/:token` | `checkout/QuotePage.tsx` | checkout |
| `/order/:orderNumber` | `order/OrderPage.tsx` | order |
| `/order/:orderNumber/invoice` | `order/InvoicePage.tsx` (no site chrome, printable) | order |
| `/track` | `order/TrackPage.tsx` | order |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | `account/LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` | account |
| `/account` (layout `account/AccountLayout.tsx`): index, `orders`, `addresses`, `profile` | `account/OverviewPage.tsx`, `OrdersPage.tsx`, `AddressesPage.tsx`, `ProfilePage.tsx` | account |
| `/build-bay` | `buildbay/BuildBayPage.tsx` | build bay app |
| `/builds`, `/builds/:slug` | `buildbay/BuildsGalleryPage.tsx`, `buildbay/BuildViewPage.tsx` | build bay app |
| `/light-lab` | `lightlab/LightLabPage.tsx` | light lab |
| `/show-plate` | `plate/ShowPlatePage.tsx` | show plate |
| `/new-car` | `kits/NewCarPage.tsx` | kits |
| `/pocket-builds` | `kits/PocketBuildsPage.tsx` | kits |
| `/glossary`, `/straight-label`, `/about`, `/contact`, `/faq`, `/credits` | `content/GlossaryPage.tsx`, `StraightLabelPage.tsx`, `AboutPage.tsx`, `ContactPage.tsx`, `FaqPage.tsx`, `CreditsPage.tsx` | content |
| `/policies/:slug` (shipping, returns, warranty, privacy, terms) | `content/PolicyPage.tsx` | content |
| `/styleguide` | `dev/StyleguidePage.tsx` | foundation |
| `*` | `NotFoundPage.tsx` | layout |

Admin, inside `admin/AdminLayout.tsx` (redirects to `/login?next=...` unless the user is an admin):

| Path | File (under `client/src/pages/admin/`) | Owner |
|---|---|---|
| `/admin` | `DashboardPage.tsx` | admin shell |
| `/admin/followups` | `FollowUpsPage.tsx` | admin shell |
| `/admin/demand` | `DemandPage.tsx` | admin shell |
| `/admin/orders`, `/admin/orders/:orderNumber` | `OrdersPage.tsx`, `OrderDetailPage.tsx` | admin orders |
| `/admin/quotes`, `/admin/quotes/new`, `/admin/quotes/:id` | `QuotesPage.tsx`, `QuoteEditPage.tsx` | admin orders |
| `/admin/customers`, `/admin/coupons` | `CustomersPage.tsx`, `CouponsPage.tsx` | admin orders |
| `/admin/products`, `/admin/products/new`, `/admin/products/:id` | `ProductsPage.tsx`, `ProductEditPage.tsx` | admin catalogue |
| `/admin/categories`, `/admin/drops` | `CategoriesPage.tsx`, `DropsPage.tsx` | admin catalogue |
| `/admin/fitment-desk`, `/admin/reports`, `/admin/enquiries`, `/admin/leads`, `/admin/stock-alerts`, `/admin/builds` | `FitmentDeskPage.tsx`, `ReportsPage.tsx`, `EnquiriesPage.tsx`, `LeadsPage.tsx`, `StockAlertsPage.tsx`, `BuildsPage.tsx` | admin desk |
| `/admin/settings`, `/admin/post-maker` | `SettingsPage.tsx`, `PostMakerPage.tsx` | admin settings |

Shared components with a fixed path that one builder owns and others import (stubs exist from the foundation):

| File (under `client/src/`) | Props | Owner |
|---|---|---|
| `components/cart/CartDrawer.tsx` | none (reads `useUi`, `useCart`) | cart |
| `components/payment/PaymentPanel.tsx` | `{ order: Order; instruction: PaymentInstruction; onPaid(order: Order): void }` | checkout |
| `pages/product/sections/FittedReports.tsx` | `{ product: ProductDetail }` | reports |
| `pages/product/sections/ProductQuestions.tsx` | `{ product: ProductDetail }` | reports |
| `features/buildbay/stage/CarStage.tsx` | `CarStageProps` from `features/buildbay/contract.ts` | build bay art |

## 7. Features

Core commerce (all expected to work end to end): category browsing, search, product pages with variants, cart, coupons,
pincode delivery estimate, guest and account checkout, COD / Razorpay / direct UPI, order confirmation and tracking, order history,
addresses, wishlist, compare, recently viewed, GST invoice, and a full admin panel.

The features that make this store different. Each line names the owner area.

1. **Garage and Fit Verdict** (foundation-commerce, garage, product, shop). A make / model / year selector styled as a pit board, in the home hero and behind a "My car" control on every page. The chosen car is saved (localStorage; synced to the account when signed in). Every product card and page shows one of: *Fits your Swift*, *Fits with work* (and what work), *Universal fit*, *Does not fit your Swift* (with a link to parts that do), *Not checked on your car yet: ask us*, or *Select your car to check fit*. Listings have a one-tap "Only parts for my car" toggle.
2. **Fit Promise** (product, settings). When `settings.fitPromise.enabled` and the verdict is a shop-verified `direct`, the product page shows "It fits, or it is on us" with the summary text.
3. **Answer-Once Fitment Desk** (reports, admin desk). "Ask if this fits my car" on a product posts a fitment question. In admin the owner taps Fits / Fits with work / Does not fit and adds a note; that answer is written to the fitment table, so the store answers that car from then on, and every shopper who asked gets a ready WhatsApp reply in Follow-ups.
4. **The Straight Label** (foundation-commerce, product, content). A nutrition-label-style panel on every product page: road legality, warranty impact, wiring, reversible or not, fitting difficulty as a tyre-compound ring, real fitting time, fair labour cost, and a "Skip this if" line. Compact chips on product cards. `/straight-label` explains it.
5. **The Fitting Card** (reports). `/fitting/:slug`: a big-type, printable, shareable page in English and Hindi for the customer's local mechanic: tools, steps, time, fair labour charge. Share to WhatsApp.
6. **Plain Talk** (foundation-commerce, content). Technical words (PCD, offset, CANbus, lumens, IP67) are tappable for a two-line explanation; `/glossary` lists them all.
7. **Pick of Three** (shop, admin catalogue). Subcategory pages open with three hand-picked answers: Sensible, Sweet Spot, All-Out, each with the shop's one-line reason, above the full grid.
8. **The Friday Five** (home, admin catalogue). Instead of permanent sale banners: a short dated drop on up to five parts, each with the owner's reason and a visible price history. `/friday-five` and a home section. The only countdown on the site, and it is real.
9. **Honest prices** (product). Lowest price in 30 days beside a reduction, and a small price-history chart.
10. **Fitted Reports** (reports, admin desk). Instead of star reviews: only buyers who received the part file a 60-second structured report (car, who fitted it, how long, how hard, what went wrong, photos). Cards show "92% fitted first time".
11. **The Sanity Check** (cart). The cart looks at itself like a mechanic: this part does not fit your car, you will also need X, these two do the same job, this one is off-road only. With one-tap fixes, including "remove".
12. **Redline Cart** (cart). The free-shipping progress is a tachometer: the needle climbs as the basket fills and the shift light comes on when shipping becomes free. Only real thresholds.
13. **Smart payment options** (cart, checkout). Every payment method priced in rupees side by side: UPI (with any prepaid discount), cards via Razorpay, COD with its fee, or COD with a small advance. No surprises at the last step.
14. **WhatsApp everywhere** (layout, product, cart, admin). Floating WhatsApp button; "Ask about this part" pre-filled with product, SKU, car and link; "Ask the gang" share of a product or comparison; "Send cart to payer" link that opens the same cart on another phone. All hidden when no WhatsApp number is set.
15. **Quote links with margin guard** (admin orders, checkout). While on a call the owner builds a priced quote and sends a link; the customer opens `/quote/:token` and pays that exact price. The quote builder shows live margin and refuses prices below cost.
16. **Today's Follow-ups** (admin shell). One phone screen listing everyone worth a WhatsApp message today, with the message already written: abandoned checkouts, COD orders to confirm, UPI payments to verify, answered fitment questions, back-in-stock requests, delivered orders to ask for a fitted report, saved kits, expiring quotes.
17. **Demand radar and reorder list** (admin shell). What shoppers searched for and did not find, what they are waiting for, which cars they asked about, and a ready WhatsApp purchase order per supplier.
18. **Pack bench with photo proof** (admin orders, order). A packing checklist per order; staff photograph the items before sealing; the photo appears on the customer's order page.
19. **Build Bay** (build bay art, build bay app). `/build-bay`: a side-profile car (hatchback, sedan or SUV) in a night garage that you dress part by part: wheels, ride height, spoiler, splitter, skirts, diffuser, exhaust, roof rack, light bar, underglow, decals, tint, paint. A live build sheet maps each part to real catalogue products with a running total, "add the whole build to cart", a shareable link and a downloadable poster. Labelled a style preview: fitment is still confirmed per product. `/builds` is the gallery of approved builds, each shoppable.
20. **Light Lab** (light lab). `/light-lab`: a night road where you switch halogen, LED and projector beams, slide colour temperature, add fog lamps and a light bar, and turn on rain and fog. It shows why whiter is not always better, then links to the lights.
21. **Show Plate Designer** (show plate). `/show-plate`: live preview, text, size, style, font, frame, live price; the design is saved on the cart line and the order. Decorative show plates only, with a required acknowledgement, prepaid only.
22. **New Car planner and Pocket Builds** (kits). `/new-car`: pick the car, delivery date and budget, get three kits (Essential, Smart, Full) of parts that fit, compare against the dealer's accessory quote, see the order-by date, save the kit. `/pocket-builds`: type a budget and pick a vibe, get a complete kit under that number.
23. **Desi search** (catalog, layout). Search understands trade words and Hinglish ("dikki light", "stepney cover", "silencer tip") through a synonym list the owner can extend, shows "showing results for ...", and offers voice input where the browser supports it.
24. **Post Maker** (admin settings). Pick a product, get a ready-to-post story or square image (photo, name, price, struck MRP, store name) drawn on a canvas, downloadable as PNG.
25. **Living O** (layout). The tyre from the logo rolls with scroll in the header and is the loading indicator.
26. **Link previews** (seo). Product, category and build links shared on WhatsApp or Instagram show the right photo, title and price.

Build Bay style keys (the seed, the art and the page all use exactly these):

| Slot | Styles | Notes |
|---|---|---|
| `wheels` | `five-spoke`, `multi-spoke`, `mesh`, `split-spoke`, `turbine`, `steelie` | colour = finish |
| `spoiler` | `lip`, `ducktail`, `roof`, `gt-wing` | `roof` suits hatchback and SUV |
| `splitter` | `lip`, `race` | |
| `skirts` | `blade` | |
| `diffuser` | `fins` | |
| `exhaust` | `single`, `twin`, `quad` | |
| `roofRack` | `crossbars`, `basket`, `box` | |
| `lightBar` | `roof-bar`, `bumper-pods` | glows at night |
| `underglow` | `glow` | takes a colour, glows at night |
| `decal` | `stripe`, `side-graphic` | takes a colour |
| `bullBar` | `bar` | SUV only |
| `sideStep` | `board` | SUV only |
| `snorkel` | `snorkel` | SUV only |
| `lowering` | `springs`, `coilover` | sets ride height to -1 or -2 |

Kit goals: `new_car`, `sporty`, `comfort`, `sound`, `night`, `offroad`, `protection`.

## 8. Photos

Open-licence photographs live in `client/public/catalog/<artKind>/` and `client/public/editorial/`, already converted to WebP:
`NAME.webp` (large) and `NAME-480.webp` (thumbnail; editorial uses `-960`). `imageVariant(url, 480)` returns the thumbnail URL for
any `/catalog/`, `/editorial/` or `/uploads/` image. Always set `width`, `height` (or an aspect-ratio box), `loading="lazy"` and `decoding="async"`
on images below the fold; the first product image and hero image load eagerly.

`server/src/seed/photos.json` lists them: `{ catalog: { [artKind]: Photo[] }, editorial: Photo[] }` where a Photo has
`url, thumb, width, height, shows, tone` and `orientation` (catalog) or `focalPoint, calmArea` (editorial).
`client/src/data/photoCredits.json` holds the author and licence of each for the `/credits` page.
Both files may be missing or thin while photos are still being sourced: code must cope with that.

## 9. Configuration

`.env` (see `.env.example`): `PORT`, `JWT_SECRET`, `DB_PATH`, `PUBLIC_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
Everything works with none of them set: Razorpay is simply not offered, emails are logged, and a development secret is used.

Store details (name, phone, WhatsApp, address, GSTIN, grievance officer, shipping fees, COD rules, UPI id, return window, promos) are
**settings in the database**, edited in Admin → Settings. They start blank or with safe defaults; the storefront hides anything blank.
Never invent a phone number, address or GSTIN.
