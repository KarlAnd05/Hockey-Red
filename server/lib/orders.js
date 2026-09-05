import { db } from '../db.js';
import { config } from '../config.js';
import { getCartDetail } from './cart.js';
import { generateInvoicePdf } from './invoice.js';

function nextOrderNumber() {
  const year = new Date().getFullYear();
  const n = db
    .prepare('SELECT COUNT(*) AS n FROM orders WHERE order_number LIKE ?')
    .get(`LH-${year}-%`).n;
  return `LH-${year}-${String(n + 1).padStart(5, '0')}`;
}

/**
 * Create a pending order from the cart.
 *
 * Totals come from getCartDetail, which reads prices out of the products table.
 * Nothing the client sent is trusted for pricing.
 */
export function createPendingOrder({ cartId, userId, email, shipping = {}, discountCode = '' }) {
  const detail = getCartDetail(cartId, discountCode);

  if (!detail.items.length) {
    return { error: 'Your cart is empty.' };
  }

  const outOfStock = detail.items.filter((item) => !item.inStock);
  if (outOfStock.length) {
    return {
      error: `Not enough stock for ${outOfStock.map((i) => i.name).join(', ')}.`,
    };
  }

  const orderNumber = nextOrderNumber();

  const result = db
    .prepare(
      `INSERT INTO orders
        (order_number, user_id, email, status, subtotal_cents, discount_cents, shipping_cents,
         tax_cents, total_cents, currency, discount_code,
         ship_name, ship_line1, ship_line2, ship_city, ship_region, ship_postal, ship_country)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      orderNumber,
      userId ?? null,
      email,
      detail.subtotalCents,
      detail.discountCents,
      detail.shippingCents,
      detail.taxCents,
      detail.totalCents,
      detail.currency,
      detail.discountCode || '',
      String(shipping.name || '').slice(0, 160),
      String(shipping.line1 || '').slice(0, 200),
      String(shipping.line2 || '').slice(0, 200),
      String(shipping.city || '').slice(0, 120),
      String(shipping.region || '').slice(0, 120),
      String(shipping.postal || '').slice(0, 40),
      String(shipping.country || '').slice(0, 120)
    );

  const orderId = Number(result.lastInsertRowid);

  const insertItem = db.prepare(
    `INSERT INTO order_items
      (order_id, product_id, variant_id, name_snapshot, variant_snapshot,
       unit_price_cents, quantity, line_total_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  detail.items.forEach((item) => {
    insertItem.run(
      orderId,
      item.productId,
      item.variantId,
      item.name,
      item.variantName,
      item.unitPriceCents,
      item.quantity,
      item.lineTotalCents
    );
  });

  return { orderId, orderNumber, detail };
}

/**
 * Transition an order to paid exactly once: decrement stock, count the discount
 * redemption, empty the cart, and cut the invoice.
 */
export async function markOrderPaid(orderId, { paymentIntentId = null, cartId = null } = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  // Idempotent: Stripe can deliver the same webhook more than once.
  if (order.status !== 'pending') return order;

  db.prepare(
    "UPDATE orders SET status = 'paid', paid_at = datetime('now'), stripe_payment_intent = ? WHERE id = ?"
  ).run(paymentIntentId, orderId);

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  items.forEach((item) => {
    if (item.product_id) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(
        item.quantity,
        item.product_id
      );
    }
    if (item.variant_id) {
      db.prepare('UPDATE product_variants SET stock = MAX(0, stock - ?) WHERE id = ?').run(
        item.quantity,
        item.variant_id
      );
    }
  });

  if (order.discount_code) {
    db.prepare(
      'UPDATE discounts SET times_redeemed = times_redeemed + 1 WHERE code = ? COLLATE NOCASE'
    ).run(order.discount_code);
  }

  if (cartId) {
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
  } else if (order.user_id) {
    const cart = db
      .prepare('SELECT id FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1')
      .get(order.user_id);
    if (cart) db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  }

  try {
    await generateInvoicePdf(orderId);
  } catch (error) {
    console.error(`[invoice] failed for order ${orderId}:`, error.message);
  }

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

export function serialiseOrder(order, { includeItems = true } = {}) {
  if (!order) return null;

  const items = includeItems
    ? db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(order.id)
    : [];

  const invoice = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(order.id);

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    email: order.email,
    subtotalCents: order.subtotal_cents,
    discountCents: order.discount_cents,
    discountCode: order.discount_code,
    shippingCents: order.shipping_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    currency: order.currency || config.currency,
    createdAt: order.created_at,
    paidAt: order.paid_at,
    shipping: {
      name: order.ship_name,
      line1: order.ship_line1,
      line2: order.ship_line2,
      city: order.ship_city,
      region: order.ship_region,
      postal: order.ship_postal,
      country: order.ship_country,
    },
    invoiceNumber: invoice?.invoice_number || null,
    items: items.map((item) => ({
      id: item.id,
      name: item.name_snapshot,
      variant: item.variant_snapshot,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
    })),
  };
}
