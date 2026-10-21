/**
 * Admin: Game sheets.
 *
 * Internal only - there is no public game-sheet page. Mounted behind the same
 * requireAdmin gate as the rest of /api/admin by app.js.
 */
import { Router } from 'express';
import { db } from '../db.js';
import {
  listGames,
  findGame,
  sheetFor,
  candidatesFor,
  serialiseGame,
  serialiseSheetLine,
  ROLES,
  HOME_AWAY,
  STATUSES,
} from '../lib/games.js';
import { listTeams, serialiseTeam } from '../lib/teams.js';

export const adminGamesRouter = Router();

adminGamesRouter.get('/games', (req, res) => {
  res.json({
    games: listGames().map((g) => serialiseGame(g)),
    teams: listTeams({ includeInactive: true }).map((t) => serialiseTeam(t)),
    roles: ROLES,
    homeAway: HOME_AWAY,
    statuses: STATUSES,
  });
});

adminGamesRouter.get('/games/:id', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  res.json({
    game: serialiseGame(game),
    sheet: sheetFor(game.id).map(serialiseSheetLine),
    candidates: candidatesFor(game),
  });
});

function readGameBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  const num = (key, fallback) => {
    if (body[key] === undefined) return fallback ?? null;
    if (body[key] === '' || body[key] === null) return null;
    const n = Number(body[key]);
    return Number.isFinite(n) ? n : null;
  };

  return {
    teamId: body.teamId === undefined ? existing.team_id ?? null : Number(body.teamId) || null,
    opponent: str('opponent', existing.opponent, 200),
    playedAt: str('playedAt', existing.played_at, 40),
    venue: str('venue', existing.venue, 200),
    competition: str('competition', existing.competition, 200),
    homeAway: Object.keys(HOME_AWAY).includes(body.homeAway)
      ? body.homeAway
      : existing.home_away || 'home',
    scoreFor: num('scoreFor', existing.score_for),
    scoreAgainst: num('scoreAgainst', existing.score_against),
    status: Object.keys(STATUSES).includes(body.status) ? body.status : existing.status || 'draft',
    notes: str('notes', existing.notes, 4000),
  };
}

