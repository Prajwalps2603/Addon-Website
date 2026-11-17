-- Addon Auto Motive: database schema (SQLite via node:sqlite)
--
-- Conventions
--   * Money is INTEGER rupees (INR). Paise exist only inside the Razorpay module.
--   * Timestamps are ISO-8601 UTC strings, e.g. 2026-11-17T09:30:00Z.
--   * JSON columns are TEXT holding valid JSON; the default shows the shape ('[]' or '{}').
--   * Booleans are INTEGER 0/1 (node:sqlite cannot bind true/false).
--   * is_demo = 1 marks seeded sample rows so the owner can wipe them in one click before going live.
--   * This file is idempotent (IF NOT EXISTS everywhere) and is executed on every start.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Store settings (key/value, value is JSON)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ---------------------------------------------------------------------------
-- Users and what belongs to them
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone               TEXT NOT NULL DEFAULT '',
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  reset_token_hash    TEXT,
  reset_token_expires TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Home',
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  line1      TEXT NOT NULL,
  line2      TEXT NOT NULL DEFAULT '',
  landmark   TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL,
  state      TEXT NOT NULL,
  pincode    TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  blurb      TEXT NOT NULL DEFAULT '',
  art_kind   TEXT NOT NULL DEFAULT 'generic',      -- photo pool / icon key, e.g. 'alloy-wheel'
  image      TEXT NOT NULL DEFAULT '',             -- tile photo URL
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- One row per model generation, e.g. Maruti Suzuki Swift 2018-2024 and Swift 2024 onwards.
CREATE TABLE IF NOT EXISTS vehicles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  make       TEXT NOT NULL,
  make_slug  TEXT NOT NULL,
  model      TEXT NOT NULL,
  model_slug TEXT NOT NULL,
  generation TEXT NOT NULL DEFAULT '',
  body_type  TEXT NOT NULL CHECK (body_type IN ('hatchback','sedan','suv','muv','pickup','coupe')),
  year_from  INTEGER NOT NULL,
  year_to    INTEGER,                              -- NULL = still on sale
  pcd        TEXT NOT NULL DEFAULT '',             -- wheel bolt pattern when we are confident, e.g. '4x100'
  is_popular INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (make_slug, model_slug, year_from)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make_slug, model_slug);

CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT NOT NULL UNIQUE,
  sku                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  brand               TEXT NOT NULL DEFAULT 'Addon',               -- house line, e.g. 'Addon Aero'
  category_id         INTEGER NOT NULL REFERENCES categories(id),  -- always a subcategory (leaf)
  short_description   TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',                    -- plain text, blank line = new paragraph
  price               INTEGER NOT NULL CHECK (price >= 0),         -- regular selling price, GST included
  mrp                 INTEGER NOT NULL CHECK (mrp >= 0),           -- maximum retail price, inclusive of all taxes
  cost_price          INTEGER,                                     -- owner only, never sent to the storefront
  stock               INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  supplier            TEXT NOT NULL DEFAULT '',                    -- owner only: who to reorder from
  hsn_code            TEXT NOT NULL DEFAULT '',
  gst_rate            INTEGER NOT NULL DEFAULT 18,
  weight_grams        INTEGER NOT NULL DEFAULT 500,
  ship_class          TEXT NOT NULL DEFAULT 'small' CHECK (ship_class IN ('small','medium','bulky','freight')),
  net_quantity        TEXT NOT NULL DEFAULT '1 piece',             -- Legal Metrology: e.g. 'Set of 4'
  manufacturer        TEXT NOT NULL DEFAULT '',                    -- Legal Metrology: maker / importer name and address
  country_of_origin   TEXT NOT NULL DEFAULT 'India',
  images              TEXT NOT NULL DEFAULT '[]',                  -- JSON string[] of image URLs (first = main)
  art_kind            TEXT,                                        -- NULL = use the category's
  finish_color        TEXT NOT NULL DEFAULT '',                    -- hex, the part's finish (used by Build Bay)
  highlights          TEXT NOT NULL DEFAULT '[]',                  -- JSON string[]
  specs               TEXT NOT NULL DEFAULT '[]',                  -- JSON {label,value}[]
  box_contents        TEXT NOT NULL DEFAULT '[]',                  -- JSON string[]
  tags                TEXT NOT NULL DEFAULT '[]',                  -- JSON string[]

  -- Fitment
  fitment_type        TEXT NOT NULL DEFAULT 'universal' CHECK (fitment_type IN ('vehicle','body_type','pcd','universal','none')),
  body_types          TEXT NOT NULL DEFAULT '[]',                  -- JSON string[] for fitment_type 'body_type'
  pcd                 TEXT NOT NULL DEFAULT '',                    -- for fitment_type 'pcd', e.g. '4x100'

  -- The Straight Label: the honest facts shown on every product
  legality            TEXT NOT NULL DEFAULT 'road_legal' CHECK (legality IN ('road_legal','check_rules','off_road_only')),
  legality_note       TEXT NOT NULL DEFAULT '',
  warranty_impact     TEXT NOT NULL DEFAULT 'none' CHECK (warranty_impact IN ('none','possible','likely')),
  warranty_note       TEXT NOT NULL DEFAULT '',
  wiring              TEXT NOT NULL DEFAULT 'none' CHECK (wiring IN ('none','plug_and_play','splice')),
  reversible          INTEGER NOT NULL DEFAULT 1,
  skip_if             TEXT NOT NULL DEFAULT '',                    -- "Skip this if ..." one honest line
  install_difficulty  INTEGER NOT NULL DEFAULT 1 CHECK (install_difficulty BETWEEN 1 AND 5),
  install_time_min    INTEGER NOT NULL DEFAULT 15,                 -- minutes
  install_time_max    INTEGER NOT NULL DEFAULT 30,
  pro_install         INTEGER NOT NULL DEFAULT 0,                  -- a fitter is advised
  fitting_cost_min    INTEGER NOT NULL DEFAULT 0,                  -- fair local labour charge, rupees (0 = DIY)
  fitting_cost_max    INTEGER NOT NULL DEFAULT 0,
  fitting_tools       TEXT NOT NULL DEFAULT '[]',                  -- JSON string[]
  fitting_steps       TEXT NOT NULL DEFAULT '[]',                  -- JSON {en,hi}[] for the Fitting Card
  warranty_months     INTEGER NOT NULL DEFAULT 0,
  returnable          INTEGER NOT NULL DEFAULT 1,
  cod_eligible        INTEGER NOT NULL DEFAULT 1,

  -- Kits and Build Bay
  goals               TEXT NOT NULL DEFAULT '[]',                  -- JSON string[] of kit goals this part serves
  essential_rank      INTEGER NOT NULL DEFAULT 0,                  -- 1 = first thing to buy for the goal, 0 = never auto-picked
  build_slot          TEXT,                                        -- Build Bay slot, e.g. 'wheels'
  build_style         TEXT,                                        -- Build Bay art style inside the slot, e.g. 'mesh'

  custom_kind         TEXT,                                        -- e.g. 'show-plate': configured in a designer before buying
  is_featured         INTEGER NOT NULL DEFAULT 0,
  is_new              INTEGER NOT NULL DEFAULT 0,
  is_active           INTEGER NOT NULL DEFAULT 1,
  is_demo             INTEGER NOT NULL DEFAULT 0,
  rating_avg          REAL NOT NULL DEFAULT 0,                     -- from approved fitted reports
  rating_count        INTEGER NOT NULL DEFAULT 0,
  sold_count          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, is_featured);
CREATE INDEX IF NOT EXISTS idx_products_build ON products(build_slot);

