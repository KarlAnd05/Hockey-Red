/**
 * Game sheets.
 *
 * A game, and the people named on it. Each line can point at a roster player,
 * at a membership record, or at both - see the schema comment in db.js for why
 * both are nullable.
 *
 * The federation's field list arrived as the IIHF's own Official Game Sheet, so
 * a game now carries that form's header, and goals and penalties are events in
 * their own right (game_events) rather than per-player totals. The totals are
 * still there on each line, as a projection of the events - see
 * syncSheetTotals - because lib/stats.js and every player profile read them.
 *
 * A sheet holds up to two squads. When the opponent is another team on this
 * site, games.opponent_team_id points at it and both rosters are named, so an
 * internal fixture credits both sets of players. Otherwise the opponent is a
 * name and the events on their side carry a jersey number instead of a line.
 */
import { db } from '../db.js';
import { slugify, uniqueSlug } from './teams.js';
import { positionLetter } from './game-events.js';

export const ROLES = {
  player: 'Player',
  captain: 'Captain',
  alternate: 'Alternate captain',
  starting_goaltender: 'Starting goaltender',
  staff: 'Staff',
};

export const HOME_AWAY = {
  home: 'Home',
  away: 'Away',
  neutral: 'Neutral',
};

export const STATUSES = {
  draft: 'Draft',
  final: 'Final',
  cancelled: 'Cancelled',
};

/* --------------------------------------------------------------------------
   Slugs
   -------------------------------------------------------------------------- */

/**
 * The web address a published game gets.
 *
 * Date first, then the opponent - "2026-02-14-jamaica". The date leads because
 * it sorts chronologically as a string and reads as an archive URL, and because
 * the opponent on its own is not unique over a season.
 *
 * played_at is free text and may be empty, so a dateless game falls back to its
 * id. Nothing is ever published at an empty slug.
 */
export function gameSlug(game, excludeId = null) {
  const date = slugify(String(game.played_at || '').slice(0, 10));
  const opponent = slugify(game.opponent || game.opponent_team_name || '');
  const base = [date || (game.id ? `game-${game.id}` : ''), opponent].filter(Boolean).join('-');
  return uniqueSlug(base, 'games', excludeId ?? game.id ?? null, 'game');
}

/**
 * Give every game that has no web address one, once.
 *
 * Guarded by app_meta the same way migrateRosterToPlayers and the attach-*
 * backfills are, and for the same reason: the rows and the flag have to land
 * together or a half-finished run repeats itself.
 *
 * The unique index is created afterwards, not in db.js with the other schema.
 * SQLite's ALTER TABLE ADD COLUMN cannot add a UNIQUE column, so the column
 * arrives plain and the constraint follows the backfill - and it is partial,
 * because every row starts at '' and two empty strings are not a collision
 * worth refusing.
 */
