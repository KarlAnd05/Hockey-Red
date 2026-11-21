/* ==========================================================================
   Lebanon Hockey admin - Orders
   --------------------------------------------------------------------------
   Every order, and the status change that settles one -
   which is how an e-Transfer is marked received.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, statusBadge, guard } = window.LHAdmin;

  async function initOrders() {
    const host = document.querySelector('[data-orders]');
    const statusFilter = document.querySelector('[data-status-filter]');
    const searchInput = document.querySelector('[data-order-search]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading orders...</div>';

      const query = new URLSearchParams();
      if (statusFilter?.value && statusFilter.value !== 'all') query.set('status', statusFilter.value);
      if (searchInput?.value.trim()) query.set('search', searchInput.value.trim());

      const data = await api(`/api/admin/orders?${query}`);

      if (!data.orders.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No orders match</h3><p>Try a different status or search term.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th class="num">Total</th><th></th></tr>
          </thead>
          <tbody>
            ${data.orders
              .map(
                (order) => `
              <tr data-order="${order.id}">
                <td class="cell-strong">${escapeHtml(order.orderNumber)}</td>
                <td>
                  <div>${escapeHtml(order.shipping.name || '-')}</div>
                  <div class="cell-muted">${escapeHtml(order.email)}</div>
                </td>
                <td class="cell-muted">${formatDate(order.createdAt)}</td>
                <td>${statusBadge(order.status)}${
                  order.paymentMethod === 'etransfer' && order.status === 'pending'
                    ? '<div class="cell-muted">awaiting e-Transfer</div>'
                    : ''
                }</td>
                <td class="num cell-strong">${money(order.totalCents, order.currency)}</td>
                <td>
                  <div class="actions">
                    <button type="button" class="mini-button" data-view>View</button>
                    ${
                      order.status === 'paid' || order.status === 'fulfilled'
                        ? `<a class="mini-button" href="/api/orders/${order.id}/invoice">Invoice</a>`
                        : ''
                    }
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;
    }

    async function showOrder(orderId) {
      const { order } = await api(`/api/admin/orders/${orderId}`);
      const ship = order.shipping;

      const modal = openModal(
        `Order ${order.orderNumber}`,
        `<div class="modal-body">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div>
              <div class="cell-muted">Placed ${formatDate(order.createdAt)}</div>
              <div class="cell-strong">${escapeHtml(order.email)}</div>
            </div>
            ${statusBadge(order.status)}
          </div>

          <div class="table-scroll"><table class="data">
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Total</th></tr></thead>
            <tbody>
              ${order.items
                .map(
                  (item) => `
                <tr>
                  <td>${escapeHtml(item.name)}${item.variant ? ` <span class="cell-muted">(${escapeHtml(item.variant)})</span>` : ''}</td>
                  <td class="num">${item.quantity}</td>
                  <td class="num">${money(item.unitPriceCents, order.currency)}</td>
                  <td class="num cell-strong">${money(item.lineTotalCents, order.currency)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table></div>

          <div style="display:grid;gap:6px;font-size:14px">
            <div style="display:flex;justify-content:space-between"><span class="cell-muted">Subtotal</span><span>${money(order.subtotalCents, order.currency)}</span></div>
            ${order.discountCents ? `<div style="display:flex;justify-content:space-between"><span class="cell-muted">Discount ${escapeHtml(order.discountCode)}</span><span>-${money(order.discountCents, order.currency)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between"><span class="cell-muted">Shipping</span><span>${money(order.shippingCents, order.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:800;font-size:16px;padding-top:8px;border-top:1px solid var(--line)">
              <span>Total</span><span>${money(order.totalCents, order.currency)}</span>
            </div>
          </div>

          <div>
            <label style="margin-bottom:6px">Shipping address</label>
            <p class="cell-muted" style="margin:0">
              ${[ship.name, ship.line1, ship.line2, [ship.city, ship.region, ship.postal].filter(Boolean).join(', '), ship.country]
                .filter(Boolean)
                .map(escapeHtml)
                .join('<br>')}
            </p>
          </div>

          ${
            order.paymentMethod === 'etransfer' && order.status === 'pending'
              ? `<div class="etransfer-pending">
                   <p><strong>Awaiting an Interac e-Transfer</strong> of ${escapeHtml(
                     money(order.totalCents, order.currency)
                   )} with reference <strong>${escapeHtml(order.orderNumber)}</strong>.</p>
                   <p class="cell-muted">Marking this paid does everything a card payment does: stock comes down, the invoice is cut and the confirmation emails go out. Only do it once the money is in the account.</p>
                   <button type="button" class="mini-button solid" data-mark-transfer-paid>Transfer received &mdash; mark paid</button>
                 </div>`
              : ''
          }

          <label>Status
            <select data-order-status>
              ${['pending', 'paid', 'fulfilled', 'cancelled', 'refunded']
                .map((s) => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${s}</option>`)
                .join('')}
            </select>
          </label>
        </div>`,
        `${order.invoiceNumber ? `<a class="mini-button" href="/api/orders/${order.id}/invoice">Download invoice</a>` : ''}
         <button type="button" class="mini-button" data-modal-close>Close</button>
         <button type="button" class="mini-button solid" data-save-status>Save status</button>`
      );

      modal.querySelector('[data-save-status]').addEventListener('click', () =>
        guard(async () => {
          await api(`/api/admin/orders/${order.id}`, {
            method: 'PATCH',
            body: { status: modal.querySelector('[data-order-status]').value },
          });
          closeModal();
          toast('Order updated.', 'success');
          await load();
        })
      );

      /* Same endpoint as the status select - the server routes a pending
         order moving to paid through markOrderPaid either way. This is just
         the one-click version of the thing an operator actually wants. */
      modal.querySelector('[data-mark-transfer-paid]')?.addEventListener('click', () =>
        guard(async () => {
          await api(`/api/admin/orders/${order.id}`, {
            method: 'PATCH',
            body: { status: 'paid' },
          });
          closeModal();
          toast('Marked paid. Stock, invoice and emails have gone out.', 'success');
          await load();
        })
      );
    }

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-order]');
      if (row && event.target.closest('[data-view]')) {
        guard(() => showOrder(row.dataset.order));
      }
    });

    statusFilter?.addEventListener('change', () => guard(load));

    let timer;
    searchInput?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => guard(load), 260);
    });

    await load();
  }

  guard(initOrders);
})();
