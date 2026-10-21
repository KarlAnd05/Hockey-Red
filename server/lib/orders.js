import { db } from '../db.js';
import { config } from '../config.js';
import { getCartDetail } from './cart.js';
import { generateInvoicePdf } from './invoice.js';
import { sendOrderEmails } from './notifications.js';

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
export function createPendingOrder({
  cartId,
  userId,
  email,
  shipping = {},
  discountCode = '',
  paymentMethod = 'card',
}) {
  /* Price against the DESTINATION. Without the country here the order would be
     costed in the origin zone, so a parcel to Australia would be charged
     Canadian shipping and the federation would absorb the difference. */
  const detail = getCartDetail(cartId, discountCode, shipping.country);

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
         tax_cents, total_cents, currency, discount_code, payment_method,
         ship_name, ship_line1, ship_line2, ship_city, ship_region, ship_postal, ship_country)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      paymentMethod === 'etransfer' ? 'etransfer' : 'card',
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

  /* cartId is the cart the order was actually built from, carried on the Stripe
     session's metadata by both callers. The fallback below is for an older
     order that predates that metadata: it clears the signed-in buyer's newest
     cart, which is a guess, and can empty a basket they started elsewhere.
     Prefer passing cartId. */
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

  // Two emails per order: one to the customer, one to the shop. This sits
  // after the invoice so the PDF can be attached to both. sendOrderEmails
  // never throws, and the early return above makes it fire exactly once even
  // when Stripe redelivers the webhook.
  await sendOrderEmails(orderId);

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
    paymentMethod: order.payment_method || 'card',
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
