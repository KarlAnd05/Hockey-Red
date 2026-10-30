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

  // Where parcels ship from. Used as the assumed destination on the cart page,
  // before the customer has given an address - see lib/shipping.js.
  shippingOriginCountry: (process.env.SHIPPING_ORIGIN_COUNTRY || 'CA').toUpperCase(),
  shippingFlatCents: Number(process.env.SHIPPING_FLAT_CENTS || 1500),
  freeShippingThresholdCents: Number(process.env.FREE_SHIPPING_THRESHOLD_CENTS || 20000),
  taxRate: Number(process.env.TAX_RATE || 0),

  /* --- Interac e-Transfer ----------------------------------------------- *
   * There is no Interac API to integrate with, so this is a confirmation
   * workflow: the buyer sends the transfer themselves and the federation
   * marks the order paid once it lands. Setting the address is what turns
   * the option on - without somewhere to send the money there is nothing to
   * offer, so an unset value hides the method rather than showing a broken
   * one. */
  etransferEmail: (process.env.ETRANSFER_EMAIL || '').trim().toLowerCase(),
  etransferName: process.env.ETRANSFER_NAME || 'Lebanese Ice Hockey Federation',

  /* --- Donations -------------------------------------------------------- */
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
