/**
 * Admin: Game sheets.
 *
 * Mounted behind the same requireAdmin gate as the rest of /api/admin by
 * app.js. There IS a public game-sheet page now - /games and /games/<slug>,
 * served by routes/games.js - so nothing here may assume its reader is an
 * admin: a game reaches the public only once games.published is set, which is
 * a separate endpoint from everything that edits the record.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { isSectionVisible, setSectionVisible } from '../lib/settings.js';
import {
  listGames,
  findGame,
  sheetFor,
  candidatesFor,
  serialiseGame,
  serialiseSheetLine,
  gameSlug,
  ROLES,
  HOME_AWAY,
  STATUSES,
} from '../lib/games.js';
import {
  PERIODS,
  PERIOD_LABEL,
  PERIOD_SHORT,
  GAME_SITUATIONS,
  PENALTY_MINUTES,
  PENALTY_MINUTES_LABEL,
  OFFENCE_CODES,
  COMMON_OFFENCES,
  SIDES,
  eventsFor,
  goaliesFor,
  serialiseEvent,
  serialiseGoalie,
  syncSheetTotals,
  periodSummary,
  warningsFor,
  topOffenceCodes,
  normaliseClock,
  penaltyEnd,
} from '../lib/game-events.js';
import { listTeams, serialiseTeam } from '../lib/teams.js';

export const adminGamesRouter = Router();

adminGamesRouter.get('/games', (req, res) => {
  res.json({
    games: listGames().map((g) => serialiseGame(g)),
    teams: listTeams({ includeInactive: true }).map((t) => serialiseTeam(t)),
    roles: ROLES,
    homeAway: HOME_AWAY,
    statuses: STATUSES,
    sectionVisible: isSectionVisible('games'),
  });
});

/* The site-wide switch for the whole section: the /games pages and the nav
   link that points at them. Separate from a game's own published flag - this
   one answers "does this site have a game sheets section at all". */
adminGamesRouter.post('/games/section', (req, res) => {
  res.json({ sectionVisible: setSectionVisible('games', req.body?.visible === true) });
});

/* The IIHF form's own vocabulary, sent to the browser rather than copied into
   assets/admin/*.js: the list the screen offers and the list these routes
   validate against have to be the same list. */
const VOCABULARY = {
  periods: PERIODS,
  periodLabels: PERIOD_LABEL,
  periodShorts: PERIOD_SHORT,
  situations: GAME_SITUATIONS,
  penaltyMinutes: PENALTY_MINUTES,
  penaltyMinutesLabels: PENALTY_MINUTES_LABEL,
  offences: OFFENCE_CODES,
  commonOffences: COMMON_OFFENCES,
  sides: SIDES,
};

adminGamesRouter.get('/games/:id', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  res.json({
    ...sheetPayload(game),
    candidates: candidatesFor(game),
    ...VOCABULARY,
    topCodes: topOffenceCodes(),
  });
});

/**
 * Everything about one sheet, assembled once.
 *
 * The sheet is read first and indexed by line id, because four of the columns
 * on an event point at a line and resolving them in SQL would mean eight more
 * joins on a query that already has plenty.
 */
function sheetPayload(game) {
  const sheet = sheetFor(game.id).map(serialiseSheetLine);
  const byLine = new Map(sheet.map((line) => [line.id, line]));

  return {
    game: serialiseGame(game),
    sheet,
    events: eventsFor(game.id, game.clock_counts).map((row) => serialiseEvent(row, byLine)),
    goalies: goaliesFor(game.id).map((row) => serialiseGoalie(row, byLine)),
    summary: periodSummary(game.id),
    warnings: warningsFor(game),
  };
}

/**
 * Change events, then put the sheet totals back in step - as one write.
 *
 * Both halves have to land together: totals left describing events that rolled
 * back would be wrong everywhere lib/stats.js reads them, which is every
 * player profile on the site. node:sqlite has no transaction() helper, so the
 * BEGIN/COMMIT is by hand, the same way lib/teams.js does it.
 */
