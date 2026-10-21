/**
 * Shipping zones.
 *
 * Shipping used to be one flat fee regardless of destination. It is now worked
 * out from where the parcel is going: each zone carries a base fee, an optional
 * per-item fee, an optional free-over threshold and a delivery estimate, and
 * covers a list of countries.
 *
 * Three rules this module exists to enforce:
 *
 *   1. The quote is computed here and nowhere else. The client sends a country,
 *      never a price - the same rule the cart already follows for line items.
 *   2. A country nobody has mapped falls to the DEFAULT zone. Shipping must
 *      never quietly become free because a destination was not in the table;
 *      a silent free shipment to the other side of the world is the expensive
 *      failure, not an error message.
 *   3. With no zones configured at all, the old flat config still applies, so
 *      the shop keeps working while zones are being set up.
 */
import { db } from '../db.js';
import { config } from '../config.js';

/* ISO 3166-1 alpha-2. Kept here so the checkout select, the admin zone editor
   and the lookup all read from one list and cannot disagree about a code. */
const COUNTRY_DATA =
  'AD:Andorra|AE:United Arab Emirates|AF:Afghanistan|AG:Antigua and Barbuda|AL:Albania|AM:Armenia|' +
  'AO:Angola|AR:Argentina|AT:Austria|AU:Australia|AZ:Azerbaijan|BA:Bosnia and Herzegovina|' +
  'BB:Barbados|BD:Bangladesh|BE:Belgium|BF:Burkina Faso|BG:Bulgaria|BH:Bahrain|BI:Burundi|BJ:Benin|' +
  'BN:Brunei|BO:Bolivia|BR:Brazil|BS:Bahamas|BT:Bhutan|BW:Botswana|BY:Belarus|BZ:Belize|CA:Canada|' +
  'CD:DR Congo|CF:Central African Republic|CG:Congo|CH:Switzerland|CI:Cote d Ivoire|CL:Chile|' +
  'CM:Cameroon|CN:China|CO:Colombia|CR:Costa Rica|CU:Cuba|CV:Cabo Verde|CY:Cyprus|CZ:Czechia|' +
  'DE:Germany|DJ:Djibouti|DK:Denmark|DM:Dominica|DO:Dominican Republic|DZ:Algeria|EC:Ecuador|' +
  'EE:Estonia|EG:Egypt|ER:Eritrea|ES:Spain|ET:Ethiopia|FI:Finland|FJ:Fiji|FR:France|GA:Gabon|' +
  'GB:United Kingdom|GD:Grenada|GE:Georgia|GH:Ghana|GM:Gambia|GN:Guinea|GQ:Equatorial Guinea|' +
  'GR:Greece|GT:Guatemala|GW:Guinea-Bissau|GY:Guyana|HN:Honduras|HR:Croatia|HT:Haiti|HU:Hungary|' +
  'ID:Indonesia|IE:Ireland|IL:Israel|IN:India|IQ:Iraq|IR:Iran|IS:Iceland|IT:Italy|JM:Jamaica|' +
  'JO:Jordan|JP:Japan|KE:Kenya|KG:Kyrgyzstan|KH:Cambodia|KM:Comoros|KR:South Korea|KW:Kuwait|' +
  'KZ:Kazakhstan|LA:Laos|LB:Lebanon|LC:Saint Lucia|LI:Liechtenstein|LK:Sri Lanka|LR:Liberia|' +
  'LS:Lesotho|LT:Lithuania|LU:Luxembourg|LV:Latvia|LY:Libya|MA:Morocco|MC:Monaco|MD:Moldova|' +
  'ME:Montenegro|MG:Madagascar|MK:North Macedonia|ML:Mali|MM:Myanmar|MN:Mongolia|MR:Mauritania|' +
  'MT:Malta|MU:Mauritius|MV:Maldives|MW:Malawi|MX:Mexico|MY:Malaysia|MZ:Mozambique|NA:Namibia|' +
  'NE:Niger|NG:Nigeria|NI:Nicaragua|NL:Netherlands|NO:Norway|NP:Nepal|NZ:New Zealand|OM:Oman|' +
  'PA:Panama|PE:Peru|PG:Papua New Guinea|PH:Philippines|PK:Pakistan|PL:Poland|PS:Palestine|' +
  'PT:Portugal|PY:Paraguay|QA:Qatar|RO:Romania|RS:Serbia|RU:Russia|RW:Rwanda|SA:Saudi Arabia|' +
  'SC:Seychelles|SD:Sudan|SE:Sweden|SG:Singapore|SI:Slovenia|SK:Slovakia|SL:Sierra Leone|' +
  'SN:Senegal|SO:Somalia|SR:Suriname|SS:South Sudan|SV:El Salvador|SY:Syria|SZ:Eswatini|TD:Chad|' +
  'TG:Togo|TH:Thailand|TJ:Tajikistan|TM:Turkmenistan|TN:Tunisia|TR:Turkiye|TT:Trinidad and Tobago|' +
  'TW:Taiwan|TZ:Tanzania|UA:Ukraine|UG:Uganda|US:United States|UY:Uruguay|UZ:Uzbekistan|' +
  'VE:Venezuela|VN:Vietnam|YE:Yemen|ZA:South Africa|ZM:Zambia|ZW:Zimbabwe';

