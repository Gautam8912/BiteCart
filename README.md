# 🛒 BiteCart — Food, Groceries & Everyday Shopping


**One platform. Everyday needs. Delivered.**

BiteCart is a full-stack shopping and food delivery demo that brings groceries, restaurant meals, daily essentials, and electronics into one experience.

Built with **React, Vite, Node.js, Express, and SQLite**, the project demonstrates storefront browsing, authentication, cart management, checkout, order history, location-based availability, and an admin dashboard.

> [!IMPORTANT]
> **Demo project — not a production delivery service.** Payments, delivery tracking, ratings, and promotions are simulated. No real payment is processed, and no live courier network is connected.

---

## ✨ Features

| Feature | What you can explore |
|---|---|
| 🏠 Storefront | Product sections, deals, recommendations, and categories |
| 🛍️ Shopping | Product details, search, filters, wishlist, and recently viewed items |
| 🧺 Smart cart | Quantity controls, Save for Later, and delivery-threshold progress |
| 🚚 Delivery rule | Configurable free-delivery threshold, initially ₹150 |
| 🍔 Restaurants | Restaurant listings, menus, variations, and add-ons |
| 👤 Customer account | Profile, addresses, orders, rewards, coupons, and notifications |
| 🔐 Authentication | Registration, login, password hashing, and password-reset flow |
| 💳 Checkout | Server-calculated totals, coupon validation, and demo payment methods |
| 📍 Locations | City and locality selection with simulated serviceability |
| 🛠️ Admin dashboard | Products, stock, orders, coupons, settings, users, and audit logs |
| 🧪 Automated tests | Unit tests, API integration tests, and acceptance checks |

## 📦 Demo catalogue

- **219 retail products**
- **10 product categories**
- **21 brands**
- **12 restaurants**
- **119 restaurant menu items**
- **11 seeded cities**

Catalogue data is seeded demo data, not a live inventory feed.

## 🖥️ Tech stack

**Frontend**
- React
- Vite
- CSS

**Backend**
- Node.js
- Express
- SQLite

**Testing and tooling**
- Node.js test runner
- API integration tests
- Automated acceptance checks

## 🚀 Run locally

### Prerequisites

Install a supported version of Node.js and npm.

### 1. Clone the repository

```bash
git clone https://github.com/Gautam8912/BiteCart.git
cd BiteCart
```

### 2. Install dependencies

```bash
npm ci
```

The installation process seeds the demo database through the configured post-install script.

### 3. Configure the environment

Copy `.env.example` to `.env` and set a private `FE_JWT_SECRET`.

For local development, generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `.env`:

```dotenv
FE_JWT_SECRET=paste_your_generated_secret_here
```

Do not commit `.env` or expose production secrets.

### 4. Start development servers

```bash
npm run dev
```

Open **http://localhost:5173**.

The Vite development server runs the frontend and proxies API requests to the backend on port `4000`.

### 5. Build and run for production locally

```bash
npm run build
npm start
```

Open **http://localhost:4000**.

This runs the production build locally; it does not deploy the application to the internet.

## 🔑 Demo accounts

Use these credentials only with your local demo application.

| Role | Email | Password |
|---|---|---|
| Customer | `demo@foodexpress.example` | `Customer@12345` |
| Admin | `admin@foodexpress.example` | `Admin@12345` |

The demo customer account contains sample profile and shopping data. Demo credentials are for testing, not real accounts.

## 🧪 Testing

Run the available checks from the project root:

```bash
npm test
npm run test:unit
npm run test:api
npm run verify
npm run build
```

- `npm test` — runs the test suite.
- `npm run test:unit` — tests pricing and bill calculations.
- `npm run test:api` — exercises backend API behavior.
- `npm run verify` — runs acceptance checks against a spawned server.
- `npm run build` — builds the frontend.

## 💰 Cart and checkout logic

BiteCart demonstrates server-side pricing and cart rules:

- The initial free-delivery threshold is ₹150.
- Delivery and handling fees do not count toward the eligible merchandise subtotal.
- Coupon discounts can change threshold eligibility.
- Checkout totals are recalculated by the server.
- Idempotency keys help prevent duplicate orders on retries.
- Demo card and UPI payments do not transfer real money.
- Cash on delivery is recorded separately from paid demo transactions.

The admin settings can change supported delivery and pricing rules.

## 🗂️ Project structure

```text
BiteCart/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── utils/
│   └── vite.config.js
├── server/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── seed/
│   ├── utils/
│   └── index.js
├── scripts/
├── tests/
├── .env.example
├── package.json
└── README.md
```

## 🔒 Security considerations

The demo includes password hashing, protected admin API routes, server-side price calculations, parameterized SQL queries, authentication rate limiting, and an audit log for admin mutations.

These safeguards are part of the project implementation; they do **not** mean the application has undergone an independent security audit or is production-ready.

## ⚠️ Current limitations

- Payments are simulated; no payment gateway is connected.
- Order tracking does not use live GPS or courier updates.
- Product ratings and promotions are demo data.
- Google sign-in requires OAuth configuration.
- Email and mobile OTP verification are not fully integrated.
- Password reset uses a development-oriented flow until an email provider is configured.
- Some admin editing features have limited UI.
- The database is SQLite and is intended for this demo setup.
- Legal pages contain draft text and require professional review before real-world use.

## 🛣️ Future improvements

- [ ] Deploy the frontend and backend
- [ ] Integrate a payment provider in test mode
- [ ] Add email and OTP verification
- [ ] Connect production-grade image storage
- [ ] Improve admin editing forms
- [ ] Add live delivery integrations
- [ ] Review security, privacy, and legal requirements

## 👨‍💻 Author

**Gautam Kumar**

GitHub: [@Gautam8912](https://github.com/Gautam8912)

---

*BiteCart is an educational full-stack project built to explore modern web development, API design, shopping workflows, and server-side business logic.*
