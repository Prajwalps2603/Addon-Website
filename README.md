# Addon Automotive online store

The website for Addon Automotive, the car accessories shop and fitting studio. Customers can:

- browse parts by category or by their car, and see whether each part fits that car
- buy parts for home delivery (cash on delivery, UPI or Razorpay)
- collect parts from the studio
- have parts fitted at the studio in a booked slot, or book a fitting service on its own

EMI through Bajaj Finserv is shown on the products where it applies.

There are two parts:

- `server/`: the API, the database (one SQLite file) and uploaded photos. Node.js and Express.
- `client/`: the storefront and the admin pages. React, built with Vite.

In production one Node process serves both: the API under `/api` and the built storefront for every other address.

## Run it on your computer

You need Node.js 24.13 or newer.

```
npm run setup     # installs everything (run once, and again after an update)
npm run dev       # starts the API and the storefront together
```

The first start creates the database at `server/data/addon.db` and loads the sample catalogue.

Ports:

- The API port is `PORT` in `server/.env` (default 4000). On this machine it is 4100.
- The storefront finds the API through `VITE_API_PROXY_TARGET` in `client/.env.local` (on this machine `http://127.0.0.1:4100`).
- The storefront itself opens on port 5173. This machine runs it on 5180, started with:

  ```
  npx concurrently -k -n api,web "npm --prefix server run dev" "npm --prefix client run dev -- --port 5180 --host 0.0.0.0"
  ```

Copy `.env.example` to `server/.env` to see every setting the server reads. Everything is optional in development.

Checks: `npm test` runs the server tests, `npm run typecheck` checks the storefront code.

## Admin

Open `/admin` and sign in.

| | |
|---|---|
| Email | `admin@addon.local` |
| Password | `ChangeMe@123` |

These come from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env`, and are used once, when the database is first created. Changing them later in `.env` does not change an existing account.

**Change the password straight away:** in the admin menu choose **Change password** (it opens `/account/profile`). "Forgot password" only sends a reset email once email (SMTP) is set up. Until then the reset link is printed in the server console.

## Store details

Everything the shop shows about itself is in **Admin → Settings**. Phone numbers are never written into the pages; they all come from here.

- **Store:** name, phone numbers, WhatsApp, email, address, GSTIN, hours, Instagram. The address, email and GSTIN are blank until you fill them in, and anything blank is hidden from customers. The invoice says "Tax invoice" and shows the GSTIN only once one is saved.
- **Studio:** the studio address and map link, slot times, cars per slot, the Sunday half day, closed days, the notice needed for same-day slots, and how far ahead bookings open. Switch off "Take studio bookings" to pause fitting and pickup.
- **Fitting services:** each service's name, charge and time. Each service also lists the catalogue subcategories it fits, and that is how a part knows it can be fitted at the studio and what the fitting costs.
- **Grievance officer:** required by the e-commerce rules; shown on the contact and policy pages.
- **Delivery, Payments, EMI, Promises, Home page, From the studio, Search words, Invoices and email:** the rest.

The ticker messages at the top of the site (Settings → Home page) are plain text. If you change the free-delivery amount or the COD fee, update those messages too.

The bookings diary is at **Admin → Bookings**. Studio orders and fitting-only bookings both appear there.

## Products and photos

**Admin → Products → Add product.** Fill in the sections and add photos in the form: JPG, PNG or WebP, up to 8 at a time, 8 MB each. They are turned into web-sized WebP files automatically. Each product needs:

- a category and subcategory
- a price and MRP
- stock
- which cars it fits

Quick changes such as stock, price, hiding a product or featuring it can be made straight from the products list.

Categories and the three "Pick of three" products on each category page are under **Admin → Categories**.

## Replace the sample data

The store starts with a sample catalogue, sample reviews and questions, so you can see how everything works. Sample items are marked "Sample".

When your own products are in, go to **Admin → Settings → Sample data → Remove all sample data** and type REMOVE to confirm. This removes:

- every sample product
- the sample reviews, questions, drops, coupons and builds

Your categories, the car list, your settings, customer accounts, and anything you created yourself stay. Once removed, the samples do not come back on their own.

To start again from the full sample store (this deletes the catalogue): `npm run seed -- --reset`.

## Payments

**Cash on delivery** works from the start. Its fee and limits are in Settings → Payments. Pickup and studio orders show it as "Pay at the studio".

**UPI (direct to your account):**

1. Enter your UPI ID and payee name in Settings → Payments.
2. Customers pay by QR code or UPI app, then type their 12-digit UTR.
3. You check it against your bank statement and mark the order paid on the order page.

**Razorpay (cards, UPI, netbanking, wallets):**

1. In the Razorpay dashboard, create API keys. Put them in `server/.env` as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. Add a webhook pointing to `https://<your domain>/api/payments/razorpay/webhook` with the events `payment.captured` and `order.paid`. Put its secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Restart the server. Settings → Payments shows whether Razorpay is connected.

Use test keys first and place a test order, then switch to live keys.

## Email (SMTP)

Without email settings, messages to customers and to you are written to the server console instead of being sent. To send them, put your mail provider's details in `server/.env` and restart the server:

- `SMTP_HOST`
- `SMTP_PORT` (587, or 465 for SSL)
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`, for example `Addon Automotive <orders@addonautocraft.com>`

Settings → Invoices and email shows whether email is set up, and where new-order notices go.

## Go live

1. On the server machine (Node.js 24.13 or newer):

   ```
   npm run setup
   npm run build        # builds the storefront into client/dist
   ```

2. Create `server/.env` (start from `.env.example`):

   | Setting | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | the port your host gives you, or for example 4000 |
   | `PUBLIC_URL` | your address, for example `https://addonautocraft.com`. Used in emails, link previews and the sitemap. |
   | `JWT_SECRET` | a long random string |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | your own. The server refuses to start in production with the default password. |
   | `DB_PATH`, `UPLOADS_DIR` | folders on a **persistent disk**. The database and uploaded photos live there; if they are on a disk that is wiped on redeploy, orders and photos are lost. |
   | Razorpay and SMTP | as above |

3. Start it with `npm start`. One process serves the site and the API. Keep it running with your host's process manager, so it restarts after a crash or a reboot.
4. Put it behind HTTPS. Most hosts do this for you; on your own server use a reverse proxy in front of `PORT`.
5. Back up the database file and the uploads folder regularly.
6. Check `https://<your domain>/api/health`, then place one real order of a small item end to end.

## Where things are

| | |
|---|---|
| `docs/COMPANY.md` | The company facts the store uses. Nothing else about the business is assumed. |
| `docs/API.md`, `client/src/types/api.ts` | Every API address and the shape of its data. |
| `docs/BUILD_SPEC.md` | What the store does and why. |
| `client/DESIGN.md` | Colours (black, white and red), type and components. |
| `docs/SERVER_GUIDE.md`, `docs/CLIENT_GUIDE.md` | Notes for developers. |
