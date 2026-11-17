import fs from 'node:fs';
import { loadConfig } from './config.js';
import { openDb, toIso } from './db/index.js';
import { createMailer } from './lib/mailer.js';
import { createSettings } from './lib/settings.js';

/**
 * Builds the object every route factory and helper receives: { db, config, settings, mailer, now }.
 * `config` defaults to loadConfig() and `dbPath` to config.dbPath (pass ':memory:' in tests).
 */
export function createContext({ dbPath, config } = {}) {
  const base = config ?? loadConfig();
  const resolved = { ...base, dbPath: dbPath ?? base.dbPath };

  fs.mkdirSync(resolved.uploadsDir, { recursive: true });

  const ctx = {
    config: resolved,
    db: openDb(resolved.dbPath),
    /** The current time as the schema stores it (2026-11-17T09:30:00Z). Tests may replace this function. */
    now: () => toIso(new Date()),
  };
  ctx.settings = createSettings(ctx);
  ctx.mailer = createMailer(ctx);
  return ctx;
}
