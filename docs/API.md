# Addon Automotive API

Base path: `/api`. JSON in, JSON out. Every shape named below is defined in
[client/src/types/api.ts](../client/src/types/api.ts), which is the source of truth.
The database is described in [server/src/db/schema.sql](../server/src/db/schema.sql).

## Rules

- **Money** is integer rupees everywhere. Paise only inside the Razorpay module.
- **Success** returns the bare resource. **Errors** return a non-2xx status with
  `ApiErrorBody`: `{ "error": { "code", "message", "fields?" } }`.
- **Auth** is a JWT in an httpOnly cookie named `addon_session` (SameSite=Lax), set by
  login/register and cleared by logout. `(auth)` = any signed-in user, `(admin)` = role admin.
  Endpoints with no marker are public; they still read the cookie when present.
- **The server never trusts client prices or totals.** The cart is sent as
  `CartLineInput[]` and priced on the server every time.
- **Prices** shown to shoppers come from the `v_products` view: `sale_price` is the price after
  any live drop. Variant prices get the same percentage.
- Status codes: 200 OK, 201 created, 400 `validation_error`, 401 `unauthorized`,
  403 `forbidden`, 404 `not_found`, 409 `conflict` / `out_of_stock` / `slot_unavailable` / `duplicate_booking`, 429 `rate_limited`, 500 `server_error`.
- `vehicleId` on catalogue endpoints sets `fit`, `fitNote`, `fitVerified` on every product returned.

## Fit verdict (one rule, used everywhere)

Given a product and a vehicle:

1. A `product_fitments` row for that pair wins: `direct`, `with_work` or `no` (with its note; `fitVerified` = `is_verified`).
2. Else by `fitment_type`:
   - `universal` → `universal`. `none` (merchandise) → `universal`.
   - `body_type` → `universal` if the vehicle's body type is in `body_types`, else `no`.
   - `pcd` → `universal` if the vehicle's `pcd` equals the product's, `no` if the vehicle's pcd is known and different, `unknown` if the vehicle's pcd is blank.
   - `vehicle` → `no` if the product lists other generations of the *same model* only, otherwise `unknown` ("not checked on your car yet: ask us").
3. No vehicle → `null`.

## Store

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/settings` | | `PublicSettings` | Promos filtered to those live now. Carries the store's phones, the studio rules (`studio`), fitting services (`services`), EMI (`emi`), recent studio work (`studioWork`) and the invoice prefix and footer note. Never hard-code a phone number in the client: read it from here. |
| GET | `/health` | | `{ ok: true, time }` | |

## Auth

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | `RegisterRequest` | `AuthResponse` 201 | Sets cookie. 409 if the email is taken. |
| POST | `/auth/login` | `LoginRequest` | `AuthResponse` | Sets cookie. 401 on bad credentials (same message for an unknown email). Rate limited. |
| POST | `/auth/logout` | | `OkResponse` | Clears cookie. |
| GET | `/auth/me` | | `MeResponse` | `{ user: null }` when signed out (never 401). |
| POST | `/auth/forgot-password` | `{ email }` | `OkResponse` | Always ok. Emails a reset link (or logs it to the server console when SMTP is not configured). |
| POST | `/auth/reset-password` | `{ token, password }` | `OkResponse` | 400 when the token is invalid or expired. |

## Catalogue

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/categories` | | `Category[]` | Top-level categories with `children`. Active only. |
| GET | `/vehicles` | | `VehicleMake[]` | Popular makes and models first. |
| GET | `/vehicles/:id` | | `Vehicle` | |
| GET | `/products` | query `ProductQuery` | `ProductListResponse` | With `q`: expands trade words and Hinglish through the synonym list, sets `understoodAs`, and logs to `search_log` (page 1 only). Out-of-stock items sort last. |
| GET | `/products/:slug` | query `vehicleId?` | `ProductDetail` | 404 for inactive products. |
| GET | `/products/:slug/reports` | query `page?`, `limit?` | `FittedReportsResponse` | Approved only. |
| POST | `/products/:slug/reports` | `FittedReportInput` | `{ ok: true, status: 'pending' }` 201 | Only buyers who received the part: a signed-in user with a delivered order containing it, or `orderNumber` + `phone` matching one. 403 otherwise. One report per order per product. Goes to moderation. |
| POST | `/reports/photos` | multipart field `photos` (up to 3, jpg/png/webp, 5 MB each) | `{ urls: string[] }` | Rate limited. For attaching to a fitted report. |
| GET | `/products/:slug/questions` | | `Question[]` | Published only. |
| POST | `/products/:slug/questions` | `QuestionInput` | `OkResponse` 201 | Rate limited. Goes to the admin Fitment Desk / moderation. |
| GET | `/search/suggest` | query `q`, `vehicleId?` | `SearchSuggestResponse` | Up to 6 products, 4 categories, 4 vehicles. Not logged. |
| GET | `/home` | query `vehicleId?` | `HomeResponse` | One round trip for the home page. |
| GET | `/drops/current` | query `vehicleId?` | `Drop \| null` | The live Friday Five. |

