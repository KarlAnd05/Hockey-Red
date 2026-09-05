/* ==========================================================================
   Lebanon Hockey - admin
   Every request below goes to /api/admin/*, which the server gates on the
   admin role. This file is convenience only; it is not the security boundary.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;

  const page = document.body.dataset.adminPage;

  /* ========================================================================
     Shell
     ======================================================================== */
  window.LH.loadSession().then((data) => {
    if (!data || !data.user) {
      window.location.href = '/login.html?next=/admin/';
      return;
    }

    const nameEl = document.querySelector('[data-admin-user]');
    if (nameEl) {
      nameEl.innerHTML = `<strong>${escapeHtml(
        [data.user.firstName, data.user.lastName].filter(Boolean).join(' ') || data.user.email
      )}</strong>${escapeHtml(data.user.email)}`;
    }
  });

  document.querySelector('[data-admin-logout]')?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* leaving either way */
    }
    window.location.href = '/index.html';
  });

  /* --- Modal helpers ------------------------------------------------------ */
  const backdrop = document.querySelector('[data-modal-backdrop]');

  function openModal(title, bodyHtml, footerHtml) {
    if (!backdrop) return null;

    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <h2>${escapeHtml(title)}</h2>
          <button type="button" class="close" data-modal-close aria-label="Close">&times;</button>
        </header>
        ${bodyHtml}
        ${footerHtml ? `<footer>${footerHtml}</footer>` : ''}
      </div>`;

    backdrop.hidden = false;
    backdrop.querySelector('input, select, textarea, button')?.focus();
    return backdrop.querySelector('.modal');
  }

  function closeModal() {
    if (!backdrop) return;
    backdrop.hidden = true;
    backdrop.innerHTML = '';
  }

  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-modal-close]')) closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop && !backdrop.hidden) closeModal();
  });

  function statusBadge(status) {
    return `<span class="status-badge is-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
  }

  function centsFromInput(value) {
    const n = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  async function guard(fn) {
    try {
      await fn();
    } catch (error) {
      if (error.status === 404 && String(error.message).includes('Not found')) {
        window.location.href = '/login.html?next=/admin/';
        return;
      }
      toast(error.message, 'error');
    }
  }

  /* ========================================================================
     Dashboard
     ======================================================================== */
  async function initDashboard() {
    const statsHost = document.querySelector('[data-stats]');
    const chartHost = document.querySelector('[data-chart]');
    const recentHost = document.querySelector('[data-recent-orders]');
    const lowStockHost = document.querySelector('[data-low-stock]');
    const topHost = document.querySelector('[data-top-products]');

    const data = await api('/api/admin/stats');

    statsHost.innerHTML = [
      ['Revenue (all time)', money(data.revenueCents, data.currency), `${data.paidCount} paid orders`],
      ['Revenue (30 days)', money(data.revenue30Cents, data.currency), 'Rolling window'],
      ['Average order', money(data.averageOrderCents, data.currency), 'Across paid orders'],
      ['Pending orders', String(data.pendingCount), 'Awaiting payment'],
      ['Customers', String(data.customerCount), 'Registered accounts'],
      ['Active products', String(data.productCount), 'Visible in the shop'],
    ]
      .map(
        ([label, value, sub]) => `
        <div class="stat-card">
          <span class="label">${escapeHtml(label)}</span>
          <div class="value">${escapeHtml(value)}</div>
          <p class="sub">${escapeHtml(sub)}</p>
        </div>`
      )
      .join('');

    /* --- 30-day revenue chart --- */
    const byDay = new Map(data.series.map((row) => [row.day, row.total]));
    const days = [];

    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days.push({ day: key, total: byDay.get(key) || 0 });
    }

    const peak = Math.max(...days.map((d) => d.total), 1);

    chartHost.innerHTML = days
      .map(
        (d) =>
          `<div class="chart-bar" style="height:${Math.max((d.total / peak) * 100, 2)}%"
                data-label="${d.day}: ${money(d.total, data.currency)}"></div>`
      )
      .join('');

    /* --- Recent orders --- */
    recentHost.innerHTML = data.recentOrders.length
      ? `<div class="table-scroll"><table class="data">
          <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th><th>Date</th></tr></thead>
          <tbody>
            ${data.recentOrders
              .map(
                (order) => `
              <tr>
                <td class="cell-strong">${escapeHtml(order.orderNumber)}</td>
                <td class="cell-muted">${escapeHtml(order.email)}</td>
                <td>${statusBadge(order.status)}</td>
                <td class="num cell-strong">${money(order.totalCents, order.currency)}</td>
                <td class="cell-muted">${formatDate(order.createdAt)}</td>
              </tr>`
              )
              .join('')}
          </tbody></table></div>`
      : '<div class="admin-empty"><h3>No orders yet</h3><p>Orders will appear here once the shop takes its first payment.</p></div>';

    /* --- Low stock --- */
    lowStockHost.innerHTML = data.lowStock.length
      ? `<div class="table-scroll"><table class="data">
          <thead><tr><th>Product</th><th class="num">Stock</th></tr></thead>
          <tbody>${data.lowStock
            .map(
              (p) =>
                `<tr><td class="cell-strong">${escapeHtml(p.name)}</td><td class="num">${p.stock}</td></tr>`
            )
            .join('')}</tbody></table></div>`
      : '<div class="admin-empty"><p>Every product is comfortably stocked.</p></div>';

    /* --- Top products --- */
    topHost.innerHTML = data.topProducts.length
      ? `<div class="table-scroll"><table class="data">
          <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Revenue</th></tr></thead>
          <tbody>${data.topProducts
            .map(
              (p) => `
            <tr>
              <td class="cell-strong">${escapeHtml(p.name)}</td>
              <td class="num">${p.units}</td>
              <td class="num">${money(p.revenue, data.currency)}</td>
            </tr>`
            )
            .join('')}</tbody></table></div>`
      : '<div class="admin-empty"><p>No sales recorded yet.</p></div>';
  }

  /* ========================================================================
     Products
     ======================================================================== */
  async function initProducts() {
    const host = document.querySelector('[data-products]');
    const searchInput = document.querySelector('[data-product-search]');
    let categories = [];

    async function load() {
      const search = searchInput?.value.trim() || '';
      host.innerHTML = '<div class="admin-loading">Loading products...</div>';

      const [data, cats] = await Promise.all([
        api(`/api/admin/products${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api('/api/admin/categories'),
      ]);

      categories = cats.categories;

      if (!data.products.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No products</h3><p>Add your first product to get started.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead>
            <tr>
              <th></th><th>Product</th><th>Category</th>
              <th class="num">Price</th><th class="num">Stock</th>
              <th>Sizes</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${data.products
              .map(
                (p) => `
              <tr data-product="${p.id}">
                <td><img class="thumb" src="${escapeHtml(p.imageUrl)}" alt=""></td>
                <td>
                  <div class="cell-strong">${escapeHtml(p.name)}</div>
                  <div class="cell-muted">${escapeHtml(p.slug)}</div>
                </td>
                <td class="cell-muted">${escapeHtml(p.categoryName || '-')}</td>
                <td class="num cell-strong">${money(p.priceCents, data.currency)}</td>
                <td class="num">${p.stock}</td>
                <td class="cell-muted">${p.variants.length ? p.variants.map((v) => escapeHtml(v.name)).join(', ') : '-'}</td>
                <td>
                  <button type="button" class="toggle-pill ${p.active ? 'on' : 'off'}" data-toggle-active>
                    ${p.active ? 'Active' : 'Hidden'}
                  </button>
                </td>
                <td>
                  <div class="actions">
                    <button type="button" class="mini-button" data-edit>Edit</button>
                    <button type="button" class="mini-button danger" data-delete>Delete</button>
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;

      host.dataset.cache = JSON.stringify(data.products);
    }

    function productForm(product) {
      const isNew = !product;
      const p = product || {
        name: '',
        slug: '',
        description: '',
        priceCents: 0,
        stock: 0,
        imageUrl: '',
        badge: '',
        categoryId: null,
        active: true,
        featured: false,
        variants: [],
      };

      const modal = openModal(
        isNew ? 'New product' : `Edit ${p.name}`,
        `<form data-product-form>
          <label>Name<input type="text" name="name" value="${escapeHtml(p.name)}" required></label>
          <label>Description<textarea name="description" rows="3">${escapeHtml(p.description)}</textarea></label>

          <div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Price (${escapeHtml((window.LH.session?.currency || 'cad').toUpperCase())})
              <input type="text" name="price" value="${(p.priceCents / 100).toFixed(2)}" required>
            </label>
            <label>Stock<input type="number" name="stock" min="0" value="${p.stock}"></label>
          </div>

          <div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Category
              <select name="categoryId">
                <option value="">Uncategorised</option>
                ${categories
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Badge<input type="text" name="badge" value="${escapeHtml(p.badge)}" placeholder="New, Signature..."></label>
          </div>

          <label>Image URL
            <input type="text" name="imageUrl" value="${escapeHtml(p.imageUrl)}" placeholder="/assets/photo.jpg">
          </label>

          <div style="display:flex;gap:20px">
            <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
              <input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Active
            </label>
            <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
              <input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Featured
            </label>
          </div>

          ${
            isNew
              ? ''
              : `<div>
                   <label style="margin-bottom:8px">Sizes / variants</label>
                   <div class="variant-editor" data-variant-editor>
                     ${p.variants
                       .map(
                         (v) => `
                       <div class="variant-editor-row" data-variant="${v.id}">
                         <input type="text" value="${escapeHtml(v.name)}" data-variant-name aria-label="Variant name">
                         <input type="number" value="${v.stock}" min="0" data-variant-stock aria-label="Variant stock">
                         <button type="button" class="mini-button danger" data-variant-delete>Remove</button>
                       </div>`
                       )
                       .join('')}
                   </div>
                   <div class="variant-editor-row" style="margin-top:8px">
                     <input type="text" placeholder="Add size (e.g. XL)" data-new-variant-name aria-label="New variant name">
                     <input type="number" placeholder="Stock" min="0" value="0" data-new-variant-stock aria-label="New variant stock">
                     <button type="button" class="mini-button solid" data-variant-add>Add</button>
                   </div>
                 </div>`
          }
        </form>`,
        `<button type="button" class="mini-button" data-modal-close>Cancel</button>
         <button type="submit" form="" class="mini-button solid" data-save>Save product</button>`
      );

      const form = modal.querySelector('[data-product-form]');

      /* --- Variants --- */
      modal.querySelector('[data-variant-add]')?.addEventListener('click', () =>
        guard(async () => {
          const name = modal.querySelector('[data-new-variant-name]').value.trim();
          const stock = Number(modal.querySelector('[data-new-variant-stock]').value) || 0;
          if (!name) return;

          await api(`/api/admin/products/${p.id}/variants`, {
            method: 'POST',
            body: { name, stock },
          });
          toast('Size added.', 'success');
          closeModal();
          await load();
        })
      );

      modal.querySelector('[data-variant-editor]')?.addEventListener('click', (event) => {
        const row = event.target.closest('[data-variant]');
        if (!row || !event.target.closest('[data-variant-delete]')) return;

        guard(async () => {
          await api(`/api/admin/variants/${row.dataset.variant}`, { method: 'DELETE' });
          row.remove();
          toast('Size removed.');
        });
      });

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const values = Object.fromEntries(new FormData(form).entries());

          const body = {
            name: values.name,
            description: values.description,
            priceCents: centsFromInput(values.price),
            stock: Number(values.stock) || 0,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            imageUrl: values.imageUrl,
            badge: values.badge,
            active: form.active.checked,
            featured: form.featured.checked,
          };

          if (!body.name.trim()) throw new Error('A product name is required.');

          // Persist any inline variant edits alongside the product itself.
          if (!isNew) {
            const rows = modal.querySelectorAll('[data-variant]');
            for (const row of rows) {
              await api(`/api/admin/variants/${row.dataset.variant}`, {
                method: 'PATCH',
                body: {
                  name: row.querySelector('[data-variant-name]').value,
                  stock: Number(row.querySelector('[data-variant-stock]').value) || 0,
                },
              });
            }
          }

          if (isNew) {
            await api('/api/admin/products', { method: 'POST', body });
            toast('Product created.', 'success');
          } else {
            await api(`/api/admin/products/${p.id}`, { method: 'PATCH', body });
            toast('Product saved.', 'success');
          }

          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-product]')?.addEventListener('click', () => productForm(null));

    let searchTimer;
    searchInput?.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => guard(load), 260);
    });

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-product]');
      if (!row) return;

      const products = JSON.parse(host.dataset.cache || '[]');
      const product = products.find((p) => p.id === Number(row.dataset.product));
      if (!product) return;

      if (event.target.closest('[data-edit]')) {
        productForm(product);
        return;
      }

      if (event.target.closest('[data-toggle-active]')) {
        guard(async () => {
          await api(`/api/admin/products/${product.id}`, {
            method: 'PATCH',
            body: { active: !product.active },
          });
          await load();
        });
        return;
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete product',
          `<div class="modal-body">
             <p>Delete <strong>${escapeHtml(product.name)}</strong>?</p>
             <p class="cell-muted">If it appears on any past order it will be hidden from the shop instead of removed, so order history and invoices stay intact.</p>
           </div>`,
          `<button type="button" class="mini-button" data-modal-close>Cancel</button>
           <button type="button" class="mini-button danger" data-confirm-delete>Delete</button>`
        );

        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            const result = await api(`/api/admin/products/${product.id}`, { method: 'DELETE' });
            closeModal();
            toast(result.archived ? 'Product hidden (it has order history).' : 'Product deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Orders
     ======================================================================== */
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
                <td>${statusBadge(order.status)}</td>
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

  /* ========================================================================
     Customers
     ======================================================================== */
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

  /* ========================================================================
     Invoices
     ======================================================================== */
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

  /* ========================================================================
     Discounts
     ======================================================================== */
  async function initDiscounts() {
    const host = document.querySelector('[data-discounts]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading discounts...</div>';
      const data = await api('/api/admin/discounts');

      if (!data.discounts.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No discount codes</h3><p>Create a code to run a promotion.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead><tr><th>Code</th><th>Value</th><th class="num">Min spend</th><th>Window</th><th class="num">Used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${data.discounts
              .map(
                (d) => `
              <tr data-discount="${d.id}">
                <td class="cell-strong">${escapeHtml(d.code)}</td>
                <td>${d.type === 'percent' ? `${d.value}%` : money(d.value, data.currency)}</td>
                <td class="num cell-muted">${d.minSubtotalCents ? money(d.minSubtotalCents, data.currency) : '-'}</td>
                <td class="cell-muted">${
                  d.startsAt || d.endsAt
                    ? `${d.startsAt ? formatDate(d.startsAt) : 'any'} - ${d.endsAt ? formatDate(d.endsAt) : 'any'}`
                    : 'Always'
                }</td>
                <td class="num">${d.timesRedeemed}${d.maxRedemptions ? ` / ${d.maxRedemptions}` : ''}</td>
                <td>
                  <button type="button" class="toggle-pill ${d.active ? 'on' : 'off'}" data-toggle-discount>
                    ${d.active ? 'Active' : 'Off'}
                  </button>
                </td>
                <td>
                  <div class="actions">
                    <button type="button" class="mini-button" data-edit>Edit</button>
                    <button type="button" class="mini-button danger" data-delete>Delete</button>
                  </div>
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table></div>`;

      host.dataset.cache = JSON.stringify(data.discounts);
    }

    function discountForm(discount) {
      const isNew = !discount;
      const d = discount || {
        code: '',
        type: 'percent',
        value: 10,
        minSubtotalCents: 0,
        startsAt: '',
        endsAt: '',
        maxRedemptions: 0,
        active: true,
      };

      const modal = openModal(
        isNew ? 'New discount code' : `Edit ${d.code}`,
        `<form data-discount-form>
          <label>Code
            <input type="text" name="code" value="${escapeHtml(d.code)}" ${isNew ? '' : 'readonly'}
                   placeholder="CEDAR10" style="text-transform:uppercase" required>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Type
              <select name="type">
                <option value="percent" ${d.type === 'percent' ? 'selected' : ''}>Percent off</option>
                <option value="fixed" ${d.type === 'fixed' ? 'selected' : ''}>Fixed amount off</option>
              </select>
            </label>
            <label>Value
              <input type="number" name="value" min="1" value="${d.type === 'fixed' ? (d.value / 100).toFixed(2) : d.value}" required>
            </label>
          </div>
          <p class="cell-muted" style="margin:-8px 0 0;font-size:12.5px">
            Percent codes take a whole number (10 = 10%). Fixed codes take an amount (25 = $25.00 off).
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Minimum spend
              <input type="text" name="minSpend" value="${(d.minSubtotalCents / 100).toFixed(2)}">
            </label>
            <label>Max redemptions
              <input type="number" name="maxRedemptions" min="0" value="${d.maxRedemptions}" placeholder="0 = unlimited">
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Starts<input type="date" name="startsAt" value="${(d.startsAt || '').slice(0, 10)}"></label>
            <label>Ends<input type="date" name="endsAt" value="${(d.endsAt || '').slice(0, 10)}"></label>
          </div>

          <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
            <input type="checkbox" name="active" ${d.active ? 'checked' : ''}> Active
          </label>
        </form>`,
        `<button type="button" class="mini-button" data-modal-close>Cancel</button>
         <button type="button" class="mini-button solid" data-save>Save code</button>`
      );

      const form = modal.querySelector('[data-discount-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const values = Object.fromEntries(new FormData(form).entries());

          const body = {
            code: String(values.code || '').toUpperCase(),
            type: values.type,
            value:
              values.type === 'fixed'
                ? centsFromInput(values.value)
                : Math.round(Number(values.value) || 0),
            minSubtotalCents: centsFromInput(values.minSpend),
            maxRedemptions: Number(values.maxRedemptions) || 0,
            startsAt: values.startsAt || null,
            endsAt: values.endsAt || null,
            active: form.active.checked,
          };

          if (!body.code) throw new Error('A code is required.');

          if (isNew) {
            await api('/api/admin/discounts', { method: 'POST', body });
            toast('Discount created.', 'success');
          } else {
            await api(`/api/admin/discounts/${d.id}`, { method: 'PATCH', body });
            toast('Discount saved.', 'success');
          }

          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-discount]')?.addEventListener('click', () => discountForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-discount]');
      if (!row) return;

      const discounts = JSON.parse(host.dataset.cache || '[]');
      const discount = discounts.find((d) => d.id === Number(row.dataset.discount));
      if (!discount) return;

      if (event.target.closest('[data-edit]')) {
        discountForm(discount);
        return;
      }

      if (event.target.closest('[data-toggle-discount]')) {
        guard(async () => {
          await api(`/api/admin/discounts/${discount.id}`, {
            method: 'PATCH',
            body: { active: !discount.active },
          });
          await load();
        });
        return;
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete discount',
          `<div class="modal-body"><p>Delete the code <strong>${escapeHtml(discount.code)}</strong>? Orders that already used it keep their recorded discount.</p></div>`,
          `<button type="button" class="mini-button" data-modal-close>Cancel</button>
           <button type="button" class="mini-button danger" data-confirm-delete>Delete</button>`
        );

        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/discounts/${discount.id}`, { method: 'DELETE' });
            closeModal();
            toast('Discount deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Dispatch
     ======================================================================== */
  const pages = {
    dashboard: initDashboard,
    products: initProducts,
    orders: initOrders,
    customers: initCustomers,
    invoices: initInvoices,
    discounts: initDiscounts,
  };

  if (pages[page]) guard(pages[page]);
})();
