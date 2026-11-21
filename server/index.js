import { networkInterfaces } from 'node:os';
import { createApp } from './app.js';
import { config, stripeEnabled } from './config.js';
import { seedCatalogue, seedDiscounts, seedNews, db } from './db.js';
import { seedRoster } from './lib/roster.js';
import { seedShippingZones } from './lib/shipping.js';
import { seedTeams, migrateRosterToPlayers } from './lib/teams.js';
import { seedSponsors } from './lib/sponsors.js';
import { mergeProgramPages } from './lib/merge-programs.js';
import { seedRecaps } from './lib/seed-recaps.js';
import { attachPhotos } from './lib/attach-photos.js';
import { attachFederationCopy } from './lib/attach-copy.js';
import { attachPanthers } from './lib/attach-panthers.js';
import { backfillGameSlugs } from './lib/games.js';
import { purgeExpiredSessions } from './middleware/auth.js';
import { syncAllPages } from './lib/content.js';

const seededProducts = seedCatalogue();
const seededDiscounts = seedDiscounts();
const seededNews = seedNews();
const seededRoster = seedRoster();
const seededZones = seedShippingZones();
const seededTeams = seedTeams();
/* Must run after seedRoster and seedTeams: it reads the roster and needs the
   team rows to attach the players to. Guarded, so it only ever runs once. */
const migratedPlayers = migrateRosterToPlayers();
const seededSponsors = seedSponsors();
/* Must run after seedTeams: it writes into the team rows. */
const mergedPrograms = mergeProgramPages();
/* After mergeProgramPages: it reads the descriptions that step writes. */
const recapChanges = seedRecaps();
/* Must run after every seed above: it fills in the rows they created before
   the old site's photographs were carried over. Guarded, so it runs once. */
const attachedPhotos = attachPhotos();
/* Same shape, same reason: the programme blurbs in lib/teams.js only reach a
   database that has never been seeded, so a live one is updated here. */
const attachedCopy = attachFederationCopy();
/* And again for the Panthers, whose squad, staff and photographs the
   federation supplied after that row had already been seeded. */
const attachedPanthers = attachPanthers();

/* Give every game a web address, and only then put the unique index on it:
   SQLite cannot add a UNIQUE column, so the constraint has to follow the
   backfill rather than sitting in db.js with the rest of the schema. */
const sluggedGames = backfillGameSlugs();

/* Re-read every public page so the admin content editor matches what is on disk.
   Runs on each boot, which is what keeps `npm run build` and the editor in step. */
const content = syncAllPages();

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000).unref();

const app = createApp();

/* The addresses a phone on the same wifi can reach. Empty unless HOST opened the
   server up; printed because typing the wrong one is the whole friction of
   testing the live match screen on a handset. */
function lanUrls() {
  if (config.host !== '0.0.0.0' && config.host !== '::') return [];
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => `http://${net.address}:${config.port}`);
}

const server = app.listen(config.port, config.host, () => {
  const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

  console.log('');
  console.log(`  Lebanon Hockey  ->  ${config.appUrl}`);
  for (const url of lanUrls())
    console.log(`  network ${url}  ->  reachable by anything on this wifi`);
  console.log('');
  if (seededProducts) console.log('  seeded  catalogue (11 products, 4 categories)');
  if (seededDiscounts) console.log('  seeded  discount code CEDAR10');
  if (seededNews) console.log(`  seeded  ${seededNews} news posts`);
  if (seededRoster) console.log(`  seeded  ${seededRoster} roster players`);
  if (seededZones) console.log(`  seeded  ${seededZones} shipping zones (placeholder rates)`);
  if (seededTeams) console.log(`  seeded  ${seededTeams} teams`);
  if (seededSponsors) console.log(`  seeded  ${seededSponsors} sponsors`);
  if (mergedPrograms) console.log(`  merged  ${mergedPrograms} programme pages into Our Teams`);
  if (recapChanges) console.log(`  applied ${recapChanges} updates from the 2025/2026 recaps`);
  if (attachedPhotos) console.log(`  attached ${attachedPhotos} photographs from the old site`);
  if (attachedCopy) console.log(`  rewrote ${attachedCopy} programme descriptions from the federation's own text`);
  if (attachedPanthers.players)
    console.log(`  added   ${attachedPanthers.players} Lebanese Panthers players`);
  if (attachedPanthers.fields)
    console.log(`  filled  ${attachedPanthers.fields} Panthers field(s): portrait, gallery, staff`);
  if (migratedPlayers) console.log(`  moved   ${migratedPlayers} roster players into team profiles`);
  if (sluggedGames) console.log(`  slugged ${sluggedGames} game(s) for their public pages`);
  console.log(
    `  content ${content.blocks} editable text blocks across ${content.pages} pages` +
      (content.orphaned ? `  ->  ${content.orphaned} edited block(s) no longer in the page` : '')
  );
  console.log(`  stripe  ${stripeEnabled ? 'configured' : 'NOT configured - checkout disabled'}`);
  console.log(
    `  webhook ${config.stripeWebhookSecret ? 'secret set' : 'no secret - set STRIPE_WEBHOOK_SECRET'}`
  );
  console.log(
    `  admin   ${adminCount} account${adminCount === 1 ? '' : 's'}` +
      (adminCount === 0 ? '  ->  run: npm run create-admin' : '')
  );
  console.log('');
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
