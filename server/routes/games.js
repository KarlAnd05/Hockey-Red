/**
 * Game sheets, in public.
 *
 * Mounted at the site root rather than under /api, for the reason
 * routes/teams.js gives: a link-preview crawler does not run JavaScript, so
 * the title, description and image have to be in the HTML that leaves the
 * server.
 *
 * The shell is teams.html, the same shell /players/<slug> already borrows.
 * These pages have no editable copy of their own, which is the one thing a
 * games.html on disk would add.
 *
 * Only a published, non-draft game is reachable. `published` is deliberately
 * not `status`: status is what lib/stats.js counts towards a career total, so
 * a coach has to be able to finalise a record without revealing the page, and
 * to reveal a page without altering anybody's totals.
 */
import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from '../db.js';
import { publishedGames, findGameBySlug } from '../lib/games.js';
import { gameDetail, renderGamesIndex, renderGamePage } from '../lib/games-page.js';
import { applyContent } from '../lib/content.js';
import { applyFlags, isSectionVisible } from '../lib/settings.js';

export const gamesPageRouter = Router();

function shell() {
  const path = join(rootDir, 'teams.html');
  if (!existsSync(path)) return null;
  return applyFlags(applyContent('teams.html', readFileSync(path, 'utf8')));
}

gamesPageRouter.get('/games', (req, res, next) => {
  if (!isSectionVisible('games')) return next();

  const base = shell();
  if (!base) return next();

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderGamesIndex(publishedGames(), base));
  } catch (error) {
    console.error('[games] could not render the index:', error.message);
    next();
  }
});

gamesPageRouter.get('/games/:slug', (req, res, next) => {
  /* The slug is looked up in the database and never touched to the
     filesystem, so there is nothing here to traverse with. */
  if (!isSectionVisible('games')) return next();

  const game = findGameBySlug(req.params.slug);
  if (!game || !game.published || game.status === 'draft') return next();

  const base = shell();
  if (!base) return next();

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderGamePage(gameDetail(game), base));
  } catch (error) {
    console.error('[games] could not render %s:', req.params.slug, error.message);
    next();
  }
});
