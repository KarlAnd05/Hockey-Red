import { Router } from 'express';
import { db } from '../db.js';
import { config, stripeEnabled } from '../config.js';
import { getOrCreateCart, getCartDetail } from '../lib/cart.js';
import { createPendingOrder, markOrderPaid, serialiseOrder } from '../lib/orders.js';
import { getStripe } from '../lib/stripe.js';
import { COUNTRIES } from '../lib/shipping.js';
import { sendEtransferInstructions } from '../lib/notifications.js';

export const checkoutRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* --------------------------------------------------------------------------
   Start checkout
   -------------------------------------------------------------------------- */
checkoutRouter.post('/checkout', async (req, res) => {
  const cart = getOrCreateCart(req);
  const email = String(req.body?.email || req.user?.email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const shipping = {
    name: req.body?.name,
    line1: req.body?.line1,
    line2: req.body?.line2,
    city: req.body?.city,
    region: req.body?.region,
    postal: req.body?.postal,
    country: req.body?.country,
  };

  if (!String(shipping.line1 || '').trim() || !String(shipping.city || '').trim()) {
    return res.status(400).json({ error: 'A shipping address line and city are required.' });
  }

  /* Interac e-Transfer needs no payment provider at all: the buyer sends the
     money themselves and the federation marks the order paid when it arrives.
     So this path is checked BEFORE the Stripe gate below - it is the one way
     to take an order while card payments are still being set up. */
  const method = req.body?.method === 'etransfer' ? 'etransfer' : 'card';

  if (method === 'etransfer') {
    if (!config.etransferEmail) {
      return res.status(503).json({
        error: 'e-Transfer is not set up yet. Please choose another way to pay.',
        code: 'etransfer_disabled',
      });
    }

    const created = createPendingOrder({
      cartId: cart?.id,
      userId: req.user?.id ?? null,
      email,
      shipping,
      discountCode: String(req.body?.discountCode || ''),
      paymentMethod: 'etransfer',
    });

    if (created.error) return res.status(400).json({ error: created.error });

    /* The order stays pending until someone confirms the transfer landed. The
       stock is not decremented and no invoice is cut yet, because none of that
       is true until the money arrives - markOrderPaid does all of it, once,
       whenever the federation marks it. */
    try {
      await sendEtransferInstructions(created.orderId);
    } catch (error) {
      console.error('[etransfer] could not email instructions:', error.message);
    }

    return res.json({
      method: 'etransfer',
      orderId: created.orderId,
      orderNumber: created.orderNumber,
      instructions: {
        email: config.etransferEmail,
        name: config.etransferName,
        amountCents: created.detail.totalCents,
        currency: created.detail.currency,
        reference: created.orderNumber,
      },
    });
  }

  /* No payment provider, no order. This used to return after createPendingOrder,
     which left a pending row behind on every attempt -- an order number spent
     and nothing able to settle it. Validation above still runs, so the form
     stays honest; only the write is skipped.

     The exception is the local dev hatch ALLOW_DEV_CHECKOUT opens, where the
     order must still be created so scripts/smoke-test.mjs can settle it through
     /api/checkout/dev-complete without Stripe. */
  const devCheckout = !config.isProduction && process.env.ALLOW_DEV_CHECKOUT === 'true';

  if (!stripeEnabled && !devCheckout) {
    return res.status(503).json({
      error: 'The store is not taking card payments yet.',
      code: 'payments_disabled',
    });
  }

  const created = createPendingOrder({
    cartId: cart?.id,
    userId: req.user?.id ?? null,
    email,
    shipping,
    discountCode: String(req.body?.discountCode || ''),
  });

  if (created.error) {
    return res.status(400).json({ error: created.error });
  }

  const { orderId, detail } = created;

  /* Only reachable through the dev hatch above, so the order exists and a local
     run can settle it. No developer instruction in the message: this response
     is rendered to a person. */
  if (!stripeEnabled) {
    return res.status(503).json({
      error: 'The store is not taking card payments yet.',
      code: 'payments_disabled',
      orderId,
    });
  }

  try {
    const stripe = getStripe();

    // Line items are rebuilt from the priced cart, never from the request body.
    const lineItems = detail.items.map((item) => ({
      price_data: {
        currency: detail.currency,
        unit_amount: item.unitPriceCents,
        product_data: {
          name: item.variantName ? `${item.name} (${item.variantName})` : item.name,
        },
      },
      quantity: item.quantity,
    }));

    if (detail.shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: detail.currency,
          unit_amount: detail.shippingCents,
          product_data: { name: 'Shipping' },
        },
        quantity: 1,
      });
    }

    // Stripe has no negative line items, so a discount becomes a coupon.
    const discounts = [];
    if (detail.discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: detail.discountCents,
        currency: detail.currency,
        duration: 'once',
        name: detail.discountCode || 'Discount',
      });
      discounts.push({ coupon: coupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: lineItems,
      discounts,
      client_reference_id: String(orderId),
      metadata: { order_id: String(orderId), cart_id: String(cart?.id ?? '') },
      success_url: `${config.appUrl}/order-confirmation.html?order=${orderId}&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/cart.html?cancelled=1`,
    });

    db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);

    res.json({ url: session.url, orderId });
  } catch (error) {
    console.error('[checkout] Stripe error:', error.message);
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(orderId);
    res.status(502).json({ error: 'Could not reach the payment provider. Please try again.' });
  }
});