function withTotals(gameId, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    syncSheetTotals(gameId);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

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

    /* An opponent that is another team on this site, so the sheet can name
       both squads. 0 and '' both mean "not one of ours". */
    opponentTeamId:
      body.opponentTeamId === undefined
        ? existing.opponent_team_id ?? null
        : Number(body.opponentTeamId) || null,

    /* The official sheet's header. */
    eventName: str('eventName', existing.event_name, 200),
    gameNumber: str('gameNumber', existing.game_number, 40),
    startTime: str('startTime', existing.start_time, 20),
    endTime: str('endTime', existing.end_time, 20),
    spectators: num('spectators', existing.spectators),
    teamColour: str('teamColour', existing.team_colour, 60),
    opponentColour: str('opponentColour', existing.opponent_colour, 60),
    teamStaff: str('teamStaff', existing.team_staff, 2000),
    opponentStaff: str('opponentStaff', existing.opponent_staff, 2000),
    officials: str('officials', existing.officials, 2000),
    clockCounts: body.clockCounts === 'up' || body.clockCounts === 'down'
      ? body.clockCounts
      : existing.clock_counts || 'down',
  };
}

/* Every column readGameBody produces, in one place, so the insert and the
   update cannot drift apart - which is how a new field ends up settable on
   create and silently ignored on edit. */
const GAME_COLUMNS = [
  ['team_id', 'teamId'],
  ['opponent', 'opponent'],
  ['played_at', 'playedAt'],
  ['venue', 'venue'],
  ['competition', 'competition'],
  ['home_away', 'homeAway'],
  ['score_for', 'scoreFor'],
  ['score_against', 'scoreAgainst'],
  ['status', 'status'],
  ['notes', 'notes'],
  ['opponent_team_id', 'opponentTeamId'],
  ['event_name', 'eventName'],
  ['game_number', 'gameNumber'],
  ['start_time', 'startTime'],
  ['end_time', 'endTime'],
  ['spectators', 'spectators'],
  ['team_colour', 'teamColour'],
  ['opponent_colour', 'opponentColour'],
  ['team_staff', 'teamStaff'],
  ['opponent_staff', 'opponentStaff'],
  ['officials', 'officials'],
  ['clock_counts', 'clockCounts'],
];

adminGamesRouter.post('/games', (req, res) => {
  const v = readGameBody(req.body || {});
  if (!v.opponent) return res.status(400).json({ error: 'Name the opponent.' });

  const columns = GAME_COLUMNS.map(([column]) => column).join(', ');
  const holders = GAME_COLUMNS.map(() => '?').join(', ');

  const info = db
    .prepare(`INSERT INTO games (${columns}) VALUES (${holders})`)
    .run(...GAME_COLUMNS.map(([, key]) => v[key]));

  /* The slug needs the id, so it is a second write rather than part of the
     insert. gameSlug reads a games ROW, so it gets the column names rather
     than readGameBody's camelCase - passing the latter silently produced no
     date and fell back to game-<id> for every game. */
  const id = Number(info.lastInsertRowid);
  db.prepare('UPDATE games SET slug = ? WHERE id = ?').run(
    gameSlug({ id, played_at: v.playedAt, opponent: v.opponent }),
    id
  );

  res.status(201).json({ id });
});

