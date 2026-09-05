import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';

export const catalogRouter = Router();

const SORTS = {
  featured: 'p.featured DESC, p.sort_order ASC, p.id ASC',
  'price-asc': 'p.price_cents ASC, p.name ASC',
  'price-desc': 'p.price_cents DESC, p.name ASC',
  'name-asc': 'p.name ASC',
  'name-desc': 'p.name DESC',
  newest: 'p.created_at DESC, p.id DESC',
};

function serialiseProduct(row, variants = []) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    imageUrl: row.image_url,
    stock: row.stock,
    featured: Boolean(row.featured),
    badge: row.badge,
    category: row.category_slug ? { slug: row.category_slug, name: row.category_name } : null,
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceDeltaCents: v.price_delta_cents,
      stock: v.stock,
    })),
  };
}

/* --------------------------------------------------------------------------
   Categories
   -------------------------------------------------------------------------- */
catalogRouter.get('/categories', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id, c.slug, c.name,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
       FROM categories c
       ORDER BY c.sort_order, c.name`
    )
    .all();

  res.json({
    categories: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      productCount: row.product_count,
    })),
  });
});

/* --------------------------------------------------------------------------
   Product list - search, category filter, price filter, sort, pagination
   -------------------------------------------------------------------------- */
catalogRouter.get('/products', (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 100);
  const category = String(req.query.category || '').trim();
  const sort = SORTS[String(req.query.sort || '')] || SORTS.featured;
  const inStockOnly = req.query.inStock === 'true';

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);

  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(48, Math.max(1, Number(req.query.perPage) || 24));

  const where = ['p.active = 1'];
  const params = [];

  if (search) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category && category !== 'all') {
    where.push('c.slug = ?');
    params.push(category);
  }

  if (Number.isFinite(minPrice) && minPrice > 0) {
    where.push('p.price_cents >= ?');
    params.push(Math.round(minPrice * 100));
  }

  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    where.push('p.price_cents <= ?');
    params.push(Math.round(maxPrice * 100));
  }

  if (inStockOnly) {
    where.push('p.stock > 0');
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM products p
       LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`
    )
    .get(...params).n;

  const rows = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${sort}
       LIMIT ? OFFSET ?`
    )
    .all(...params, perPage, (page - 1) * perPage);

  const variantsFor = db.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id'
  );

  const priceRange = db
    .prepare('SELECT MIN(price_cents) AS lo, MAX(price_cents) AS hi FROM products WHERE active = 1')
    .get();

  res.json({
    products: rows.map((row) => serialiseProduct(row, variantsFor.all(row.id))),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    currency: config.currency,
    priceRange: { minCents: priceRange.lo || 0, maxCents: priceRange.hi || 0 },
  });
});

/* --------------------------------------------------------------------------
   Single product
   -------------------------------------------------------------------------- */
catalogRouter.get('/products/:slug', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.active = 1`
    )
    .get(req.params.slug);

  if (!row) return res.status(404).json({ error: 'Product not found.' });

  const variants = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id')
    .all(row.id);

  // Same category first, then anything else, so a one-product category (the
  // jersey, for instance) still gets a full row of suggestions.
  const related = db
    .prepare(
      `SELECT p.*, c.slug AS category_slug, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.active = 1 AND p.id != ?
       ORDER BY (p.category_id IS NOT ?), p.featured DESC, RANDOM()
       LIMIT 4`
    )
    .all(row.id, row.category_id);

  res.json({
    product: serialiseProduct(row, variants),
    related: related.map((r) => serialiseProduct(r)),
    currency: config.currency,
  });
});

/* --------------------------------------------------------------------------
   Branded placeholder art
   --------------------------------------------------------------------------
   Stands in until real product photography is supplied. Admins can point any
   product's image at a real file instead.
   -------------------------------------------------------------------------- */
catalogRouter.get('/placeholder/:slug.svg', (req, res) => {
  const slug = String(req.params.slug || 'lihf').slice(0, 80);

  const product = db.prepare('SELECT name FROM products WHERE slug = ?').get(slug);
  const label = (product?.name || slug.replace(/-/g, ' ')).toUpperCase();

  // Deterministic tone so each product keeps a stable look between loads.
  const seed = [...slug].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const dark = ['#05070a', '#12171c', '#1a2027'][seed % 3];
  const accent = ['#c8102e', '#96001f', '#e4142f'][seed % 3];

  const words = label.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    if ((current + ' ' + word).trim().length > 16) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current.trim());

  const textRows = lines
    .slice(0, 3)
    .map(
      (line, i) =>
        `<text x="60" y="${300 + i * 42}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" ` +
        `font-size="34" font-weight="bold" letter-spacing="1">${line.replace(/[<>&]/g, '')}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="65%" stop-color="${dark}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <pattern id="mesh" width="14" height="14" patternTransform="rotate(115)" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="14" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#mesh)"/>
  <g opacity="0.14" transform="translate(500 200) scale(3.2)" fill="#ffffff">
    <polygon points="50,6 38,28 62,28"/>
    <polygon points="50,20 30,46 70,46"/>
    <polygon points="50,34 22,66 78,66"/>
    <rect x="46" y="66" width="8" height="14"/>
    <rect x="18" y="82" width="64" height="5" rx="2.5"/>
  </g>
  <rect x="60" y="60" width="54" height="5" fill="${accent}"/>
  <text x="60" y="100" fill="#ffffff" fill-opacity="0.62" font-family="Arial, Helvetica, sans-serif"
        font-size="15" font-weight="bold" letter-spacing="4">LEBANON HOCKEY</text>
  ${textRows}
  <text x="60" y="${300 + Math.min(lines.length, 3) * 42 + 22}" fill="#ffffff" fill-opacity="0.5"
        font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="3">OFFICIAL MERCHANDISE</text>
</svg>`;

  res.set('Content-Type', 'image/svg+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});
