/**
 * Team roster.
 *
 * Rendered into an empty container so the rows stay out of the Page text editor
 * and so a program with no roster yet shows an honest empty state rather than
 * an empty table. The men's program has no published roster at the time of
 * writing; that is the case this is written around, not an afterthought.
 *
 * The table carries data-label on every cell. Below 720px the CSS turns each row
 * into a stacked card using those labels, because a five-column table at phone
 * width is unreadable and this list runs to dozens of players.
 */
(function () {
  'use strict';

  const host = document.querySelector('[data-roster]');
  if (!host || !window.LH) return;

  const { api, escapeHtml } = window.LH;

  const TEAM_LABEL = { national: 'National Team', next_gen: 'Next Generation' };
  let data = null;
  let activeTeam = null;

  function tableFor(group) {
    return `
      <div class="roster-group">
        <h3 class="roster-group-title">${escapeHtml(group.label)} <span>(${group.players.length})</span></h3>
        <div class="table-scroll">
          <table class="roster-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Most recent team</th>
                <th scope="col">Resides</th>
                <th scope="col">Hometown</th>
              </tr>
            </thead>
            <tbody>
              ${group.players
                .map(
                  (p) => `
                <tr>
                  <td data-label="Number" class="roster-number">${
                    p.number === null || p.number === undefined
                      ? '<span aria-label="no number">&mdash;</span>'
                      : escapeHtml(String(p.number))
                  }</td>
                  <td data-label="Name" class="roster-name">${escapeHtml(p.name)}</td>
                  <td data-label="Most recent team">${escapeHtml(p.recentTeam || '—')}</td>
                  <td data-label="Resides">${escapeHtml(p.resides || '—')}</td>
                  <td data-label="Hometown">${escapeHtml(p.hometown || '—')}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function render() {
    const team = data.teams.find((t) => t.team === activeTeam) || data.teams[0];

    const toggle =
      data.teams.length > 1
        ? `<div class="roster-tabs" role="tablist" aria-label="Team">
            ${data.teams
              .map(
                (t) => `<button type="button" role="tab" class="roster-tab${
                  t.team === team.team ? ' is-active' : ''
                }" aria-selected="${t.team === team.team}" data-team="${escapeHtml(t.team)}">
                  ${escapeHtml(TEAM_LABEL[t.team] || t.team)} <span>(${t.total})</span>
                </button>`
              )
              .join('')}
          </div>`
        : '';

    host.innerHTML = toggle + team.groups.map(tableFor).join('');
  }

  host.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-team]');
    if (!tab) return;
    activeTeam = tab.dataset.team;
    render();
  });

  (async () => {
    try {
      data = await api(`/api/roster?program=${encodeURIComponent(host.dataset.program || 'womens')}`);
    } catch {
      host.innerHTML = '';
      return;
    }

    if (!data.teams.length) {
      /* No roster published for this program yet. Say so plainly and point at
         the thing a reader can actually do. */
      host.innerHTML = `
        <div class="empty-state roster-empty">
          <h3>The roster for this program is not published yet</h3>
          <p>Players are selected ahead of each competition. If you want to be considered, register with the federation.</p>
          <a class="button ghost small" href="membership.html#register">Register to play</a>
        </div>`;
      return;
    }

    activeTeam = data.teams[0].team;
    render();
  })();
})();