adminGamesRouter.patch('/games/:id', (req, res) => {
  const existing = findGame(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Game not found.' });

  const v = readGameBody(req.body || {}, existing);

  const assignments = GAME_COLUMNS.map(([column]) => `${column} = ?`).join(', ');
  db.prepare(`UPDATE games SET ${assignments} WHERE id = ?`).run(
    ...GAME_COLUMNS.map(([, key]) => v[key]),
    existing.id
  );

  /* The web address is only recomputed when there is none, or when the admin
     explicitly asks. A published /games/<slug> is a link somebody shared, and
     quietly moving it because the date was corrected breaks that link for no
     benefit - the same reasoning as the 301s in routes/teams.js. */
  const wantsNewSlug = req.body?.reslug === true || !existing.slug;
  if (wantsNewSlug) {
    db.prepare('UPDATE games SET slug = ? WHERE id = ?').run(
      gameSlug({ ...existing, played_at: v.playedAt, opponent: v.opponent }, existing.id),
      existing.id
    );
  }

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

  /* Which squad this line belongs to. A sheet holds both when the opponent is
     another team on this site. */
  const side = body.side === 'them' ? 'them' : 'us';

  /* The sheet's L column: forward line or defence pair, 1 to 4. Anything else
     is left unset rather than clamped into a line the player was not on. */
  const lineNumber = [1, 2, 3, 4].includes(Number(body.lineNumber)) ? Number(body.lineNumber) : null;

  const info = db
    .prepare(
      `INSERT INTO game_sheet_players
         (game_id, player_id, registration_id, name, jersey_number, position, role, note,
          sort_order, side, line_number, best_player)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      next,
      side,
      lineNumber,
      body.bestPlayer ? 1 : 0
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
     that happened, it is a typo.

     Once a game is kept as events, these columns are a projection of them -
     syncSheetTotals writes them - so the body cannot set them. Accepting the
     number and overwriting it on the next event would be worse than refusing
     it: the admin would see its own edit vanish with no explanation. The
     screen renders them read-only for the same reason. */
  const derived = Boolean(db.prepare('SELECT events_mode FROM games WHERE id = ?').get(line.game_id)?.events_mode);

  const count = (key, fallback) => {
    if (derived || body[key] === undefined) return fallback ?? 0;
    const n = Math.round(Number(body[key]));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  /* Branch on PRESENCE, not membership. '' is a legal decision - it is what a
     skater has - so testing membership made the `line.decision` fallback
     unreachable: any PATCH that left `decision` out of the body silently wiped
     the goaltender's result. Every sibling above (str, count, role, played)
     already tests `=== undefined`; this one did not. */
  const DECISIONS = ['', 'W', 'L', 'OTL'];
  const sent = String(body.decision ?? '').toUpperCase();
  const decision =
    body.decision === undefined ? line.decision : DECISIONS.includes(sent) ? sent : line.decision;

  const side = body.side === undefined ? line.side : body.side === 'them' ? 'them' : 'us';

  const lineNumber =
    body.lineNumber === undefined
      ? line.line_number
      : [1, 2, 3, 4].includes(Number(body.lineNumber))
        ? Number(body.lineNumber)
        : null;

  db.prepare(
    `UPDATE game_sheet_players
        SET name = ?, jersey_number = ?, position = ?, role = ?, note = ?, sort_order = ?,
            goals = ?, assists = ?, penalty_minutes = ?,
            shots_against = ?, saves = ?, decision = ?, played = ?,
            side = ?, line_number = ?, best_player = ?, minutes_in_play = ?
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
    side,
    lineNumber,
    body.bestPlayer === undefined ? line.best_player : body.bestPlayer ? 1 : 0,
    count('minutesInPlay', line.minutes_in_play),
    line.id
  );

  res.json({ ok: true, derived });
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

  /* Either squad. The opponent's is only available when the opponent is
     another team on this site - otherwise there is no roster to copy. */
  const side = req.body?.side === 'them' ? 'them' : 'us';
  const teamId = side === 'them' ? game.opponent_team_id : game.team_id;

  if (!teamId) {
    return res.status(400).json({
      error:
        side === 'them'
          ? 'This opponent is not a team on this site, so there is no roster to add.'
          : 'Set the team on this game first.',
    });
  }

  const pool = candidatesFor(game);
  const players = side === 'them' ? pool.opponentPlayers : pool.players;
  if (!players.length) return res.json({ added: 0 });

  const start =
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM game_sheet_players WHERE game_id = ?').get(game.id)
      .n ?? 0;

  const insert = db.prepare(
    `INSERT INTO game_sheet_players
       (game_id, player_id, name, jersey_number, position, role, sort_order, side)
     VALUES (?, ?, '', ?, ?, 'player', ?, ?)`
  );

  db.exec('BEGIN');
  try {
    players.forEach((p, i) => {
      insert.run(game.id, p.id, p.jerseyNumber, p.position, start + i, side);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  res.json({ added: players.length, side });
});

/* --------------------------------------------------------------------------
   Events: goals and penalties
   --------------------------------------------------------------------------
   Every write here goes through withTotals, so the sheet's per-player figures
   and the events can never describe different games.
   -------------------------------------------------------------------------- */

/** A sheet line on this game, or null. Keeps one game's events off another. */
function lineOn(gameId, value) {
  const id = Number(value) || null;
  if (!id) return null;
  const row = db
    .prepare('SELECT id FROM game_sheet_players WHERE id = ? AND game_id = ?')
    .get(id, gameId);
  return row ? row.id : null;
}

function readEventBody(game, body, existing = {}) {
  const kind = body.kind === 'penalty' || body.kind === 'goal' ? body.kind : existing.kind || 'goal';
  const side = body.side === 'them' ? 'them' : body.side === 'us' ? 'us' : existing.side || 'us';
  const period = PERIODS.includes(String(body.period))
    ? String(body.period)
    : existing.period || '1';

  const time =
    body.time === undefined ? existing.time_mmss || '' : normaliseClock(body.time);

  const number =
    body.jerseyNumber === undefined
      ? existing.jersey_number ?? null
      : body.jerseyNumber === '' || body.jerseyNumber === null
        ? null
        : Number(body.jerseyNumber);

  const situation = Object.keys(GAME_SITUATIONS).includes(body.situation)
    ? body.situation
    : existing.game_situation || 'EQ';

  const minutes = PENALTY_MINUTES.includes(Number(body.minutes))
    ? Number(body.minutes)
    : existing.minutes ?? 2;

  /* An unknown offence code is dropped rather than stored. The browser is given
     the list in this same response, so a code that is not on it came from
     somewhere else. */
  const offence =
    body.offence === undefined
      ? existing.offence_code || ''
      : Object.keys(OFFENCE_CODES).includes(String(body.offence).toUpperCase())
        ? String(body.offence).toUpperCase()
        : '';

  const startsAt =
    body.startsAt === undefined ? existing.start_mmss || time : normaliseClock(body.startsAt);

  /* The end is computed from the start and the minutes, and only when nobody
     has typed one. It is a suggestion in an editable field, not a rule. */
  const endsAt =
    body.endsAt === undefined
      ? existing.end_mmss || penaltyEnd(startsAt, minutes, game.clock_counts)
      : normaliseClock(body.endsAt);

  return {
    kind,
    side,
    period,
    time_mmss: time,
    scorer_line_id: kind === 'goal' ? lineOn(game.id, body.scorerLineId ?? existing.scorer_line_id) : null,
    assist1_line_id: kind === 'goal' ? lineOn(game.id, body.assist1LineId ?? existing.assist1_line_id) : null,
    assist2_line_id: kind === 'goal' ? lineOn(game.id, body.assist2LineId ?? existing.assist2_line_id) : null,
    game_situation: kind === 'goal' ? situation : 'EQ',
    penalty_line_id: kind === 'penalty' ? lineOn(game.id, body.lineId ?? existing.penalty_line_id) : null,
    minutes: kind === 'penalty' ? minutes : 0,
    offence_code: kind === 'penalty' ? offence : '',
    start_mmss: kind === 'penalty' ? startsAt : '',
    end_mmss: kind === 'penalty' ? endsAt : '',
    jersey_number: Number.isFinite(number) ? number : null,
    name: body.name === undefined ? existing.name || '' : String(body.name).trim().slice(0, 160),
    note: body.note === undefined ? existing.note || '' : String(body.note).trim().slice(0, 400),
  };
}

const EVENT_COLUMNS = [
  'kind',
  'side',
  'period',
  'time_mmss',
  'scorer_line_id',
  'assist1_line_id',
  'assist2_line_id',
  'game_situation',
  'penalty_line_id',
  'minutes',
  'offence_code',
  'start_mmss',
  'end_mmss',
  'jersey_number',
  'name',
  'note',
];

adminGamesRouter.post('/games/:id/events', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const body = req.body || {};
  const clientId = String(body.clientId || '').trim().slice(0, 64);

  /* The live screen keeps unsent events in the browser and replays them when
     the connection comes back, so the same event can arrive twice. Answering
     the replay with the row it already made is what makes retrying safe - the
     alternative is a duplicate goal every time the rink wi-fi hiccups. */
  if (clientId) {
    const already = db
      .prepare('SELECT * FROM game_events WHERE client_id = ? AND game_id = ?')
      .get(clientId, game.id);
    if (already) return res.json({ id: already.id, duplicate: true, ...sheetPayload(game) });
  }

  const v = readEventBody(game, body);
  const columns = ['game_id', ...EVENT_COLUMNS, 'client_id'];
  const sql = `INSERT INTO game_events (${columns.join(', ')}) VALUES (${columns
    .map(() => '?')
    .join(', ')})`;

  const id = withTotals(game.id, () => {
    const info = db
      .prepare(sql)
      .run(game.id, ...EVENT_COLUMNS.map((column) => v[column]), clientId);
    return Number(info.lastInsertRowid);
  });

  res.status(201).json({ id, ...sheetPayload(findGame(game.id)) });
});

adminGamesRouter.patch('/games/:id/events/:eventId', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const existing = db
    .prepare('SELECT * FROM game_events WHERE id = ? AND game_id = ?')
    .get(Number(req.params.eventId), game.id);
  if (!existing) return res.status(404).json({ error: 'Event not found.' });

  const v = readEventBody(game, req.body || {}, existing);
  const assignments = EVENT_COLUMNS.map((column) => `${column} = ?`).join(', ');

  withTotals(game.id, () => {
    db.prepare(`UPDATE game_events SET ${assignments} WHERE id = ?`).run(
      ...EVENT_COLUMNS.map((column) => v[column]),
      existing.id
    );
  });

  res.json({ ok: true, ...sheetPayload(findGame(game.id)) });
});

adminGamesRouter.delete('/games/:id/events/:eventId', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  withTotals(game.id, () => {
    db.prepare('DELETE FROM game_events WHERE id = ? AND game_id = ?').run(
      Number(req.params.eventId),
      game.id
    );
  });

  res.json({ ok: true, ...sheetPayload(findGame(game.id)) });
});

/* --------------------------------------------------------------------------
   Goalkeeper records
   --------------------------------------------------------------------------
   Shots on goal exist nowhere else: the form counts saves and goals against,
   and shots against is their sum. One row per goalkeeper per period, enforced
   here because a UNIQUE constraint could not do it - SQLite treats NULLs as
   distinct, so an opponent keeper with no sheet line would slip past one.
   -------------------------------------------------------------------------- */
function readGoalieBody(game, body, existing = {}) {
  const side = body.side === 'them' ? 'them' : body.side === 'us' ? 'us' : existing.side || 'us';
  const period = PERIODS.includes(String(body.period))
    ? String(body.period)
    : existing.period || '1';

  const count = (key, column) => {
    if (body[key] === undefined) return existing[column] ?? 0;
    const n = Math.round(Number(body[key]));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const number =
    body.jerseyNumber === undefined
      ? existing.jersey_number ?? null
      : body.jerseyNumber === '' || body.jerseyNumber === null
        ? null
        : Number(body.jerseyNumber);

  return {
    side,
    period,
    sheet_line_id: lineOn(game.id, body.lineId ?? existing.sheet_line_id),
    jersey_number: Number.isFinite(number) ? number : null,
    name: body.name === undefined ? existing.name || '' : String(body.name).trim().slice(0, 160),
    minutes: count('minutes', 'minutes'),
    saves: count('saves', 'saves'),
    goals_against: count('goalsAgainst', 'goals_against'),
  };
}

const GOALIE_COLUMNS = [
  'side',
  'period',
  'sheet_line_id',
  'jersey_number',
  'name',
  'minutes',
  'saves',
  'goals_against',
];

adminGamesRouter.post('/games/:id/goalies', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const v = readGoalieBody(game, req.body || {});

  /* One row per goalkeeper per period. A second row for the same keeper would
     double their saves into the period summary. */
  const clash = v.sheet_line_id
    ? db
        .prepare(
          'SELECT id FROM game_goalies WHERE game_id = ? AND period = ? AND sheet_line_id = ?'
        )
        .get(game.id, v.period, v.sheet_line_id)
    : db
        .prepare(
          `SELECT id FROM game_goalies
            WHERE game_id = ? AND period = ? AND side = ?
              AND sheet_line_id IS NULL AND jersey_number IS ?`
        )
        .get(game.id, v.period, v.side, v.jersey_number);

  if (clash) {
    return res
      .status(400)
      .json({ error: 'That goaltender already has a record for this period. Edit it instead.' });
  }

  const columns = ['game_id', ...GOALIE_COLUMNS];
  const sql = `INSERT INTO game_goalies (${columns.join(', ')}) VALUES (${columns
    .map(() => '?')
    .join(', ')})`;

  const id = withTotals(game.id, () => {
    const info = db.prepare(sql).run(game.id, ...GOALIE_COLUMNS.map((column) => v[column]));
    return Number(info.lastInsertRowid);
  });

  res.status(201).json({ id, ...sheetPayload(findGame(game.id)) });
});

adminGamesRouter.patch('/games/:id/goalies/:goalieId', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  const existing = db
    .prepare('SELECT * FROM game_goalies WHERE id = ? AND game_id = ?')
    .get(Number(req.params.goalieId), game.id);
  if (!existing) return res.status(404).json({ error: 'Goaltender record not found.' });

  const v = readGoalieBody(game, req.body || {}, existing);
  const assignments = GOALIE_COLUMNS.map((column) => `${column} = ?`).join(', ');

  withTotals(game.id, () => {
    db.prepare(`UPDATE game_goalies SET ${assignments} WHERE id = ?`).run(
      ...GOALIE_COLUMNS.map((column) => v[column]),
      existing.id
    );
  });

  res.json({ ok: true, ...sheetPayload(findGame(game.id)) });
});