-- When a product has variants: products.price / mrp hold the lowest variant price ("from" price)
-- and products.stock holds the sum of variant stock. Whoever writes variants keeps those in sync.
CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,                        -- e.g. '17 inch / Gloss Black'
  sku        TEXT NOT NULL UNIQUE,
  price      INTEGER NOT NULL,
  mrp        INTEGER NOT NULL,
  stock      INTEGER NOT NULL DEFAULT 0,
  attributes TEXT NOT NULL DEFAULT '{}',           -- JSON, e.g. {"Size":"17 inch","Finish":"Gloss Black"}
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- What we know about a part on a specific car. Rows are written by the seed, by the admin
-- product form, and by the Fitment Desk each time the owner answers "will this fit my car?".
CREATE TABLE IF NOT EXISTS product_fitments (
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_id  INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  fit_type    TEXT NOT NULL DEFAULT 'direct' CHECK (fit_type IN ('direct','with_work','no')),
  note        TEXT NOT NULL DEFAULT '',            -- e.g. 'Needs two holes drilled in the boot lid'
  is_verified INTEGER NOT NULL DEFAULT 0,          -- owner has test-fitted or confirmed it: eligible for the Fit Promise
  PRIMARY KEY (product_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS idx_fitments_vehicle ON product_fitments(vehicle_id);

-- "You will also need" (requires) and "works well with" (pairs_with).
CREATE TABLE IF NOT EXISTS product_relations (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  related_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('requires','pairs_with')),
  note       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (product_id, related_id)
);

-- Pick of Three: the shop's three opinions at the top of a subcategory page.
CREATE TABLE IF NOT EXISTS category_picks (
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL CHECK (tier IN ('sensible','sweet_spot','all_out')),
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (category_id, tier)
);

-- One row each time a product's regular price changes (and one at creation), so the
-- storefront can show the true lowest price of the last 30 days beside any reduction.
CREATE TABLE IF NOT EXISTS price_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price       INTEGER NOT NULL,
  mrp         INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id, recorded_at);

-- The Friday Five: a short, dated price drop on a few hand-picked parts, each with a reason.
-- At most one drop is active at a time (the admin API enforces it).
CREATE TABLE IF NOT EXISTS drops (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  is_demo    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS drop_items (
  drop_id     INTEGER NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  percent_off INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 90),
  reason      TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (drop_id, product_id)
);

-- Read products through this view. It adds category names and the price after any live drop.
--   sale_price   = what the shopper pays now (equals price when no drop is live)
--   drop_percent = 0 when no drop is live
-- Variant prices get the same percentage off: sale = ROUND(variant.price * (100 - drop_percent) / 100).
DROP VIEW IF EXISTS v_products;
CREATE VIEW v_products AS
SELECT
  p.*,
  c.slug  AS category_slug,
  c.name  AS category_name,
  COALESCE(p.art_kind, c.art_kind) AS resolved_art_kind,
  pc.id   AS parent_category_id,
  pc.slug AS parent_category_slug,
  pc.name AS parent_category_name,
  COALESCE(d.percent_off, 0) AS drop_percent,
  COALESCE(d.reason, '')     AS drop_reason,
  d.ends_at                  AS drop_ends_at,
  CAST(ROUND(p.price * (100 - COALESCE(d.percent_off, 0)) / 100.0) AS INTEGER) AS sale_price
FROM products p
JOIN categories c ON c.id = p.category_id
LEFT JOIN categories pc ON pc.id = c.parent_id
LEFT JOIN (
  SELECT di.product_id, MAX(di.percent_off) AS percent_off, di.reason, MIN(dr.ends_at) AS ends_at
  FROM drop_items di
  JOIN drops dr ON dr.id = di.drop_id
  WHERE dr.is_active = 1
    AND dr.starts_at <= strftime('%Y-%m-%dT%H:%M:%SZ','now')
    AND dr.ends_at   >  strftime('%Y-%m-%dT%H:%M:%SZ','now')
  GROUP BY di.product_id
) d ON d.product_id = p.id;

