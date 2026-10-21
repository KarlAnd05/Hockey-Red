/**
 * Game sheets.
 *
 * A game, and the people named on it. Each line can point at a roster player,
 * at a membership record, or at both - see the schema comment in db.js for why
 * both are nullable.
 *
 * The federation has not supplied its field list yet, so this is built to be
 * extended: adding a column to game_sheet_players later does not require
 * reshaping anything here.
 */
import { db } from '../db.js';

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
   Reads
   -------------------------------------------------------------------------- */
export function listGames() {
  return db
    .prepare(
      `SELECT g.*,
              t.name AS team_name,
              t.slug AS team_slug,
              (SELECT COUNT(*) FROM game_sheet_players s WHERE s.game_id = g.id) AS line_count
         FROM games g
         LEFT JOIN teams t ON t.id = g.team_id
        ORDER BY (g.played_at = '') ASC, g.played_at DESC, g.id DESC`
    )
    .all();
}

export function findGame(id) {
  return (
    db
      .prepare(
        `SELECT g.*, t.name AS team_name, t.slug AS team_slug
           FROM games g LEFT JOIN teams t ON t.id = g.team_id
          WHERE g.id = ?`
      )
      .get(Number(id)) || null
  );
}

/**
 * The lines on one sheet.
 *
 * Details come from the linked records where they exist, so nothing is retyped,
 * but the line's own name/number/position win when they are set - a player can
 * wear a different number for one game without that rewriting the roster.
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
        ORDER BY s.sort_order, s.id`
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
    role: line.role,
    roleLabel: ROLES[line.role] || line.role,
    note: line.note,
    sortOrder: line.sort_order,
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
 * Two pools, both filtered to exclude anyone already named: the team's roster,
 * and the membership records. This is what "no re-typing of data the system
 * already holds" comes down to in practice.
 */
export function candidatesFor(game) {
  const taken = db
    .prepare('SELECT player_id, registration_id FROM game_sheet_players WHERE game_id = ?')
    .all(game.id);

  const usedPlayers = new Set(taken.map((t) => t.player_id).filter(Boolean));
  const usedRegistrations = new Set(taken.map((t) => t.registration_id).filter(Boolean));

  const players = game.team_id
    ? db
        .prepare(
          `SELECT id, name, jersey_number, position, squad
             FROM players WHERE team_id = ? AND active = 1
            ORDER BY sort_order, id`
        )
        .all(game.team_id)
    : [];

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

  return {
    players: players
      .filter((p) => !usedPlayers.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        jerseyNumber: p.jersey_number,
        position: p.position,
        squad: p.squad,
      })),
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
