/* ==========================================================================
   Lebanon Hockey - admin shell
   --------------------------------------------------------------------------
   What every admin screen needs before its own script runs: the session check
   that sends a signed-out visitor to the login page, the logout button, the
   modal, and the few formatters the tables share.

   Published on window.LHAdmin, the same way api.js publishes window.LH. Load it
   before the page script.

   Every request these screens make goes to /api/admin/*, which the server gates
   on the admin role. None of this is the security boundary.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;

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

  window.LHAdmin = {
    openModal,
    closeModal,
    statusBadge,
    centsFromInput,
    guard,
  };
})();
