/**
 * One-time: apply the federation's 2025 and 2026 annual recaps to the site.
 *
 * The team pages were seeded before those documents existed, so the honours
 * lists were incomplete and two of the four teams carried a generic placeholder
 * description. The recaps are the federation's own account of what happened, so
 * they are the authority for both.
 *
 * Guarded like the other seeds, and it will not overwrite an edit made in the
 * admin: a description is replaced only when it still matches the exact string
 * that was seeded, which proves nobody has touched it. Honours are appended
 * entry by entry, skipping any line already present, so re-running adds nothing
 * and a hand-added honour survives.
 */
import { db } from '../db.js';

/* Newest first, matching how the page reads them. Sources: "2025 LIHF Recap"
   and "LIHF Recap 2026 - Final Version". */
const HONOURS = {
  mens: [
    '2026 Qatar Cup - Gold',
    '2025 Challenger Series - Silver',
  ],
  womens: [
    '2026 Challenger Series - Silver',
    '2026 LATAM Cup, Miami - Silver',
  ],
};

/* Only teams whose description is still the generic seed. The exact seeded text
   is repeated here so "untouched" can be recognised precisely; if the seeds in
   lib/teams.js ever change, these stop matching and nothing is overwritten,
   which is the safe direction to fail in. */
const DESCRIPTIONS = {
  panthers: {
    seeded:
      'The Lebanese Panthers carry the federation into club competition and community games through the season.',
    tagline: 'Inline hockey club in Lebanon',
    description:
      'The Panthers are the federation’s inline hockey club in Lebanon and its grassroots route into the ' +
      'game, running weekly training sessions for boys and girls aged 8 to 14.\n\n' +
      'The club is a genuine pathway rather than a feeder in name only: two young Panthers players represented ' +
      'Lebanon at the United Hockey Camp 2026 in Switzerland, a week of on-ice and off-ice training held under ' +
      'the theme “Passion for Sports, Education and Dialogue”.',
  },
  youth: {
    /* Set by lib/merge-programs.js when youth-camp.html was folded in. */
    seeded:
      'The youth programme is where most Lebanese players start: free camps, development sessions, ' +
      'and the pathway into the national squads. Camps run for ages 7 to 13 at all skill levels, with ' +
      'beginner equipment provided and National Team players on the ice.',
    tagline: 'Development and pathway',
    description:
      'The youth programme is where most Lebanese players start: free camps, development sessions, and the ' +
      'pathway into the national squads. Camps run for all skill levels, with beginner equipment provided and ' +
      'National Team players on the ice.\n\n' +
      'In 2026 the federation launched its first partnership with Hockey Québec, running a Lebanese Youth ' +
      'Hockey Camp in Montréal that welcomed more than 25 young players of Lebanese heritage aged 8 to 12. ' +
      'Following its success, camps are planned for 2027 in the Montréal–Ottawa region, Detroit and Edmonton.',
  },
};

const CEDARS_CUP = {
  title: 'Cedars Cup',
  kind: 'tournament',
  startsAt: '2027-06-01',
  location: 'Edmonton, Canada',
  description:
    'The inaugural Cedars Cup, created by the federation to bring together more than six men’s and ' +
    'women’s national teams. A new international platform for competition, cultural exchange and the ' +
    'continued growth of Lebanese hockey worldwide. The long-term ambition is to host it in Lebanon once ' +
    'the necessary ice facilities exist.',
  linkUrl: '/contact.html',
  linkLabel: 'Register your interest',
};

export function seedRecaps() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'recaps_2025_2026_applied'").get();
  if (done && done.value === '1') return 0;

  let changes = 0;

  db.exec('BEGIN');
  try {
    /* --- Honours ------------------------------------------------------- */
    for (const [slug, entries] of Object.entries(HONOURS)) {
      const team = db.prepare('SELECT id, honours FROM teams WHERE slug = ?').get(slug);
      if (!team) continue;

      const existing = String(team.honours || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      /* Skip anything already listed, however it got there. */
      const additions = entries.filter(
        (e) => !existing.some((line) => line.toLowerCase() === e.toLowerCase())
      );

      /* Sort by the leading year, newest first, so a late addition does not
         land above an older entry. Lines with no year - "Founded 2018,
         IIHF-recognised" - are context rather than a result and sit at the
         end, which is where they read best. */
      const year = (line) => {
        const m = /^(\d{4})\b/.exec(line);
        return m ? Number(m[1]) : -1;
      };

      const merged = [...additions, ...existing].sort((a, b) => year(b) - year(a));

      /* Write when the result differs, not only when something was added: a
         re-run with no new entries may still be putting an existing list
         back into year order. */
      const next = merged.join('\n');
      if (next !== String(team.honours || '')) {
        db.prepare('UPDATE teams SET honours = ? WHERE id = ?').run(next, team.id);
        changes += additions.length || 1;
      }
    }

    /* --- Descriptions -------------------------------------------------- */
    for (const [slug, content] of Object.entries(DESCRIPTIONS)) {
      const info = db
        .prepare('UPDATE teams SET description = ?, tagline = ? WHERE slug = ? AND description = ?')
        .run(content.description, content.tagline, slug, content.seeded);
      changes += info.changes;
    }

    /* --- Schedule ------------------------------------------------------ */
    const exists = db.prepare('SELECT 1 FROM programs WHERE title = ?').get(CEDARS_CUP.title);
    if (!exists) {
      db.prepare(
        `INSERT INTO programs (title, kind, starts_at, location, description, link_url, link_label)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        CEDARS_CUP.title,
        CEDARS_CUP.kind,
        CEDARS_CUP.startsAt,
        CEDARS_CUP.location,
        CEDARS_CUP.description,
        CEDARS_CUP.linkUrl,
        CEDARS_CUP.linkLabel
      );
      changes += 1;
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ('recaps_2025_2026_applied', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return changes;
}
