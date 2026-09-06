import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(here, '..');
const dataDir = join(rootDir, 'data');

mkdirSync(dataDir, { recursive: true });
mkdirSync(join(rootDir, 'invoices'), { recursive: true });

export const db = new DatabaseSync(process.env.DB_PATH || join(dataDir, 'store.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/* ==========================================================================
   Schema
   ========================================================================== */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  image_url   TEXT NOT NULL DEFAULT '',
  stock       INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  featured    INTEGER NOT NULL DEFAULT 0,
  badge       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  stock             INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS carts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_hash);

CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id    INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);

CREATE TABLE IF NOT EXISTS discounts (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE,
  type               TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value              INTEGER NOT NULL CHECK (value > 0),
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  starts_at          TEXT,
  ends_at            TEXT,
  max_redemptions    INTEGER NOT NULL DEFAULT 0,
  times_redeemed     INTEGER NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number          TEXT NOT NULL UNIQUE,
  user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded')),
  subtotal_cents        INTEGER NOT NULL DEFAULT 0,
  discount_cents        INTEGER NOT NULL DEFAULT 0,
  shipping_cents        INTEGER NOT NULL DEFAULT 0,
  tax_cents             INTEGER NOT NULL DEFAULT 0,
  total_cents           INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'cad',
  discount_code         TEXT NOT NULL DEFAULT '',
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  ship_name             TEXT NOT NULL DEFAULT '',
  ship_line1            TEXT NOT NULL DEFAULT '',
  ship_line2            TEXT NOT NULL DEFAULT '',
  ship_city             TEXT NOT NULL DEFAULT '',
  ship_region           TEXT NOT NULL DEFAULT '',
  ship_postal           TEXT NOT NULL DEFAULT '',
  ship_country          TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at               TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id       INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  name_snapshot    TEXT NOT NULL,
  variant_snapshot TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  issued_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name  TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

CREATE TABLE IF NOT EXISTS email_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_address TEXT NOT NULL,
  subject    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT '',
  order_id   INTEGER,
  status     TEXT NOT NULL CHECK (status IN ('sent', 'logged', 'failed')),
  error      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_log_order ON email_log(order_id);
`);

/* ==========================================================================
   Seed - the real catalogue that was hardcoded in shop.html
   ========================================================================== */
const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const SEED_CATEGORIES = [
  { slug: 'jerseys', name: 'Jerseys', sort_order: 1 },
  { slug: 'apparel', name: 'Apparel', sort_order: 2 },
  { slug: 'headwear', name: 'Headwear', sort_order: 3 },
  { slug: 'collectibles', name: 'Collectibles', sort_order: 4 },
];

const SEED_PRODUCTS = [
  {
    slug: 'official-team-lebanon-hockey-jersey',
    name: 'Official Team Lebanon Hockey Jersey',
    description:
      'Custom-made game jersey in the national team colourway, with personalization options for name and number.',
    price_cents: 38500,
    category: 'jerseys',
    stock: 40,
    featured: 1,
    badge: 'Signature',
    sizes: APPAREL_SIZES,
  },
  {
    slug: 'official-team-lebanon-jacket',
    name: 'Official Team Lebanon Jacket',
    description: 'Team outerwear built for the rink and everywhere after it.',
    price_cents: 18000,
    category: 'apparel',
    stock: 35,
    featured: 1,
    sizes: APPAREL_SIZES,
  },
  {
    slug: 'crewneck-sweatshirt',
    name: 'Crewneck Sweatshirt',
    description: 'Official Team Lebanon pullover crewneck in heavyweight cotton blend.',
    price_cents: 7000,
    category: 'apparel',
    stock: 60,
    sizes: APPAREL_SIZES,
  },
  {
    slug: 't-shirt',
    name: 'T-Shirt',
    description: 'Casual everyday team wear with the federation crest.',
    price_cents: 3500,
    category: 'apparel',
    stock: 90,
    featured: 1,
    badge: 'New',
    sizes: APPAREL_SIZES,
  },
  {
    slug: 'polo',
    name: 'Polo',
    description: 'Team-branded polo shirt for staff, officials, and supporters.',
    price_cents: 5000,
    category: 'apparel',
    stock: 50,
    sizes: APPAREL_SIZES,
  },
  {
    slug: 'cap',
    name: 'Cap',
    description: 'Official Team Lebanon baseball-style cap with adjustable strap.',
    price_cents: 4800,
    category: 'headwear',
    stock: 70,
    sizes: [],
  },
  {
    slug: 'scarf',
    name: 'Scarf',
    description: 'Team-branded supporter scarf for game day.',
    price_cents: 3000,
    category: 'apparel',
    stock: 55,
    sizes: [],
  },
  {
    slug: 'cedar-trophy',
    name: 'Cedar Trophy',
    description: 'Official LIHF commemorative trophy piece.',
    price_cents: 4000,
    category: 'collectibles',
    stock: 25,
    sizes: [],
  },
  {
    slug: 'puck-with-holder',
    name: 'Puck with Holder',
    description: 'Collectible hockey puck with a display stand.',
    price_cents: 3000,
    category: 'collectibles',
    stock: 80,
    sizes: [],
  },
  {
    slug: 'lihf-pucks',
    name: 'LIHF Pucks',
    description: 'Official Lebanese Ice Hockey Federation pucks.',
    price_cents: 2500,
    category: 'collectibles',
    stock: 120,
    sizes: [],
  },
  {
    slug: 'official-lebanon-hockey-pin',
    name: 'Official Lebanon Hockey Pin',
    description: 'Collectible enamel pin with the cedar crest.',
    price_cents: 1500,
    category: 'collectibles',
    stock: 200,
    sizes: [],
  },
];

export function seedCatalogue() {
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (productCount > 0) return false;

  const insertCategory = db.prepare(
    'INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)'
  );
  const insertProduct = db.prepare(`
    INSERT INTO products
      (slug, name, description, price_cents, category_id, image_url, stock, active, featured, badge, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);
  const insertVariant = db.prepare(
    'INSERT INTO product_variants (product_id, name, price_delta_cents, stock, sort_order) VALUES (?, ?, 0, ?, ?)'
  );

  SEED_CATEGORIES.forEach((category) => {
    insertCategory.run(category.slug, category.name, category.sort_order);
  });

  const categoryIds = new Map(
    db.prepare('SELECT id, slug FROM categories').all().map((row) => [row.slug, row.id])
  );

  SEED_PRODUCTS.forEach((product, index) => {
    const result = insertProduct.run(
      product.slug,
      product.name,
      product.description,
      product.price_cents,
      categoryIds.get(product.category) ?? null,
      // Branded SVG placeholder until real product photography is supplied;
      // an admin can point this at any image path.
      `/api/placeholder/${product.slug}.svg`,
      product.stock,
      product.featured ?? 0,
      product.badge ?? '',
      index
    );

    const productId = Number(result.lastInsertRowid);
    product.sizes.forEach((size, i) => {
      insertVariant.run(productId, size, Math.ceil(product.stock / product.sizes.length), i);
    });
  });

  return true;
}

export function seedDiscounts() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM discounts').get().n;
  if (count > 0) return false;

  db.prepare(`
    INSERT INTO discounts (code, type, value, min_subtotal_cents, max_redemptions, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run('CEDAR10', 'percent', 10, 5000, 0);

  return true;
}
