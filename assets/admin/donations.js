/* ==========================================================================
   Lebanon Hockey admin - Donations
   --------------------------------------------------------------------------
   Gifts, one-off and monthly, and the public leaderboard.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, statusBadge, guard } = window.LHAdmin;

  async function initDonations() {
    const statsHost = document.querySelector('[data-donation-stats]');
    const host = document.querySelector('[data-donations]');

    const KIND = { one_time: 'One time', monthly: 'Monthly' };

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading donations...</div>';
      const data = await api('/api/admin/donations');
      const t = data.totals;

      if (statsHost) {
        statsHost.innerHTML = [
          ['Received', money(t.receivedCents, data.currency), 'All gifts actually collected'],
          ['One-time', money(t.oneTimeCents, data.currency), 'Single gifts'],
          ['Recurring', money(t.recurringCents, data.currency), 'Collected from monthly donors'],
          ['Monthly donors', String(t.activeMonthly), `${money(t.monthlyValueCents, data.currency)} per month`],
        ]
          .map(
            ([label, value, sub]) => `
        <div class="stat-card">
          <span class="label">${escapeHtml(label)}</span>
          <div class="value">${escapeHtml(value)}</div>
          <p class="sub">${escapeHtml(sub)}</p>
        </div>`
          )
          .join('');
      }

      if (!data.donations.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No donations yet</h3><p>Gifts made through the donation page will appear here.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Donor</th>
                <th>Kind</th>
                <th class="num">Amount</th>
                <th>Status</th>
                <th class="num">Charges</th>
                <th>Leaderboard</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${data.donations
                .map(
                  (d) => `
                <tr>
                  <td>
                    <div class="cell-strong">${escapeHtml(d.name || 'Anonymous')}</div>
                    <div class="cell-muted">${escapeHtml(d.email || '')}</div>
                    ${d.message ? `<div class="cell-muted">&ldquo;${escapeHtml(d.message)}&rdquo;</div>` : ''}
                  </td>
                  <td>${escapeHtml(KIND[d.kind] || d.kind)}</td>
                  <td class="num">
                    <div class="cell-strong">${escapeHtml(money(d.totalCents, d.currency))}${
                      d.isRecurring ? ' /mo' : ''
                    }</div>
                    ${
                      d.feeCents > 0
                        ? `<div class="cell-muted">incl. ${escapeHtml(money(d.feeCents, d.currency))} fee</div>`
                        : ''
                    }
                  </td>
                  <td>${statusBadge(d.status)}</td>
                  <td class="num">${d.isRecurring ? (d.payments ? d.payments.length : 0) : '-'}</td>
                  <td data-donation="${d.id}">
                    ${
                      d.displayPublicly
                        ? `<div class="cell-strong">${escapeHtml(d.publicName || d.name || 'No name')}</div>
                           <div class="cell-muted">${
                             d.status === 'paid' || d.status === 'active'
                               ? 'Shown publicly'
                               : 'Opted in, hidden until paid'
                           }</div>`
                        : '<div class="cell-muted">Not listed</div>'
                    }
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit-visibility>${
                        d.displayPublicly ? 'Edit' : 'Add'
                      }</button>
                      ${
                        d.displayPublicly
                          ? '<button type="button" class="mini-button danger" data-remove-visibility>Remove</button>'
                          : ''
                      }
                    </div>
                  </td>
                  <td class="cell-muted">${escapeHtml(formatDate(d.paidAt || d.createdAt))}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.donations);
    }

    /* The leaderboard entry only. Nothing here can change the amount, the
       status or the donor's own record - taking a name off the public page is
       deliberately not an edit of the gift. */
    host.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-donation]');
      if (!cell) return;
      const donations = JSON.parse(host.dataset.cache || '[]');
      const donation = donations.find((d) => String(d.id) === cell.dataset.donation);
      if (!donation) return;

      if (event.target.closest('[data-remove-visibility]')) {
        guard(async () => {
          await api(`/api/admin/donations/${donation.id}/visibility`, {
            method: 'PATCH',
            body: { displayPublicly: false, publicName: donation.publicName },
          });
          toast('Removed from the leaderboard. The donation is unchanged.');
          await load();
        });
        return;
      }

      if (event.target.closest('[data-edit-visibility]')) {
        const modal = openModal(
          'Leaderboard entry',
          `<form data-visibility-form>
            <p class="cell-muted">This changes only how the gift appears on the public leaderboard. The donation itself is not touched.</p>
            <label>Name to show <span class="cell-muted">(blank uses &ldquo;${escapeHtml(
              donation.name || 'Anonymous'
            )}&rdquo;)</span>
              <input name="publicName" value="${escapeHtml(
                donation.publicName
              )}" maxlength="160">
            </label>
            <label class="checkbox-row"><input type="checkbox" name="displayPublicly" ${
              donation.displayPublicly ? 'checked' : ''
            }> List this gift on the public leaderboard</label>
            ${
              donation.status === 'paid' || donation.status === 'active'
                ? ''
                : '<p class="cell-muted">This gift is not settled yet, so it stays off the page until it is paid even with this ticked.</p>'
            }
          </form>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save</button>'
        );

        modal.querySelector('[data-save]').addEventListener('click', () =>
          guard(async () => {
            const form = modal.querySelector('[data-visibility-form]');
            const v = Object.fromEntries(new FormData(form).entries());

            await api(`/api/admin/donations/${donation.id}/visibility`, {
              method: 'PATCH',
              body: {
                displayPublicly: Boolean(v.displayPublicly),
                publicName: v.publicName,
              },
            });

            closeModal();
            toast('Leaderboard entry updated.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initDonations);
})();
