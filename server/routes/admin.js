import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';
import { serialiseOrder } from '../lib/orders.js';
import { generateInvoicePdf } from '../lib/invoice.js';
import { hashPassword, validatePassword } from '../lib/password.js';
import { listContent, setContent, resetContent, syncAllPages } from '../lib/content.js';
import { serialiseDonation } from '../lib/donations.js';
import { listPosts, findPost, serialisePost, uniqueSlug as uniqueNewsSlug } from '../lib/news.js';
import { saveImageBuffer, deleteUpload, UploadError, MAX_UPLOAD_BYTES } from '../lib/uploads.js';
import {
  listThreads,
  findThread,
  messagesSince,
  addMessage,
  setThreadStatus,
  markRead,
  serialiseMessage,
} from '../lib/chat.js';
import {
  listRegistrations,
  findRegistration,
  serialiseRegistration,
  markRegistrationPaid,
  registrationsCsv,
} from '../lib/registrations.js';
import { listRoster, findPlayer, serialisePlayer, POSITIONS } from '../lib/roster.js';
import { raw } from 'express';

export const adminRouter = Router();

// Every route below this line requires an admin account.
adminRouter.use(requireAdmin);

const PAID_STATUSES = "('paid', 'fulfilled')";

function slugify(value, fallback = 'product') {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function uniqueSlug(base, table, excludeId = null) {
  let slug = base;
  let n = 2;
  for (;;) {
    const row = excludeId
      ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).get(slug, excludeId)
      : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug);
    if (!row) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/* ==========================================================================
   Dashboard
   ========================================================================== */
adminRouter.get('/stats', (req, res) => {
  const revenue = db
    .prepare(`SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders WHERE status IN ${PAID_STATUSES}`)
    .get().total;

  const paidCount = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE status IN ${PAID_STATUSES}`)
    .get().n;

  const pendingCount = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").get().n;
  const customerCount = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n;
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get().n;

  const revenue30 = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) AS total FROM orders
       WHERE status IN ${PAID_STATUSES} AND paid_at >= datetime('now', '-30 days')`
    )
    .get().total;

  const series = db
    .prepare(
      `SELECT date(paid_at) AS day, SUM(total_cents) AS total, COUNT(*) AS orders
       FROM orders
       WHERE status IN ${PAID_STATUSES} AND paid_at >= datetime('now', '-30 days')
       GROUP BY date(paid_at)
       ORDER BY day`
    )
    .all();

  const recentOrders = db
    .prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8')
    .all()
    .map((row) => serialiseOrder(row, { includeItems: false }));

  const lowStock = db
    .prepare('SELECT id, name, slug, stock FROM products WHERE active = 1 AND stock <= 10 ORDER BY stock ASC LIMIT 8')
    .all();

  const topProducts = db
    .prepare(
      `SELECT oi.name_snapshot AS name,
              SUM(oi.quantity) AS units,
              SUM(oi.line_total_cents) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN ${PAID_STATUSES}
       GROUP BY oi.name_snapshot
       ORDER BY revenue DESC
       LIMIT 6`
    )
    .all();

  res.json({
    currency: config.currency,
    revenueCents: revenue,
    revenue30Cents: revenue30,
    paidCount,
    pendingCount,
    customerCount,
    productCount,
    averageOrderCents: paidCount ? Math.round(revenue / paidCount) : 0,
    series,
    recentOrders,
    lowStock,
    topProducts,
  });
});

/* ==========================================================================
   Products
   ========================================================================== */
