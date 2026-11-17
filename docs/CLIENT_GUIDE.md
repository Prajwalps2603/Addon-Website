# Client guide: data layer and app skeleton

What exists under `client/src` between the API and the pages. Import with the `@/` alias. Types come only from `@/types/api`
(`verbatimModuleSyntax`: write `import type { ... }`). Check your work with `npx tsc --noEmit -p tsconfig.json` from `client/`.

## App skeleton

- `main.tsx` → `App.tsx`: error boundary, `QueryClientProvider`, `MotionConfig reducedMotion="user"`, `BrowserRouter`, scroll-to-top on
  navigation (not on back/forward, not when only the query string changes; `#id` links scroll to the element), and `useAppSync()`.
  One marked line in `App.tsx` waits for the layout engineer's `<Toaster />`.
- `routes.tsx`: every route of BUILD_SPEC section 6, each page a lazy chunk wrapped in its own `Suspense` and an `ErrorBoundary` that clears
  when the path changes. **You never edit it**: replace the stub at your page's path and keep the default export.
- Storefront pages render inside `components/layout/Layout.tsx` (`<Outlet />` in `<main id="main">`, plus `<CartDrawer />`); account pages inside
  `pages/account/AccountLayout.tsx` (signed-out visitors go to `/login?next=...`); admin pages inside `pages/admin/AdminLayout.tsx` (non-admins go
  to `/login?next=...`), outside the storefront layout. `/fitting/:slug` and `/order/:orderNumber/invoice` have no chrome.
- URL conventions other files rely on: `/login?next=<path>` (read it with `safeNextPath`), `/cart?c=<cart>&coupon=<code>` (`useSharedCart`),
  `/compare?ids=1,2,3` (ComparePage loads them with `useCompare.getState().setAll(ids)`), `/track?orderNumber=<n>` (TrackPage pre-fills it).

## Building a page

```tsx
export default function OrdersPage() {
  useDocumentMeta({ title: 'My orders', noindex: true });
  const { data, isPending, error, refetch } = useQuery({
    queryKey: queryKeys.account.orders(),
    queryFn: ({ signal }) => api.account.orders({ signal }),
  });
  if (isPending) return <OrdersSkeleton />;              // skeletons, not spinners
  if (error) return <EmptyState title="Could not load your orders" description={error.message} actions={<Button onClick={() => refetch()}>Try again</Button>} />;
  if (data.length === 0) return <EmptyState title="No orders yet" />;
  return <OrderList orders={data} />;
}
```

- **Never call `fetch`.** Use `api.*` with a key from `queryKeys`; shared data has a hook (below) so caches are shared.
- **Errors are always `ApiError`** (`status`, `code`, `message`, `fields`; `status` 0 = offline). `error` in every `useQuery` / `useMutation` is typed
  as `ApiError`. `error.message` is safe to show. Getters: `isNetwork`, `isNotFound`, `isUnauthorized`, `hasFields`. Outside a query:
  `try { ... } catch (e) { toast.error(errorMessage(e)) }`. A 404 on a detail page (`error.isNotFound`) should show the not-found state, not a retry.
- Defaults: `staleTime` 30 s, no refetch on focus, 4xx never retried, network and 5xx retried twice, mutations not retried. Any 401 re-checks the session.
- **Mutations**: `useMutation({ mutationFn: api.account.addresses.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.account.addresses() }) })`.
  Keys nest: `queryKeys.products.all()` covers every product list and detail, `queryKeys.admin.orders.all()` every admin order query.
- **Lists with pages or filters**: add `placeholderData: keepPreviousData` and dim on `isPlaceholderData`. Keep filters in the URL (`useSearchParams`).
- **Forms**: react-hook-form + Zod 4 (`useForm<Input, unknown, Output>({ resolver: zodResolver(schema) })`). Validate phone, pincode, GSTIN with
  `lib/india.ts` inside `.refine`. On a failed submit: `setFormError(applyApiError(error, setError))` puts each server `fields` entry on its
  input (third argument renames `'shippingAddress.pincode'` → your field name) and returns the summary message.
- Money is integer rupees: always `formatINR(n)`. Never set a price in the mono font.

## lib/api.ts

`api.<group>.<fn>(...)`. Reads take an optional last argument `{ signal }`. `buildQuery` drops `undefined`, `null`, `''` and `false`.
Also exported: `ApiError`, `isApiError`, `errorMessage(e, fallback?)`, `saveFile(file)`, `DeepPartial`, and the admin query types (`AdminOrderQuery`, ...).

