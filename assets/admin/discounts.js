/* ==========================================================================
   Lebanon Hockey admin - Discounts
   --------------------------------------------------------------------------
   Discount codes: percentage or fixed, limits and redemptions.
   ========================================================================== */
(function () {
  'use strict';

  const { api, money, escapeHtml, formatDate, toast } = window.LH;
  const { openModal, closeModal, centsFromInput, guard } = window.LHAdmin;

  async function initDiscounts() {
    const host = document.querySelector('[data-discounts]');

    async function load() {
      host.innerHTML = '<div class="admin-loading">Loading discounts...</div>';
      const data = await api('/api/admin/discounts');

      if (!data.discounts.length) {
        host.innerHTML = '<div class="admin-empty"><h3>No discount codes</h3><p>Create a code to run a promotion.</p></div>';
        return;
      }

      host.innerHTML = `
        <div class="table-scroll"><table class="data">
          <thead><tr><th>Code</th><th>Value</th><th class="num">Min spend</th><th>Window</th><th class="num">Used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${data.discounts
              .map(
                (d) => `
              <tr data-discount="${d.id}">
                <td class="cell-strong">${escapeHtml(d.code)}</td>
                <td>${d.type === 'percent' ? `${d.value}%` : money(d.value, data.currency)}</td>
                <td class="num cell-muted">${d.minSubtotalCents ? money(d.minSubtotalCents, data.currency) : '-'}</td>
                <td class="cell-muted">${
                  d.startsAt || d.endsAt
                    ? `${d.startsAt ? formatDate(d.startsAt) : 'any'} - ${d.endsAt ? formatDate(d.endsAt) : 'any'}`
                    : 'Always'
                }</td>
                <td class="num">${d.timesRedeemed}${d.maxRedemptions ? ` / ${d.maxRedemptions}` : ''}</td>
                <td>
                  <button type="button" class="toggle-pill ${d.active ? 'on' : 'off'}" data-toggle-discount>
                    ${d.active ? 'Active' : 'Off'}
                  </button>
                </td>
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
        </table></div>`;

      host.dataset.cache = JSON.stringify(data.discounts);
    }

    function discountForm(discount) {
      const isNew = !discount;
      const d = discount || {
        code: '',
        type: 'percent',
        value: 10,
        minSubtotalCents: 0,
        startsAt: '',
        endsAt: '',
        maxRedemptions: 0,
        active: true,
      };

      const modal = openModal(
        isNew ? 'New discount code' : `Edit ${d.code}`,
        `<form data-discount-form>
          <label>Code
            <input type="text" name="code" value="${escapeHtml(d.code)}" ${isNew ? '' : 'readonly'}
                   placeholder="CEDAR10" style="text-transform:uppercase" required>
          </label>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Type
              <select name="type">
                <option value="percent" ${d.type === 'percent' ? 'selected' : ''}>Percent off</option>
                <option value="fixed" ${d.type === 'fixed' ? 'selected' : ''}>Fixed amount off</option>
              </select>
            </label>
            <label>Value
              <input type="number" name="value" min="1" value="${d.type === 'fixed' ? (d.value / 100).toFixed(2) : d.value}" required>
            </label>
          </div>
          <p class="cell-muted" style="margin:-8px 0 0;font-size:12.5px">
            Percent codes take a whole number (10 = 10%). Fixed codes take an amount (25 = $25.00 off).
          </p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Minimum spend
              <input type="text" name="minSpend" value="${(d.minSubtotalCents / 100).toFixed(2)}">
            </label>
            <label>Max redemptions
              <input type="number" name="maxRedemptions" min="0" value="${d.maxRedemptions}" placeholder="0 = unlimited">
            </label>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <label>Starts<input type="date" name="startsAt" value="${(d.startsAt || '').slice(0, 10)}"></label>
            <label>Ends<input type="date" name="endsAt" value="${(d.endsAt || '').slice(0, 10)}"></label>
          </div>

          <label class="checkbox-row" style="text-transform:none;letter-spacing:0">
            <input type="checkbox" name="active" ${d.active ? 'checked' : ''}> Active
          </label>
        </form>`,
        `<button type="button" class="mini-button" data-modal-close>Cancel</button>
         <button type="button" class="mini-button solid" data-save>Save code</button>`
      );

      const form = modal.querySelector('[data-discount-form]');

      modal.querySelector('[data-save]').addEventListener('click', () =>
        guard(async () => {
          const values = Object.fromEntries(new FormData(form).entries());

          const body = {
            code: String(values.code || '').toUpperCase(),
            type: values.type,
            value:
              values.type === 'fixed'
                ? centsFromInput(values.value)
                : Math.round(Number(values.value) || 0),
            minSubtotalCents: centsFromInput(values.minSpend),
            maxRedemptions: Number(values.maxRedemptions) || 0,
            startsAt: values.startsAt || null,
            endsAt: values.endsAt || null,
            active: form.active.checked,
          };

          if (!body.code) throw new Error('A code is required.');

          if (isNew) {
            await api('/api/admin/discounts', { method: 'POST', body });
            toast('Discount created.', 'success');
          } else {
            await api(`/api/admin/discounts/${d.id}`, { method: 'PATCH', body });
            toast('Discount saved.', 'success');
          }

          closeModal();
          await load();
        })
      );
    }

    document.querySelector('[data-new-discount]')?.addEventListener('click', () => discountForm(null));

    host.addEventListener('click', (event) => {
      const row = event.target.closest('[data-discount]');
      if (!row) return;

      const discounts = JSON.parse(host.dataset.cache || '[]');
      const discount = discounts.find((d) => d.id === Number(row.dataset.discount));
      if (!discount) return;

      if (event.target.closest('[data-edit]')) {
        discountForm(discount);
        return;
      }

      if (event.target.closest('[data-toggle-discount]')) {
        guard(async () => {
          await api(`/api/admin/discounts/${discount.id}`, {
            method: 'PATCH',
            body: { active: !discount.active },
          });
          await load();
        });
        return;
      }

      if (event.target.closest('[data-delete]')) {
        const modal = openModal(
          'Delete discount',
          `<div class="modal-body"><p>Delete the code <strong>${escapeHtml(discount.code)}</strong>? Orders that already used it keep their recorded discount.</p></div>`,
          `<button type="button" class="mini-button" data-modal-close>Cancel</button>
           <button type="button" class="mini-button danger" data-confirm-delete>Delete</button>`
        );

        modal.querySelector('[data-confirm-delete]').addEventListener('click', () =>
          guard(async () => {
            await api(`/api/admin/discounts/${discount.id}`, { method: 'DELETE' });
            closeModal();
            toast('Discount deleted.');
            await load();
          })
        );
      }
    });

    await load();
  }

  guard(initDiscounts);
})();
