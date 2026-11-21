/* ==========================================================================
   Lebanon Hockey - contact form
   --------------------------------------------------------------------------
   The submit handler for the contact form, on the two pages that carry one.

   It posts through window.LH.api rather than a bare fetch: /api is behind CSRF
   protection and a raw fetch sends no token, so this form used to fail with a
   403 as soon as the visitor had a session.
   ========================================================================== */
(function () {
  'use strict';

  if (!document.querySelector('.contact-form')) return;

/* --------------------------------------------------------------------------
   Contact form
   -------------------------------------------------------------------------- */
const contactForm = document.querySelector('.contact-form');

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const statusText = contactForm.querySelector('.form-status');
  const submit = contactForm.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(contactForm).entries());

  if (submit) submit.disabled = true;
  if (statusText) {
    statusText.className = 'form-status';
    statusText.textContent = 'Sending...';
  }

  try {
    /* window.LH.api, not a bare fetch: /api is behind CSRF protection, and a
       raw fetch sends no token, so this form was failing with a 403 the moment
       the visitor had a session. api() fetches the token and retries once. */
    await window.LH.api('/api/contact', { method: 'POST', body: payload });

    contactForm.reset();
    if (statusText) {
      statusText.className = 'form-status is-success';
      statusText.textContent = 'Thanks for reaching out. We will be in touch.';
    }
  } catch (error) {
    if (statusText) {
      statusText.className = 'form-status is-error';
      statusText.textContent =
        (error && error.message) || 'Could not send just now. Email info@lebanonhockey.com instead.';
    }
  } finally {
    if (submit) submit.disabled = false;
  }
});

})();
