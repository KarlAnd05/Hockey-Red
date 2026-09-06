import { db } from '../db.js';
import { config } from '../config.js';
import { discountAmount, isDiscountUsable } from './money.js';

/**
 * Look up the cart for this request without creating anything.
 *
 * Read paths use this so that merely loading a page never writes a cart row or
 * forces a session cookie into existence.
 */
export function findCart(req) {
  const userId = req.user?.id ?? null;
  const sessionHash = req.sessionRecord?.token_hash ?? null;

  if (!userId && !sessionHash) return null;

  return (
    (userId
      ? db.prepare('SELECT * FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId)
      : db
          .prepare(
            'SELECT * FROM carts WHERE session_hash = ? AND user_id IS NULL ORDER BY id DESC LIMIT 1'
          )
          .get(sessionHash)) || null
  );
}

/**
 * Resolve the cart for the current request, creating one if needed.
 *
 * Carts are keyed by user id when signed in, otherwise by the session hash, so
 * a guest cart survives page loads and can be merged on login. Callers must
 * have a session already - run ensureSession() first on write paths.
 */
export function getOrCreateCart(req) {
  const userId = req.user?.id ?? null;
  const sessionHash = req.sessionRecord?.token_hash ?? null;

  if (!userId && !sessionHash) return null;

  let cart = findCart(req);

  if (!cart) {
    const result = db
      .prepare('INSERT INTO carts (user_id, session_hash) VALUES (?, ?)')
      .run(userId, userId ? null : sessionHash);
    cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(Number(result.lastInsertRowid));
  }

  return cart;
}

/**
 * Move a guest cart onto the user account at login, folding quantities together
 * where the same product/variant appears in both.
 */
export function mergeGuestCart(sessionHash, userId) {
  const guestCart = db
    .prepare('SELECT * FROM carts WHERE session_hash = ? AND user_id IS NULL ORDER BY id DESC LIMIT 1')
    .get(sessionHash);
  if (!guestCart) return;

  const userCart = db
    .prepare('SELECT * FROM carts WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .get(userId);

  if (!userCart) {
    db.prepare('UPDATE carts SET user_id = ?, session_hash = NULL WHERE id = ?').run(userId, guestCart.id);
    return;
  }

  const guestItems = db.prepare('SELECT * FROM cart_items WHERE cart_id = ?').all(guestCart.id);

  guestItems.forEach((item) => {
    const existing = db
      .prepare(
        `SELECT * FROM cart_items
         WHERE cart_id = ? AND product_id = ? AND variant_id IS ?`
      )
      .get(userCart.id, item.product_id, item.variant_id);

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(
        Math.min(existing.quantity + item.quantity, 99),
        existing.id
      );
    } else {
      db.prepare(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)'
      ).run(userCart.id, item.product_id, item.variant_id, item.quantity);
    }
  });

  db.prepare('DELETE FROM carts WHERE id = ?').run(guestCart.id);
}

/**
 * Build the priced view of a cart.
 *
 * Every price here is read from the products/variants tables at call time. The
 * client never supplies a price, so a tampered request cannot change what is
 * charged.
 */
export function getCartDetail(cartId, discountCode = '') {
  const rows = cartId
    ? db
        .prepare(
          `SELECT ci.id, ci.quantity, ci.product_id, ci.variant_id,
                  p.slug, p.name, p.price_cents, p.image_url, p.stock AS product_stock, p.active,
                  v.name AS variant_name, v.price_delta_cents, v.stock AS variant_stock
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
           LEFT JOIN product_variants v ON v.id = ci.variant_id
           WHERE ci.cart_id = ?
           ORDER BY ci.id`
        )
        .all(cartId)
    : [];

  const items = rows
    .filter((row) => row.active)
    .map((row) => {
      const unitPriceCents = row.price_cents + (row.price_delta_cents || 0);
      const available = row.variant_id ? row.variant_stock : row.product_stock;
      const quantity = Math.max(1, Math.min(row.quantity, 99));

      return {
        id: row.id,
        productId: row.product_id,
        variantId: row.variant_id,
        slug: row.slug,
        name: row.name,
        variantName: row.variant_name || '',
        imageUrl: row.image_url,
        unitPriceCents,
        quantity,
        lineTotalCents: unitPriceCents * quantity,
        available,
        inStock: available >= quantity,
      };
    });

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  let discountCents = 0;
  let appliedCode = '';
  let discountError = null;

  if (discountCode) {
    const discount = db
      .prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE')
      .get(discountCode.trim());

    discountError = isDiscountUsable(discount, subtotalCents);
    if (!discountError) {
      discountCents = discountAmount(discount, subtotalCents);
      appliedCode = discount.code;
    }
  }

  const afterDiscount = subtotalCents - discountCents;

  const shippingCents =
    count === 0 || afterDiscount >= config.freeShippingThresholdCents
      ? 0
      : config.shippingFlatCents;

  const taxCents = Math.round(afterDiscount * config.taxRate);
  const totalCents = afterDiscount + shippingCents + taxCents;

  return {
    items,
    count,
    subtotalCents,
    discountCents,
    discountCode: appliedCode,
    discountError,
    shippingCents,
    taxCents,
    totalCents,
    currency: config.currency,
    freeShippingThresholdCents: config.freeShippingThresholdCents,
  };
}

export function cartCount(cartId) {
  if (!cartId) return 0;
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(ci.quantity), 0) AS n
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ? AND p.active = 1`
    )
    .get(cartId);
  return Number(row.n) || 0;
}
