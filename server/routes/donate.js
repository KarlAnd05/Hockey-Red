/**
 * Donations - Checkout sessions, status polling, and the donor's way out.
 *
 * Shaped after routes/checkout.js so the two read the same way, with three
 * deliberate differences: no cart, no shipping, and a subscription path.
 */
import { Router } from 'express';
import { db } from '../db.js';
import { config, stripeEnabled } from '../config.js';
import { getStripe } from '../lib/stripe.js';
import {
  createPendingDonation,
  findDonation,
  findDonationByManageToken,
  getDonationProductId,
  serialiseDonation,
  validateAmount,
  markDonationPaid,
  leaderboard,
  serialiseLeaderboardEntry,
} from '../lib/donations.js';
import { sendDonationThankYou } from '../lib/notifications.js';

export const donateRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* --------------------------------------------------------------------------
   What the form needs to render
   --------------------------------------------------------------------------
   The fee figure shown to the donor has to match what they are actually
   charged. Serving the constants instead of hardcoding them in the page means
   the two can never drift apart when Stripe changes its pricing.
   -------------------------------------------------------------------------- */
donateRouter.get('/donate/config', (req, res) => {
  res.json({
    currency: config.currency,
    minCents: config.donationMinCents,
    maxCents: config.donationMaxCents,
    suggestedCents: [2000, 5000, 10000, 20000],
    paymentsEnabled: stripeEnabled,
  });
});

/* --------------------------------------------------------------------------
   The public leaderboard
   --------------------------------------------------------------------------
   Only settled gifts whose donor opted in. See lib/donations.js for why both
   conditions are required.
   -------------------------------------------------------------------------- */
donateRouter.get('/donate/leaderboard', (req, res) => {
  res.json({
    currency: config.currency,
    entries: leaderboard({ limit: 100 }).map(serialiseLeaderboardEntry),
  });
});

/* --------------------------------------------------------------------------
   Start a donation
   -------------------------------------------------------------------------- */
donateRouter.post('/donate', async (req, res) => {
  const kind = req.body?.kind === 'monthly' ? 'monthly' : 'one_time';
  const email = String(req.body?.email || req.user?.email || '').trim().toLowerCase();
  const amountCents = Math.round(Number(req.body?.amountCents) || 0);

  /* Email is required for a monthly gift and optional for a one-time one.

     The asymmetry is the point. A recurring charge has to come with a way to
     stop it, and the donor's only way out is the manage link in the email - a
     subscription with no address attached is a charge the donor cannot cancel
     by themselves. A one-time gift has nothing to cancel, so insisting on an
     address there only costs the federation donations. */
  if (kind === 'monthly' && !EMAIL_RE.test(email)) {
    return res.status(400).json({
      error: 'A monthly gift needs an email address: that is where the link to cancel it is sent.',
    });
  }

  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  const amountError = validateAmount(amountCents);
  if (amountError) return res.status(400).json({ error: amountError });

  /* Gate before anything is written, exactly as checkout does. A donation row
     created here and then refused would be a pending gift nobody can settle. */
  if (!stripeEnabled) {
    return res.status(503).json({
      error: 'The federation cannot take card donations yet.',
      code: 'payments_disabled',
    });
  }

  const { donationId, manageToken, amount, fee, total } = createPendingDonation({
    kind,
    email,
    name: req.body?.name,
    message: req.body?.message,
    amountCents,
    /* Recorded now, published only once the gift is settled. An unpaid
       checkout must never put a name on the public page. */
    displayPublicly: Boolean(req.body?.displayPublicly),
    publicName: req.body?.publicName || req.body?.name,
  });

  try {
    const stripe = getStripe();
    const currency = config.currency;

    /* One line item either way. The fee top-up is folded into the amount rather
       than shown as a separate line, because Stripe would charge its own fee on
       a second line too and the donor would be left slightly short again. */
    const label =
      kind === 'monthly'
        ? 'Monthly donation to Lebanese Ice Hockey Federation'
        : 'Donation to Lebanese Ice Hockey Federation';

    const session = await stripe.checkout.sessions.create(
      kind === 'monthly'
        ? {
            mode: 'subscription',
            customer_email: email,
            line_items: [
              {
                price_data: {
                  currency,
                  unit_amount: total,
                  // A single reused Product; see getDonationProductId.
                  product: await getDonationProductId(stripe),
                  recurring: { interval: 'month' },
                },
                quantity: 1,
              },
            ],
            /* Checkout metadata does NOT reach the recurring invoices. Without
               this second copy on the subscription, every renewal after the
               first arrives with no way to tell whose gift it is. */
            subscription_data: {
              metadata: { kind: 'donation', donation_id: String(donationId) },
            },
            metadata: { kind: 'donation', donation_id: String(donationId) },
            success_url: `${config.appUrl}/donation.html?donation=${donationId}&session={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.appUrl}/donation.html?cancelled=1`,
          }
        : {
            mode: 'payment',
            customer_email: email,
            line_items: [
              {
                price_data: {
                  currency,
                  unit_amount: total,
                  product_data: { name: label },
                },
                quantity: 1,
              },
            ],
            metadata: { kind: 'donation', donation_id: String(donationId) },
            success_url: `${config.appUrl}/donation.html?donation=${donationId}&session={CHECKOUT_SESSION_ID}`,
            cancel_url: `${config.appUrl}/donation.html?cancelled=1`,
          }
    );

    db.prepare('UPDATE donations SET stripe_session_id = ? WHERE id = ?').run(session.id, donationId);

    return res.json({ url: session.url, donationId, amount, fee, total, manageToken });
  } catch (error) {
    console.error('[donate] could not create a session:', error.message);
    db.prepare("UPDATE donations SET status = 'failed' WHERE id = ? AND status = 'pending'").run(donationId);
    return res
      .status(502)
      .json({ error: 'Could not reach the payment provider. Please try again.' });
  }
});

