import { Router } from 'express';
import { db } from '../db.js';
import { getOrCreateCart, getCartDetail } from '../lib/cart.js';
import { isDiscountUsable } from '../lib/money.js';

export const cartRouter = Router();

function respond(req, res, discountCode = '') {
  const cart = getOrCreateCart(req);
  res.json(getCartDetail(cart?.id, discountCode));
}

/* --------------------------------------------------------------------------
   Read
   -------------------------------------------------------------------------- */
cartRouter.get('/cart', (req, res) => {
  respond(req, res, String(req.query.discount || ''));
});

/* --------------------------------------------------------------------------
   Add
   -------------------------------------------------------------------------- */
cartRouter.post('/cart/items', (req, res) => {
  const cart = getOrCreateCart(req);
  if (!cart) return res.status(400).json({ error: 'Could not open a cart.' });

  const quantity = Math.max(1, Math.min(Number(req.body?.quantity) || 1, 99));
  const slug = req.body?.slug ? String(req.body.slug) : null;
  const productId = Number(req.body?.productId);

  const product = slug
    ? db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(slug)
    : db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);

  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const variantCount = db
    .prepare('SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?')
    .get(product.id).n;

  let variantId = null;

  if (variantCount > 0) {
    variantId = Number(req.body?.variantId);
    const variant = db
      .prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?')
      .get(variantId, product.id);

    if (!variant) {
      return res.status(400).json({ error: 'Choose a size before adding to the cart.' });
    }
    if (variant.stock < quantity) {
      return res.status(409).json({ error: `Only ${variant.stock} left in ${variant.name}.` });
    }
  } else if (product.stock < quantity) {
    return res.status(409).json({ error: `Only ${product.stock} left in stock.` });
  }

  const existing = db
    .prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ? AND variant_id IS ?')
    .get(cart.id, product.id, variantId);

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(
      Math.min(existing.quantity + quantity, 99),
      existing.id
    );
  } else {
    db.prepare(
      'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES (?, ?, ?, ?)'
    ).run(cart.id, product.id, variantId, quantity);
  }

  respond(req, res);
});

/* --------------------------------------------------------------------------
   Update quantity
   -------------------------------------------------------------------------- */
cartRouter.patch('/cart/items/:id', (req, res) => {
  const cart = getOrCreateCart(req);
  const quantity = Math.max(0, Math.min(Number(req.body?.quantity) || 0, 99));

  const item = db
    .prepare('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?')
    .get(Number(req.params.id), cart?.id);

  if (!item) return res.status(404).json({ error: 'Item not in your cart.' });

  if (quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, item.id);
  }

  respond(req, res, String(req.body?.discount || ''));
});

/* --------------------------------------------------------------------------
   Remove / clear
   -------------------------------------------------------------------------- */
cartRouter.delete('/cart/items/:id', (req, res) => {
  const cart = getOrCreateCart(req);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(
    Number(req.params.id),
    cart?.id
  );
  respond(req, res, String(req.body?.discount || ''));
});

cartRouter.delete('/cart', (req, res) => {
  const cart = getOrCreateCart(req);
  if (cart) db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  respond(req, res);
});

/* --------------------------------------------------------------------------
   Validate a discount code against the current subtotal
   -------------------------------------------------------------------------- */
cartRouter.post('/cart/discount', (req, res) => {
  const cart = getOrCreateCart(req);
  const code = String(req.body?.code || '').trim();

  if (!code) return res.json(getCartDetail(cart?.id, ''));

  const detail = getCartDetail(cart?.id, '');
  const discount = db.prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE').get(code);
  const error = isDiscountUsable(discount, detail.subtotalCents);

  if (error) return res.status(400).json({ error });

  res.json(getCartDetail(cart?.id, code));
});
