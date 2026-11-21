-- Lebanon Hockey database schema
-- Snapshot: 2026-11-19
-- Generated from server/db.js using an isolated in-memory SQLite database.
-- Includes additive migrations and the game-slug index from backfillGameSlugs().
-- Structure only: no user records, seeds, credentials, or environment values.
-- Runtime bootstrapping remains authoritative; this file is a documentation snapshot.

PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
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

CREATE TABLE product_variants (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  stock             INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE carts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_hash TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id    INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE TABLE discounts (
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

CREATE TABLE orders (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number          TEXT NOT NULL UNIQUE,
  user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cart_id               INTEGER REFERENCES carts(id) ON DELETE SET NULL,
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
  access_token          TEXT NOT NULL DEFAULT '',
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

CREATE TABLE order_items (
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

CREATE TABLE invoices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  issued_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL DEFAULT '',
  last_name  TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE email_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_address TEXT NOT NULL,
  subject    TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT '',
  order_id   INTEGER,
  status     TEXT NOT NULL CHECK (status IN ('sent', 'logged', 'failed')),
  error      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_blocks (
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

CREATE TABLE donations (
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

CREATE TABLE donation_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  donation_id       INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'cad',
  status            TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'failed')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE news_posts (
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

CREATE TABLE chat_threads (
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

CREATE TABLE chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
  body       TEXT NOT NULL,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE registrations (
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

CREATE TABLE roster_players (
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

CREATE TABLE shipping_zones (
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

CREATE TABLE shipping_zone_countries (
  zone_id      INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  PRIMARY KEY (zone_id, country_code)
);

CREATE TABLE teams (
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
, gallery TEXT NOT NULL DEFAULT '');

CREATE TABLE players (
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
, prior_games INTEGER NOT NULL DEFAULT 0, prior_goals INTEGER NOT NULL DEFAULT 0, prior_assists INTEGER NOT NULL DEFAULT 0, prior_note TEXT NOT NULL DEFAULT '');

CREATE TABLE games (
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
, slug TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 0, events_mode INTEGER NOT NULL DEFAULT 0, opponent_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL, event_name TEXT NOT NULL DEFAULT '', game_number TEXT NOT NULL DEFAULT '', start_time TEXT NOT NULL DEFAULT '', end_time TEXT NOT NULL DEFAULT '', spectators INTEGER, team_colour TEXT NOT NULL DEFAULT '', opponent_colour TEXT NOT NULL DEFAULT '', team_staff TEXT NOT NULL DEFAULT '', opponent_staff TEXT NOT NULL DEFAULT '', officials TEXT NOT NULL DEFAULT '', clock_counts TEXT NOT NULL DEFAULT 'down');

CREATE TABLE game_sheet_players (
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
  sort_order      INTEGER NOT NULL DEFAULT 0, goals INTEGER NOT NULL DEFAULT 0, assists INTEGER NOT NULL DEFAULT 0, penalty_minutes INTEGER NOT NULL DEFAULT 0, shots_against INTEGER NOT NULL DEFAULT 0, saves INTEGER NOT NULL DEFAULT 0, decision TEXT NOT NULL DEFAULT '', played INTEGER NOT NULL DEFAULT 1, side TEXT NOT NULL DEFAULT 'us', line_number INTEGER, best_player INTEGER NOT NULL DEFAULT 0, minutes_in_play INTEGER NOT NULL DEFAULT 0,
  UNIQUE (game_id, player_id)
);

CREATE TABLE game_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('goal', 'penalty')),
  side            TEXT NOT NULL DEFAULT 'us' CHECK (side IN ('us', 'them')),
  period          TEXT NOT NULL DEFAULT '1'
                    CHECK (period IN ('1', '2', '3', 'OVT', 'GWS')),
  time_mmss       TEXT NOT NULL DEFAULT '',

  /* Goals. */
  scorer_line_id  INTEGER REFERENCES game_sheet_players(id) ON DELETE SET NULL,
  assist1_line_id INTEGER REFERENCES game_sheet_players(id) ON DELETE SET NULL,
  assist2_line_id INTEGER REFERENCES game_sheet_players(id) ON DELETE SET NULL,
  game_situation  TEXT NOT NULL DEFAULT 'EQ'
                    CHECK (game_situation IN ('EQ', '+1', '+2', '-1', '-2', 'PS', 'EN')),

  /* Penalties. 0 minutes is a penalty shot, which the sheet records as a
     penalty with no time served. */
  penalty_line_id INTEGER REFERENCES game_sheet_players(id) ON DELETE SET NULL,
  minutes         INTEGER NOT NULL DEFAULT 0 CHECK (minutes IN (0, 2, 5, 10, 20)),
  offence_code    TEXT NOT NULL DEFAULT '',
  start_mmss      TEXT NOT NULL DEFAULT '',
  end_mmss        TEXT NOT NULL DEFAULT '',

  /* An opponent with no squad on this site, or anyone not yet matched up. */
  jersey_number   INTEGER,
  name            TEXT NOT NULL DEFAULT '',

  /* Idempotency for the live screen's retry queue: a replayed POST that
     already landed returns the row it made instead of a second goal. */
  client_id       TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE game_goalies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  side          TEXT NOT NULL DEFAULT 'us' CHECK (side IN ('us', 'them')),
  period        TEXT NOT NULL DEFAULT '1'
                  CHECK (period IN ('1', '2', '3', 'OVT', 'GWS')),
  sheet_line_id INTEGER REFERENCES game_sheet_players(id) ON DELETE SET NULL,
  jersey_number INTEGER,
  name          TEXT NOT NULL DEFAULT '',
  minutes       INTEGER NOT NULL DEFAULT 0,
  saves         INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sponsors (
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

CREATE TABLE programs (
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

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE INDEX idx_products_category ON products(category_id);

CREATE INDEX idx_variants_product ON product_variants(product_id);

CREATE INDEX idx_carts_user ON carts(user_id);

CREATE INDEX idx_carts_session ON carts(session_hash);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

CREATE INDEX idx_orders_user ON orders(user_id);

CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_orders_session ON orders(stripe_session_id);

CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE INDEX idx_resets_user ON password_resets(user_id);

CREATE INDEX idx_email_log_order ON email_log(order_id);

CREATE INDEX idx_content_blocks_page ON content_blocks(page);

CREATE INDEX idx_donations_status ON donations(status);

CREATE INDEX idx_donations_session ON donations(stripe_session_id);

CREATE INDEX idx_donations_subscription ON donations(stripe_subscription_id);

CREATE INDEX idx_donations_manage ON donations(manage_token_hash);

CREATE INDEX idx_donation_payments_donation ON donation_payments(donation_id);

CREATE INDEX idx_orders_payment_intent ON orders(stripe_payment_intent);

CREATE INDEX idx_news_posts_active ON news_posts(active, published_at);

CREATE INDEX idx_chat_threads_activity ON chat_threads(status, last_message_at);

CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id, id);

CREATE INDEX idx_registrations_status ON registrations(payment_status, created_at);

CREATE INDEX idx_registrations_session ON registrations(stripe_session_id);

CREATE INDEX idx_roster_lookup ON roster_players(program, team, position, sort_order);

CREATE INDEX idx_zone_countries_code ON shipping_zone_countries(country_code);

CREATE INDEX idx_players_team ON players(team_id, squad, position, sort_order);

CREATE INDEX idx_games_date ON games(played_at DESC, id DESC);

CREATE INDEX idx_sheet_game ON game_sheet_players(game_id, sort_order);

CREATE INDEX idx_events_game ON game_events(game_id, kind, period, time_mmss);

CREATE INDEX idx_events_scorer ON game_events(scorer_line_id);

CREATE INDEX idx_events_a1 ON game_events(assist1_line_id);

CREATE INDEX idx_events_a2 ON game_events(assist2_line_id);

CREATE INDEX idx_events_pen ON game_events(penalty_line_id);

CREATE UNIQUE INDEX idx_events_client ON game_events(client_id) WHERE client_id <> '';

CREATE INDEX idx_goalies_game ON game_goalies(game_id, side, period);

CREATE INDEX idx_goalies_line ON game_goalies(sheet_line_id);

CREATE INDEX idx_sponsors_tier ON sponsors(active, tier, sort_order);

CREATE INDEX idx_programs_date ON programs(active, starts_at);

CREATE INDEX idx_sheet_player ON game_sheet_players(player_id);

CREATE UNIQUE INDEX idx_games_slug ON games(slug) WHERE slug <> '';
