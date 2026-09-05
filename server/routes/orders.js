import { Router } from 'express';
import { existsSync } from 'node:fs';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { serialiseOrder } from '../lib/orders.js';
import { generateInvoicePdf, invoicePath } from '../lib/invoice.js';

export const ordersRouter = Router();

/**
 * An order is readable by the customer who placed it, by an admin, or by an
 * anonymous buyer who still holds the Stripe session id from the success URL.
 */
function canAccessOrder(order, req) {
  if (!order) return false;
  if (req.user?.role === 'admin') return true;
  if (order.user_id && order.user_id === req.user?.id) return true;

  const sessionParam = String(req.query.session || '');
  if (!order.user_id && sessionParam && order.stripe_session_id === sessionParam) return true;

  return false;
}

/* --------------------------------------------------------------------------
   Order history
   -------------------------------------------------------------------------- */
ordersRouter.get('/orders', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100')
    .all(req.user.id);

  res.json({ orders: rows.map((row) => serialiseOrder(row)) });
});

/* --------------------------------------------------------------------------
   Single order
   -------------------------------------------------------------------------- */
ordersRouter.get('/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));

  if (!canAccessOrder(order, req)) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  res.json({ order: serialiseOrder(order) });
});

/* --------------------------------------------------------------------------
   Invoice PDF
   -------------------------------------------------------------------------- */
ordersRouter.get('/orders/:id/invoice', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));

  if (!canAccessOrder(order, req)) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (order.status === 'pending' || order.status === 'cancelled') {
    return res.status(409).json({ error: 'An invoice is issued once the order is paid.' });
  }

  try {
    const path = await generateInvoicePdf(order.id);
    if (!path || !existsSync(path)) {
      return res.status(500).json({ error: 'Could not produce the invoice.' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(order.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice?.invoice_number || 'invoice'}.pdf"`
    );
    res.sendFile(path);
  } catch (error) {
    console.error('[invoice] download failed:', error.message);
    res.status(500).json({ error: 'Could not produce the invoice.' });
  }
});

export { invoicePath };