## Cart, shipping, checkout

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/cart/price` | `PriceCartRequest` | `PricedCart` | Pure function of the request plus current catalogue, settings and quote. Never errors for stock problems: reports them per line in `issue`. Fills `paymentOptions` and `advice`. Applies the fulfilment and fitting rules below. |
| GET | `/shipping/estimate` | query `pincode` | `ShippingEstimate` | 400 if not 6 digits. |
| POST | `/checkout/lead` | `CheckoutLeadRequest` | `CheckoutLeadResponse` | Upserts by `token`. |
| GET | `/quotes/:token` | | `QuoteView` | 404 for an unknown token. An expired quote returns `status: 'expired'`. |
| POST | `/orders` | `CreateOrderRequest` | `CreateOrderResponse` 201 | Re-prices on the server, checks stock, decrements stock, assigns the invoice number and writes the first `order_events` row, all in one transaction. Same `idempotencyKey` returns the same order. Plain COD (and pay at the studio) starts `placed`; anything needing online payment starts `pending_payment`. 409 `out_of_stock` names the item. Delivery needs `shippingAddress` (400 on `shippingAddress` otherwise). A studio order needs `studioSlot` and a car (`vehicleId` or `vehicleLabel`), 400 on those fields otherwise; the slot is re-checked inside the same transaction (409 `slot_unavailable`), and a linked booking is written to the studio diary (`Order.bookingNumber`). |
| GET | `/orders/track` | query `orderNumber`, `phone` | `Order` | Public lookup; phone must match (last 10 digits). 404 otherwise. Rate limited. |
| GET | `/orders/:orderNumber` | query `token?` | `Order` | Allowed for the owning user, an admin, or anyone holding the order's access token. |
| POST | `/orders/:orderNumber/cancel` | `{ token?, reason? }` | `Order` | Only while `canCancel`. Restores stock. |
| POST | `/payments/razorpay/verify` | `RazorpayVerifyRequest` | `Order` | Verifies the HMAC signature against the stored Razorpay order id, then marks paid (or advance paid) and moves the order to `placed`. |
| POST | `/payments/razorpay/webhook` | Razorpay event (raw body) | `OkResponse` | Verifies `X-Razorpay-Signature`, dedupes on the event id. Same `markPaid` path as verify. |
| POST | `/payments/razorpay/retry` | `{ orderNumber, token? }` | `PaymentInstruction` | For a `pending_payment` order whose checkout was dismissed. Reuses the Razorpay order. |
| POST | `/payments/upi/confirm` | `UpiConfirmRequest` | `Order` | Stores the UTR and moves the order to `placed`; payment stays `pending` until an admin verifies it. |

### Fulfilment and studio fitting (one rule, used by `/cart/price` and `/orders`)

- **Fulfilment** is `delivery` (default), `pickup` (collect at the studio) or `studio` (fitted at the studio in a booked slot).
- A line can be fitted at the studio when its part's subcategory is listed in a service's `subcategorySlugs`
  (`PricedLine.fittingService`; the free consultation `consult` never applies to a part). `CartLineInput.fitAtStudio: true`
  on such a line adds `fittingCharge` = service charge × qty (0 for a service with no charge, such as film application).
  Asking for it on a part no service fits prices the line without fitting and adds a message.
- **Any fitted line makes the order `studio`.** `studio` requested with nothing fitted is priced as `pickup`.
  While `settings.studio.enabled` is false, fitting and pickup fall back to `delivery` with a message.
- Pickup and studio: no shipping fee, no surcharges, `amountToFreeShipping` 0, the PIN code is ignored, tax is intra-State.
  The `cod` option becomes **Pay at the studio**: no COD fee, no advance, no courier limits (made-to-order parts still need online payment).
- `fittingTotal` (sum of the fitting charges) is in `total`, is never discounted (coupon and prepaid discount apply to parts only)
  and is a GST line of its own at 18% in `tax`. `needsSlot` is true for studio orders.
- A studio order's linked booking follows the order: `placed` confirms it, `cancelled` / `returned` (and an unpaid order expiring) cancel it, `delivered` completes it.

## Fitting studio

Times are India time: `date` is 'YYYY-MM-DD', `slot` is 'HH:MM' from `settings.studio.slots`. A slot holds `carsPerSlot` cars;
active bookings (`requested`, `confirmed`, `in_progress`, `completed`) and studio orders take a place. Sunday runs only up to
`sundayLastSlot`; `closedWeekdays` are closed; same-day slots need `minNoticeMinutes`; bookings open `maxDaysAhead` days ahead.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/studio/slots` | query `date` | `StudioDay` | Every slot with `available`, `reason` (`past`, `closed`, `notice`, `full` or null) and `left`, plus a plain `message` for the day. 400 if `date` is not a real 'YYYY-MM-DD'. |
| GET | `/studio/calendar` | query `from?` (default today in India), `days?` (default 14, at most 62) | `StudioDay[]` | For a date picker. |
| GET | `/studio/services` | | `StudioService[]` | Same list as `settings.services`. |
| POST | `/studio/bookings` | `BookingRequest` | `Booking` 201 | A fitting service booked on its own. Validated (400 with fields; a car is required: `vehicleId` or `vehicleLabel`), then the slot is re-checked inside the transaction that writes it: 409 `slot_unavailable`. The same phone booking the same slot again is 409 `duplicate_booking`. Starts `requested`. Numbered in sequence (`ADN-B-000123`). Emails the customer when an email is given and notifies the store (`notifications.orderEmail`, else `email`). Rate limited. |
| GET | `/studio/bookings/:bookingNumber` | query `phone` | `Booking` | Public lookup; the phone must match (last 10 digits). 404 otherwise. Rate limited. |

