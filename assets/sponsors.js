/* ==========================================================================
   Sponsors - the partner cards on sponsors.html.

   These used to be hardcoded in the page. They come from the database now so
   the federation can add a partner without a code change.
   ========================================================================== */
(function () {
  'use strict';

  const host = document.querySelector('[data-sponsors]');
  if (!host) return;

  const { api, escapeHtml } = window.LH;

  function card(sponsor) {
    const name = sponsor.websiteUrl
      ? `<a href="${escapeHtml(sponsor.websiteUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          sponsor.name
        )}</a>`
      : escapeHtml(sponsor.name);

    return `<article class="info-card">
        <span class="tier ${escapeHtml(sponsor.tier)}">${escapeHtml(sponsor.tierLabel)}</span>
        ${
          sponsor.logoUrl
            ? `<img class="sponsor-logo" src="${escapeHtml(sponsor.logoUrl)}" alt="${escapeHtml(
                sponsor.logoAlt || sponsor.name
              )}" loading="lazy">`
            : ''
        }
        <h3>${name}</h3>
        ${sponsor.blurb ? `<p>${escapeHtml(sponsor.blurb)}</p>` : ''}
      </article>`;
  }

  async function load() {
    try {
      const data = await api('/api/sponsors');
      const sponsors = data.sponsors || [];

      host.innerHTML = sponsors.length
        ? sponsors.map(card).join('')
        : '<p class="empty-note">Partner announcements are on their way.</p>';
    } catch (error) {
      host.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
    }
  }

  load();
})();