adminRouter.get('/products', (req, res) => {
  const search = String(req.query.search || '').trim();
  const where = search ? 'WHERE p.name LIKE ?' : '';
  const params = search ? [`%${search}%`] : [];

  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.sort_order, p.id`
    )
    .all(...params);

  const variantsFor = db.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id'
  );

  res.json({
    currency: config.currency,
    products: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      imageUrl: row.image_url,
      stock: row.stock,
      active: Boolean(row.active),
      featured: Boolean(row.featured),
      badge: row.badge,
      sortOrder: row.sort_order,
      categoryId: row.category_id,
      categoryName: row.category_name,
      variants: variantsFor.all(row.id).map((v) => ({
        id: v.id,
        name: v.name,
        priceDeltaCents: v.price_delta_cents,
        stock: v.stock,
      })),
    })),
  });
});

function readProductBody(body) {
  return {
    name: String(body?.name || '').trim().slice(0, 200),
    description: String(body?.description || '').trim().slice(0, 4000),
    priceCents: Math.max(0, Math.round(Number(body?.priceCents) || 0)),
    categoryId: body?.categoryId ? Number(body.categoryId) : null,
    imageUrl: String(body?.imageUrl || '').trim().slice(0, 400),
    stock: Math.max(0, Math.round(Number(body?.stock) || 0)),
    active: body?.active ? 1 : 0,
    featured: body?.featured ? 1 : 0,
    badge: String(body?.badge || '').trim().slice(0, 40),
    sortOrder: Math.round(Number(body?.sortOrder) || 0),
  };
}

adminRouter.post('/products', (req, res) => {
  const data = readProductBody(req.body);
  if (!data.name) return res.status(400).json({ error: 'A product name is required.' });

  const slug = uniqueSlug(slugify(req.body?.slug || data.name), 'products');
  const imageUrl = data.imageUrl || `/api/placeholder/${slug}.svg`;

  const result = db
    .prepare(
      `INSERT INTO products
        (slug, name, description, price_cents, category_id, image_url, stock, active, featured, badge, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      slug,
      data.name,
      data.description,
      data.priceCents,
      data.categoryId,
      imageUrl,
      data.stock,
      data.active,
      data.featured,
      data.badge,
      data.sortOrder
    );

  res.status(201).json({ id: Number(result.lastInsertRowid), slug });
});

adminRouter.patch('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });

  const data = readProductBody({ ...existing, ...req.body, priceCents: req.body?.priceCents ?? existing.price_cents });

  const name = data.name || existing.name;
  const slug = req.body?.slug
    ? uniqueSlug(slugify(req.body.slug, existing.slug), 'products', id)
    : existing.slug;

  db.prepare(
    `UPDATE products SET
       slug = ?, name = ?, description = ?, price_cents = ?, category_id = ?,
       image_url = ?, stock = ?, active = ?, featured = ?, badge = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    slug,
    name,
    data.description,
    data.priceCents,
    data.categoryId,
    data.imageUrl || existing.image_url,
    data.stock,
    req.body?.active === undefined ? existing.active : data.active,
    req.body?.featured === undefined ? existing.featured : data.featured,
    data.badge,
    data.sortOrder,
    id
  );

  res.json({ ok: true, slug });
});

adminRouter.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const referenced = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').get(id).n;

  if (referenced > 0) {
    // Keep order history intact - retire the product instead of deleting it.
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
    return res.json({ ok: true, archived: true });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true, archived: false });
});

/* --- Variants ------------------------------------------------------------- */
adminRouter.post('/products/:id/variants', (req, res) => {
  const productId = Number(req.params.id);
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: 'A variant name is required.' });

  const result = db
    .prepare(
      'INSERT INTO product_variants (product_id, name, price_delta_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)'
    )
    .run(
      productId,
      name,
      Math.round(Number(req.body?.priceDeltaCents) || 0),
      Math.max(0, Math.round(Number(req.body?.stock) || 0)),
      Math.round(Number(req.body?.sortOrder) || 0)
    );

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.patch('/variants/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Variant not found.' });

  db.prepare(
    'UPDATE product_variants SET name = ?, price_delta_cents = ?, stock = ? WHERE id = ?'
  ).run(
    String(req.body?.name ?? existing.name).trim().slice(0, 60) || existing.name,
    Math.round(Number(req.body?.priceDeltaCents ?? existing.price_delta_cents) || 0),
    Math.max(0, Math.round(Number(req.body?.stock ?? existing.stock) || 0)),
    id
  );

  res.json({ ok: true });
});

adminRouter.delete('/variants/:id', (req, res) => {
  db.prepare('DELETE FROM product_variants WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ==========================================================================
   Categories
   ========================================================================== */
adminRouter.get('/categories', (req, res) => {
  res.json({
    categories: db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all(),
  });
});

adminRouter.post('/categories', (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!name) return res.status(400).json({ error: 'A category name is required.' });

  const slug = uniqueSlug(slugify(name, 'category'), 'categories');
  const result = db
    .prepare('INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)')
    .run(slug, name, Math.round(Number(req.body?.sortOrder) || 0));

  res.status(201).json({ id: Number(result.lastInsertRowid), slug });
});

adminRouter.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ==========================================================================
   Orders
   ========================================================================== */
adminRouter.get('/orders', (req, res) => {
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  const where = [];
  const params = [];

  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (search) {
    where.push('(order_number LIKE ? OR email LIKE ? OR ship_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db
    .prepare(`SELECT * FROM orders ${whereSql} ORDER BY id DESC LIMIT 200`)
    .all(...params);

  res.json({
    currency: config.currency,
    orders: rows.map((row) => serialiseOrder(row, { includeItems: false })),
  });
});

adminRouter.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order: serialiseOrder(order) });
});

adminRouter.patch('/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const allowed = ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Unknown order status.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

/* ==========================================================================
   Customers
   ========================================================================== */
adminRouter.get('/customers', (req, res) => {
  const search = String(req.query.search || '').trim();
  const where = search ? 'WHERE u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.created_at,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status IN ${PAID_STATUSES}) AS order_count,
              (SELECT COALESCE(SUM(o.total_cents), 0) FROM orders o WHERE o.user_id = u.id AND o.status IN ${PAID_STATUSES}) AS spend_cents
       FROM users u
       ${where}
       ORDER BY u.id DESC
       LIMIT 200`
    )
    .all(...params);

  res.json({
    currency: config.currency,
    customers: rows.map((row) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      role: row.role,
      createdAt: row.created_at,
      orderCount: row.order_count,
      spendCents: row.spend_cents,
    })),
  });
});