adminGamesRouter.post('/games', (req, res) => {
  const v = readGameBody(req.body || {});
  if (!v.opponent) return res.status(400).json({ error: 'Name the opponent.' });

  const info = db
    .prepare(
      `INSERT INTO games
         (team_id, opponent, played_at, venue, competition, home_away, score_for, score_against, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      v.teamId,
      v.opponent,
      v.playedAt,
      v.venue,
      v.competition,
      v.homeAway,
      v.scoreFor,
      v.scoreAgainst,
      v.status,
      v.notes
    );

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminGamesRouter.patch('/games/:id', (req, res) => {
  const existing = findGame(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found.' });

  const v = readGameBody(req.body || {}, existing);
  db.prepare(
    `UPDATE games
        SET team_id = ?, opponent = ?, played_at = ?, venue = ?, competition = ?,
            home_away = ?, score_for = ?, score_against = ?, status = ?, notes = ?
      WHERE id = ?`
  ).run(
    v.teamId,
    v.opponent,
    v.playedAt,
    v.venue,
    v.competition,
    v.homeAway,
    v.scoreFor,
    v.scoreAgainst,
    v.status,
    v.notes,
    existing.id
  );

  res.json({ ok: true });
});

adminGamesRouter.delete('/games/:id', (req, res) => {
  const existing = findGame(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found.' });

  /* The sheet lines go with it, by ON DELETE CASCADE. */
  db.prepare('DELETE FROM games WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   Sheet lines
   -------------------------------------------------------------------------- */
adminGamesRouter.post('/games/:id/sheet', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const body = req.body || {};
  const playerId = Number(body.playerId) || null;
  const registrationId = Number(body.registrationId) || null;
  const name = String(body.name || '').trim().slice(0, 160);

  /* A line has to identify somebody. Without a link or a name there is nothing
     on the sheet but an empty row. */
  if (!playerId && !registrationId && !name) {
    return res.status(400).json({ error: 'Pick a player or a member, or type a name.' });
  }

  if (playerId) {
    const exists = db.prepare('SELECT 1 FROM players WHERE id = ?').get(playerId);
    if (!exists) return res.status(400).json({ error: 'That player no longer exists.' });

    const already = db
      .prepare('SELECT 1 FROM game_sheet_players WHERE game_id = ? AND player_id = ?')
      .get(game.id, playerId);
    if (already) return res.status(400).json({ error: 'That player is already on this sheet.' });
  }

  if (registrationId) {
    const exists = db.prepare('SELECT 1 FROM registrations WHERE id = ?').get(registrationId);
    if (!exists) return res.status(400).json({ error: 'That membership record no longer exists.' });
  }

  const next =
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM game_sheet_players WHERE game_id = ?').get(game.id)
      .n ?? 0;

  const number =
    body.jerseyNumber === undefined || body.jerseyNumber === '' || body.jerseyNumber === null
      ? null
      : Number(body.jerseyNumber);

  const info = db
    .prepare(
      `INSERT INTO game_sheet_players
         (game_id, player_id, registration_id, name, jersey_number, position, role, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      game.id,
      playerId,
      registrationId,
      name,
      Number.isFinite(number) ? number : null,
      String(body.position || '').trim().slice(0, 40),
      Object.keys(ROLES).includes(body.role) ? body.role : 'player',
      String(body.note || '').trim().slice(0, 400),
      next
    );

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminGamesRouter.patch('/games/:id/sheet/:lineId', (req, res) => {
  const line = db
    .prepare('SELECT * FROM game_sheet_players WHERE id = ? AND game_id = ?')
    .get(Number(req.params.lineId), Number(req.params.id));
  if (!line) return res.status(404).json({ error: 'That line is not on this sheet.' });

  const body = req.body || {};
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  const number =
    body.jerseyNumber === undefined
      ? line.jersey_number
      : body.jerseyNumber === '' || body.jerseyNumber === null
        ? null
        : Number(body.jerseyNumber);

  /* Statistics live on this line, not on the player: see lib/stats.js. A
     count is clamped at zero because a negative goal total is not a thing
     that happened, it is a typo. */
  const count = (key, fallback) => {
    if (body[key] === undefined) return fallback ?? 0;
    const n = Math.round(Number(body[key]));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const DECISIONS = ['', 'W', 'L', 'OTL'];
  const decision = DECISIONS.includes(String(body.decision || '').toUpperCase())
    ? String(body.decision || '').toUpperCase()
    : line.decision;

  db.prepare(
    `UPDATE game_sheet_players
        SET name = ?, jersey_number = ?, position = ?, role = ?, note = ?, sort_order = ?,
            goals = ?, assists = ?, penalty_minutes = ?,
            shots_against = ?, saves = ?, decision = ?, played = ?
      WHERE id = ?`
  ).run(
    str('name', line.name, 160),
    Number.isFinite(number) ? number : null,
    str('position', line.position, 40),
    Object.keys(ROLES).includes(body.role) ? body.role : line.role,
    str('note', line.note, 400),
    Number(body.sortOrder ?? line.sort_order) || 0,
    count('goals', line.goals),
    count('assists', line.assists),
    count('penaltyMinutes', line.penalty_minutes),
    count('shotsAgainst', line.shots_against),
    count('saves', line.saves),
    decision,
    body.played === undefined ? line.played : body.played ? 1 : 0,
    line.id
  );

  res.json({ ok: true });
});

adminGamesRouter.delete('/games/:id/sheet/:lineId', (req, res) => {
  const info = db
    .prepare('DELETE FROM game_sheet_players WHERE id = ? AND game_id = ?')
    .run(Number(req.params.lineId), Number(req.params.id));

  if (!info.changes) return res.status(404).json({ error: 'That line is not on this sheet.' });
  res.json({ ok: true });
});

/* Add every available roster player in one go - the common case when a squad
   turns up more or less intact, and the alternative is twenty clicks. */
adminGamesRouter.post('/games/:id/sheet/fill', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });
  if (!game.team_id) return res.status(400).json({ error: 'Set the team on this game first.' });

  const { players } = candidatesFor(game);
  if (!players.length) return res.json({ added: 0 });

  const start =
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM game_sheet_players WHERE game_id = ?').get(game.id)
      .n ?? 0;

  const insert = db.prepare(
    `INSERT INTO game_sheet_players (game_id, player_id, name, jersey_number, position, role, sort_order)
     VALUES (?, ?, '', ?, ?, 'player', ?)`
  );

  db.exec('BEGIN');
  try {
    players.forEach((p, i) => {
      insert.run(game.id, p.id, p.jerseyNumber, p.position, start + i);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  res.json({ added: players.length });
});
