/**
 * Membership registration.
 *
 * Mirrors the donation route: validate, write the record, then try to collect
 * the fee. The difference is that a registration is worth keeping even when the
 * fee cannot be taken - the federation still wants to know who applied - so this
 * route does NOT gate on Stripe before writing. With no payment provider the
 * submission is saved and the visitor is given the federation's own
 * e-transfer / PayPal instructions, which is how the live site works today.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { config, stripeEnabled } from '../config.js';
import { getStripe } from '../lib/stripe.js';
import { rateLimit } from '../middleware/auth.js';
import {
  TIERS,
  validateRegistration,
  createRegistration,
  findRegistration,
  markRegistrationPaid,
  serialiseRegistration,
} from '../lib/registrations.js';
import { sendRegistrationEmails } from '../lib/notifications.js';

export const membershipRouter = Router();

/* What the form needs to build itself: labels, prices and which tiers ask for
   eligibility details. Served so the page and the server cannot disagree. */
membershipRouter.get('/membership/config', (req, res) => {
  res.json({
    currency: config.currency,
    paymentsEnabled: stripeEnabled,
    transferEmail: 'support@lebanonhockey.com',
    tiers: Object.entries(TIERS).map(([key, t]) => ({
      key,
      label: t.label,
      amountCents: t.amountCents,
      eligibility: t.eligibility,
    })),
  });
});

membershipRouter.post(
  '/membership',
  rateLimit({ max: 10, windowMs: 60 * 60 * 1000, key: 'membership' }),
  async (req, res) => {
    const error = validateRegistration(req.body || {});
    if (error) return res.status(400).json({ error });

    const { registrationId, amountCents } = createRegistration(req.body);

    /* Tell the federation and the applicant straight away. The fee can follow;
       the application itself is the thing that matters. */
    sendRegistrationEmails(registrationId).catch(() => {});

    if (!stripeEnabled) {
      return res.status(201).json({
        registrationId,
        amountCents,
        paid: false,
        code: 'payments_disabled',
        transferEmail: 'support@lebanonhockey.com',
      });
    }

    try {
      const stripe = getStripe();
      const tier = TIERS[req.body.tier];

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: findRegistration(registrationId).email,
        line_items: [
          {
            price_data: {
              currency: config.currency,
              unit_amount: amountCents,
              product_data: { name: `LIHF membership - ${tier.label}` },
            },
            quantity: 1,
          },
        ],
        metadata: { kind: 'membership', registration_id: String(registrationId) },
        success_url: `${config.appUrl}/membership.html?registration=${registrationId}&session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.appUrl}/membership.html?cancelled=1`,
      });

      db.prepare(
        "UPDATE registrations SET stripe_session_id = ?, payment_status = 'pending' WHERE id = ?"
      ).run(session.id, registrationId);

      return res.status(201).json({ registrationId, amountCents, url: session.url });
    } catch (err) {
      console.error('[membership] could not start payment:', err.message);
      /* The registration stands; only the payment failed. Say exactly that
         rather than implying the application was lost. */
      return res.status(201).json({
        registrationId,
        amountCents,
        paid: false,
        code: 'payment_unavailable',
        transferEmail: 'support@lebanonhockey.com',
      });
    }
  }
);

/* Coming back from Stripe. */
membershipRouter.get('/membership/status/:id', async (req, res) => {
  const registration = findRegistration(req.params.id);
  if (!registration) return res.status(404).json({ error: 'Registration not found.' });

  const holdsSession = req.query.session && req.query.session === registration.stripe_session_id;
  if (!holdsSession && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Not your registration.' });
  }

  if (registration.payment_status !== 'paid' && registration.stripe_session_id && stripeEnabled) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(registration.stripe_session_id);
      if (session.payment_status === 'paid') markRegistrationPaid(registration.id);
    } catch (error) {
      console.error('[membership] status check failed:', error.message);
    }
  }

  /* Only what the page needs to say thank you - this record holds passport-form
     names and citizenships, and none of that belongs in a response that a
     session id alone can reach. */
  const fresh = serialiseRegistration(findRegistration(registration.id));
  res.json({
    registration: {
      id: fresh.id,
      tierLabel: fresh.tierLabel,
      amountCents: fresh.amountCents,
      currency: fresh.currency,
      paymentStatus: fresh.paymentStatus,
      firstName: fresh.firstName,
    },
  });
});
