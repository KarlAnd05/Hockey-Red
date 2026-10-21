/**
 * Teams and players.
 *
 * The federation runs four programmes. Each one is a team row; each player is a
 * row pointing at it, with a slug so there is a page per player that previews
 * properly when the link is shared.
 *
 * This supersedes roster_players for the public Our Teams section. The old
 * table is left in place and still drives the roster tables on the programme
 * pages - the two are kept in step by migrateRosterToPlayers() rather than by
 * dropping one, because the programme pages are generated HTML with their own
 * markup and rewriting them is a separate piece of work.
 */
import { db } from '../db.js';
import { config } from '../config.js';

export const SQUADS = {
  national: 'National Team',
  next_gen: 'Next Generation',
};

export const POSITIONS = ['forward', 'defence', 'goaltender', 'staff'];

export const POSITION_LABEL = {
  forward: 'Forward',
  defence: 'Defence',
  goaltender: 'Goaltender',
  staff: 'Staff',
};

/* --------------------------------------------------------------------------
   Slugs
   -------------------------------------------------------------------------- */
export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * A slug nothing else is using.
 *
 * Two players really can share a name, and a name is the only thing we have to
 * build a slug from, so the collision case is ordinary rather than exotic.
 */
export function uniqueSlug(base, table, excludeId = null) {
  const root = slugify(base) || 'player';
  const sql =
    excludeId === null
      ? `SELECT 1 FROM ${table} WHERE slug = ?`
      : `SELECT 1 FROM ${table} WHERE slug = ? AND id <> ?`;

  let candidate = root;
  let n = 2;
  while (db.prepare(sql).get(...(excludeId === null ? [candidate] : [candidate, excludeId]))) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

/* --------------------------------------------------------------------------
   Reads
   -------------------------------------------------------------------------- */
export function listTeams({ includeInactive = false } = {}) {
  return db
    .prepare(
      `SELECT * FROM teams ${includeInactive ? '' : 'WHERE active = 1'}
        ORDER BY sort_order, id`
    )
    .all();
}

export function findTeam(id) {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(Number(id)) || null;
}

export function findTeamBySlug(slug) {
  return db.prepare('SELECT * FROM teams WHERE slug = ?').get(String(slug || '')) || null;
}

export function listPlayers(teamId, { includeInactive = false } = {}) {
  const where = ['team_id = ?'];
  if (!includeInactive) where.push('active = 1');

  return db
    .prepare(`SELECT * FROM players WHERE ${where.join(' AND ')} ORDER BY sort_order, id`)
    .all(Number(teamId));
}

export function findPlayer(id) {
  return db.prepare('SELECT * FROM players WHERE id = ?').get(Number(id)) || null;
}

export function findPlayerBySlug(slug) {
  return db.prepare('SELECT * FROM players WHERE slug = ?').get(String(slug || '')) || null;
}

/** Count players per team in one query, for the team cards. */
export function playerCounts({ includeInactive = false } = {}) {
  const rows = db
    .prepare(
      `SELECT team_id, COUNT(*) n FROM players
        ${includeInactive ? '' : 'WHERE active = 1'}
        GROUP BY team_id`
    )
    .all();

  return new Map(rows.map((r) => [r.team_id, r.n]));
}

/* --------------------------------------------------------------------------
   Serialisation
   -------------------------------------------------------------------------- */
export function serialiseTeam(team, extra = {}) {
  return {
    id: team.id,
    slug: team.slug,
    name: team.name,
    tagline: team.tagline,
    description: team.description,
    photoUrl: team.photo_url,
    photoAlt: team.photo_alt,
    staff: team.staff || '',
    honours: team.honours || '',
    program: team.program,
    active: Boolean(team.active),
    sortOrder: team.sort_order,
    ...extra,
  };
}

export function serialisePlayer(player, team = null) {
  return {
    id: player.id,
    slug: player.slug,
    name: player.name,
    squad: player.squad,
    squadLabel: SQUADS[player.squad] || '',
    position: player.position,
    positionLabel: POSITION_LABEL[player.position] || player.position,
    jerseyNumber: player.jersey_number,
    photoUrl: player.photo_url,
    photoAlt: player.photo_alt,
    bio: player.bio,
    priorGames: player.prior_games || 0,
    priorGoals: player.prior_goals || 0,
    priorAssists: player.prior_assists || 0,
    priorNote: player.prior_note || '',
    recentTeam: player.recent_team,
    resides: player.resides,
    hometown: player.hometown,
    active: Boolean(player.active),
    sortOrder: player.sort_order,
    teamId: player.team_id,
    teamSlug: team ? team.slug : undefined,
    teamName: team ? team.name : undefined,
  };
}

/**
 * Group a team's players into the squads the live site shows.
 *
 * A team with no squad labels (the men's, youth and Panthers rosters today)
 * comes back as a single unnamed group rather than an empty list, so the page
 * renders the same way whether or not the squad split is in use.
 */
export function groupBySquad(players) {
  const order = ['national', 'next_gen', ''];
  const groups = new Map();

  for (const p of players) {
    const key = SQUADS[p.squad] ? p.squad : '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  return [...groups.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([key, list]) => ({ squad: key, label: SQUADS[key] || '', players: list }));
}

/* --------------------------------------------------------------------------
   Seeding and migration
   -------------------------------------------------------------------------- */
const SEED_TEAMS = [
  {
    slug: 'womens',
    name: "Women's National Program",
    program: 'womens',
    tagline: 'National Team and Next Generation',
    description:
      "Lebanon's women's programme fields a senior national team and a Next Generation squad that brings " +
      'through the players behind it. Both draw on Lebanese players at home and across the diaspora.',
  },
  {
    slug: 'mens',
    name: "Men's National Program",
    program: 'mens',
    tagline: 'Senior national team',
    description:
      "The men's national programme represents Lebanon in international competition and carries the " +
      'federation flag at tournaments abroad.',
  },
  {
    slug: 'youth',
    name: 'Youth Program',
    program: 'youth',
    tagline: 'Development and pathway',
    description:
      'The youth programme is where most Lebanese players start: learn-to-play, development camps, and ' +
      'the pathway into the national squads.',
  },
  {
    slug: 'panthers',
    name: 'Lebanese Panthers',
    program: 'panthers',
    tagline: 'Club team',
    description:
      'The Lebanese Panthers carry the federation into club competition and community games through the season.',
  },
];

export function seedTeams() {
  const insert = db.prepare(
    `INSERT INTO teams (slug, name, tagline, description, program, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let added = 0;
  SEED_TEAMS.forEach((t, i) => {
    if (findTeamBySlug(t.slug)) return;
    insert.run(t.slug, t.name, t.tagline, t.description, t.program, i);
    added += 1;
  });

  return added;
}

/**
 * Move the roster rows into players, once.
 *
 * There is no migration framework here, so this is an explicit guarded step
 * like the other seeds. Three things it has to get right, because it is moving
 * real data about named people, several of them minors:
 *
 *   - It must not run twice and double every squad.
 *   - It must carry `active` across. That flag is how a name is taken off the
 *     public site on request, and silently resetting it to 1 would put a name
 *     back up that somebody asked to have removed.
 *   - It must not clobber players an admin has since added or edited, so it
 *     stops as soon as it finds the work already done.
 */
export function migrateRosterToPlayers() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'roster_migrated_to_players'").get();
  if (done && done.value === '1') return 0;

  const rows = db.prepare('SELECT * FROM roster_players ORDER BY program, team, sort_order, id').all();
  if (!rows.length) return 0;

  const insert = db.prepare(
    `INSERT INTO players
       (team_id, slug, name, squad, position, jersey_number, recent_team, resides, hometown, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  /* node:sqlite's DatabaseSync has no transaction() helper, so the statements
     are wrapped by hand. The flag and the rows have to land together: a crash
     between them would either re-run the migration and duplicate every squad,
     or mark it done with half the players missing. */
  db.exec('BEGIN');
  try {
    let moved = 0;

    for (const row of rows) {
      const team = findTeamBySlug(row.program);
      if (!team) continue;

      /* Skip anything already present under the same name and squad: a partial
         run, or an admin who added a player by hand, should not produce a
         duplicate. */
      const exists = db
        .prepare('SELECT 1 FROM players WHERE team_id = ? AND squad = ? AND name = ?')
        .get(team.id, row.team, row.name);
      if (exists) continue;

      insert.run(
        team.id,
        uniqueSlug(row.name, 'players'),
        row.name,
        row.team,
        row.position,
        row.jersey_number,
        row.recent_team,
        row.resides,
        row.hometown,
        row.active,
        row.sort_order
      );
      moved += 1;
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ('roster_migrated_to_players', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
    return moved;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/* --------------------------------------------------------------------------
   Server-rendered pages
   --------------------------------------------------------------------------
   Same approach as lib/news.js: a player page is a page a person and a
   link-preview crawler visit, and crawlers do not run JavaScript, so the title,
   description and image have to be in the HTML that leaves the server.
   -------------------------------------------------------------------------- */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const absolute = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${config.appUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
};

/** Plain paragraphs from a textarea, the same shape news bodies use. */
function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n          ');
}

/**
 * Put a rendered <main> into a real page shell.
 *
 * The shell is a page written for the site root, so its asset and nav links are
 * relative. These pages live one level down at /teams/<slug> and /players/<slug>,
 * where "./assets/styles.css" resolves to "/teams/assets/styles.css" and 404s,
 * taking the stylesheet, fonts, logo and scripts with it. Rewriting to absolute
 * fixes all of them at once - deliberately not <base href="/">, which would do
 * the same job but send the "#main" skip link to the homepage.
 */
function intoShell(shellHtml, { title, description, meta, main }) {
  let html = shellHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?>/i,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  html = html.replace('</head>', `  ${meta}\n  </head>`);
  html = html.replace(/<main id="main">[\s\S]*?<\/main>/i, `<main id="main">${main}\n    </main>`);

  return html
    .replace(/(src|href)="\.\/(assets\/)/g, '$1="/$2')
    .replace(/(href)="([A-Za-z0-9_-]+\.html)"/g, '$1="/$2"');
}

function socialMeta({ title, description, image, url, type = 'website' }) {
  return [
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${escapeHtml(type)}">`,
    `<meta property="og:site_name" content="Lebanon Hockey">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** The photo, or the player's initials. Never a broken image frame. */
function playerPortrait(player, className) {
  if (player.photo_url) {
    return `<img class="${className}" src="${escapeHtml(player.photo_url)}" alt="${escapeHtml(
      player.photo_alt || player.name
    )}" loading="lazy">`;
  }

  const initials = String(player.name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  /* Forty-nine bright red tiles in a grid is a wall, not a roster. The
     placeholder is deliberately quiet so that the players who do have a
     photograph stand out rather than competing with it. */
  return `<span class="${className} is-placeholder" aria-hidden="true">${escapeHtml(initials)}</span>`;
}

function playerCard(player) {
  const detail = [player.recent_team, player.hometown].filter(Boolean)[0] || '';

  return `<a class="player-card" href="/players/${escapeHtml(player.slug)}">
            ${playerPortrait(player, 'player-card-photo')}
            <div class="player-card-body">
              <p class="player-card-position">${escapeHtml(
                POSITION_LABEL[player.position] || player.position
              )}${player.jersey_number ? ` <span aria-hidden="true">&middot;</span> #${escapeHtml(
                String(player.jersey_number)
              )}` : ''}</p>
              <h3>${escapeHtml(player.name)}</h3>
              ${detail ? `<p class="player-card-detail">${escapeHtml(detail)}</p>` : ''}
            </div>
          </a>`;
}

/** "Name - Role" per line, rendered as a definition list. */
function lineList(text, className) {
  const rows = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split(' - ');
      const right = rest.join(' - ');
      return right
        ? `<div><dt>${escapeHtml(left)}</dt><dd>${escapeHtml(right)}</dd></div>`
        : `<div><dt>${escapeHtml(left)}</dt><dd></dd></div>`;
    });

  return rows.length ? `<dl class="${className}">${rows.join('')}</dl>` : '';
}

/**
 * The roster as a table, beneath the cards.
 *
 * The cards are the clickable way in to a player; this is the at-a-glance view
 * the federation asked for, with the fuller detail the cards leave out. Both,
 * not one: a visitor skimming numbers wants the table, a visitor looking for a
 * person wants the card.
 */
function rosterTable(group) {
  if (!group.players.length) return '';

  return `<div class="table-scroll">
            <table class="roster-table">
              <thead>
                <tr>
                  <th scope="col">#</th><th scope="col">Name</th>
                  <th scope="col">Position</th><th scope="col">Most recent team</th>
                  <th scope="col">Resides</th><th scope="col">Hometown</th>
                </tr>
              </thead>
              <tbody>
                ${group.players
                  .map(
                    (p) => `
                  <tr>
                    <td data-label="Number" class="roster-number">${
                      p.jersey_number == null
                        ? '<span aria-label="no number">&mdash;</span>'
                        : escapeHtml(String(p.jersey_number))
                    }</td>
                    <td data-label="Name" class="roster-name"><a href="/players/${escapeHtml(
                      p.slug
                    )}">${escapeHtml(p.name)}</a></td>
                    <td data-label="Position">${escapeHtml(
                      POSITION_LABEL[p.position] || p.position
                    )}</td>
                    <td data-label="Most recent team">${escapeHtml(p.recent_team || '—')}</td>
                    <td data-label="Resides">${escapeHtml(p.resides || '—')}</td>
                    <td data-label="Hometown">${escapeHtml(p.hometown || '—')}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`;
}

export function renderTeamPage(team, players, shellHtml) {
  const groups = groupBySquad(players);
  const title = `${team.name} · Lebanon Hockey`;
  const description =
    team.description.slice(0, 200) || `${team.name} - Lebanese Ice Hockey Federation.`;

  const main = `
      <section class="hero page-hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">Our Teams</p>
          </div>
          <h1>${escapeHtml(team.name)}</h1>
          ${team.tagline ? `<p>${escapeHtml(team.tagline)}</p>` : ''}
        </div>
      </section>

      <section class="section reveal">
        ${team.description ? `<div class="post-article">${textToHtml(team.description)}</div>` : ''}

        ${
          team.staff || team.honours
            ? `<div class="team-facts">
          ${
            team.staff
              ? `<div class="team-facts-col"><h2>Coaching staff</h2>${lineList(
                  team.staff,
                  'team-staff'
                )}</div>`
              : ''
          }
          ${
            team.honours
              ? `<div class="team-facts-col"><h2>Honours</h2>${lineList(
                  team.honours,
                  'team-honours'
                )}</div>`
              : ''
          }
        </div>`
            : ''
        }

        ${
          players.length
            ? groups
                .map(
                  (group) => `
        <div class="squad-block">
          ${group.label ? `<h2 class="squad-heading">${escapeHtml(group.label)}</h2>` : ''}
          <div class="player-grid">
            ${group.players.map(playerCard).join('\n            ')}
          </div>
          ${rosterTable(group)}
        </div>`
                )
                .join('\n')
            : `<p class="empty-note">This roster has not been published yet. Check back soon.</p>`
        }

        <div class="section-cta">
          <a class="button primary" href="/membership.html#register">Register to play</a>
          <a class="button ghost" href="/teams">All teams</a>
        </div>
      </section>`;

  return intoShell(shellHtml, {
    title,
    description,
    meta: socialMeta({
      title: team.name,
      description,
      image: absolute(team.photo_url),
      url: `${config.appUrl}/teams/${team.slug}`,
    }),
    main,
  });
}

/**
 * The statistics block and game log on a player's profile.
 *
 * Shown only when there is a record to show. A player with no finalised games
 * gets nothing here rather than a row of zeroes, because "0 goals in 0 games"
 * reads as a judgement on them instead of an absence of data.
 */
function statsBlock(stats) {
  if (!stats || !stats.hasRecord) return '';

  const pct = (v) => (v === null ? '—' : v.toFixed(3).replace(/^0/, ''));
  const avg = (v) => (v === null ? '—' : v.toFixed(2));

  /* A goaltender's season is described by different numbers from a skater's,
     so the block changes shape rather than showing one of them blank columns. */
  const figures = stats.isGoaltender
    ? [
        ['Games', stats.games],
        ['Record', `${stats.wins}–${stats.losses}${stats.otLosses ? `–${stats.otLosses}` : ''}`],
        ['Saves', stats.saves],
        ['Save %', pct(stats.savePercentage)],
        ['GAA', avg(stats.goalsAgainstAverage)],
        ['Shutouts', stats.shutouts],
      ]
    : [
        ['Games', stats.games],
        ['Goals', stats.goals],
        ['Assists', stats.assists],
        ['Points', stats.points],
        ['Penalty minutes', stats.penaltyMinutes],
      ];

  return `
          <div class="player-stats">
            <h2>Statistics</h2>
            <div class="stat-row">
              ${figures
                .map(
                  ([label, value]) => `
              <div class="stat-figure">
                <span class="stat-value">${escapeHtml(String(value))}</span>
                <span class="stat-label">${escapeHtml(label)}</span>
              </div>`
                )
                .join('')}
            </div>
            ${
              stats.priorGames
                ? `<p class="stat-note">Includes ${escapeHtml(
                    String(stats.priorGames)
                  )} game${stats.priorGames === 1 ? '' : 's'} recorded before this site.${
                    stats.priorNote ? ` ${escapeHtml(stats.priorNote)}` : ''
                  }</p>`
                : ''
            }
          </div>`;
}

function gameLog(stats) {
  if (!stats || !stats.log.length) return '';

  const cells = (g) =>
    stats.isGoaltender
      ? `<td data-label="Saves">${escapeHtml(String(g.saves))}/${escapeHtml(String(g.shotsAgainst))}</td>
         <td data-label="Result">${escapeHtml(g.decision || '—')}</td>`
      : `<td data-label="Goals">${escapeHtml(String(g.goals))}</td>
         <td data-label="Assists">${escapeHtml(String(g.assists))}</td>
         <td data-label="Points">${escapeHtml(String(g.points))}</td>`;

  return `
          <div class="player-log">
            <h2>Game log</h2>
            <div class="table-scroll">
              <table class="roster-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Opponent</th>
                    <th scope="col">Score</th>
                    ${
                      stats.isGoaltender
                        ? '<th scope="col">Saves</th><th scope="col">Result</th>'
                        : '<th scope="col">G</th><th scope="col">A</th><th scope="col">P</th>'
                    }
                  </tr>
                </thead>
                <tbody>
                  ${stats.log
                    .map(
                      (g) => `
                  <tr>
                    <td data-label="Date">${escapeHtml(
                      String(g.playedAt || '').slice(0, 10) || 'Date not set'
                    )}</td>
                    <td data-label="Opponent" class="roster-name">${escapeHtml(g.opponent)}${
                        g.homeAway === 'away' ? ' <span class="cell-away">(away)</span>' : ''
                      }</td>
                    <td data-label="Score">${
                      g.scoreFor === null || g.scoreAgainst === null
                        ? '—'
                        : `${escapeHtml(String(g.scoreFor))}–${escapeHtml(String(g.scoreAgainst))}`
                    }</td>
                    ${cells(g)}
                  </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`;
}

export function renderPlayerPage(player, team, shellHtml, stats = null) {
  const title = `${player.name} · Lebanon Hockey`;
  const facts = [
    ['Position', POSITION_LABEL[player.position] || player.position],
    ['Number', player.jersey_number ? `#${player.jersey_number}` : ''],
    ['Squad', SQUADS[player.squad] || ''],
    ['Most recent team', player.recent_team],
    ['Resides', player.resides],
    ['Hometown', player.hometown],
  ].filter(([, value]) => value);

  const description =
    (player.bio && player.bio.replace(/\s+/g, ' ').slice(0, 200)) ||
    [POSITION_LABEL[player.position], team ? team.name : '', player.hometown]
      .filter(Boolean)
      .join(' · ');

  const main = `
      <section class="hero page-hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">${escapeHtml(team ? team.name : 'Lebanon Hockey')}</p>
          </div>
          <h1>${escapeHtml(player.name)}</h1>
          <p>${escapeHtml(
            [POSITION_LABEL[player.position] || '', player.jersey_number ? `#${player.jersey_number}` : '']
              .filter(Boolean)
              .join(' · ')
          )}</p>
        </div>
      </section>

      <section class="section reveal">
        <article class="player-profile">
          <div class="player-profile-photo">
            ${playerPortrait(player, 'player-portrait')}
          </div>

          <div class="player-profile-body">
            ${facts.length
              ? `<dl class="player-facts">
              ${facts
                .map(
                  ([label, value]) =>
                    `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
                )
                .join('\n              ')}
            </dl>`
              : ''}
            ${player.bio ? `<div class="player-bio">${textToHtml(player.bio)}</div>` : ''}
            ${statsBlock(stats)}
            ${gameLog(stats)}
          </div>
        </article>

        <div class="section-cta">
          <a class="button ghost" href="/teams/${escapeHtml(team ? team.slug : '')}">Back to ${escapeHtml(
            team ? team.name : 'the team'
          )}</a>
        </div>
      </section>`;

  return intoShell(shellHtml, {
    title,
    description,
    meta: socialMeta({
      title: player.name,
      description,
      image: absolute(player.photo_url),
      url: `${config.appUrl}/players/${player.slug}`,
      type: 'profile',
    }),
    main,
  });
}
