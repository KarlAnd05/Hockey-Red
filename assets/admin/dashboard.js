/* ==========================================================================
   Lebanon Hockey admin - Dashboard
   --------------------------------------------------------------------------
   The opening numbers, and the newest orders beneath them.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate } = window.LH;
  const { statusBadge, guard } = window.LHAdmin;

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

  guard(initDashboard);
})();
