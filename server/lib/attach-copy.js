/**
 * One-time: replace the placeholder programme blurbs with the federation's own
 * words, on a database that was already seeded.
 *
 * lib/teams.js now carries the real text, but seedTeams() skips any team that
 * already exists, so a live database would never see it. This fills those rows
 * in instead - the same shape as attach-photos.js, for the same reason.
 *
 * The guard is stricter than "is it empty", because none of these fields were
 * ever empty. A row is only rewritten when its description is still character
 * for character what the old seed wrote. Anything else is an edit somebody made
 * through the admin, and it is left alone. The worst case is that a programme
 * keeps its old blurb, which is a visible, fixable outcome; silently discarding
 * someone's rewrite is not.
 *
 * Source: the federation's "About Us" document, pages 5 to 8.
 */
import { db } from '../db.js';

/* The exact strings the previous seed produced. These are history: they are
   here to be matched against, not to be edited. If you change the live text,
   change SEED_TEAMS in lib/teams.js and leave these alone. */
const PREVIOUS_DESCRIPTIONS = {
  womens:
    "Lebanon's women's programme fields a senior national team and a Next Generation squad that brings " +
    'through the players behind it. Both draw on Lebanese players at home and across the diaspora.',
  mens:
    "The men's national programme represents Lebanon in international competition and carries the " +
    'federation flag at tournaments abroad.',
  youth:
    'The youth programme is where most Lebanese players start: learn-to-play, development camps, and ' +
    'the pathway into the national squads.',
  panthers:
    'The Lebanese Panthers carry the federation into club competition and community games through the season.',
};

/* Must stay identical to SEED_TEAMS in lib/teams.js, or a fresh database and a
   migrated one will describe the same programme differently. */
const CURRENT_DESCRIPTIONS = {
  womens:
    "The women's programme began with players around the world asking for one, after the men's team " +
    'drew attention to Lebanese hockey. It now fields a senior national team and a Next Generation ' +
    'squad, and has played friendlies and development programmes alongside Hockey Québec and Hockey ' +
    'Canada.',
  mens:
    "The federation's best-known programme, followed well beyond the Lebanese community. The squad is " +
    'drawn from eastern and western Canada, the United States, France, Sweden and the United Arab ' +
    'Emirates - different routes to the same jersey, and the same reason for wearing it.',
  youth:
    'Youth development sits at the centre of the federation. It gives young players somewhere to build ' +
    'their skills and be seen internationally, with coaching aimed at the national squads. This is ' +
    'where most Lebanese players start.',
  panthers:
    'The club programme is for Lebanese players who want a competitive environment to train in through ' +
    'the season. It is the foundation under the national squads: where local talent is developed and ' +
    'prepared for international tournaments.',
};

export function attachFederationCopy() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'federation_copy_attached'").get();
  if (done && done.value === '1') return 0;

  let updated = 0;

  db.exec('BEGIN');
  try {
    const team = db.prepare(
      `UPDATE teams
          SET description = ?
        WHERE slug = ? AND description = ?`
    );

    for (const [slug, description] of Object.entries(CURRENT_DESCRIPTIONS)) {
      updated += team.run(description, slug, PREVIOUS_DESCRIPTIONS[slug]).changes;
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at)
            VALUES ('federation_copy_attached', '1', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return updated;
}
