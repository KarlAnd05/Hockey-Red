/**
 * Team rosters.
 *
 * Grouped the way the federation's own roster reads: National Team and Next
 * Generation, each split into forwards, defence and goaltenders with counts.
 *
 * Nothing here is published that the federation has not already published
 * itself. privacy.html states that a parent or guardian may ask for a minor's
 * name to be removed or shown as initials - setting active = 0 on a row is how
 * that request is honoured, and it takes effect on the next page load.
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
   Seed - the women's rosters as published by the federation
   --------------------------------------------------------------------------
   Transcribed from lebanonhockey.com/womensprogram. Two things to know if this
   is ever re-checked against that page:

     - The National Team FORWARDS section lists each player's details block
       BEFORE the name; every other section lists them after. The pairing below
       follows the details-then-name reading, which is the only one that uses
       every block (7 blocks, 7 names, perfect alternation).
     - Blank fields are stored empty rather than as the page's "N/A" or "---"
       placeholders; the table renders a dash for them.

   Several of these players are minors. privacy.html carries the removal
   promise, and the Shown/Hidden toggle in the admin is how it is kept.
   ========================================================================== */
const SEED = [
  // --- National Team: forwards ---------------------------------------------
  ['national', 'forward', 9, 'Anya Hafiz', "Saint Mary's University (NCAA D3)", 'Minnesota, USA', 'Batroun, LEB'],
  ['national', 'forward', 66, 'Megan Vettraino', 'Concordia University Wisconsin (NCAA D3)', 'Michigan, USA', 'Zahle, LEB'],
  ['national', 'forward', 97, 'Britni Yammine', 'TMU (USports)', 'Ottawa, CAN', 'Beirut, LEB'],
  ['national', 'forward', null, 'Zoe Boomsara', 'Harvard University (NCAA D1)', 'Montreal, CAN', 'Beirut, LEB'],
  ['national', 'forward', 88, 'Talia Teliani', 'Edmonton Wolves (EJFHL)', 'Edmonton, CAN', 'Bar Elias, LEB'],
  ['national', 'forward', 13, 'Lea Salem', 'University of Montréal (USports)', 'Montreal, CAN', 'Rashaya, LEB'],
  ['national', 'forward', 95, 'Zoe Frantz', 'McGill University (USports)', 'Montreal, CAN', 'Beirut, LEB'],

  // --- National Team: defence ----------------------------------------------
  ['national', 'defence', 91, 'Layla Trepanier', 'East Ottawa Stars - U18AA', 'Ottawa, CAN', 'Zahle, LEB'],
  ['national', 'defence', null, 'Bri Eid', 'ZSC Lions Frauen - SWHL A', 'Windsor, CAN', 'Hadchit, LEB'],
  ['national', 'defence', 21, 'Ava Eid', 'Aurora University (NCAA D3)', 'Windsor, CAN', 'Hadchit, LEB'],

  // --- National Team: goaltenders ------------------------------------------
  ['national', 'goaltender', 30, 'Hannah Nakhlé-Saunders', 'Post University (NCAA D1)', 'Ottawa, CAN', 'Beirut, LEB'],
  ['national', 'goaltender', 52, 'Marguerite Cordahi', 'Portsmouth Abbey School (USHS)', 'Montreal, CAN', ''],
  ['national', 'goaltender', null, 'Paz Hassan-Contreras', 'Manhattanville College (NCAA D3)', 'Michigan, USA', 'Qaraoun, LEB'],

  // --- Next Generation: forwards -------------------------------------------
  ['next_gen', 'forward', 22, 'Anna Sophie Kamel', 'Dawson College (D1)', 'Montreal, CAN', 'Beirut, LEB'],
  ['next_gen', 'forward', null, 'Hannah Abradjian', '', 'Toronto, CAN', ''],
  ['next_gen', 'forward', 36, 'Lana Maalouf', 'Houston Storm - 19U Tier 2', 'Texas, USA', 'Chleefah, LEB'],
  ['next_gen', 'forward', 78, 'Dima Ibrahim', '', 'Kuwait City, Kuwait', 'Saida, LEB'],
  ['next_gen', 'forward', 27, 'Layla Abdallah', 'Calgary Glacier 16U', 'Calgary, CAN', ''],
  ['next_gen', 'forward', 81, 'Angela Mesquita', 'Nepean WilCat U15AA', 'Ottawa, CAN', 'Beirut, LEB'],
  ['next_gen', 'forward', 72, 'Elly Karam-Sottile', '', 'Ottawa, CAN', 'Majdal Balhis, LEB'],
  ['next_gen', 'forward', 11, 'Maya Maalouf', 'Houston Storm - 14U Tier 2', 'Texas, USA', 'Chleefah, LEB'],
  ['next_gen', 'forward', null, 'Kiara Charbel', '', 'Ottawa, CAN', ''],
  ['next_gen', 'forward', 4, 'Anna Daniel', '', 'Halifax, CAN', 'Brissat, LEB'],
  ['next_gen', 'forward', 74, 'Michelle Yunes', '', 'Mexico', ''],
  ['next_gen', 'forward', 18, 'Sarah Trepanier', '', 'Ottawa, CAN', 'Zahle, LEB'],
  ['next_gen', 'forward', 14, 'Allison Mahfouz', '', 'New Jersey, USA', ''],
  ['next_gen', 'forward', 42, 'Jenna Salem', '', 'Calgary, CAN', 'Bire, LEB'],
  ['next_gen', 'forward', 20, 'Kayla Bashawaty', 'Danbury Hattricks 19U Elite', 'Middlebury, USA', 'Deddeh, LEB'],
  ['next_gen', 'forward', null, 'Ayah Salem', '', 'Calgary, CAN', 'Bire, LEB'],
  ['next_gen', 'forward', 15, 'Jessey Haykal', '', '', ''],

  // --- Next Generation: defence --------------------------------------------
  ['next_gen', 'defence', 2, 'Ella Barakat-Redsell', '', 'Ottawa, CAN', 'Jdeidit Marjeyoun, LEB'],
  ['next_gen', 'defence', null, 'Olivia Forzley', '', 'Ottawa, CAN', 'Quaraoun Bekaa, LEB'],
  ['next_gen', 'defence', 24, 'Audrey Eve Kamel', 'Warrior Lac ST-Louis - U18AAA', 'Montreal, CAN', 'Beirut, LEB'],
  ['next_gen', 'defence', 55, 'Erica Starnino', 'Concordia University (USports)', 'Montreal, CAN', 'Rushya, LEB'],
  ['next_gen', 'defence', 5, 'Nisrene Darwiche', '', 'Ottawa, CAN', 'El Marj, LEB'],
  ['next_gen', 'defence', 87, 'Elizabeth Abradjian', '', 'Toronto, CAN', ''],
  ['next_gen', 'defence', 75, 'Sophia El-Hage', 'Rocky Mountain Raiders - U18AAA', 'Alberta, CAN', 'Machghara, LEB'],
  ['next_gen', 'defence', 89, 'Emma Naim', 'Lakeland Jaguars - U18', 'Bonnyville, CAN', 'Rashaya El Wadi, LEB'],
  ['next_gen', 'defence', 8, 'Claire Ghantous', 'Gustavus Adolphus College (ACHA)', 'CAN', ''],
  ['next_gen', 'defence', 29, 'Alisa El-Akhras', 'Fox Hockey Gheorgheni (Romania)', 'Bucharest, Romania', 'Aitaroun, LEB'],
  ['next_gen', 'defence', null, 'Leonie Tannous', 'As de Quebec - U18AAA', 'Quebec, CAN', 'Beirut, LEB'],
  ['next_gen', 'defence', null, 'Jordan Beshara', 'Carleton University (USports)', 'Ottawa, CAN', 'Beirut, LEB'],
  ['next_gen', 'defence', 12, 'Ahlam Souraya', '', 'Calgary, CAN', 'Kherbet Rouha, LEB'],
  ['next_gen', 'defence', 25, 'Emma Bashawaty', 'Danbury Hattricks 19U Elite', 'Middlebury, USA', 'Deddeh, LEB'],
  ['next_gen', 'defence', null, 'Raiya Leenders', 'FEIA Falcons - U22AA', 'Calgary, CAN', 'Mdoukha, LEB'],
  ['next_gen', 'defence', 23, 'Andrea Yunes', '', 'Mexico', ''],

  // --- Next Generation: goaltenders ----------------------------------------
  ['next_gen', 'goaltender', 31, 'Kara Boassaly', 'Castleton University (NCAA D3)', '', ''],
  ['next_gen', 'goaltender', null, 'Olivia Tannous', 'As de Quebec - U18AAA', 'Quebec, CAN', 'Beirut, LEB'],
  ['next_gen', 'goaltender', 34, 'Megan Daoud-Marshman', 'U18 Stittsville Rockets (OWHA)', 'Ottawa, CAN', 'Haouch En Nebi, LEB'],
];

export function seedRoster() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM roster_players').get().n;
  if (count > 0) return false;

  const insert = db.prepare(
    `INSERT INTO roster_players
       (program, team, position, jersey_number, name, recent_team, resides, hometown, sort_order)
     VALUES ('womens', ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  SEED.forEach(([team, position, number, name, recentTeam, resides, hometown], i) => {
    insert.run(team, position, number, name, recentTeam, resides, hometown, i);
  });

  return SEED.length;
}
