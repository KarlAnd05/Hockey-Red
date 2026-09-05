import { createApp } from './app.js';
import { config, stripeEnabled } from './config.js';
import { seedCatalogue, seedDiscounts, db } from './db.js';
import { purgeExpiredSessions } from './middleware/auth.js';

const seededProducts = seedCatalogue();
const seededDiscounts = seedDiscounts();

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
