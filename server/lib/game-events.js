/**
 * The IIHF game sheet's own vocabulary.
 *
 * Every list here is read off the federation's Official_Game_Sheet fillable.pdf
 * (IIHF, October 2014). Page two of that form is the IIHF's own key to the
 * abbreviations and is the authority for all of it - where a label below reads
 * oddly in English, it reads that way on the form.
 *
 * These reach the browser through the admin API rather than being copied into
 * assets/admin/*.js, for the same reason ROLES and STATUSES already do: the
 * list the browser offers and the list the route validates against have to be
 * the same list, and two copies of forty-nine codes will not stay that way.
 */

import { db } from '../db.js';

/** Regulation, overtime, and the game-winning shots. */
export const PERIODS = ['1', '2', '3', 'OVT', 'GWS'];

export const PERIOD_LABEL = {
  1: 'First period',
  2: 'Second period',
  3: 'Third period',
  OVT: 'Overtime',
  GWS: 'Game-winning shots',
};

/** The short form for a table column, where "First period" will not fit. */
export const PERIOD_SHORT = { 1: 'P1', 2: 'P2', 3: 'P3', OVT: 'OT', GWS: 'GWS' };

/**
 * How many skaters were on the ice.
 *
 * The one field on a goal that is not optional, because the powerplay and
 * shorthand goal counts on the period summary are derived from it rather than
 * typed a second time.
 */
export const GAME_SITUATIONS = {
  EQ: 'Equal strength',
  '+1': 'Powerplay 5 on 4',
  '+2': 'Powerplay 5 on 3',
  '-1': 'Shorthand 4 on 5',
  '-2': 'Shorthand 3 on 5',
  PS: 'Penalty shot',
  EN: 'Empty net',
};

/** A powerplay goal for the side that scored it. */
export const POWERPLAY = ['+1', '+2'];

/** A goal scored a man down. */
export const SHORTHAND = ['-1', '-2'];

/** Minor, major, misconduct, match - and a penalty shot, which serves no time. */
export const PENALTY_MINUTES = [0, 2, 5, 10, 20];

export const PENALTY_MINUTES_LABEL = {
  0: 'Penalty shot',
  2: '2 - minor',
  5: '5 - major',
  10: '10 - misconduct',
  20: '20 - match',
};

/**
 * The forty-nine offence codes, and what each one stands for.
 *
 * Deliberately not a CHECK constraint on the column: the list changes between
 * rule books, and a changed CHECK means rebuilding the table, which the note
 * above addColumnIfMissing in db.js rules out. Validated here instead.
 */
export const OFFENCE_CODES = {
  ABUSE: 'Abuse of officials',
  BENCH: 'Bench minor',
  BITE: 'Biting',
  BOARD: 'Boarding',
  'BR-ST': 'Broken stick',
  'BUT-E': 'Butt-ending',
  CHARG: 'Charging',
  'CHE-B': 'Checking from behind',
  'CHE-H': 'Checking to the head or neck',
  CLIPP: 'Clipping',
  CLOS: 'Closing the hand on the puck',
  CROSS: 'Cross-checking',
  DANG: 'Dangerous equipment',
  DELAY: 'Delaying the game',
  ELBOW: 'Elbowing',
  EMBEL: 'Embellishment',
  'ENG-S': 'Entering or leaving the penalty bench',
  FIGHT: 'Fighting',
  'GK-INT': 'Goalkeeper interference',
  'GK-PEN': 'Goalkeeper penalty',
  'H-BUT': 'Head-butting',
  HELM: 'Helmet offence',
  'HI-ST': 'High sticking',
  'HO-ST': 'Holding the stick',
  HOLD: 'Holding',
  HOOK: 'Hooking',
  'ILL-H': 'Illegal hit',
  'ILL-ST': 'Illegal stick',
  INCAC: 'Instigating',
  INJUR: 'Injury not reported',
  INTRF: 'Interference',
  KICK: 'Kicking',
  KNEE: 'Kneeing',
  'L-BCH': 'Leaving the players bench',
  OTHER: 'Other',
  PULL: 'Pulling an opponent down',
  REFUSE: 'Refusing to start play',
  ROUGH: 'Roughing',
  SLASH: 'Slashing',
  SLEW: 'Slew-footing',
  SPEAR: 'Spearing',
  SPIT: 'Spitting',
  'T-BCH': 'Throwing equipment out of the bench',
  TAUNT: 'Taunting',
  TEE: 'Throwing equipment on the ice',
  'THR-ST': 'Throwing the stick',
  'TOO-M': 'Too many players on the ice',
  TRIP: 'Tripping',
  'UN-SP': 'Unsportsmanlike conduct',
};

