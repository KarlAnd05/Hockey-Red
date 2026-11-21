/* ==========================================================================
   Lebanon Hockey admin - Registrations
   --------------------------------------------------------------------------
   Membership applications and their payment state.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, statusBadge, guard } = window.LHAdmin;

  async function initRegistrations() {
    const statsHost = document.querySelector('[data-registration-stats]');
    const host = document.querySelector('[data-registrations]');
    const search = document.querySelector('[data-registration-search]');
    let timer = null;

    /* The exports follow the search, so what downloads is what is on screen -
       an administrator who has filtered to one family should not get all 400
       records in the file. */
    function syncExportLinks() {
      const term = (search?.value || '').trim();
      const query = term ? `?search=${encodeURIComponent(term)}` : '';
      const xlsx = document.querySelector('[data-export-xlsx]');
      const csv = document.querySelector('[data-export-csv]');
      if (xlsx) xlsx.href = `/api/admin/registrations.xlsx${query}`;
      if (csv) csv.href = `/api/admin/registrations.csv${query}`;
    }

    async function load() {
      const term = (search?.value || '').trim();
      host.innerHTML = '<div class="admin-loading">Loading registrations...</div>';
      const data = await api(
        `/api/admin/registrations${term ? `?search=${encodeURIComponent(term)}` : ''}`
      );
      const t = data.totals;
      syncExportLinks();

      if (statsHost) {
        statsHost.innerHTML = [
          ['Registrations', String(t.count), 'All applications received'],
          ['Paid', String(t.paid), 'Fee received'],
          ['Awaiting payment', String(t.unpaid), 'Usually e-transfer'],
          ['Collected', money(t.collectedCents, data.currency), 'From paid memberships'],
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

      if (!data.registrations.length) {
        host.innerHTML =
          '<div class="admin-empty"><h3>No registrations yet</h3><p>Applications from the membership form will appear here.</p></div>';
        host.dataset.cache = '[]';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr><th>Name</th><th>Type</th><th class="num">Fee</th><th>Payment</th><th>Received</th><th></th></tr>
            </thead>
            <tbody>
              ${data.registrations
                .map(
                  (r) => `
                <tr data-registration="${r.id}">
                  <td>
                    <div class="cell-strong">${escapeHtml(
                      [r.firstName, r.lastName].filter(Boolean).join(' ')
                    )}</div>
                    <div class="cell-muted">${escapeHtml(r.email)}</div>
                  </td>
                  <td>${escapeHtml(r.tierLabel)}</td>
                  <td class="num">${escapeHtml(money(r.amountCents, r.currency))}</td>
                  <td>${statusBadge(r.paymentStatus)}</td>
                  <td class="cell-muted">${escapeHtml(formatDate(r.createdAt))}</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-view>Open</button>
                      ${
                        r.paymentStatus !== 'paid'
                          ? '<button type="button" class="mini-button solid" data-mark-paid>Mark paid</button>'
                          : ''
                      }
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.registrations);
    }

    /* The eligibility fields are only rendered when a record is deliberately
       opened, rather than sitting in the table where they would be on screen
       for anyone walking past. */
    function detail(r) {
      const row = (label, value) =>
        value ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>` : '';

      openModal(
        `${r.firstName} ${r.lastName}`.trim() || 'Registration',
        `<div class="modal-body">
          <table class="data reg-detail">
            <tbody>
              ${row('Membership', r.tierLabel)}
              ${row('Fee', money(r.amountCents, r.currency))}
              ${row('Payment', r.paymentStatus)}
              ${row('Email', r.email)}
              ${row('Phone', r.phone)}
              ${row('Full name', [r.firstName, r.middleName, r.lastName].filter(Boolean).join(' '))}
              ${row('City of residence', r.cityOfResidence)}
              ${row('Date of birth', r.dateOfBirth)}
              ${row('Position', r.position)}
              ${row('Shoots', r.shoots)}
              ${row('Height', r.heightCm ? `${r.heightCm} cm` : '')}
              ${row('Weight', r.weightKg ? `${r.weightKg} kg` : '')}
              ${row('Place of birth', r.placeOfBirth)}
              ${row('Country of birth', r.countryOfBirth)}
              ${row('Citizenship', r.citizenship)}
              ${row('Second citizenship', r.citizenshipSecond)}
              ${row("Father's citizenship", r.citizenshipFather)}
              ${row("Mother's citizenship", r.citizenshipMother)}
              ${row('Highest level played', r.highestLevelPlayed)}
              ${row('Message', r.message)}
              ${row('Received', formatDate(r.createdAt))}
            </tbody>
          </table>
        </div>`,
        '<button type="button" class="mini-button" data-modal-close>Close</button>'
      );
    }

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-registration]');
      if (!row) return;
      const all = JSON.parse(host.dataset.cache || '[]');
      const r = all.find((x) => String(x.id) === row.dataset.registration);
      if (!r) return;

      if (event.target.closest('[data-view]')) detail(r);

      if (event.target.closest('[data-mark-paid]')) {
        guard(async () => {
          await api(`/api/admin/registrations/${r.id}/paid`, { method: 'PATCH' });
          toast('Marked as paid.');
          await load();
        });
      }
    });

    search?.addEventListener('input', () => {
      syncExportLinks();
      clearTimeout(timer);
      timer = setTimeout(() => guard(load), 250);
    });

    await load();
  }

  guard(initRegistrations);
})();
