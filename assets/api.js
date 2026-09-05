/* ==========================================================================
   Lebanon Hockey - shared client helpers
   Loaded before every other page script. Exposes window.LH.
   ========================================================================== */
(function () {
  'use strict';

  let session = null;
  let sessionPromise = null;

  /**
   * Fetch the session once and cache it. Carries the CSRF token that every
   * state-changing request has to echo back.
   */
  function loadSession(force) {
    if (!force && sessionPromise) return sessionPromise;

    sessionPromise = fetch('/api/session', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        session = data;
        return data;
      })
      .catch(() => null);

    return sessionPromise;
  }

  /**
   * JSON API call. Adds the CSRF header on writes and retries once if the token
   * has gone stale (for example after a login rotated the session).
   */
  async function api(path, options) {
    const opts = options || {};
    const method = (opts.method || 'GET').toUpperCase();
    const headers = Object.assign({}, opts.headers);

    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    if (method !== 'GET' && method !== 'HEAD') {
      const current = session || (await loadSession());
      if (current && current.csrfToken) headers['X-CSRF-Token'] = current.csrfToken;
    }

    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    if (response.status === 403 && method !== 'GET' && !opts._retried) {
      await loadSession(true);
      return api(path, Object.assign({}, opts, { _retried: true }));
    }

    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const payload = isJson ? await response.json().catch(() => ({})) : {};

    if (!response.ok) {
      const error = new Error(payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function money(cents, currency) {
    const value = (Number(cents) || 0) / 100;
    try {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: (currency || (session && session.currency) || 'cad').toUpperCase(),
      }).format(value);
    } catch {
      return `$${value.toFixed(2)}`;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'));
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* --- Toast ------------------------------------------------------------- */
  let toastHost = null;

  function toast(message, type) {
    if (!toastHost) {
      toastHost = document.createElement('div');
      toastHost.className = 'toast-host';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }

    const item = document.createElement('div');
    item.className = `toast${type ? ` is-${type}` : ''}`;
    item.textContent = message;
    toastHost.appendChild(item);

    requestAnimationFrame(() => item.classList.add('is-in'));

    setTimeout(() => {
      item.classList.remove('is-in');
      setTimeout(() => item.remove(), 300);
    }, 3600);
  }

  /** Tell the header (and any listening page) that the cart changed. */
  function cartChanged() {
    document.dispatchEvent(new CustomEvent('cart:changed'));
  }

  function requireSignedIn(redirectTo) {
    return loadSession().then((data) => {
      if (!data || !data.user) {
        const next = encodeURIComponent(redirectTo || window.location.pathname + window.location.search);
        window.location.href = `login.html?next=${next}`;
        return null;
      }
      return data.user;
    });
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  window.LH = {
    api,
    money,
    escapeHtml,
    formatDate,
    toast,
    cartChanged,
    loadSession,
    requireSignedIn,
    qs,
    get session() {
      return session;
    },
  };

  loadSession();
})();