## Account (auth)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| PUT | `/account/profile` | `{ name, phone }` | `AuthResponse` | |
| PUT | `/account/password` | `{ currentPassword, newPassword }` | `OkResponse` | |
| GET | `/account/orders` | | `Order[]` | Newest first. |
| GET | `/account/addresses` | | `Address[]` | |
| POST | `/account/addresses` | `AddressInput` | `Address` 201 | |
| PUT | `/account/addresses/:id` | `AddressInput` | `Address` | |
| DELETE | `/account/addresses/:id` | | `OkResponse` | |
| GET | `/account/wishlist` | | `{ productIds: number[] }` | |
| PUT | `/account/wishlist` | `{ productIds: number[] }` | `{ productIds: number[] }` | Replaces the list (the client merges local and server on login). |
| GET | `/account/garage` | | `GarageEntry[]` | |
| PUT | `/account/garage` | `{ vehicles: GarageVehicle[] }` | `GarageEntry[]` | Replaces the list. |

## Kits and builds

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/kits/build` | `KitRequest` | `KitResponse` | Rule based: picks in-stock parts that fit, by `goals` and `essential_rank`, each tier within the budget. |
| POST | `/kits/save` | `SaveKitRequest` | `{ token }` 201 | Saves the kit as a lead. Rate limited. |
| GET | `/builds` | query `page?`, `limit?` | `Paginated<Build>` | Approved builds, house builds first. |
| GET | `/builds/:slug` | | `Build` | Any status (the slug is the secret for private ones). |
| POST | `/builds` | `SaveBuildRequest` | `Build` 201 | `status` is `pending` when `submitToGallery`, else `private`. Rate limited. |

## Inbound messages

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/enquiries` | `EnquiryInput` | `EnquiryReceipt` 201 | Needs a phone or an email. Issues a ticket number and emails the customer a copy. Rate limited. |
| POST | `/stock-alerts` | `StockAlertInput` | `OkResponse` 201 | Needs a phone or an email. |

