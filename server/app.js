import express from 'express';
import { existsSync, statSync } from 'node:fs';
import { join, normalize, relative, extname } from 'node:path';

import { config } from './config.js';
import { rootDir } from './db.js';
import { attachSession, csrfProtection, requireAdmin } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { cartRouter } from './routes/cart.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';
import { webhookRouter } from './routes/webhook.js';

// Dev-only allowance so impeccable live mode can load. Never set in production.
const __impeccableLiveDev = config.isProduction ? '' : ' http://localhost:8400';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Only trust proxy headers when explicitly told to - otherwise a client could
  // spoof X-Forwarded-For and slip past the rate limiter.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  }

  /* --- Security headers --------------------------------------------------- */
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data:",
        // Fonts are self-hosted, so no third-party origin is allowed at all.
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        `script-src 'self'${__impeccableLiveDev}`,
        `connect-src 'self'${__impeccableLiveDev}`,
        "form-action 'self' https://checkout.stripe.com",
      ].join('; ')
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(self)');

    if (config.isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  /* --- Stripe webhook: raw body, so it must come before express.json() ----- */
  app.use('/api', webhookRouter);

  /* --- Body parsing + session --------------------------------------------- */
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(attachSession);

  /* --- API ---------------------------------------------------------------- */
  app.use('/api', csrfProtection);
  app.use('/api', authRouter);
  app.use('/api', catalogRouter);
  app.use('/api', cartRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', ordersRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));

  /* --- Admin HTML ---------------------------------------------------------
     Served through a gated route rather than from the static directory, so the
     admin shell is never publicly reachable - not just its API.
     ----------------------------------------------------------------------- */
  app.use('/admin', requireAdmin, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const requested = req.path === '/' || req.path === '' ? '/index.html' : req.path;
    const filePath = normalize(join(rootDir, 'admin', requested));

    if (relative(join(rootDir, 'admin'), filePath).startsWith('..')) {
      return res.status(404).send('Not found');
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return res.status(404).send('Not found');
    }

    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  });

  /* --- Public assets ------------------------------------------------------- */
  app.use(
    '/assets',
    express.static(join(rootDir, 'assets'), {
      maxAge: config.isProduction ? '7d' : 0,
      fallthrough: true,
    })
  );

  /* --- Public HTML --------------------------------------------------------
     An allow-list by construction: only *.html files that sit directly in the
     project root are reachable, so server/, data/, invoices/, .env and
     node_modules can never be served.
     ----------------------------------------------------------------------- */
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    let pathname;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      return next();
    }

    if (pathname === '/') pathname = '/index.html';

    // Root-level .html only - no nested paths, no other extensions.
    if (!/^\/[A-Za-z0-9_-]+\.html$/.test(pathname)) return next();

    const filePath = join(rootDir, pathname);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return next();
    if (extname(filePath) !== '.html') return next();

    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(filePath);
  });

  /* --- Favicon ------------------------------------------------------------- */
  app.get('/favicon.ico', (req, res) => {
    res.redirect(302, '/assets/LIHF-01_edited.png');
  });

  /* --- 404 ----------------------------------------------------------------- */
  app.use((req, res) => {
    res.status(404).type('html').send(
      '<!doctype html><meta charset="utf-8"><title>Not found - Lebanon Hockey</title>' +
        '<body style="font-family:system-ui,sans-serif;background:#05070a;color:#fff;' +
        'display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
        '<div><p style="color:#c8102e;font-weight:800;letter-spacing:.2em;margin:0">404</p>' +
        '<h1 style="font-size:42px;margin:.3em 0">Page not found</h1>' +
        '<p style="opacity:.7">That page is not part of Lebanon Hockey.</p>' +
        '<p><a href="/" style="color:#c8102e;font-weight:800">Return home</a></p></div></body>'
    );
  });

  /* --- Error handler ------------------------------------------------------- */
  app.use((error, req, res, next) => {
    console.error('[server]', error);
    if (res.headersSent) return next(error);

    if (req.path.startsWith('/api')) {
      return res.status(500).json({ error: 'Something went wrong.' });
    }
    res.status(500).type('html').send('<h1>500</h1><p>Something went wrong.</p>');
  });

  return app;
}
