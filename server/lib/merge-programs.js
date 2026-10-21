/**
 * One-time: move the programme pages' content into the teams that replaced them.
 *
 * mens-program.html, womens-program.html and youth-camp.html were folded into
 * Our Teams. Their URLs now redirect, but the words on them were real content -
 * coaching staff, honours, camp details - and deleting the pages without moving
 * that first would simply lose it.
 *
 * Guarded like the other seeds, and it only ever fills a field that is still
 * empty, so an admin who has since rewritten a team description does not get
 * it overwritten by this.
 */
import { db } from '../db.js';

const TEAM_CONTENT = {
  mens: {
    tagline: 'Senior national team',
    description:
      "The federation's Men's National Team competes internationally under a full coaching staff, " +
      'with medal finishes at the 2023 Kuwait Arab Cup and the 2025 Kazan 3v3 Islamic Tournament. ' +
      'The programme is focused on development and competitive results, representing Lebanon on the ' +
      'international stage.',
    staff: ['Gregg Kennedy - Head Coach', 'Ricardo Tabet - General Manager'].join('\n'),
    honours: ['2023 Kuwait Arab Cup - Gold', '2025 Kazan 3v3 Islamic Tournament - Bronze'].join('\n'),
  },
  womens: {
    tagline: 'National Team and Next Generation',
    description:
      'Started in 2018 by a group of committed athletes, the Women’s programme is now recognised ' +
      'by the IIHF and fields both a National Team and a Next Generation Team. Players compete at ' +
      'NCAA Division 1 and 3 schools, U Sports universities, and in international leagues.',
    staff: [
      'Jocelyn Trépanier - General Manager & Co-Head Coach',
      'Adrienne Saba - Co-Head Coach',
      'Mohamad Teliani - Co-Head Coach',
    ].join('\n'),
    honours: ['2025 Dream Nation Cup - Bronze', 'Founded 2018, IIHF-recognised'].join('\n'),
  },
  youth: {
    tagline: 'Development and pathway',
    description:
      'The youth programme is where most Lebanese players start: free camps, development sessions, ' +
      'and the pathway into the national squads. Camps run for ages 7 to 13 at all skill levels, with ' +
      'beginner equipment provided and National Team players on the ice.',
  },
};

/* The camp was an event, not a description of a team, so it moves to the
   schedule rather than into a team's prose. */
const YOUTH_CAMP = {
  title: 'Hockey Quebec Youth Camp 2026',
  kind: 'camp',
  startsAt: '2026-07-11',
  location: 'Quebec',
  description:
    'A free hockey experience for ages 7 to 13, all skill levels. 1:30 to 4:30 PM: 90 minutes on-ice ' +
    'and 60 minutes off-ice, free beginner equipment rental, and a chance to meet National Team ' +
    'players. Food, drinks and admission are all free. Space is limited and camps fill up quickly - ' +
    'contact the federation to join the waitlist. Camp participants get free admission to Challenger ' +
    'Series games.',
  linkUrl: '/contact.html',
  linkLabel: 'Join the waitlist',
};


/* The exact strings seedTeams() writes in server/lib/teams.js. Kept here
   verbatim so "untouched placeholder" can be recognised precisely; if those
   seeds ever change, these stop matching and nothing is overwritten, which is
   the safe direction to fail in. */
const SEEDED_PLACEHOLDERS = {
  womens:
    "Lebanon's women's programme fields a senior national team and a Next Generation squad that brings " +
    'through the players behind it. Both draw on Lebanese players at home and across the diaspora.',
  mens:
    "The men's national programme represents Lebanon in international competition and carries the " +
    'federation flag at tournaments abroad.',
  youth:
    'The youth programme is where most Lebanese players start: learn-to-play, development camps, and ' +
    'the pathway into the national squads.',
};

export function mergeProgramPages() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'program_pages_merged'").get();
  if (done && done.value === '1') return 0;

  let moved = 0;

  db.exec('BEGIN');
  try {
    for (const [slug, content] of Object.entries(TEAM_CONTENT)) {
      const team = db.prepare('SELECT * FROM teams WHERE slug = ?').get(slug);
      if (!team) continue;

      /* COALESCE on the existing value, not a blind overwrite: if somebody has
         already written a better description in the admin, keep theirs. */
      db.prepare(
        `UPDATE teams
            SET tagline     = CASE WHEN tagline = ''     THEN ? ELSE tagline END,
                description = CASE WHEN description = '' THEN ? ELSE description END,
                staff       = CASE WHEN staff = ''       THEN ? ELSE staff END,
                honours     = CASE WHEN honours = ''     THEN ? ELSE honours END
          WHERE id = ?`
      ).run(
        content.tagline || '',
        content.description || '',
        content.staff || '',
        content.honours || '',
        team.id
      );
      moved += 1;
    }

    /* seedTeams() wrote a short placeholder description before this content
       existed, so "already has a description" is not the same as "somebody
       wrote this". Replace a description only when it is still EXACTLY the
       seeded text - that is provably untouched, where a LIKE or a blanket
       overwrite would clobber a real edit made in the admin. */
    for (const [slug, content] of Object.entries(TEAM_CONTENT)) {
      if (!SEEDED_PLACEHOLDERS[slug] || !content.description) continue;

      db.prepare('UPDATE teams SET description = ?, tagline = ? WHERE slug = ? AND description = ?').run(
        content.description,
        content.tagline || '',
        slug,
        SEEDED_PLACEHOLDERS[slug]
      );
    }

    const campExists = db.prepare('SELECT 1 FROM programs WHERE title = ?').get(YOUTH_CAMP.title);
    if (!campExists) {
      db.prepare(
        `INSERT INTO programs (team_id, title, kind, starts_at, location, description, link_url, link_label)
         VALUES ((SELECT id FROM teams WHERE slug = 'youth'), ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        YOUTH_CAMP.title,
        YOUTH_CAMP.kind,
        YOUTH_CAMP.startsAt,
        YOUTH_CAMP.location,
        YOUTH_CAMP.description,
        YOUTH_CAMP.linkUrl,
        YOUTH_CAMP.linkLabel
      );
      moved += 1;
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ('program_pages_merged', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return moved;
}
