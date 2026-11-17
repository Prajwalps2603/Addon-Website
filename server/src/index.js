import fs from 'node:fs';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createContext } from './context.js';

const SEED_MODULE = new URL('./seed/index.js', import.meta.url);

// A new database gets the sample catalogue, when the seed is installed. A store that already
// has products, categories or cars is never touched (after "Remove all sample data" the store keeps
// its categories and car list, so it is not refilled), and a missing or failing seed never stops the server.
async function seedIfEmpty(ctx) {
  const count = (table) => ctx.db.get(`SELECT COUNT(*) AS total FROM ${table}`).total;
  if (['products', 'categories', 'vehicles'].some((table) => count(table) > 0)) return;

  if (!fs.existsSync(SEED_MODULE)) {
    console.log('[seed] The catalogue is empty and no seed is installed (src/seed/index.js). Starting with an empty store.');
    return;
  }
  try {
    const { runSeed } = await import(SEED_MODULE.href);
    if (typeof runSeed !== 'function') {
      console.warn('[seed] src/seed/index.js does not export runSeed(ctx). Starting with an empty store.');
      return;
    }
    console.log('[seed] The catalogue is empty. Loading the sample catalogue...');
    await runSeed(ctx);
    const seeded = ctx.db.get('SELECT COUNT(*) AS total FROM products').total;
    console.log(`[seed] Done: ${seeded} products loaded.`);
  } catch (err) {
    console.error('[seed] The seed failed. The server will start with whatever was loaded before the failure.', err);
  }
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const ctx = createContext({ config });
  await seedIfEmpty(ctx);
  const app = createApp(ctx);

  const server = app.listen(config.port, (err) => {
    if (err) {
      const reason = err.code === 'EADDRINUSE' ? `port ${config.port} is already in use` : err.message;
      console.error(`[server] Could not start: ${reason}.`);
      process.exit(1);
    }
    console.log(`[server] Addon Automotive API listening on http://localhost:${server.address().port} (${config.env})`);
    if (!config.isProd) console.log(`[server] Storefront in development: ${config.publicUrl}`);
  });

  let closing = false;
  function shutdown(signal) {
    if (closing) return;
    closing = true;
    console.log(`[server] ${signal} received, shutting down.`);
    // Requests in flight get a few seconds to finish before the process is ended regardless.
    setTimeout(() => process.exit(1), 8000).unref();
    server.close(() => {
      ctx.db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // One stray rejected promise in a background task must not take the whole store down.
  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
  });
}

main().catch((err) => {
  console.error('[server] Could not start:', err);
  process.exit(1);
});
