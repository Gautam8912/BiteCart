# Food Express

A premium all-in-one delivery and shopping platform — quick-commerce groceries,
restaurant food, daily essentials and electronics — built as a real full-stack
application with a Node/Express + SQLite backend and a React (Vite) frontend.

> **This is a demonstration build, not a production service.** Payments are
> simulated, order tracking is simulated, product ratings are generated demo
> data, and coupons are seeded demo promotions. Every one of those is labelled
> as such in the UI. Nothing here is connected to a payment gateway, a live
> fleet, or a real logistics network.

---

## Quick start

```bash
npm install          # installs deps, then seeds the database (postinstall)
npm run build        # builds the React client into client/dist
npm start            # serves the API + the built SPA on http://localhost:4000
```

For development with hot reload:

```bash
npm run dev          # API on :4000, Vite dev server on :5173 (proxies /api)
```

Open **http://localhost:5173** in development, or **http://localhost:4000** for
the production build.

### Demo accounts

| Role     | Email                          | Password         |
| -------- | ------------------------------ | ---------------- |
| Admin    | `admin@foodexpress.example`    | `Admin@12345`    |
| Customer | `demo@foodexpress.example`     | `Customer@12345` |

Both are printed on the login screen with one-click fill buttons. The customer
account comes with a Vijayawada address, a welcome notification and some loyalty
points so the profile and checkout flows have something to show.

Guests can browse, search, add to cart and check prices without signing in. The
guest cart is merged into the account on sign-in.

