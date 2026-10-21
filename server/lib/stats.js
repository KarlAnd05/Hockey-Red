/**
 * Player statistics, derived from game sheets.
 *
 * Nothing here is stored. A player's totals are the sum of the sheets they
 * appear on, plus whatever prior history the federation entered by hand for
 * seasons that pre-date this system. That means a correction to a game sheet
 * fixes every total that depends on it, and there is never a stored figure
 * sitting out of step with the games behind it.
 */
import { db } from '../db.js';

/* A line only counts towards games played when the player actually dressed.
   Somebody named on the sheet but scratched should not accrue a game. */
const PLAYED = 's.played = 1';

/**
 * One player's totals and the games behind them.
 *
 * Only games marked final count. A draft sheet is a work in progress - letting
 * it into a career total would mean a player's record changed every time
 * somebody opened the editor.
 */
export function statsForPlayer(playerId) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
  if (!player) return null;

  const rows = db
    .prepare(
      `SELECT s.*, g.opponent, g.played_at, g.venue, g.home_away,
              g.score_for, g.score_against, g.competition
         FROM game_sheet_players s
         JOIN games g ON g.id = s.game_id
        WHERE s.player_id = ? AND g.status = 'final' AND ${PLAYED}
        ORDER BY (g.played_at = '') ASC, g.played_at DESC, g.id DESC`
    )
    .all(Number(playerId));

  const sum = (key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);

  const games = rows.length + (player.prior_games || 0);
  const goals = sum('goals') + (player.prior_goals || 0);
  const assists = sum('assists') + (player.prior_assists || 0);

  const shotsAgainst = sum('shots_against');
  const saves = sum('saves');
  const goalsAgainst = shotsAgainst - saves;

  const decisions = rows.reduce(
    (acc, r) => {
      const d = String(r.decision || '').toUpperCase();
      if (d === 'W') acc.wins += 1;
      else if (d === 'L') acc.losses += 1;
      else if (d === 'OTL') acc.otLosses += 1;
      return acc;
    },
    { wins: 0, losses: 0, otLosses: 0 }
  );

  /* A shutout is a goaltender who faced shots and conceded nothing. Derived
     rather than ticked, so it cannot disagree with the goals against. */
  const shutouts = rows.filter(
    (r) => Number(r.shots_against) > 0 && Number(r.shots_against) === Number(r.saves)
  ).length;

  const isGoaltender = player.position === 'goaltender';

  return {
    isGoaltender,
    /* Only claim a record when there is something behind it. A player with no
       finalised games and no prior history has no statistics, and saying "0 in
       0 games" invites the reader to think they played and failed. */
    hasRecord: games > 0,
    fromSheets: rows.length,
    priorGames: player.prior_games || 0,
    priorNote: player.prior_note || '',

    games,
    goals,
    assists,
    points: goals + assists,
    penaltyMinutes: sum('penalty_minutes'),

    wins: decisions.wins,
    losses: decisions.losses,
    otLosses: decisions.otLosses,
    shotsAgainst,
    saves,
    goalsAgainst,
    shutouts,
    /* Guarded: a goaltender who has faced no shots has no save percentage, and
       0/0 would render as NaN on a public page. */
    savePercentage: shotsAgainst > 0 ? saves / shotsAgainst : null,
    goalsAgainstAverage: rows.length > 0 && shotsAgainst > 0 ? goalsAgainst / rows.length : null,

    log: rows.map((r) => ({
      gameId: r.game_id,
      opponent: r.opponent,
      playedAt: r.played_at,
      venue: r.venue,
      competition: r.competition,
      homeAway: r.home_away,
      scoreFor: r.score_for,
      scoreAgainst: r.score_against,
      goals: Number(r.goals) || 0,
      assists: Number(r.assists) || 0,
      points: (Number(r.goals) || 0) + (Number(r.assists) || 0),
      penaltyMinutes: Number(r.penalty_minutes) || 0,
      saves: Number(r.saves) || 0,
      shotsAgainst: Number(r.shots_against) || 0,
      decision: r.decision || '',
    })),
  };
}

/**
 * Totals for everyone on a team, for the leaders table on the team page.
 * One query rather than N calls to statsForPlayer.
 */
export function statsForTeam(teamId) {
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.slug, p.position, p.jersey_number,
              p.prior_games, p.prior_goals, p.prior_assists,
              COUNT(s.id)                      AS sheet_games,
              COALESCE(SUM(s.goals), 0)        AS goals,
              COALESCE(SUM(s.assists), 0)      AS assists,
              COALESCE(SUM(s.penalty_minutes), 0) AS pim
         FROM players p
         LEFT JOIN game_sheet_players s ON s.player_id = p.id AND s.played = 1
         LEFT JOIN games g ON g.id = s.game_id AND g.status = 'final'
        WHERE p.team_id = ? AND p.active = 1 AND (s.id IS NULL OR g.id IS NOT NULL)
        GROUP BY p.id
        ORDER BY (COALESCE(SUM(s.goals),0) + COALESCE(SUM(s.assists),0)) DESC, p.name`
    )
    .all(Number(teamId));

  return rows.map((r) => {
    const goals = r.goals + (r.prior_goals || 0);
    const assists = r.assists + (r.prior_assists || 0);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      position: r.position,
      jerseyNumber: r.jersey_number,
      games: r.sheet_games + (r.prior_games || 0),
      goals,
      assists,
      points: goals + assists,
      penaltyMinutes: r.pim,
    };
  });
}
