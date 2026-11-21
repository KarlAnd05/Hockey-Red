/* ==========================================================================
   Lebanon Hockey admin - Programs
   --------------------------------------------------------------------------
   The schedule: camps, tournaments and events.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

  async function initPrograms() {
    const host = document.querySelector('[data-programs-admin]');
    let kinds = {};
    let teams = [];

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading schedule...</div>';
      const data = await api('/api/admin/programs');
      kinds = data.kinds;
      teams = data.teams;

      if (!data.programs.length) {
        host.innerHTML = '<div class="admin-empty">Nothing scheduled yet. Use Add entry above.</div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>Date</th><th>Title</th><th>Type</th><th>Team</th><th>Where</th><th>Shown</th><th></th></tr>
            </thead>
            <tbody>
              ${data.programs
                .map(
                  (p) => `
                <tr data-program="${p.id}">
                  <td class="cell-muted">${escapeHtml(
                    p.startsAt
                      ? formatDate(p.startsAt) +
                          (p.endsAt && p.endsAt !== p.startsAt ? ` - ${formatDate(p.endsAt)}` : '')
                      : 'To be announced'
                  )}</td>
                  <td class="cell-strong">${escapeHtml(p.title)}</td>
                  <td>${escapeHtml(p.kindLabel)}</td>
                  <td class="cell-muted">${escapeHtml(p.teamName || '-')}</td>
                  <td class="cell-muted">${escapeHtml(p.location || '-')}</td>
                  <td>${
                    p.active
                      ? '<span class="status-badge is-paid">Shown</span>'
                      : '<span class="status-badge is-cancelled">Hidden</span>'
                  }</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-program>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-program>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.programs);
    }

    function programForm(entry) {
      const isNew = !entry;
      const p = entry || {
        title: '', kind: 'program', startsAt: '', endsAt: '', location: '',
        description: '', linkUrl: '', linkLabel: '', teamId: null, active: true, sortOrder: 0,
      };

      const modal = openModal(
        isNew ? 'Add to the schedule' : `Edit ${p.title}`,
        `<form data-program-form>
          <label>Title <input name="title" value="${escapeHtml(p.title)}" required maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Type
              <select name="kind">
                ${Object.entries(kinds)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        p.kind === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Team <span class="cell-muted">(optional)</span>
              <select name="teamId">
                <option value="">No team</option>
                ${teams
                  .map(
                    (t) =>
                      `<option value="${t.id}"${
                        String(t.id) === String(p.teamId) ? ' selected' : ''
                      }>${escapeHtml(t.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Starts <input name="startsAt" type="date" value="${escapeHtml(
              String(p.startsAt || '').slice(0, 10)
            )}"></label>
            <label>Ends <span class="cell-muted">(optional)</span>
              <input name="endsAt" type="date" value="${escapeHtml(String(p.endsAt || '').slice(0, 10))}">
            </label>
          </div>
          <p class="cell-muted">Leave the start date blank for something that is announced but not yet dated. It will appear below the dated entries.</p>

          <label>Where <input name="location" value="${escapeHtml(
            p.location
          )}" maxlength="240"></label>

          <label>Description <textarea name="description" rows="4" maxlength="4000">${escapeHtml(
            p.description
          )}</textarea></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Link <span class="cell-muted">(optional)</span>
              <input name="linkUrl" value="${escapeHtml(
                p.linkUrl
              )}" maxlength="400" placeholder="/teams/youth">
            </label>
            <label>Link text <input name="linkLabel" value="${escapeHtml(
              p.linkLabel
            )}" maxlength="80" placeholder="More details"></label>
          </div>

          <label>Order <span class="cell-muted">(only matters between entries sharing a date)</span>
            <input name="sortOrder" type="number" value="${p.sortOrder}">
          </label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Shown on the public events page</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
      );

      const form = modal.querySelector('[data-program-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.title || '').trim()) throw new Error('Give it a title.');
          if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
            throw new Error('The end date is before the start date.');
          }

          const body = {
            title: v.title,
            kind: v.kind,
            startsAt: v.startsAt,
            endsAt: v.endsAt,
            location: v.location,
            description: v.description,
            linkUrl: v.linkUrl,
            linkLabel: v.linkLabel,
            teamId: v.teamId === '' ? null : Number(v.teamId),
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/programs', { method: 'POST', body });
          else await api(`/api/admin/programs/${p.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Added to the schedule.' : 'Updated.');
          await load();
        })
      );
    }

    document.querySelector('[data-new-program]')?.addEventListener('click', () => programForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-program]');
      if (!row) return;
      const programs = JSON.parse(host.dataset.cache || '[]');
      const entry = programs.find((p) => String(p.id) === row.dataset.program);
      if (!entry) return;

      if (event.target.closest('[data-edit-program]')) programForm(entry);

      if (event.target.closest('[data-delete-program]')) {
        const modal = openModal(
          'Delete this entry?',
          `<div class="modal-body"><p>${escapeHtml(
            entry.title
          )} will be removed from the schedule.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/programs/${entry.id}`, { method: 'DELETE' });
            closeModal();
            toast('Removed from the schedule.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initPrograms);
})();
