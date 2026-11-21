/* ==========================================================================
   Lebanon Hockey admin - Messages
   --------------------------------------------------------------------------
   Messages sent through the contact form.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

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

  guard(initMessages);
})();
