import Stripe from 'stripe';
import { config, stripeEnabled } from '../config.js';

let client = null;

/**
 * Lazily constructed so the app still boots (and the public site still works)
 * when Stripe keys have not been configured yet.
 */
export function getStripe() {
  if (!stripeEnabled) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  if (!client) {
    client = new Stripe(config.stripeSecretKey, { apiVersion: '2025-10-29.clover' });
  }
  return client;
}