## Pages served by Express (not under /api)

| Method | Path | Notes |
|---|---|---|
| GET | `/sitemap.xml`, `/robots.txt` | Generated from the catalogue. |
| GET | `/uploads/*` | Uploaded images. |
| GET | any other path | In production: `client/dist/index.html` with the page's title, description, Open Graph tags and JSON-LD injected for product, category, build and content routes, so WhatsApp and Instagram link previews show the right photo and price. |

## Admin (admin)

All under `/admin`. List endpoints accept `page`, `limit`, `q` and return `Paginated<T>` unless noted.

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/admin/stats` | query `days` (7, 30, 90, 365) | `AdminStats` | |
| GET | `/admin/demand` | query `days` | `DemandReport` | |
| GET | `/admin/followups` | | `FollowUp[]` | Computed live, most urgent first. |
| GET | `/admin/products` | query `q`, `category`, `status` (`active`, `inactive`, `low_stock`, `out_of_stock`), `page`, `limit` | `Paginated<AdminProduct>` | |
| GET | `/admin/products/:id` | | `AdminProduct` | |
| POST | `/admin/products` | `AdminProductInput` | `AdminProduct` 201 | 409 on duplicate slug or SKU. Writes the first `price_history` row. |
| PUT | `/admin/products/:id` | `AdminProductInput` | `AdminProduct` | Replaces variants, fitments and relations. Keeps `price`/`stock` in sync with variants. Writes `price_history` when the price changes. |
| PATCH | `/admin/products/:id` | `{ stock?, price?, mrp?, isActive?, isFeatured? }` | `AdminProduct` | Quick edits from the list. |
| DELETE | `/admin/products/:id` | | `AdminProductDeleteResponse` | Deletes if never ordered, otherwise deactivates; `message` says which. |
| POST | `/admin/uploads` | multipart field `images` (up to 8, jpg/png/webp, 8 MB each) | `{ urls: string[] }` | Each file is converted to WebP at 1200px plus a 480px thumbnail and served from `/uploads/`. |
| GET | `/admin/categories` | | `Category[]` | Includes inactive. |
| POST | `/admin/categories` | `{ name, slug?, parentId, blurb, artKind, image, sortOrder, isActive }` | `Category` 201 | |
| PUT | `/admin/categories/:id` | same | `Category` | |
| DELETE | `/admin/categories/:id` | | `OkResponse` | 409 if it still has products or children. |
| GET | `/admin/categories/:id/picks` | | `CategoryPick[]` | |
| PUT | `/admin/categories/:id/picks` | `CategoryPicksInput` | `CategoryPick[]` | Replaces the three picks. |
| GET | `/admin/drops` | | `AdminDrop[]` | Newest first. |
| POST | `/admin/drops` | `DropInput` | `AdminDrop` 201 | Activating a drop deactivates any other whose window overlaps; their ids come back in `deactivatedDropIds`. |
| PUT | `/admin/drops/:id` | `DropInput` | `AdminDrop` | Same `deactivatedDropIds`. |
| DELETE | `/admin/drops/:id` | | `OkResponse` | |
| GET | `/admin/orders` | query `q`, `status`, `paymentStatus`, `from`, `to`, `page`, `limit` | `Paginated<AdminOrderListItem>` | |
| GET | `/admin/orders/export` | query `from`, `to` | CSV download | One row per order line with the GST split, for the accountant. |
| GET | `/admin/orders/:orderNumber` | | `Order` | |
| PUT | `/admin/orders/:orderNumber` | `AdminOrderUpdate` | `Order` | Writes an `order_events` row, emails the customer on status change, restores stock on cancel/return, bumps `sold_count` on delivered. |
| GET | `/admin/bookings` | query `from`, `to` ('YYYY-MM-DD'), `status`, `q`, `page`, `limit` (default 50, at most 200) | `Paginated<AdminBooking>` | The studio diary, by date then slot. Without `from` and `to` it lists today (India) onwards. `q` matches number, order number, name, car, registration, service, and phone digits. |
| GET | `/admin/bookings/:bookingNumber` | | `AdminBooking` | |
| PUT | `/admin/bookings/:bookingNumber` | `AdminBookingUpdate` | `AdminBooking` | Status, a move to another `date` / `slot` (checked for a free place, 409 `slot_unavailable`; the booking does not count against itself), and `adminNote`. Reopening a cancelled booking checks its slot still has room. A booking from a studio order moves the order's slot with it and writes an order event. Emails the customer on confirm, move and cancel. |
| GET | `/admin/quotes` | query `status` | `Paginated<AdminQuote>` | |
| POST | `/admin/quotes` | `QuoteInput` | `AdminQuote` 201 | 400 if any unit price is below its cost price (the margin guard), unless `?allowBelowCost=1`. |
| PUT | `/admin/quotes/:id` | `QuoteInput` | `AdminQuote` | Only while `open`. |
| DELETE | `/admin/quotes/:id` | | `OkResponse` | Cancels. |
| GET | `/admin/coupons` | | `Coupon[]` | |
| POST | `/admin/coupons` | `CouponInput` | `Coupon` 201 | |
| PUT | `/admin/coupons/:id` | `CouponInput` | `Coupon` | |
| DELETE | `/admin/coupons/:id` | | `OkResponse` | |
| GET | `/admin/customers` | query `q`, `page`, `limit` | `Paginated<AdminCustomer>` | |
| GET | `/admin/reports` | query `status`, `page`, `limit` | `Paginated<AdminReport>` | Fitted reports awaiting moderation. |
| PUT | `/admin/reports/:id` | `{ status }` | `AdminReport` | Recomputes the product's `rating_avg` / `rating_count`. |
| DELETE | `/admin/reports/:id` | | `OkResponse` | Recomputes too. |
| GET | `/admin/questions` | query `status`, `kind`, `page`, `limit` | `Paginated<AdminQuestion>` | The Fitment Desk: fitment questions first, most-asked first. |
| PUT | `/admin/questions/:id` | `AdminQuestionAnswer` | `AdminQuestion` | Answering publishes. For fitment questions it upserts `product_fitments` and answers every other pending question for the same product and car. |
| DELETE | `/admin/questions/:id` | | `OkResponse` | |
| GET | `/admin/enquiries` | query `status`, `kind`, `page`, `limit` | `Paginated<Enquiry>` | |
| PUT | `/admin/enquiries/:id` | `{ status?, adminNote? }` | `Enquiry` | |
| GET | `/admin/leads` | query `status`, `page`, `limit` | `Paginated<CheckoutLead>` | Abandoned checkouts. |
| PUT | `/admin/leads/:id` | `{ status }` | `CheckoutLead` | |
| GET | `/admin/kits` | query `status`, `page`, `limit` | `Paginated<SavedKit>` | |
| PUT | `/admin/kits/:id` | `{ status }` | `SavedKit` | |
| GET | `/admin/stock-alerts` | query `status`, `page`, `limit` | `Paginated<StockAlert>` | |
| PUT | `/admin/stock-alerts/:id` | `{ status }` | `StockAlert` | |
| GET | `/admin/builds` | query `status`, `page`, `limit` | `Paginated<Build>` | |
| PUT | `/admin/builds/:slug` | `{ status?, isHouse?, title? }` | `Build` | |
| DELETE | `/admin/builds/:slug` | | `OkResponse` | |
| GET | `/admin/settings` | | `AdminSettings` | |
| PUT | `/admin/settings` | deep partial of `AdminSettings` | `AdminSettings` | Deep-merged, then validated. |
| POST | `/admin/demo/clear` | | `{ removed: Record<string, number> }` | Deletes every `is_demo` row (products, reports, questions, orders, drops, coupons, builds). |