adminRouter.get('/customers/:id', (req, res) => {
  const user = db
    .prepare('SELECT id, email, first_name, last_name, phone, role, created_at FROM users WHERE id = ?')
    .get(Number(req.params.id));

  if (!user) return res.status(404).json({ error: 'Customer not found.' });

  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(user.id)
    .map((row) => serialiseOrder(row, { includeItems: false }));

  res.json({ customer: user, orders });
});

adminRouter.patch('/customers/:id/role', (req, res) => {
  const id = Number(req.params.id);
  const role = req.body?.role === 'admin' ? 'admin' : 'customer';

  if (id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin access.' });
  }

  const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
  const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id);

  if (!target) return res.status(404).json({ error: 'Customer not found.' });
  if (target.role === 'admin' && role === 'customer' && admins <= 1) {
    return res.status(400).json({ error: 'At least one admin account must remain.' });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);

  // Dropping someone to customer should end their existing admin sessions.
  if (role === 'customer') {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
  }

  res.json({ ok: true, role });
});

adminRouter.post('/customers', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'That email already has an account.' });
  }

  const result = db
    .prepare('INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)')
    .run(
      email,
      hashPassword(password),
      String(req.body?.firstName || '').trim().slice(0, 80),
      String(req.body?.lastName || '').trim().slice(0, 80),
      req.body?.role === 'admin' ? 'admin' : 'customer'
    );

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

/* ==========================================================================
   Invoices
   ========================================================================== */
adminRouter.get('/invoices', (req, res) => {
  const rows = db
    .prepare(
      `SELECT i.id, i.invoice_number, i.issued_at,
              o.id AS order_id, o.order_number, o.email, o.total_cents, o.currency, o.status
       FROM invoices i JOIN orders o ON o.id = i.order_id
       ORDER BY i.id DESC LIMIT 200`
    )
    .all();

  res.json({
    currency: config.currency,
    invoices: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      issuedAt: row.issued_at,
      orderId: row.order_id,
      orderNumber: row.order_number,
      email: row.email,
      totalCents: row.total_cents,
      currency: row.currency,
      status: row.status,
    })),
  });
});

