/**
 * Our Teams - the public list, the per-team pages, and a page per player.
 */
import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from '../db.js';
import {
  listTeams,
  findTeamBySlug,
  listPlayers,
  findPlayerBySlug,
  findTeam,
  playerCounts,
  serialiseTeam,
  serialisePlayer,
  renderTeamPage,
  renderPlayerPage,
} from '../lib/teams.js';
import { applyContent } from '../lib/content.js';

export const teamsRouter = Router();

/* The list the Our Teams page renders from. */
teamsRouter.get('/teams', (req, res) => {
  const counts = playerCounts();
  res.json({
    teams: listTeams().map((team) =>
      serialiseTeam(team, { playerCount: counts.get(team.id) || 0 })
    ),
  });
});

/* One team and its players, for anything that wants the data rather than the page. */
teamsRouter.get('/teams/:slug', (req, res) => {
  const team = findTeamBySlug(req.params.slug);
  if (!team || !team.active) return res.status(404).json({ error: 'Team not found.' });

  res.json({
    team: serialiseTeam(team),
    players: listPlayers(team.id).map((p) => serialisePlayer(p, team)),
  });
});

/* --------------------------------------------------------------------------
   Pages
   --------------------------------------------------------------------------
   Mounted at the site root rather than under /api, because these are pages a
   person (or a link-preview crawler) visits. Crawlers do not run JavaScript, so
   the title, description and image have to be in the HTML that leaves the
   server - the same reason the per-post news pages are rendered this way.
   -------------------------------------------------------------------------- */
export const teamsPageRouter = Router();

/* The shell is a real page on disk, so a page that has been deleted or renamed
   falls through to the 404 handler instead of rendering half a site. */
function shell(name) {
  const path = join(rootDir, name);
  if (!existsSync(path)) return null;
  return applyContent(name, readFileSync(path, 'utf8'));
}

/* The programme pages were merged into Our Teams.

   They redirect rather than 404: these URLs are on the federation's printed
   material and in other people's links, and a 301 keeps every one of them
   working while telling search engines where the content went. */
const MERGED_PAGES = {
  '/mens-program.html': '/teams/mens',
  '/womens-program.html': '/teams/womens',
  '/youth-camp.html': '/teams/youth',
};

teamsPageRouter.get(Object.keys(MERGED_PAGES), (req, res) => {
  res.redirect(301, MERGED_PAGES[req.path]);
});

/* The index. teams.html is also served at /teams.html by the root allow-list;
   this gives the team and player pages a parent URL that matches their own
   shape, so "/teams/womens" has a "/teams" above it rather than a .html file. */
teamsPageRouter.get('/teams', (req, res, next) => {
  const base = shell('teams.html');
  if (!base) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.type('html').send(base);
});

teamsPageRouter.get('/teams/:slug', (req, res, next) => {
  /* The slug is looked up in the database and never touched to the filesystem,
     so there is nothing here to traverse with. */
  const team = findTeamBySlug(req.params.slug);
  if (!team || !team.active) return next();

  const base = shell('teams.html');
  if (!base) return next();

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderTeamPage(team, listPlayers(team.id), base));
  } catch (error) {
    console.error('[teams] could not render %s:', req.params.slug, error.message);
    next();
  }
});

teamsPageRouter.get('/players/:slug', (req, res, next) => {
  const player = findPlayerBySlug(req.params.slug);
  if (!player || !player.active) return next();

  /* A hidden team hides its players too. Otherwise taking a whole squad down
     would leave every individual profile still reachable by direct link. */
  const team = findTeam(player.team_id);
  if (!team || !team.active) return next();

  const base = shell('teams.html');
  if (!base) return next();

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderPlayerPage(player, team, base));
  } catch (error) {
    console.error('[teams] could not render player %s:', req.params.slug, error.message);
    next();
  }
});
