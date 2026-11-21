/* ==========================================================================
   Lebanon Hockey - donation page
   --------------------------------------------------------------------------
   One-off and monthly giving, and the public leaderboard beside it.
   ========================================================================== */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="donation"]');
  if (!root) return;

  const { api, money, escapeHtml, toast, qs } = window.LH;
  const { renderPaymentsNotice, paymentsEnabled } = window.LHStore;

  function initDonation(root) {
    const form = root.querySelector('[data-donate-form]');
    const statusEl = root.querySelector('[data-donate-status]');
    const resultHost = root.querySelector('[data-donate-result]');
    const amountHost = root.querySelector('[data-amount-buttons]');
    const customInput = form?.querySelector('[name="customAmount"]');
    const displayPublicly = form?.querySelector('[data-display-publicly]');
    const emailInput = form?.querySelector('[data-donate-email]');
    const emailHint = form?.querySelector('[data-email-hint]');
    /* Page-level, not part of the form: the leaderboard is its own section
       outside the [data-page] root this controller is scoped to. */
    const leaderboardSection = document.querySelector('[data-leaderboard-section]');
    const leaderboardHost = document.querySelector('[data-leaderboard]');

    let settings = null;
    let chosenCents = 0;

    /* A monthly gift must carry an email: the only way a donor can stop it is
       the manage link that gets sent there. A one-time gift has nothing to
       cancel, so the field stays optional. */
    function refreshEmailRequirement() {
      if (!emailInput) return;
      const monthly = form.querySelector('[name="kind"]:checked')?.value === 'monthly';

      emailInput.required = monthly;
      if (emailHint) {
        emailHint.textContent = monthly ? '(required for monthly gifts)' : '(optional)';
      }
    }

    function renderLeaderboard(data) {
      if (!leaderboardHost || !leaderboardSection) return;
      const entries = (data && data.entries) || [];
      if (!entries.length) return;

      leaderboardSection.hidden = false;
      leaderboardHost.innerHTML = `
        <ol class="leaderboard">
          ${entries
            .map(
              (entry, i) => `
            <li class="leaderboard-row">
              <span class="leaderboard-rank">${i + 1}</span>
              <span class="leaderboard-name">${escapeHtml(entry.name)}${
                entry.kind === 'monthly'
                  ? ' <span class="leaderboard-tag">Monthly</span>'
                  : ''
              }</span>
              <span class="leaderboard-amount">${escapeHtml(
                money(entry.amountCents, entry.currency)
              )}</span>
            </li>`
            )
            .join('')}
        </ol>`;
    }

    function selectAmount(cents, { fromCustom = false } = {}) {
      chosenCents = Math.max(0, Math.round(cents) || 0);
      amountHost?.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-chosen', Number(b.dataset.cents) === chosenCents);
        b.setAttribute('aria-pressed', Number(b.dataset.cents) === chosenCents ? 'true' : 'false');
      });
      if (!fromCustom && customInput) customInput.value = '';
    }

    function renderAmounts() {
      if (!amountHost || !settings) return;
      amountHost.innerHTML = settings.suggestedCents
        .map(
          (cents) =>
            `<button type="button" class="donate-amount" data-cents="${cents}" aria-pressed="false">${escapeHtml(
              money(cents, settings.currency)
            )}</button>`
        )
        .join('');
    }

    /* Coming back from Stripe: show the outcome instead of the form. */
    async function showResult(donationId, sessionId) {
      if (form) form.hidden = true;
      resultHost.innerHTML = '<div class="notice" role="status"><h2>Confirming your gift</h2><p>This usually takes a couple of seconds.</p></div>';

      try {
        const data = await api(
          `/api/donate/status/${encodeURIComponent(donationId)}?session=${encodeURIComponent(sessionId)}`
        );
        const d = data.donation;
        const settled = d.status === 'paid' || d.status === 'active';

        resultHost.innerHTML = `
          <div class="notice" role="status">
            <h2>${settled ? 'Thank you' : 'Gift received'}</h2>
            <p>${
              settled
                ? `Your ${d.isRecurring ? 'monthly gift of ' : 'gift of '}${escapeHtml(
                    money(d.totalCents, d.currency)
                  )}${d.isRecurring ? ' is set up' : ' has been received'}.${
                    d.email ? ` A confirmation is on its way to ${escapeHtml(d.email)}.` : ''
                  }`
                : `We have your gift and are waiting on the payment provider to confirm it. Status: ${escapeHtml(d.status)}.`
            }</p>
            ${
              d.isRecurring
                ? '<p>The confirmation email has a link you can use to change or stop your monthly gift at any time.</p>'
                : ''
            }
            <p class="donate-fineprint">This is a confirmation of your payment, not an official tax receipt.</p>
            <div class="notice-actions">
              <a class="button primary small" href="index.html">Back to the site</a>
            </div>
          </div>`;
      } catch (error) {
        resultHost.innerHTML = `<div class="notice" role="status"><h2>We could not confirm that gift</h2><p>${escapeHtml(
          error.message
        )}</p></div>`;
      }
    }

    function closeDonations() {
      renderPaymentsNotice(root.querySelector('[data-payments-notice]'), { donation: true });
      const submit = form?.querySelector('[data-donate-submit]');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Donations unavailable';
      }
      const secure = root.querySelector('[data-secure-note]');
      if (secure) secure.hidden = true;
      if (statusEl) statusEl.textContent = '';
    }

    (async () => {
      const donationId = qs('donation');
      const sessionId = qs('session');
      if (donationId && sessionId) {
        await showResult(donationId, sessionId);
        return;
      }

      if (qs('cancelled')) toast('No payment was taken. Your gift was not completed.');

      try {
        settings = await api('/api/donate/config');
      } catch {
        settings = null;
      }
      if (!settings) return;

      renderAmounts();

      /* Drive the custom field's floor from the served config, so the buttons,
         the input and the server's validation can never disagree about the
         smallest gift the federation accepts. */
      if (customInput) {
        customInput.min = String(settings.minCents / 100);
        customInput.placeholder = (settings.minCents / 100).toFixed(2);
      }

      selectAmount(settings.suggestedCents[1] ?? settings.suggestedCents[0]);
      refreshEmailRequirement();
      if (!settings.paymentsEnabled) closeDonations();

      /* The leaderboard is its own request and its own failure: an empty or
         broken one must not stop somebody donating. */
      try {
        renderLeaderboard(await api('/api/donate/leaderboard'));
      } catch {
        /* leave the section hidden */
      }
    })();

    form?.querySelectorAll('[name="kind"]').forEach((radio) => {
      radio.addEventListener('change', refreshEmailRequirement);
    });

    amountHost?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cents]');
      if (button) selectAmount(Number(button.dataset.cents));
    });

    customInput?.addEventListener('input', () => {
      const dollars = Number(customInput.value);
      selectAmount(Number.isFinite(dollars) ? Math.round(dollars * 100) : 0, { fromCustom: true });
    });

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const submit = form.querySelector('[data-donate-submit]');
      const values = Object.fromEntries(new FormData(form).entries());

      if (chosenCents <= 0) {
        if (statusEl) {
          statusEl.className = 'form-status is-error';
          statusEl.textContent = 'Choose an amount to give.';
        }
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Redirecting to payment...';
      if (statusEl) statusEl.textContent = '';

      try {
        const result = await api('/api/donate', {
          method: 'POST',
          body: {
            kind: values.kind === 'monthly' ? 'monthly' : 'one_time',
            email: values.email,
            name: values.name,
            message: values.message,
            amountCents: chosenCents,
            displayPublicly: Boolean(displayPublicly?.checked),
            publicName: values.name,
          },
        });

        if (result.url) {
          window.location.href = result.url;
          return;
        }
        throw new Error('The donation could not be started.');
      } catch (error) {
        if (error.payload && error.payload.code === 'payments_disabled') {
          closeDonations();
          return;
        }
        if (statusEl) {
          statusEl.className = 'form-status is-error';
          statusEl.textContent = error.message;
        }
        toast(error.message, 'error');
        submit.disabled = false;
        submit.textContent = 'Continue to payment';
      }
    });
  }

  initDonation(root);
})();
