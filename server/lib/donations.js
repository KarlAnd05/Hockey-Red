/**
 * Donations - one-time and monthly.
 *
 * Deliberately parallel to lib/orders.js rather than built on it. A gift has no
 * cart, no stock, no shipping and no order number, and markOrderPaid() would
 * clear the donor's live shopping cart on its way past. What IS borrowed is the
 * thinking: integer cents everywhere, and a status flip that happens before any
 * side effect so a redelivered webhook is a no-op.
 *
 * Nothing here claims a donation is tax deductible. The federation's charitable
 * status is unconfirmed, so the confirmation is a payment record, not a receipt.
 */
import { randomBytes, createHash } from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';
import { formatMoney } from './money.js';

/* --- The fee top-up -------------------------------------------------------
   A donor who opts to "cover the fees" expects the federation to receive the
   amount they picked. Charging amount x 2.9% does not achieve that: it ignores
   the fixed per-transaction fee, and it ignores the fee charged on the top-up
   itself. Solving for the total that nets the intended amount:

       total = (amount + fixed) / (1 - percent)

   On a $20 gift at 2.9% + $0.30 that is $20.91, so the fee shown is $0.91.
   Rounding up by a cent, never down, so the federation is never left short. */
export function feeForAmount(amountCents) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  if (amount === 0) return 0;

  const total = Math.ceil((amount + config.stripeFeeFixedCents) / (1 - config.stripeFeePercent));
  return Math.max(0, total - amount);
}

/** What the donor is actually charged, given whether they opted into the fee. */
export function totalForAmount(amountCents, coverFee) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  return coverFee ? amount + feeForAmount(amount) : amount;
}

export function validateAmount(amountCents) {
  const amount = Math.round(Number(amountCents) || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Choose an amount to give.';
  if (amount < config.donationMinCents) {
    return `The smallest gift we can process is ${formatMoney(config.donationMinCents, config.currency)}.`;
  }
  if (amount > config.donationMaxCents) {
    return 'That is larger than this form can take - please contact the federation directly.';
  }
  return null;
}

/* --- The donor's link back ------------------------------------------------
   A monthly donor has no account to sign into, so cancelling has to be reachable
   from the thank-you email. Only the hash is stored, exactly as session tokens
   are handled: the raw token exists in the donor's inbox and nowhere else. */
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createPendingDonation({
  kind,
  email,
  name,
  message,
  amountCents,
  coverFee,
  displayPublicly = false,
  publicName = '',
}) {
  const amount = Math.round(Number(amountCents) || 0);
  const fee = coverFee ? feeForAmount(amount) : 0;
  const total = amount + fee;
  const manageToken = randomBytes(32).toString('hex');

  const info = db
    .prepare(
      `INSERT INTO donations
         (kind, status, email, name, message, amount_cents, fee_cents, total_cents, currency,
          manage_token_hash, display_publicly, public_name)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      kind === 'monthly' ? 'monthly' : 'one_time',
      String(email || '').trim().toLowerCase().slice(0, 200),
      String(name || '').trim().slice(0, 160),
      String(message || '').trim().slice(0, 1000),
      amount,
      fee,
      total,
      config.currency,
      hashToken(manageToken),
      displayPublicly ? 1 : 0,
      String(publicName || '').trim().slice(0, 160)
    );

  return { donationId: Number(info.lastInsertRowid), manageToken, amount, fee, total };
}

/**
 * Mint the donor's manage link and keep only its hash.
 *
 * Called when the thank-you email is built, not when the gift is created: the
 * raw token has to reach the donor's inbox, and storing it so it could be read
 * back later would mean anyone with database access could open that donor's
 * billing portal. Issuing it at send time means the raw value exists for exactly
 * as long as it takes to render one email.
 */
export function issueManageToken(donationId) {
  const token = randomBytes(32).toString('hex');
  db.prepare('UPDATE donations SET manage_token_hash = ? WHERE id = ?').run(
    hashToken(token),
    Number(donationId)
  );
  return token;
}

export function findDonation(id) {
  return db.prepare('SELECT * FROM donations WHERE id = ?').get(Number(id)) || null;
}

export function findDonationByManageToken(token) {
  if (!token) return null;
  return db.prepare('SELECT * FROM donations WHERE manage_token_hash = ?').get(hashToken(token)) || null;
}

export function findDonationBySubscription(subscriptionId) {
  if (!subscriptionId) return null;
  return db.prepare('SELECT * FROM donations WHERE stripe_subscription_id = ?').get(subscriptionId) || null;
}

/**
 * Settle a gift. Idempotent in the same way markOrderPaid is: anything already
 * past 'pending' returns untouched, and the status flip is the first write, so a
 * webhook redelivered after the fact changes nothing.
 *
 * A monthly gift lands on 'active' rather than 'paid' - the subscription is a
 * standing arrangement, not a completed transaction.
 */
export function markDonationPaid(donationId, { sessionId, customerId, subscriptionId } = {}) {
  const donation = findDonation(donationId);
  if (!donation) return null;
  if (donation.status !== 'pending') return donation;

  const settled = donation.kind === 'monthly' ? 'active' : 'paid';

  db.prepare(
    `UPDATE donations
        SET status = ?,
            paid_at = datetime('now'),
            stripe_session_id = COALESCE(?, stripe_session_id),
            stripe_customer_id = COALESCE(?, stripe_customer_id),
            stripe_subscription_id = COALESCE(?, stripe_subscription_id)
      WHERE id = ?`
  ).run(settled, sessionId || null, customerId || null, subscriptionId || null, donation.id);

  return findDonation(donation.id);
}

/**
 * Record one charge against a monthly gift.
 *
 * The UNIQUE on stripe_invoice_id is the whole safety mechanism: Stripe redelivers
 * invoice.paid freely, and unlike a one-time gift there is no single status to
 * pivot on. An insert that collides is the correct outcome and is swallowed.
 * Returns true only when this call is what actually recorded the payment.
 */
export function recordDonationPayment({ donationId, invoiceId, amountCents, currency, status = 'paid' }) {
  try {
    db.prepare(
      `INSERT INTO donation_payments (donation_id, stripe_invoice_id, amount_cents, currency, status)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      Number(donationId),
      invoiceId || null,
      Math.max(0, Math.round(Number(amountCents) || 0)),
      String(currency || config.currency).toLowerCase(),
      status === 'failed' ? 'failed' : 'paid'
    );
    return true;
  } catch (error) {
    // UNIQUE violation = Stripe sent this invoice before. Not an error.
    if (String(error.message).includes('UNIQUE')) return false;
    throw error;
  }
}

