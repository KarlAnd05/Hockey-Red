import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword, validatePassword } from '../lib/password.js';
import { loginSession, logoutSession, requireAuth, rateLimit } from '../middleware/auth.js';
import { getOrCreateCart, cartCount, mergeGuestCart } from '../lib/cart.js';

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
   Session bootstrap - drives the header, CSRF token, and cart badge
   -------------------------------------------------------------------------- */
authRouter.get('/session', (req, res) => {
  const cart = getOrCreateCart(req);

  res.json({
    user: publicUser(req.user),
    csrfToken: req.sessionRecord?.csrf_token || '',
    cartCount: cartCount(cart?.id),
    stripePublishableKey: config.stripePublishableKey,
    currency: config.currency,
  });
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

    db.prepare(
      'INSERT INTO contact_messages (first_name, last_name, email, message) VALUES (?, ?, ?, ?)'
    ).run(
      String(req.body?.firstName || '').trim().slice(0, 120),
      String(req.body?.lastName || '').trim().slice(0, 120),
      email,
      String(req.body?.message || '').trim().slice(0, 4000)
    );

    res.status(201).json({ ok: true });
  }
);
