/**
 * Food Express — SQLite schema.
 *
 * Money is stored in PAISE (INTEGER) everywhere so totals never drift through
 * floating point. Every table the product model needs lives here: users,
 * addresses, products, categories, brands, restaurants, menu items, carts,
 * wishlists, coupons, orders, payments, notifications, delivery zones, settings.
 */

export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

/* ------------------------------- settings -------------------------------- */
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

/* -------------------------------- users ---------------------------------- */
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT UNIQUE,
  mobile          TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  avatar_url      TEXT,
  is_email_verified   INTEGER NOT NULL DEFAULT 0,
  is_mobile_verified  INTEGER NOT NULL DEFAULT 0,
  loyalty_points      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

/* ------------------------------ addresses -------------------------------- */
CREATE TABLE IF NOT EXISTS addresses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  pincode     TEXT NOT NULL,
  landmark    TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

/* -------------------------- catalogue: categories ------------------------ */
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#666666',
  icon       TEXT,
  tagline    TEXT,
  is_food    INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

/* --------------------------- catalogue: brands --------------------------- */
CREATE TABLE IF NOT EXISTS brands (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug) ON DELETE CASCADE,
  /** A brand can serve several categories (e.g. Harvest Fields in groceries and dairy). */
  UNIQUE (slug, category_slug)
);

/* -------------------------- catalogue: products -------------------------- */
CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  brand          TEXT,
  category_slug  TEXT NOT NULL REFERENCES categories(slug) ON DELETE RESTRICT,
  description    TEXT NOT NULL DEFAULT '',
  specs          TEXT,
  price_paise    INTEGER NOT NULL CHECK (price_paise >= 0),
  mrp_paise      INTEGER NOT NULL CHECK (mrp_paise >= 0),
  unit           TEXT,
  weight         TEXT,
  image_url      TEXT,
  is_veg         INTEGER NOT NULL DEFAULT 1,
  is_active      INTEGER NOT NULL DEFAULT 1,
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  rating         REAL NOT NULL DEFAULT 0,
  rating_count   INTEGER NOT NULL DEFAULT 0,
  rating_is_demo INTEGER NOT NULL DEFAULT 1,
  tags           TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_products_price    ON products(price_paise);
CREATE INDEX IF NOT EXISTS idx_products_active   ON products(is_active);

/* ----------------------------- restaurants ------------------------------- */
CREATE TABLE IF NOT EXISTS restaurants (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  cuisines     TEXT,
  area         TEXT,
  city         TEXT NOT NULL,
  about        TEXT,
  rating       REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  rating_is_demo INTEGER NOT NULL DEFAULT 1,
  eta_min      INTEGER NOT NULL DEFAULT 20,
  eta_max      INTEGER NOT NULL DEFAULT 40,
  min_order_paise INTEGER NOT NULL DEFAULT 0,
  cost_for_two_paise INTEGER NOT NULL DEFAULT 0,
  delivery_fee_paise INTEGER NOT NULL DEFAULT 0,
  is_veg       INTEGER NOT NULL DEFAULT 0,
  is_open      INTEGER NOT NULL DEFAULT 1,
  is_promoted  INTEGER NOT NULL DEFAULT 0,
  image_url    TEXT,
  tags         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id  INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  price_paise    INTEGER NOT NULL CHECK (price_paise >= 0),
  mrp_paise      INTEGER NOT NULL CHECK (mrp_paise >= 0),
  is_veg         INTEGER NOT NULL DEFAULT 1,
  category       TEXT NOT NULL DEFAULT 'Main Course',
  variations     TEXT NOT NULL DEFAULT '[]',
  addons         TEXT NOT NULL DEFAULT '[]',
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  is_available   INTEGER NOT NULL DEFAULT 1,
  image_url      TEXT,
  UNIQUE (restaurant_id, slug)
);

