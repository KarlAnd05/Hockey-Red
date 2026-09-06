import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword, validatePassword } from '../lib/password.js';
import {
  loginSession,
  logoutSession,
  requireAuth,
  rateLimit,
  ensureSession,
  hashToken,
} from '../middleware/auth.js';
import { findCart, cartCount, mergeGuestCart } from '../lib/cart.js';
import { sendContactNotification, sendPasswordResetEmail } from '../lib/notifications.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    role: user.role,
    createdAt: user.created_at,
  };
}

function normaliseEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/* --------------------------------------------------------------------------
   Session bootstrap - drives the header and cart badge
   --------------------------------------------------------------------------
   Read-only on purpose: this runs on every page load, and it must not set a
   cookie or write a cart row for a visitor who is only reading. A CSRF token
   comes back only if a session already exists; otherwise the client asks for
   one from /api/csrf when it is about to write.
   -------------------------------------------------------------------------- */
authRouter.get('/session', (req, res) => {
  const cart = findCart(req);

  res.json({
    user: publicUser(req.user),
    csrfToken: req.sessionRecord?.csrf_token || null,
    cartCount: cartCount(cart?.id),
    stripePublishableKey: config.stripePublishableKey,
    currency: config.currency,
  });
});

/* --------------------------------------------------------------------------
   CSRF token - the first point at which a visitor is given a cookie
   -------------------------------------------------------------------------- */
authRouter.get('/csrf', (req, res) => {
  const session = ensureSession(req, res);
  res.json({ csrfToken: session.csrf_token });
});

/* --------------------------------------------------------------------------
   Register
   -------------------------------------------------------------------------- */
authRouter.post(
  '/auth/register',
  rateLimit({ max: 8, windowMs: 15 * 60 * 1000, key: 'register' }),
  (req, res) => {
    const email = normaliseEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const firstName = String(req.body?.firstName || '').trim().slice(0, 80);
    const lastName = String(req.body?.lastName || '').trim().slice(0, 80);

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // The bootstrap admin email from the environment is promoted on signup.
    const role = config.adminEmail && email === config.adminEmail ? 'admin' : 'customer';

    const result = db
      .prepare(
        'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)'
      )
      .run(email, hashPassword(password), firstName, lastName, role);

    const userId = Number(result.lastInsertRowid);
    const guestHash = req.sessionRecord?.token_hash;

    loginSession(req, res, userId);
    if (guestHash) mergeGuestCart(guestHash, userId);

    res.status(201).json({ user: publicUser(req.user), csrfToken: req.sessionRecord.csrf_token });
  }
);

/* --------------------------------------------------------------------------
   Login
   -------------------------------------------------------------------------- */
authRouter.post(
  '/auth/login',
  rateLimit({ max: 10, windowMs: 15 * 60 * 1000, key: 'login' }),
  (req, res) => {
    const email = normaliseEmail(req.body?.email);
    const password = String(req.body?.password || '');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Same response either way so the endpoint cannot be used to enumerate accounts.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const guestHash = req.sessionRecord?.token_hash;

    loginSession(req, res, user.id);
    if (guestHash) mergeGuestCart(guestHash, user.id);

    res.json({ user: publicUser(req.user), csrfToken: req.sessionRecord.csrf_token });
  }
);

/* --------------------------------------------------------------------------
   Logout
   -------------------------------------------------------------------------- */
authRouter.post('/auth/logout', (req, res) => {
  logoutSession(req, res);
  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   Profile
   -------------------------------------------------------------------------- */
authRouter.patch('/auth/profile', requireAuth, (req, res) => {
  const firstName = String(req.body?.firstName ?? req.user.first_name).trim().slice(0, 80);
  const lastName = String(req.body?.lastName ?? req.user.last_name).trim().slice(0, 80);
  const phone = String(req.body?.phone ?? req.user.phone).trim().slice(0, 40);

  db.prepare('UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?').run(
    firstName,
    lastName,
    phone,
    req.user.id
  );

  const updated = db
    .prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);

  res.json({ user: publicUser(updated) });
});

authRouter.post('/auth/password', requireAuth, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);

  if (!verifyPassword(currentPassword, row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(newPassword),
    req.user.id
  );

  // Signing out other devices is the safe default after a password change.
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(
    req.user.id,
    req.sessionRecord.token_hash
  );

  res.json({ ok: true });
});

/* --------------------------------------------------------------------------
   Contact form
   -------------------------------------------------------------------------- */
authRouter.post(
  '/contact',
  rateLimit({ max: 12, windowMs: 60 * 60 * 1000, key: 'contact' }),
  (req, res) => {
    const email = normaliseEmail(req.body?.email);
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const message = {
      firstName: String(req.body?.firstName || '').trim().slice(0, 120),
      lastName: String(req.body?.lastName || '').trim().slice(0, 120),
      email,
      message: String(req.body?.message || '').trim().slice(0, 4000),
    };

    db.prepare(
      'INSERT INTO contact_messages (first_name, last_name, email, message) VALUES (?, ?, ?, ?)'
    ).run(message.firstName, message.lastName, message.email, message.message);

    // Answer immediately; the notification is best-effort and must not make the
    // visitor wait on an SMTP round trip.
    res.status(201).json({ ok: true });
    sendContactNotification(message);
  }
);

/* ==========================================================================
   Password reset
   ========================================================================== */

/**
 * Request a reset link.
 *
 * Always answers 200 with the same body whether or not the address exists, so
 * this endpoint cannot be used to discover which emails have accounts.
 */
authRouter.post(
  '/auth/forgot',
  rateLimit({ max: 6, windowMs: 15 * 60 * 1000, key: 'forgot' }),
  async (req, res) => {
    const email = normaliseEmail(req.body?.email);
    const generic = { ok: true, message: 'If that email has an account, a reset link is on its way.' };

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) return res.json(generic);

    // One live token at a time per account.
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id);

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    db.prepare(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, hashToken(token), expiresAt);

    await sendPasswordResetEmail(
      user,
      `${config.appUrl}/reset-password.html?token=${token}`
    );

    res.json(generic);
  }
);

/**
 * Consume a reset token and set the new password.
 */
authRouter.post(
  '/auth/reset',
  rateLimit({ max: 10, windowMs: 15 * 60 * 1000, key: 'reset' }),
  (req, res) => {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const row = token
      ? db
          .prepare(
            `SELECT * FROM password_resets
             WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
          )
          .get(hashToken(token))
      : null;

    if (!row) {
      return res.status(400).json({ error: 'That reset link is invalid or has expired.' });
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(password),
      row.user_id
    );

    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(row.id);

    // Anyone already holding a session for this account is signed out, which is
    // the point of a reset when the account may have been compromised.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);

    res.json({ ok: true });
  }
);