adminGamesRouter.delete('/games/:id/goalies/:goalieId', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  withTotals(game.id, () => {
    db.prepare('DELETE FROM game_goalies WHERE id = ? AND game_id = ?').run(
      Number(req.params.goalieId),
      game.id
    );
  });

  res.json({ ok: true, ...sheetPayload(findGame(game.id)) });
});

/* --------------------------------------------------------------------------
   Publishing
   --------------------------------------------------------------------------
   Deliberately separate from everything that edits the record, for the reason
   routes/admin.js gives for the donations visibility endpoint: putting a sheet
   in front of the public must never risk altering what it says.

   Note what this does NOT touch: games.status. Publishing reveals the page;
   status is what lib/stats.js counts towards a player's career. A coach has to
   be able to do either one without the other.
   -------------------------------------------------------------------------- */
adminGamesRouter.post('/games/:id/publish', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  /* No web address, no page to publish. Every game gets one on create and the
     boot backfill covers the older ones, so this is a belt-and-braces case. */
  let slug = game.slug;
  if (!slug) {
    slug = gameSlug(game, game.id);
    db.prepare('UPDATE games SET slug = ? WHERE id = ?').run(slug, game.id);
  }

  db.prepare('UPDATE games SET published = 1 WHERE id = ?').run(game.id);
  res.json({ ok: true, published: true, slug, url: `/games/${slug}` });
});