adminRouter.post('/invoices/:orderId/regenerate', async (req, res) => {
  const orderId = Number(req.params.orderId);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  try {
    await generateInvoicePdf(orderId, { force: true });
    res.json({ ok: true });
  } catch (error) {
    console.error('[invoice] regenerate failed:', error.message);
    res.status(500).json({ error: 'Could not regenerate the invoice.' });
  }
});

/* ==========================================================================
   Discounts
   ========================================================================== */
adminRouter.get('/discounts', (req, res) => {
  res.json({
    currency: config.currency,
    discounts: db
      .prepare('SELECT * FROM discounts ORDER BY id DESC')
      .all()
      .map((row) => ({
        id: row.id,
        code: row.code,
        type: row.type,
        value: row.value,
        minSubtotalCents: row.min_subtotal_cents,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        maxRedemptions: row.max_redemptions,
        timesRedeemed: row.times_redeemed,
        active: Boolean(row.active),
        createdAt: row.created_at,
      })),
  });
});

function readDiscountBody(body) {
  const type = body?.type === 'fixed' ? 'fixed' : 'percent';
  let value = Math.round(Number(body?.value) || 0);
  if (type === 'percent') value = Math.min(Math.max(value, 1), 100);
  else value = Math.max(value, 1);

  return {
    type,
    value,
    minSubtotalCents: Math.max(0, Math.round(Number(body?.minSubtotalCents) || 0)),
    startsAt: body?.startsAt ? String(body.startsAt).slice(0, 19).replace('T', ' ') : null,
    endsAt: body?.endsAt ? String(body.endsAt).slice(0, 19).replace('T', ' ') : null,
    maxRedemptions: Math.max(0, Math.round(Number(body?.maxRedemptions) || 0)),
    active: body?.active === false ? 0 : 1,
  };
}

