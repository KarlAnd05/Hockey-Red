/**
 * Editable page copy.
 *
 * Every heading, paragraph and list item on a public page is addressable, so the
 * federation can rewrite its own copy from the admin area without touching code.
 *
 * Why overrides live in the database and are applied when the page is served,
 * rather than written back into the .html files: most of the site is GENERATED
 * by scripts/build-store-pages.mjs and scripts/build-admin-pages.mjs (31 of the
 * 43 pages at the time of writing). Anything
 * written into those files is destroyed by the next `npm run build`. Serving-time
 * injection survives a rebuild, and the generators stay the single source of
 * truth for structure while the database owns the words.
 *
 * Keys are `<page>#<tag><nth-of-that-tag>` -- e.g. `index.html#p4`. Counting per
 * tag rather than globally means adding a heading does not renumber every
 * paragraph after it. Structure changes can still shift keys, which is why the
 * default text is stored alongside the edit: the admin screen shows both, so
 * drift is visible instead of silent.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { db, rootDir } from '../db.js';

/* Block-level text containers only. Deliberately not <span>/<a>/<strong>: those
   sit inside these blocks, and keying both would mean two overlapping edits for
   the same words. A link inside a paragraph is edited as part of the paragraph. */
const TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'li'];
const OPEN_RE = new RegExp(`<(${TAGS.join('|')})(\\s[^>]*)?>`, 'gi');