/* --------------------------- delivery zones ------------------------------ */
CREATE TABLE IF NOT EXISTS cities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  state         TEXT NOT NULL,
  eta_min       INTEGER NOT NULL DEFAULT 20,
  eta_max       INTEGER NOT NULL DEFAULT 40,
  delivery_fee_paise INTEGER NOT NULL DEFAULT 0,
  pincodes      TEXT NOT NULL DEFAULT '[]',
  localities    TEXT NOT NULL DEFAULT '[]',
  /** 'live-simulated' | 'limited' | 'coming-soon' — surfaced verbatim in the UI. */
  status        TEXT NOT NULL DEFAULT 'coming-soon',
  is_default_city INTEGER NOT NULL DEFAULT 0
);

/* -------------------------------- carts ---------------------------------- */
/** owner_key is 'u:<userId>' for signed-in users and 's:<sessionId>' for guests. */
CREATE TABLE IF NOT EXISTS cart_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_key      TEXT NOT NULL,
  item_id        TEXT NOT NULL,
  item_kind      TEXT NOT NULL CHECK (item_kind IN ('product','menu_item')),
  restaurant_id  INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
  /** Selected variations/addons: [{group, option, pricePaise}, {addon, pricePaise}] */
  options        TEXT NOT NULL DEFAULT '[]',
  /** 1 = moved to "Save for later" from the cart page. */
  is_saved       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (owner_key, item_id, options)
);
CREATE INDEX IF NOT EXISTS idx_cart_owner ON cart_items(owner_key);

/* ------------------------------ wishlists -------------------------------- */
CREATE TABLE IF NOT EXISTS wishlist_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_key    TEXT NOT NULL,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (owner_key, product_id)
);

/* ------------------------------- coupons --------------------------------- */
CREATE TABLE IF NOT EXISTS coupons (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL CHECK (type IN ('percent','flat','free_delivery')),
  value            REAL NOT NULL DEFAULT 0,
  min_subtotal_paise INTEGER NOT NULL DEFAULT 0,
  max_discount_paise INTEGER,
  category_slug    TEXT,
  stackable        INTEGER NOT NULL DEFAULT 0,
  usage_limit      INTEGER NOT NULL DEFAULT 0,
  per_user_limit   INTEGER NOT NULL DEFAULT 1,
  used_count       INTEGER NOT NULL DEFAULT 0,
  starts_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at       TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  /** Seeded coupons are demo promotions until configured for real business use. */
  is_demo          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id   INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

/* -------------------------------- orders --------------------------------- */
CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number        TEXT NOT NULL UNIQUE,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind                TEXT NOT NULL CHECK (kind IN ('grocery','food')),
  restaurant_id       INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'placed',
  subtotal_paise      INTEGER NOT NULL,
  discount_paise      INTEGER NOT NULL DEFAULT 0,
  coupon_code         TEXT,
  delivery_fee_paise  INTEGER NOT NULL DEFAULT 0,
  handling_fee_paise  INTEGER NOT NULL DEFAULT 0,
  tax_paise           INTEGER NOT NULL DEFAULT 0,
  total_paise         INTEGER NOT NULL,
  free_delivery_applied INTEGER NOT NULL DEFAULT 0,
  threshold_paise     INTEGER NOT NULL,
  address_snapshot    TEXT NOT NULL,
  payment_method      TEXT NOT NULL,
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  payment_mode        TEXT NOT NULL DEFAULT 'demo',
  eta_minutes         INTEGER,
  idempotency_key     TEXT UNIQUE,
  tracking_is_simulated INTEGER NOT NULL DEFAULT 1,
  loyalty_earned      INTEGER NOT NULL DEFAULT 0,
  placed_at           TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL,
  item_kind     TEXT NOT NULL,
  name          TEXT NOT NULL,
  brand         TEXT,
  unit          TEXT,
  image_url     TEXT,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise INTEGER NOT NULL,
  options       TEXT NOT NULL DEFAULT '[]',
  line_total_paise INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ----------------------------- notifications ----------------------------- */
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (notification_id, user_id)
);

/* --------------------------- support & misc ------------------------------ */
CREATE TABLE IF NOT EXISTS support_tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand      TEXT NOT NULL,
  label      TEXT NOT NULL,
  /** Last 4 only. No real card data is ever stored by this demo app. */
  last4      TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