export function setDonationStatus(donationId, status) {
  const canceling = status === 'canceled';
  db.prepare(
    `UPDATE donations
        SET status = ?, canceled_at = CASE WHEN ? THEN datetime('now') ELSE canceled_at END
      WHERE id = ?`
  ).run(status, canceling ? 1 : 0, Number(donationId));
  return findDonation(donationId);
}

/* --- The recurring Product ------------------------------------------------
   Checkout will happily mint a fresh Stripe Product from inline product_data on
   every subscription, which leaves the dashboard with one Product per donor.
   Create one, remember it, reuse it. */
export async function getDonationProductId(stripe) {
  if (config.stripeDonationProductId) return config.stripeDonationProductId;

  const cached = db.prepare("SELECT value FROM app_meta WHERE key = 'stripe_donation_product_id'").get();
  if (cached?.value) return cached.value;

  const product = await stripe.products.create({
    name: 'Monthly donation - Lebanese Ice Hockey Federation',
    metadata: { kind: 'donation' },
  });

  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('stripe_donation_product_id', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(product.id);

  return product.id;
}

export function serialiseDonation(donation, { includePayments = false } = {}) {
  if (!donation) return null;

  const out = {
    id: donation.id,
    kind: donation.kind,
    status: donation.status,
    email: donation.email,
    name: donation.name,
    message: donation.message,
    amountCents: donation.amount_cents,
    feeCents: donation.fee_cents,
    totalCents: donation.total_cents,
    currency: donation.currency,
    displayPublicly: Boolean(donation.display_publicly),
    publicName: donation.public_name || '',
    createdAt: donation.created_at,
    paidAt: donation.paid_at,
    canceledAt: donation.canceled_at,
    isRecurring: donation.kind === 'monthly',
  };

  if (includePayments) {
    out.payments = db
      .prepare('SELECT * FROM donation_payments WHERE donation_id = ? ORDER BY id DESC')
      .all(donation.id)
      .map((p) => ({
        id: p.id,
        amountCents: p.amount_cents,
        currency: p.currency,
        status: p.status,
        createdAt: p.created_at,
      }));
  }

  return out;
}

/* ==========================================================================
   Public leaderboard
   --------------------------------------------------------------------------
   Two conditions, both required, and the order matters for understanding why:

     - The donor opted in. display_publicly defaults to 0, so a gift given
       before this feature existed, or given without ticking the box, is
       private. Consent is given, never assumed.
     - The gift is actually settled. 'paid' is a completed one-time gift and
       'active' is a live monthly one. A 'pending' gift is a checkout somebody
       started; publishing that name would announce a donation that may never
       be paid, and would let anyone put a name on the page for free.
   ========================================================================== */
const SETTLED = ["'paid'", "'active'"].join(', ');

export function leaderboard({ limit = 100 } = {}) {
  return db
    .prepare(
      `SELECT id, kind, amount_cents, currency, paid_at, created_at,
              CASE WHEN public_name <> '' THEN public_name ELSE name END AS display_name
         FROM donations
        WHERE display_publicly = 1
          AND status IN (${SETTLED})
          AND CASE WHEN public_name <> '' THEN public_name ELSE name END <> ''
        ORDER BY amount_cents DESC, COALESCE(paid_at, created_at) ASC
        LIMIT ?`
    )
    .all(Math.max(1, Math.min(500, Number(limit) || 100)));
}

export function serialiseLeaderboardEntry(row) {
  return {
    name: row.display_name,
    kind: row.kind,
    amountCents: row.amount_cents,
    currency: row.currency,
    since: String(row.paid_at || row.created_at || '').slice(0, 10),
  };
}

/** Admin: change how a gift appears publicly, without touching the gift. */
export function setDonationVisibility(donationId, { displayPublicly, publicName }) {
  const donation = findDonation(donationId);
  if (!donation) return null;

  db.prepare(
    `UPDATE donations
        SET display_publicly = ?,
            public_name = ?
      WHERE id = ?`
  ).run(
    displayPublicly ? 1 : 0,
    String(publicName ?? donation.public_name ?? '').trim().slice(0, 160),
    donation.id
  );

  return findDonation(donation.id);
}
