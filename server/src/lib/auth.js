import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { forbidden, unauthorized } from './errors.js';

export const SESSION_COOKIE = 'addon_session';

const SESSION_DAYS = 30;
// Never the password hash or reset token: req.user is safe to log and to hand to a mapper.
const USER_COLUMNS = 'id, name, email, phone, role, created_at, updated_at';

// The middlewares and cookie helpers take no ctx argument, so they read the one createApp() stored on the app.
function contextOf(reqOrRes) {
  const ctx = reqOrRes.app?.locals?.ctx;
  if (!ctx) throw new Error('Auth helpers need app.locals.ctx, which createApp() sets.');
  return ctx;
}

function cookieOptions(ctx) {
  return { httpOnly: true, sameSite: 'lax', secure: ctx.config.isProd, path: '/' };
}

/** The signed session token for a user id. It carries nothing but the id. */
export function signSession(ctx, userId) {
  return jwt.sign({ sub: String(userId) }, ctx.config.jwtSecret, { algorithm: 'HS256', expiresIn: `${SESSION_DAYS}d` });
}

function userFromCookie(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const ctx = contextOf(req);
  let payload;
  try {
    payload = jwt.verify(token, ctx.config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return ctx.db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]) ?? null;
}

// The row is read once per request, however many of the middlewares below run.
function currentUser(req) {
  if (req.user === undefined) req.user = userFromCookie(req);
  return req.user;
}

/** Sets req.user to the signed-in users row, or null. Never rejects a request. */
export function optionalAuth(req, res, next) {
  currentUser(req);
  next();
}

/** 401 unless someone is signed in. Sets req.user. */
export function requireAuth(req, res, next) {
  if (!currentUser(req)) throw unauthorized();
  next();
}

/** 401 when signed out, 403 when signed in without the admin role. Sets req.user. */
export function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (!user) throw unauthorized();
  if (user.role !== 'admin') throw forbidden('This area is for store staff.');
  next();
}

/** Signs the user in on this response: httpOnly cookie, SameSite=Lax, 30 days, Secure in production. */
export function setSessionCookie(res, user) {
  const ctx = contextOf(res);
  res.cookie(SESSION_COOKIE, signSession(ctx, user.id), {
    ...cookieOptions(ctx),
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Signs the user out on this response. */
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(contextOf(res)));
}

// Read at call time so test/helpers.js can set NODE_ENV after this module has loaded.
const saltRounds = () => (process.env.NODE_ENV === 'test' ? 4 : 10);

export function hashPassword(password) {
  return bcrypt.hash(String(password), saltRounds());
}

let decoyHash = null;

/**
 * Resolves to true when the password matches the stored hash.
 * With no hash (unknown email) it still spends the time of one comparison, so a login
 * route does not reveal which emails are registered by answering faster.
 */
export async function verifyPassword(password, hash) {
  const candidate = typeof password === 'string' ? password : '';
  if (!hash) {
    decoyHash ??= await bcrypt.hash('no account has this password', saltRounds());
    await bcrypt.compare(candidate, decoyHash);
    return false;
  }
  return bcrypt.compare(candidate, hash);
}