adminRouter.post('/discounts', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase().slice(0, 40);
  if (!code) return res.status(400).json({ error: 'A discount code is required.' });

  if (db.prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE').get(code)) {
    return res.status(409).json({ error: 'That code already exists.' });
  }

  const data = readDiscountBody(req.body);

  const result = db
    .prepare(
      `INSERT INTO discounts
        (code, type, value, min_subtotal_cents, starts_at, ends_at, max_redemptions, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      code,
      data.type,
      data.value,
      data.minSubtotalCents,
      data.startsAt,
      data.endsAt,
      data.maxRedemptions,
      data.active
    );

  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.patch('/discounts/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM discounts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Discount not found.' });

  const data = readDiscountBody({
    type: req.body?.type ?? existing.type,
    value: req.body?.value ?? existing.value,
    minSubtotalCents: req.body?.minSubtotalCents ?? existing.min_subtotal_cents,
    startsAt: req.body?.startsAt ?? existing.starts_at,
    endsAt: req.body?.endsAt ?? existing.ends_at,
    maxRedemptions: req.body?.maxRedemptions ?? existing.max_redemptions,
    active: req.body?.active ?? Boolean(existing.active),
  });

  db.prepare(
    `UPDATE discounts SET type = ?, value = ?, min_subtotal_cents = ?,
       starts_at = ?, ends_at = ?, max_redemptions = ?, active = ?
     WHERE id = ?`
  ).run(
    data.type,
    data.value,
    data.minSubtotalCents,
    data.startsAt,
    data.endsAt,
    data.maxRedemptions,
    data.active,
    id
  );

  res.json({ ok: true });
});

adminRouter.delete('/discounts/:id', (req, res) => {
  db.prepare('DELETE FROM discounts WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ==========================================================================
   Contact messages
   ========================================================================== */
adminRouter.get('/messages', (req, res) => {
  res.json({
    messages: db.prepare('SELECT * FROM contact_messages ORDER BY id DESC LIMIT 200').all(),
  });
});

/* ==========================================================================
   Image uploads
   --------------------------------------------------------------------------
   Raw bytes, not base64 in JSON: express.json() does not match
   application/octet-stream, so the global 256kb body limit never applies here
   and this route gets its own without loosening the one that protects every
   other endpoint. All validation is in lib/uploads.js.
   ========================================================================== */
adminRouter.post('/uploads', raw({ type: 'application/octet-stream', limit: MAX_UPLOAD_BYTES + 1024 }), (req, res) => {
  try {
    const result = saveImageBuffer(req.body);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof UploadError) return res.status(400).json({ error: error.message });
    console.error('[upload]', error.message);
    res.status(500).json({ error: 'That image could not be saved.' });
  }
});

/* ==========================================================================
   News posts
   ========================================================================== */
adminRouter.get('/news', (req, res) => {
  res.json({ posts: listPosts({ includeInactive: true }).map(serialisePost) });
});

function readPostBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined
      ? fallback ?? ''
      : String(body[key]).trim().slice(0, max);

  return {
    title: str('title', existing.title, 200),
    category: str('category', existing.category, 60),
    excerpt: str('excerpt', existing.excerpt, 400),
    body: str('body', existing.body, 20000),
    imageUrl: str('imageUrl', existing.image_url, 400),
    imageAlt: str('imageAlt', existing.image_alt, 300),
    author: str('author', existing.author, 120),
    contactEmail: str('contactEmail', existing.contact_email, 200),
    contactPhone: str('contactPhone', existing.contact_phone, 60),
    shareFacebook: str('shareFacebook', existing.share_facebook, 400),
    shareInstagram: str('shareInstagram', existing.share_instagram, 400),
    shareX: str('shareX', existing.share_x, 400),
    publishedAt: str('publishedAt', existing.published_at, 40),
    active: body.active === undefined ? (existing.active ?? 1) : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminRouter.post('/news', (req, res) => {
  const v = readPostBody(req.body || {});
  if (!v.title) return res.status(400).json({ error: 'Give the post a title.' });

  const slug = uniqueNewsSlug(req.body?.slug || v.title);
  const info = db
    .prepare(
      `INSERT INTO news_posts
         (slug, title, category, excerpt, body, image_url, image_alt, author,
          contact_email, contact_phone, share_facebook, share_instagram, share_x,
          published_at, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now')), ?, ?)`
    )
    .run(
      slug, v.title, v.category, v.excerpt, v.body, v.imageUrl, v.imageAlt, v.author,
      v.contactEmail, v.contactPhone, v.shareFacebook, v.shareInstagram, v.shareX,
      v.publishedAt, v.active, v.sortOrder
    );

  res.status(201).json({ id: Number(info.lastInsertRowid), slug });
});

