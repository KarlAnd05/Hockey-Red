/* ==========================================================================
   Lebanon Hockey admin - Shipping
   --------------------------------------------------------------------------
   Shipping zones, their rates, and the countries each covers.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, toast } = window.LH;
  const { openModal, closeModal, centsFromInput, guard } = window.LHAdmin;

  async function initShipping() {
    const host = document.querySelector('[data-shipping-zones]');
    let allCountries = [];

    const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2);

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading zones...</div>';
      const data = await api('/api/admin/shipping');
      allCountries = data.countries;

      const unassigned =
        allCountries.length - data.zones.reduce((n, z) => n + z.countries.length, 0);

      /* The catch-all prices every country nobody has mapped yet. Give it a
         free-shipping threshold and a large order to one of those 129
         countries ships for nothing, which is the one way this screen can
         quietly cost the federation money. Worth saying out loud. */
      const fallback = data.zones.find((z) => z.is_default);
      const leaks = fallback && fallback.free_over_cents > 0;

      host.innerHTML = `
        <p class="zone-note">
          ${escapeHtml(String(unassigned))} of ${escapeHtml(String(allCountries.length))} countries
          are not assigned to a zone and fall to the catch-all, so nothing ever ships for free by accident.
        </p>
        ${
          leaks
            ? `<p class="zone-warning">
                 <strong>${escapeHtml(fallback.name)}</strong> is the catch-all and has a free-shipping
                 threshold of ${escapeHtml(money(fallback.free_over_cents, 'cad'))}. Any order above that
                 going to one of the ${escapeHtml(String(unassigned))} unmapped countries will ship free.
                 Either clear the threshold on this zone or make a zone without one the catch-all.
               </p>`
            : ''
        }
        <div class="table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>Zone</th><th class="num">Base</th><th class="num">Per item</th>
                <th class="num">Free over</th><th>Delivery</th><th class="num">Countries</th>
                <th>Catch-all</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${data.zones
                .map(
                  (z) => `
                <tr data-zone="${z.id}">
                  <td class="cell-strong">${escapeHtml(z.name)}${
                    z.active ? '' : ' <span class="cell-muted">(off)</span>'
                  }</td>
                  <td class="num">${escapeHtml(money(z.flat_cents, 'cad'))}</td>
                  <td class="num">${z.per_item_cents ? escapeHtml(money(z.per_item_cents, 'cad')) : '—'}</td>
                  <td class="num">${z.free_over_cents ? escapeHtml(money(z.free_over_cents, 'cad')) : '—'}</td>
                  <td class="cell-muted">${z.delivery_min_days}–${z.delivery_max_days} days</td>
                  <td class="num">${z.countries.length}</td>
                  <td>${
                    z.is_default
                      ? '<span class="status-badge is-paid">Catch-all</span>'
                      : '<button type="button" class="mini-button" data-make-default>Make catch-all</button>'
                  }</td>
                  <td>
                    <div class="actions">
                      <button type="button" class="mini-button" data-edit>Edit</button>
                      ${
                        z.is_default
                          ? ''
                          : '<button type="button" class="mini-button danger" data-delete>Delete</button>'
                      }
                    </div>
                  </td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`;

      host.dataset.cache = JSON.stringify(data.zones);
    }

    function zoneForm(zone) {
      const isNew = !zone;
      const z = zone || {
        name: '', flat_cents: 0, per_item_cents: 0, free_over_cents: 0,
        delivery_min_days: 14, delivery_max_days: 21, active: 1, sort_order: 0, countries: [],
      };
      const chosen = new Set(z.countries || []);

      const modal = openModal(
        isNew ? 'New shipping zone' : `Edit ${z.name}`,
        `<form data-zone-form>
          <label>Zone name <input name="name" value="${escapeHtml(z.name)}" required maxlength="120"></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Base fee <input name="flat" type="number" step="0.01" min="0" value="${dollars(
              z.flat_cents
            )}"></label>
            <label>Per item <input name="perItem" type="number" step="0.01" min="0" value="${dollars(
              z.per_item_cents
            )}"></label>
          </div>
          <label>Free over <span class="cell-muted">(0 = never free)</span>
            <input name="freeOver" type="number" step="0.01" min="0" value="${dollars(z.free_over_cents)}">
          </label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Delivery from (days) <input name="minDays" type="number" min="0" value="${
              z.delivery_min_days
            }"></label>
            <label>Delivery to (days) <input name="maxDays" type="number" min="0" value="${
              z.delivery_max_days
            }"></label>
          </div>
          <label>Order <input name="sortOrder" type="number" value="${z.sort_order}"></label>

          <p class="cell-muted">Countries in this zone. A country can only be in one zone &mdash; ticking it here removes it from any other.</p>
          <div class="zone-countries">
            ${allCountries
              .map(
                (c) => `<label><input type="checkbox" name="country" value="${escapeHtml(c.code)}"${
                  chosen.has(c.code) ? ' checked' : ''
                }> ${escapeHtml(c.name)}</label>`
              )
              .join('')}
          </div>

          <label class="checkbox-row"><input type="checkbox" name="active" ${
            z.active ? 'checked' : ''
          }> Zone is in use</label>
        </form>`,
        '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button solid" data-save>Save zone</button>'
      );

      const form = modal.querySelector('[data-zone-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const v = Object.fromEntries(new FormData(form).entries());
          if (!String(v.name || '').trim()) throw new Error('Give the zone a name.');

          const body = {
            name: v.name,
            flatCents: centsFromInput(v.flat),
            perItemCents: centsFromInput(v.perItem),
            freeOverCents: centsFromInput(v.freeOver),
            deliveryMinDays: Number(v.minDays) || 0,
            deliveryMaxDays: Number(v.maxDays) || 0,
            sortOrder: Number(v.sortOrder) || 0,
            active: Boolean(v.active),
            countries: Array.from(form.querySelectorAll('[name="country"]:checked')).map((c) => c.value),
          };

          if (isNew) await api('/api/admin/shipping', { method: 'POST', body });
          else await api(`/api/admin/shipping/${z.id}`, { method: 'PATCH', body });

          toast(isNew ? 'Zone created.' : 'Zone updated.');
          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-zone]')?.addEventListener('click', () => zoneForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-zone]');
      if (!row) return;
      const zones = JSON.parse(host.dataset.cache || '[]');
      const zone = zones.find((x) => String(x.id) === row.dataset.zone);
      if (!zone) return;

      if (event.target.closest('[data-edit]')) zoneForm(zone);

      if (event.target.closest('[data-make-default]')) {
        guard(async () => {
          await api(`/api/admin/shipping/${zone.id}/default`, { method: 'PATCH' });
          toast(`${zone.name} is now the catch-all.`);
          await load();
        });
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete this zone?',
          `<div class="modal-body"><p>${escapeHtml(
            zone.name
          )} will be removed and its ${zone.countries.length} countries will fall to the catch-all zone.</p></div>`,
          '<button type="button" class="mini-button" data-modal-close>Cancel</button><button type="button" class="mini-button danger" data-confirm-delete>Delete</button>'
        );
        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/shipping/${zone.id}`, { method: 'DELETE' });
            closeModal();
            toast('Zone deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initShipping);
})();
