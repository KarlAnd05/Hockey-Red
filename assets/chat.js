/**
 * Visitor chat widget.
 *
 * Built entirely in JavaScript and appended to <body>, for three reasons:
 *   - it ships on all 23 pages without touching 23 files;
 *   - it never appears in the server's HTML, so server/lib/content.js does not
 *     scan it into the Page text editor on every page;
 *   - with JavaScript off there is simply no widget, rather than dead markup.
 *
 * In-house on purpose. A hosted chat widget loads a third party's script on every
 * page view, which would break the zero-third-party-request commitment in
 * PRODUCT.md and reintroduce the cookie-consent requirement the site is exempt
 * from today.
 *
 * The conversation is keyed by a token in localStorage, so it survives moving
 * from page to page, reloading, and signing in. Everything is wrapped in
 * try/catch because localStorage throws in some private-browsing modes.
 */
(function () {
  'use strict';

  if (!window.LH) return;

  const { api, escapeHtml } = window.LH;
  const KEY = 'lh_chat_token';
  const POLL_MS = 6000;

  const store = {
    get() {
      try {
        return localStorage.getItem(KEY) || '';
      } catch {
        return '';
      }
    },
    set(value) {
      try {
        localStorage.setItem(KEY, value);
      } catch {
        /* private mode: the chat still works for this page view */
      }
    },
  };

  let token = store.get();
  let lastId = 0;
  let open = false;
  let timer = null;
  let settings = { greeting: '', availability: '' };
  let askedForEmail = false;
  let hasEmail = false;

  /* --- Markup ------------------------------------------------------------- */
  const root = document.createElement('div');
  root.className = 'chat-widget';
  root.innerHTML = `
    <button type="button" class="chat-launcher" data-chat-open aria-expanded="false" aria-label="Chat with the federation">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.2A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4z"/></svg>
      <span class="chat-launcher-label">Chat</span>
      <span class="chat-badge" data-chat-badge hidden>1</span>
    </button>

    <section class="chat-panel" data-chat-panel hidden aria-label="Chat with the federation">
      <header class="chat-head">
        <div>
          <p class="chat-title">Lebanon Hockey</p>
          <p class="chat-availability" data-chat-availability></p>
        </div>
        <button type="button" class="chat-close" data-chat-close aria-label="Close chat">&times;</button>
      </header>

      <div class="chat-log" data-chat-log role="log" aria-live="polite"></div>

      <form class="chat-form" data-chat-form>
        <label class="chat-email" data-chat-email hidden>
          Your email <span>(optional, so we can reply if you leave)</span>
          <input type="email" name="email" autocomplete="email" placeholder="you@example.com">
        </label>
        <div class="chat-row">
          <label class="sr-only" for="chat-message">Your message</label>
          <textarea id="chat-message" name="body" rows="1" placeholder="Write your message..." required></textarea>
          <button type="submit" class="chat-send" aria-label="Send message">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5 3 10l12 2-12 2z"/></svg>
          </button>
        </div>
      </form>
    </section>`;

  document.body.appendChild(root);

  const panel = root.querySelector('[data-chat-panel]');
  const launcher = root.querySelector('[data-chat-open]');
  const log = root.querySelector('[data-chat-log]');
  const form = root.querySelector('[data-chat-form]');
  const input = form.querySelector('textarea');
  const emailWrap = root.querySelector('[data-chat-email]');
  const badge = root.querySelector('[data-chat-badge]');
  const availability = root.querySelector('[data-chat-availability]');

  /* --- Rendering ---------------------------------------------------------- */
  function addBubble(message) {
    const el = document.createElement('div');
    el.className = `chat-bubble is-${message.sender === 'admin' ? 'them' : 'you'}`;
    el.innerHTML = `<p>${escapeHtml(message.body)}</p>`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function addNote(text) {
    const el = document.createElement('p');
    el.className = 'chat-note';
    el.textContent = text;
    log.appendChild(el);
  }

  /* --- Network ------------------------------------------------------------ */
  async function poll() {
    if (!token) return;
    try {
      const data = await api(`/api/chat?token=${encodeURIComponent(token)}&since=${lastId}`);
      hasEmail = Boolean(data.hasEmail);
      for (const message of data.messages) {
        addBubble(message);
        lastId = Math.max(lastId, message.id);
        if (message.sender === 'admin' && !open) showBadge();
      }
    } catch {
      /* a failed poll is not worth telling the visitor about; the next one may work */
    }
  }

  function showBadge() {
    badge.hidden = false;
  }

  function startPolling() {
    stopPolling();
    // Only while the panel is open and the tab is actually being looked at.
    if (!open || document.hidden) return;
    timer = setInterval(poll, POLL_MS);
  }

  function stopPolling() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else if (open) {
      poll();
      startPolling();
    }
  });

  /* --- Opening and closing ------------------------------------------------ */
  async function openPanel() {
    open = true;
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    badge.hidden = true;
    input.focus();

    if (!settings.greeting) {
      try {
        settings = await api('/api/chat/config');
      } catch {
        settings = { greeting: '', availability: '' };
      }
      availability.textContent = settings.availability || '';
      if (settings.greeting && !log.childElementCount) addNote(settings.greeting);
    }

    await poll();
    startPolling();
  }

  function closePanel() {
    open = false;
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    stopPolling();
  }

  launcher.addEventListener('click', () => (open ? closePanel() : openPanel()));
  root.querySelector('[data-chat-close]').addEventListener('click', closePanel);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) closePanel();
  });

  /* --- Sending ------------------------------------------------------------ */
  // Enter sends, Shift+Enter makes a new line.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = input.value.trim();
    if (!body) return;

    const email = emailWrap.querySelector('input')?.value || '';
    input.value = '';

    // Show it immediately; the server echoes it back with an id.
    addBubble({ sender: 'visitor', body });

    try {
      const data = await api('/api/chat', { method: 'POST', body: { token, body, email } });

      if (data.token && data.token !== token) {
        token = data.token;
        store.set(token);
      }
      for (const message of data.messages) lastId = Math.max(lastId, message.id);
      if (email) hasEmail = true;

      /* Asked once, after the first message is away, so the greeting is not a
         form. Anonymous is fine; this is only so somebody who leaves can still
         be answered. */
      if (!askedForEmail && !hasEmail) {
        askedForEmail = true;
        emailWrap.hidden = false;
      }

      startPolling();
    } catch (error) {
      addNote(
        error.status === 429
          ? 'That is a lot of messages at once. Please wait a moment and try again.'
          : 'That message did not send. Please try again, or email info@lebanonhockey.com.'
      );
    }
  });

  /* If a conversation already exists, quietly check for replies on load so the
     badge can show without the visitor opening the panel. */
  if (token) poll();
})();
