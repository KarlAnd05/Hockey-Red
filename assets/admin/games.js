/* ==========================================================================
   Lebanon Hockey admin - Games
   --------------------------------------------------------------------------
   Game sheets. Every player statistic on the site is derived
   from what is entered here, so nothing is ever typed twice.
   ========================================================================== */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, guard } = window.LHAdmin;

  async function initGames() {
    const listHost = document.querySelector('[data-games-list]');
    const sheetHost = document.querySelector('[data-game-sheet]');

    let teams = [];
    let roles = {};
    let homeAway = {};
    let statuses = {};
    let openGameId = null;
    let openGame = null;
    let sheet = [];
    let candidates = { players: [], registrations: [] };

    const dateLabel = (value) => (value ? formatDate(value) : 'Date not set');

    /* The site-wide switch. A game's own publish toggle only matters once the
       section itself is on, so this says which it is at a glance. */
    const sectionButton = document.querySelector('[data-section-toggle]');

    function paintSectionToggle(visible) {
      if (!sectionButton) return;
      sectionButton.dataset.on = visible ? '1' : '';
      sectionButton.className = `toggle-pill ${visible ? 'on' : 'off'}`;
      sectionButton.textContent = visible ? 'Section on' : 'Section off';
      sectionButton.title = visible
        ? 'Game sheets are on the public site. Click to take the whole section down.'
        : 'The game sheets section is hidden from the public site, link and all.';
    }

    sectionButton?.addEventListener('click', () =>
      guard(async () => {
        const answer = await api('/api/admin/games/section', {
          method: 'POST',
          body: { visible: !sectionButton.dataset.on },
        });
        paintSectionToggle(answer.sectionVisible);
        toast(answer.sectionVisible ? 'Game sheets are public.' : 'Game sheets are hidden.');
      })
    );

    async function loadList() {
      listHost.innerHTML = '<div class="admin-loading">Loading games...</div>';
      const data = await api('/api/admin/games');
      teams = data.teams;
      roles = data.roles;
      homeAway = data.homeAway;
      statuses = data.statuses;
      paintSectionToggle(data.sectionVisible);

      if (!data.games.length) {
        listHost.innerHTML =
          '<div class="admin-empty">No games yet. Use New game to start a sheet.</div>';
        return;
      }

      listHost.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Date</th><th>Opponent</th><th>Team</th><th>Venue</th>
                <th class="num">Score</th><th class="num">Named</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${data.games
                .map(
                  (g) => `
                <tr data-game="${g.id}">
                  <td class="cell-muted">${escapeHtml(dateLabel(g.playedAt))}</td>
                  <td class="cell-strong">${escapeHtml(g.opponent)}<br>
                    <span class="cell-muted">${escapeHtml(g.homeAwayLabel)}${
                      g.competition ? ` &middot; ${escapeHtml(g.competition)}` : ''
                    }</span></td>
                  <td>${escapeHtml(g.teamName || '-')}</td>
                  <td class="cell-muted">${escapeHtml(g.venue || '-')}</td>
                  <td class="num">${
                    g.scoreFor === null || g.scoreAgainst === null
                      ? '-'
                      : `${escapeHtml(String(g.scoreFor))}&ndash;${escapeHtml(String(g.scoreAgainst))}`
                  }</td>
                  <td class="num">${g.lineCount}</td>
                  <td><span class="status-badge is-${
                    g.status === 'final' ? 'paid' : g.status === 'cancelled' ? 'cancelled' : 'pending'
                  }">${escapeHtml(g.statusLabel)}</span></td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button solid" data-open-sheet>Sheet</button>
                      <button type="button" class="mini-button" data-go-live>Go live</button>
                      <button type="button" class="mini-button" data-edit-game>Edit</button>
                      <button type="button" class="mini-button danger" data-delete-game>Delete</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      listHost.dataset.cache = JSON.stringify(data.games);
    }

    /* --- The sheet itself -------------------------------------------------- */
    async function loadSheet(id) {
      openGameId = id;
      sheetHost.hidden = false;
      sheetHost.innerHTML = '<div class="admin-loading">Loading sheet...</div>';

      const data = await api(`/api/admin/games/${id}`);
      openGame = data.game;
      sheet = data.sheet;
      candidates = data.candidates;
      renderSheet(data.game);
      sheetHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderSheet(game) {
      const total = sheet.length;
      const linked = sheet.filter((l) => l.membership).length;

      sheetHost.innerHTML = `
        <div class="sheet-head">
          <div>
            <h2>${escapeHtml(game.opponent)} <span class="cell-muted">${escapeHtml(
              dateLabel(game.playedAt)
            )}</span></h2>
            <p class="cell-muted">
              ${escapeHtml(game.teamName || 'No team set')} &middot; ${escapeHtml(game.homeAwayLabel)}
              ${game.venue ? ` &middot; ${escapeHtml(game.venue)}` : ''}
            </p>
            <p class="cell-muted">${escapeHtml(String(total))} named, ${escapeHtml(
              String(linked)
            )} linked to a membership record.</p>
          </div>
          <div class="actions">
            <button type="button" class="toggle-pill ${game.published ? 'on' : 'off'}" data-publish>${
              game.published ? 'On the public site' : 'Not public'
            }</button>
            <button type="button" class="mini-button" data-fill-roster>Add whole roster</button>
            <button type="button" class="mini-button solid" data-add-line>Add person</button>
            <button type="button" class="mini-button" data-close-sheet>Close</button>
          </div>
        </div>

        ${
          total
            ? `<div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th class="num">#</th><th>Name</th><th>Position</th><th>Role</th>
                <th>Membership</th><th>Note</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${sheet
                .map(
                  (l) => `
                <tr data-line="${l.id}">
                  <td class="num">${l.jerseyNumber == null ? '-' : escapeHtml(String(l.jerseyNumber))}</td>
                  <td class="cell-strong">${escapeHtml(l.name || 'Unnamed')}</td>
                  <td class="cell-muted">${escapeHtml(l.position || '-')}</td>
                  <td>${escapeHtml(l.roleLabel)}</td>
                  <td class="cell-muted">${
                    l.membership
                      ? `${escapeHtml(l.membership.email)}${
                          l.membership.dateOfBirth
                            ? `<br>born ${escapeHtml(l.membership.dateOfBirth)}`
                            : ''
                        }`
                      : '<span class="cell-muted">Not linked</span>'
                  }</td>
                  <td class="cell-muted">${escapeHtml(l.note || '')}</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-line>Edit</button>
                      <button type="button" class="mini-button danger" data-remove-line>Remove</button>
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
            : '<div class="admin-empty">Nobody on this sheet yet.</div>'
        }`;
    }

    /* --- Game editor ------------------------------------------------------- */
    function gameForm(game) {
      const isNew = !game;
      const g = game || {
        opponent: '', playedAt: '', venue: '', competition: '', homeAway: 'home',
        scoreFor: null, scoreAgainst: null, status: 'draft', notes: '', teamId: null,
      };

      const modal = openModal(
        isNew ? 'New game' : `Edit ${g.opponent}`,
        `<form data-game-form>
          <label>Opponent <input name="opponent" value="${escapeHtml(
            g.opponent
          )}" required maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Date <input name="playedAt" type="date" value="${escapeHtml(
              String(g.playedAt || '').slice(0, 10)
            )}"></label>
            <label>Team
              <select name="teamId">
                <option value="">No team</option>
                ${teams
                  .map(
                    (t) =>
                      `<option value="${t.id}"${
                        String(t.id) === String(g.teamId) ? ' selected' : ''
                      }>${escapeHtml(t.name)}</option>`
                  )
                  .join('')}
              </select>
            </label>
          </div>

          <label>Venue <input name="venue" value="${escapeHtml(g.venue)}" maxlength="200"></label>
          <label>Competition <input name="competition" value="${escapeHtml(
            g.competition
          )}" maxlength="200"></label>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <label>Home or away
              <select name="homeAway">
                ${Object.entries(homeAway)
                  .map(
                    ([key, label]) =>
                      `<option value="${escapeHtml(key)}"${
                        g.homeAway === key ? ' selected' : ''
                      }>${escapeHtml(label)}</option>`
                  )
                  .join('')}
              </select>
            </label>
            <label>Goals for <input name="scoreFor" type="number" min="0" value="${
              g.scoreFor == null ? '' : escapeHtml(String(g.scoreFor))
            }"></label>
            <label>Goals against <input name="scoreAgainst" type="number" min="0" value="${
              g.scoreAgainst == null ? '' : escapeHtml(String(g.scoreAgainst))
            }"></label>
          </div>

          <label>Status
            <select name="status">
              ${Object.entries(statuses)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}"${
                      g.status === key ? ' selected' : ''
                    }>${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Notes <textarea name="notes" rows="4" maxlength="4000">${escapeHtml(
            g.notes
          )}</textarea></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save game</button>'
      );

      const form = modal.querySelector('[data-game-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.opponent || '').trim()) throw new Error('Name the opponent.');

          const body = {
            opponent: v.opponent,
            playedAt: v.playedAt,
            venue: v.venue,
            competition: v.competition,
            homeAway: v.homeAway,
            scoreFor: v.scoreFor === '' ? null : Number(v.scoreFor),
            scoreAgainst: v.scoreAgainst === '' ? null : Number(v.scoreAgainst),
            status: v.status,
            notes: v.notes,
            teamId: v.teamId === '' ? null : Number(v.teamId),
          };

          if (isNew) await api('/api/admin/games', { method: 'POST', body });
          else await api(`/api/admin/games/${g.id}`, { method: 'PATCH', body });

          closeModal();
          toast(isNew ? 'Game created.' : 'Game updated.');
          await loadList();
          if (!isNew && openGameId === g.id) await loadSheet(g.id);
        })
      );
    }

    /* --- Adding somebody to a sheet ---------------------------------------- */
    function addLineForm() {
      const modal = openModal(
        'Add to the sheet',
        `<form data-line-form>
          <label>From the roster
            <select name="playerId" data-player-pick>
              <option value="">Not from the roster</option>
              ${candidates.players
                .map(
                  (p) =>
                    `<option value="${p.id}" data-number="${
                      p.jerseyNumber == null ? '' : p.jerseyNumber
                    }" data-position="${escapeHtml(p.position || '')}">${escapeHtml(p.name)}${
                      p.jerseyNumber == null ? '' : ` (#${p.jerseyNumber})`
                    }</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Membership record <span class="cell-muted">(paid members only)</span>
            <select name="registrationId" data-member-pick>
              <option value="">Not linked</option>
              ${candidates.registrations
                .map(
                  (r) =>
                    `<option value="${r.id}" data-position="${escapeHtml(
                      r.position || ''
                    )}" data-name="${escapeHtml(r.name)}">${escapeHtml(r.name)} &mdash; ${escapeHtml(
                      r.email
                    )}</option>`
                )
                .join('')}
            </select>
          </label>

          <p class="cell-muted">Linking both is normal: the roster gives the name and number, the membership record carries the paperwork. Someone who is on neither can still be typed in below.</p>

          <label>Name on the sheet <span class="cell-muted">(leave blank to use the linked record)</span>
            <input name="name" maxlength="160">
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Number <input name="jerseyNumber" type="number" min="0" max="99"></label>
            <label>Position <input name="position" maxlength="40"></label>
          </div>

          <label>Role
            <select name="role">
              ${Object.entries(roles)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>

          <label>Note <input name="note" maxlength="400"></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Add</button>'
      );

      const form = modal.querySelector('[data-line-form]');

      /* Pre-fill from whichever record was picked, so the details the system
         already holds are never retyped. */
      form.querySelector('[data-player-pick]').addEventListener('change', (event) => {
        const option = event.target.selectedOptions[0];
        if (!option || !option.value) return;
        if (!form.jerseyNumber.value) form.jerseyNumber.value = option.dataset.number || '';
        if (!form.position.value) form.position.value = option.dataset.position || '';
      });

      form.querySelector('[data-member-pick]').addEventListener('change', (event) => {
        const option = event.target.selectedOptions[0];
        if (!option || !option.value) return;
        if (!form.position.value) form.position.value = option.dataset.position || '';
        if (!form.name.value && !form.playerId.value) form.name.value = option.dataset.name || '';
      });

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!v.playerId && !v.registrationId && !String(v.name || '').trim()) {
            throw new Error('Pick a player or a member, or type a name.');
          }

          await api(`/api/admin/games/${openGameId}/sheet`, {
            method: 'POST',
            body: {
              playerId: v.playerId === '' ? null : Number(v.playerId),
              registrationId: v.registrationId === '' ? null : Number(v.registrationId),
              name: v.name,
              jerseyNumber: v.jerseyNumber === '' ? null : Number(v.jerseyNumber),
              position: v.position,
              role: v.role,
              note: v.note,
            },
          });

          closeModal();
          toast('Added to the sheet.');
          await loadSheet(openGameId);
          await loadList();
        })
      );
    }

    function editLineForm(line) {
      /* Once events exist these columns are a projection of them, so they are
         shown read-only rather than offering an edit the server will ignore. */
      const derived = Boolean(openGame && openGame.eventsMode);
      const ro = derived ? ' readonly' : '';

      const modal = openModal(
        `Edit ${line.name || 'line'}`,
        `<form data-line-edit>
          <label>Name on the sheet <input name="name" value="${escapeHtml(
            line.name
          )}" maxlength="160"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Number <input name="jerseyNumber" type="number" min="0" max="99" value="${
              line.jerseyNumber == null ? '' : escapeHtml(String(line.jerseyNumber))
            }"></label>
            <label>Position <input name="position" value="${escapeHtml(
              line.position
            )}" maxlength="40"></label>
          </div>
          <label>Role
            <select name="role">
              ${Object.entries(roles)
                .map(
                  ([key, label]) =>
                    `<option value="${escapeHtml(key)}"${
                      line.role === key ? ' selected' : ''
                    }>${escapeHtml(label)}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="checkbox-row"><input type="checkbox" name="played" ${
            line.played ? 'checked' : ''
          }> Dressed and played</label>
          <p class="cell-muted">Untick for a scratch. They stay on the sheet but the game does not count towards their record.</p>

          <h3 class="modal-subhead">Statistics</h3>
          <p class="cell-muted">${
            derived
              ? 'Calculated from the event list on the live screen. Correct the events there, not here.'
              : 'These feed the player&rsquo;s profile page automatically &mdash; nothing is typed twice.'
          }</p>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <label>Goals <input name="goals" type="number" min="0"${ro} value="${line.goals}"></label>
            <label>Assists <input name="assists" type="number" min="0"${ro} value="${line.assists}"></label>
            <label>Penalty mins <input name="penaltyMinutes" type="number" min="0"${ro} value="${
              line.penaltyMinutes
            }"></label>
          </div>

          <p class="cell-muted">Goaltenders only:</p>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <label>Shots against <input name="shotsAgainst" type="number" min="0"${ro} value="${
              line.shotsAgainst
            }"></label>
            <label>Saves <input name="saves" type="number" min="0"${ro} value="${line.saves}"></label>
            <label>Result
              <select name="decision">
                ${['', 'W', 'L', 'OTL']
                  .map(
                    (d) =>
                      `<option value="${d}"${line.decision === d ? ' selected' : ''}>${
                        d || '—'
                      }</option>`
                  )
                  .join('')}
            </select></label>
          </div>

          <label>Note <input name="note" value="${escapeHtml(line.note)}" maxlength="400"></label>
          <label>Order <input name="sortOrder" type="number" value="${line.sortOrder}"></label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
      );

      const form = modal.querySelector('[data-line-edit]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          await api(`/api/admin/games/${openGameId}/sheet/${line.id}`, {
            method: 'PATCH',
            body: {
              name: v.name,
              jerseyNumber: v.jerseyNumber === '' ? null : Number(v.jerseyNumber),
              position: v.position,
              role: v.role,
              note: v.note,
              sortOrder: Number(v.sortOrder) || 0,
              played: Boolean(v.played),
              goals: Number(v.goals) || 0,
              assists: Number(v.assists) || 0,
              penaltyMinutes: Number(v.penaltyMinutes) || 0,
              shotsAgainst: Number(v.shotsAgainst) || 0,
              saves: Number(v.saves) || 0,
              decision: v.decision || '',
            },
          });

          closeModal();
          toast('Line updated.');
          await loadSheet(openGameId);
        })
      );
    }

    /* --- Wiring ------------------------------------------------------------ */
    document.querySelector('[data-new-game]')?.addEventListener('click', () => gameForm(null));

    listHost.addEventListener('click', (event) => {
      const row = event.target.closest('[data-game]');
      if (!row) return;
      const games = JSON.parse(listHost.dataset.cache || '[]');
      const game = games.find((g) => String(g.id) === row.dataset.game);
      if (!game) return;

      if (event.target.closest('[data-open-sheet]')) guard(() => loadSheet(game.id));
      if (event.target.closest('[data-go-live]')) window.location.href = `live.html?game=${game.id}`;
      if (event.target.closest('[data-edit-game]')) gameForm(game);

      if (event.target.closest('[data-delete-game]')) {
        const modal = openModal(
          'Delete this game?',
          `<div class="modal-body"><p>${escapeHtml(game.opponent)} and everyone named on its sheet will be removed.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm>Delete</button>'
        );
        modal.querySelector('[data-confirm]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/games/${game.id}`, { method: 'DELETE' });
            closeModal();
            toast('Game deleted.');
            if (openGameId === game.id) {
              sheetHost.hidden = true;
              openGameId = null;
            }
            await loadList();
          })
        );
      }
    });

    sheetHost.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-sheet]')) {
        sheetHost.hidden = true;
        openGameId = null;
        return;
      }

      if (event.target.closest('[data-add-line]')) {
        addLineForm();
        return;
      }

      if (event.target.closest('[data-publish]')) {
        guard(async () => {
          const was = openGame.published;
          await api(`/api/admin/games/${openGameId}/${was ? 'unpublish' : 'publish'}`, {
            method: 'POST',
          });
          toast(was ? 'Taken off the public site.' : 'Published.');
          await loadSheet(openGameId);
        });
        return;
      }

      if (event.target.closest('[data-fill-roster]')) {
        guard(async () => {
          const result = await api(`/api/admin/games/${openGameId}/sheet/fill`, { method: 'POST' });
          toast(
            result.added
              ? `Added ${result.added} player${result.added === 1 ? '' : 's'}.`
              : 'Everyone on the roster is already named.'
          );
          await loadSheet(openGameId);
          await loadList();
        });
        return;
      }

      const row = event.target.closest('[data-line]');
      if (!row) return;
      const line = sheet.find((l) => String(l.id) === row.dataset.line);
      if (!line) return;

      if (event.target.closest('[data-edit-line]')) editLineForm(line);

      if (event.target.closest('[data-remove-line]')) {
        guard(async () => {
          await api(`/api/admin/games/${openGameId}/sheet/${line.id}`, { method: 'DELETE' });
          toast('Removed from the sheet.');
          await loadSheet(openGameId);
          await loadList();
        });
      }
    });

    await loadList();
  }

  guard(initGames);
})();