### Commands

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `npm run dev`       | API + Vite dev server with hot reload                                |
| `npm run build`     | Production build of the client into `client/dist`                    |
| `npm start`         | Production server (API + static SPA)                                 |
| `npm run seed`      | Rebuild the database from the seed files (destroys existing data)     |
| `npm test`          | Full suite: unit + API integration tests (Node's built-in runner)     |
| `npm run test:unit` | Bill-engine unit tests only                                          |
| `npm run test:api`  | HTTP integration tests against an in-process server                  |
| `npm run verify`    | Acceptance runner: spawns a real server and walks 29 end-to-end flows |

---

## What is implemented

### Storefront
- **Onboarding splash** on first load only (tracked in `sessionStorage`), with a
  progress bar. No artificial timer — it advances as the catalogue loads.
- **15 working product rails** on the home page: Best Sellers, Popular Near You,
  Frequently Bought Together, Trending, Today's Deals, Under ₹99, Fresh
  Arrivals, Recommended, Reorder, Top Restaurants, Fresh Fruits & Vegetables,
  Daily Essentials, Featured Brands, Recently Viewed, Seasonal.
- **219 distinct retail products** across 10 categories and 21 brands, plus
  **12 restaurants with 119 menu items**. No duplicate padding.
- Skeletons while loading, real error states with retry, and guest browsing
  everywhere.

### Product detail
Gallery, brand and category, price with MRP and discount, unit, availability,
delivery estimate, description, spec table, demo-labelled ratings, quantity
selector, Add to Cart / Buy Now / Wishlist, related products,
frequently-bought-together, recently viewed, and return information.

Adding to cart adds exactly one unit. Clicking ADD again increments the same
line to 2 — it never creates a second row. Clicking the card body navigates; it
does not add to cart.

### Cart and the ₹150 rule
The free-delivery threshold is a **server setting**, not a constant in the code:

- `remaining = max(0, threshold − eligibleMerchandiseSubtotal)`
- The eligible subtotal is merchandise only. Delivery fees, handling fees, tips
  and taxes never count toward it.
- Coupons *do* count toward it (they reduce the subtotal, not the eligibility).
- A progress bar and a dynamic message ("Add products worth ₹30 more…") update
  from the same server response as the badge and totals.
- Admins can change the threshold and the fee at `/admin/settings` and the
  storefront reflects it immediately, with no redeploy.

Cart lines support quantity changes, removal at zero, Save for Later, and
continue shopping. Carts persist for guests (session cookie) and for signed-in
users (account row).

### Checkout
Multi-step: address → review → delivery option → coupon → payment → bill review
→ confirm → confirmation.

The client sends only `addressId`, `couponCode`, `paymentMethod` and an
`idempotencyKey`. **Every price is recomputed on the server** from the database,
so a tampered client cannot change what it pays. Replaying the same idempotency
key returns the original order with `duplicate: true` instead of creating a
second one — and the key is stable across retries, so a failed submit that is
tried again cannot double-charge.

### Auth
- Email **or** mobile + password, with show/hide toggle.
- bcrypt hashing (cost 10). No plaintext passwords, no hashes in any response.
- httpOnly, SameSite=Lax session cookie, 7-day TTL.
- Registration with name/email/mobile/password/confirm/terms and duplicate
  detection.
- Password reset with single-use, sha256-hashed, 30-minute tokens.
- Guest browsing, and a guest→account cart merge that takes
  `max(qtyGuest, qtyServer)` per line so quantities are never doubled.
- Identical error text for "no such account" and "wrong password" (no account
  enumeration), plus rate limiting on the credential endpoints.

### Profile
Overview, edit profile, photo upload (data URL, ≤1 MB), addresses (add / edit /
delete / set default), order history and detail with reorder, wishlist, recently
viewed, saved payment methods, coupon wallet, loyalty points and ledger,
notifications, preferences, change password, and sign-out. All queries are
scoped to the signed-in user, so one account cannot read another's data.

### Locations
11 seeded cities with localities and PIN codes. City status is returned
verbatim — `live-simulated`, `limited` or `coming-soon`. A `coming-soon` city
**blocks checkout** rather than silently accepting an order it cannot deliver.
Zone fees differ by city (Vijayawada ₹0, Visakhapatnam ₹10), so availability
visibly changes when you switch.

### Restaurants
Listings with cuisine filters, search and sorting; detail pages with menu
categories, item detail, veg/non-veg labels, variations and add-ons. One
restaurant per cart is enforced server-side with a **409 that names the
restaurant already in the cart**, so the UI can explain the conflict instead of
failing silently.

### Search
Live suggestions over product name, category and brand, plus restaurants and
dishes. Recent history with clear, typo tolerance, empty-state recommendations,
filters (category, price, brand, availability, discount) and sorts (price
ascending/descending, popularity, newest, rating). All filters are applied in
SQL over the real catalogue — nothing is faked client-side.

### Admin
Role-checked **on the server for every request**, not by hiding a button. A
customer calling `/api/admin/*` directly gets `403 FORBIDDEN`, and the database
is unchanged.

Dashboard with revenue over 14 days, orders by status, top products and a
low-stock table; product CRUD with soft-deactivate; stock and price updates;
restaurant open/close, promotion and minimum order; order status advancement;
coupon CRUD; settings (threshold, fees, GST rates, loyalty rate); city/zone
status and fees; user roles; support tickets; and an audit log of every admin
mutation.

### Notifications and support
An in-app notification centre with read/unread state, per-type tabs and clear,
plus a support page with FAQs, order and delivery help, returns, a contact form
that files tickets, and ticket history. Both are labelled in-app demo.

### Pages
About, Contact, Help Center, FAQs, Privacy, Terms, Shipping, Cancellation &
Refund, Account, Cart, Checkout, Wishlist, Order History, Product Details,
Category listings, Search, Restaurants, Restaurant menu, Notifications, Admin,
and a 404. There are no empty placeholders. The four legal pages are marked
**draft** on the page itself — the text has not been professionally reviewed.

---

## Project layout

```
food-express/
├── client/                  React app (Vite)
│   ├── src/
│   │   ├── api/client.js    every HTTP call in one typed module
│   │   ├── components/      Header, Footer, ProductCard, SearchBar,
│   │   │                    LocationSelector, CartDrawer, QuantitySelector,
│   │   │                    PriceBreakdown, DeliveryProgress, ProductFilters,
│   │   │                    LoadingSkeleton, EmptyState, ToastNotification,
│   │   │                    ProtectedRoute, ErrorBoundary, …
│   │   ├── context/         Auth, Cart, Location, Wishlist, RecentlyViewed,
│   │   │                    App (config + sections), Toast
│   │   ├── pages/           22 top-level pages
│   │   │   ├── account/     Profile, Addresses, Coupons, Rewards, Security
│   │   │   └── admin/       AdminDashboard (10 sections)
│   │   ├── styles/app.css   design system
│   │   └── utils/format.js  currency, dates, cart item ids, debounce
│   └── vite.config.js
├── server/                  Express API
│   ├── db/                  schema.js, index.js (+ seed), data/ (gitignored)
│   ├── middleware/          auth (JWT), session (guest id), errors
│   ├── routes/              catalog, auth, cart, checkout, account, location,
│   │                        notifications, admin, images
│   ├── seed/                reference, products (219), restaurants (12/119)
│   ├── utils/               pricing (the bill engine), cart, settings, helpers
│   └── index.js             createApp() + bootstrap
├── scripts/
│   ├── postinstall.mjs      seeds on install
│   └── verify.mjs           acceptance runner
├── tests/
│   ├── pricing.test.mjs     bill engine unit tests
│   └── api.test.mjs         HTTP integration tests
└── package.json
```

---

## Testing and verification

```bash
npm test        # 88 tests
npm run verify  # 29 acceptance checks against a real spawned server
npm run build   # production client build
```

`tests/pricing.test.mjs` covers the bill engine directly: the ₹150 threshold at
₹0 / ₹80 / ₹120 / ₹149 / ₹150 / ₹200, fees and taxes never counting toward the
threshold, the threshold being read from settings rather than hard-coded, zone
fees, every coupon type, caps, category scoping, expiry, and the invariant that
`subtotal + fees + tax = total`.

`tests/api.test.mjs` drives the real HTTP API: wrong credentials, mobile login,
hash storage, duplicate registration, weak passwords, single-use reset tokens,
the 501 Google stub, out-of-stock and stock-clamping, client-price rejection,
quantity increments, save-for-later, coupon validation, the one-restaurant rule,
guest cart merge, idempotent checkout, stock decrement, COD vs demo payment
labelling, order cancellation and restock, cross-user isolation, admin 401/403
enforcement, audit logging, search, filters, sections, serviceability, wishlist
privacy and notifications.

`scripts/verify.mjs` spawns `node server/index.js` on a throwaway database,
waits for `/api/health`, then walks the end-to-end flows and prints a pass/fail
table. It exits non-zero on any failure.

---

## Environment variables

Copy `.env.example` to `.env`. The only strictly required value is
`FE_JWT_SECRET`.

| Variable                    | Default                          | Purpose                                        |
| --------------------------- | -------------------------------- | ---------------------------------------------- |
| `PORT`                      | `4000`                           | API (and production SPA) port                    |
| `FE_JWT_SECRET`             | —                                | **Required.** Session signing secret             |
| `FE_DB_PATH`                | `server/db/data/foodexpress.db`  | SQLite file location                             |
| `FE_COOKIE_SECURE`          | unset                            | Set `production` behind HTTPS for Secure cookies |
| `FE_TRUST_PROXY`            | unset                            | Trust `X-Forwarded-*` behind a reverse proxy     |
| `FE_DEMO_ADMIN_PASSWORD`    | `Admin@12345`                    | Seeded admin password                            |
| `FE_DEMO_CUSTOMER_PASSWORD` | `Customer@12345`                 | Seeded customer password                         |
| `FE_AUTH_RATE_LIMIT`        | `25`                             | Auth attempts per 15 min per IP                  |
| `FE_API_URL`                | `http://127.0.0.1:4000`          | Vite dev-server proxy target                     |

No API keys, tokens or service-account files are committed. `.env` is
gitignored.

---

## Backend configuration still needed

These are real integrations the brief calls for. Each is implemented as an
explicit failure rather than a fake success, so nothing silently pretends to
work:

| Feature                | Current behaviour                                                     | What it needs                                   |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| Google sign-in         | `POST /api/auth/google` → **501 `PROVIDER_NOT_CONFIGURED`**            | An OAuth client (`GOOGLE_CLIENT_ID`/`SECRET`)    |
| Password reset email   | Returns a `demoResetToken` in the response, labelled as a dev aid       | An SMTP or transactional-email provider          |
| Email / mobile OTP     | Not implemented; accounts show as unverified                            | SMTP + an SMS gateway                            |
| Card / UPI payments    | `demo_card` and `upi_demo` record `paymentMode: 'demo'`, status `paid-demo` | A PSP such as Razorpay or Stripe             |
| Cash on delivery       | Fully implemented locally; recorded as `pending`, never as `paid`        | A reconciliation process at handover             |
| Live order tracking    | Status advances via the admin dashboard, labelled simulated             | A fleet/dispatch system and courier webhooks     |
| Saved cards            | Brand + last 4 only, for UI display                                     | A PCI-compliant token vault                      |
| Image uploads          | Product images are generated SVGs; avatars are data URLs ≤1 MB          | Object storage (S3/R2) with signed uploads       |
| Product reviews        | Ratings are deterministic demo values, labelled as such                 | A moderated review pipeline                      |

---

## What stays simulated

- **Payments.** No money moves. Demo methods are flagged `paymentIsDemo: true`
  in the API and shown with a "Simulated payment" tag in the UI.
- **Order tracking.** The Placed → Confirmed → Packing/Preparing → Out for
  Delivery → Delivered flow is real, but the advancement is manual or scheduled
  — there is no GPS and no live courier feed, and the tracker says so.
- **Ratings and reviews.** Deterministic per product, labelled "Demo ratings".
  There are no verified-purchase reviews.
- **Coupons.** Seeded demo promotions, labelled as such. Two are deliberately
  unusable (`DIWALI25` expired, `EXPIRED100` deactivated) so the validation
  paths are exercisable.
- **Delivery availability.** City statuses are seeded. Vijayawada is
  `live-simulated`; Patna and others are `coming-soon` and refuse checkout.
- **Legal pages.** Draft text, flagged on the page. Not legal advice.

---

## Security notes

- Passwords: bcrypt, cost 10. Never stored or returned in plain text.
- Sessions: JWT in an httpOnly, SameSite=Lax cookie (with a Bearer fallback for
  non-browser clients). Page scripts cannot read the token.
- Authorisation: the role is re-read from the database on every admin request.
  `ProtectedRoute` in the client is a UX gate only — it grants nothing.
- Pricing: every amount is recomputed server-side from the database at cart
  preview and again at checkout. Client-supplied prices are ignored.
- Input: validation on every mutation, parameterised SQL throughout (no string
  concatenation into queries), and a `sanitize()` helper for free text.
- Rate limiting on the credential endpoints.
- Helmet sets a content-security policy; cookies are scoped and SameSite.
- Admin mutations are written to an audit log with the acting user.
- Product deletion is a soft deactivate, so order history stays intact.
- Nothing sensitive is committed: no keys, no tokens, no service-account files.

---

## Known limitations

- The admin dashboard uses `window.prompt` for a few single-field edits (stock,
  zone fee, restaurant minimum order). Functional, not beautiful.
- Menu-item editing is exposed through the API
  (`POST /api/admin/restaurants/:id/menu`, `PUT /api/admin/menu/:id`) but has no
  form in the dashboard yet.
- Signing out clears the session on the current device only; invalidating all
  sessions needs a server-side session store.
- Notification delivery is in-app only — no push, SMS or email channel.
- The SQLite database is single-node. Moving to Postgres needs the few
  `datetime('now')` calls and the `INSERT OR IGNORE` idioms revisited.

---

## Build and deployment

```bash
npm ci
npm run build
NODE_ENV=production FE_JWT_SECRET="$(openssl rand -hex 48)" npm start
```

The production server serves `client/dist` and falls back to `index.html` for
client-side routes, so a single port hosts both the API and the SPA. Behind a
reverse proxy, set `FE_TRUST_PROXY=1` and `FE_COOKIE_SECURE=production` and
terminate TLS at the proxy.
#   B i t e C a r t 
 
 
