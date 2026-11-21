/* ==========================================================================
   Lebanon Hockey admin - Invoices
   --------------------------------------------------------------------------
   Issued invoices, and regenerating a PDF.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { statusBadge, guard } = window.LHAdmin;

  async function initInvoices() {
    const host = document.querySelector('[data-invoices]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading invoices...</div>';
      const data = await api('/api/admin/invoices');

      if (!data.invoices.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No invoices yet</h3><p>An invoice is issued automatically whenever an order is paid.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead><tr><th>Invoice</th><th>Order</th><th>Customer</th><th>Issued</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
          <tbody>
            ${data.invoices
              .map(
                (inv) => `
              <tr data-order-id="${inv.orderId}">
                <td class="cell-strong">${escapeHtml(inv.invoiceNumber)}</td>
                <td class="cell-muted">${escapeHtml(inv.orderNumber)}</td>
                <td class="cell-muted">${escapeHtml(inv.email)}</td>
                <td class="cell-muted">${formatDate(inv.issuedAt)}</td>
                <td>${statusBadge(inv.status)}</td>
                <td class="num cell-strong">${money(inv.totalCents, inv.currency)}</td>
                <td>
                  <div class="actions">
                    <a class="mini-button" href="/api/orders/${inv.orderId}/invoice">Download</a>
                    <button type="button" class="mini-button" data-regenerate>Regenerate</button>
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;
    }

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-order-id]');
      if (!row || !event.target.closest('[data-regenerate]')) return;

      guard(async () => {
        await api(`/api/admin/invoices/${row.dataset.orderId}/regenerate`, { method: 'POST' });
        toast('Invoice regenerated.', 'success');
      });
    });

    await load();
  }

  guard(initInvoices);
})();
