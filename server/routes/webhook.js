import { Router, raw } from 'express';
import { db } from '../db.js';
import { config, stripeEnabled } from '../config.js';
import { getStripe } from '../lib/stripe.js';
import { markOrderPaid } from '../lib/orders.js';
import {
  findDonationBySubscription,
  markDonationPaid,
  recordDonationPayment,
  setDonationStatus,
} from '../lib/donations.js';
import { sendDonationThankYou, sendDonationAdminAlert } from '../lib/notifications.js';
import { markRegistrationPaid } from '../lib/registrations.js';

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

        /* Donations carry their own discriminator. Without this branch a gift
           session falls through harmlessly (order_id is NaN) and is never
           recorded at all. */
        if (session.metadata?.kind === 'membership') {
          const registrationId = Number(session.metadata.registration_id);
          if (registrationId && session.payment_status === 'paid') {
            markRegistrationPaid(registrationId, { sessionId: session.id });
          }
          break;
        }

        if (session.metadata?.kind === 'donation') {
          const donationId = Number(session.metadata.donation_id);
          const settled = session.payment_status === 'paid' || session.status === 'complete';

          if (donationId && settled) {
            const paid = markDonationPaid(donationId, {
              customerId: typeof session.customer === 'string' ? session.customer : null,
              subscriptionId:
                typeof session.subscription === 'string' ? session.subscription : null,
            });
            if (paid) {
              // Best effort; sendMail never throws and a mail problem must not
              // make Stripe retry a payment that already succeeded.
              sendDonationThankYou(paid.id).catch(() => {});
              sendDonationAdminAlert(paid.id).catch(() => {});
            }
          }
          break;
        }

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

      /* Monthly giving. The money event for a subscription is invoice.paid, not
         the Checkout session - a subscription session carries no payment_intent
         and only the first cycle at all. */
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;

        /* Stripe moved this field as the API evolved; read every shape rather
           than silently stop recording renewals after an upgrade. */
        const subscriptionId =
          (typeof invoice.subscription === 'string' && invoice.subscription) ||
          invoice.subscription?.id ||
          invoice.parent?.subscription_details?.subscription ||
          null;

        if (!subscriptionId) break;

        const donation = findDonationBySubscription(subscriptionId);
        if (!donation) break;

        if (event.type === 'invoice.paid') {
          // The UNIQUE on stripe_invoice_id makes a redelivery a no-op.
          recordDonationPayment({
            donationId: donation.id,
            invoiceId: invoice.id,
            amountCents: invoice.amount_paid,
            currency: invoice.currency,
          });
          if (donation.status !== 'active') setDonationStatus(donation.id, 'active');
        } else {
          recordDonationPayment({
            donationId: donation.id,
            invoiceId: invoice.id,
            amountCents: invoice.amount_due,
            currency: invoice.currency,
            status: 'failed',
          });
          setDonationStatus(donation.id, 'past_due');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const donation = findDonationBySubscription(subscription.id);
        if (donation) setDonationStatus(donation.id, 'canceled');
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