/* --------------------------------------------------------------------------
   Confirmation polling
   -------------------------------------------------------------------------- */
checkoutRouter.get('/checkout/status/:orderId', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.orderId));
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // Only the buyer (or an admin) may look at an order.
  const owns =
    (order.user_id && order.user_id === req.user?.id) ||
    (!order.user_id && req.query.session && order.stripe_session_id === req.query.session);

  if (!owns && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Not your order.' });
  }

  // Fall back to asking Stripe directly if the webhook has not landed yet.
  if (order.status === 'pending' && order.stripe_session_id && stripeEnabled) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (session.payment_status === 'paid') {
        /* Pass the cart id the same way the webhook does, from the session's
           own metadata. Without it a guest's cart is never emptied here -
           markOrderPaid can only fall back to "the signed-in user's newest
           cart", and a guest has neither - so they would pay, come back, and
           still find the order sitting in their basket. */
        await markOrderPaid(order.id, {
          paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          cartId: Number(session.metadata?.cart_id) || null,
        });
      }
    } catch (error) {
      console.error('[checkout] status poll failed:', error.message);
    }
  }

  const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  res.json({ order: serialiseOrder(fresh) });
});

/* --------------------------------------------------------------------------
   Development helper - settle an order without the Stripe CLI
   --------------------------------------------------------------------------
   Hard-disabled in production, and additionally gated behind ALLOW_DEV_CHECKOUT
   so it cannot be reached by accident.
   -------------------------------------------------------------------------- */
checkoutRouter.post('/checkout/dev-complete/:orderId', async (req, res) => {
  if (config.isProduction || process.env.ALLOW_DEV_CHECKOUT !== 'true') {
    return res.status(404).json({ error: 'Not found.' });
  }

  const cart = getOrCreateCart(req);
  const order = await markOrderPaid(Number(req.params.orderId), {
    paymentIntentId: 'pi_dev_simulated',
    cartId: cart?.id,
  });

  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order: serialiseOrder(order) });
});

/* --------------------------------------------------------------------------
   Cart preview for the checkout page
   -------------------------------------------------------------------------- */
checkoutRouter.get('/checkout/summary', (req, res) => {
  const cart = getOrCreateCart(req);
  /* The country drives the shipping quote, so the figure on screen is the one
     that will actually be charged. Without it the page would show origin-zone
     shipping and then charge the real zone at the last moment. */
  res.json(
    getCartDetail(cart?.id, String(req.query.discount || ''), String(req.query.country || ''))
  );
});

/* The country list the checkout select is built from, served so the page and
   the zone lookup can never disagree about a code. */
checkoutRouter.get('/checkout/countries', (req, res) => {
  res.json({ countries: COUNTRIES, origin: config.shippingOriginCountry });
});