/** Find the close tag matching an already-opened tag, counting nesting. */
function findClose(html, tag, from) {
  const re = new RegExp(`<(/?)${tag}(\\s[^>]*)?>`, 'gi');
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      depth -= 1;
      if (depth === 0) return m.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

const plain = (s) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Every editable block in document order, with the character range of its inner
 * HTML. Blocks nested inside an already-claimed block are skipped so no two keys
 * can overwrite the same text.
 */
export function scanBlocks(html) {
  const blocks = [];
  const counters = Object.create(null);
  const claimed = [];

  OPEN_RE.lastIndex = 0;
  let m;
  while ((m = OPEN_RE.exec(html))) {
    const tag = m[1].toLowerCase();
    const openStart = m.index;
    const innerStart = m.index + m[0].length;

    if (claimed.some(([s, e]) => openStart > s && openStart < e)) continue;

    const innerEnd = findClose(html, tag, innerStart);
    if (innerEnd === -1) continue;

    const inner = html.slice(innerStart, innerEnd);
    const text = plain(inner);

    /* Empty containers are filled in by the client at runtime (status lines,
       grids, mount points). Offering them for editing would promise a change
       that JavaScript immediately overwrites. */
    if (!text) continue;

    counters[tag] = (counters[tag] || 0) + 1;
    blocks.push({ tag, nth: counters[tag], key: `${tag}${counters[tag]}`, inner, text, innerStart, innerEnd });
    claimed.push([openStart, innerEnd]);
  }

  return blocks;
}

/* --- Stored copy is admin-authored, but still gets fenced ------------------
   An admin account is trusted to write the federation's own words, not to ship
   script into every visitor's browser. Stripping these costs nothing and means
   one compromised admin session cannot turn the public site into a delivery
   mechanism. */
export function sanitise(value) {
  return String(value ?? '')
    .replace(/<\s*(script|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|style)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

/** A short human label for the admin list. */
function labelFor(block) {
  const t = block.text;
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

/**
 * Record what each page currently says. Called at boot for every public page.
 * The visitor-facing edit (`value`) is never touched; only `default_value` and
 * the label follow the source, so an edit survives a rebuild and a reworded
 * default shows up as drift rather than quietly replacing someone's text.
 */
export function syncPage(page, html) {
  const blocks = scanBlocks(html);
  const seen = new Set();

  const upsert = db.prepare(`
    INSERT INTO content_blocks (key, page, tag, nth, label, default_value, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      page = excluded.page,
      tag = excluded.tag,
      nth = excluded.nth,
      label = excluded.label,
      default_value = excluded.default_value,
      sort_order = excluded.sort_order
  `);

  blocks.forEach((b, i) => {
    const key = `${page}#${b.key}`;
    seen.add(key);
    upsert.run(key, page, b.tag, b.nth, labelFor(b), b.inner, i);
  });

  /* A block that no longer exists in the source keeps its row only if someone
     edited it -- otherwise it is noise. An orphaned edit is flagged, not binned:
     the text may be wanted somewhere else. */
  const existing = db.prepare('SELECT key, value FROM content_blocks WHERE page = ?').all(page);
  const drop = db.prepare('DELETE FROM content_blocks WHERE key = ?');
  const orphan = db.prepare('UPDATE content_blocks SET orphaned = 1 WHERE key = ?');
  const unorphan = db.prepare('UPDATE content_blocks SET orphaned = 0 WHERE key = ?');
  let orphaned = 0;

  for (const row of existing) {
    if (seen.has(row.key)) {
      unorphan.run(row.key); // it is back in the page; stop flagging it
    } else if (row.value === null || row.value === '') {
      drop.run(row.key); // never edited, no longer in the page: just noise
    } else {
      orphan.run(row.key); // someone's words, now homeless -- flag, never bin
      orphaned += 1;
    }
  }

  return { blocks: blocks.length, orphaned };
}

/**
 * Walk every public page and record what it says. Called once at boot, so a
 * rebuild or a hand edit shows up in the admin area without a migration step.
 *
 * Only root-level *.html is considered -- exactly the allow-list server/app.js
 * will serve. admin/ is excluded on purpose: the admin shell is a tool, not
 * federation copy, and letting it edit itself invites locking yourself out.
 */
export function syncAllPages() {
  let pages = 0;
  let blocks = 0;
  let orphaned = 0;

  for (const file of readdirSync(rootDir)) {
    if (!/^[A-Za-z0-9_-]+\.html$/.test(file)) continue;
    let html;
    try {
      html = readFileSync(join(rootDir, file), 'utf8');
    } catch {
      continue;
    }
    const result = syncPage(file, html);
    pages += 1;
    blocks += result.blocks;
    orphaned += result.orphaned;
  }

  invalidateContentCache();
  return { pages, blocks, orphaned };
}

/* --- Overrides, cached in process ---------------------------------------- */
let cache = null;

export function invalidateContentCache() {
  cache = null;
}

function overrides() {
  if (cache) return cache;
  cache = new Map();
  const rows = db
    .prepare("SELECT key, value FROM content_blocks WHERE value IS NOT NULL AND value != '' AND orphaned = 0")
    .all();
  for (const r of rows) cache.set(r.key, r.value);
  return cache;
}

/** Swap edited copy into a page on its way out. A page with no edits is untouched. */
export function applyContent(page, html) {
  const map = overrides();
  if (map.size === 0) return html;

  const blocks = scanBlocks(html);
  let out = html;

  /* Back to front, so replacing one block cannot move the next one's offsets. */
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const b = blocks[i];
    const value = map.get(`${page}#${b.key}`);
    if (value == null) continue;
    out = out.slice(0, b.innerStart) + value + out.slice(b.innerEnd);
  }

  return out;
}

export function listContent() {
  return db
    .prepare(
      `SELECT key, page, tag, nth, label, default_value, value, orphaned, updated_at
         FROM content_blocks
        ORDER BY page, sort_order`
    )
    .all();
}

export function setContent(key, value) {
  const row = db.prepare('SELECT key FROM content_blocks WHERE key = ?').get(key);
  if (!row) return { error: 'No such text block.' };

  const clean = value === null ? null : sanitise(value);
  db.prepare("UPDATE content_blocks SET value = ?, updated_at = datetime('now') WHERE key = ?").run(clean, key);
  invalidateContentCache();
  return { ok: true, value: clean };
}

/** Drop the edit and fall back to whatever the page itself says. */
export function resetContent(key) {
  db.prepare("UPDATE content_blocks SET value = NULL, updated_at = datetime('now') WHERE key = ?").run(key);
  invalidateContentCache();
  return { ok: true };
}
