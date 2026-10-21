/**
 * Programs and schedule - the public list, and the admin CRUD behind it.
 *
 * Deliberately thin. The federation's content model for this is still to come,
 * so this publishes a title, a date, a place and a description, and nothing it
 * has not been given.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { listTeams, serialiseTeam } from '../lib/teams.js';

export const KINDS = {
  program: 'Program',
  camp: 'Camp',
  tournament: 'Tournament',
  tryout: 'Tryout',
  session: 'Session',
};

function listPrograms({ includeInactive = false } = {}) {
  /* Dated entries first and soonest first; undated ones after, since "to be
     announced" belongs below a date somebody can actually plan around. */
  return db
    .prepare(
      `SELECT p.*, t.name AS team_name, t.slug AS team_slug
         FROM programs p
         LEFT JOIN teams t ON t.id = p.team_id
        ${includeInactive ? '' : 'WHERE p.active = 1'}
        ORDER BY (p.starts_at = '') ASC, p.starts_at ASC, p.sort_order, p.id`
    )
    .all();
}

function findProgram(id) {
  return db.prepare('SELECT * FROM programs WHERE id = ?').get(Number(id)) || null;
}

function serialise(p) {
  return {
    id: p.id,
    teamId: p.team_id,
    teamName: p.team_name || '',
    teamSlug: p.team_slug || '',
    title: p.title,
    kind: p.kind,
    kindLabel: KINDS[p.kind] || p.kind,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    location: p.location,
    description: p.description,
    linkUrl: p.link_url,
    linkLabel: p.link_label,
    active: Boolean(p.active),
    sortOrder: p.sort_order,
  };
}

export const programsRouter = Router();

programsRouter.get('/programs', (req, res) => {
  res.json({ programs: listPrograms().map(serialise), kinds: KINDS });
});

/* --------------------------------------------------------------------------
   Admin
   -------------------------------------------------------------------------- */
export const adminProgramsRouter = Router();

adminProgramsRouter.get('/programs', (req, res) => {
  res.json({
    programs: listPrograms({ includeInactive: true }).map(serialise),
    kinds: KINDS,
    teams: listTeams({ includeInactive: true }).map(serialiseTeam),
  });
});

function readBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  /* Only http(s), and only relative paths that stay on this site. Anything
     else on a link every visitor can click is not worth the risk. */
  const rawLink = str('linkUrl', existing.link_url, 400);
  const linkUrl =
    rawLink === '' || /^https?:\/\//i.test(rawLink) || /^\/[^/]/.test(rawLink) ? rawLink : '';

  return {
    teamId: body.teamId === undefined ? existing.team_id ?? null : Number(body.teamId) || null,
    title: str('title', existing.title, 200),
    kind: Object.keys(KINDS).includes(body.kind) ? body.kind : existing.kind || 'program',
    startsAt: str('startsAt', existing.starts_at, 40),
    endsAt: str('endsAt', existing.ends_at, 40),
    location: str('location', existing.location, 240),
    description: str('description', existing.description, 4000),
    linkUrl,
    linkLabel: str('linkLabel', existing.link_label, 80),
    active: body.active === undefined ? existing.active ?? 1 : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminProgramsRouter.post('/programs', (req, res) => {
  const v = readBody(req.body || {});
  if (!v.title) return res.status(400).json({ error: 'Give it a title.' });

  const info = db
    .prepare(
      `INSERT INTO programs
         (team_id, title, kind, starts_at, ends_at, location, description, link_url, link_label, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      v.teamId,
      v.title,
      v.kind,
      v.startsAt,
      v.endsAt,
      v.location,
      v.description,
      v.linkUrl,
      v.linkLabel,
      v.active,
      v.sortOrder
    );

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminProgramsRouter.patch('/programs/:id', (req, res) => {
  const existing = findProgram(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found.' });

  const v = readBody(req.body || {}, existing);
  db.prepare(
    `UPDATE programs
        SET team_id = ?, title = ?, kind = ?, starts_at = ?, ends_at = ?, location = ?,
            description = ?, link_url = ?, link_label = ?, active = ?, sort_order = ?
      WHERE id = ?`
  ).run(
    v.teamId,
    v.title,
    v.kind,
    v.startsAt,
    v.endsAt,
    v.location,
    v.description,
    v.linkUrl,
    v.linkLabel,
    v.active,
    v.sortOrder,
    existing.id
  );

  res.json({ ok: true });
});

adminProgramsRouter.delete('/programs/:id', (req, res) => {
  const info = db.prepare('DELETE FROM programs WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});
