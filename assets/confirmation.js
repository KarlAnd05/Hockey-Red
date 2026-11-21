/* ==========================================================================
   Lebanon Hockey - order confirmation page
   --------------------------------------------------------------------------
   Polls the order until it settles, then prints it. A guest proves the order
   is theirs with the ?token= minted at checkout.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="confirmation"]');
  if (!root) return;

  const { api, money, escapeHtml, formatDate, cartChanged, qs } = window.LH;

  function initConfirmation(root) {
    const orderId = qs('order');
    const sessionId = qs('session');
    /* How a buyer with no account proves the order is theirs. ?token= is minted
       at checkout and travels in this link and in the order emails; ?session= is
       the older Stripe-only route, kept for orders placed before the token
       existed. Either one satisfies the server, so pass whatever the URL has. */
    const accessToken = qs('token');
    const credentials = [
      accessToken ? `token=${encodeURIComponent(accessToken)}` : '',
      sessionId ? `session=${encodeURIComponent(sessionId)}` : '',
    ]
      .filter(Boolean)
      .join('&');
    const query = credentials ? `?${credentials}` : '';
    let attempts = 0;

    if (!orderId) {
      root.innerHTML = '<div class="empty-state"><h1>No order specified</h1><a class="button primary small" href="shop.html">Back to the store</a></div>';
      return;
    }

    function renderWaiting() {
      root.innerHTML = `
        <div class="status-icon is-waiting">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>
        </div>
        <h1>Confirming your payment</h1>
        <p style="color:var(--muted)">This usually takes a couple of seconds.</p>`;
    }

    function renderOrder(order) {
      const paid = order.status === 'paid' || order.status === 'fulfilled';

      root.innerHTML = `
        <div class="status-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>
        </div>
        <h1>${paid ? 'Thank you' : 'Order received'}</h1>
        <p style="color:var(--muted);font-size:17px">
          ${paid
            ? `Order <strong>${escapeHtml(order.orderNumber)}</strong> is confirmed. A receipt is on its way to ${escapeHtml(order.email)}.`
            : `Order <strong>${escapeHtml(order.orderNumber)}</strong> is recorded with status ${escapeHtml(order.status)}.`}
        </p>

        <div class="order-panel">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--s-4)">
            <div>
              <h2 style="margin:0;font-size:19px">${escapeHtml(order.orderNumber)}</h2>
              <p style="margin:4px 0 0;color:var(--muted);font-size:13px">${formatDate(order.createdAt)}</p>
            </div>
            <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
          </div>

          <div class="mini-lines">
            ${order.items
              .map(
                (item) => `
              <div class="mini-line" style="grid-template-columns:minmax(0,1fr) auto">
                <div>
                  <div class="name">${escapeHtml(item.name)}</div>
                  <div class="qty">${item.variant ? `${escapeHtml(item.variant)} · ` : ''}Qty ${item.quantity}</div>
                </div>
                <strong>${money(item.lineTotalCents, order.currency)}</strong>
              </div>`
              )
              .join('')}
          </div>

          <div class="summary-rows" style="border:0;padding-top:var(--s-4)">
            <div class="summary-row"><span>Subtotal</span><strong>${money(order.subtotalCents, order.currency)}</strong></div>
            ${order.discountCents > 0 ? `<div class="summary-row is-discount"><span>Discount</span><strong>-${money(order.discountCents, order.currency)}</strong></div>` : ''}
            <div class="summary-row"><span>Shipping</span><strong>${order.shippingCents === 0 ? 'Free' : money(order.shippingCents, order.currency)}</strong></div>
          </div>

          <div class="summary-total" style="margin-top:var(--s-4);padding-top:var(--s-4);border-top:1px solid var(--line)">
            <span>Total</span><strong>${money(order.totalCents, order.currency)}</strong>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:var(--s-5)">
            ${paid ? `<a class="button primary small" href="/api/orders/${order.id}/invoice${query}">Download invoice</a>` : ''}
            <a class="button ghost small" href="account.html">Your orders</a>
            <a class="button ghost small" href="shop.html">Keep shopping</a>
          </div>
        </div>`;

      cartChanged();
    }

    async function poll() {
      attempts += 1;

      try {
        const url = `/api/checkout/status/${encodeURIComponent(orderId)}${query}`;
        const data = await api(url);

        if (data.order.status === 'pending' && attempts < 10) {
          setTimeout(poll, 1500);
          return;
        }

        renderOrder(data.order);
      } catch (error) {
        root.innerHTML = `<div class="empty-state"><h1>Could not load that order</h1><p>${escapeHtml(error.message)}</p><a class="button primary small" href="shop.html">Back to the store</a></div>`;
      }
    }

    renderWaiting();
    poll();
  }

  initConfirmation(root);
})();