/**
 * The eight that actually happen, roughly in order of how often.
 *
 * The seed for the live screen's shortcut row, which reorders itself from this
 * club's own history once there is any. Forty-nine codes do not fit on a
 * phone, and a coach should not be searching a list during a stoppage.
 */
export const COMMON_OFFENCES = ['TRIP', 'HOOK', 'SLASH', 'HOLD', 'INTRF', 'ROUGH', 'HI-ST', 'CROSS'];

/**
 * The two sides of one sheet.
 *
 * 'us' is always the team in games.team_id, never the home side. A/B and
 * home/away are a presentation of games.home_away and are worked out on the
 * way out - storing them would mean a later correction to home_away silently
 * relabelled every event already recorded.
 */
export const SIDES = { us: 'Us', them: 'Opponent' };

/**
 * The sheet's position letters.
 *
 * game_sheet_players.position is free text carrying the players table's own
 * vocabulary (forward / defence / goaltender / staff), but the official form
 * wants GK, D or F. Mapped on the way out rather than by changing the column,
 * and a value already in the IIHF vocabulary passes straight through, so a
 * coach who typed GK sees GK.
 */
const IIHF_POSITION = {
  goaltender: 'GK',
  goalkeeper: 'GK',
  defence: 'D',
  defense: 'D',
  defenceman: 'D',
  forward: 'F',
  staff: '',
  gk: 'GK',
  g: 'GK',
  d: 'D',
  f: 'F',
};

export function positionLetter(position) {
  const key = String(position || '')
    .trim()
    .toLowerCase();
  if (!key) return '';
  return IIHF_POSITION[key] ?? String(position).trim().toUpperCase().slice(0, 2);
}

/* --------------------------------------------------------------------------
   Clock arithmetic, shared by every event route
   -------------------------------------------------------------------------- */

/**
 * A clock reading, zero-padded.
 *
 * Takes what somebody types - "4:12" as readily as "04:12" - and returns
 * "04:12", so that a plain string sort over the column is already play order
 * and no second column of seconds has to be kept in step with it.
 *
 * An unreadable value becomes '', which renders as "time not recorded". That is
 * deliberately not an error: a coach who saw a goal but missed the clock must
 * still be able to record the goal.
 */
