import crypto from 'node:crypto';
import { Router } from 'express';
import * as z from 'zod';
import { clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from '../lib/auth.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';
import { randomToken } from '../lib/ids.js';
import { toUser } from '../lib/mappers.js';
import { limiters } from '../lib/rateLimit.js';
import { emailSchema, parse, passwordSchema, phoneSchema } from '../lib/validate.js';

const USER_COLUMNS = 'id, name, email, phone, role, created_at, updated_at';
const RESET_MINUTES = 60;
const BAD_LOGIN = 'That email and password do not match an account.';
const BAD_RESET = 'This reset link is not valid or has expired. Ask for a new one.';

export const nameSchema = z
  .string({ error: 'Enter your name' })
  .trim()
  .min(2, { error: 'Enter your name' })
  .max(80, { error: 'Keep the name to 80 characters or fewer' });

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  // Any length: an old password that is now "too short" must still get the same 401 as a wrong one.
  password: z.string({ error: 'Enter your password' }).min(1, { error: 'Enter your password' }).max(200),
});

const forgotSchema = z.object({ email: emailSchema });

const resetSchema = z.object({
  token: z.string({ error: BAD_RESET }).trim().min(1, { error: BAD_RESET }).max(200, { error: BAD_RESET }),
  password: passwordSchema,
});

/** Only the SHA-256 of a reset token is stored, so a leaked database cannot be used to reset passwords. */
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** An instant `minutes` after `iso`, in the ctx.now() format (no milliseconds). */
function addMinutes(iso, minutes) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function isUniqueViolation(err) {
  return err?.code === 'ERR_SQLITE_ERROR' && err?.errcode === 2067;
}

export default function authRoutes(ctx) {
  const router = Router();
  const userById = (id) => ctx.db.get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);

  router.post('/register', limiters.auth, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const taken = () => conflict('An account with this email already exists. Sign in or reset the password.');
    if (ctx.db.get('SELECT id FROM users WHERE email = ?', [input.email])) throw taken();

    const passwordHash = await hashPassword(input.password);
    let id;
    try {
      const now = ctx.now();
      id = ctx.db.run(
        `INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'customer', ?, ?)`,
        [input.name, input.email, input.phone, passwordHash, now, now],
      ).lastInsertRowid;
    } catch (err) {
      // Two sign-ups with the same email racing past the check above.
      if (isUniqueViolation(err)) throw taken();
      throw err;
    }

    const user = userById(id);
    setSessionCookie(res, user);
    res.status(201).json({ user: toUser(user) });
  });

  router.post('/login', limiters.auth, async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const row = ctx.db.get(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ?`, [email]);
    // verifyPassword spends the same time when there is no account, so the answer time does not reveal it.
    const ok = await verifyPassword(password, row?.password_hash ?? null);
    if (!row || !ok) throw unauthorized(BAD_LOGIN);

    const { password_hash: _hash, ...user } = row;
    setSessionCookie(res, user);
    res.json({ user: toUser(user) });
  });

  router.post('/logout', (req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? toUser(req.user) : null });
  });

  router.post('/forgot-password', limiters.auth, (req, res) => {
    const { email } = parse(forgotSchema, req.body);
    const user = ctx.db.get('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (user) {
      const token = randomToken(32);
      const now = ctx.now();
      ctx.db.run('UPDATE users SET reset_token_hash = ?, reset_token_expires = ?, updated_at = ? WHERE id = ?', [
        hashResetToken(token),
        addMinutes(now, RESET_MINUTES),
        now,
        user.id,
      ]);
      const link = `${ctx.config.publicUrl}/reset-password?token=${encodeURIComponent(token)}`;
      const storeName = ctx.settings.get().storeName || 'Addon Automotive';
      // Not awaited: the answer must not take longer for a registered email than for an unknown one.
      // The mailer never rejects.
      void ctx.mailer.send({
        to: user.email,
        subject: `Reset your ${storeName} password`,
        text: [
          `Hello ${user.name},`,
          '',
          'Someone asked to reset the password for this account. If it was you, open this link within 60 minutes:',
          '',
          link,
          '',
          'The link works once. If you did not ask for this, ignore this email: your password stays as it is.',
          '',
          storeName,
        ].join('\n'),
      });
    }
    res.json({ ok: true });
  });

  router.post('/reset-password', limiters.auth, async (req, res) => {
    const { token, password } = parse(resetSchema, req.body);
    const tokenHash = hashResetToken(token);
    const now = ctx.now();
    const user = ctx.db.get('SELECT id FROM users WHERE reset_token_hash = ? AND reset_token_expires > ?', [tokenHash, now]);
    if (!user) throw badRequest(BAD_RESET, { token: BAD_RESET });

    const passwordHash = await hashPassword(password);
    // The token must still be the same one after the await: single use, even with two requests in flight.
    const { changes } = ctx.db.run(
      `UPDATE users SET password_hash = ?, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = ?
       WHERE id = ? AND reset_token_hash = ?`,
      [passwordHash, now, user.id, tokenHash],
    );
    if (changes !== 1) throw badRequest(BAD_RESET, { token: BAD_RESET });
    res.json({ ok: true });
  });

  return router;
}
