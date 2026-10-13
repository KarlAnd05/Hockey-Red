/**
 * Membership registrations.
 *
 * The federation's player form: contact details, eligibility details, and a
 * membership tier that carries a fee.
 *
 * Two deliberate decisions worth knowing about:
 *
 *   1. Prices live here, never in the request. The client sends a tier name and
 *      the amount is looked up server-side, so nobody can register at a price
 *      they chose themselves. Same rule the cart follows.
 *
 *   2. The eligibility block - date of birth, place of birth, citizenships,
 *      including both parents' - is only collected for registrations that need
 *      it. A fan buying a supporter membership is not asked for their parents'
 *      citizenship. IIHF eligibility is why that data is collected at all, and
 *      collecting it from someone it cannot apply to would be over-collection
 *      under Law 25, which privacy.html commits the site to.
 */
import { db } from '../db.js';
import { config } from '../config.js';

export const TIERS = {
  board: { label: 'Board Member / Manager / Coach', amountCents: 15000, eligibility: true },
  player: { label: 'Player', amountCents: 7500, eligibility: true },
  supporter: { label: 'Fan / Supporter', amountCents: 7500, eligibility: false },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (value, max) => String(value ?? '').trim().slice(0, max);

const num = (value, min, max) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

export function validateRegistration(body) {
  const tier = TIERS[body?.tier] ? body.tier : null;
  if (!tier) return 'Choose a membership type.';

  if (!EMAIL_RE.test(str(body.email, 200))) return 'Enter a valid email address.';
  if (!str(body.firstName, 120)) return 'Enter your first name as it appears in your passport.';
  if (!str(body.lastName, 120)) return 'Enter your last name as it appears in your passport.';

  /* Only enforced where the data is actually collected. */
  if (TIERS[tier].eligibility) {
    if (!str(body.dateOfBirth, 20)) return 'Enter your date of birth.';
    if (!str(body.citizenship, 120)) return 'Enter your citizenship.';
  }

  return null;
}

export function createRegistration(body) {
  const tier = TIERS[body.tier];
  const wantsEligibility = tier.eligibility;

  // Blank the eligibility fields outright when the tier does not need them,
  // rather than trusting the form to have hidden them.
  const e = (value, max) => (wantsEligibility ? str(value, max) : '');

  const info = db
    .prepare(
      `INSERT INTO registrations
         (tier, amount_cents, currency, email, phone, first_name, last_name, middle_name,
          date_of_birth, position, shoots, height_cm, weight_kg, place_of_birth,
          country_of_birth, city_of_residence, citizenship, citizenship_second,
          citizenship_father, citizenship_mother, highest_level_played, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      body.tier,
      tier.amountCents,
      config.currency,
      str(body.email, 200).toLowerCase(),
      str(body.phone, 60),
      str(body.firstName, 120),
      str(body.lastName, 120),
      str(body.middleName, 120),
      e(body.dateOfBirth, 20),
      e(body.position, 60),
      e(body.shoots, 20),
      wantsEligibility ? num(body.heightCm, 50, 260) : null,
      wantsEligibility ? num(body.weightKg, 20, 250) : null,
      e(body.placeOfBirth, 120),
      e(body.countryOfBirth, 120),
      str(body.cityOfResidence, 120),
      e(body.citizenship, 120),
      e(body.citizenshipSecond, 120),
      e(body.citizenshipFather, 120),
      e(body.citizenshipMother, 120),
      e(body.highestLevelPlayed, 160),
      str(body.message, 2000)
    );

  return { registrationId: Number(info.lastInsertRowid), amountCents: tier.amountCents };
}

export function findRegistration(id) {
  return db.prepare('SELECT * FROM registrations WHERE id = ?').get(Number(id)) || null;
}

/** Idempotent, in the same shape as markOrderPaid and markDonationPaid. */
export function markRegistrationPaid(id, { sessionId } = {}) {
  const row = findRegistration(id);
  if (!row) return null;
  if (row.payment_status === 'paid') return row;

  db.prepare(
    `UPDATE registrations
        SET payment_status = 'paid',
            paid_at = datetime('now'),
            stripe_session_id = COALESCE(?, stripe_session_id)
      WHERE id = ?`
  ).run(sessionId || null, row.id);

  return findRegistration(row.id);
}

export function serialiseRegistration(row) {
  if (!row) return null;
  return {
    id: row.id,
    tier: row.tier,
    tierLabel: TIERS[row.tier]?.label || row.tier,
    amountCents: row.amount_cents,
    currency: row.currency,
    paymentStatus: row.payment_status,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    dateOfBirth: row.date_of_birth,
    position: row.position,
    shoots: row.shoots,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    placeOfBirth: row.place_of_birth,
    countryOfBirth: row.country_of_birth,
    cityOfResidence: row.city_of_residence,
    citizenship: row.citizenship,
    citizenshipSecond: row.citizenship_second,
    citizenshipFather: row.citizenship_father,
    citizenshipMother: row.citizenship_mother,
    highestLevelPlayed: row.highest_level_played,
    message: row.message,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function listRegistrations() {
  return db
    .prepare('SELECT * FROM registrations ORDER BY id DESC LIMIT 500')
    .all()
    .map(serialiseRegistration);
}

/** A spreadsheet of everything, for the federation's own records. */
export function registrationsCsv() {
  const rows = listRegistrations();
  const headers = [
    'id', 'created', 'tier', 'amount', 'payment', 'email', 'phone',
    'first name', 'middle name', 'last name', 'date of birth', 'position', 'shoots',
    'height cm', 'weight kg', 'place of birth', 'country of birth', 'city of residence',
    'citizenship', '2nd citizenship', 'father citizenship', 'mother citizenship',
    'highest level', 'message',
  ];

  /* A leading =, +, - or @ makes a spreadsheet treat the cell as a formula, so a
     crafted answer could run on whoever opens the export. Prefix those. */
  const cell = (value) => {
    const v = String(value ?? '');
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const lines = [headers.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.createdAt, r.tierLabel, (r.amountCents / 100).toFixed(2), r.paymentStatus,
        r.email, r.phone, r.firstName, r.middleName, r.lastName, r.dateOfBirth,
        r.position, r.shoots, r.heightCm ?? '', r.weightKg ?? '', r.placeOfBirth,
        r.countryOfBirth, r.cityOfResidence, r.citizenship, r.citizenshipSecond,
        r.citizenshipFather, r.citizenshipMother, r.highestLevelPlayed, r.message,
      ]
        .map(cell)
        .join(',')
    );
  }

  return lines.join('\r\n');
}
