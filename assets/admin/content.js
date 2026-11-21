/* ==========================================================================
   Lebanon Hockey admin - Content
   --------------------------------------------------------------------------
   The page-text editor: every editable block on the public pages.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;
  const { guard } = window.LHAdmin;

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

  guard(initContent);
})();
