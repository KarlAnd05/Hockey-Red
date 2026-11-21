/* ==========================================================================
   Lebanon Hockey admin - Roster
   --------------------------------------------------------------------------
   The roster view across teams.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

  async function initRoster() {
    const host = document.querySelector('[data-roster-admin]');
    const programSelect = document.querySelector('[data-roster-program]');

    const TEAMS = { national: 'National Team', next_gen: 'Next Generation' };
    const POSITIONS = { forward: 'Forward', defence: 'Defence', goaltender: 'Goaltender' };

    const program = () => programSelect?.value || 'womens';

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading roster...</div>';
      const data = await api(`/api/admin/roster?program=${encodeURIComponent(program())}`);

      if (!data.players.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No players yet</h3><p>Add players and they appear on this program&rsquo;s page straight away.</p></div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th class="num">#</th><th>Name</th><th>Team</th><th>Position</th><th>Most recent team</th><th>Shown</th><th></th></tr>
            </thead>
            <tbody>
              ${data.players
                .map(
                  (p) => `
                <tr data-player="${p.id}">
                  <td class="num">${p.number ?? '&mdash;'}</td>
                  <td class="cell-strong">${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(TEAMS[p.team] || p.team)}</td>
                  <td>${escapeHtml(POSITIONS[p.position] || p.position)}</td>
                  <td class="cell-muted">${escapeHtml(p.recentTeam || '—')}</td>
                  <td><button type="button" class="toggle-pill ${p.active ? 'on' : 'off'}" data-toggle-player>${
                    p.active ? 'Shown' : 'Hidden'
                  }</button></td>
                  <td>
                    <div class="actions">
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

      host.dataset.cache = JSON.stringify(data.players);
    }

    function playerForm(player) {
      const isNew = !player;
      const p = player || {
        program: program(), team: 'national', position: 'forward', number: '',
        name: '', recentTeam: '', resides: '', hometown: '', active: true, sortOrder: 0,
      };

      const options = (map, selected) =>
        Object.entries(map)
          .map(([k, v]) => `<option value="${k}"${k === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`)
          .join('');

      const modal = openModal(
        isNew ? 'Add player' : `Edit ${p.name}`,
        `<form data-player-form>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Program
              <select name="program">${options({ womens: "Women's", mens: "Men's" }, p.program)}</select>
            </label>
            <label>Team <select name="team">${options(TEAMS, p.team)}</select></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Position <select name="position">${options(POSITIONS, p.position)}</select></label>
            <label>Jersey number <span class="cell-muted">(blank for none)</span>
              <input name="number" type="number" min="0" max="99" value="${p.number ?? ''}">
            </label>
          </div>
          <label>Name <input name="name" value="${escapeHtml(p.name)}" required maxlength="160"></label>
          <label>Most recent team <input name="recentTeam" value="${escapeHtml(
            p.recentTeam
          )}" maxlength="200"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Resides <input name="resides" value="${escapeHtml(p.resides)}" maxlength="120"></label>
            <label>Hometown <input name="hometown" value="${escapeHtml(p.hometown)}" maxlength="120"></label>
          </div>
          <label>Order <input name="sortOrder" type="number" value="${p.sortOrder ?? 0}"></label>
          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Show on the public site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save player</button>'
      );

      const form = modal.querySelector('[data-player-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error("Enter the player's name.");

          const body = {
            program: v.program,
            team: v.team,
            position: v.position,
            number: v.number === '' ? null : Number(v.number),
            name: v.name,
            recentTeam: v.recentTeam,
            resides: v.resides,
            hometown: v.hometown,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/roster', { method: 'POST', body });
          else await api(`/api/admin/roster/${p.id}`, { method: 'PATCH', body });

          toast(isNew ? 'Player added.' : 'Player updated.');
          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-player]')?.addEventListener('click', () => playerForm(null));
    programSelect?.addEventListener('change', () => guard(load));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-player]');
      if (!row) return;
      const all = JSON.parse(host.dataset.cache || '[]');
      const p = all.find((x) => String(x.id) === row.dataset.player);
      if (!p) return;

      if (event.target.closest('[data-edit]')) playerForm(p);

      /* Hiding is the gentle option, and the one privacy.html promises a parent
         or guardian: the player leaves the public site, the record stays. */
      if (event.target.closest('[data-toggle-player]')) {
        guard(async () => {
          await api(`/api/admin/roster/${p.id}`, { method: 'PATCH', body: { active: !p.active } });
          await load();
        });
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Remove this player?',
          `<div class="modal-body"><p>${escapeHtml(
            p.name
          )} will be deleted outright. If you only want them off the public site, use <strong>Shown</strong> instead &mdash; that keeps the record.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm-delete>Delete</button>'
        );
        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/roster/${p.id}`, { method: 'DELETE' });
            closeModal();
            toast('Player removed.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initRoster);
})();