adminRouter.patch('/news/:id', (req, res) => {
  const existing = findPost(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found.' });

  const v = readPostBody(req.body || {}, existing);
  const slug = req.body?.slug ? uniqueNewsSlug(req.body.slug, existing.id) : existing.slug;

  db.prepare(
    `UPDATE news_posts
        SET slug = ?, title = ?, category = ?, excerpt = ?, body = ?, image_url = ?,
            image_alt = ?, author = ?, contact_email = ?, contact_phone = ?,
            share_facebook = ?, share_instagram = ?, share_x = ?, published_at = ?,
            active = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    slug, v.title, v.category, v.excerpt, v.body, v.imageUrl, v.imageAlt, v.author,
    v.contactEmail, v.contactPhone, v.shareFacebook, v.shareInstagram, v.shareX,
    v.publishedAt || existing.published_at, v.active, v.sortOrder, existing.id
  );

  res.json({ ok: true, slug });
});

adminRouter.delete('/news/:id', (req, res) => {
  const existing = findPost(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Post not found.' });

  db.prepare('DELETE FROM news_posts WHERE id = ?').run(existing.id);
  // Take the image with it, so deleting posts does not silently fill the disk.
  if (existing.image_url) deleteUpload(existing.image_url);

  res.json({ ok: true });
});

/* ==========================================================================
   Roster
   ========================================================================== */
adminRouter.get('/roster', (req, res) => {
  const program = req.query.program === 'mens' ? 'mens' : 'womens';
  res.json({ program, players: listRoster(program, { includeInactive: true }).map(serialisePlayer) });
});

function readPlayerBody(body, existing = {}) {
  const str = (key, fallback, max) =>
    body[key] === undefined ? fallback ?? '' : String(body[key]).trim().slice(0, max);

  const number =
    body.number === undefined || body.number === '' || body.number === null
      ? existing.jersey_number ?? null
      : Number(body.number);

  return {
    program: body.program === 'mens' ? 'mens' : body.program === 'womens' ? 'womens' : existing.program || 'womens',
    team: body.team === 'next_gen' ? 'next_gen' : body.team === 'national' ? 'national' : existing.team || 'national',
    position: POSITIONS.includes(body.position) ? body.position : existing.position || 'forward',
    number: Number.isFinite(number) ? number : null,
    name: str('name', existing.name, 160),
    recentTeam: str('recentTeam', existing.recent_team, 200),
    resides: str('resides', existing.resides, 120),
    hometown: str('hometown', existing.hometown, 120),
    active: body.active === undefined ? (existing.active ?? 1) : body.active ? 1 : 0,
    sortOrder: Number(body.sortOrder ?? existing.sort_order ?? 0) || 0,
  };
}

adminRouter.post('/roster', (req, res) => {
  const v = readPlayerBody(req.body || {});
  if (!v.name) return res.status(400).json({ error: "Enter the player's name." });

  const info = db
    .prepare(
      `INSERT INTO roster_players
         (program, team, position, jersey_number, name, recent_team, resides, hometown, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(v.program, v.team, v.position, v.number, v.name, v.recentTeam, v.resides, v.hometown, v.active, v.sortOrder);

  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminRouter.patch('/roster/:id', (req, res) => {
  const existing = findPlayer(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found.' });

  const v = readPlayerBody(req.body || {}, existing);
  db.prepare(
    `UPDATE roster_players
        SET program = ?, team = ?, position = ?, jersey_number = ?, name = ?,
            recent_team = ?, resides = ?, hometown = ?, active = ?, sort_order = ?
      WHERE id = ?`
  ).run(
    v.program, v.team, v.position, v.number, v.name,
    v.recentTeam, v.resides, v.hometown, v.active, v.sortOrder, existing.id
  );

  res.json({ ok: true });
});

/* Hiding a player (active = 0) is how a removal request from a parent or
   guardian is honoured without losing the federation's own record. */
adminRouter.delete('/roster/:id', (req, res) => {
  const existing = findPlayer(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Player not found.' });
  db.prepare('DELETE FROM roster_players WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

/* ==========================================================================
   Membership registrations
   ========================================================================== */
adminRouter.get('/registrations', (req, res) => {
  const registrations = listRegistrations();
  res.json({
    registrations,
    currency: config.currency,
    totals: {
      count: registrations.length,
      paid: registrations.filter((r) => r.paymentStatus === 'paid').length,
      unpaid: registrations.filter((r) => r.paymentStatus !== 'paid').length,
      collectedCents: registrations
        .filter((r) => r.paymentStatus === 'paid')
        .reduce((n, r) => n + r.amountCents, 0),
    },
  });
});

/* The federation's own copy of its records. Not linked from the public site and
   behind requireAdmin like everything else here. */
adminRouter.get('/registrations.csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="lihf-registrations.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.send(registrationsCsv());
});

/* Marked by hand when a fee arrives by e-transfer, which is how most will be
   paid until Stripe is switched on. */
adminRouter.patch('/registrations/:id/paid', (req, res) => {
  const updated = markRegistrationPaid(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Registration not found.' });
  res.json({ ok: true, registration: serialiseRegistration(updated) });
});

/* ==========================================================================
   Chat
   ========================================================================== */
adminRouter.get('/chat', (req, res) => {
  const threads = listThreads();
  res.json({
    threads,
    unread: threads.reduce((n, t) => n + t.unread, 0),
  });
});

adminRouter.get('/chat/:id', (req, res) => {
  const thread = findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });

  const messages = messagesSince(thread.id, 0).map(serialiseMessage);
  // Opening a thread in the admin marks the visitor's messages as seen.
  markRead(thread.id, 'visitor');

  res.json({
    thread: {
      id: thread.id,
      name: thread.visitor_name,
      email: thread.visitor_email,
      status: thread.status,
      createdAt: thread.created_at,
    },
    messages,
  });
});

adminRouter.post('/chat/:id', (req, res) => {
  const thread = findThread(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Conversation not found.' });

  const message = addMessage(thread.id, 'admin', req.body?.body);
  if (!message) return res.status(400).json({ error: 'Write a reply first.' });

  /* The visitor sees this on their next poll. There is deliberately no email to
     them: most are anonymous, and promising a mail we cannot send would be
     worse than the widget they are already using. */
  res.json({ message: serialiseMessage(message) });
});

adminRouter.patch('/chat/:id', (req, res) => {
  const updated = setThreadStatus(req.params.id, String(req.body?.status || ''));
  if (!updated) return res.status(400).json({ error: 'Unknown status.' });
  res.json({ ok: true, status: updated.status });
});

/* ==========================================================================
   Donations
   ========================================================================== */
adminRouter.get('/donations', (req, res) => {
  const donations = db
    .prepare('SELECT * FROM donations ORDER BY id DESC LIMIT 200')
    .all()
    .map((d) => serialiseDonation(d, { includePayments: d.kind === 'monthly' }));

  /* Money actually received. A one-time gift is fully described by its own row;
     a monthly gift is described by its charges, because the donation row holds
     the per-cycle amount, not the lifetime total. Summing both would double
     count the first month. */
  const oneTime = db
    .prepare("SELECT COALESCE(SUM(total_cents), 0) AS n FROM donations WHERE kind = 'one_time' AND status = 'paid'")
    .get().n;
  const recurring = db
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM donation_payments WHERE status = 'paid'")
    .get().n;
  const activeMonthly = db
    .prepare("SELECT COUNT(*) AS n FROM donations WHERE kind = 'monthly' AND status = 'active'")
    .get().n;
  const monthlyValue = db
    .prepare("SELECT COALESCE(SUM(total_cents), 0) AS n FROM donations WHERE kind = 'monthly' AND status = 'active'")
    .get().n;

  res.json({
    donations,
    currency: config.currency,
    totals: {
      receivedCents: oneTime + recurring,
      oneTimeCents: oneTime,
      recurringCents: recurring,
      activeMonthly,
      monthlyValueCents: monthlyValue,
    },
  });
});

/* ==========================================================================
   Page copy - every heading, paragraph and list item on the public site
   ========================================================================== */
adminRouter.get('/content', (req, res) => {
  const blocks = listContent();

  /* Grouped by page so the editor reads like the site rather than like a table. */
  const pages = [];
  const index = new Map();
  for (const b of blocks) {
    if (!index.has(b.page)) {
      const group = { page: b.page, blocks: [], edited: 0, orphaned: 0 };
      index.set(b.page, group);
      pages.push(group);
    }
    const group = index.get(b.page);
    group.blocks.push(b);
    if (b.value !== null && b.value !== '') group.edited += 1;
    if (b.orphaned) group.orphaned += 1;
  }

  res.json({
    pages,
    totals: {
      blocks: blocks.length,
      edited: blocks.filter((b) => b.value !== null && b.value !== '').length,
      orphaned: blocks.filter((b) => b.orphaned).length,
    },
  });
});

adminRouter.patch('/content/:key', (req, res) => {
  const value = req.body?.value;
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'Send the replacement text as a string.' });
  }
  if (value.length > 20000) {
    return res.status(400).json({ error: 'That is longer than a page block should be (20,000 characters).' });
  }

  const result = setContent(req.params.key, value.trim() === '' ? null : value);
  if (result.error) return res.status(404).json({ error: result.error });
  res.json(result);
});

/* Drop the edit and go back to whatever the page's own markup says. */
adminRouter.post('/content/:key/reset', (req, res) => {
  res.json(resetContent(req.params.key));
});

/* Re-read the pages from disk. Needed after `npm run build` or a hand edit,
   so the editor can be brought in step without restarting the server. */
adminRouter.post('/content/resync', (req, res) => {
  res.json(syncAllPages());
});