| Group | Functions |
|---|---|
| `settings` | `get()`, `health()` |
| `auth` | `register(body)`, `login(body)`, `logout()`, `me()`, `forgotPassword({ email })`, `resetPassword({ token, password })`. In components use `useLogin` / `useRegister` / `useLogout` |
| `catalog` | `categories()`, `vehicles()`, `vehicle(id)`, `suggest({ q, vehicleId? })`, `home({ vehicleId? })`, `currentDrop({ vehicleId? })` → `Drop \| null` |
| `products` | `list(query)`, `get(slug, { vehicleId? })`, `byIds(ids, { vehicleId? })` → `ProductSummary[]` in the order asked, batched by 60 |
| `reports` | `list(slug, { page?, limit? })`, `create(slug, body)`, `uploadPhotos(files)` → `{ urls }` |
| `questions` | `list(slug)`, `create(slug, body)` |
| `cart` | `price(body)` (use `usePricedCart`) |
| `shipping` | `estimate(pincode)` |
| `checkout` | `lead(body)` → `{ token }` |
| `quotes` | `get(token)` |
| `orders` | `create(body)`, `track({ orderNumber, phone })`, `get(orderNumber, token?)`, `cancel(orderNumber, { token?, reason? })` |
| `payments` | `razorpayVerify(body)`, `razorpayRetry({ orderNumber, token? })`, `upiConfirm(body)` |
| `account` | `updateProfile(body)`, `changePassword(body)`, `orders()`, `addresses.list/create/update(id)/remove(id)`, `wishlist.get/set(ids)`, `garage.get/set(vehicles)` (wishlist and garage are synced for you) |
| `kits` | `build(body)`, `save(body)` → `{ token }` |
| `builds` | `list({ page?, limit? })`, `get(slug)`, `create(body)` |
| `inbound` | `enquiry(body)` → `{ ticketNumber }`, `stockAlert(body)` |
| `admin` | `stats(days)`, `demand(days)`, `followups()` |
| `admin.products` | `list(query)`, `get(id)`, `create(body)`, `update(id, body)`, `patch(id, { stock?, price?, mrp?, isActive?, isFeatured? })`, `remove(id)` |
| `admin.uploads` | `images(files)` → `{ urls }` (FormData, up to 8) |
| `admin.categories` | `list()`, `create(body)`, `update(id, body)`, `remove(id)`, `picks(id)`, `setPicks(id, body)` |
| `admin.drops`, `admin.coupons` | `list()`, `create(body)`, `update(id, body)`, `remove(id)` |
| `admin.orders` | `list(query)`, `get(orderNumber)`, `update(orderNumber, body)`, `exportCsv({ from?, to? })` → `saveFile(await ...)` |
| `admin.quotes` | `list(query)`, `create(body, { allowBelowCost? })`, `update(id, body, { allowBelowCost? })`, `remove(id)` |
| `admin.customers` | `list(query)` |
| `admin.reports` | `list(query)`, `update(id, { status })`, `remove(id)` |
| `admin.questions` | `list(query)`, `answer(id, body)`, `remove(id)` |
| `admin.enquiries` | `list(query)`, `update(id, { status?, adminNote? })` |
| `admin.leads`, `admin.kits`, `admin.stockAlerts` | `list(query)`, `update(id, { status })` |
| `admin.builds` | `list(query)`, `update(slug, { status?, isHouse?, title? })`, `remove(slug)` |
| `admin.settings`, `admin.demo` | `settings.get()`, `settings.update(deepPartial)`, `demo.clear()` |

`lib/queryKeys.ts` mirrors this: `settings()`, `me()`, `categories()`, `vehicles.tree()/detail(id)`, `products.all()/list(query)/detail(slug, vehicleId)/byIds(ids, vehicleId)/suggest(q, vehicleId)`,
`reports.all(slug)/list(slug, query)`, `questions(slug)`, `home(vehicleId)`, `drop(vehicleId)`, `cart.all()/price(request)`, `shipping(pincode)`, `quote(token)`,
`orders.all()/detail(orderNumber, token)/track(orderNumber, phone)`, `account.all()/orders()/addresses()/wishlist()/garage()`, `kits(request)`,
`builds.all()/list(query)/detail(slug)`, and `admin.*`: `stats(days)`, `demand(days)`, `followups()`, `drops()`, `coupons()`, `settings()`,
`categories.all()/list()/picks(id)`, and `{ all(), list(query) }` for `products` (+`detail(id)`), `orders` (+`detail(orderNumber)`), `quotes`, `customers`,
`reports`, `questions`, `enquiries`, `leads`, `kits`, `stockAlerts`, `builds`.

