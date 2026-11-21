/**
 * One-time: give the Lebanese Panthers the squad, staff and photographs the
 * federation supplied.
 *
 * The Panthers row was seeded with a description and nothing else - no
 * portrait (there was none on the old site), no coaching staff, and no
 * players. All four now exist, but seedTeams() only ever writes a team that is
 * missing entirely, so a database that has already been seeded would never see
 * them. This fills them in instead.
 *
 * Guarded the same way as attach-photos.js and attach-copy.js, and just as
 * conservative about what counts as "nobody has set this yet":
 *
 *   - an empty photo_url, gallery or staff is unset, so it is filled;
 *   - anything else is somebody's choice in the admin and is left alone,
 *     field by field rather than all-or-nothing;
 *   - the roster is written only if the Panthers have NO players at all.
 *     Adding nine names to a roster somebody has already started would
 *     duplicate half of it, and no guard on a name can tell a second
 *     Christopher Hatem from the same one entered twice.
 *
 * The photographs themselves live in lib/photos.js, which seedTeams() also
 * reads, so the fresh-database path and this one cannot disagree about which
 * picture belongs where.
 *
 * ---------------------------------------------------------------------------
 * ONE THING HERE IS A GUESS, AND IT IS VISIBLE ON A PUBLIC PAGE
 * ---------------------------------------------------------------------------
 * The federation supplied nine names and nothing else. The players table
 * requires a position - its CHECK constraint allows only forward, defence,
 * goaltender or staff, with no value meaning "not stated" - so every player
 * below is written as a forward, which is also what the admin defaults to when
 * nobody picks one (see routes/admin-teams.js).
 *
 * That means the roster will say "Forward" against nine real people until
 * somebody corrects it in Admin -> Teams -> Lebanese Panthers. Jersey numbers
 * are left null and render as a dash, which is honest; position has no such
 * option. Flagged in SETUP-CHECKLIST.md.
 */
import { db } from '../db.js';
import { TEAM_PHOTOS, galleryText } from './photos.js';
import { slugify, uniqueSlug } from './teams.js';

/* Name - Role, one per line: the shape teams.staff stores and lineList()
   renders as a definition list. */
const STAFF = ['Nada Hatem - Manager', 'Marc Abboud - Coach'].join('\n');

/* In the order the federation listed them, which is the order they appear. */
const PLAYERS = [
  'Karl Andraos',
  'Ricardo Rassi',
  'Rodolphe Hatem',
  'Christopher Hatem',
  'Michael Mansour',
  'Jude Ayoub',
  'Sacha Gebrael',
  'Kira Gebrael',
  'Bruna Gebrael',
];

export function attachPanthers() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'panthers_attached'").get();
  if (done && done.value === '1') return { players: 0, fields: 0 };

  const team = db.prepare('SELECT * FROM teams WHERE slug = ?').get('panthers');

  /* No Panthers row yet means this is a database seedTeams() has not run
     against. It will write all of this itself, so there is nothing to attach
     and the flag stays clear in case the row appears later. */
  if (!team) return { players: 0, fields: 0 };

  let players = 0;
  let fields = 0;

  db.exec('BEGIN');
  try {
    const photo = TEAM_PHOTOS.panthers;

    /* Portrait and alt text move together. Setting one without the other
       captions the wrong picture. */
    if (photo && !team.photo_url) {
      fields += db
        .prepare("UPDATE teams SET photo_url = ?, photo_alt = ? WHERE id = ? AND photo_url = ''")
        .run(photo.url, photo.alt, team.id).changes;
    }

    const gallery = galleryText('panthers');
    if (gallery && !team.gallery) {
      fields += db
        .prepare("UPDATE teams SET gallery = ? WHERE id = ? AND gallery = ''")
        .run(gallery, team.id).changes;
    }

    if (!team.staff) {
      fields += db
        .prepare("UPDATE teams SET staff = ? WHERE id = ? AND staff = ''")
        .run(STAFF, team.id).changes;
    }

    const existing = db
      .prepare('SELECT COUNT(*) AS n FROM players WHERE team_id = ?')
      .get(team.id).n;

    if (existing === 0) {
      const insert = db.prepare(
        `INSERT INTO players (team_id, slug, name, squad, position, jersey_number, sort_order)
         VALUES (?, ?, ?, '', 'forward', NULL, ?)`
      );

      PLAYERS.forEach((name, i) => {
        /* uniqueSlug, not slugify: the slug column is unique across every
           team, and two players really can share a name. */
        insert.run(team.id, uniqueSlug(slugify(name), 'players'), name, i);
        players += 1;
      });
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at)
            VALUES ('panthers_attached', '1', datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { players, fields };
}
