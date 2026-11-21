/* ==========================================================================
   Lebanon Hockey admin - Sponsors
   --------------------------------------------------------------------------
   Sponsors, their tiers and their logos.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

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

  guard(initSponsors);
})();
