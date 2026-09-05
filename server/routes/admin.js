import { Router } from 'express';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';
import { serialiseOrder } from '../lib/orders.js';
import { generateInvoicePdf } from '../lib/invoice.js';
import { hashPassword, validatePassword } from '../lib/password.js';

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
