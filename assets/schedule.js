/* ==========================================================================
   Programs and schedule - the list on events.html.

   The section hides itself when there is nothing to show, so an empty schedule
   reads as "not published yet" rather than as a broken page.
   ========================================================================== */
(function () {
  'use strict';

  const section = document.querySelector('[data-schedule-section]');
  const host = document.querySelector('[data-schedule]');
  if (!section || !host) return;

  const { api, escapeHtml, formatDate } = window.LH;

  /* A single day shows one date; a range shows both, and collapses to one when
     the start and end are the same day. */
  function when(entry) {
    if (!entry.startsAt) return 'Date to be announced';
    const start = formatDate(entry.startsAt);
    if (!entry.endsAt || entry.endsAt === entry.startsAt) return start;
    return `${start} &ndash; ${formatDate(entry.endsAt)}`;
  }

  function row(entry) {
    const meta = [entry.location, entry.teamName].filter(Boolean);

    return `<article class="schedule-row">
        <div class="schedule-when">
          <span class="schedule-kind">${escapeHtml(entry.kindLabel)}</span>
          <span class="schedule-date">${when(entry)}</span>
        </div>
        <div class="schedule-body">
          <h3>${escapeHtml(entry.title)}</h3>
          ${meta.length ? `<p class="schedule-meta">${escapeHtml(meta.join(' · '))}</p>` : ''}
          ${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ''}
          ${
            entry.linkUrl
              ? `<a class="button secondary small" href="${escapeHtml(entry.linkUrl)}">${escapeHtml(
                  entry.linkLabel || 'More details'
                )}</a>`
              : ''
          }
        </div>
      </article>`;
  }

  async function load() {
    try {
      const data = await api('/api/programs');
      const entries = data.programs || [];
      if (!entries.length) return;

      section.hidden = false;
      host.innerHTML = entries.map(row).join('');
    } catch {
      /* A schedule that cannot load must not break the rest of the page. */
    }
  }

  load();
})();
