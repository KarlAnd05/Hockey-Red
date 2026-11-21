/* ==========================================================================
   Lebanon Hockey admin - News
   --------------------------------------------------------------------------
   News posts: writing, publishing and images.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

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

  guard(initNews);
})();
