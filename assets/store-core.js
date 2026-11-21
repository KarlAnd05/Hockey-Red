/* ==========================================================================
   Lebanon Hockey - storefront, shared pieces
   --------------------------------------------------------------------------
   What more than one storefront page needs: the discount code the buyer typed,
   which ways to pay are switched on, and the money column that the cart and the
   checkout both print. Anything only one page uses lives in that page's script.

   Published on window.LHStore, the same way api.js publishes window.LH, so each
   page takes only the parts it uses. Load this before the page script.
   ========================================================================== */
(function () {
  'use strict';

  const { money, escapeHtml } = window.LH;

  const DISCOUNT_KEY = 'lh_discount';

  function storedDiscount() {
    try {
      return sessionStorage.getItem(DISCOUNT_KEY) || '';
    } catch {
      return '';
    }
  }

  function setStoredDiscount(code) {
    try {
      if (code) sessionStorage.setItem(DISCOUNT_KEY, code);
      else sessionStorage.removeItem(DISCOUNT_KEY);
    } catch {
      /* private mode - the code just will not persist between pages */
    }
  }

  function stockPill(stock) {
    if (stock <= 0) return '<span class="stock-pill is-out">Sold out</span>';
    if (stock <= 5) return `<span class="stock-pill is-low">Only ${stock} left</span>`;
    return '<span class="stock-pill">In stock</span>';
  }

  /* The store can run with no payment provider configured. When it does, say so
     in the visitor's terms and give them a way to actually order, instead of
     letting them fill in an address and hit a 503 on submit. */
  const PAYMENTS_NOTICE = {
    heading: 'The online store is not taking card payments yet.',
    body:
      'Everything here is real and in stock — we are finishing the payment setup. ' +
      'To order in the meantime, email us what you want and your size and we will invoice you directly.',
    actions:
      '<a class="button primary small" href="mailto:info@lebanonhockey.com?subject=Store%20Order">Email your order</a>' +
      '<a class="button ghost small" href="donation.html">Support us instead</a>',
  };

  /* The donation page needs its own wording: the shop notice sends people to
     donation.html, which on that page would point at itself. */
  const DONATIONS_NOTICE = {
    heading: 'We cannot take card donations yet.',
    body:
      'The federation is finishing its payment setup. If you would like to give now, ' +
      'email us and we will arrange it directly — your support matters either way.',
    actions:
      '<a class="button primary small" href="mailto:info@lebanonhockey.com?subject=Donation">Email the federation</a>' +
      '<a class="button ghost small" href="sponsors.html">See partnership options</a>',
  };

  /* Cards off but e-Transfer on is not a closed store: the visitor can order
     right now, they just pay a different way. Saying "we cannot take card
     payments" and nothing else would send them away from a working checkout. */
  const ETRANSFER_NOTICE = {
    heading: 'Pay by Interac e-Transfer',
    body:
      'Card payments are still being set up, so orders are paid by e-Transfer for now. ' +
      'Order as normal and we will email you exactly where to send it.',
    actions: '',
  };

  function renderPaymentsNotice(host, options) {
    if (!host) return;
    const compact = Boolean(options && options.compact);
    const notice =
      options && options.etransfer
        ? ETRANSFER_NOTICE
        : options && options.donation
          ? DONATIONS_NOTICE
          : PAYMENTS_NOTICE;
    host.innerHTML = `
      <div class="notice${compact ? ' is-info' : ''}" role="status">
        <h2>${escapeHtml(notice.heading)}</h2>
        <p>${escapeHtml(notice.body)}</p>
        ${notice.actions ? `<div class="notice-actions">${notice.actions}</div>` : ''}
      </div>`;
  }

  /* True only when the server says the secret key is present. */
  async function paymentsEnabled() {
    try {
      const data = await window.LH.loadSession();
      return data ? data.paymentsEnabled !== false : true;
    } catch {
      return true; // never block checkout because the probe failed
    }
  }

  /**
   * What to say about payments on a page that is not the checkout.
   *
   * Three states, not two. "Cards are off" used to imply "you cannot order",
   * which stopped being true the moment Interac e-Transfer was added: sending
   * someone to email us instead, past a checkout that works, costs the
   * federation the order.
   */
  async function announcePayments(host, options) {
    if (!host) return;
    const [card, etransfer] = await Promise.all([paymentsEnabled(), etransferEnabled()]);

    if (card) return; // nothing to explain
    renderPaymentsNotice(host, { ...(options || {}), etransfer });
  }

  async function etransferEnabled() {
    try {
      const data = await window.LH.loadSession();
      return Boolean(data && data.etransferEnabled);
    } catch {
      return false; // never offer a payment route we are not sure exists
    }
  }

  function renderSummary(host, cart, options) {
    const opts = options || {};
    const remaining = cart.freeShippingThresholdCents - (cart.subtotalCents - cart.discountCents);

    /* The server echoes back the country it priced against, and it is empty on
       the cart page because no address has been entered there yet. Saying
       "Canada, 7-14 days" to a buyer in Sydney would be a quiet lie, so until
       a country is chosen the figure is labelled an estimate instead. */
    const priced = Boolean(cart.countryCode);
    const deliveryWindow =
      cart.deliveryMinDays && cart.deliveryMaxDays
        ? cart.deliveryMinDays === cart.deliveryMaxDays
          ? `${cart.deliveryMaxDays} days`
          : `${cart.deliveryMinDays}-${cart.deliveryMaxDays} days`
        : '';
    const shippingNote = !cart.count
      ? ''
      : priced
        ? [cart.shippingZone, deliveryWindow]
            .filter(Boolean)
            .map((part) => escapeHtml(String(part)))
            .join(' &middot; ')
        : 'Estimate &mdash; enter your country at checkout for the exact rate';

    host.innerHTML = `
      <h2>Order summary</h2>

      <div class="summary-rows">
        <div class="summary-row"><span>Subtotal</span><strong>${money(cart.subtotalCents, cart.currency)}</strong></div>
        ${
          cart.discountCents > 0
            ? `<div class="summary-row is-discount"><span>Discount (${escapeHtml(cart.discountCode)})</span><strong>-${money(cart.discountCents, cart.currency)}</strong></div>`
            : ''
        }
        <div class="summary-row"><span>Shipping</span><strong>${cart.shippingCents === 0 ? 'Free' : money(cart.shippingCents, cart.currency)}</strong></div>
        ${shippingNote ? `<p class="summary-note">${shippingNote}</p>` : ''}
        ${cart.taxCents > 0 ? `<div class="summary-row"><span>Tax</span><strong>${money(cart.taxCents, cart.currency)}</strong></div>` : ''}
      </div>

      <div class="summary-total">
        <span>Total</span>
        <strong>${money(cart.totalCents, cart.currency)}</strong>
      </div>

      ${
        cart.count > 0 && remaining > 0
          ? `<p class="shipping-hint">Spend ${money(remaining, cart.currency)} more for free shipping.</p>`
          : ''
      }

      ${
        opts.showDiscount
          ? cart.discountCode
            ? `<div class="discount-applied">
                 <span>Code ${escapeHtml(cart.discountCode)} applied</span>
                 <button type="button" class="link-button" data-remove-discount>Remove</button>
               </div>`
            : `<form class="discount-form" data-discount-form>
                 <input type="text" name="code" placeholder="Discount code" aria-label="Discount code" autocomplete="off">
                 <button type="submit" class="button ghost small">Apply</button>
               </form>`
          : ''
      }

      ${opts.actionHtml || ''}

      <p class="secure-note">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        Secure checkout. Card details are handled by Stripe and never touch our servers.
      </p>`;
  }

  window.LHStore = {
    storedDiscount,
    setStoredDiscount,
    stockPill,
    renderPaymentsNotice,
    paymentsEnabled,
    announcePayments,
    etransferEnabled,
    renderSummary,
  };
})();
