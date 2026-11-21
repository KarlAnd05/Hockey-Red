/* ==========================================================================
   Lebanon Hockey admin - Chat
   --------------------------------------------------------------------------
   Visitor chat threads, and replying to one.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;
  const { guard } = window.LHAdmin;

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

  guard(initChat);
})();