## Hooks (`hooks/`)

| Hook | Returns |
|---|---|
| `useSettings()` | Query of `PublicSettings` (5 min). Blank values mean "not set": hide what depends on them |
| `useMe()` | `{ user, isSignedIn, isAdmin, isPending }`. Wait for `isPending` before redirecting |
| `useLogin()`, `useRegister()`, `useLogout()` | Mutations. Sign-in merges this device's wishlist and garage with the account and writes them back before resolving. Sign-out clears the wishlist and the checkout draft; cart and garage stay |
| `useCategories()`, `useVehicles()`, `useVehicle(id)` | Queries: `Category[]` (5 min), `VehicleMake[]` (1 h), one `Vehicle` |
| `useActiveVehicle()`, `useActiveCar()` | The active garage `Vehicle` (or `GarageCar` with year and nickname), or null |
| `useProduct(slug, { vehicleId?, enabled? })` | Query of `ProductDetail` with fit for the active car (`vehicleId: null` = no car) |
| `useProducts(query, { enabled?, withVehicle? })` | Query of `ProductListResponse`; adds the active car unless the query names one; keeps the previous page while loading |
| `useProductsByIds(ids, options?)` | Query of `ProductSummary[]` in the given order (wishlist, compare, recently viewed). Empty ids = no request |
| `usePricedCart({ paymentMethod?, items?, pincode?, quoteToken?, enabled?, debounceMs? })` | `{ cart, isEmpty, isPending, isUpdating, isError, error, refetch }`. Prices the cart store with its coupon and pincode and the active car, 250 ms after the last change; `cart` stays on the last answer while a new one loads. Same options = one shared request |
| `useSharedCart()` | `{ shared, accept, dismiss }` for a `/cart?c=...` link |
| `useDebounce(value, ms = 300)` | The value once it stops changing |
| `useMediaQuery(query)`, `useIsMobile()` | boolean (`useIsMobile` = below Tailwind `md`) |
| `useCountdown(endsAt)` | `{ totalMs, days, hours, minutes, seconds, isOver }`, re-rendering once a second. Real deadlines only |
| `useOnScreen<T>({ rootMargin?, threshold?, once? })` | `[ref, isVisible]` |
| `useDocumentMeta({ title, description, image, noindex })` (`lib/seo.ts`) | Sets `<title>` ("Title \| Store name"), description, Open Graph tags and robots. Call once in every page |

## Stores (`stores/`, Zustand 5, persisted to localStorage under `addon-*-v1`)

Select one value per call (`useCart((s) => s.lines)`); a selector that builds a new object or array on every call causes an infinite render loop.
Outside React use `useCart.getState()`.

| Store | State | Actions |
|---|---|---|
| `useCart` | `lines: CartLineInput[]`, `couponCode`, `pincode`, `lastAddedKey` | `add({ productId, variantId?, qty?, custom? })` → key (identical lines merge), `setQty(key, qty)` (≤ 0 removes), `remove(key)`, `clear()`, `replaceAll(lines, { couponCode? })`, `setCouponCode(code)`, `setPincode(pin)`, `clearLastAdded()`. Also `cartLineKey(line)` (works on a `PricedLine` too: do not pass `PricedLine.key` to the store), `useCartCount()`, `normalizeCartLines`, `MAX_LINE_QTY` (99) |
| `useWishlist` | `ids` | `toggle(id)` → now saved?, `has(id)`, `remove(id)`, `setAll(ids)`, `clear()`; `useIsWishlisted(id)` |
| `useGarage` | `vehicles: GarageCar[]` (`{ vehicleId, year, nickname, vehicle }`), `activeVehicleId` | `add(vehicle, { year?, nickname?, makeActive? })`, `remove(id)`, `setActive(id \| null)`, `clear()`, `setAll(cars, activeId)`, `refresh(vehicle)`. Max 8 |
| `useCompare` | `ids` (max 4) | `toggle(id)` → `'added' \| 'removed' \| 'full'`, `has(id)`, `remove(id)`, `setAll(ids)`, `clear()`; `useIsCompared(id)` |
| `useRecentlyViewed` | `ids` (max 12, newest first) | `push(id)`, `clear()` |
| `useUi` (not persisted) | `cartOpen`, `searchOpen`, `vehiclePickerOpen`, `mobileMenuOpen` | `openCart/closeCart`, `openSearch/closeSearch`, `openVehiclePicker/closeVehiclePicker`, `openMobileMenu/closeMobileMenu`, `closeAll()`. Opening one closes the others |
| `useTheme` | `theme: 'light' \| 'dark'` | `setTheme(t)`, `toggle()`. Writes `data-theme` on `<html>` and the plain word under `addon-theme` |
| `useCheckout` | `contact { name, email, phone }`, `address: ShippingAddress`, `gstin`, `notes`, `paymentMethod`, `leadToken` | `setContact(patch)`, `setAddress(patch)`, `setDetails({ gstin?, notes?, paymentMethod? })`, `setLeadToken(t)`, `idempotencyKeyFor(fingerprint)`, `orderPlaced()`, `clear()` |

