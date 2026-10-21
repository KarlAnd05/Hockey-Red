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
  payment_method        TEXT NOT NULL DEFAULT 'card',
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

/* Editable page copy. One row per heading/paragraph/list item on a public page.
   default_value mirrors what the .html file itself says; value is the
   federation's edit and is what visitors see. Keeping both means a rebuild can
   change the source without silently discarding someone's rewrite. See
   server/lib/content.js for how keys are formed and applied. */
CREATE TABLE IF NOT EXISTS content_blocks (
  key           TEXT PRIMARY KEY,
  page          TEXT NOT NULL,
  tag           TEXT NOT NULL,
  nth           INTEGER NOT NULL DEFAULT 1,
  label         TEXT NOT NULL DEFAULT '',
  default_value TEXT NOT NULL DEFAULT '',
  value         TEXT,
  orphaned      INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_blocks_page ON content_blocks(page);

/* Donations. Deliberately NOT the orders table: a gift has no cart, no stock to
   decrement, no shipping address and no order number, markOrderPaid would clear
   the donor's live shopping cart, and invoices.order_id is UNIQUE so a monthly
   gift could never have one receipt per cycle. Monthly giving also needs states
   an order has no concept of. */
CREATE TABLE IF NOT EXISTS donations (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  kind                   TEXT NOT NULL DEFAULT 'one_time'
                           CHECK (kind IN ('one_time', 'monthly')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'paid', 'active', 'past_due', 'canceled', 'failed')),
  email                  TEXT NOT NULL DEFAULT '',
  name                   TEXT NOT NULL DEFAULT '',
  message                TEXT NOT NULL DEFAULT '',
  amount_cents           INTEGER NOT NULL DEFAULT 0,
  fee_cents              INTEGER NOT NULL DEFAULT 0,
  total_cents            INTEGER NOT NULL DEFAULT 0,
  currency               TEXT NOT NULL DEFAULT 'cad',
  stripe_session_id      TEXT,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  manage_token_hash      TEXT,
  display_publicly       INTEGER NOT NULL DEFAULT 0,
  public_name            TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at                TEXT,
  canceled_at            TEXT
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_session ON donations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_donations_subscription ON donations(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_donations_manage ON donations(manage_token_hash);

/* One row per actual charge. A monthly gift produces an invoice.paid every cycle
   and Stripe redelivers webhooks, so the UNIQUE on the invoice id is what turns a
   replay into a harmless no-op instead of a double count. Do not drop it. */
CREATE TABLE IF NOT EXISTS donation_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id       INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'cad',
  status            TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'failed')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_donation_payments_donation ON donation_payments(donation_id);

/* Small key/value store for state that must survive a restart but does not earn a
   table: currently the Stripe Product id reused for every monthly gift, so the
   dashboard does not accumulate one Product per subscriber. */
CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* charge.refunded looks orders up by this column; it had no index. */
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(stripe_payment_intent);

/* News posts. Previously three hand-written cards in news.html; now data so the
   federation can publish without a code change. Each post has its own page at
   /news/<slug> so a shared link previews with its own title and photo instead of
   the generic newsroom. The share_* columns are filled in by the admin and only
   the ones actually set are offered in the share menu. */
CREATE TABLE IF NOT EXISTS news_posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT '',
  excerpt         TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  image_url       TEXT NOT NULL DEFAULT '',
  image_alt       TEXT NOT NULL DEFAULT '',
  author          TEXT NOT NULL DEFAULT '',
  contact_email   TEXT NOT NULL DEFAULT '',
  contact_phone   TEXT NOT NULL DEFAULT '',
  share_facebook  TEXT NOT NULL DEFAULT '',
  share_instagram TEXT NOT NULL DEFAULT '',
  share_x         TEXT NOT NULL DEFAULT '',
  published_at    TEXT NOT NULL DEFAULT (datetime('now')),
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_posts_active ON news_posts(active, published_at);

/* Visitor chat.
   A thread is identified by a token the visitor's browser keeps, NOT by the
   lh_sid session: loginSession rotates that token and deletes the old row, and
   purgeExpiredSessions drops it at 30 days - either would strand a conversation
   mid-sentence. Only the hash is stored here; the raw token lives in the
   visitor's localStorage and nowhere else, exactly like a session token.
   notified_at exists so a visitor typing five short lines does not send five
   separate emails. */
CREATE TABLE IF NOT EXISTS chat_threads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash      TEXT NOT NULL UNIQUE,
  visitor_name    TEXT NOT NULL DEFAULT '',
  visitor_email   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'blocked')),
  last_message_at TEXT,
  notified_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_activity ON chat_threads(status, last_message_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, id);