/* --------------------------------------------------------------------------
   Status - used by the thank-you panel after Stripe redirects back
   -------------------------------------------------------------------------- */
donateRouter.get('/donate/status/:id', async (req, res) => {
  const donation = findDonation(req.params.id);
  if (!donation) return res.status(404).json({ error: 'Donation not found.' });

  /* A donor has no account, so the Stripe session id in the return URL is the
     bearer proof - the same trick guest orders use. */
  const holdsSession = req.query.session && req.query.session === donation.stripe_session_id;
  const isAdmin = req.user?.role === 'admin';
  if (!holdsSession && !isAdmin) {
    return res.status(403).json({ error: 'Not your donation.' });
  }

  /* Webhook fallback: if the gift is still pending, ask Stripe directly rather
     than leaving the donor staring at "processing" because a webhook was lost. */
  if (donation.status === 'pending' && donation.stripe_session_id && stripeEnabled) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(donation.stripe_session_id);
      const settled =
        session.payment_status === 'paid' || session.status === 'complete';
      if (settled) {
        const paid = markDonationPaid(donation.id, {
          customerId: typeof session.customer === 'string' ? session.customer : null,
          subscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
        });
        if (paid) sendDonationThankYou(paid.id).catch(() => {});
      }
    } catch (error) {
      console.error('[donate] status check failed:', error.message);
    }
  }

  res.json({ donation: serialiseDonation(findDonation(donation.id)) });
});

/* --------------------------------------------------------------------------
   Manage a monthly gift
   --------------------------------------------------------------------------
   A monthly donor must be able to stop giving, and they have no account to sign
   into. The thank-you email carries a one-off link here; this hands them to
   Stripe's own billing portal, which owns cancellation entirely.
   -------------------------------------------------------------------------- */
donateRouter.get('/donate/manage/:token', async (req, res) => {
  const donation = findDonationByManageToken(req.params.token);

  if (!donation || !donation.stripe_customer_id) {
    return res.status(404).send('That link is not valid. Please contact the federation.');
  }
  if (!stripeEnabled) {
    return res.status(503).send('Payments are not configured.');
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: donation.stripe_customer_id,
      return_url: `${config.appUrl}/donation.html`,
    });
    return res.redirect(303, portal.url);
  } catch (error) {
    console.error('[donate] billing portal failed:', error.message);
    return res
      .status(502)
      .send('Could not open the billing portal. Please contact the federation.');
  }
});
