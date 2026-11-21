/* ==========================================================================
   Lebanon Hockey admin - Customers
   --------------------------------------------------------------------------
   Accounts, what each has spent, and their order history.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, statusBadge, guard } = window.LHAdmin;

  async function initCustomers() {
    const host = document.querySelector('[data-customers]');
    const searchInput = document.querySelector('[data-customer-search]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading customers...</div>';

      const search = searchInput?.value.trim();
      const data = await api(`/api/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`);

      if (!data.customers.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No customers yet</h3><p>Accounts appear here as people register.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th class="num">Orders</th><th class="num">Spend</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            ${data.customers
              .map(
                (c) => `
              <tr data-customer="${c.id}">
                <td class="cell-strong">${escapeHtml([c.firstName, c.lastName].filter(Boolean).join(' ') || '-')}</td>
                <td class="cell-muted">${escapeHtml(c.email)}</td>
                <td>
                  <button type="button" class="toggle-pill ${c.role === 'admin' ? 'on' : 'off'}" data-toggle-role>
                    ${escapeHtml(c.role)}
                  </button>
                </td>
                <td class="num">${c.orderCount}</td>
                <td class="num cell-strong">${money(c.spendCents, data.currency)}</td>
                <td class="cell-muted">${formatDate(c.createdAt)}</td>
                <td><div class="actions"><button type="button" class="mini-button" data-view>View</button></div></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;

      host.dataset.cache = JSON.stringify(data.customers);
    }

    async function showCustomer(id) {
      const data = await api(`/api/admin/customers/${id}`);
      const c = data.customer;

      openModal(
        [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email,
        `<div class="modal-body">
          <div style="display:grid;gap:6px;font-size:14px">
            <div><span class="cell-muted">Email</span> <strong>${escapeHtml(c.email)}</strong></div>
            <div><span class="cell-muted">Phone</span> ${escapeHtml(c.phone || '-')}</div>
            <div><span class="cell-muted">Role</span> ${escapeHtml(c.role)}</div>
            <div><span class="cell-muted">Joined</span> ${formatDate(c.created_at)}</div>
          </div>

          <h3 style="margin:0;font-size:15px">Orders</h3>
          ${
            data.orders.length
              ? `<div class="table-scroll"><table class="data">
                   <thead><tr><th>Order</th><th>Date</th><th>Status</th><th class="num">Total</th></tr></thead>
                   <tbody>
                     ${data.orders
                       .map(
                         (o) => `
                       <tr>
                         <td class="cell-strong">${escapeHtml(o.orderNumber)}</td>
                         <td class="cell-muted">${formatDate(o.createdAt)}</td>
                         <td>${statusBadge(o.status)}</td>
                         <td class="num">${money(o.totalCents, o.currency)}</td>
                       </tr>`
                       )
                       .join('')}
                   </tbody>
                 </table></div>`
              : '<p class="cell-muted">No orders yet.</p>'
          }
        </div>`,
        '<button type="button" class="mini-button" data-modal-close>Close</button>'
      );
    }

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-customer]');
      if (!row) return;

      const id = Number(row.dataset.customer);

      if (event.target.closest('[data-view]')) {
        guard(() => showCustomer(id));
        return;
      }

      if (event.target.closest('[data-toggle-role]')) {
        const customers = JSON.parse(host.dataset.cache || '[]');
        const customer = customers.find((c) => c.id === id);
        const nextRole = customer.role === 'admin' ? 'customer' : 'admin';

        const modal = openModal(
          nextRole === 'admin' ? 'Grant admin access' : 'Revoke admin access',
          `<div class="modal-body">
             <p>${nextRole === 'admin' ? 'Give' : 'Remove'} <strong>${escapeHtml(customer.email)}</strong>
                ${nextRole === 'admin' ? 'full access to the admin area?' : "'s admin access?"}</p>
             ${nextRole === 'admin' ? '<p class="cell-muted">Admins can manage products, orders, customers, invoices, and discounts.</p>' : '<p class="cell-muted">Their active sessions will be signed out.</p>'}
           </div>`,
          `<button type="button" class="mini-button" data-modal-close>Cancel</button>
           <button type="button" class="mini-button solid" data-confirm-role>Confirm</button>`
        );

        modal.querySelector('[data-confirm-role]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/customers/${id}/role`, { method: 'PATCH', body: { role: nextRole } });
            closeModal();
            toast(`Role updated to ${nextRole}.`, 'success');
            await load();
          })
        );
      }
    });

    let timer;
    searchInput?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => guard(load), 260);
    });

    await load();
  }

  guard(initCustomers);
})();
