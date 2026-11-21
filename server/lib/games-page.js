/**
 * The public face of a game sheet: the archive list and one page per match.
 *
 * Everything shown here is derived on read, exactly as lib/stats.js is - the
 * period summary, the shots on goal and the per-player lines all come out of
 * the event rows and the goalkeeper records. Nothing is stored twice, so a
 * correction made on the admin screen is live here the moment it is saved.
 *
 * Only the existing public classes are used: .section, .roster-table with a
 * data-label on every cell (that is what collapses these tables into cards on
 * a phone), .player-stats and .stat-row. No new layout vocabulary.
 */
import { config } from '../config.js';
import { escapeHtml, textToHtml, lineList, intoShell, socialMeta } from './page.js';
import { sheetFor, serialiseSheetLine } from './games.js';
import {
  eventsFor,
  goaliesFor,
  periodSummary,
  serialiseEvent,
  serialiseGoalie,
  PERIOD_SHORT,
} from './game-events.js';

const dash = '–';

/** A date to read, falling back to the raw value when it is not a real one. */
function dateLabel(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw) return 'Date not set';
  const at = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(at)) return raw;
  return new Date(at).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const scoreLine = (game) =>
  game.score_for === null || game.score_against === null
    ? ''
    : `${game.score_for}${dash}${game.score_against}`;

/** Us first, always - this is our site, whichever end of the rink we were on. */
const sideName = (game, side) =>
  side === 'them'
    ? game.opponent_team_name || game.opponent || 'Opponent'
    : game.team_name || 'Lebanon Hockey';

/**
 * Everything one match page needs, read once.
 *
 * Shared with the index so a row there can show the result without a second
 * pass over the events.
 */
export function gameDetail(game) {
  const sheet = sheetFor(game.id).map(serialiseSheetLine);
  const byLine = new Map(sheet.map((line) => [line.id, line]));

  return {
    game,
    sheet,
    events: eventsFor(game.id, game.clock_counts).map((row) => serialiseEvent(row, byLine)),
    goalies: goaliesFor(game.id).map((row) => serialiseGoalie(row, byLine)),
    summary: periodSummary(game.id),
  };
}

/* A name links to the profile when the person has one. A guest on the sheet,
   or an opponent known only by a number, is plain text. */
function personName(person) {
  if (!person) return '<span class="cell-muted">Not credited</span>';
  const label = `${person.jerseyNumber === null ? '' : `#${person.jerseyNumber} `}${
    person.name || 'Unnamed'
  }`;
  return person.playerSlug
    ? `<a href="/players/${escapeHtml(person.playerSlug)}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
}

/* ==========================================================================
   The index
   ========================================================================== */
export function renderGamesIndex(games, shellHtml) {
  const title = `Game sheets · Lebanon Hockey`;
  const description =
    'Published match records: goals, penalties, goaltender records and both line-ups, for every game the federation has entered.';

  const rows = games
    .map((game) => {
      const score = scoreLine(game);
      return `
                  <tr>
                    <td data-label="Date">${escapeHtml(dateLabel(game.played_at))}</td>
                    <td data-label="Match" class="roster-name">
                      <a href="/games/${escapeHtml(game.slug)}">${escapeHtml(
                        sideName(game, 'us')
                      )} v ${escapeHtml(sideName(game, 'them'))}</a>
                      ${
                        game.home_away === 'away'
                          ? ' <span class="cell-away">(away)</span>'
                          : ''
                      }
                    </td>
                    <td data-label="Score">${score ? escapeHtml(score) : '&mdash;'}</td>
                    <td data-label="Competition" class="cell-muted">${escapeHtml(
                      game.competition || ''
                    )}</td>
                    <td data-label="Venue" class="cell-muted">${escapeHtml(game.venue || '')}</td>
                  </tr>`;
    })
    .join('');

  const main = `
      <section class="hero page-hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">Our Teams</p>
          </div>
          <h1>Game sheets</h1>
          <p>Every published match, with the goals, penalties and both line-ups behind the result.</p>
        </div>
      </section>

      <section class="section reveal">
        ${
          games.length
            ? `<div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Match</th>
                <th scope="col">Score</th>
                <th scope="col">Competition</th>
                <th scope="col">Venue</th>
              </tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>`
            : '<p class="empty-note">No match has been published yet. Check back after the next game.</p>'
        }

        <div class="section-cta">
          <a class="button ghost" href="/teams">Our teams</a>
        </div>
      </section>`;

  return intoShell(shellHtml, {
    title,
    description,
    meta: socialMeta({
      title: 'Game sheets',
      description,
      url: `${config.appUrl}/games`,
    }),
    main,
  });
}

/* ==========================================================================
   One match
   ========================================================================== */
