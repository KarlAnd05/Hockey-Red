/**
 * Sponsors - the public list, and the admin CRUD behind it.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { deleteUpload } from '../lib/uploads.js';
import { listSponsors, findSponsor, serialiseSponsor, TIERS, TIER_LABEL } from '../lib/sponsors.js';

export const sponsorsRouter = Router();

sponsorsRouter.get('/sponsors', (req, res) => {
  res.json({
    sponsors: listSponsors().map(serialiseSponsor),
    tiers: TIER_LABEL,
  });
});

/* --------------------------------------------------------------------------
   Admin
   -------------------------------------------------------------------------- */
export const adminSponsorsRouter = Router();

adminSponsorsRouter.get('/sponsors', (req, res) => {
  res.json({
    sponsors: listSponsors({ includeInactive: true }).map(serialiseSponsor),
    tiers: TIER_LABEL,
    tierOrder: TIERS,
  });
});

function readBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  /* Only http(s). A javascript: or data: URL on a sponsor link would be a
     stored XSS on a page every visitor sees. */
  const rawUrl = str('websiteUrl', existing.website_url, 400);
  const websiteUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : rawUrl === '' ? '' : `https://${rawUrl}`;

  return {
    name: str('name', existing.name, 160),
    tier: TIERS.includes(body.tier) ? body.tier : existing.tier || 'bronze',
    blurb: str('blurb', existing.blurb, 600),
    websiteUrl: /^https?:\/\//i.test(websiteUrl) ? websiteUrl : '',
    logoUrl: str('logoUrl', existing.logo_url, 400),
    logoAlt: str('logoAlt', existing.logo_alt, 240),
    active: body.active === undefined ? existing.active ?? 1 : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminSponsorsRouter.post('/sponsors', (req, res) => {
  const v = readBody(req.body || {});
  if (!v.name) return res.status(400).json({ error: 'Give the sponsor a name.' });

  const info = db
    .prepare(
      `INSERT INTO sponsors (name, tier, blurb, website_url, logo_url, logo_alt, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(v.name, v.tier, v.blurb, v.websiteUrl, v.logoUrl, v.logoAlt, v.active, v.sortOrder);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminSponsorsRouter.patch('/sponsors/:id', (req, res) => {
  const existing = findSponsor(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sponsor not found.' });

  const v = readBody(req.body || {}, existing);
  if (v.logoUrl !== existing.logo_url && existing.logo_url) deleteUpload(existing.logo_url);

  db.prepare(
    `UPDATE sponsors
        SET name = ?, tier = ?, blurb = ?, website_url = ?, logo_url = ?,
            logo_alt = ?, active = ?, sort_order = ?
      WHERE id = ?`
  ).run(
    v.name,
    v.tier,
    v.blurb,
    v.websiteUrl,
    v.logoUrl,
    v.logoAlt,
    v.active,
    v.sortOrder,
    existing.id
  );

  res.json({ ok: true });
});

adminSponsorsRouter.delete('/sponsors/:id', (req, res) => {
  const existing = findSponsor(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sponsor not found.' });

  if (existing.logo_url) deleteUpload(existing.logo_url);
  db.prepare('DELETE FROM sponsors WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});
