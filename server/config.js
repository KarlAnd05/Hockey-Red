import { randomBytes } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

const sessionSecret = process.env.SESSION_SECRET || '';

if (!sessionSecret && isProduction) {
  throw new Error('SESSION_SECRET must be set in production');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT || 5174),
  appUrl: (process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 5174}`).replace(/\/$/, ''),

  // A random dev secret means restarting the server logs everyone out locally,
  // which is fine and better than shipping a hardcoded fallback.
  sessionSecret: sessionSecret || randomBytes(32).toString('hex'),

  stripeSecretKey: required('STRIPE_SECRET_KEY'),
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  currency: (process.env.CURRENCY || 'cad').toLowerCase(),

  shippingFlatCents: Number(process.env.SHIPPING_FLAT_CENTS || 1500),
  freeShippingThresholdCents: Number(process.env.FREE_SHIPPING_THRESHOLD_CENTS || 20000),
  taxRate: Number(process.env.TAX_RATE || 0),

  /* --- Donations -------------------------------------------------------- */
  // Stripe's published Canadian card rate. Kept here so a pricing change is one
  // edit rather than a hunt through the donation code.
  stripeFeePercent: Number(process.env.STRIPE_FEE_PERCENT || 0.029),
  stripeFeeFixedCents: Number(process.env.STRIPE_FEE_FIXED_CENTS || 30),
  // Reused for every monthly gift so the Stripe dashboard does not collect one
  // Product per subscriber. Created on first use and cached in app_meta when
  // this is left empty.
  stripeDonationProductId: process.env.STRIPE_DONATION_PRODUCT_ID || '',
  // Guard rails on the amount field, in cents. The floor matches the smallest
  // fixed button, so the buttons and the custom field never disagree.
  donationMinCents: Number(process.env.DONATION_MIN_CENTS || 2000),
  donationMaxCents: Number(process.env.DONATION_MAX_CENTS || 2000000),

  /* --- Email ------------------------------------------------------------ */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : Number(process.env.SMTP_PORT || 587) === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'Lebanon Hockey <info@lebanonhockey.com>',
  // Where new-order and contact notifications go.
  mailAdmin:
    (process.env.MAIL_ADMIN || process.env.ADMIN_EMAIL || '').trim().toLowerCase(),

  /* --- Chat ------------------------------------------------------------- */
  // Where a visitor's chat message is announced. Falls back to MAIL_ADMIN so
  // chat works before a dedicated address is chosen.
  chatNotifyEmail: (process.env.CHAT_NOTIFY_EMAIL || process.env.MAIL_ADMIN || process.env.ADMIN_EMAIL || '')
    .trim()
    .toLowerCase(),
  // Minutes to wait before emailing about the same thread again, so a visitor
  // typing several short lines does not fire several notifications.
  chatNotifyCoalesceMinutes: Number(process.env.CHAT_NOTIFY_COALESCE_MINUTES || 2),
};

export const stripeEnabled = Boolean(config.stripeSecretKey);