adminGamesRouter.post('/games/:id/unpublish', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  db.prepare('UPDATE games SET published = 0 WHERE id = ?').run(game.id);
  res.json({ ok: true, published: false });
});

/* --------------------------------------------------------------------------
   Live entry
   --------------------------------------------------------------------------
   One request for everything the rink-side screen needs, because a coach on a
   phone should wait for one round trip rather than five.
   -------------------------------------------------------------------------- */
adminGamesRouter.get('/games/:id/live', (req, res) => {
  const game = findGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found.' });

  res.json({
    ...sheetPayload(game),
    ...VOCABULARY,
    topCodes: topOffenceCodes(),
  });
});

/**
 * The games a coach might be about to keep: this week's, either way round.
 *
 * What the live screen shows when it is opened without a game chosen - from
 * the sidebar, in the car park, before anybody has picked the fixture.
 */
adminGamesRouter.get('/live/games', (req, res) => {
  const games = listGames().filter((game) => {
    if (game.status === 'cancelled') return false;
    if (!game.played_at) return true;
    const played = Date.parse(`${String(game.played_at).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(played)) return true;
    const days = (played - Date.now()) / 86_400_000;
    return days > -7 && days < 7;
  });

  res.json({ games: games.map((game) => serialiseGame(game)) });
});
