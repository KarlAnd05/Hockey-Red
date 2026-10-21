/**
 * Sponsors.
 *
 * Four partner cards used to be hardcoded in sponsors.html, so adding a
 * sponsor meant editing HTML. They are rows now, ordered by tier.
 */
import { db } from '../db.js';

/* The federation's own ladder. The index is the sort order, so a sponsor moves
   up the page by changing tier rather than by someone reordering the list. */
export const TIERS = ['platinum', 'gold', 'silver', 'bronze', 'partner'];

export const TIER_LABEL = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  partner: 'Partner',
};

const tierRank = (tier) => {
  const i = TIERS.indexOf(tier);
  return i === -1 ? TIERS.length : i;
};

export function listSponsors({ includeInactive = false } = {}) {
  const rows = db
    .prepare(`SELECT * FROM sponsors ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order, id`)
    .all();

  /* Sorted here rather than in SQL: the tier order is a product decision, not
     an alphabetical one, and SQLite has no CASE-free way to express it that
     stays readable. */
  return rows.sort((a, b) => {
    const byTier = tierRank(a.tier) - tierRank(b.tier);
    if (byTier !== 0) return byTier;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id - b.id;
  });
}

export function findSponsor(id) {
  return db.prepare('SELECT * FROM sponsors WHERE id = ?').get(Number(id)) || null;
}

export function serialiseSponsor(sponsor) {
  return {
    id: sponsor.id,
    name: sponsor.name,
    tier: sponsor.tier,
    tierLabel: TIER_LABEL[sponsor.tier] || sponsor.tier,
    blurb: sponsor.blurb,
    websiteUrl: sponsor.website_url,
    logoUrl: sponsor.logo_url,
    logoAlt: sponsor.logo_alt,
    active: Boolean(sponsor.active),
    sortOrder: sponsor.sort_order,
  };
}

/**
 * The four partners the page already showed, moved into the table once.
 *
 * Seeded rather than left empty so the page does not go blank the moment it
 * starts reading from the database. The Gold and Silver rows carried several
 * names in one card on the old page; they are split into one row each, which
 * is what the table is for.
 */
const SEED = [
  { name: 'PILLAR5', tier: 'platinum', blurb: "Our lead partner, supporting the federation's biggest initiatives." },
  { name: 'Egothera', tier: 'gold', blurb: 'Gold partners help fund facilities, professional coaching, and player experiences.' },
  { name: 'Bawer', tier: 'gold', blurb: 'Gold partners help fund facilities, professional coaching, and player experiences.' },
  { name: 'Canelle', tier: 'gold', blurb: 'Gold partners help fund facilities, professional coaching, and player experiences.' },
  { name: 'Adonis', tier: 'silver', blurb: 'Silver partners provide equipment, training, and other resources athletes need.' },
  { name: 'SLC', tier: 'silver', blurb: 'Silver partners provide equipment, training, and other resources athletes need.' },
  { name: "Mr. Mike's", tier: 'bronze', blurb: 'Bronze partners help make hockey accessible and enjoyable for everyone.' },
];

export function seedSponsors() {
  const already = db.prepare('SELECT COUNT(*) AS n FROM sponsors').get().n;
  if (already) return 0;

  const insert = db.prepare(
    'INSERT INTO sponsors (name, tier, blurb, sort_order) VALUES (?, ?, ?, ?)'
  );

  SEED.forEach((s, i) => insert.run(s.name, s.tier, s.blurb, i));
  return SEED.length;
}