export function normaliseClock(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(raw);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** A clock reading as seconds, for arithmetic. Null when there is no time. */
export function clockToSeconds(value) {
  const clean = normaliseClock(value);
  if (!clean) return null;
  const [minutes, seconds] = clean.split(':');
  return Number(minutes) * 60 + Number(seconds);
}

export function secondsToClock(total) {
  if (total === null || total === undefined || !Number.isFinite(total)) return '';
  const clamped = Math.max(0, Math.round(total));
  const minutes = String(Math.floor(clamped / 60)).padStart(2, '0');
  return `${minutes}:${String(clamped % 60).padStart(2, '0')}`;
}

/**
 * When a penalty ends, assuming it is served in full.
 *
 * A countdown clock runs towards zero, so two minutes taken at 14:00 ends at
 * 12:00; counting up it ends at 16:00. A penalty shot serves no time and gets
 * no end at all.
 *
 * A penalty taken late in a period runs past the end of it. On a countdown that
 * comes back as 00:00 - the penalty ran to the horn - and the remainder carries
 * into the next period, which this cannot express because start and end are
 * clock readings with no period attached. It is a suggestion in an editable
 * field, not a calculation: the coach changes it if the carry-over matters.
 */
export function penaltyEnd(startMmss, minutes, clockCounts = 'down') {
  const start = clockToSeconds(startMmss);
  if (start === null || !minutes) return '';
  const delta = Number(minutes) * 60;
  return secondsToClock(clockCounts === 'up' ? start + delta : start - delta);
}

/* ==========================================================================
   The events themselves
   ========================================================================== */

/** The order the periods are played in. Text sort would put GWS before OVT. */
const PERIOD_RANK = { 1: 1, 2: 2, 3: 3, OVT: 4, GWS: 5 };

/**
 * Every goal and penalty on one sheet, in the order they happened.
 *
 * Sorted here rather than in SQL because the direction depends on the game: a
 * countdown clock makes a later event a SMALLER number, so ascending time would
 * read the period backwards. A sheet holds a few dozen events at most, so doing
 * it in JavaScript costs nothing and keeps one rule in one place.
 *
 * An event with no time recorded sorts last within its period - it happened,
 * the clock was missed, and guessing where it belongs would be worse.
 */
export function eventsFor(gameId, clockCounts = 'down') {
  const rows = db.prepare('SELECT * FROM game_events WHERE game_id = ?').all(Number(gameId));
  const descending = clockCounts !== 'up';

  return rows.sort((a, b) => {
    const period = (PERIOD_RANK[a.period] || 9) - (PERIOD_RANK[b.period] || 9);
    if (period) return period;

    if (!a.time_mmss !== !b.time_mmss) return a.time_mmss ? -1 : 1;
    if (a.time_mmss !== b.time_mmss) {
      return descending ? b.time_mmss.localeCompare(a.time_mmss) : a.time_mmss.localeCompare(b.time_mmss);
    }
    return a.id - b.id;
  });
}

/** The goalkeeper records on one sheet, ours first, then by period. */
export function goaliesFor(gameId) {
  return db
    .prepare('SELECT * FROM game_goalies WHERE game_id = ? ORDER BY (side = \'them\') ASC, period, id')
    .all(Number(gameId));
}

/**
 * Who an event belongs to.
 *
 * A line on the sheet when there is one - which is where the name, the number
 * and the link to a player profile come from - and otherwise whatever the
 * scorekeeper typed. An opponent with no squad on this site only ever has the
 * latter, and an event can legitimately have neither: a goal nobody could
 * attribute in the moment still counts on the scoreboard.
 */
function person(lineId, byLine, fallbackName, fallbackNumber) {
  const line = lineId ? byLine.get(lineId) : null;
  if (line) {
    return {
      lineId: line.id,
      name: line.name,
      jerseyNumber: line.jerseyNumber,
      playerSlug: line.playerSlug || '',
    };
  }

  const name = String(fallbackName || '').trim();
  const number = fallbackNumber ?? null;
  if (!name && number === null) return null;

  return {
    lineId: null,
    name: name || (number === null ? '' : `#${number}`),
    jerseyNumber: number,
    playerSlug: '',
  };
}

/**
 * One event as the API and the pages see it.
 *
 * `byLine` is a Map of sheet-line id to serialised line, built once by the
 * caller from sheetFor() - four line references per event would otherwise mean
 * eight more joins on a query that already has plenty.
 */
export function serialiseEvent(row, byLine = new Map()) {
  const base = {
    id: row.id,
    kind: row.kind,
    side: row.side,
    period: row.period,
    periodLabel: PERIOD_LABEL[row.period] || row.period,
    periodShort: PERIOD_SHORT[row.period] || row.period,
    time: row.time_mmss || '',
    note: row.note || '',
    clientId: row.client_id || '',
  };

  if (row.kind === 'goal') {
    const assists = [
      person(row.assist1_line_id, byLine),
      person(row.assist2_line_id, byLine),
    ].filter(Boolean);

    return {
      ...base,
      scorer: person(row.scorer_line_id, byLine, row.name, row.jersey_number),
      assists,
      situation: row.game_situation,
      situationLabel: GAME_SITUATIONS[row.game_situation] || row.game_situation,
      powerplay: POWERPLAY.includes(row.game_situation),
      shorthand: SHORTHAND.includes(row.game_situation),
    };
  }

  return {
    ...base,
    player: person(row.penalty_line_id, byLine, row.name, row.jersey_number),
    minutes: row.minutes,
    minutesLabel: PENALTY_MINUTES_LABEL[row.minutes] || `${row.minutes}`,
    offence: row.offence_code || '',
    offenceLabel: OFFENCE_CODES[row.offence_code] || row.offence_code || '',
    startsAt: row.start_mmss || '',
    endsAt: row.end_mmss || '',
  };
}

export function serialiseGoalie(row, byLine = new Map()) {
  const who = person(row.sheet_line_id, byLine, row.name, row.jersey_number);

  return {
    id: row.id,
    side: row.side,
    period: row.period,
    periodLabel: PERIOD_LABEL[row.period] || row.period,
    periodShort: PERIOD_SHORT[row.period] || row.period,
    lineId: row.sheet_line_id ?? null,
    name: who?.name || '',
    jerseyNumber: who?.jerseyNumber ?? null,
    playerSlug: who?.playerSlug || '',
    minutes: row.minutes || 0,
    saves: row.saves || 0,
    goalsAgainst: row.goals_against || 0,
    /* The official form counts saves and goals against; shots against is their
       sum and is never typed. */
    shotsAgainst: (row.saves || 0) + (row.goals_against || 0),
  };
}

/* ==========================================================================
   Derivation
   ========================================================================== */

/**
 * Rewrite every sheet line's totals from the events.
 *
 * The line columns stay the one thing lib/stats.js reads, so every player
 * profile, game log and team total keeps working untouched. They become a
 * PROJECTION of the events rather than a second place a number is entered -
 * which is what stops the two disagreeing, because there is nothing to
 * disagree with.
 *
 * Must be called inside the same transaction as whatever changed an event, or
 * a failed write leaves the totals describing a game that no longer exists.
 *
 * One statement with correlated subqueries rather than a row at a time: a
 * twenty-three line sheet would otherwise be twenty-three updates. The assists
 * subquery uses OR across both columns instead of adding two counts, because a
 * player cannot hold both assists on one goal.
 */
export function syncSheetTotals(gameId) {
  const id = Number(gameId);

  db.prepare(
    `UPDATE game_sheet_players SET
       goals = (SELECT COUNT(*) FROM game_events e
                 WHERE e.game_id = ?1 AND e.kind = 'goal'
                   AND e.scorer_line_id = game_sheet_players.id),
       assists = (SELECT COUNT(*) FROM game_events e
                   WHERE e.game_id = ?1 AND e.kind = 'goal'
                     AND (e.assist1_line_id = game_sheet_players.id
                       OR e.assist2_line_id = game_sheet_players.id)),
       penalty_minutes = (SELECT COALESCE(SUM(e.minutes), 0) FROM game_events e
                           WHERE e.game_id = ?1 AND e.kind = 'penalty'
                             AND e.penalty_line_id = game_sheet_players.id),
       saves = (SELECT COALESCE(SUM(k.saves), 0) FROM game_goalies k
                 WHERE k.game_id = ?1 AND k.sheet_line_id = game_sheet_players.id),
       shots_against = (SELECT COALESCE(SUM(k.saves + k.goals_against), 0) FROM game_goalies k
                         WHERE k.game_id = ?1 AND k.sheet_line_id = game_sheet_players.id),
       minutes_in_play = (SELECT COALESCE(SUM(k.minutes), 0) FROM game_goalies k
                           WHERE k.game_id = ?1 AND k.sheet_line_id = game_sheet_players.id)
     WHERE game_id = ?1`
  ).run(id);

  /* Once a game is kept as events, say so, rather than working it out later
     from whether any still exist. A real 0-0 game has no events and is still
     event-entered, and deleting the last event must not quietly hand the game
     back to totals somebody typed weeks ago. */
  db.prepare('UPDATE games SET events_mode = 1 WHERE id = ?').run(id);
}

/**
 * The period summary, as the official form lays it out.
 *
 * Everything here is counted from the events except shots on goal, which the
 * form takes from the goalkeeper record - saves plus goals against - and which
 * therefore comes from the OTHER side's goalkeepers. Nothing in this block is
 * stored: a figure that is typed as well as derived is a figure that can
 * disagree with itself.
 *
 * PPGF and SHGF fall straight out of the game situation on each goal, which is
 * the whole reason that field is not optional.
 */
export function periodSummary(gameId) {
  const id = Number(gameId);

  const goals = db
    .prepare(
      `SELECT period, side, game_situation, COUNT(*) AS n
         FROM game_events WHERE game_id = ? AND kind = 'goal'
        GROUP BY period, side, game_situation`
    )
    .all(id);

  const penalties = db
    .prepare(
      `SELECT period, side, COALESCE(SUM(minutes), 0) AS pim
         FROM game_events WHERE game_id = ? AND kind = 'penalty'
        GROUP BY period, side`
    )
    .all(id);

  const saves = db
    .prepare(
      `SELECT period, side, COALESCE(SUM(saves + goals_against), 0) AS sog
         FROM game_goalies WHERE game_id = ?
        GROUP BY period, side`
    )
    .all(id);

  const blank = () => ({ goals: 0, sog: 0, pim: 0, ppgf: 0, shgf: 0 });
  const rows = new Map(PERIODS.map((p) => [p, { us: blank(), them: blank() }]));
  const cell = (period, side) => rows.get(period)?.[side === 'them' ? 'them' : 'us'] || null;

  for (const row of goals) {
    const target = cell(row.period, row.side);
    if (!target) continue;
    target.goals += row.n;
    if (POWERPLAY.includes(row.game_situation)) target.ppgf += row.n;
    if (SHORTHAND.includes(row.game_situation)) target.shgf += row.n;
  }

  for (const row of penalties) {
    const target = cell(row.period, row.side);
    if (target) target.pim += row.pim;
  }

  /* A goalkeeper's saves and goals against are the shots the OTHER side took. */
  for (const row of saves) {
    const target = cell(row.period, row.side === 'them' ? 'us' : 'them');
    if (target) target.sog += row.sog;
  }

  const periods = PERIODS.map((period) => ({
    period,
    label: PERIOD_LABEL[period] || period,
    short: PERIOD_SHORT[period] || period,
    us: rows.get(period).us,
    them: rows.get(period).them,
  }));

  const total = { us: blank(), them: blank() };
  for (const row of periods) {
    for (const side of ['us', 'them']) {
      for (const key of ['goals', 'sog', 'pim', 'ppgf', 'shgf']) {
        total[side][key] += row[side][key];
      }
    }
  }

  return {
    /* A period nobody played is dropped, so a regulation game does not show
       two empty rows for overtime and the shootout. */
    periods: periods.filter(
      (row) =>
        ['1', '2', '3'].includes(row.period) ||
        Object.values(row.us).some(Boolean) ||
        Object.values(row.them).some(Boolean)
    ),
    total,
  };
}

/**
 * What is wrong with this sheet, said out loud rather than fixed silently.
 *
 * The headline score is deliberately NOT rewritten from the events. It appears
 * on the games list, on the team page and on every row of every player's game
 * log, so an accidental event delete silently changing it everywhere is a far
 * worse failure than a badge on one admin screen. A game decided on shots also
 * legitimately ends one goal above the event count, and the shootout grid is
 * not something this records.
 *
 * An uncredited goal is likewise a warning and never a block: a coach who saw
 * the puck go in but not the number has to be able to record the goal, and
 * refusing it is how a tool gets abandoned in the second period.
 */
export function warningsFor(game) {
  const id = Number(game.id);
  const warnings = [];

  const counted = db
    .prepare(
      `SELECT side, COUNT(*) AS n FROM game_events
        WHERE game_id = ? AND kind = 'goal' GROUP BY side`
    )
    .all(id);

  const us = counted.find((r) => r.side === 'us')?.n || 0;
  const them = counted.find((r) => r.side === 'them')?.n || 0;

  if (game.score_for !== null && game.score_against !== null && (us || them)) {
    if (us !== game.score_for || them !== game.score_against) {
      warnings.push(
        `The goals recorded say ${us}-${them}, but the score on this game says ` +
          `${game.score_for}-${game.score_against}.`
      );
    }
  }

  const uncredited = db
    .prepare(
      `SELECT COUNT(*) AS n FROM game_events
        WHERE game_id = ? AND kind = 'goal' AND side = 'us' AND scorer_line_id IS NULL`
    )
    .get(id).n;

  if (uncredited) {
    warnings.push(
      `${uncredited} goal${uncredited === 1 ? '' : 's'} on our side ${
        uncredited === 1 ? 'has' : 'have'
      } no scorer against ${uncredited === 1 ? 'it' : 'them'} yet.`
    );
  }

  const unnamed = db
    .prepare(
      `SELECT COUNT(*) AS n FROM game_events
        WHERE game_id = ? AND kind = 'penalty' AND offence_code = ''`
    )
    .get(id).n;

  if (unnamed) {
    warnings.push(`${unnamed} penalt${unnamed === 1 ? 'y has' : 'ies have'} no offence recorded.`);
  }

  return warnings;
}

/**
 * The offence codes this club actually calls, commonest first.
 *
 * Feeds the live screen's shortcut row. Seeded from COMMON_OFFENCES so the row
 * is useful before there is any history, then reordered by what has really been
 * recorded - a league has its own habits, and forty-nine codes do not fit on a
 * phone.
 */
export function topOffenceCodes(limit = 9) {
  const seen = db
    .prepare(
      `SELECT offence_code AS code, COUNT(*) AS n
         FROM game_events
        WHERE kind = 'penalty' AND offence_code <> ''
        GROUP BY offence_code ORDER BY n DESC, code`
    )
    .all();

  const ordered = [];
  for (const row of seen) {
    if (OFFENCE_CODES[row.code] && !ordered.includes(row.code)) ordered.push(row.code);
  }
  for (const code of COMMON_OFFENCES) {
    if (!ordered.includes(code)) ordered.push(code);
  }

  return ordered.slice(0, limit);
}
