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

  /* Donation statuses mirror Stripe's vocabulary ('canceled', 'past_due');
     order statuses use the project's own ('cancelled'). Normalising here keeps
     one set of badge styles instead of shipping both spellings in the CSS. */
  function statusBadge(status) {
    const raw = String(status || '');
    const cls = raw.replace(/_/g, '-').replace(/^canceled$/, 'cancelled');
    return `<span class="status-badge is-${escapeHtml(cls)}">${escapeHtml(raw.replace(/_/g, ' '))}</span>`;
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
    const attentionPanel = document.querySelector('[data-attention-panel]');
    const attentionHost = document.querySelector('[data-attention]');

    /* Loaded separately from the shop stats, and allowed to fail on its own:
       this panel is useful, but a broken one must not take the dashboard with
       it. An empty list stays hidden - "nothing to do" is best said by the
       panel not being there. */
    async function loadAttention() {
      if (!attentionHost || !attentionPanel) return;

      try {
        const data = await api('/api/admin/overview');
        const items = data.items || [];
        if (!items.length) return;

        attentionPanel.hidden = false;
        attentionHost.innerHTML = items
          .map(
            (item) => `
          <a class="attention-row${item.urgent ? ' is-urgent' : ''}" href="${escapeHtml(item.href)}">
            <span class="attention-count">${escapeHtml(String(item.n))}</span>
            <span class="attention-label">${escapeHtml(item.label)}</span>
            <span class="attention-action">${escapeHtml(item.action)}</span>
          </a>`
          )
          .join('');
      } catch {
        /* leave the panel hidden */
      }
    }

    await loadAttention();

    const data = await api('/api/admin/stats');

    statsHost.innerHTML = [
      ['Revenue (all time)', money(data.revenueCents, data.currency), `${data.paidCount} paid orders`],
      ['Revenue (30 days)', money(data.revenue30Cents, data.currency), 'Rolling window'],
      ['Average order', money(data.averageOrderCents, data.currency), 'Across paid orders'],
      ['Pending orders', String(data.pendingCount), 'Awaiting payment'],
      ['Customers', String(data.customerCount), 'Registered accounts'],
      ['Active products', String(data.productCount), 'Visible in the store'],
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
      : '<div class="admin-empty"><h3>No orders yet</h3><p>Orders will appear here once the store takes its first payment.</p></div>';

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
             <p class="cell-muted">If it appears on any past order it will be hidden from the store instead of removed, so order history and invoices stay intact.</p>
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
     Page text - every editable block on the public site
     ======================================================================== */
  async function initContent() {
    const host = document.querySelector('[data-content-list]');
    const pageSelect = document.querySelector('[data-content-page]');
    const searchInput = document.querySelector('[data-content-search]');
    const editedOnly = document.querySelector('[data-content-edited-only]');
    const countEl = document.querySelector('[data-content-count]');
    const resyncBtn = document.querySelector('[data-content-resync]');

    let groups = [];

    /* A block's live text is the edit when there is one, otherwise whatever the
       page markup says. The editor always shows what a visitor would read. */
    const liveValue = (b) => (b.value !== null && b.value !== '' ? b.value : b.default_value);
    const isEdited = (b) => b.value !== null && b.value !== '';

    function rows(blocks) {
      return blocks
        .map((b) => {
          const value = liveValue(b);
          const lines = Math.min(14, Math.max(2, Math.ceil(value.length / 78) + value.split('\n').length - 1));
          const edited = isEdited(b);
          return `
            <article class="content-block${edited ? ' is-edited' : ''}${b.orphaned ? ' is-orphaned' : ''}" data-key="${escapeHtml(b.key)}">
              <div class="content-block-head">
                <span class="content-tag">${escapeHtml(b.tag)}</span>
                <p class="content-label">${escapeHtml(b.label)}</p>
                ${edited ? '<span class="content-state">Edited</span>' : ''}
                ${b.orphaned ? '<span class="content-state is-warn">No longer on the page</span>' : ''}
              </div>
              <textarea class="content-input" rows="${lines}" data-input spellcheck="true">${escapeHtml(value)}</textarea>
              <div class="content-block-actions">
                <button type="button" class="button primary small" data-save>Save</button>
                ${edited ? '<button type="button" class="button ghost small" data-reset>Reset</button>' : ''}
                <span class="content-status" data-status role="status"></span>
              </div>
              ${
                edited
                  ? `<p class="content-default">The page itself says: &ldquo;${escapeHtml(
                      b.default_value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
                    )}&rdquo;</p>`
                  : ''
              }
            </article>`;
        })
        .join('');
    }

    function render() {
      const term = (searchInput?.value || '').trim().toLowerCase();
      const onlyPage = pageSelect?.value || '';
      const onlyEdited = Boolean(editedOnly?.checked);

      let shown = 0;
      const html = groups
        .filter((g) => !onlyPage || g.page === onlyPage)
        .map((g) => {
          const blocks = g.blocks.filter((b) => {
            if (onlyEdited && !isEdited(b)) return false;
            if (!term) return true;
            return (
              b.label.toLowerCase().includes(term) ||
              liveValue(b).toLowerCase().includes(term) ||
              b.key.toLowerCase().includes(term)
            );
          });
          if (!blocks.length) return '';
          shown += blocks.length;
          return `
            <section class="content-page">
              <header class="content-page-head">
                <h2>${escapeHtml(g.page)}</h2>
                <p>${g.blocks.length} block${g.blocks.length === 1 ? '' : 's'}${
                  g.edited ? ` &middot; ${g.edited} edited` : ''
                }</p>
                <a class="button ghost small" href="/${escapeHtml(g.page)}" target="_blank" rel="noopener">View page</a>
              </header>
              ${rows(blocks)}
            </section>`;
        })
        .join('');

      host.innerHTML =
        html ||
        '<div class="empty-state"><h2>Nothing matches</h2><p>Try a different search term, or clear the filters.</p></div>';
      if (countEl) countEl.textContent = `${shown} block${shown === 1 ? '' : 's'}`;
    }

    async function load() {
      host.innerHTML = '<p class="content-loading">Reading the site&rsquo;s text&hellip;</p>';
      const data = await api('/api/admin/content');
      groups = data.pages || [];

      if (pageSelect && pageSelect.options.length <= 1) {
        for (const g of groups) {
          const opt = document.createElement('option');
          opt.value = g.page;
          opt.textContent = g.page;
          pageSelect.appendChild(opt);
        }
      }
      render();
    }

    /* One listener for the whole list, so re-rendering never leaves stale handlers. */
    host.addEventListener('click', (event) => {
      const block = event.target.closest('.content-block');
      if (!block) return;
      const key = block.dataset.key;
      const input = block.querySelector('[data-input]');
      const status = block.querySelector('[data-status]');

      if (event.target.closest('[data-save]')) {
        guard(async () => {
          status.textContent = 'Saving...';
          await api(`/api/admin/content/${encodeURIComponent(key)}`, {
            method: 'PATCH',
            body: { value: input.value },
          });
          status.textContent = 'Saved';
          toast('Text updated. It is live on the site now.');
          await load();
        });
      }

      if (event.target.closest('[data-reset]')) {
        guard(async () => {
          status.textContent = 'Resetting...';
          await api(`/api/admin/content/${encodeURIComponent(key)}/reset`, { method: 'POST' });
          toast('Back to the original wording.');
          await load();
        });
      }
    });

    searchInput?.addEventListener('input', render);
    pageSelect?.addEventListener('change', render);
    editedOnly?.addEventListener('change', render);

    resyncBtn?.addEventListener('click', () =>
      guard(async () => {
        const result = await api('/api/admin/content/resync', { method: 'POST' });
        toast(`Re-read ${result.pages} pages, ${result.blocks} text blocks.`);
        await load();
      })
    );

    await load();
  }

  /* ========================================================================
     Shipping zones
     ======================================================================== */
  async function initShipping() {
    const host = document.querySelector('[data-shipping-zones]');
    let allCountries = [];

    const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2);

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading zones...</div>';
      const data = await api('/api/admin/shipping');
      allCountries = data.countries;

      const unassigned =
        allCountries.length - data.zones.reduce((n, z) => n + z.countries.length, 0);

      /* The catch-all prices every country nobody has mapped yet. Give it a
         free-shipping threshold and a large order to one of those 129
         countries ships for nothing, which is the one way this screen can
         quietly cost the federation money. Worth saying out loud. */
      const fallback = data.zones.find((z) => z.is_default);
      const leaks = fallback && fallback.free_over_cents > 0;

      host.innerHTML = `
        <p class="zone-note">
          ${escapeHtml(String(unassigned))} of ${escapeHtml(String(allCountries.length))} countries
          are not assigned to a zone and fall to the catch-all, so nothing ever ships for free by accident.
        </p>
        ${
          leaks
            ? `<p class="zone-warning">
                 <strong>${escapeHtml(fallback.name)}</strong> is the catch-all and has a free-shipping
                 threshold of ${escapeHtml(money(fallback.free_over_cents, 'cad'))}. Any order above that
                 going to one of the ${escapeHtml(String(unassigned))} unmapped countries will ship free.
                 Either clear the threshold on this zone or make a zone without one the catch-all.
               </p>`
            : ''
        }
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Zone</th><th class="num">Base</th><th class="num">Per item</th>
                <th class="num">Free over</th><th>Delivery</th><th class="num">Countries</th>
                <th>Catch-all</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${data.zones
                .map(
                  (z) => `
                <tr data-zone="${z.id}">
                  <td class="cell-strong">${escapeHtml(z.name)}${
                    z.active ? '' : ' <span class="cell-muted">(off)</span>'
                  }</td>
                  <td class="num">${escapeHtml(money(z.flat_cents, 'cad'))}</td>
                  <td class="num">${z.per_item_cents ? escapeHtml(money(z.per_item_cents, 'cad')) : '—'}</td>
                  <td class="num">${z.free_over_cents ? escapeHtml(money(z.free_over_cents, 'cad')) : '—'}</td>
                  <td class="cell-muted">${z.delivery_min_days}–${z.delivery_max_days} days</td>
                  <td class="num">${z.countries.length}</td>
                  <td>${
                    z.is_default
                      ? '<span class="status-badge is-paid">Catch-all</span>'
                      : '<button type="button" class="mini-button" data-make-default>Make catch-all</button>'
                  }</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit>Edit</button>
                      ${
                        z.is_default
                          ? ''
                          : '<button type="button" class="mini-button danger" data-delete>Delete</button>'
                      }
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.zones);
    }

    function zoneForm(zone) {
      const isNew = !zone;
      const z = zone || {
        name: '', flat_cents: 0, per_item_cents: 0, free_over_cents: 0,
        delivery_min_days: 14, delivery_max_days: 21, active: 1, sort_order: 0, countries: [],
      };
      const chosen = new Set(z.countries || []);

      const modal = openModal(
        isNew ? 'New shipping zone' : `Edit ${z.name}`,
        `<form data-zone-form>
          <label>Zone name <input name="name" value="${escapeHtml(z.name)}" required maxlength="120"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Base fee <input name="flat" type="number" step="0.01" min="0" value="${dollars(
              z.flat_cents
            )}"></label>
            <label>Per item <input name="perItem" type="number" step="0.01" min="0" value="${dollars(
              z.per_item_cents
            )}"></label>
          </div>
          <label>Free over <span class="cell-muted">(0 = never free)</span>
            <input name="freeOver" type="number" step="0.01" min="0" value="${dollars(z.free_over_cents)}">
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Delivery from (days) <input name="minDays" type="number" min="0" value="${
              z.delivery_min_days
            }"></label>
            <label>Delivery to (days) <input name="maxDays" type="number" min="0" value="${
              z.delivery_max_days
            }"></label>
          </div>
          <label>Order <input name="sortOrder" type="number" value="${z.sort_order}"></label>

          <p class="cell-muted">Countries in this zone. A country can only be in one zone &mdash; ticking it here removes it from any other.</p>
          <div class="zone-countries">
            ${allCountries
              .map(
                (c) => `<label><input type="checkbox" name="country" value="${escapeHtml(c.code)}"${
                  chosen.has(c.code) ? ' checked' : ''
                }> ${escapeHtml(c.name)}</label>`
              )
              .join('')}
          </div>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            z.active ? 'checked' : ''
          }> Zone is in use</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save zone</button>'
      );

      const form = modal.querySelector('[data-zone-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error('Give the zone a name.');

          const body = {
            name: v.name,
            flatCents: centsFromInput(v.flat),
            perItemCents: centsFromInput(v.perItem),
            freeOverCents: centsFromInput(v.freeOver),
            deliveryMinDays: Number(v.minDays) || 0,
            deliveryMaxDays: Number(v.maxDays) || 0,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
            countries: Array.from(form.querySelectorAll('[name="country"]:checked')).map((c) => c.value),
          };

          if (isNew) await api('/api/admin/shipping', { method: 'POST', body });
          else await api(`/api/admin/shipping/${z.id}`, { method: 'PATCH', body });

          toast(isNew ? 'Zone created.' : 'Zone updated.');
          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-zone]')?.addEventListener('click', () => zoneForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-zone]');
      if (!row) return;
      const zones = JSON.parse(host.dataset.cache || '[]');
      const zone = zones.find((x) => String(x.id) === row.dataset.zone);
      if (!zone) return;

      if (event.target.closest('[data-edit]')) zoneForm(zone);

      if (event.target.closest('[data-make-default]')) {
        guard(async () => {
          await api(`/api/admin/shipping/${zone.id}/default`, { method: 'PATCH' });
          toast(`${zone.name} is now the catch-all.`);
          await load();
        });
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete this zone?',
          `<div class="modal-body"><p>${escapeHtml(
            zone.name
          )} will be removed and its ${zone.countries.length} countries will fall to the catch-all zone.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm-delete>Delete</button>'
        );
        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/shipping/${zone.id}`, { method: 'DELETE' });
            closeModal();
            toast('Zone deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Contact messages
     ======================================================================== */
  async function initMessages() {
    const host = document.querySelector('[data-messages]');
    const search = document.querySelector('[data-message-search]');
    let timer = null;

    async function load() {
      const term = (search?.value || '').trim();
      host.innerHTML = '<div class="admin-loading">Loading messages...</div>';

      const data = await api(`/api/admin/messages${term ? `?search=${encodeURIComponent(term)}` : ''}`);

      if (!data.messages.length) {
        host.innerHTML = `<div class="admin-empty">${
          term ? 'Nothing matches that search.' : 'No messages yet.'
        }</div>`;
        return;
      }

      host.innerHTML = data.messages
        .map((m) => {
          const name = [m.firstName, m.lastName].filter(Boolean).join(' ');
          return `
          <article class="message-card" data-message="${m.id}">
            <header>
              <div>
                <div class="cell-strong">${escapeHtml(name || 'No name given')}</div>
                <a class="message-email" href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent(
                  'Re: your message to Lebanon Hockey'
                )}">${escapeHtml(m.email)}</a>
              </div>
              <div class="message-meta">
                <span class="cell-muted">${escapeHtml(formatDate(m.createdAt))}</span>
                <button type="button" class="mini-button danger" data-delete-message>Delete</button>
              </div>
            </header>
            <p>${escapeHtml(m.message || '(no message)')}</p>
          </article>`;
        })
        .join('');

      host.dataset.cache = JSON.stringify(data.messages);
    }

    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => guard(load), 250);
    });

    host.addEventListener('click', (event) => {
      const card = event.target.closest('[data-message]');
      if (!card || !event.target.closest('[data-delete-message]')) return;

      const messages = JSON.parse(host.dataset.cache || '[]');
      const message = messages.find((m) => String(m.id) === card.dataset.message);
      if (!message) return;

      const modal = openModal(
        'Delete this message?',
        `<div class="modal-body">
           <p>The message from ${escapeHtml(message.email)} will be removed permanently.</p>
           <p class="cell-muted">Make sure you have replied or copied anything you need first.</p>
         </div>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
      );

      modal.querySelector('[data-confirm]').addEventListener('click', () =>
        guard(async () => {
          await api(`/api/admin/messages/${message.id}`, { method: 'DELETE' });
          closeModal();
          toast('Message deleted.');
          await load();
        })
      );
    });

    await load();
  }

  /* ========================================================================
     Sponsors
     ======================================================================== */
  async function initSponsors() {
    const host = document.querySelector('[data-sponsors-admin]');
    let tiers = {};
    let tierOrder = [];

    const assetSrc = (url) => `/${String(url || '').replace(/^\.\//, '')}`;

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading sponsors...</div>';
      const data = await api('/api/admin/sponsors');
      tiers = data.tiers;
      tierOrder = data.tierOrder;

      if (!data.sponsors.length) {
        host.innerHTML = '<div class="admin-empty">No sponsors yet. Use Add sponsor above.</div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th></th><th>Sponsor</th><th>Tier</th><th>Website</th><th>Shown</th><th></th></tr>
            </thead>
            <tbody>
              ${data.sponsors
                .map(
                  (s) => `
                <tr data-sponsor="${s.id}">
                  <td>${
                    s.logoUrl
                      ? `<img class="sponsor-thumb" src="${escapeHtml(assetSrc(s.logoUrl))}" alt="">`
                      : '<span class="sponsor-thumb is-placeholder">&ndash;</span>'
                  }</td>
                  <td>
                    <div class="cell-strong">${escapeHtml(s.name)}</div>
                    ${s.blurb ? `<div class="cell-muted">${escapeHtml(s.blurb)}</div>` : ''}
                  </td>
                  <td><span class="tier ${escapeHtml(s.tier)}">${escapeHtml(s.tierLabel)}</span></td>
                  <td class="cell-muted">${
                    s.websiteUrl
                      ? `<a href="${escapeHtml(s.websiteUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                          s.websiteUrl.replace(/^https?:\/\//, '')
                        )}</a>`
                      : '-'
                  }</td>
                  <td>${
                    s.active
                      ? '<span class="status-badge is-paid">Shown</span>'
                      : '<span class="status-badge is-cancelled">Hidden</span>'
                  }</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-sponsor>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-sponsor>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.sponsors);
    }

    function sponsorForm(sponsor) {
      const isNew = !sponsor;
      const s = sponsor || {
        name: '', tier: 'bronze', blurb: '', websiteUrl: '', logoUrl: '', logoAlt: '',
        active: true, sortOrder: 0,
      };

      const modal = openModal(
        isNew ? 'Add sponsor' : `Edit ${s.name}`,
        `<form data-sponsor-form>
          <label>Name <input name="name" value="${escapeHtml(s.name)}" required maxlength="160"></label>

          <label>Tier
            <select name="tier">
              ${tierOrder
                .map(
                  (key) =>
                    `<option value="${escapeHtml(key)}"${
                      s.tier === key ? ' selected' : ''
                    }>${escapeHtml(tiers[key] || key)}</option>`
                )
                .join('')}
            </select>
          </label>
          <p class="cell-muted">Tier decides the order on the public page: Platinum first, then Gold, Silver, Bronze.</p>

          <label>Description <textarea name="blurb" rows="3" maxlength="600">${escapeHtml(
            s.blurb
          )}</textarea></label>

          <label>Website <input name="websiteUrl" value="${escapeHtml(
            s.websiteUrl
          )}" maxlength="400" placeholder="example.com"></label>

          <label>Logo <input type="file" accept="image/jpeg,image/png,image/webp" data-logo-input></label>
          <p class="cell-muted">JPEG, PNG or WebP, up to 4MB. Shown at up to 160&times;64.</p>
          <div data-logo-preview>${
            s.logoUrl
              ? `<img src="${escapeHtml(
                  assetSrc(s.logoUrl)
                )}" alt="" style="max-width:160px;border-radius:6px;margin:6px 0">`
              : ''
          }</div>
          <input type="hidden" name="logoUrl" value="${escapeHtml(s.logoUrl)}">
          <label>Logo description <span class="cell-muted">(for screen readers)</span>
            <input name="logoAlt" value="${escapeHtml(s.logoAlt)}" maxlength="240">
          </label>

          <label>Order within the tier <input name="sortOrder" type="number" value="${s.sortOrder}"></label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            s.active ? 'checked' : ''
          }> Shown on the public site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save sponsor</button>'
      );

      const form = modal.querySelector('[data-sponsor-form]');
      const fileInput = modal.querySelector('[data-logo-input]');
      const preview = modal.querySelector('[data-logo-preview]');

      fileInput?.addEventListener('change', () =>
        guard(async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          preview.innerHTML = '<p class="cell-muted">Uploading...</p>';
          const result = await api('/api/admin/uploads', {
            method: 'POST',
            rawBody: file,
            contentType: 'application/octet-stream',
          });

          form.logoUrl.value = result.url;
          preview.innerHTML = `<img src="${escapeHtml(
            assetSrc(result.url)
          )}" alt="" style="max-width:160px;border-radius:6px;margin:6px 0">`;
          toast('Logo uploaded.');
        })
      );

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error('Give the sponsor a name.');

          const body = {
            name: v.name,
            tier: v.tier,
            blurb: v.blurb,
            websiteUrl: v.websiteUrl,
            logoUrl: v.logoUrl,
            logoAlt: v.logoAlt,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/sponsors', { method: 'POST', body });
          else await api(`/api/admin/sponsors/${s.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Sponsor added.' : 'Sponsor updated.');
          await load();
        })
      );
    }

    document.querySelector('[data-new-sponsor]')?.addEventListener('click', () => sponsorForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-sponsor]');
      if (!row) return;
      const sponsors = JSON.parse(host.dataset.cache || '[]');
      const sponsor = sponsors.find((s) => String(s.id) === row.dataset.sponsor);
      if (!sponsor) return;

      if (event.target.closest('[data-edit-sponsor]')) sponsorForm(sponsor);

      if (event.target.closest('[data-delete-sponsor]')) {
        const modal = openModal(
          'Delete this sponsor?',
          `<div class="modal-body">
             <p>${escapeHtml(sponsor.name)} will be removed from the public page.</p>
             <p class="cell-muted">To take them off the site temporarily, edit the sponsor and untick "Shown on the public site" instead.</p>
           </div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/sponsors/${sponsor.id}`, { method: 'DELETE' });
            closeModal();
            toast('Sponsor deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Programs and schedule
     ======================================================================== */
  async function initPrograms() {
    const host = document.querySelector('[data-programs-admin]');
    let kinds = {};
    let teams = [];

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading schedule...</div>';
      const data = await api('/api/admin/programs');
      kinds = data.kinds;
      teams = data.teams;

      if (!data.programs.length) {
        host.innerHTML = '<div class="admin-empty">Nothing scheduled yet. Use Add entry above.</div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>Date</th><th>Title</th><th>Type</th><th>Team</th><th>Where</th><th>Shown</th><th></th></tr>
            </thead>
            <tbody>
              ${data.programs
                .map(
                  (p) => `
                <tr data-program="${p.id}">
                  <td class="cell-muted">${escapeHtml(
                    p.startsAt
                      ? formatDate(p.startsAt) +
                          (p.endsAt && p.endsAt !== p.startsAt ? ` - ${formatDate(p.endsAt)}` : '')
                      : 'To be announced'
                  )}</td>
                  <td class="cell-strong">${escapeHtml(p.title)}</td>
                  <td>${escapeHtml(p.kindLabel)}</td>
                  <td class="cell-muted">${escapeHtml(p.teamName || '-')}</td>
                  <td class="cell-muted">${escapeHtml(p.location || '-')}</td>
                  <td>${
                    p.active
                      ? '<span class="status-badge is-paid">Shown</span>'
                      : '<span class="status-badge is-cancelled">Hidden</span>'
                  }</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-program>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-program>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.programs);
    }

    function programForm(entry) {
      const isNew = !entry;
      const p = entry || {
        title: '', kind: 'program', startsAt: '', endsAt: '', location: '',
        description: '', linkUrl: '', linkLabel: '', teamId: null, active: true, sortOrder: 0,
      };

      const modal = openModal(
        isNew ? 'Add to the schedule' : `Edit ${p.title}`,
        `<form data-program-form>
          <label>Title <input name="title" value="${escapeHtml(p.title)}" required maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Type
              <select name="kind">
                ${Object.entries(kinds)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        p.kind === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Team <span class="cell-muted">(optional)</span>
              <select name="teamId">
                <option value="">No team</option>
                ${teams
                  .map(
                    (t) =>
                      `<option value="${t.id}"${
                        String(t.id) === String(p.teamId) ? ' selected' : ''
                      }>${escapeHtml(t.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Starts <input name="startsAt" type="date" value="${escapeHtml(
              String(p.startsAt || '').slice(0, 10)
            )}"></label>
            <label>Ends <span class="cell-muted">(optional)</span>
              <input name="endsAt" type="date" value="${escapeHtml(String(p.endsAt || '').slice(0, 10))}">
            </label>
          </div>
          <p class="cell-muted">Leave the start date blank for something that is announced but not yet dated. It will appear below the dated entries.</p>

          <label>Where <input name="location" value="${escapeHtml(
            p.location
          )}" maxlength="240"></label>

          <label>Description <textarea name="description" rows="4" maxlength="4000">${escapeHtml(
            p.description
          )}</textarea></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Link <span class="cell-muted">(optional)</span>
              <input name="linkUrl" value="${escapeHtml(
                p.linkUrl
              )}" maxlength="400" placeholder="/teams/youth">
            </label>
            <label>Link text <input name="linkLabel" value="${escapeHtml(
              p.linkLabel
            )}" maxlength="80" placeholder="More details"></label>
          </div>

          <label>Order <span class="cell-muted">(only matters between entries sharing a date)</span>
            <input name="sortOrder" type="number" value="${p.sortOrder}">
          </label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Shown on the public events page</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
      );

      const form = modal.querySelector('[data-program-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.title || '').trim()) throw new Error('Give it a title.');
          if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
            throw new Error('The end date is before the start date.');
          }

          const body = {
            title: v.title,
            kind: v.kind,
            startsAt: v.startsAt,
            endsAt: v.endsAt,
            location: v.location,
            description: v.description,
            linkUrl: v.linkUrl,
            linkLabel: v.linkLabel,
            teamId: v.teamId === '' ? null : Number(v.teamId),
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/programs', { method: 'POST', body });
          else await api(`/api/admin/programs/${p.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Added to the schedule.' : 'Updated.');
          await load();
        })
      );
    }

    document.querySelector('[data-new-program]')?.addEventListener('click', () => programForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-program]');
      if (!row) return;
      const programs = JSON.parse(host.dataset.cache || '[]');
      const entry = programs.find((p) => String(p.id) === row.dataset.program);
      if (!entry) return;

      if (event.target.closest('[data-edit-program]')) programForm(entry);

      if (event.target.closest('[data-delete-program]')) {
        const modal = openModal(
          'Delete this entry?',
          `<div class="modal-body"><p>${escapeHtml(
            entry.title
          )} will be removed from the schedule.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/programs/${entry.id}`, { method: 'DELETE' });
            closeModal();
            toast('Removed from the schedule.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Teams and players
     ======================================================================== */
  async function initTeams() {
    const filter = document.querySelector('[data-team-filter]');
    const detailHost = document.querySelector('[data-team-detail]');
    const playersHost = document.querySelector('[data-team-players]');

    let teams = [];
    let squads = {};
    let positions = [];
    let current = null;
    let players = [];

    const initials = (name) =>
      String(name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');

    /* Uploaded paths are stored as "./uploads/x.jpg" so the public pages can use
       them relatively; the admin is one directory down, so it needs them rooted. */
    const assetSrc = (url) => `/${String(url || '').replace(/^\.\//, '')}`;

    function photoField(label, urlValue, altValue, hint) {
      return `<label>${label}
          <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input>
        </label>
        <p class="cell-muted">${escapeHtml(hint)}</p>
        <div data-photo-preview>${
          urlValue
            ? `<img src="${escapeHtml(assetSrc(urlValue))}" alt="" style="max-width:200px;border-radius:8px;margin:6px 0">`
            : ''
        }</div>
        <input type="hidden" name="photoUrl" value="${escapeHtml(urlValue || '')}">
        <label>Photo description <span class="cell-muted">(for screen readers)</span>
          <input name="photoAlt" value="${escapeHtml(altValue || '')}" maxlength="240">
        </label>`;
    }

    /* Shared by both editors: the upload is identical, only the field differs. */
    function wirePhotoUpload(modal, form) {
      const input = modal.querySelector('[data-photo-input]');
      const preview = modal.querySelector('[data-photo-preview]');
      if (!input) return;

      input.addEventListener('change', () =>
        guard(async () => {
          const file = input.files && input.files[0];
          if (!file) return;

          preview.innerHTML = '<p class="cell-muted">Uploading...</p>';
          /* Raw bytes, not base64: express.json() ignores octet-stream, so this
             bypasses the global 256kb limit and is capped by its own route. */
          const result = await api('/api/admin/uploads', {
            method: 'POST',
            rawBody: file,
            contentType: 'application/octet-stream',
          });

          form.photoUrl.value = result.url;
          preview.innerHTML = `<img src="${escapeHtml(
            assetSrc(result.url)
          )}" alt="" style="max-width:200px;border-radius:8px;margin:6px 0">`;
          toast('Photo uploaded.');
        })
      );
    }

    async function loadTeams(preferId) {
      const data = await api('/api/admin/teams');
      teams = data.teams;
      squads = data.squads || {};
      positions = data.positions || [];

      const keep = preferId || (current && current.id) || (teams[0] && teams[0].id);
      filter.innerHTML = teams
        .map(
          (t) =>
            `<option value="${t.id}"${String(t.id) === String(keep) ? ' selected' : ''}>${escapeHtml(
              t.name
            )} (${t.playerCount})${t.active ? '' : ' - hidden'}</option>`
        )
        .join('');

      await loadTeam(keep);
    }

    async function loadTeam(id) {
      if (!id) {
        detailHost.innerHTML = '<div class="admin-empty">No teams yet.</div>';
        playersHost.innerHTML = '';
        return;
      }

      playersHost.innerHTML = '<div class="admin-loading">Loading players...</div>';
      const data = await api(`/api/admin/teams/${id}/players`);
      current = data.team;
      players = data.players;

      renderDetail();
      renderPlayers();
    }

    function renderDetail() {
      const t = current;
      detailHost.innerHTML = `
        <div class="team-detail">
          ${
            t.photoUrl
              ? `<img class="team-detail-photo" src="${escapeHtml(assetSrc(t.photoUrl))}" alt="">`
              : '<span class="team-detail-photo is-placeholder">No team photo</span>'
          }
          <div>
            <h2>${escapeHtml(t.name)}${
              t.active ? '' : ' <span class="cell-muted">(hidden)</span>'
            }</h2>
            ${t.tagline ? `<p class="cell-muted">${escapeHtml(t.tagline)}</p>` : ''}
            ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
            <p class="cell-muted">Public page: <a href="/teams/${escapeHtml(
              t.slug
            )}" target="_blank" rel="noopener">/teams/${escapeHtml(t.slug)}</a></p>
            <div class="actions">
              <button type="button" class="mini-button" data-edit-team>Edit team</button>
              <button type="button" class="mini-button danger" data-delete-team>Delete team</button>
            </div>
          </div>
        </div>`;
    }

    function renderPlayers() {
      if (!players.length) {
        playersHost.innerHTML =
          '<div class="admin-empty">No players on this team yet. Use Add player above.</div>';
        return;
      }

      playersHost.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th></th><th>Name</th><th>Squad</th><th>Position</th>
                <th class="num">#</th><th>Most recent team</th><th>Shown</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${players
                .map(
                  (p) => `
                <tr data-player="${p.id}">
                  <td>${
                    p.photoUrl
                      ? `<img class="player-thumb" src="${escapeHtml(assetSrc(p.photoUrl))}" alt="">`
                      : `<span class="player-thumb is-placeholder">${escapeHtml(initials(p.name))}</span>`
                  }</td>
                  <td class="cell-strong">${escapeHtml(p.name)}</td>
                  <td class="cell-muted">${escapeHtml(p.squadLabel || '-')}</td>
                  <td>${escapeHtml(p.positionLabel)}</td>
                  <td class="num">${p.jerseyNumber ? escapeHtml(String(p.jerseyNumber)) : '-'}</td>
                  <td class="cell-muted">${escapeHtml(p.recentTeam || '-')}</td>
                  <td>${
                    p.active
                      ? '<span class="status-badge is-paid">Shown</span>'
                      : '<span class="status-badge is-cancelled">Hidden</span>'
                  }</td>
                  <td>
                    <div class="actions">
                      <a class="mini-button" href="/players/${escapeHtml(
                        p.slug
                      )}" target="_blank" rel="noopener">View</a>
                      <button type="button" class="mini-button" data-edit-player>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-player>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    /* --- Team editor ------------------------------------------------------ */
    function teamForm() {
      const t = current;
      const modal = openModal(
        `Edit ${t.name}`,
        `<form data-team-form>
          <label>Team name <input name="name" value="${escapeHtml(t.name)}" required maxlength="160"></label>
          <label>Tagline <input name="tagline" value="${escapeHtml(t.tagline)}" maxlength="200"></label>
          <label>Description <textarea name="description" rows="5" maxlength="4000">${escapeHtml(
            t.description
          )}</textarea></label>
          <label>Page address <span class="cell-muted">(changing this breaks shared links)</span>
            <input name="slug" value="${escapeHtml(t.slug)}" maxlength="80">
          </label>
          ${photoField('Team photo', t.photoUrl, t.photoAlt, 'JPEG, PNG or WebP, up to 4MB.')}
          <label>Order <input name="sortOrder" type="number" value="${t.sortOrder}"></label>
          <label class="checkbox-row"><input type="checkbox" name="active" ${
            t.active ? 'checked' : ''
          }> Shown on the public site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save team</button>'
      );

      const form = modal.querySelector('[data-team-form]');
      wirePhotoUpload(modal, form);

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error('Give the team a name.');

          await api(`/api/admin/teams/${t.id}`, {
            method: 'PATCH',
            body: {
              name: v.name,
              tagline: v.tagline,
              description: v.description,
              slug: v.slug,
              photoUrl: v.photoUrl,
              photoAlt: v.photoAlt,
              sortOrder: Number(v.sortOrder) || 0,
              active: Boolean(v.active),
            },
          });

          closeModal();
          toast('Team updated.');
          await loadTeams(t.id);
        })
      );
    }

    /* --- Player editor ---------------------------------------------------- */
    function playerForm(player) {
      const isNew = !player;
      const p = player || {
        name: '', squad: '', position: 'forward', jerseyNumber: '', photoUrl: '', photoAlt: '',
        bio: '', recentTeam: '', resides: '', hometown: '', active: true, sortOrder: players.length,
        teamId: current.id, slug: '',
      };

      const modal = openModal(
        isNew ? 'Add player' : `Edit ${p.name}`,
        `<form data-player-form>
          <label>Full name <input name="name" value="${escapeHtml(p.name)}" required maxlength="160"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Team
              <select name="teamId">
                ${teams
                  .map(
                    (t) =>
                      `<option value="${t.id}"${
                        String(t.id) === String(p.teamId) ? ' selected' : ''
                      }>${escapeHtml(t.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Squad
              <select name="squad">
                <option value=""${p.squad ? '' : ' selected'}>No squad</option>
                ${Object.entries(squads)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        p.squad === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Position
              <select name="position">
                ${positions
                  .map(
                    (value) =>
                      `<option value="${escapeHtml(value)}"${
                        p.position === value ? ' selected' : ''
                      }>${escapeHtml(value.charAt(0).toUpperCase() + value.slice(1))}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Jersey number <input name="number" type="number" min="0" max="99" value="${escapeHtml(
              p.jerseyNumber == null ? '' : String(p.jerseyNumber)
            )}"></label>
          </div>

          ${photoField('Player photo', p.photoUrl, p.photoAlt, 'JPEG, PNG or WebP, up to 4MB. Portrait orientation works best.')}

          <label>Most recent team <input name="recentTeam" value="${escapeHtml(
            p.recentTeam
          )}" maxlength="200"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Resides <input name="resides" value="${escapeHtml(p.resides)}" maxlength="120"></label>
            <label>Hometown <input name="hometown" value="${escapeHtml(p.hometown)}" maxlength="120"></label>
          </div>

          <label>Biography <textarea name="bio" rows="5" maxlength="4000">${escapeHtml(
            p.bio
          )}</textarea></label>

          <label>Order <input name="sortOrder" type="number" value="${p.sortOrder}"></label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Shown on the public site</label>
          <p class="cell-muted">Unticking this removes the player from the team page and from their own profile, everywhere, without deleting the record.</p>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save player</button>'
      );

      const form = modal.querySelector('[data-player-form]');
      wirePhotoUpload(modal, form);

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error("Enter the player's name.");

          const body = {
            teamId: Number(v.teamId),
            name: v.name,
            squad: v.squad,
            position: v.position,
            number: v.number === '' ? null : Number(v.number),
            photoUrl: v.photoUrl,
            photoAlt: v.photoAlt,
            bio: v.bio,
            recentTeam: v.recentTeam,
            resides: v.resides,
            hometown: v.hometown,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/players', { method: 'POST', body });
          else await api(`/api/admin/players/${p.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Player added.' : 'Player updated.');
          await loadTeams(Number(v.teamId));
        })
      );
    }

    /* --- Wiring ----------------------------------------------------------- */
    filter.addEventListener('change', () => guard(() => loadTeam(filter.value)));

    document
      .querySelector('[data-new-team-player]')
      ?.addEventListener('click', () => playerForm(null));

    detailHost.addEventListener('click', (event) => {
      if (event.target.closest('[data-edit-team]')) teamForm();

      if (event.target.closest('[data-delete-team]')) {
        const modal = openModal(
          'Delete this team?',
          `<div class="modal-body"><p>${escapeHtml(
            current.name
          )} will be removed. A team that still has players cannot be deleted - hide it instead.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/teams/${current.id}`, { method: 'DELETE' });
            closeModal();
            toast('Team deleted.');
            current = null;
            await loadTeams();
          })
        );
      }
    });

    playersHost.addEventListener('click', (event) => {
      const row = event.target.closest('[data-player]');
      if (!row) return;
      const player = players.find((x) => String(x.id) === row.dataset.player);
      if (!player) return;

      if (event.target.closest('[data-edit-player]')) playerForm(player);

      if (event.target.closest('[data-delete-player]')) {
        const modal = openModal(
          'Delete this player?',
          `<div class="modal-body">
             <p>${escapeHtml(player.name)} will be removed completely, including their profile page.</p>
             <p class="cell-muted">To take a name off the site but keep the record, edit the player and untick "Shown on the public site" instead.</p>
           </div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/players/${player.id}`, { method: 'DELETE' });
            closeModal();
            toast('Player deleted.');
            await loadTeams(current.id);
          })
        );
      }
    });

    await loadTeams();
  }

  /* ========================================================================
     Game sheets
     ======================================================================== */
  async function initGames() {
    const listHost = document.querySelector('[data-games-list]');
    const sheetHost = document.querySelector('[data-game-sheet]');

    let teams = [];
    let roles = {};
    let homeAway = {};
    let statuses = {};
    let openGameId = null;
    let sheet = [];
    let candidates = { players: [], registrations: [] };

    const dateLabel = (value) => (value ? formatDate(value) : 'Date not set');

    async function loadList() {
      listHost.innerHTML = '<div class="admin-loading">Loading games...</div>';
      const data = await api('/api/admin/games');
      teams = data.teams;
      roles = data.roles;
      homeAway = data.homeAway;
      statuses = data.statuses;

      if (!data.games.length) {
        listHost.innerHTML =
          '<div class="admin-empty">No games yet. Use New game to start a sheet.</div>';
        return;
      }

      listHost.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Date</th><th>Opponent</th><th>Team</th><th>Venue</th>
                <th class="num">Score</th><th class="num">Named</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${data.games
                .map(
                  (g) => `
                <tr data-game="${g.id}">
                  <td class="cell-muted">${escapeHtml(dateLabel(g.playedAt))}</td>
                  <td class="cell-strong">${escapeHtml(g.opponent)}<br>
                    <span class="cell-muted">${escapeHtml(g.homeAwayLabel)}${
                      g.competition ? ` &middot; ${escapeHtml(g.competition)}` : ''
                    }</span></td>
                  <td>${escapeHtml(g.teamName || '-')}</td>
                  <td class="cell-muted">${escapeHtml(g.venue || '-')}</td>
                  <td class="num">${
                    g.scoreFor === null || g.scoreAgainst === null
                      ? '-'
                      : `${escapeHtml(String(g.scoreFor))}&ndash;${escapeHtml(String(g.scoreAgainst))}`
                  }</td>
                  <td class="num">${g.lineCount}</td>
                  <td><span class="status-badge is-${
                    g.status === 'final' ? 'paid' : g.status === 'cancelled' ? 'cancelled' : 'pending'
                  }">${escapeHtml(g.statusLabel)}</span></td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button solid" data-open-sheet>Sheet</button>
                      <button type="button" class="mini-button" data-edit-game>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-game>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      listHost.dataset.cache = JSON.stringify(data.games);
    }

    /* --- The sheet itself -------------------------------------------------- */
    async function loadSheet(id) {
      openGameId = id;
      sheetHost.hidden = false;
      sheetHost.innerHTML = '<div class="admin-loading">Loading sheet...</div>';

      const data = await api(`/api/admin/games/${id}`);
      sheet = data.sheet;
      candidates = data.candidates;
      renderSheet(data.game);
      sheetHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderSheet(game) {
      const total = sheet.length;
      const linked = sheet.filter((l) => l.membership).length;

      sheetHost.innerHTML = `
        <div class="sheet-head">
          <div>
            <h2>${escapeHtml(game.opponent)} <span class="cell-muted">${escapeHtml(
              dateLabel(game.playedAt)
            )}</span></h2>
            <p class="cell-muted">
              ${escapeHtml(game.teamName || 'No team set')} &middot; ${escapeHtml(game.homeAwayLabel)}
              ${game.venue ? ` &middot; ${escapeHtml(game.venue)}` : ''}
            </p>
            <p class="cell-muted">${escapeHtml(String(total))} named, ${escapeHtml(
              String(linked)
            )} linked to a membership record.</p>
          </div>
          <div class="actions">
            <button type="button" class="mini-button" data-fill-roster>Add whole roster</button>
            <button type="button" class="mini-button solid" data-add-line>Add person</button>
            <button type="button" class="mini-button" data-close-sheet>Close</button>
          </div>
        </div>

        ${
          total
            ? `<div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th class="num">#</th><th>Name</th><th>Position</th><th>Role</th>
                <th>Membership</th><th>Note</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${sheet
                .map(
                  (l) => `
                <tr data-line="${l.id}">
                  <td class="num">${l.jerseyNumber == null ? '-' : escapeHtml(String(l.jerseyNumber))}</td>
                  <td class="cell-strong">${escapeHtml(l.name || 'Unnamed')}</td>
                  <td class="cell-muted">${escapeHtml(l.position || '-')}</td>
                  <td>${escapeHtml(l.roleLabel)}</td>
                  <td class="cell-muted">${
                    l.membership
                      ? `${escapeHtml(l.membership.email)}${
                          l.membership.dateOfBirth
                            ? `<br>born ${escapeHtml(l.membership.dateOfBirth)}`
                            : ''
                        }`
                      : '<span class="cell-muted">Not linked</span>'
                  }</td>
                  <td class="cell-muted">${escapeHtml(l.note || '')}</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-line>Edit</button>
                      <button type="button" class="mini-button danger" data-remove-line>Remove</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
            : '<div class="admin-empty">Nobody on this sheet yet.</div>'
        }`;
    }

    /* --- Game editor ------------------------------------------------------- */
    function gameForm(game) {
      const isNew = !game;
      const g = game || {
        opponent: '', playedAt: '', venue: '', competition: '', homeAway: 'home',
        scoreFor: null, scoreAgainst: null, status: 'draft', notes: '', teamId: null,
      };

      const modal = openModal(
        isNew ? 'New game' : `Edit ${g.opponent}`,
        `<form data-game-form>
          <label>Opponent <input name="opponent" value="${escapeHtml(
            g.opponent
          )}" required maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Date <input name="playedAt" type="date" value="${escapeHtml(
              String(g.playedAt || '').slice(0, 10)
            )}"></label>
            <label>Team
              <select name="teamId">
                <option value="">No team</option>
                ${teams
                  .map(
                    (t) =>
                      `<option value="${t.id}"${
                        String(t.id) === String(g.teamId) ? ' selected' : ''
                      }>${escapeHtml(t.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <label>Venue <input name="venue" value="${escapeHtml(g.venue)}" maxlength="200"></label>
          <label>Competition <input name="competition" value="${escapeHtml(
            g.competition
          )}" maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <label>Home or away
              <select name="homeAway">
                ${Object.entries(homeAway)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        g.homeAway === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Goals for <input name="scoreFor" type="number" min="0" value="${
              g.scoreFor == null ? '' : escapeHtml(String(g.scoreFor))
            }"></label>
            <label>Goals against <input name="scoreAgainst" type="number" min="0" value="${
              g.scoreAgainst == null ? '' : escapeHtml(String(g.scoreAgainst))
            }"></label>
          </div>

          <label>Status
            <select name="status">
              ${Object.entries(statuses)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}"${
                      g.status === key ? ' selected' : ''
                    }>${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Notes <textarea name="notes" rows="4" maxlength="4000">${escapeHtml(
            g.notes
          )}</textarea></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save game</button>'
      );

      const form = modal.querySelector('[data-game-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.opponent || '').trim()) throw new Error('Name the opponent.');

          const body = {
            opponent: v.opponent,
            playedAt: v.playedAt,
            venue: v.venue,
            competition: v.competition,
            homeAway: v.homeAway,
            scoreFor: v.scoreFor === '' ? null : Number(v.scoreFor),
            scoreAgainst: v.scoreAgainst === '' ? null : Number(v.scoreAgainst),
            status: v.status,
            notes: v.notes,
            teamId: v.teamId === '' ? null : Number(v.teamId),
          };

          if (isNew) await api('/api/admin/games', { method: 'POST', body });
          else await api(`/api/admin/games/${g.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Game created.' : 'Game updated.');
          await loadList();
          if (!isNew && openGameId === g.id) await loadSheet(g.id);
        })
      );
    }

    /* --- Adding somebody to a sheet ---------------------------------------- */
    function addLineForm() {
      const modal = openModal(
        'Add to the sheet',
        `<form data-line-form>
          <label>From the roster
            <select name="playerId" data-player-pick>
              <option value="">Not from the roster</option>
              ${candidates.players
                .map(
                  (p) =>
                    `<option value="${p.id}" data-number="${
                      p.jerseyNumber == null ? '' : p.jerseyNumber
                    }" data-position="${escapeHtml(p.position || '')}">${escapeHtml(p.name)}${
                      p.jerseyNumber == null ? '' : ` (#${p.jerseyNumber})`
                    }</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Membership record <span class="cell-muted">(paid members only)</span>
            <select name="registrationId" data-member-pick>
              <option value="">Not linked</option>
              ${candidates.registrations
                .map(
                  (r) =>
                    `<option value="${r.id}" data-position="${escapeHtml(
                      r.position || ''
                    )}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.name)} &mdash; ${escapeHtml(
                      r.email
                    )}</option>`
                )
                .join('')}
            </select>
          </label>

          <p class="cell-muted">Linking both is normal: the roster gives the name and number, the membership record carries the paperwork. Someone who is on neither can still be typed in below.</p>

          <label>Name on the sheet <span class="cell-muted">(leave blank to use the linked record)</span>
            <input name="name" maxlength="160">
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Number <input name="jerseyNumber" type="number" min="0" max="99"></label>
            <label>Position <input name="position" maxlength="40"></label>
          </div>

          <label>Role
            <select name="role">
              ${Object.entries(roles)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Note <input name="note" maxlength="400"></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Add</button>'
      );

      const form = modal.querySelector('[data-line-form]');

      /* Pre-fill from whichever record was picked, so the details the system
         already holds are never retyped. */
      form.querySelector('[data-player-pick]').addEventListener('change', (event) => {
        const option = event.target.selectedOptions[0];
        if (!option || !option.value) return;
        if (!form.jerseyNumber.value) form.jerseyNumber.value = option.dataset.number || '';
        if (!form.position.value) form.position.value = option.dataset.position || '';
      });

      form.querySelector('[data-member-pick]').addEventListener('change', (event) => {
        const option = event.target.selectedOptions[0];
        if (!option || !option.value) return;
        if (!form.position.value) form.position.value = option.dataset.position || '';
        if (!form.name.value && !form.playerId.value) form.name.value = option.dataset.name || '';
      });

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!v.playerId && !v.registrationId && !String(v.name || '').trim()) {
            throw new Error('Pick a player or a member, or type a name.');
          }

          await api(`/api/admin/games/${openGameId}/sheet`, {
            method: 'POST',
            body: {
              playerId: v.playerId === '' ? null : Number(v.playerId),
              registrationId: v.registrationId === '' ? null : Number(v.registrationId),
              name: v.name,
              jerseyNumber: v.jerseyNumber === '' ? null : Number(v.jerseyNumber),
              position: v.position,
              role: v.role,
              note: v.note,
            },
          });

          closeModal();
          toast('Added to the sheet.');
          await loadSheet(openGameId);
          await loadList();
        })
      );
    }

    function editLineForm(line) {
      const modal = openModal(
        `Edit ${line.name || 'line'}`,
        `<form data-line-edit>
          <label>Name on the sheet <input name="name" value="${escapeHtml(
            line.name
          )}" maxlength="160"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Number <input name="jerseyNumber" type="number" min="0" max="99" value="${
              line.jerseyNumber == null ? '' : escapeHtml(String(line.jerseyNumber))
            }"></label>
            <label>Position <input name="position" value="${escapeHtml(
              line.position
            )}" maxlength="40"></label>
          </div>
          <label>Role
            <select name="role">
              ${Object.entries(roles)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}"${
                      line.role === key ? ' selected' : ''
                    }>${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>Note <input name="note" value="${escapeHtml(line.note)}" maxlength="400"></label>
          <label>Order <input name="sortOrder" type="number" value="${line.sortOrder}"></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
      );

      const form = modal.querySelector('[data-line-edit]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          await api(`/api/admin/games/${openGameId}/sheet/${line.id}`, {
            method: 'PATCH',
            body: {
              name: v.name,
              jerseyNumber: v.jerseyNumber === '' ? null : Number(v.jerseyNumber),
              position: v.position,
              role: v.role,
              note: v.note,
              sortOrder: Number(v.sortOrder) || 0,
            },
          });

          closeModal();
          toast('Line updated.');
          await loadSheet(openGameId);
        })
      );
    }

    /* --- Wiring ------------------------------------------------------------ */
    document.querySelector('[data-new-game]')?.addEventListener('click', () => gameForm(null));

    listHost.addEventListener('click', (event) => {
      const row = event.target.closest('[data-game]');
      if (!row) return;
      const games = JSON.parse(listHost.dataset.cache || '[]');
      const game = games.find((g) => String(g.id) === row.dataset.game);
      if (!game) return;

      if (event.target.closest('[data-open-sheet]')) guard(() => loadSheet(game.id));
      if (event.target.closest('[data-edit-game]')) gameForm(game);

      if (event.target.closest('[data-delete-game]')) {
        const modal = openModal(
          'Delete this game?',
          `<div class="modal-body"><p>${escapeHtml(game.opponent)} and everyone named on its sheet will be removed.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/games/${game.id}`, { method: 'DELETE' });
            closeModal();
            toast('Game deleted.');
            if (openGameId === game.id) {
              sheetHost.hidden = true;
              openGameId = null;
            }
            await loadList();
          })
        );
      }
    });

    sheetHost.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-sheet]')) {
        sheetHost.hidden = true;
        openGameId = null;
        return;
      }

      if (event.target.closest('[data-add-line]')) {
        addLineForm();
        return;
      }

      if (event.target.closest('[data-fill-roster]')) {
        guard(async () => {
          const result = await api(`/api/admin/games/${openGameId}/sheet/fill`, { method: 'POST' });
          toast(
            result.added
              ? `Added ${result.added} player${result.added === 1 ? '' : 's'}.`
              : 'Everyone on the roster is already named.'
          );
          await loadSheet(openGameId);
          await loadList();
        });
        return;
      }

      const row = event.target.closest('[data-line]');
      if (!row) return;
      const line = sheet.find((l) => String(l.id) === row.dataset.line);
      if (!line) return;

      if (event.target.closest('[data-edit-line]')) editLineForm(line);

      if (event.target.closest('[data-remove-line]')) {
        guard(async () => {
          await api(`/api/admin/games/${openGameId}/sheet/${line.id}`, { method: 'DELETE' });
          toast('Removed from the sheet.');
          await loadSheet(openGameId);
          await loadList();
        });
      }
    });

    await loadList();
  }

  /* ========================================================================
     Roster
     ======================================================================== */
  async function initRoster() {
    const host = document.querySelector('[data-roster-admin]');
    const programSelect = document.querySelector('[data-roster-program]');

    const TEAMS = { national: 'National Team', next_gen: 'Next Generation' };
    const POSITIONS = { forward: 'Forward', defence: 'Defence', goaltender: 'Goaltender' };

    const program = () => programSelect?.value || 'womens';

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading roster...</div>';
      const data = await api(`/api/admin/roster?program=${encodeURIComponent(program())}`);

      if (!data.players.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No players yet</h3><p>Add players and they appear on this program&rsquo;s page straight away.</p></div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th class="num">#</th><th>Name</th><th>Team</th><th>Position</th><th>Most recent team</th><th>Shown</th><th></th></tr>
            </thead>
            <tbody>
              ${data.players
                .map(
                  (p) => `
                <tr data-player="${p.id}">
                  <td class="num">${p.number ?? '&mdash;'}</td>
                  <td class="cell-strong">${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(TEAMS[p.team] || p.team)}</td>
                  <td>${escapeHtml(POSITIONS[p.position] || p.position)}</td>
                  <td class="cell-muted">${escapeHtml(p.recentTeam || '—')}</td>
                  <td><button type="button" class="toggle-pill ${p.active ? 'on' : 'off'}" data-toggle-player>${
                    p.active ? 'Shown' : 'Hidden'
                  }</button></td>
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
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.players);
    }

    function playerForm(player) {
      const isNew = !player;
      const p = player || {
        program: program(), team: 'national', position: 'forward', number: '',
        name: '', recentTeam: '', resides: '', hometown: '', active: true, sortOrder: 0,
      };

      const options = (map, selected) =>
        Object.entries(map)
          .map(([k, v]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`)
          .join('');

      const modal = openModal(
        isNew ? 'Add player' : `Edit ${p.name}`,
        `<form data-player-form>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Program
              <select name="program">${options({ womens: "Women's", mens: "Men's" }, p.program)}</select>
            </label>
            <label>Team <select name="team">${options(TEAMS, p.team)}</select></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Position <select name="position">${options(POSITIONS, p.position)}</select></label>
            <label>Jersey number <span class="cell-muted">(blank for none)</span>
              <input name="number" type="number" min="0" max="99" value="${p.number ?? ''}">
            </label>
          </div>
          <label>Name <input name="name" value="${escapeHtml(p.name)}" required maxlength="160"></label>
          <label>Most recent team <input name="recentTeam" value="${escapeHtml(
            p.recentTeam
          )}" maxlength="200"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Resides <input name="resides" value="${escapeHtml(p.resides)}" maxlength="120"></label>
            <label>Hometown <input name="hometown" value="${escapeHtml(p.hometown)}" maxlength="120"></label>
          </div>
          <label>Order <input name="sortOrder" type="number" value="${p.sortOrder ?? 0}"></label>
          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Show on the public site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save player</button>'
      );

      const form = modal.querySelector('[data-player-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error("Enter the player's name.");

          const body = {
            program: v.program,
            team: v.team,
            position: v.position,
            number: v.number === '' ? null : Number(v.number),
            name: v.name,
            recentTeam: v.recentTeam,
            resides: v.resides,
            hometown: v.hometown,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/roster', { method: 'POST', body });
          else await api(`/api/admin/roster/${p.id}`, { method: 'PATCH', body });

          toast(isNew ? 'Player added.' : 'Player updated.');
          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-player]')?.addEventListener('click', () => playerForm(null));
    programSelect?.addEventListener('change', () => guard(load));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-player]');
      if (!row) return;
      const all = JSON.parse(host.dataset.cache || '[]');
      const p = all.find((x) => String(x.id) === row.dataset.player);
      if (!p) return;

      if (event.target.closest('[data-edit]')) playerForm(p);

      /* Hiding is the gentle option, and the one privacy.html promises a parent
         or guardian: the player leaves the public site, the record stays. */
      if (event.target.closest('[data-toggle-player]')) {
        guard(async () => {
          await api(`/api/admin/roster/${p.id}`, { method: 'PATCH', body: { active: !p.active } });
          await load();
        });
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Remove this player?',
          `<div class="modal-body"><p>${escapeHtml(
            p.name
          )} will be deleted outright. If you only want them off the public site, use <strong>Shown</strong> instead &mdash; that keeps the record.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm-delete>Delete</button>'
        );
        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/roster/${p.id}`, { method: 'DELETE' });
            closeModal();
            toast('Player removed.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Membership registrations
     ======================================================================== */
  async function initRegistrations() {
    const statsHost = document.querySelector('[data-registration-stats]');
    const host = document.querySelector('[data-registrations]');
    const search = document.querySelector('[data-registration-search]');
    let timer = null;

    /* The exports follow the search, so what downloads is what is on screen -
       an administrator who has filtered to one family should not get all 400
       records in the file. */
    function syncExportLinks() {
      const term = (search?.value || '').trim();
      const query = term ? `?search=${encodeURIComponent(term)}` : '';
      const xlsx = document.querySelector('[data-export-xlsx]');
      const csv = document.querySelector('[data-export-csv]');
      if (xlsx) xlsx.href = `/api/admin/registrations.xlsx${query}`;
      if (csv) csv.href = `/api/admin/registrations.csv${query}`;
    }

    async function load() {
      const term = (search?.value || '').trim();
      host.innerHTML = '<div class="admin-loading">Loading registrations...</div>';
      const data = await api(
        `/api/admin/registrations${term ? `?search=${encodeURIComponent(term)}` : ''}`
      );
      const t = data.totals;
      syncExportLinks();

      if (statsHost) {
        statsHost.innerHTML = [
          ['Registrations', String(t.count), 'All applications received'],
          ['Paid', String(t.paid), 'Fee received'],
          ['Awaiting payment', String(t.unpaid), 'Usually e-transfer'],
          ['Collected', money(t.collectedCents, data.currency), 'From paid memberships'],
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
      }

      if (!data.registrations.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No registrations yet</h3><p>Applications from the membership form will appear here.</p></div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>Name</th><th>Type</th><th class="num">Fee</th><th>Payment</th><th>Received</th><th></th></tr>
            </thead>
            <tbody>
              ${data.registrations
                .map(
                  (r) => `
                <tr data-registration="${r.id}">
                  <td>
                    <div class="cell-strong">${escapeHtml(
                      [r.firstName, r.lastName].filter(Boolean).join(' ')
                    )}</div>
                    <div class="cell-muted">${escapeHtml(r.email)}</div>
                  </td>
                  <td>${escapeHtml(r.tierLabel)}</td>
                  <td class="num">${escapeHtml(money(r.amountCents, r.currency))}</td>
                  <td>${statusBadge(r.paymentStatus)}</td>
                  <td class="cell-muted">${escapeHtml(formatDate(r.createdAt))}</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-view>Open</button>
                      ${
                        r.paymentStatus !== 'paid'
                          ? '<button type="button" class="mini-button solid" data-mark-paid>Mark paid</button>'
                          : ''
                      }
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.registrations);
    }

    /* The eligibility fields are only rendered when a record is deliberately
       opened, rather than sitting in the table where they would be on screen
       for anyone walking past. */
    function detail(r) {
      const row = (label, value) =>
        value ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>` : '';

      openModal(
        `${r.firstName} ${r.lastName}`.trim() || 'Registration',
        `<div class="modal-body">
          <table class="data reg-detail">
            <tbody>
              ${row('Membership', r.tierLabel)}
              ${row('Fee', money(r.amountCents, r.currency))}
              ${row('Payment', r.paymentStatus)}
              ${row('Email', r.email)}
              ${row('Phone', r.phone)}
              ${row('Full name', [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '))}
              ${row('City of residence', r.cityOfResidence)}
              ${row('Date of birth', r.dateOfBirth)}
              ${row('Position', r.position)}
              ${row('Shoots', r.shoots)}
              ${row('Height', r.heightCm ? `${r.heightCm} cm` : '')}
              ${row('Weight', r.weightKg ? `${r.weightKg} kg` : '')}
              ${row('Place of birth', r.placeOfBirth)}
              ${row('Country of birth', r.countryOfBirth)}
              ${row('Citizenship', r.citizenship)}
              ${row('Second citizenship', r.citizenshipSecond)}
              ${row("Father's citizenship", r.citizenshipFather)}
              ${row("Mother's citizenship", r.citizenshipMother)}
              ${row('Highest level played', r.highestLevelPlayed)}
              ${row('Message', r.message)}
              ${row('Received', formatDate(r.createdAt))}
            </tbody>
          </table>
        </div>`,
        '<button type="button" class="mini-button" data-modal-close>Close</button>'
      );
    }

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-registration]');
      if (!row) return;
      const all = JSON.parse(host.dataset.cache || '[]');
      const r = all.find((x) => String(x.id) === row.dataset.registration);
      if (!r) return;

      if (event.target.closest('[data-view]')) detail(r);

      if (event.target.closest('[data-mark-paid]')) {
        guard(async () => {
          await api(`/api/admin/registrations/${r.id}/paid`, { method: 'PATCH' });
          toast('Marked as paid.');
          await load();
        });
      }
    });

    search?.addEventListener('input', () => {
      syncExportLinks();
      clearTimeout(timer);
      timer = setTimeout(() => guard(load), 250);
    });

    await load();
  }

  /* ========================================================================
     Chat
     ======================================================================== */
  async function initChat() {
    const listHost = document.querySelector('[data-chat-threads]');
    const threadHost = document.querySelector('[data-chat-thread]');

    let openId = null;
    let timer = null;

    const STATUS_LABEL = { open: 'Open', closed: 'Closed', blocked: 'Blocked' };

    async function loadThreads() {
      const data = await api('/api/admin/chat');

      if (!data.threads.length) {
        listHost.innerHTML = '<p class="chat-admin-empty">No conversations yet.</p>';
        return;
      }

      listHost.innerHTML = data.threads
        .map(
          (t) => `
        <button type="button" class="chat-thread-item${t.id === openId ? ' is-active' : ''}" data-thread="${t.id}">
          <span class="chat-thread-top">
            <strong>${escapeHtml(t.name || t.email || 'Anonymous visitor')}</strong>
            ${t.unread ? `<span class="chat-unread">${t.unread}</span>` : ''}
          </span>
          <span class="chat-thread-preview">${escapeHtml((t.preview || '').slice(0, 70))}</span>
          <span class="chat-thread-meta">${escapeHtml(formatDate(t.lastMessageAt || t.createdAt))}${
            t.status !== 'open' ? ` · ${escapeHtml(STATUS_LABEL[t.status])}` : ''
          }</span>
        </button>`
        )
        .join('');
    }

    async function loadThread(id, { quiet = false } = {}) {
      if (!quiet) threadHost.innerHTML = '<div class="admin-loading">Loading conversation...</div>';
      const data = await api(`/api/admin/chat/${id}`);
      openId = id;

      threadHost.innerHTML = `
        <header class="chat-thread-head">
          <div>
            <h2>${escapeHtml(data.thread.name || 'Anonymous visitor')}</h2>
            <p>${
              data.thread.email
                ? `<a href="mailto:${escapeHtml(data.thread.email)}">${escapeHtml(data.thread.email)}</a>`
                : 'No email given &mdash; the only way to answer is here.'
            }</p>
          </div>
          <div class="actions">
            ${
              data.thread.status === 'open'
                ? '<button type="button" class="mini-button" data-status="closed">Close</button><button type="button" class="mini-button danger" data-status="blocked">Block</button>'
                : '<button type="button" class="mini-button solid" data-status="open">Reopen</button>'
            }
          </div>
        </header>

        <div class="chat-admin-log" data-admin-log>
          ${data.messages
            .map(
              (m) => `
            <div class="chat-bubble is-${m.sender === 'admin' ? 'you' : 'them'}">
              <p>${escapeHtml(m.body)}</p>
              <span class="chat-stamp">${escapeHtml(formatDate(m.createdAt))}</span>
            </div>`
            )
            .join('')}
        </div>

        <form class="chat-admin-form" data-reply-form>
          <textarea name="body" rows="2" placeholder="Write a reply..." required></textarea>
          <button type="submit" class="button primary small">Send</button>
        </form>`;

      const log = threadHost.querySelector('[data-admin-log]');
      log.scrollTop = log.scrollHeight;

      threadHost.querySelector('[data-reply-form]').addEventListener('submit', (event) => {
        event.preventDefault();
        const field = event.target.querySelector('textarea');
        const body = field.value.trim();
        if (!body) return;

        guard(async () => {
          field.value = '';
          await api(`/api/admin/chat/${id}`, { method: 'POST', body: { body } });
          await loadThread(id, { quiet: true });
          await loadThreads();
        });
      });

      threadHost.querySelectorAll('[data-status]').forEach((button) =>
        button.addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/chat/${id}`, {
              method: 'PATCH',
              body: { status: button.dataset.status },
            });
            toast('Conversation updated.');
            await loadThread(id, { quiet: true });
            await loadThreads();
          })
        )
      );

      await loadThreads();
    }

    listHost.addEventListener('click', (event) => {
      const item = event.target.closest('[data-thread]');
      if (item) guard(() => loadThread(Number(item.dataset.thread)));
    });

    /* Keep the open conversation current without a refresh. Paused when the tab
       is hidden so an admin who leaves this open all day is not polling into the
       void. */
    function startPolling() {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (document.hidden) return;
        if (openId) loadThread(openId, { quiet: true }).catch(() => {});
        else loadThreads().catch(() => {});
      }, 8000);
    }

    threadHost.innerHTML = '<p class="chat-admin-empty">Pick a conversation on the left.</p>';
    await loadThreads();
    startPolling();
  }

  /* ========================================================================
     News posts
     ======================================================================== */
  async function initNews() {
    const host = document.querySelector('[data-news-admin]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading posts...</div>';
      const data = await api('/api/admin/news');

      if (!data.posts.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No posts yet</h3><p>Write one and it appears on the news page with its own shareable link.</p></div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>Post</th><th>Category</th><th>Published</th><th>Live</th><th></th></tr>
            </thead>
            <tbody>
              ${data.posts
                .map(
                  (p) => `
                <tr data-post="${p.id}">
                  <td>
                    <div class="cell-strong">${escapeHtml(p.title)}</div>
                    <div class="cell-muted">/news/${escapeHtml(p.slug)}</div>
                  </td>
                  <td>${escapeHtml(p.category || '-')}</td>
                  <td class="cell-muted">${escapeHtml(String(p.publishedAt || '').slice(0, 10))}</td>
                  <td><button type="button" class="toggle-pill ${p.active ? 'on' : 'off'}" data-toggle-post>${
                    p.active ? 'Live' : 'Hidden'
                  }</button></td>
                  <td>
                    <div class="actions">
                      <a class="mini-button" href="/news/${escapeHtml(p.slug)}" target="_blank" rel="noopener">View</a>
                      <button type="button" class="mini-button" data-edit>Edit</button>
                      <button type="button" class="mini-button danger" data-delete>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.posts);
    }

    function postForm(post) {
      const isNew = !post;
      const p = post || {
        title: '', category: '', excerpt: '', body: '', imageUrl: '', imageAlt: '',
        author: '', contactEmail: '', contactPhone: '',
        share: { facebook: '', instagram: '', x: '' },
        publishedAt: new Date().toISOString().slice(0, 10), active: true, slug: '',
      };

      const modal = openModal(
        isNew ? 'New post' : `Edit ${p.title}`,
        `<form data-post-form>
          <label>Title <input name="title" value="${escapeHtml(p.title)}" required maxlength="200"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Category <input name="category" value="${escapeHtml(p.category)}" placeholder="Coaching" maxlength="60"></label>
            <label>Published <input name="publishedAt" type="date" value="${escapeHtml(
              String(p.publishedAt || '').slice(0, 10)
            )}"></label>
          </div>
          <label>Summary <textarea name="excerpt" rows="2" maxlength="400">${escapeHtml(p.excerpt)}</textarea></label>
          <label>Body <textarea name="body" rows="8" maxlength="20000">${escapeHtml(p.body)}</textarea></label>
          <p class="cell-muted">Leave a blank line between paragraphs. Plain text only &mdash; no HTML needed.</p>

          <label>Photo
            <input type="file" accept="image/jpeg,image/png,image/webp" data-post-image>
          </label>
          <div data-image-preview>${
            p.imageUrl
              ? `<img src="/${escapeHtml(p.imageUrl.replace(/^\.\//, ''))}" alt="" style="max-width:220px;border-radius:8px;margin:6px 0">`
              : ''
          }</div>
          <input type="hidden" name="imageUrl" value="${escapeHtml(p.imageUrl)}">
          <label>Photo description <input name="imageAlt" value="${escapeHtml(
            p.imageAlt
          )}" maxlength="300" placeholder="Describes the photo for screen readers"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Contact email <input name="contactEmail" type="email" value="${escapeHtml(
              p.contactEmail
            )}" maxlength="200"></label>
            <label>Contact phone <input name="contactPhone" value="${escapeHtml(
              p.contactPhone
            )}" maxlength="60"></label>
          </div>
          <label>Author <input name="author" value="${escapeHtml(p.author)}" maxlength="120"></label>

          <p class="cell-muted">Optional links shown in the share menu. Leave blank and they are not offered.</p>
          <label>Facebook link <input name="shareFacebook" value="${escapeHtml(
            p.share?.facebook || ''
          )}" maxlength="400"></label>
          <label>Instagram link <input name="shareInstagram" value="${escapeHtml(
            p.share?.instagram || ''
          )}" maxlength="400"></label>
          <label>X link <input name="shareX" value="${escapeHtml(p.share?.x || '')}" maxlength="400"></label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Visible on the site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save post</button>'
      );

      const form = modal.querySelector('[data-post-form]');
      const fileInput = modal.querySelector('[data-post-image]');
      const preview = modal.querySelector('[data-image-preview]');

      fileInput?.addEventListener('change', () =>
        guard(async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          preview.innerHTML = '<p class="cell-muted">Uploading...</p>';
          /* Raw bytes, not base64: express.json() ignores octet-stream, so this
             bypasses the global 256kb limit and is capped by its own route. */
          const result = await api('/api/admin/uploads', {
            method: 'POST',
            rawBody: file,
            contentType: 'application/octet-stream',
          });

          form.imageUrl.value = result.url;
          preview.innerHTML = `<img src="/${escapeHtml(
            result.url.replace(/^\.\//, '')
          )}" alt="" style="max-width:220px;border-radius:8px;margin:6px 0">`;
          toast('Photo uploaded.');
        })
      );

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const values = Object.fromEntries(new FormData(form).entries());
          if (!String(values.title || '').trim()) throw new Error('Give the post a title.');

          const body = {
            title: values.title,
            category: values.category,
            excerpt: values.excerpt,
            body: values.body,
            imageUrl: values.imageUrl,
            imageAlt: values.imageAlt,
            author: values.author,
            contactEmail: values.contactEmail,
            contactPhone: values.contactPhone,
            shareFacebook: values.shareFacebook,
            shareInstagram: values.shareInstagram,
            shareX: values.shareX,
            publishedAt: values.publishedAt,
            active: Boolean(values.active),
          };

          if (isNew) await api('/api/admin/news', { method: 'POST', body });
          else await api(`/api/admin/news/${p.id}`, { method: 'PATCH', body });

          toast(isNew ? 'Post published.' : 'Post updated.');
          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-post]')?.addEventListener('click', () => postForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-post]');
      if (!row) return;
      const posts = JSON.parse(host.dataset.cache || '[]');
      const post = posts.find((p) => String(p.id) === row.dataset.post);
      if (!post) return;

      if (event.target.closest('[data-edit]')) postForm(post);

      if (event.target.closest('[data-toggle-post]')) {
        guard(async () => {
          await api(`/api/admin/news/${post.id}`, { method: 'PATCH', body: { active: !post.active } });
          await load();
        });
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete this post?',
          `<div class="modal-body"><p>&ldquo;${escapeHtml(
            post.title
          )}&rdquo; and its photo will be removed. Any link already shared will stop working.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Keep it</button><button type="button" class="mini-button danger" data-confirm-delete>Delete</button>'
        );
        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/news/${post.id}`, { method: 'DELETE' });
            closeModal();
            toast('Post deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  /* ========================================================================
     Donations
     ======================================================================== */
  async function initDonations() {
    const statsHost = document.querySelector('[data-donation-stats]');
    const host = document.querySelector('[data-donations]');

    const KIND = { one_time: 'One time', monthly: 'Monthly' };

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading donations...</div>';
      const data = await api('/api/admin/donations');
      const t = data.totals;

      if (statsHost) {
        statsHost.innerHTML = [
          ['Received', money(t.receivedCents, data.currency), 'All gifts actually collected'],
          ['One-time', money(t.oneTimeCents, data.currency), 'Single gifts'],
          ['Recurring', money(t.recurringCents, data.currency), 'Collected from monthly donors'],
          ['Monthly donors', String(t.activeMonthly), `${money(t.monthlyValueCents, data.currency)} per month`],
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
      }

      if (!data.donations.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No donations yet</h3><p>Gifts made through the donation page will appear here.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Kind</th>
                <th class="num">Amount</th>
                <th>Status</th>
                <th class="num">Charges</th>
                <th>Leaderboard</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${data.donations
                .map(
                  (d) => `
                <tr>
                  <td>
                    <div class="cell-strong">${escapeHtml(d.name || 'Anonymous')}</div>
                    <div class="cell-muted">${escapeHtml(d.email || '')}</div>
                    ${d.message ? `<div class="cell-muted">&ldquo;${escapeHtml(d.message)}&rdquo;</div>` : ''}
                  </td>
                  <td>${escapeHtml(KIND[d.kind] || d.kind)}</td>
                  <td class="num">
                    <div class="cell-strong">${escapeHtml(money(d.totalCents, d.currency))}${
                      d.isRecurring ? ' /mo' : ''
                    }</div>
                    ${
                      d.feeCents > 0
                        ? `<div class="cell-muted">incl. ${escapeHtml(money(d.feeCents, d.currency))} fee</div>`
                        : ''
                    }
                  </td>
                  <td>${statusBadge(d.status)}</td>
                  <td class="num">${d.isRecurring ? (d.payments ? d.payments.length : 0) : '-'}</td>
                  <td data-donation="${d.id}">
                    ${
                      d.displayPublicly
                        ? `<div class="cell-strong">${escapeHtml(d.publicName || d.name || 'No name')}</div>
                           <div class="cell-muted">${
                             d.status === 'paid' || d.status === 'active'
                               ? 'Shown publicly'
                               : 'Opted in, hidden until paid'
                           }</div>`
                        : '<div class="cell-muted">Not listed</div>'
                    }
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-visibility>${
                        d.displayPublicly ? 'Edit' : 'Add'
                      }</button>
                      ${
                        d.displayPublicly
                          ? '<button type="button" class="mini-button danger" data-remove-visibility>Remove</button>'
                          : ''
                      }
                    </div>
                  </td>
                  <td class="cell-muted">${escapeHtml(formatDate(d.paidAt || d.createdAt))}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.donations);
    }

    /* The leaderboard entry only. Nothing here can change the amount, the
       status or the donor's own record - taking a name off the public page is
       deliberately not an edit of the gift. */
    host.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-donation]');
      if (!cell) return;
      const donations = JSON.parse(host.dataset.cache || '[]');
      const donation = donations.find((d) => String(d.id) === cell.dataset.donation);
      if (!donation) return;

      if (event.target.closest('[data-remove-visibility]')) {
        guard(async () => {
          await api(`/api/admin/donations/${donation.id}/visibility`, {
            method: 'PATCH',
            body: { displayPublicly: false, publicName: donation.publicName },
          });
          toast('Removed from the leaderboard. The donation is unchanged.');
          await load();
        });
        return;
      }

      if (event.target.closest('[data-edit-visibility]')) {
        const modal = openModal(
          'Leaderboard entry',
          `<form data-visibility-form>
            <p class="cell-muted">This changes only how the gift appears on the public leaderboard. The donation itself is not touched.</p>
            <label>Name to show <span class="cell-muted">(blank uses &ldquo;${escapeHtml(
              donation.name || 'Anonymous'
            )}&rdquo;)</span>
              <input name="publicName" value="${escapeHtml(
                donation.publicName
              )}" maxlength="160">
            </label>
            <label class="checkbox-row"><input type="checkbox" name="displayPublicly" ${
              donation.displayPublicly ? 'checked' : ''
            }> List this gift on the public leaderboard</label>
            ${
              donation.status === 'paid' || donation.status === 'active'
                ? ''
                : '<p class="cell-muted">This gift is not settled yet, so it stays off the page until it is paid even with this ticked.</p>'
            }
          </form>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
        );

        modal.querySelector('[data-save]').addEventListener('click', () =>
          guard(async () => {
            const form = modal.querySelector('[data-visibility-form]');
            const v = Object.fromEntries(new FormData(form).entries());

            await api(`/api/admin/donations/${donation.id}/visibility`, {
              method: 'PATCH',
              body: {
                displayPublicly: Boolean(v.displayPublicly),
                publicName: v.publicName,
              },
            });

            closeModal();
            toast('Leaderboard entry updated.');
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
    donations: initDonations,
    news: initNews,
    chat: initChat,
    messages: initMessages,
    sponsors: initSponsors,
    programs: initPrograms,
    registrations: initRegistrations,
    teams: initTeams,
    games: initGames,
    roster: initRoster,
    shipping: initShipping,
    content: initContent,
  };

  if (pages[page]) guard(pages[page]);
})();
