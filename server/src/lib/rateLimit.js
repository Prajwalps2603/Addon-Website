import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { errorBody } from './errors.js';

const MINUTE = 60 * 1000;

// Read per request, not at import, so test/helpers.js can set NODE_ENV after this module loads.
const mode = () => process.env.NODE_ENV;

/**
 * Builds a limiter that answers 429 with ApiErrorBody (code 'rate_limited').
 * `limit` is the production ceiling per window and per key. Development gets twenty times
 * that so manual testing is not interrupted, and under NODE_ENV=test nothing is limited.
 */
export function createLimiter({ windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit: () => (mode() === 'production' ? limit : limit * 20),
    skip: () => mode() === 'test',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: keyGenerator ?? ((req) => ipKeyGenerator(req.ip ?? '')),
    message: errorBody('rate_limited', message),
  });
}

// Many Indian mobile users share one public address, so sign-in attempts are counted per
// address and email together: one person hammering an account is stopped, the neighbours are not.
function addressAndEmail(req) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
  return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
}

// Runs two limiters as one middleware. The request must pass both.
function both(first, second) {
  return function limited(req, res, next) {
    first(req, res, (err) => (err ? next(err) : second(req, res, next)));
  };
}

const AUTH_MESSAGE = 'Too many attempts. Wait 15 minutes and try again.';

export const limiters = {
  /**
   * Login, register, forgot and reset password: 10 tries in 15 minutes per address and email,
   * and 100 per address whatever the email, so cycling through emails does not get around it.
   */
  auth: both(
    createLimiter({ windowMs: 15 * MINUTE, limit: 10, keyGenerator: addressAndEmail, message: AUTH_MESSAGE }),
    createLimiter({ windowMs: 15 * MINUTE, limit: 100, message: AUTH_MESSAGE }),
  ),
  /** Public forms that write a row: enquiries, questions, stock alerts, saved kits and builds, photo uploads. */
  forms: createLimiter({
    windowMs: 10 * MINUTE,
    limit: 30,
    message: 'Too many submissions from this connection. Try again in a few minutes.',
  }),
  /** Public lookups that could be used to guess records, such as order tracking. */
  lookup: createLimiter({
    windowMs: 10 * MINUTE,
    limit: 40,
    message: 'Too many lookups from this connection. Try again in a few minutes.',
  }),
};
