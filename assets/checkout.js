/* ==========================================================================
   Lebanon Hockey - checkout page
   --------------------------------------------------------------------------
   The address form, the shipping quote that follows the destination, and
   the hand-off to Stripe or to the e-Transfer instructions.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="checkout"]');
  if (!root) return;

  const { api, money, escapeHtml, toast } = window.LH;
  const { storedDiscount, setStoredDiscount, renderPaymentsNotice, paymentsEnabled, etransferEnabled, renderSummary } = window.LHStore;

  function initCheckout(root) {
    const form = root.querySelector('[data-checkout-form]');
    const summaryHost = root.querySelector('[data-checkout-summary]');
    const statusEl = root.querySelector('[data-checkout-status]');
    const discount = storedDiscount();
    const countrySelect = root.querySelector('[data-country-select]');

    /* Built from the server's own list so a code here always matches a shipping
       zone. Changing it re-quotes before payment, which is the whole point. */
    async function loadCountries() {
      if (!countrySelect) return;
      try {
        const data = await api('/api/checkout/countries');
        countrySelect.insertAdjacentHTML(
          'beforeend',
          data.countries
            .map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`)
            .join('')
        );
        if (data.origin) countrySelect.value = data.origin;
      } catch {
        /* Leave the placeholder; the server still prices the order correctly. */
      }
    }

    async function loadSummary() {
      try {
        const country = countrySelect?.value || '';
        const cart = await api(
          `/api/checkout/summary?discount=${encodeURIComponent(discount)}&country=${encodeURIComponent(country)}`
        );

        if (!cart.items.length) {
          window.location.href = 'cart.html';
          return;
        }

        summaryHost.innerHTML = `
          <div class="mini-lines">
            ${cart.items
              .map(
                (item) => `
              <div class="mini-line">
                <img src="${escapeHtml(item.imageUrl)}" alt="">
                <div>
                  <div class="name">${escapeHtml(item.name)}</div>
                  <div class="qty">${item.variantName ? `${escapeHtml(item.variantName)} · ` : ''}Qty ${item.quantity}</div>
                </div>
                <strong>${money(item.lineTotalCents, cart.currency)}</strong>
              </div>`
              )
              .join('')}
          </div>
          <div data-totals></div>`;

        renderSummary(summaryHost.querySelector('[data-totals]'), cart, {});
      } catch (error) {
        summaryHost.innerHTML = `<p class="form-status is-error">${escapeHtml(error.message)}</p>`;
      }
    }

    // Prefill from the signed-in account where we can.
    window.LH.loadSession().then((data) => {
      if (data && data.user && form) {
        if (!form.email.value) form.email.value = data.user.email || '';
        if (!form.name.value) {
          form.name.value = [data.user.firstName, data.user.lastName].filter(Boolean).join(' ');
        }
      }
    });

    /* Shut the form before it is filled in, rather than after it is submitted.
       Also hide the "you are sent to Stripe" reassurance, which would otherwise
       contradict a notice saying we cannot take cards. */
    function closeCheckout() {
      renderPaymentsNotice(root.querySelector('[data-payments-notice]'));
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Payments unavailable';
      }
      const secure = root.querySelector('[data-secure-note]');
      if (secure) secure.hidden = true;
      if (statusEl) statusEl.textContent = '';
    }

    /* After an e-Transfer order: replace the form with what to send and where.
       The order exists and is reserved, but it is NOT paid, and the wording
       has to keep saying so - the buyer still has to do something. */
    function renderEtransferInstructions(result) {
      const i = result.instructions;
      /* The buyer is a guest almost every time - they have no account to sign
         in to - so this token is the whole of their claim to the order. Without
         it the confirmation page tells them the order they placed a moment ago
         is not theirs. */
      const orderHref = `order-confirmation.html?order=${encodeURIComponent(result.orderId)}${
        result.accessToken ? `&token=${encodeURIComponent(result.accessToken)}` : ''
      }`;
      form.hidden = true;
      const secure = root.querySelector('[data-secure-note]');
      if (secure) secure.hidden = true;

      const host = root.querySelector('[data-payments-notice]');
      if (!host) return;

      host.innerHTML = `
        <div class="notice" role="status">
          <h2>Order ${escapeHtml(i.reference)} is reserved</h2>
          <p>It is not paid yet. Send an Interac e-Transfer with the details below and we will confirm as soon as it arrives &mdash; usually within a working day. We have emailed you a copy.</p>
          <dl class="etransfer-details">
            <div><dt>Send to</dt><dd>${escapeHtml(i.email)}</dd></div>
            <div><dt>Recipient name</dt><dd>${escapeHtml(i.name)}</dd></div>
            <div><dt>Amount</dt><dd>${escapeHtml(money(i.amountCents, i.currency))}</dd></div>
            <div><dt>Message field</dt><dd>${escapeHtml(i.reference)}</dd></div>
          </dl>
          <p class="etransfer-warning">Please put <strong>${escapeHtml(
            i.reference
          )}</strong> in the transfer message. Without it we may not be able to match your payment to this order.</p>
          <div class="notice-actions">
            <a class="button primary small" href="${orderHref}">View your order</a>
            <a class="button ghost small" href="shop.html">Back to the store</a>
          </div>
        </div>`;

      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* Which ways to pay are actually live decides what the form shows - and
       whether it stays open at all. Cards off but e-Transfer on is a working
       store, not a closed one, so closeCheckout() must not fire there. */
    Promise.all([paymentsEnabled(), etransferEnabled()]).then(([card, etransfer]) => {
      const methods = form?.querySelector('[data-pay-methods]');
      const cardRadio = form?.querySelector('[name="method"][value="card"]');
      const etransferRadio = form?.querySelector('[name="method"][value="etransfer"]');

      if (!card && !etransfer) {
        closeCheckout();
        return;
      }

      if (card && etransfer && methods) {
        methods.hidden = false;
        return;
      }

      /* Only one way to pay: pick it silently rather than showing a choice of
         one. The hidden radio still carries the value on submit. */
      if (!card && etransfer) {
        if (etransferRadio) etransferRadio.checked = true;
        if (cardRadio) cardRadio.disabled = true;
        renderPaymentsNotice(root.querySelector('[data-payments-notice]'), { etransfer: true });
        const secure = root.querySelector('[data-secure-note]');
        if (secure) secure.hidden = true;
        const submit = form?.querySelector('[data-checkout-submit]');
        if (submit) submit.textContent = 'Place order';
      }
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submit = form.querySelector('button[type="submit"]');
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.discountCode = discount;

      const payingByTransfer = payload.method === 'etransfer';

      submit.disabled = true;
      submit.textContent = payingByTransfer ? 'Placing your order...' : 'Redirecting to payment...';
      if (statusEl) statusEl.textContent = '';

      try {
        const result = await api('/api/checkout', { method: 'POST', body: payload });

        /* e-Transfer finishes here instead of on Stripe: there is nowhere to
           redirect to, so the instructions are shown in place. */
        if (result.method === 'etransfer') {
          setStoredDiscount('');
          renderEtransferInstructions(result);
          return;
        }

        if (result.url) {
          setStoredDiscount('');
          window.location.href = result.url;
          return;
        }

        throw new Error('Payment could not be started.');
      } catch (error) {
        /* Payments switched off between page load and submit, or the probe
           never ran: show the same notice rather than a raw server string. */
        if (error.payload && error.payload.code === 'payments_disabled') {
          closeCheckout();
          return;
        }

        if (statusEl) {
          statusEl.className = 'form-status is-error';
          statusEl.textContent = error.message;
        }
        toast(error.message, 'error');
        submit.disabled = false;
        submit.textContent = payingByTransfer ? 'Place order' : 'Pay securely';
      }
    });

    /* Re-quote whenever the destination changes, so the shipping line and the
       total on screen are always the ones that will be charged. */
    countrySelect?.addEventListener('change', () => loadSummary());

    loadCountries().then(loadSummary);
  }

  initCheckout(root);
})();
