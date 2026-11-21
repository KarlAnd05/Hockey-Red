/* ==========================================================================
   Lebanon Hockey - site-wide behaviour
   ========================================================================== */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The reveal transition only applies once scripting is confirmed live, so a
// failed or slow script can never leave the page below the fold invisible.
document.documentElement.classList.add('has-js');

/* --------------------------------------------------------------------------
   Form validation

   Every form on the site carries `novalidate`, which switches off the browser's
   own bubbles so the styling stays ours. The cost of that, until now, was that
   pressing Submit with a required field empty did nothing at all: no bubble, no
   message, no clue. The visitor is left pressing a dead button.

   This runs on the CAPTURE phase at document level, so it sees the submit before
   the page's own handler does and can stop it. One listener therefore covers the
   donation form, the registration form, checkout, sign-in, the contact form and
   anything added later, instead of each handler growing its own copy.

   Add `data-skip-validation` to a form to opt out.
   -------------------------------------------------------------------------- */
function fieldLabel(field) {
  const label = field.closest('label');
  if (label) {
    /* The label's own text, minus the field, any "(optional)" hint, and any
       error note already sitting in it - without that last exclusion the label
       absorbs its own message and reads back "Email Email is required." */
    const clone = label.cloneNode(true);
    clone
      .querySelectorAll('input, select, textarea, .field-error, span.reg-optional, span.donate-optional')
      .forEach((n) => n.remove());
    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return field.getAttribute('aria-label') || field.name || 'This field';
}

function messageFor(field) {
  const v = field.validity;
  const name = fieldLabel(field);

  if (v.valueMissing) {
    if (field.type === 'checkbox') return `Please tick ${name.toLowerCase()}.`;
    if (field.tagName === 'SELECT') return `Choose ${name.toLowerCase()}.`;
    return `${name} is required.`;
  }
  if (v.typeMismatch && field.type === 'email') return 'Enter a valid email address, like name@example.com.';
  if (v.typeMismatch && field.type === 'tel') return 'Enter a valid phone number.';
  if (v.rangeUnderflow) return `${name} must be at least ${field.min}.`;
  if (v.rangeOverflow) return `${name} must be ${field.max} or less.`;
  if (v.tooShort) return `${name} must be at least ${field.minLength} characters.`;
  if (v.tooLong) return `${name} must be ${field.maxLength} characters or fewer.`;
  if (v.patternMismatch) return `${name} is not in the expected format.`;
  if (v.stepMismatch) return `${name} is not a valid amount.`;
  return field.validationMessage || `${name} is not valid.`;
}

function clearFieldError(field) {
  field.removeAttribute('aria-invalid');
  field.classList.remove('is-invalid');
  const holder = field.closest('label') || field.parentElement;
  holder?.querySelector('.field-error')?.remove();
}

function showFieldError(field, message) {
  field.setAttribute('aria-invalid', 'true');
  field.classList.add('is-invalid');

  const holder = field.closest('label') || field.parentElement;
  if (!holder) return;

  let note = holder.querySelector('.field-error');
  if (!note) {
    note = document.createElement('p');
    note.className = 'field-error';
    holder.appendChild(note);
  }
  note.textContent = message;
}

document.addEventListener(
  'submit',
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute('data-skip-validation')) return;

    /* Fields hidden or disabled by the page (the registration form hides its
       eligibility block for supporters) are not candidates - checkValidity
       already ignores disabled ones, and this keeps the message list honest. */
    const fields = Array.from(form.elements).filter(
      (el) => el.willValidate && el.type !== 'submit' && el.type !== 'button'
    );

    fields.forEach(clearFieldError);

    const invalid = fields.filter((el) => !el.checkValidity());
    if (invalid.length === 0) return;

    event.preventDefault();
    event.stopImmediatePropagation(); // the page's own handler must not run

    /* Work the messages out before touching the DOM: showFieldError inserts a
       note inside the label, and reading a label after that would include it. */
    const messages = invalid.map((field) => [field, messageFor(field)]);
    messages.forEach(([field, message]) => showFieldError(field, message));

    /* A summary too, because on a long form the first error can be off-screen
       and a single highlighted field is easy to miss. */
    const status = form.querySelector('.form-status');
    if (status) {
      status.className = 'form-status is-error';
      status.textContent =
        messages.length === 1
          ? messages[0][1]
          : `Please check ${messages.length} fields above before continuing.`;
    }

    const first = invalid[0];
    first.focus({ preventScroll: true });
    first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  },
  true
);

/* Clear a field's error as soon as the visitor fixes it, rather than making
   them submit again to find out. */
document.addEventListener('input', (event) => {
  const field = event.target;
  if (field instanceof HTMLElement && field.classList?.contains('is-invalid') && field.checkValidity?.()) {
    clearFieldError(field);
  }
});

document.addEventListener('change', (event) => {
  const field = event.target;
  if (field instanceof HTMLElement && field.classList?.contains('is-invalid') && field.checkValidity?.()) {
    clearFieldError(field);
  }
});

/* --------------------------------------------------------------------------
   Mobile navigation
   -------------------------------------------------------------------------- */
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');

menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

nav?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    nav.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
    nav.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.focus();
  }
});

/* --------------------------------------------------------------------------
   Scroll-linked header chrome
   -------------------------------------------------------------------------- */
const header = document.querySelector('.site-header');

if (header) {
  const syncHeader = () => header.classList.toggle('is-stuck', window.scrollY > 12);
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
}

/* --------------------------------------------------------------------------
   Reveal on scroll (with staggered children)
   -------------------------------------------------------------------------- */
const revealTargets = document.querySelectorAll('.reveal');

revealTargets.forEach((section) => {
  section.querySelectorAll('[data-stagger]').forEach((child, i) => {
    child.style.setProperty('--stagger-i', String(i));
  });
});

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealTargets.forEach((el) => el.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));

  // Safety net: if the observer never fires (headless capture, an unusual
  // scroll container, a bfcache restore), show everything anyway rather than
  // shipping an invisible page.
  setTimeout(() => revealTargets.forEach((el) => el.classList.add('is-visible')), 2500);
}

/* --------------------------------------------------------------------------
   Header session + cart badge
   -------------------------------------------------------------------------- */
async function syncHeaderState(force) {
  const cartBadge = document.querySelector('[data-cart-count]');
  const accountLink = document.querySelector('[data-account-link]');
  const adminLink = document.querySelector('[data-admin-link]');

  if (!cartBadge && !accountLink && !adminLink) return;

  try {
    // Reuse the shared loader so the initial page load makes one
    // /api/session call rather than two; refetch only when the cart changed.
    const data = await window.LH?.loadSession(force);
    if (!data) return;

    if (cartBadge) {
      const count = data.cartCount || 0;
      cartBadge.textContent = String(count);
      cartBadge.dataset.empty = count === 0 ? 'true' : 'false';
    }

    if (accountLink) {
      const label = accountLink.querySelector('.label');
      if (data.user) {
        accountLink.href = 'account.html';
        if (label) label.textContent = data.user.firstName || 'Account';
      } else {
        accountLink.href = 'login.html';
        if (label) label.textContent = 'Sign In';
      }
    }

    if (adminLink) {
      adminLink.hidden = data.user?.role !== 'admin';
    }
  } catch {
    /* Header extras are non-critical - stay quiet if the API is unreachable. */
  }
}

syncHeaderState(false);
document.addEventListener('cart:changed', () => syncHeaderState(true));
