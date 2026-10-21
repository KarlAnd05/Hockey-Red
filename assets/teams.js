/* ==========================================================================
   Our Teams - the listing on teams.html.

   The per-team and per-player pages are rendered by the server so that shared
   links preview correctly and work without JavaScript; this file only builds
   the index.
   ========================================================================== */
(function () {
  'use strict';

  const host = document.querySelector('[data-teams]');
  if (!host) return;

  const { api, escapeHtml } = window.LH;

  function card(team) {
    const count = team.playerCount
      ? `${team.playerCount} ${team.playerCount === 1 ? 'player' : 'players'}`
      : 'Roster coming soon';

    return `<a class="team-card" href="/teams/${escapeHtml(team.slug)}">
        ${
          team.photoUrl
            ? `<img class="team-card-photo" src="${escapeHtml(team.photoUrl)}" alt="${escapeHtml(
                team.photoAlt || ''
              )}" loading="lazy">`
            : /* No photo yet. A full-height blank panel would take the room of a
                 photograph while saying nothing, so until there is one the card
                 gets a short branded band carrying the federation's cedar. */
              `<span class="team-card-band" aria-hidden="true">
                 <svg class="cedar-mark team-card-cedar"><use href="#cedar-mark"></use></svg>
               </span>`
        }
        <div class="team-card-body">
          ${team.tagline ? `<p class="eyebrow">${escapeHtml(team.tagline)}</p>` : ''}
          <h2>${escapeHtml(team.name)}</h2>
          ${team.description ? `<p>${escapeHtml(team.description)}</p>` : ''}
          <p class="team-card-count">${escapeHtml(count)}</p>
        </div>
      </a>`;
  }

  async function load() {
    try {
      const data = await api('/api/teams');
      const teams = data.teams || [];

      host.innerHTML = teams.length
        ? teams.map(card).join('')
        : '<p class="empty-note">Teams are being published. Check back soon.</p>';
    } catch (error) {
      host.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  load();
})();
