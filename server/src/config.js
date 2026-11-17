import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the server/ folder. Every relative path in the config is resolved against it. */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_ADMIN_EMAIL = 'admin@addon.local';
export const DEFAULT_ADMIN_PASSWORD = 'ChangeMe@123';

const DEV_JWT_SECRET = 'addon-development-secret-do-not-use-in-production';

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function resolveFromServer(value, fallback) {
  const chosen = text(value) || fallback;
  return path.isAbsolute(chosen) ? path.normalize(chosen) : path.resolve(SERVER_ROOT, chosen);
}

function port(value, fallback) {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535 ? parsed : fallback;
}

/**
 * Reads the environment into the shape every module sees as ctx.config.
 * Development and tests work with nothing set. Production refuses to start
 * without a real JWT secret and a changed admin password.
 */
export function loadConfig(env = process.env) {
  const mode = text(env.NODE_ENV) || 'development';
  const isProd = mode === 'production';
  const isTest = mode === 'test';

  const jwtSecret = text(env.JWT_SECRET);
  const adminPassword = text(env.ADMIN_PASSWORD) || DEFAULT_ADMIN_PASSWORD;

  if (isProd) {
    const problems = [];
    if (!jwtSecret) problems.push('JWT_SECRET is not set. Set it to a long random string.');
    if (adminPassword === DEFAULT_ADMIN_PASSWORD) {
      problems.push('ADMIN_PASSWORD is missing or still the default. Set your own admin password.');
    }
    if (problems.length > 0) {
      throw new Error(`The server cannot start in production:\n - ${problems.join('\n - ')}`);
    }
  }

  const dbPath = text(env.DB_PATH) === ':memory:' ? ':memory:' : resolveFromServer(env.DB_PATH, 'data/addon.db');
  const smtpPort = port(env.SMTP_PORT, 587);

  return {
    env: mode,
    isProd,
    isTest,
    port: port(env.PORT, 4000),
    jwtSecret: jwtSecret || DEV_JWT_SECRET,
    dbPath,
    uploadsDir: resolveFromServer(env.UPLOADS_DIR, 'uploads'),
    clientDist: resolveFromServer(env.CLIENT_DIST, '../client/dist'),
    publicUrl: (text(env.PUBLIC_URL) || 'http://localhost:5173').replace(/\/+$/, ''),
    razorpay: {
      keyId: text(env.RAZORPAY_KEY_ID),
      keySecret: text(env.RAZORPAY_KEY_SECRET),
      webhookSecret: text(env.RAZORPAY_WEBHOOK_SECRET),
    },
    smtp: {
      host: text(env.SMTP_HOST),
      port: smtpPort,
      secure: smtpPort === 465,
      user: text(env.SMTP_USER),
      pass: text(env.SMTP_PASS),
      from: text(env.MAIL_FROM),
    },
    admin: {
      email: (text(env.ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL).toLowerCase(),
      password: adminPassword,
    },
  };
}
