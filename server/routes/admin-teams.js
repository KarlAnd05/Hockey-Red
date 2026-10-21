/**
 * Admin: Teams and players.
 *
 * Split out of routes/admin.js, which had grown past the point where one more
 * module could be added to it without making the whole file harder to read.
 * Mounted behind the same requireAdmin gate by app.js.
 *
 * Photos go through the same lib/uploads.js path as news images, so a renamed
 * .html can never be stored as a player portrait.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { deleteUpload } from '../lib/uploads.js';
import {
  listTeams,
  findTeam,
  listPlayers,
  findPlayer,
  playerCounts,
  serialiseTeam,
  serialisePlayer,
  uniqueSlug,
  POSITIONS,
  SQUADS,
} from '../lib/teams.js';

export const adminTeamsRouter = Router();

/* --------------------------------------------------------------------------
   Teams
   -------------------------------------------------------------------------- */
adminTeamsRouter.get('/teams', (req, res) => {
  const counts = playerCounts({ includeInactive: true });
  res.json({
    teams: listTeams({ includeInactive: true }).map((t) =>
      serialiseTeam(t, { playerCount: counts.get(t.id) || 0 })
    ),
    squads: SQUADS,
    positions: POSITIONS,
  });
});

adminTeamsRouter.get('/teams/:id/players', (req, res) => {
  const team = findTeam(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  res.json({
    team: serialiseTeam(team),
    players: listPlayers(team.id, { includeInactive: true }).map((p) => serialisePlayer(p, team)),
  });
});

function readTeamBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  return {
    name: str('name', existing.name, 160),
    tagline: str('tagline', existing.tagline, 200),
    description: str('description', existing.description, 4000),
    photoUrl: str('photoUrl', existing.photo_url, 400),
    photoAlt: str('photoAlt', existing.photo_alt, 240),
    program: str('program', existing.program, 40),
    active: body.active === undefined ? existing.active ?? 1 : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminTeamsRouter.post('/teams', (req, res) => {
  const v = readTeamBody(req.body || {});
  if (!v.name) return res.status(400).json({ error: 'Give the team a name.' });

  const slug = uniqueSlug(req.body?.slug || v.name, 'teams');
  const info = db
    .prepare(
      `INSERT INTO teams (slug, name, tagline, description, photo_url, photo_alt, program, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(slug, v.name, v.tagline, v.description, v.photoUrl, v.photoAlt, v.program, v.active, v.sortOrder);

  res.status(201).json({ id: Number(info.lastInsertRowid), slug });
});

adminTeamsRouter.patch('/teams/:id', (req, res) => {
  const existing = findTeam(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Team not found.' });

  const v = readTeamBody(req.body || {}, existing);

  /* The slug is the public URL. Only change it when one was actually sent,
     because changing it silently breaks every link already shared. */
  const slug =
    req.body?.slug === undefined || !String(req.body.slug).trim()
      ? existing.slug
      : uniqueSlug(req.body.slug, 'teams', existing.id);

  if (v.photoUrl !== existing.photo_url && existing.photo_url) deleteUpload(existing.photo_url);

  db.prepare(
    `UPDATE teams
        SET slug = ?, name = ?, tagline = ?, description = ?, photo_url = ?,
            photo_alt = ?, program = ?, active = ?, sort_order = ?
      WHERE id = ?`
  ).run(
    slug,
    v.name,
    v.tagline,
    v.description,
    v.photoUrl,
    v.photoAlt,
    v.program,
    v.active,
    v.sortOrder,
    existing.id
  );

  res.json({ ok: true, slug });
});

adminTeamsRouter.delete('/teams/:id', (req, res) => {
  const existing = findTeam(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Team not found.' });

  /* Deleting a team cascades to its players, which is a lot of real data about
     named people to lose on a mis-click. Hiding is almost always what was
     meant, so only an emptied team deletes outright. */
  const count = listPlayers(existing.id, { includeInactive: true }).length;
  if (count) {
    return res.status(400).json({
      error: `${existing.name} still has ${count} player${
        count === 1 ? '' : 's'
      }. Move or delete them first, or hide the team instead.`,
    });
  }

  if (existing.photo_url) deleteUpload(existing.photo_url);
  db.prepare('DELETE FROM teams WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   Players
   -------------------------------------------------------------------------- */
function readPlayerBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  const number =
    body.number === undefined || body.number === '' || body.number === null
      ? existing.jersey_number ?? null
      : Number(body.number);

  const squadKeys = Object.keys(SQUADS);
  const squad = squadKeys.includes(body.squad)
    ? body.squad
    : body.squad === ''
      ? ''
      : existing.squad || '';

  return {
    teamId: Number(body.teamId ?? existing.team_id) || null,
    name: str('name', existing.name, 160),
    squad,
    position: POSITIONS.includes(body.position) ? body.position : existing.position || 'forward',
    number: Number.isFinite(number) ? number : null,
    photoUrl: str('photoUrl', existing.photo_url, 400),
    photoAlt: str('photoAlt', existing.photo_alt, 240),
    bio: str('bio', existing.bio, 4000),
    recentTeam: str('recentTeam', existing.recent_team, 200),
    resides: str('resides', existing.resides, 120),
    hometown: str('hometown', existing.hometown, 120),
    active: body.active === undefined ? existing.active ?? 1 : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminTeamsRouter.post('/players', (req, res) => {
  const v = readPlayerBody(req.body || {});
  if (!v.name) return res.status(400).json({ error: "Enter the player's name." });
  if (!v.teamId || !findTeam(v.teamId)) return res.status(400).json({ error: 'Pick a team.' });

  const slug = uniqueSlug(req.body?.slug || v.name, 'players');
  const info = db
    .prepare(
      `INSERT INTO players
         (team_id, slug, name, squad, position, jersey_number, photo_url, photo_alt,
          bio, recent_team, resides, hometown, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      v.teamId,
      slug,
      v.name,
      v.squad,
      v.position,
      v.number,
      v.photoUrl,
      v.photoAlt,
      v.bio,
      v.recentTeam,
      v.resides,
      v.hometown,
      v.active,
      v.sortOrder
    );

  res.status(201).json({ id: Number(info.lastInsertRowid), slug });
});

adminTeamsRouter.patch('/players/:id', (req, res) => {
  const existing = findPlayer(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found.' });

  const v = readPlayerBody(req.body || {}, existing);
  if (!v.teamId || !findTeam(v.teamId)) return res.status(400).json({ error: 'Pick a team.' });

  const slug =
    req.body?.slug === undefined || !String(req.body.slug).trim()
      ? existing.slug
      : uniqueSlug(req.body.slug, 'players', existing.id);

  if (v.photoUrl !== existing.photo_url && existing.photo_url) deleteUpload(existing.photo_url);

  db.prepare(
    `UPDATE players
        SET team_id = ?, slug = ?, name = ?, squad = ?, position = ?, jersey_number = ?,
            photo_url = ?, photo_alt = ?, bio = ?, recent_team = ?, resides = ?,
            hometown = ?, active = ?, sort_order = ?
      WHERE id = ?`
  ).run(
    v.teamId,
    slug,
    v.name,
    v.squad,
    v.position,
    v.number,
    v.photoUrl,
    v.photoAlt,
    v.bio,
    v.recentTeam,
    v.resides,
    v.hometown,
    v.active,
    v.sortOrder,
    existing.id
  );

  res.json({ ok: true, slug });
});

/* Hiding a player (active = 0) is how a removal request from a parent or
   guardian is honoured without losing the federation's own record. Delete is
   here for genuine mistakes. */
adminTeamsRouter.delete('/players/:id', (req, res) => {
  const existing = findPlayer(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found.' });

  if (existing.photo_url) deleteUpload(existing.photo_url);
  db.prepare('DELETE FROM players WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});