export const COUNTRIES = COUNTRY_DATA.split('|').map((entry) => {
  const [code, name] = entry.split(':');
  return { code, name };
});

const COUNTRY_NAMES = new Map(COUNTRIES.map((c) => [c.code, c.name]));

export const countryName = (code) => COUNTRY_NAMES.get(String(code || '').toUpperCase()) || '';

/** True once the federation has set zones up; until then the flat fee applies. */
export function zonesConfigured() {
  return db.prepare('SELECT COUNT(*) AS n FROM shipping_zones WHERE active = 1').get().n > 0;
}

export function listZones({ includeInactive = false } = {}) {
  const zones = db
    .prepare(
      includeInactive
        ? 'SELECT * FROM shipping_zones ORDER BY sort_order, id'
        : 'SELECT * FROM shipping_zones WHERE active = 1 ORDER BY sort_order, id'
    )
    .all();

  const countries = db.prepare('SELECT zone_id, country_code FROM shipping_zone_countries').all();

  return zones.map((z) => ({
    ...z,
    countries: countries.filter((c) => c.zone_id === z.id).map((c) => c.country_code),
  }));
}

export function findZone(id) {
  return db.prepare('SELECT * FROM shipping_zones WHERE id = ?').get(Number(id)) || null;
}

export function defaultZone() {
  return (
    db.prepare('SELECT * FROM shipping_zones WHERE is_default = 1 AND active = 1 LIMIT 1').get() ||
    db.prepare('SELECT * FROM shipping_zones WHERE active = 1 ORDER BY sort_order, id LIMIT 1').get() ||
    null
  );
}

const CODE_BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));

/**
 * Accept either an ISO code or a country name.
 *
 * The checkout form used to collect country as free text, and older orders still
 * hold values like "Canada". Resolving both means switching the form to a select
 * does not strand data already in the database, and a stray name never silently
 * lands in the most expensive zone.
 */
export function resolveCountryCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const upper = raw.toUpperCase();
  if (upper.length === 2 && COUNTRY_NAMES.has(upper)) return upper;

  return CODE_BY_NAME.get(raw.toLowerCase()) || '';
}

/**
 * Which zone a destination falls in.
 *
 * An unknown or unmapped country deliberately resolves to the default zone
 * rather than to nothing - see rule 2 at the top of this file.
 */
export function zoneForCountry(countryCode) {
  /* Two different unknowns, deliberately handled differently:

       - NO country yet (the cart page, before an address is entered) assumes
         the shipping origin, so a Canadian visitor sees Canadian rates and the
         Canadian free-shipping threshold rather than the worst-case zone.
       - A country we have NOT mapped falls to the default zone, which is the
         expensive catch-all. That one must never be cheap.

     Collapsing these into one rule is what broke the cart's free-shipping
     threshold the first time round. Branch on whether a country was SUPPLIED,
     not on whether it resolved: resolveCountryCode returns '' for both an
     empty field and an unrecognised code, so testing its result alone sends
     every unmapped destination to the origin zone and its cheap rate. */
  const supplied = String(countryCode || '').trim();
  const resolved = resolveCountryCode(supplied);
  if (supplied && !resolved) return defaultZone();

  const code = resolved || config.shippingOriginCountry;
  if (!code) return defaultZone();

  const row = db
    .prepare(
      `SELECT z.* FROM shipping_zones z
         JOIN shipping_zone_countries c ON c.zone_id = z.id
        WHERE c.country_code = ? AND z.active = 1
        ORDER BY z.sort_order, z.id LIMIT 1`
    )
    .get(code);

  return row || defaultZone();
}

