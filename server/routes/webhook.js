import { Router, raw } from 'express';
import { db } from '../db.js';
import { config, stripeEnabled } from '../config.js';
import { getStripe } from '../lib/stripe.js';
import { markOrderPaid } from '../lib/orders.js';

export const webhookRouter = Router();

/**
 * Stripe webhook.
 *
 * Mounted before the JSON body parser and uses the raw body, because signature
 * verification is computed over the exact bytes Stripe sent.
 */
webhookRouter.post('/stripe/webhook', raw({ type: 'application/json' }), async (req, res) => {
  if (!stripeEnabled || !config.stripeWebhookSecret) {
    return res.status(503).send('Webhook not configured.');
  }

  const signature = req.get('stripe-signature');
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret);
  } catch (error) {
    console.error('[webhook] signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const orderId = Number(session.metadata?.order_id || session.client_reference_id);
        const cartId = Number(session.metadata?.cart_id) || null;

        if (orderId && session.payment_status === 'paid') {
          await markOrderPaid(orderId, {
            paymentIntentId:
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
            cartId,
          });
        }
        break;
      }

      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const orderId = Number(session.metadata?.order_id || session.client_reference_id);
        if (orderId) {
          db.prepare(
            "UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'"
          ).run(orderId);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.payment_intent) {
          db.prepare(
            "UPDATE orders SET status = 'refunded' WHERE stripe_payment_intent = ?"
          ).run(charge.payment_intent);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error(`[webhook] handler failed for ${event.type}:`, error.message);
    return res.status(500).send('Handler error');
  }

  res.json({ received: true });
});
