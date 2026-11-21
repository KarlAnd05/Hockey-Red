/**
 * Sections of the public site that can be switched on and off.
 *
 * One row in app_meta per section, absent meaning off. Absent-is-off is what
 * makes the default safe: a deploy never puts a new nav link in front of
 * visitors until somebody turns it on, the same reasoning db.js gives for
 * donations.display_publicly.
 *
 * The nav link is compiled into every page by the build scripts and cannot be
 * rebuilt when somebody flips a switch, so it is marked with data-nav-flag and
 * stripped on the way out instead.
 *
 * Stripping at serve time rather than at build time is also what keeps
 * check-site honest: the link and the page it points at disappear together, so
 * no page is ever left with a dead reference in either state.
 */
import { db } from '../db.js';

const KEY = (name) => `section.${name}`;

/* Cached in process the way content.js caches its overrides: one query on
   first read, thrown away on write. The per-render cost is a Set lookup. */
let cache = null;

export function invalidateSettingsCache() {
  cache = null;
}

function shown() {
  if (cache) return cache;
  cache = new Set(
    db
      .prepare("SELECT key FROM app_meta WHERE key LIKE 'section.%' AND value = '1'")
      .all()
      .map((row) => row.key.slice('section.'.length))
  );
  return cache;
}

/** Is this section public? Unknown sections are off. */
export const isSectionVisible = (name) => shown().has(name);

export function setSectionVisible(name, visible) {
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(KEY(name), visible ? '1' : '0');
  invalidateSettingsCache();
  return isSectionVisible(name);
}

/**
 * Take the nav links of every switched-off section out of a page.
 *
 * Deliberately not folded into applyContent: that returns early when no copy
 * has been edited, so a strip living inside it would never run on a site with
 * no content edits.
 *
 * A regex over the markup is acceptable here for the reason applyContent
 * already scans tags that way - this markup comes from the repo's own build
 * script or its own hand-written pages, the element is a flat <a> with no
 * nesting, and the alternative is an HTML parser dependency this project has
 * never taken. Removing an <a> cannot shift content keys either, because
 * content.js only keys h1, h2, h3, h4, p and li.
 */
export function applyFlags(html) {
  const visible = shown();

  return String(html).replace(
    /[ \t]*<a\b[^>]*\bdata-nav-flag="([A-Za-z0-9_-]+)"[^>]*>[^<]*<\/a>\n?/g,
    (match, name) => (visible.has(name) ? match : '')
  );
}