export function backfillGameSlugs() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'games_slugged'").get();

  let filled = 0;
  if (!done || done.value !== '1') {
    const rows = db
      .prepare("SELECT id, played_at, opponent FROM games WHERE slug = '' ORDER BY id")
      .all();

    db.exec('BEGIN');
    try {
      const update = db.prepare('UPDATE games SET slug = ? WHERE id = ?');
      for (const row of rows) {
        update.run(gameSlug(row), row.id);
        filled += 1;
      }

      db.prepare(
        `INSERT INTO app_meta (key, value, updated_at)
              VALUES ('games_slugged', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
      ).run();

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug ON games(slug) WHERE slug <> ''");
  return filled;
}

/* --------------------------------------------------------------------------
   Reads
   -------------------------------------------------------------------------- */
export function listGames() {
  return db
    .prepare(
      `SELECT g.*,
              t.name AS team_name,
              t.slug AS team_slug,
              o.name AS opponent_team_name,
              o.slug AS opponent_team_slug,
              (SELECT COUNT(*) FROM game_sheet_players s
                WHERE s.game_id = g.id AND s.side = 'us') AS line_count,
              (SELECT COUNT(*) FROM game_sheet_players s
                WHERE s.game_id = g.id AND s.side = 'them') AS opponent_line_count,
              (SELECT COUNT(*) FROM game_events e WHERE e.game_id = g.id) AS event_count
         FROM games g
         LEFT JOIN teams t ON t.id = g.team_id
         LEFT JOIN teams o ON o.id = g.opponent_team_id
        ORDER BY (g.played_at = '') ASC, g.played_at DESC, g.id DESC`
    )
    .all();
}

const ONE_GAME = `SELECT g.*,
              t.name AS team_name,
              t.slug AS team_slug,
              o.name AS opponent_team_name,
              o.slug AS opponent_team_slug
         FROM games g
         LEFT JOIN teams t ON t.id = g.team_id
         LEFT JOIN teams o ON o.id = g.opponent_team_id`;

export function findGame(id) {
  return db.prepare(`${ONE_GAME} WHERE g.id = ?`).get(Number(id)) || null;
}

/** One game by its public slug. Used by the /games/<slug> page. */
export function findGameBySlug(slug) {
  return db.prepare(`${ONE_GAME} WHERE g.slug = ? AND g.slug <> ''`).get(String(slug || '')) || null;
}

/**
 * The games a visitor may see: published, and with a web address to see them at.
 *
 * Cancelled games are included deliberately - a page saying the fixture was
 * called off is useful, and whether to publish one is the admin's decision, not
 * this function's. Drafts are not: a sheet being typed during play is nobody's
 * business until the coach says so.
 */
export function publishedGames() {
  return db
    .prepare(
      `${ONE_GAME}
        WHERE g.published = 1 AND g.slug <> '' AND g.status <> 'draft'
        ORDER BY (g.played_at = '') ASC, g.played_at DESC, g.id DESC`
    )
    .all();
}

/**
 * The lines on one sheet.
 *
 * Details come from the linked records where they exist, so nothing is retyped,
 * but the line's own name/number/position win when they are set - a player can
 * wear a different number for one game without that rewriting the roster.
 *
 * Both squads come back, ours first, so a caller that wants one side filters on
 * `side` rather than running a second query.
 */
export function sheetFor(gameId) {
  return db
    .prepare(
      `SELECT s.*,
              p.name          AS player_name,
              p.slug          AS player_slug,
              p.jersey_number AS player_number,
              p.position      AS player_position,
              r.first_name    AS reg_first_name,
              r.last_name     AS reg_last_name,
              r.email         AS reg_email,
              r.date_of_birth AS reg_dob,
              r.position      AS reg_position,
              r.payment_status AS reg_status,
              r.tier          AS reg_tier
         FROM game_sheet_players s
         LEFT JOIN players p       ON p.id = s.player_id
         LEFT JOIN registrations r ON r.id = s.registration_id
        WHERE s.game_id = ?
        ORDER BY (s.side = 'them') ASC, s.sort_order, s.id`
    )
    .all(Number(gameId));
}

export function serialiseGame(game, extra = {}) {
  return {
    id: game.id,
    teamId: game.team_id,
    teamName: game.team_name || '',
    teamSlug: game.team_slug || '',
    opponent: game.opponent,
    playedAt: game.played_at,
    venue: game.venue,
    competition: game.competition,
    homeAway: game.home_away,
    homeAwayLabel: HOME_AWAY[game.home_away] || game.home_away,
    scoreFor: game.score_for,
    scoreAgainst: game.score_against,
    status: game.status,
    statusLabel: STATUSES[game.status] || game.status,
    notes: game.notes,
    lineCount: game.line_count ?? undefined,
    opponentLineCount: game.opponent_line_count ?? undefined,
    eventCount: game.event_count ?? undefined,

    /* The public page and its gate. */
    slug: game.slug || '',
    published: Boolean(game.published),
    eventsMode: Boolean(game.events_mode),

    /* An opponent that is another team here, rather than just a name. */
    opponentTeamId: game.opponent_team_id ?? null,
    opponentTeamName: game.opponent_team_name || '',
    opponentTeamSlug: game.opponent_team_slug || '',
    /* What to call them, whichever they are. */
    opponentLabel: game.opponent_team_name || game.opponent || 'Opponent',

    /* The official sheet's header. */
    eventName: game.event_name || '',
    gameNumber: game.game_number || '',
    startTime: game.start_time || '',
    endTime: game.end_time || '',
    spectators: game.spectators ?? null,
    teamColour: game.team_colour || '',
    opponentColour: game.opponent_colour || '',
    teamStaff: game.team_staff || '',
    opponentStaff: game.opponent_staff || '',
    officials: game.officials || '',
    clockCounts: game.clock_counts === 'up' ? 'up' : 'down',

    /* A/B as the form labels them, worked out rather than stored: the home
       side is A. A game on neutral ice has no home side, and the form still
       needs two labels, so the team whose sheet this is takes A. */
    usLabel: game.home_away === 'away' ? 'B' : 'A',
    themLabel: game.home_away === 'away' ? 'A' : 'B',
    ...extra,
  };
}

export function serialiseSheetLine(line) {
  const regName = [line.reg_first_name, line.reg_last_name].filter(Boolean).join(' ');

  return {
    id: line.id,
    playerId: line.player_id,
    registrationId: line.registration_id,
    /* The sheet's own value first, then the roster, then the membership record:
       whichever is most specific to this game wins. */
    name: line.name || line.player_name || regName || '',
    jerseyNumber: line.jersey_number ?? line.player_number ?? null,
    position: line.position || line.player_position || line.reg_position || '',
    /* GK / D / F, as the official form wants it. The column keeps the players
       table's own vocabulary; this is the sheet's letter for the same thing. */
    positionLetter: positionLetter(line.position || line.player_position || line.reg_position || ''),
    role: line.role,
    roleLabel: ROLES[line.role] || line.role,
    note: line.note,
    sortOrder: line.sort_order,
    side: line.side === 'them' ? 'them' : 'us',
    lineNumber: line.line_number ?? null,
    bestPlayer: Boolean(line.best_player),
    minutesInPlay: line.minutes_in_play || 0,
    played: line.played === undefined ? true : Boolean(line.played),
    goals: line.goals || 0,
    assists: line.assists || 0,
    points: (line.goals || 0) + (line.assists || 0),
    penaltyMinutes: line.penalty_minutes || 0,
    shotsAgainst: line.shots_against || 0,
    saves: line.saves || 0,
    decision: line.decision || '',
    playerSlug: line.player_slug || '',
    membership: line.registration_id
      ? {
          email: line.reg_email || '',
          dateOfBirth: line.reg_dob || '',
          tier: line.reg_tier || '',
          paymentStatus: line.reg_status || '',
        }
      : null,
  };
}

/**
 * Who can still be added to this sheet.
 *
 * Three pools, all filtered to exclude anyone already named: our roster, the
 * opponent's roster when the opponent is another team here, and the membership
 * records. This is what "no re-typing of data the system already holds" comes
 * down to in practice.
 */
export function candidatesFor(game) {
  const taken = db
    .prepare('SELECT player_id, registration_id FROM game_sheet_players WHERE game_id = ?')
    .all(game.id);

  const usedPlayers = new Set(taken.map((t) => t.player_id).filter(Boolean));
  const usedRegistrations = new Set(taken.map((t) => t.registration_id).filter(Boolean));

  const roster = (teamId) =>
    teamId
      ? db
          .prepare(
            `SELECT id, name, jersey_number, position, squad
               FROM players WHERE team_id = ? AND active = 1
              ORDER BY sort_order, id`
          )
          .all(teamId)
      : [];

  const players = roster(game.team_id);
  const opponentPlayers = roster(game.opponent_team_id);

  /* Paid memberships only. An unpaid form is an enquiry, not a member, and
     putting one on a game sheet would assert something that is not true yet. */
  const registrations = db
    .prepare(
      `SELECT id, first_name, last_name, email, position, date_of_birth, tier
         FROM registrations
        WHERE payment_status = 'paid'
        ORDER BY last_name, first_name, id`
    )
    .all();

  const offer = (rows) =>
    rows
      .filter((p) => !usedPlayers.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        jerseyNumber: p.jersey_number,
        position: p.position,
        squad: p.squad,
      }));

  return {
    players: offer(players),
    opponentPlayers: offer(opponentPlayers),
    registrations: registrations
      .filter((r) => !usedRegistrations.has(r.id))
      .map((r) => ({
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email,
        email: r.email,
        position: r.position,
        dateOfBirth: r.date_of_birth,
        tier: r.tier,
      })),
  };
}
