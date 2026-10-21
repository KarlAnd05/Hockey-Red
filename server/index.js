import { createApp } from './app.js';
import { config, stripeEnabled } from './config.js';
import { seedCatalogue, seedDiscounts, seedNews, db } from './db.js';
import { seedRoster } from './lib/roster.js';
import { seedShippingZones } from './lib/shipping.js';
import { seedTeams, migrateRosterToPlayers } from './lib/teams.js';
import { seedSponsors } from './lib/sponsors.js';
import { mergeProgramPages } from './lib/merge-programs.js';
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

/* Re-read every public page so the admin content editor matches what is on disk.
   Runs on each boot, which is what keeps `npm run build` and the editor in step. */
const content = syncAllPages();

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 6 * 60 * 60 * 1000).unref();

const app = createApp();

const server = app.listen(config.port, '127.0.0.1', () => {
  const adminCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

  console.log('');
  console.log(`  Lebanon Hockey  ->  ${config.appUrl}`);
  console.log('');
  if (seededProducts) console.log('  seeded  catalogue (11 products, 4 categories)');
  if (seededDiscounts) console.log('  seeded  discount code CEDAR10');
  if (seededNews) console.log(`  seeded  ${seededNews} news posts`);
  if (seededRoster) console.log(`  seeded  ${seededRoster} roster players`);
  if (seededZones) console.log(`  seeded  ${seededZones} shipping zones (placeholder rates)`);
  if (seededTeams) console.log(`  seeded  ${seededTeams} teams`);
  if (seededSponsors) console.log(`  seeded  ${seededSponsors} sponsors`);
  if (mergedPrograms) console.log(`  merged  ${mergedPrograms} programme pages into Our Teams`);
  if (migratedPlayers) console.log(`  moved   ${migratedPlayers} roster players into team profiles`);
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