- Wishlist and garage follow the account while signed in (`lib/accountSync.ts`, started by `App`): just use the stores.
- Placing an order: `idempotencyKey: useCheckout.getState().idempotencyKeyFor(JSON.stringify(requestWithoutKey))`. The same request gets the same key
  (safe retry); any change gets a new one. After success call `orderPlaced()`, `useCart.getState().clear()` and invalidate `queryKeys.cart.all()`.

## Other helpers (`lib/`)

| File | Exports |
|---|---|
| `format.ts` | `formatINR(n, { paise? })` → `₹1,19,999`, `formatNumber`, `formatDate(v, { weekday?, year? })` → `17 Nov 2026`, `formatTime`, `formatDateTime`, `formatDateRange(a, b)` → `20 to 23 Nov`, `relativeDay(v)` → `today` / `3 days ago` / date, `capitalize`, `pluralize(3, 'item')` → `3 items`, `minutesLabel(45, 90)` → `45 min to 1.5 hr`. Timestamps show in Indian time; plain `YYYY-MM-DD` dates are never shifted |
| `images.ts` | `imageVariant(url, width)` (480 → thumbnail; editorial 960), `imageSrcSet(url)`, `imageSources(url, sizes)` → `{ src, srcSet, sizes }` |
| `whatsapp.ts` | `waLink(phone, text)` ('' when no number: hide the control), `waShareLink(text)`, `waNumber`, and text builders `askAboutProduct`, `shareProduct`, `shareCompare`, `shareCart`, `orderSummary` |
| `cartLink.ts` | `encodeCart`, `decodeCart`, `cartShareUrl(lines, { couponCode? })`, `readCartLink(search)` |
| `india.ts` | `STATES` (name, GST code), `STATE_NAMES`, `isValidState`, `isValidPincode`, `normalizePhone` → 10 digits or null, `isValidPhone`, `formatPhone`, `isValidGstin` (same rules as the server, plus the GSTIN check character) |
| `labels.ts` | `ORDER_STATUS_LABELS`, `ORDER_PROGRESS`, `PAYMENT_METHOD_LABELS`, `PAYMENT_STATUS_LABELS` |
| `razorpay.ts` | `openRazorpay(instruction, { storeName, description? })` → the three signature fields for `api.payments.razorpayVerify`; rejects with `PaymentDismissedError` (closed) or `PaymentUnavailableError` (script blocked). `loadRazorpay()` to preload, `isInAppBrowser()` (Instagram / Facebook browsers cannot show the window) |
| `qr.ts` | `qrPath(text)` → `{ size, path }` for an inline SVG, `qrSvg(text)`, `qrDataUrl(text)`. Always dark on light |
| `urls.ts` | `siteUrl(path)`, `loginPath(next)`, `safeNextPath(next, fallback)` |
| `forms.ts` | `applyApiError(error, setError, rename?)` |
| `storage.ts` | `safeStorage`, `readJSON(key, fallback)`, `writeJSON`, `removeStored`: localStorage that never throws |
| `uuid.ts`, `ErrorBoundary.tsx`, `queryClient.ts` | `uuid()`; `<ErrorBoundary resetKey fallback>`; the shared `queryClient` |

`features/buildbay/contract.ts`: `CarStageProps`, `BuildStyleOption`, `BUILD_SLOT_STYLES` (slot → styles, exactly the BUILD_SPEC table), `BUILD_SLOTS`,
`BUILD_SLOT_LABELS`, `BUILD_BODY_TYPES`, `LOWERING_RIDE_HEIGHT`, `buildStylesFor(slot, bodyType)`, `findBuildStyle(slot, style)`, `DEFAULT_BUILD_STATE` (frozen: copy it).