/**
 * The shipping charge for a cart going to a zone.
 *
 * Returns the figure AND the estimate, because the document requires the
 * customer to see both before paying.
 */
export function quoteShipping({ countryCode, afterDiscountCents, itemCount }) {
  const items = Number(itemCount) || 0;
  const after = Number(afterDiscountCents) || 0;

  if (items === 0) {
    return { cents: 0, zoneId: null, zoneName: '', minDays: null, maxDays: null, freeOverCents: 0 };
  }

  /* No zones set up yet: behave exactly as the shop did before, so configuring
     zones is never a precondition for taking an order. */
  if (!zonesConfigured()) {
    const free = after >= config.freeShippingThresholdCents;
    return {
      cents: free ? 0 : config.shippingFlatCents,
      zoneId: null,
      zoneName: '',
      minDays: 14,
      maxDays: 21,
      freeOverCents: config.freeShippingThresholdCents,
      usingFlatFallback: true,
    };
  }

  const zone = zoneForCountry(countryCode);
  if (!zone) {
    // Zones exist but none is usable. Charge the flat fee rather than nothing.
    return {
      cents: config.shippingFlatCents,
      zoneId: null,
      zoneName: '',
      minDays: 14,
      maxDays: 21,
      freeOverCents: 0,
      usingFlatFallback: true,
    };
  }

  const qualifiesFree = zone.free_over_cents > 0 && after >= zone.free_over_cents;
  const cents = qualifiesFree ? 0 : zone.flat_cents + zone.per_item_cents * items;

  return {
    cents,
    zoneId: zone.id,
    zoneName: zone.name,
    minDays: zone.delivery_min_days,
    maxDays: zone.delivery_max_days,
    freeOverCents: zone.free_over_cents,
  };
}

/* ==========================================================================
   Seed
   --------------------------------------------------------------------------
   PLACEHOLDER RATES. The requirements list the shipping origin, the zones and
   the real prices as "to be provided later", so these are starting values the
   federation is expected to replace in the admin, not quotes from a carrier.
   The structure is what matters here; the numbers are meant to be edited.
   ========================================================================== */
const SEED_ZONES = [
  {
    name: 'Canada',
    flat: 1500, perItem: 0, freeOver: 20000, min: 7, max: 14, isDefault: 0,
    countries: ['CA'],
  },
  {
    name: 'United States',
    flat: 2500, perItem: 200, freeOver: 0, min: 10, max: 18, isDefault: 0,
    countries: ['US'],
  },
  {
    name: 'Europe',
    flat: 4000, perItem: 300, freeOver: 0, min: 14, max: 28, isDefault: 0,
    countries: [
      'AT','BE','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR','HR','HU','IE','IS',
      'IT','LI','LT','LU','LV','MC','MT','NL','NO','PL','PT','RO','RS','SE','SI','SK','UA',
    ],
  },
  {
    name: 'Middle East',
    flat: 4500, perItem: 300, freeOver: 0, min: 14, max: 28, isDefault: 0,
    countries: ['LB', 'AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'IQ', 'EG', 'TR'],
  },
  {
    name: 'Australia and New Zealand',
    flat: 5000, perItem: 400, freeOver: 0, min: 14, max: 28, isDefault: 0,
    countries: ['AU', 'NZ'],
  },
  {
    name: 'Rest of the world',
    flat: 5500, perItem: 400, freeOver: 0, min: 14, max: 35, isDefault: 1,
    countries: [],
  },
];

export function seedShippingZones() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM shipping_zones').get().n;
  if (count > 0) return false;

  const insertZone = db.prepare(
    `INSERT INTO shipping_zones
       (name, flat_cents, per_item_cents, free_over_cents, delivery_min_days, delivery_max_days, is_default, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertCountry = db.prepare(
    'INSERT OR IGNORE INTO shipping_zone_countries (zone_id, country_code) VALUES (?, ?)'
  );

  SEED_ZONES.forEach((z, i) => {
    const info = insertZone.run(z.name, z.flat, z.perItem, z.freeOver, z.min, z.max, z.isDefault, i);
    const zoneId = Number(info.lastInsertRowid);
    for (const code of z.countries) insertCountry.run(zoneId, code);
  });

  return SEED_ZONES.length;
}
