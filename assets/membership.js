/**
 * Membership registration form.
 *
 * The eligibility block is shown only for tiers that actually need it. A fan
 * buying a supporter membership is never shown fields asking for their date of
 * birth or their parents' citizenship - and the server blanks those fields for
 * that tier regardless of what the form sends, so hiding them is a courtesy,
 * not the control.
 */
(function () {
  'use strict';

  const root = document.querySelector('[data-page="membership"]');
  if (!root || !window.LH) return;

  const { api, money, escapeHtml, toast, qs } = window.LH;

  const form = root.querySelector('[data-membership-form]');
  const tierHost = root.querySelector('[data-tier-choice]');
  const eligibility = root.querySelector('[data-eligibility]');
  const statusEl = root.querySelector('[data-membership-status]');
  const resultHost = root.querySelector('[data-membership-result]');
  const noticeHost = root.querySelector('[data-membership-notice]');
  const submit = root.querySelector('[data-membership-submit]');

  let settings = null;

  function currentTier() {
    const checked = tierHost.querySelector('input:checked');
    return checked ? settings.tiers.find((t) => t.key === checked.value) : null;
  }

  function syncTier() {
    const tier = currentTier();
    if (!tier) return;

    eligibility.hidden = !tier.eligibility;
    /* Disable rather than only hide, so a hidden required field can never block
       submission with an error the visitor cannot see. */
    eligibility.querySelectorAll('input, select').forEach((field) => {
      field.disabled = !tier.eligibility;
    });

    submit.textContent = settings.paymentsEnabled
      ? `Continue to payment — ${money(tier.amountCents, settings.currency)}`
      : `Submit registration — ${money(tier.amountCents, settings.currency)}`;
  }

  function renderTiers() {
    tierHost.innerHTML = settings.tiers
      .map(
        (tier, i) => `
      <label class="reg-tier">
        <input type="radio" name="tier" value="${escapeHtml(tier.key)}"${i === 1 ? ' checked' : ''}>
        <span class="reg-tier-label">${escapeHtml(tier.label)}</span>
        <span class="reg-tier-price">${escapeHtml(money(tier.amountCents, settings.currency))}</span>
      </label>`
      )
      .join('');
  }

  function showTransferInstructions(registrationId, amountCents, transferEmail) {
    form.hidden = true;
    resultHost.innerHTML = `
      <div class="notice" role="status">
        <h2>Registration received</h2>
        <p>Thank you. Your registration is recorded and a confirmation is on its way by email.</p>
        <p>
          To complete it, send ${escapeHtml(money(amountCents, settings.currency))} by Interac e-Transfer
          or PayPal to <strong>${escapeHtml(transferEmail)}</strong>, and include your name so the
          federation can match the payment to your registration.
        </p>
        <p class="donate-fineprint">Reference: registration #${escapeHtml(String(registrationId))}</p>
        <div class="notice-actions">
          <a class="button primary small" href="mailto:${escapeHtml(
            transferEmail
          )}?subject=Membership%20payment">Email the federation</a>
          <a class="button ghost small" href="index.html">Back to the site</a>
        </div>
      </div>`;
  }

  async function showResult(registrationId, sessionId) {
    form.hidden = true;
    resultHost.innerHTML =
      '<div class="notice" role="status"><h2>Confirming your payment</h2><p>This usually takes a couple of seconds.</p></div>';

    try {
      const data = await api(
        `/api/membership/status/${encodeURIComponent(registrationId)}?session=${encodeURIComponent(sessionId)}`
      );
      const r = data.registration;
      const paid = r.paymentStatus === 'paid';

      resultHost.innerHTML = `
        <div class="notice" role="status">
          <h2>${paid ? 'You are registered' : 'Registration received'}</h2>
          <p>${
            paid
              ? `Thank you${r.firstName ? `, ${escapeHtml(r.firstName)}` : ''}. Your ${escapeHtml(
                  r.tierLabel
                )} membership is paid and confirmed.`
              : 'Your registration is recorded. We are still waiting on the payment provider to confirm the fee.'
          }</p>
          <div class="notice-actions">
            <a class="button primary small" href="index.html">Back to the site</a>
          </div>
        </div>`;
    } catch (error) {
      resultHost.innerHTML = `<div class="notice" role="status"><h2>We could not confirm that</h2><p>${escapeHtml(
        error.message
      )}</p></div>`;
    }
  }

  (async () => {
    const registrationId = qs('registration');
    const sessionId = qs('session');
    if (registrationId && sessionId) {
      await showResult(registrationId, sessionId);
      return;
    }

    if (qs('cancelled')) toast('No payment was taken. Your registration was not completed.');

    try {
      settings = await api('/api/membership/config');
    } catch {
      return;
    }

    renderTiers();
    syncTier();

    if (!settings.paymentsEnabled) {
      /* Not an error state: the registration still works, the fee just arrives
         by transfer. Say that plainly instead of showing a payment warning. */
      noticeHost.innerHTML = `
        <div class="notice is-info" role="status">
          <h2>Card payment is not switched on yet</h2>
          <p>
            You can still register now &mdash; the federation will confirm by email and the
            fee is paid by Interac e-Transfer or PayPal to
            <strong>${escapeHtml(settings.transferEmail)}</strong>.
          </p>
        </div>`;
    }
  })();

  tierHost.addEventListener('change', syncTier);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const values = Object.fromEntries(new FormData(form).entries());
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Sending...';
    if (statusEl) statusEl.textContent = '';

    try {
      const result = await api('/api/membership', { method: 'POST', body: values });

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      showTransferInstructions(
        result.registrationId,
        result.amountCents,
        result.transferEmail || 'support@lebanonhockey.com'
      );
    } catch (error) {
      if (statusEl) {
        statusEl.className = 'form-status is-error';
        statusEl.textContent = error.message;
      }
      toast(error.message, 'error');
      submit.disabled = false;
      submit.textContent = original;
    }
  });
})();
