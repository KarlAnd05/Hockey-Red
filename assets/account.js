/* ==========================================================================
   Lebanon Hockey - authentication and the customer account area
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast, cartChanged, qs } = window.LH;

  function safeNext() {
    const next = qs('next');
    // Only ever redirect to a same-site path, never to an absolute URL.
    if (!next || !next.startsWith('/') || next.startsWith('//')) return 'account.html';
    return next;
  }

  function bindForm(form, handler) {
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submit = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.form-status');
      const original = submit ? submit.textContent : '';

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Working...';
      }
      if (status) {
        status.className = 'form-status';
        status.textContent = '';
      }

      try {
        await handler(Object.fromEntries(new FormData(form).entries()), { form, status });
      } catch (error) {
        if (status) {
          status.className = 'form-status is-error';
          status.textContent = error.message;
        } else {
          toast(error.message, 'error');
        }
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = original;
        }
      }
    });
  }

  /* ========================================================================
     Login
     ======================================================================== */
  const loginForm = document.querySelector('[data-login-form]');

  bindForm(loginForm, async (values) => {
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: values.email, password: values.password },
    });

    await window.LH.loadSession(true);
    cartChanged();
    window.location.href = safeNext();
  });

  /* ========================================================================
     Register
     ======================================================================== */
  const registerForm = document.querySelector('[data-register-form]');

  bindForm(registerForm, async (values) => {
    if (values.password !== values.confirmPassword) {
      throw new Error('The two passwords do not match.');
    }

    await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
      },
    });

    await window.LH.loadSession(true);
    cartChanged();
    window.location.href = safeNext();
  });

  /* ========================================================================
     Account area
     ======================================================================== */
  const accountRoot = document.querySelector('[data-page="account"]');
  if (!accountRoot) return;

  const tabs = accountRoot.querySelectorAll('[data-tab]');
  const panels = accountRoot.querySelectorAll('[data-panel]');

  function showPanel(name) {
    tabs.forEach((tab) => tab.setAttribute('aria-current', String(tab.dataset.tab === name)));
    panels.forEach((panel) => panel.toggleAttribute('hidden', panel.dataset.panel !== name));
    history.replaceState(null, '', `?tab=${name}`);
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => showPanel(tab.dataset.tab)));

  async function loadOrders() {
    const host = accountRoot.querySelector('[data-orders]');
    if (!host) return;

    try {
      const data = await api('/api/orders');

      if (!data.orders.length) {
        host.innerHTML = `
          <div class="empty-state">
            <h3>No orders yet</h3>
            <p>When you place an order it will appear here with its invoice.</p>
            <a class="button primary small" href="shop.html">Visit the shop</a>
          </div>`;
        return;
      }

      host.innerHTML = data.orders
        .map((order) => {
          const invoiceable = order.status === 'paid' || order.status === 'fulfilled';

          return `
            <article class="order-row">
              <div>
                <h3>${escapeHtml(order.orderNumber)}</h3>
                <p class="meta">
                  ${formatDate(order.createdAt)} ·
                  ${order.items.length} item${order.items.length === 1 ? '' : 's'} ·
                  ${money(order.totalCents, order.currency)}
                </p>
              </div>
              <div class="order-actions">
                <span class="status-badge is-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
                ${invoiceable ? `<a class="button ghost small" href="/api/orders/${order.id}/invoice">Invoice</a>` : ''}
                <a class="button ghost small" href="order-confirmation.html?order=${order.id}">Details</a>
              </div>
            </article>`;
        })
        .join('');
    } catch (error) {
      host.innerHTML = `<div class="empty-state"><h3>Could not load your orders</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  function fillProfile(user) {
    const form = accountRoot.querySelector('[data-profile-form]');
    if (!form || !user) return;

    form.firstName.value = user.firstName || '';
    form.lastName.value = user.lastName || '';
    form.phone.value = user.phone || '';

    const emailEl = accountRoot.querySelector('[data-account-email]');
    if (emailEl) emailEl.textContent = user.email;

    const nameEl = accountRoot.querySelector('[data-account-name]');
    if (nameEl) {
      nameEl.textContent = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Your account';
    }

    const sinceEl = accountRoot.querySelector('[data-account-since]');
    if (sinceEl) sinceEl.textContent = formatDate(user.createdAt);

    const adminPanel = accountRoot.querySelector('[data-admin-panel]');
    if (adminPanel) adminPanel.hidden = user.role !== 'admin';
  }

  bindForm(accountRoot.querySelector('[data-profile-form]'), async (values, ctx) => {
    const data = await api('/api/auth/profile', {
      method: 'PATCH',
      body: { firstName: values.firstName, lastName: values.lastName, phone: values.phone },
    });

    fillProfile(data.user);
    await window.LH.loadSession(true);
    cartChanged();

    ctx.status.className = 'form-status is-success';
    ctx.status.textContent = 'Profile saved.';
  });

  bindForm(accountRoot.querySelector('[data-password-form]'), async (values, ctx) => {
    if (values.newPassword !== values.confirmPassword) {
      throw new Error('The two passwords do not match.');
    }

    await api('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
    });

    ctx.form.reset();
    ctx.status.className = 'form-status is-success';
    ctx.status.textContent = 'Password changed. Other devices were signed out.';
  });

  accountRoot.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* signing out locally either way */
    }
    window.location.href = 'index.html';
  });

  window.LH.requireSignedIn('/account.html').then((user) => {
    if (!user) return;
    fillProfile(user);
    loadOrders();
    showPanel(qs('tab') || 'orders');
  });
})();
