import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

const COOKIE_NAME = 'lh_sid';
const SESSION_DAYS = 30;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
  const jar = {};
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) jar[key] = decodeURIComponent(value);
  });
  return jar;
}

function expiryISO(days = SESSION_DAYS) {
  return new Date(Date.now() + days * 86400000).toISOString().replace('T', ' ').slice(0, 19);
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 86400}`,
  ];
  if (config.isProduction) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function createSession(userId = null) {
  const token = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');

  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(hashToken(token), userId, csrfToken, expiryISO());

  return { token, csrfToken };
}

/**
 * Read the session for this request, if one exists.
 *
 * This deliberately does NOT create a session. A visitor who only reads pages
 * never receives a cookie, which keeps `lh_sid` squarely inside the
 * "strictly necessary for a service the user requested" exemption. Call
 * ensureSession() from the handlers that genuinely need state.
 */
export function attachSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];

  const record = token
    ? db
        .prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')")
        .get(hashToken(token))
    : null;

  req.sessionRecord = record || null;
  req.user = record?.user_id
    ? db
        .prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?')
        .get(record.user_id) || null
    : null;

  next();
}

/**
 * Create the session (and set the cookie) on demand. Idempotent within a
 * request. Used by cart writes, sign-in, and CSRF token issuance.
 */
export function ensureSession(req, res) {
  if (req.sessionRecord) return req.sessionRecord;

  const created = createSession(null);
  setSessionCookie(res, created.token);

  req.sessionRecord = db
    .prepare('SELECT * FROM sessions WHERE token_hash = ?')
    .get(hashToken(created.token));

  return req.sessionRecord;
}

/**
 * Swap the anonymous session for a fresh authenticated one. Rotating the token
 * on login is what stops session fixation.
 */
export function loginSession(req, res, userId) {
  const oldHash = req.sessionRecord?.token_hash;
  const created = createSession(userId);

  setSessionCookie(res, created.token);

  if (oldHash) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(oldHash);
  }

  req.sessionRecord = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(created.token));
  req.user = db
    .prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?')
    .get(userId);

  return created;
}

export function logoutSession(req, res) {
  if (req.sessionRecord?.token_hash) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.sessionRecord.token_hash);
  }
  clearSessionCookie(res);
  req.sessionRecord = null;
  req.user = null;
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }
  next();
}

/**
 * Admin gate. Used on every /api/admin/* route AND on the admin HTML routes, so
 * a non-admin cannot even load the shell.
 *
 * Responds 404 rather than 403 so the admin area is not discoverable.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    if (req.accepts(['html', 'json']) === 'html') {
      return res.status(404).type('html').send(
        '<!doctype html><meta charset="utf-8"><title>Not found</title>' +
          '<body style="font-family:system-ui;padding:60px;text-align:center">' +
          '<h1>404</h1><p>Not found.</p><p><a href="/">Return to Lebanon Hockey</a></p></body>'
      );
    }
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
}

/**
 * Double-submit CSRF check on state-changing requests.
 */
export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const expected = req.sessionRecord?.csrf_token || '';
  const provided = req.get('x-csrf-token') || req.body?.csrfToken || '';

  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));

  // No session yet means no token was ever issued. The client fetches one from
  // GET /api/csrf and retries; api.js does this automatically on a 403.
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh and try again.' });
  }

  next();
}

/**
 * Fixed-window in-memory limiter. Enough for a single-instance deployment;
 * swap for a shared store if this ever runs on more than one process.
 */
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, key = 'default' } = {}) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    hits.forEach((entry, k) => {
      if (entry.resetAt <= now) hits.delete(k);
    });
  }, windowMs).unref?.();

  return (req, res, next) => {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(id);

    if (!entry || entry.resetAt <= now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: `Too many attempts. Try again in ${retryAfter}s.` });
    }

    next();
  };
}

export function purgeExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}