function summaryTable(game, summary) {
  const cell = (row, side, key) => `<td data-label="${escapeHtml(
    `${PERIOD_SHORT[row.period] || row.period} ${key.toUpperCase()}`
  )}">${escapeHtml(String(row[side][key]))}</td>`;

  const line = (side) => `
                  <tr>
                    <td data-label="Team" class="roster-name">${escapeHtml(
                      sideName(game, side)
                    )}</td>
                    ${summary.periods
                      .map(
                        (row) =>
                          `<td data-label="${escapeHtml(
                            PERIOD_SHORT[row.period] || row.period
                          )}">${escapeHtml(String(row[side].goals))} <span class="cell-muted">(${escapeHtml(
                            String(row[side].sog)
                          )} SOG, ${escapeHtml(String(row[side].pim))} PIM)</span></td>`
                      )
                      .join('')}
                    <td data-label="Total">${escapeHtml(String(summary.total[side].goals))}
                      <span class="cell-muted">(${escapeHtml(
                        String(summary.total[side].sog)
                      )} SOG, ${escapeHtml(String(summary.total[side].pim))} PIM)</span></td>
                  </tr>`;

  return `<div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                ${summary.periods
                  .map(
                    (row) =>
                      `<th scope="col">${escapeHtml(PERIOD_SHORT[row.period] || row.period)}</th>`
                  )
                  .join('')}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>${line('us')}${line('them')}
            </tbody>
          </table>
        </div>`;
}

function eventsTable(game, events, kind) {
  const rows = events.filter((event) => event.kind === kind);
  if (!rows.length) return '';

  const head =
    kind === 'goal'
      ? '<th scope="col">Scorer</th><th scope="col">Assists</th><th scope="col">Situation</th>'
      : '<th scope="col">Player</th><th scope="col">Minutes</th><th scope="col">Offence</th>';

  const body = rows
    .map((event) => {
      const detail =
        kind === 'goal'
          ? `<td data-label="Scorer" class="roster-name">${personName(event.scorer)}</td>
                    <td data-label="Assists">${
                      event.assists.length
                        ? event.assists.map(personName).join(', ')
                        : '<span class="cell-muted">Unassisted</span>'
                    }</td>
                    <td data-label="Situation">${escapeHtml(event.situation)}</td>`
          : `<td data-label="Player" class="roster-name">${personName(event.player)}</td>
                    <td data-label="Minutes">${escapeHtml(String(event.minutes))}</td>
                    <td data-label="Offence">${
                      event.offence
                        ? `${escapeHtml(event.offence)} <span class="cell-muted">${escapeHtml(
                            event.offenceLabel
                          )}</span>`
                        : '<span class="cell-muted">Not recorded</span>'
                    }</td>`;

      return `
                  <tr>
                    <td data-label="Period">${escapeHtml(
                      event.periodShort || event.period
                    )}</td>
                    <td data-label="Time">${escapeHtml(event.time || '&mdash;')}</td>
                    <td data-label="Team">${escapeHtml(sideName(game, event.side))}</td>
                    ${detail}
                  </tr>`;
    })
    .join('');

  return `
        <h2 class="squad-heading">${kind === 'goal' ? 'Goals' : 'Penalties'}</h2>
        <div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Time</th>
                <th scope="col">Team</th>
                ${head}
              </tr>
            </thead>
            <tbody>${body}
            </tbody>
          </table>
        </div>`;
}

function goaliesTable(game, goalies) {
  if (!goalies.length) return '';

  const body = goalies
    .map(
      (keeper) => `
                  <tr>
                    <td data-label="Team">${escapeHtml(sideName(game, keeper.side))}</td>
                    <td data-label="Goaltender" class="roster-name">${personName(keeper)}</td>
                    <td data-label="Period">${escapeHtml(keeper.periodShort || keeper.period)}</td>
                    <td data-label="Minutes">${escapeHtml(String(keeper.minutes))}</td>
                    <td data-label="Shots">${escapeHtml(String(keeper.shotsAgainst))}</td>
                    <td data-label="Saves">${escapeHtml(String(keeper.saves))}</td>
                    <td data-label="Goals against">${escapeHtml(String(keeper.goalsAgainst))}</td>
                  </tr>`
    )
    .join('');

  return `
        <h2 class="squad-heading">Goaltenders</h2>
        <div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Goaltender</th>
                <th scope="col">Period</th>
                <th scope="col">Minutes</th>
                <th scope="col">Shots</th>
                <th scope="col">Saves</th>
                <th scope="col">Goals against</th>
              </tr>
            </thead>
            <tbody>${body}
            </tbody>
          </table>
        </div>`;
}