-- Fitted Reports: structured reports from people who actually received the part.
CREATE TABLE IF NOT EXISTS reviews (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_number         TEXT NOT NULL DEFAULT '',
  author_name          TEXT NOT NULL,
  vehicle              TEXT NOT NULL DEFAULT '',   -- free text, e.g. 'Hyundai i20 2021'
  rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  fitted_by            TEXT NOT NULL DEFAULT 'self' CHECK (fitted_by IN ('self','local_garage','dealer','not_fitted')),
  time_minutes         INTEGER,                    -- how long fitting really took
  difficulty           INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  fitted_ok            INTEGER NOT NULL DEFAULT 1, -- fitted without problems
  issues               TEXT NOT NULL DEFAULT '',   -- what went wrong, if anything
  body                 TEXT NOT NULL DEFAULT '',   -- anything else worth knowing
  photos               TEXT NOT NULL DEFAULT '[]', -- JSON string[] of image URLs
  is_verified_purchase INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_demo              INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

-- Questions on a product. kind 'fitment' = "will this fit my car?": answering it also writes
-- product_fitments, so the store answers that car forever after (the Answer-Once Fitment Desk).
CREATE TABLE IF NOT EXISTS product_questions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general','fitment')),
  vehicle_id      INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_label   TEXT NOT NULL DEFAULT '',
  author_name     TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',        -- so staff can reply on WhatsApp; never shown publicly
  question        TEXT NOT NULL,
  answer          TEXT,
  answer_fit_type TEXT CHECK (answer_fit_type IN ('direct','with_work','no')),
  answered_at     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  is_demo         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_product ON product_questions(product_id, status);

-- ---------------------------------------------------------------------------
-- Customer lists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist_items (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS user_vehicles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  year       INTEGER,
  nickname   TEXT NOT NULL DEFAULT '',
  is_active  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_user_vehicles_user ON user_vehicles(user_id);

-- ---------------------------------------------------------------------------
-- Coupons, quotes, orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  description  TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL CHECK (type IN ('percent','flat','free_shipping')),
  value        INTEGER NOT NULL DEFAULT 0,          -- percent (1-100) or rupees
  min_order    INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,                             -- cap for percent coupons
  starts_at    TEXT,
  ends_at      TEXT,
  usage_limit  INTEGER,
  used_count   INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  is_demo      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- A priced offer the owner builds while on a call or chat and sends as a link.
CREATE TABLE IF NOT EXISTS quotes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token         TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  note          TEXT NOT NULL DEFAULT '',
  items         TEXT NOT NULL DEFAULT '[]',         -- JSON {productId,variantId,qty,unitPrice}[]
  shipping_fee  INTEGER,                            -- NULL = normal shipping rules
  valid_until   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','ordered','cancelled')),
  order_number  TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number        TEXT NOT NULL UNIQUE,         -- e.g. ADN-261117-4F7K
  invoice_number      TEXT NOT NULL DEFAULT '',     -- gapless per financial year, set when the order is placed
  access_token        TEXT NOT NULL,                -- lets a guest open their order page
  idempotency_key     TEXT UNIQUE,                  -- from the browser, stops double orders
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'placed' CHECK (status IN
                        ('pending_payment','placed','confirmed','packed','shipped','out_for_delivery','delivered','cancelled','returned')),
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('cod','razorpay','upi')),
  payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','advance_paid','paid','failed','refunded')),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  upi_reference       TEXT NOT NULL DEFAULT '',     -- UTR the customer typed in for direct UPI payments
  customer_name       TEXT NOT NULL,
  email               TEXT NOT NULL DEFAULT '',
  phone               TEXT NOT NULL,
  ship_name           TEXT NOT NULL,
  ship_phone          TEXT NOT NULL,
  ship_line1          TEXT NOT NULL,
  ship_line2          TEXT NOT NULL DEFAULT '',
  ship_landmark       TEXT NOT NULL DEFAULT '',
  ship_city           TEXT NOT NULL,
  ship_state          TEXT NOT NULL,
  ship_pincode        TEXT NOT NULL,
  gstin               TEXT NOT NULL DEFAULT '',     -- buyer GSTIN for business invoices
  vehicle             TEXT NOT NULL DEFAULT '',     -- the car the buyer said this order is for
  subtotal            INTEGER NOT NULL,
  discount            INTEGER NOT NULL DEFAULT 0,   -- coupon discount
  coupon_code         TEXT NOT NULL DEFAULT '',
  prepaid_discount    INTEGER NOT NULL DEFAULT 0,
  shipping_fee        INTEGER NOT NULL DEFAULT 0,
  cod_fee             INTEGER NOT NULL DEFAULT 0,
  total               INTEGER NOT NULL,
  advance_amount      INTEGER NOT NULL DEFAULT 0,   -- COD orders: the part to pay online up front (0 = none)
  amount_paid         INTEGER NOT NULL DEFAULT 0,   -- money confirmed received so far
  quote_token         TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  tracking_carrier    TEXT NOT NULL DEFAULT '',
  tracking_number     TEXT NOT NULL DEFAULT '',
  tracking_url        TEXT NOT NULL DEFAULT '',
  pack_photo          TEXT NOT NULL DEFAULT '',     -- photo of the packed items, shown to the customer
  is_demo             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  -- Added with studio fitting. Databases made before then get these four from the migration step
  -- in db/index.js, which also creates idx_orders_studio (an index here would fail on an old table).
  fulfilment          TEXT NOT NULL DEFAULT 'delivery' CHECK (fulfilment IN ('delivery','pickup','studio')),
  studio_date         TEXT NOT NULL DEFAULT '',     -- 'YYYY-MM-DD' in India, studio orders only
  studio_slot         TEXT NOT NULL DEFAULT '',     -- 'HH:MM' start of the fitting slot, studio orders only
  fitting_total       INTEGER NOT NULL DEFAULT 0    -- studio fitting charges in the total (rupees, GST inclusive at 18%)
);
-- Pickup and studio orders keep the ship_* columns as '' when no address was given.
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id   INTEGER,
  slug         TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL,
  variant_name TEXT NOT NULL DEFAULT '',
  sku          TEXT NOT NULL DEFAULT '',
  image        TEXT NOT NULL DEFAULT '',
  price        INTEGER NOT NULL,                    -- unit price charged
  mrp          INTEGER NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  gst_rate     INTEGER NOT NULL DEFAULT 18,
  hsn_code     TEXT NOT NULL DEFAULT '',
  custom       TEXT,                                -- JSON: designer output for customised products
  -- Added with studio fitting (the migration step adds them to older databases).
  fit_at_studio   INTEGER NOT NULL DEFAULT 0,       -- 1 = Addon fits this line at the studio
  fitting_charge  INTEGER NOT NULL DEFAULT 0,       -- fitting charge for the whole line (service charge x qty)
  fitting_service TEXT NOT NULL DEFAULT ''          -- name of the fitting service charged
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  actor      TEXT NOT NULL DEFAULT 'system' CHECK (actor IN ('system','customer','admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);

-- ---------------------------------------------------------------------------
-- Studio fitting diary
-- ---------------------------------------------------------------------------
-- One car in one studio slot: a fitting service booked on its own, or the fitting of a studio
-- order (order_number set). Active bookings (requested, confirmed, in_progress, completed) count
-- against settings.studio.carsPerSlot. Service details are a snapshot taken when it was booked.
CREATE TABLE IF NOT EXISTS bookings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_number      TEXT NOT NULL UNIQUE,         -- e.g. ADN-B-000123, in sequence
  service_id          TEXT NOT NULL DEFAULT '',     -- settings.services[].id ('order' for a studio order)
  service_name        TEXT NOT NULL DEFAULT '',
  service_charge      INTEGER NOT NULL DEFAULT 0,   -- rupees, GST inclusive
  service_minutes     INTEGER NOT NULL DEFAULT 0,
  date                TEXT NOT NULL,                -- 'YYYY-MM-DD' in India
  slot                TEXT NOT NULL,                -- 'HH:MM' start time in India
  name                TEXT NOT NULL,
  phone               TEXT NOT NULL,                -- 10 digits
  email               TEXT NOT NULL DEFAULT '',
  vehicle             TEXT NOT NULL DEFAULT '',     -- label, e.g. 'Honda City (2020 onwards)'
  vehicle_id          INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  registration_number TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',     -- from the customer
  admin_note          TEXT NOT NULL DEFAULT '',     -- from the studio, never shown to the customer
  order_number        TEXT NOT NULL DEFAULT '',     -- set when the booking comes from a studio order
  status              TEXT NOT NULL DEFAULT 'requested' CHECK (status IN
                        ('requested','confirmed','in_progress','completed','cancelled','no_show')),
  is_demo             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(date, slot, status);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_order ON bookings(order_number);

-- Razorpay webhook deliveries already handled (they arrive at least once, sometimes twice).
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id   TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- A shopper who reached checkout and gave a phone number but has not ordered yet.
CREATE TABLE IF NOT EXISTS checkout_leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token        TEXT NOT NULL UNIQUE,                -- kept by the browser so the lead is updated, not duplicated
  name         TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL,
  email        TEXT NOT NULL DEFAULT '',
  cart         TEXT NOT NULL DEFAULT '[]',          -- JSON snapshot of priced lines
  cart_total   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contacted','recovered','dismissed')),
  order_number TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- A kit someone saved from the New Car or Pocket Build planners (a dated sales lead).
CREATE TABLE IF NOT EXISTS saved_kits (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  vehicle_label TEXT NOT NULL DEFAULT '',
  goal          TEXT NOT NULL DEFAULT '',
  budget        INTEGER NOT NULL DEFAULT 0,
  dealer_quote  INTEGER NOT NULL DEFAULT 0,
  delivery_date TEXT NOT NULL DEFAULT '',           -- ISO date the buyer's new car arrives, if given
  product_ids   TEXT NOT NULL DEFAULT '[]',         -- JSON number[]
  total         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contacted','ordered','dismissed')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Build Bay builds: a dressed car plus the parts on it. Approved ones show in the gallery.
CREATE TABLE IF NOT EXISTS builds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  author_name   TEXT NOT NULL DEFAULT '',
  vehicle_label TEXT NOT NULL DEFAULT '',
  state         TEXT NOT NULL,                      -- JSON BuildState
  product_ids   TEXT NOT NULL DEFAULT '[]',         -- JSON number[]
  status        TEXT NOT NULL DEFAULT 'private' CHECK (status IN ('private','pending','approved','rejected')),
  is_house      INTEGER NOT NULL DEFAULT 0,         -- built by the shop
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ---------------------------------------------------------------------------
-- Inbound messages and signals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- Contact form messages and complaints. Each gets a ticket number the customer can quote.
CREATE TABLE IF NOT EXISTS enquiries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,               -- e.g. ADN-T-000123
  kind          TEXT NOT NULL DEFAULT 'contact' CHECK (kind IN ('contact','complaint','bulk','install','return')),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  subject       TEXT NOT NULL DEFAULT '',
  message       TEXT NOT NULL,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  order_number  TEXT NOT NULL DEFAULT '',
  vehicle       TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','resolved')),
  admin_note    TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- "Tell me when it is back" requests for out-of-stock products.
CREATE TABLE IF NOT EXISTS stock_alerts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER,
  phone      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','notified')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id, status);

-- Every storefront search, so the owner can see what shoppers want and cannot find.
CREATE TABLE IF NOT EXISTS search_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  query        TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  vehicle_id   INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_search_log_query ON search_log(query);
