/* ==========================================================================
   Lebanon Hockey admin - Teams
   --------------------------------------------------------------------------
   Teams, their staff and honours, and the players on them.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

  async function initTeams() {
    const filter = document.querySelector('[data-team-filter]');
    const detailHost = document.querySelector('[data-team-detail]');
    const playersHost = document.querySelector('[data-team-players]');

    let teams = [];
    let squads = {};
    let positions = [];
    let current = null;
    let players = [];

    const initials = (name) =>
      String(name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');

    /* Uploaded paths are stored as "./uploads/x.jpg" so the public pages can use
       them relatively; the admin is one directory down, so it needs them rooted. */
    const assetSrc = (url) => `/${String(url || '').replace(/^\.\//, '')}`;

    function photoField(label, urlValue, altValue, hint) {
      return `<label>${label}
          <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-input>
        </label>
        <p class="cell-muted">${escapeHtml(hint)}</p>
        <div data-photo-preview>${
          urlValue
            ? `<img src="${escapeHtml(assetSrc(urlValue))}" alt="" style="max-width:200px;border-radius:8px;margin:6px 0">`
            : ''
        }</div>
        <input type="hidden" name="photoUrl" value="${escapeHtml(urlValue || '')}">
        <label>Photo description <span class="cell-muted">(for screen readers)</span>
          <input name="photoAlt" value="${escapeHtml(altValue || '')}" maxlength="240">
        </label>`;
    }

    /* Shared by both editors: the upload is identical, only the field differs. */
    function wirePhotoUpload(modal, form) {
      const input = modal.querySelector('[data-photo-input]');
      const preview = modal.querySelector('[data-photo-preview]');
      if (!input) return;

      input.addEventListener('change', () =>
        guard(async () => {
          const file = input.files && input.files[0];
          if (!file) return;

          preview.innerHTML = '<p class="cell-muted">Uploading...</p>';
          /* Raw bytes, not base64: express.json() ignores octet-stream, so this
             bypasses the global 256kb limit and is capped by its own route. */
          const result = await api('/api/admin/uploads', {
            method: 'POST',
            rawBody: file,
            contentType: 'application/octet-stream',
          });

          form.photoUrl.value = result.url;
          preview.innerHTML = `<img src="${escapeHtml(
            assetSrc(result.url)
          )}" alt="" style="max-width:200px;border-radius:8px;margin:6px 0">`;
          toast('Photo uploaded.');
        })
      );
    }

    async function loadTeams(preferId) {
      const data = await api('/api/admin/teams');
      teams = data.teams;
      squads = data.squads || {};
      positions = data.positions || [];

      const keep = preferId || (current && current.id) || (teams[0] && teams[0].id);
      filter.innerHTML = teams
        .map(
          (t) =>
            `<option value="${t.id}"${String(t.id) === String(keep) ? ' selected' : ''}>${escapeHtml(
              t.name
            )} (${t.playerCount})${t.active ? '' : ' - hidden'}</option>`
        )
        .join('');

      await loadTeam(keep);
    }

    async function loadTeam(id) {
      if (!id) {
        detailHost.innerHTML = '<div class="admin-empty">No teams yet.</div>';
        playersHost.innerHTML = '';
        return;
      }

      playersHost.innerHTML = '<div class="admin-loading">Loading players...</div>';
      const data = await api(`/api/admin/teams/${id}/players`);
      current = data.team;
      players = data.players;

      renderDetail();
      renderPlayers();
    }

    function renderDetail() {
      const t = current;
      detailHost.innerHTML = `
        <div class="team-detail">
          ${
            t.photoUrl
              ? `<img class="team-detail-photo" src="${escapeHtml(assetSrc(t.photoUrl))}" alt="">`
              : '<span class="team-detail-photo is-placeholder">No team photo</span>'
          }
          <div>
            <h2>${escapeHtml(t.name)}${
              t.active ? '' : ' <span class="cell-muted">(hidden)</span>'
            }</h2>
            ${t.tagline ? `<p class="cell-muted">${escapeHtml(t.tagline)}</p>` : ''}
            ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
            <p class="cell-muted">Public page: <a href="/teams/${escapeHtml(
              t.slug
            )}" target="_blank" rel="noopener">/teams/${escapeHtml(t.slug)}</a></p>
            <div class="actions">
              <button type="button" class="mini-button" data-edit-team>Edit team</button>
              <button type="button" class="mini-button danger" data-delete-team>Delete team</button>
            </div>
          </div>
        </div>`;
    }

    function renderPlayers() {
      if (!players.length) {
        playersHost.innerHTML =
          '<div class="admin-empty">No players on this team yet. Use Add player above.</div>';
        return;
      }

      playersHost.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th></th><th>Name</th><th>Squad</th><th>Position</th>
                <th class="num">#</th><th>Most recent team</th><th>Shown</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${players
                .map(
                  (p) => `
                <tr data-player="${p.id}">
                  <td>${
                    p.photoUrl
                      ? `<img class="player-thumb" src="${escapeHtml(assetSrc(p.photoUrl))}" alt="">`
                      : `<span class="player-thumb is-placeholder">${escapeHtml(initials(p.name))}</span>`
                  }</td>
                  <td class="cell-strong">${escapeHtml(p.name)}</td>
                  <td class="cell-muted">${escapeHtml(p.squadLabel || '-')}</td>
                  <td>${escapeHtml(p.positionLabel)}</td>
                  <td class="num">${p.jerseyNumber ? escapeHtml(String(p.jerseyNumber)) : '-'}</td>
                  <td class="cell-muted">${escapeHtml(p.recentTeam || '-')}</td>
                  <td>${
                    p.active
                      ? '<span class="status-badge is-paid">Shown</span>'
                      : '<span class="status-badge is-cancelled">Hidden</span>'
                  }</td>
                  <td>
                    <div class="actions">
                      <a class="mini-button" href="/players/${escapeHtml(
                        p.slug
                      )}" target="_blank" rel="noopener">View</a>
                      <button type="button" class="mini-button" data-edit-player>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-player>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;
    }

    /* --- Team editor ------------------------------------------------------ */
    function teamForm() {
      const t = current;
      const modal = openModal(
        `Edit ${t.name}`,
        `<form data-team-form>
          <label>Team name <input name="name" value="${escapeHtml(t.name)}" required maxlength="160"></label>
          <label>Tagline <input name="tagline" value="${escapeHtml(t.tagline)}" maxlength="200"></label>
          <label>Description <textarea name="description" rows="5" maxlength="4000">${escapeHtml(
            t.description
          )}</textarea></label>
          <label>Page address <span class="cell-muted">(changing this breaks shared links)</span>
            <input name="slug" value="${escapeHtml(t.slug)}" maxlength="80">
          </label>
          ${photoField('Team photo', t.photoUrl, t.photoAlt, 'JPEG, PNG or WebP, up to 4MB.')}
          <label>Order <input name="sortOrder" type="number" value="${t.sortOrder}"></label>
          <label class="checkbox-row"><input type="checkbox" name="active" ${
            t.active ? 'checked' : ''
          }> Shown on the public site</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save team</button>'
      );

      const form = modal.querySelector('[data-team-form]');
      wirePhotoUpload(modal, form);

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error('Give the team a name.');

          await api(`/api/admin/teams/${t.id}`, {
            method: 'PATCH',
            body: {
              name: v.name,
              tagline: v.tagline,
              description: v.description,
              slug: v.slug,
              photoUrl: v.photoUrl,
              photoAlt: v.photoAlt,
              sortOrder: Number(v.sortOrder) || 0,
              active: Boolean(v.active),
            },
          });

          closeModal();
          toast('Team updated.');
          await loadTeams(t.id);
        })
      );
    }

    /* --- Player editor ---------------------------------------------------- */
    function playerForm(player) {
      const isNew = !player;
      const p = player || {
        name: '', squad: '', position: 'forward', jerseyNumber: '', photoUrl: '', photoAlt: '',
        bio: '', recentTeam: '', resides: '', hometown: '', active: true, sortOrder: players.length,
        teamId: current.id, slug: '',
      };

      const modal = openModal(
        isNew ? 'Add player' : `Edit ${p.name}`,
        `<form data-player-form>
          <label>Full name <input name="name" value="${escapeHtml(p.name)}" required maxlength="160"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Team
              <select name="teamId">
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
            <label>Squad
              <select name="squad">
                <option value=""${p.squad ? '' : ' selected'}>No squad</option>
                ${Object.entries(squads)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        p.squad === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Position
              <select name="position">
                ${positions
                  .map(
                    (value) =>
                      `<option value="${escapeHtml(value)}"${
                        p.position === value ? ' selected' : ''
                      }>${escapeHtml(value.charAt(0).toUpperCase() + value.slice(1))}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Jersey number <input name="number" type="number" min="0" max="99" value="${escapeHtml(
              p.jerseyNumber == null ? '' : String(p.jerseyNumber)
            )}"></label>
          </div>

          ${photoField('Player photo', p.photoUrl, p.photoAlt, 'JPEG, PNG or WebP, up to 4MB. Portrait orientation works best.')}

          <label>Most recent team <input name="recentTeam" value="${escapeHtml(
            p.recentTeam
          )}" maxlength="200"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Resides <input name="resides" value="${escapeHtml(p.resides)}" maxlength="120"></label>
            <label>Hometown <input name="hometown" value="${escapeHtml(p.hometown)}" maxlength="120"></label>
          </div>

          <label>Biography <textarea name="bio" rows="5" maxlength="4000">${escapeHtml(
            p.bio
          )}</textarea></label>
          <p class="cell-muted">The short description shown on the player&rsquo;s own page.</p>

          <h3 class="modal-subhead">Record before this site</h3>
          <p class="cell-muted">Only for games the federation played before game sheets were kept here. Everything entered on a game sheet is counted automatically &mdash; do not repeat it.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <label>Games <input name="priorGames" type="number" min="0" value="${
              p.priorGames || 0
            }"></label>
            <label>Goals <input name="priorGoals" type="number" min="0" value="${
              p.priorGoals || 0
            }"></label>
            <label>Assists <input name="priorAssists" type="number" min="0" value="${
              p.priorAssists || 0
            }"></label>
          </div>
          <label>Note about that record <input name="priorNote" value="${escapeHtml(
            p.priorNote || ''
          )}" maxlength="240" placeholder="e.g. 2019-2024 national team"></label>

          <label>Order <input name="sortOrder" type="number" value="${p.sortOrder}"></label>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            p.active ? 'checked' : ''
          }> Shown on the public site</label>
          <p class="cell-muted">Unticking this removes the player from the team page and from their own profile, everywhere, without deleting the record.</p>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save player</button>'
      );

      const form = modal.querySelector('[data-player-form]');
      wirePhotoUpload(modal, form);

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error("Enter the player's name.");

          const body = {
            teamId: Number(v.teamId),
            name: v.name,
            squad: v.squad,
            position: v.position,
            number: v.number === '' ? null : Number(v.number),
            photoUrl: v.photoUrl,
            photoAlt: v.photoAlt,
            bio: v.bio,
            priorGames: Number(v.priorGames) || 0,
            priorGoals: Number(v.priorGoals) || 0,
            priorAssists: Number(v.priorAssists) || 0,
            priorNote: v.priorNote,
            recentTeam: v.recentTeam,
            resides: v.resides,
            hometown: v.hometown,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
          };

          if (isNew) await api('/api/admin/players', { method: 'POST', body });
          else await api(`/api/admin/players/${p.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Player added.' : 'Player updated.');
          await loadTeams(Number(v.teamId));
        })
      );
    }

    /* --- Wiring ----------------------------------------------------------- */
    filter.addEventListener('change', () => guard(() => loadTeam(filter.value)));

    document
      .querySelector('[data-new-team-player]')
      ?.addEventListener('click', () => playerForm(null));

    detailHost.addEventListener('click', (event) => {
      if (event.target.closest('[data-edit-team]')) teamForm();

      if (event.target.closest('[data-delete-team]')) {
        const modal = openModal(
          'Delete this team?',
          `<div class="modal-body"><p>${escapeHtml(
            current.name
          )} will be removed. A team that still has players cannot be deleted - hide it instead.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/teams/${current.id}`, { method: 'DELETE' });
            closeModal();
            toast('Team deleted.');
            current = null;
            await loadTeams();
          })
        );
      }
    });

    playersHost.addEventListener('click', (event) => {
      const row = event.target.closest('[data-player]');
      if (!row) return;
      const player = players.find((x) => String(x.id) === row.dataset.player);
      if (!player) return;

      if (event.target.closest('[data-edit-player]')) playerForm(player);

      if (event.target.closest('[data-delete-player]')) {
        const modal = openModal(
          'Delete this player?',
          `<div class="modal-body">
             <p>${escapeHtml(player.name)} will be removed completely, including their profile page.</p>
             <p class="cell-muted">To take a name off the site but keep the record, edit the player and untick "Shown on the public site" instead.</p>
           </div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/players/${player.id}`, { method: 'DELETE' });
            closeModal();
            toast('Player deleted.');
            await loadTeams(current.id);
          })
        );
      }
    });

    await loadTeams();
  }

  guard(initTeams);
})();
