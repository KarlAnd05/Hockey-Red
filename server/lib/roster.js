/**
 * Team rosters.
 *
 * Grouped the way the federation's own roster reads: National Team and Next
 * Generation, each split into forwards, defence and goaltenders with counts.
 *
 * Nothing here is published that the federation has not already published
 * itself. privacy.html now states that a parent or guardian may ask for a
 * minor's name to be removed or shown as initials - setting active = 0 on a row
 * is how that request is honoured, and it takes effect on the next page load.
 */
import { db } from '../db.js';

export const POSITIONS = ['forward', 'defence', 'goaltender'];
export const POSITION_LABEL = {
  forward: 'Forwards',
  defence: 'Defencemen',
  goaltender: 'Goaltenders',
};

export function listRoster(program, { includeInactive = false } = {}) {
  const sql = includeInactive
    ? 'SELECT * FROM roster_players WHERE program = ? ORDER BY team, sort_order, id'
    : 'SELECT * FROM roster_players WHERE program = ? AND active = 1 ORDER BY team, sort_order, id';
  return db.prepare(sql).all(program);
}

export function findPlayer(id) {
  return db.prepare('SELECT * FROM roster_players WHERE id = ?').get(Number(id)) || null;
}

export function serialisePlayer(p) {
  return {
    id: p.id,
    program: p.program,
    team: p.team,
    position: p.position,
    number: p.jersey_number,
    name: p.name,
    recentTeam: p.recent_team,
    resides: p.resides,
    hometown: p.hometown,
    active: Boolean(p.active),
    sortOrder: p.sort_order,
  };
}

/** Shaped for the page: two teams, each with position groups and counts. */
export function rosterForProgram(program) {
  const players = listRoster(program).map(serialisePlayer);

  const build = (team) => {
    const inTeam = players.filter((p) => p.team === team);
    return {
      team,
      total: inTeam.length,
      groups: POSITIONS.map((position) => ({
        position,
        label: POSITION_LABEL[position],
        players: inTeam.filter((p) => p.position === position),
      })).filter((g) => g.players.length > 0),
    };
  };

  return { program, teams: [build('national'), build('next_gen')].filter((t) => t.total > 0) };
}

/* ==========================================================================
   Seed - the women's National Team, as published by the federation
   --------------------------------------------------------------------------
   Only the National Team is seeded. The Next Generation list on the live site
   presents each player's details in a different order from the National Team
   section, and mis-pairing a hometown there would publish wrong information
   about a named minor. That list is better entered through the admin screen,
   where each row is confirmed as it is typed.
   ========================================================================== */
const SEED_WOMENS_NATIONAL = [
  ['forward', 9, 'Anya Hafiz', "Saint Mary's University (NCAA D3)", 'Minnesota, USA', 'Batroun, LEB'],
  ['forward', 66, 'Megan Vettraino', 'Concordia University Wisconsin (NCAA D3)', 'Michigan, USA', 'Zahle, LEB'],
  ['forward', 97, 'Britni Yammine', 'TMU (USports)', 'Ottawa, CAN', 'Beirut, LEB'],
  ['forward', null, 'Zoe Boomsara', 'Harvard University (NCAA D1)', 'Montreal, CAN', 'Beirut, LEB'],
  ['forward', 88, 'Talia Teliani', 'Edmonton Wolves (EJFHL)', 'Edmonton, CAN', 'Bar Elias, LEB'],
  ['forward', 13, 'Lea Salem', 'University of Montreal (USports)', 'Montreal, CAN', 'Rashaya, LEB'],
  ['forward', 95, 'Zoe Frantz', 'McGill University (USports)', 'Montreal, CAN', 'Beirut, LEB'],
  ['defence', 91, 'Layla Trepanier', 'East Ottawa Stars U18AA', 'Ottawa, CAN', 'Zahle, LEB'],
  ['defence', null, 'Bri Eid', 'ZSC Lions Frauen (SWHL A)', 'Windsor, CAN', 'Hadchit, LEB'],
  ['defence', 21, 'Ava Eid', 'Aurora University (NCAA D3)', 'Windsor, CAN', 'Hadchit, LEB'],
];

export function seedRoster() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM roster_players').get().n;
  if (count > 0) return false;

  const insert = db.prepare(
    `INSERT INTO roster_players
       (program, team, position, jersey_number, name, recent_team, resides, hometown, sort_order)
     VALUES ('womens', 'national', ?, ?, ?, ?, ?, ?, ?)`
  );

  SEED_WOMENS_NATIONAL.forEach(([position, number, name, recentTeam, resides, hometown], i) => {
    insert.run(position, number, name, recentTeam, resides, hometown, i);
  });

  return SEED_WOMENS_NATIONAL.length;
}