/* Membership registrations - the LIHF player form.
   This is the most sensitive collection on the site: passport-form names, date
   of birth, and both parents' citizenships, submitted in part by or for minors.
   It is admin-only, never logged, and described in privacy.html. The parental
   citizenship fields exist because IIHF eligibility turns on them, and the form
   says so rather than asking without explanation.
   Payment state is tracked separately from the submission: a registration is a
   real record whether or not the fee has been paid yet. */
CREATE TABLE IF NOT EXISTS registrations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  tier                  TEXT NOT NULL CHECK (tier IN ('board', 'player', 'supporter')),
  amount_cents          INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'cad',
  payment_status        TEXT NOT NULL DEFAULT 'unpaid'
                          CHECK (payment_status IN ('unpaid', 'pending', 'paid')),
  stripe_session_id     TEXT,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL DEFAULT '',
  first_name            TEXT NOT NULL DEFAULT '',
  last_name             TEXT NOT NULL DEFAULT '',
  middle_name           TEXT NOT NULL DEFAULT '',
  date_of_birth         TEXT NOT NULL DEFAULT '',
  position              TEXT NOT NULL DEFAULT '',
  shoots                TEXT NOT NULL DEFAULT '',
  height_cm             INTEGER,
  weight_kg             INTEGER,
  place_of_birth        TEXT NOT NULL DEFAULT '',
  country_of_birth      TEXT NOT NULL DEFAULT '',
  city_of_residence     TEXT NOT NULL DEFAULT '',
  citizenship           TEXT NOT NULL DEFAULT '',
  citizenship_second    TEXT NOT NULL DEFAULT '',
  citizenship_father    TEXT NOT NULL DEFAULT '',
  citizenship_mother    TEXT NOT NULL DEFAULT '',
  highest_level_played  TEXT NOT NULL DEFAULT '',
  message               TEXT NOT NULL DEFAULT '',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at               TEXT
);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_registrations_session ON registrations(stripe_session_id);

/* Team rosters.
   program keeps the men's and women's lists apart: the live site has a women's
   roster and no men's one, so the men's page must render an empty state rather
   than an empty table. jersey_number is nullable on purpose - the federation's
   own roster shows a dash for players without one. */
CREATE TABLE IF NOT EXISTS roster_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  program       TEXT NOT NULL CHECK (program IN ('mens', 'womens')),
  team          TEXT NOT NULL DEFAULT 'national' CHECK (team IN ('national', 'next_gen')),
  position      TEXT NOT NULL CHECK (position IN ('forward', 'defence', 'goaltender')),
  jersey_number INTEGER,
  name          TEXT NOT NULL,
  recent_team   TEXT NOT NULL DEFAULT '',
  resides       TEXT NOT NULL DEFAULT '',
  hometown      TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_roster_lookup ON roster_players(program, team, position, sort_order);

/* Shipping zones.
   Shipping used to be one flat fee for everyone. It is now worked out from where
   the parcel is going: a zone carries a base fee, an optional per-item fee, an
   optional free-over threshold, and a delivery estimate, and each zone covers
   many countries.

   The country list is the lookup key, so a country nobody has mapped yet must
   land on the default zone rather than falling through to zero - a silent free
   shipment to the other side of the world is the failure mode worth designing
   against. See server/lib/shipping.js. */
CREATE TABLE IF NOT EXISTS shipping_zones (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  flat_cents        INTEGER NOT NULL DEFAULT 0,
  per_item_cents    INTEGER NOT NULL DEFAULT 0,
  free_over_cents   INTEGER NOT NULL DEFAULT 0,
  delivery_min_days INTEGER NOT NULL DEFAULT 14,
  delivery_max_days INTEGER NOT NULL DEFAULT 21,
  is_default        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shipping_zone_countries (
  zone_id      INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  PRIMARY KEY (zone_id, country_code)
);
CREATE INDEX IF NOT EXISTS idx_zone_countries_code ON shipping_zone_countries(country_code);

/* Teams and players.

   roster_players already holds the women's squads, but it keys everything to a
   program string and has nowhere to put a photo or a biography. Our Teams needs
   a real team record, and a player people can click through to.

   The four teams are the federation's four programmes. The national-team and
   next-generation split inside the women's programme is kept as a squad on the
   PLAYER, not as two more teams, because it is a grouping within one programme
   and the site is specified as having four teams.

   active is how a name comes off the public site. Several players are minors
   and a parent can ask for a name to be removed; hiding has to be one toggle
   that works everywhere, which is why the public queries all filter on it
   rather than each page deciding for itself. */
CREATE TABLE IF NOT EXISTS teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  photo_url   TEXT NOT NULL DEFAULT '',
  photo_alt   TEXT NOT NULL DEFAULT '',
  staff       TEXT NOT NULL DEFAULT '',
  honours     TEXT NOT NULL DEFAULT '',
  program     TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  squad         TEXT NOT NULL DEFAULT '',
  position      TEXT NOT NULL DEFAULT 'forward'
                CHECK (position IN ('forward', 'defence', 'goaltender', 'staff')),
  jersey_number INTEGER,
  photo_url     TEXT NOT NULL DEFAULT '',
  photo_alt     TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  recent_team   TEXT NOT NULL DEFAULT '',
  resides       TEXT NOT NULL DEFAULT '',
  hometown      TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id, squad, position, sort_order);