/* The literal answer to "all the statistics of the player in each match". */
function lineUp(game, sheet, side) {
  const lines = sheet.filter((line) => line.side === side);
  if (!lines.length) return '';

  const badges = (line) =>
    [
      line.role === 'captain' ? 'C' : '',
      line.role === 'alternate' ? 'A' : '',
      line.role === 'starting_goaltender' ? 'GK' : '',
      line.bestPlayer ? 'BP' : '',
    ]
      .filter(Boolean)
      .map((text) => `<span class="cell-badge">${escapeHtml(text)}</span>`)
      .join(' ');

  const body = lines
    .map(
      (line) => `
                  <tr${line.played ? '' : ' class="is-scratched"'}>
                    <td data-label="#">${
                      line.jerseyNumber === null ? '&mdash;' : escapeHtml(String(line.jerseyNumber))
                    }</td>
                    <td data-label="Name" class="roster-name">${
                      line.playerSlug
                        ? `<a href="/players/${escapeHtml(line.playerSlug)}">${escapeHtml(
                            line.name || 'Unnamed'
                          )}</a>`
                        : escapeHtml(line.name || 'Unnamed')
                    } ${badges(line)}</td>
                    <td data-label="Position">${escapeHtml(line.positionLetter || '')}</td>
                    <td data-label="Line">${
                      line.lineNumber === null ? '' : escapeHtml(String(line.lineNumber))
                    }</td>
                    <td data-label="Goals">${escapeHtml(String(line.goals))}</td>
                    <td data-label="Assists">${escapeHtml(String(line.assists))}</td>
                    <td data-label="Points">${escapeHtml(String(line.points))}</td>
                    <td data-label="Penalty minutes">${escapeHtml(
                      String(line.penaltyMinutes)
                    )}</td>
                  </tr>`
    )
    .join('');

  return `
        <h2 class="squad-heading">${escapeHtml(sideName(game, side))}</h2>
        <div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Pos</th>
                <th scope="col">Line</th>
                <th scope="col">G</th>
                <th scope="col">A</th>
                <th scope="col">P</th>
                <th scope="col">PIM</th>
              </tr>
            </thead>
            <tbody>${body}
            </tbody>
          </table>
        </div>`;
}

export function renderGamePage(detail, shellHtml) {
  const { game, sheet, events, goalies, summary } = detail;

  const us = sideName(game, 'us');
  const them = sideName(game, 'them');
  const score = scoreLine(game);
  const heading = score ? `${us} ${score} ${them}` : `${us} v ${them}`;
  const title = `${heading} · Lebanon Hockey`;
  const description = [
    dateLabel(game.played_at),
    game.competition,
    game.venue,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts = [
    ['Date', dateLabel(game.played_at)],
    ['Venue', game.venue],
    ['Competition', game.competition],
    ['Event', game.event_name],
    ['Game number', game.game_number],
    ['Start', game.start_time],
    ['Spectators', game.spectators === null ? '' : String(game.spectators)],
    [`${us} colours`, game.team_colour],
    [`${them} colours`, game.opponent_colour],
  ].filter(([, value]) => value);

  const main = `
      <section class="hero page-hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">Game sheet</p>
          </div>
          <h1>${escapeHtml(heading)}</h1>
          <p>${escapeHtml(description)}${
            game.home_away === 'away' ? ' &middot; away' : ''
          }</p>
        </div>
      </section>

      <section class="section reveal">
        ${
          facts.length
            ? `<div class="player-stats">
          <h2>The match</h2>
          <div class="stat-row">
            ${facts
              .map(
                ([label, value]) => `
            <div class="stat-figure">
              <span class="stat-value">${escapeHtml(value)}</span>
              <span class="stat-label">${escapeHtml(label)}</span>
            </div>`
              )
              .join('')}
          </div>
        </div>`
            : ''
        }

        <h2 class="squad-heading">By period</h2>
        ${summaryTable(game, summary)}

        ${eventsTable(game, events, 'goal')}
        ${eventsTable(game, events, 'penalty')}
        ${goaliesTable(game, goalies)}

        ${lineUp(game, sheet, 'us')}
        ${lineUp(game, sheet, 'them')}

        ${
          game.officials || game.team_staff || game.opponent_staff
            ? `<div class="team-facts">
          ${
            game.team_staff
              ? `<div class="team-facts-col"><h2>${escapeHtml(
                  us
                )} staff</h2>${lineList(game.team_staff, 'team-staff')}</div>`
              : ''
          }
          ${
            game.opponent_staff
              ? `<div class="team-facts-col"><h2>${escapeHtml(
                  them
                )} staff</h2>${lineList(game.opponent_staff, 'team-staff')}</div>`
              : ''
          }
          ${
            game.officials
              ? `<div class="team-facts-col"><h2>Officials</h2>${lineList(
                  game.officials,
                  'team-staff'
                )}</div>`
              : ''
          }
        </div>`
            : ''
        }

        ${game.notes ? `<div class="post-article">${textToHtml(game.notes)}</div>` : ''}

        <div class="section-cta">
          <a class="button ghost" href="/games">All game sheets</a>
          <a class="button ghost" href="/teams">Our teams</a>
        </div>
      </section>`;

  return intoShell(shellHtml, {
    title,
    description,
    meta: socialMeta({
      title: heading,
      description,
      url: `${config.appUrl}/games/${game.slug}`,
      type: 'article',
    }),
    main,
  });
}
