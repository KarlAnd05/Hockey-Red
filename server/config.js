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
};

export const stripeEnabled = Boolean(config.stripeSecretKey);