/* Game sheets.

   The federation's own field list is still to come, so this is the spine: a
   game, and the people on it. The structure is deliberately additive - new
   columns can be added to game_sheet_players later without reshaping anything,
   which is the point of keeping one row per person rather than a blob per game.

   A sheet line points at BOTH a player and a registration, and both are
   nullable:
     - player_id is the roster entry, which is what the public site shows.
     - registration_id is the membership record, which carries date of birth,
       citizenship and the rest of the paperwork a game sheet actually needs.
   Most lines will have both. A guest who has registered but is not on a roster
   has only the second; a roster player who has not filled the form in yet has
   only the first. Requiring either one would make a real case unenterable.

   ON DELETE SET NULL rather than CASCADE: deleting a player should not silently
   erase the record that they played in a game. */
CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  opponent    TEXT NOT NULL DEFAULT '',
  played_at   TEXT NOT NULL DEFAULT '',
  venue       TEXT NOT NULL DEFAULT '',
  competition TEXT NOT NULL DEFAULT '',
  home_away   TEXT NOT NULL DEFAULT 'home' CHECK (home_away IN ('home', 'away', 'neutral')),
  score_for   INTEGER,
  score_against INTEGER,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'final', 'cancelled')),
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(played_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS game_sheet_players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
  registration_id INTEGER REFERENCES registrations(id) ON DELETE SET NULL,
  name            TEXT NOT NULL DEFAULT '',
  jersey_number   INTEGER,
  position        TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'player'
                    CHECK (role IN ('player', 'captain', 'alternate', 'starting_goaltender', 'staff')),
  note            TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (game_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_sheet_game ON game_sheet_players(game_id, sort_order);

/* ==========================================================================
   Sponsors
   --------------------------------------------------------------------------
   Four partner cards were hardcoded in sponsors.html, which meant a new
   sponsor was a code change. tier_rank is what makes the page sort itself:
   the federation's own order is Platinum, Gold, Silver, Bronze, and a sponsor
   should move up by changing their tier, not by being re-sorted by hand.
   ========================================================================== */
CREATE TABLE IF NOT EXISTS sponsors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  tier        TEXT NOT NULL DEFAULT 'bronze'
                CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze', 'partner')),
  blurb       TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  logo_url    TEXT NOT NULL DEFAULT '',
  logo_alt    TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsors_tier ON sponsors(active, tier, sort_order);

/* Programs and schedule.

   The federation has not supplied its content model for this yet, so the table
   is deliberately small: enough to publish a camp, a session or a tournament
   with a date and a place, and nothing invented beyond that. Extra columns can
   be added later through the migration step without reshaping anything.

   starts_at and ends_at are plain ISO date strings, not timestamps. A camp runs
   on a day, not at an instant, and storing an instant would drag timezone
   handling into a page that does not need it. */
CREATE TABLE IF NOT EXISTS programs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id     INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'program',
  starts_at   TEXT NOT NULL DEFAULT '',
  ends_at     TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  link_url    TEXT NOT NULL DEFAULT '',
  link_label  TEXT NOT NULL DEFAULT '',
  active      INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_programs_date ON programs(active, starts_at);
`);

/* ==========================================================================
   Column migrations
   --------------------------------------------------------------------------
   Everything above is CREATE TABLE IF NOT EXISTS, which brings a brand new
   database fully up to date but does nothing to a database that already
   exists. Adding a column to a live table therefore needs an explicit step.

   This is not a migration framework and should not grow into one; it is the
   narrow case of "add a nullable or defaulted column", which SQLite does
   cheaply and which cannot lose data. Anything beyond that - renaming,
   dropping, changing a constraint - needs a real plan, not another line here.

   Table and column names are interpolated because SQLite cannot bind
   identifiers. Every call below passes a hardcoded literal; none of this is
   ever reachable from a request.
   ========================================================================== */
function addColumnIfMissing(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (existing.some((c) => c.name === column)) return false;

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

/* The donations leaderboard. Default 0 so every gift already in the database
   stays private: consent has to be given, never assumed. */
addColumnIfMissing('donations', 'display_publicly', "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing('donations', 'public_name', "TEXT NOT NULL DEFAULT ''");

/* Interac e-Transfer. Every order that already exists was paid by card, which
   is exactly what the default says. */
addColumnIfMissing('orders', 'payment_method', "TEXT NOT NULL DEFAULT 'card'");

/* The programme pages were merged into Our Teams, so a team row now has to
   carry what those pages carried: who coaches it, and what it has won. Both
   are one entry per line ("Name - Role", "Year - Result") rather than two more
   tables, because they are short lists displayed verbatim and nothing queries
   inside them. */
addColumnIfMissing('teams', 'staff', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('teams', 'honours', "TEXT NOT NULL DEFAULT ''");

/* Player statistics.

   These live on the GAME SHEET LINE, not on the player, so a number is
   recorded once in the place it happened and every total is derived from it.
   Putting season totals on the player instead would mean two sources that can
   disagree, and nothing to point at when they do.

   Goaltenders need different columns from skaters, so both sets are here and
   the profile shows whichever fits the player's position. A skater with saves
   recorded is not an error, just unusual - the schema does not police it.

   prior_* on players is for history from BEFORE this system existed: the
   federation has results going back years that were never entered as sheets,
   and losing them to a clean data model would be a poor trade. */
addColumnIfMissing('game_sheet_players', 'goals', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('game_sheet_players', 'assists', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('game_sheet_players', 'penalty_minutes', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('game_sheet_players', 'shots_against', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('game_sheet_players', 'saves', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('game_sheet_players', 'decision', "TEXT NOT NULL DEFAULT ''");
addColumnIfMissing('game_sheet_players', 'played', 'INTEGER NOT NULL DEFAULT 1');

addColumnIfMissing('players', 'prior_games', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('players', 'prior_goals', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('players', 'prior_assists', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('players', 'prior_note', "TEXT NOT NULL DEFAULT ''");

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


/* ==========================================================================
   Seed - the three posts that were hard-coded in news.html
   --------------------------------------------------------------------------
   Contact details come from the federation's live site, where they are already
   published. Nothing here is invented.
   ========================================================================== */
const SEED_NEWS = [
  {
    slug: 'ricardo-tabet-named-mens-gm',
    title: "Ricardo Tabet Named Men's GM",
    category: 'Management',
    excerpt:
      "Ricardo Tabet has joined the federation as General Manager of the Men's National Team.",
    body:
      "Ricardo Tabet has joined the federation as General Manager of the Men's National Team, bringing his background as a former player and team captain to the role.",
    author: 'Lebanese Ice Hockey Federation',
    contact_email: 'ricardo.tabet@lebanonhockey.com',
    contact_phone: '+1 514-575-4419',
    published_at: '2023-03-13',
    sort_order: 1,
  },
  {
    slug: 'jocelyn-trepanier-joins-womens-program',
    title: "Jocelyn Trépanier Joins Women's Program",
    category: 'Coaching',
    excerpt:
      "Appointed General Manager and Co-Head Coach of the Women's National Team.",
    body:
      "Jocelyn Trépanier has been appointed General Manager and Co-Head Coach of the Women's National Team, bringing a decade of competitive minor hockey management experience.\n\nHis expertise and passion for the sport will contribute to the continued growth of the Women's National Team program.",
    author: 'Charles El-Mir',
    contact_email: 'jocelyn.trepanier@lebanonhockey.com',
    contact_phone: '+1 613-724-7680',
    published_at: '2025-06-23',
    sort_order: 2,
  },
  {
    slug: 'gregg-kennedy-named-mens-head-coach',
    title: "Gregg Kennedy Named Men's Head Coach",
    category: 'Coaching',
    excerpt:
      "Gregg Kennedy takes on Head Coach and development coordinator for the Men's National Team.",
    body:
      "Gregg Kennedy has taken on the role of Head Coach and development coordinator for the Men's National Team, drawing on roughly three decades of coaching and player development experience.",
    author: 'Lebanese Ice Hockey Federation',
    contact_email: 'gregg.kennedy@lebanonhockey.com',
    contact_phone: '+1 613-612-9499',
    published_at: '2022-09-12',
    sort_order: 3,
  },
];

export function seedNews() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM news_posts').get().n;
  if (count > 0) return false;

  const insert = db.prepare(`
    INSERT INTO news_posts
      (slug, title, category, excerpt, body, author, contact_email, contact_phone, published_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const post of SEED_NEWS) {
    insert.run(
      post.slug, post.title, post.category, post.excerpt, post.body,
      post.author, post.contact_email, post.contact_phone, post.published_at, post.sort_order
    );
  }

  return SEED_NEWS.length;
}
