/**
 * Generates the storefront and account pages so they share one shell with the
 * rest of the site. Re-run after editing the shell here.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* The federation's crest. The filename is historical - the file is now the
   supplied 810x630 transparent master (LIHF-02), not the 95x79 crop it was
   named for. Kept under the old name because it is referenced on every page,
   in both generators and by the favicon route, and renaming buys nothing. */
const LOGO = './assets/LIHF-01_edited.png';

const NAV = [
  ['index.html', 'Home'],
  ['about.html', 'About'],
  ['teams.html', 'Our Teams'],
  ['news.html', 'News'],
  ['membership.html', 'Membership'],
  ['events.html', 'Events'],
  ['sponsors.html', 'Sponsors'],
  ['shop.html', 'Store'],
];

function shell({ file, title, description, active, body, scripts = [], bodyClass = '' }) {
  const nav = NAV.map(
    ([href, label]) =>
      `        <a href="${href}"${href === active ? ' class="is-active"' : ''}>${label}</a>`
  ).join('\n');

  const extraScripts = scripts
    .map((src) => `    <script src="./assets/${src}"></script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}">
    <title>${title}</title>
    <link rel="icon" href="./assets/LIHF-01_edited.png" type="image/png">
    <link rel="preload" href="./assets/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="./assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="./assets/styles.css">
    <link rel="stylesheet" href="./assets/store.css">
  </head>
  <body${bodyClass ? ` class="${bodyClass}"` : ''}>
    <a class="skip-link" href="#main">Skip to content</a>

    <div class="flag-strip" aria-hidden="true"></div>
    <header class="site-header">
      <a class="brand" href="index.html" aria-label="Lebanon Hockey home">
        <img src="./assets/LIHF-01_edited.png" alt="Lebanon Hockey logo">
        <span>Lebanon Hockey</span>
      </a>

      <button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="site-nav">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
${nav}
      </nav>

      <div class="header-tools">
        <a class="icon-button" data-account-link href="login.html">
          <svg class="cedar-icon" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,6 38,28 62,28"/><polygon points="50,20 30,46 70,46"/><polygon points="50,34 22,66 78,66"/><rect x="46" y="66" width="8" height="14"/><rect x="18" y="82" width="64" height="5" rx="2.5"/></svg>
          <span class="label">Sign In</span>
        </a>
        <a class="icon-button" data-admin-link href="/admin/" hidden>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6z"/></svg>
          <span class="label">Admin</span>
        </a>
        <a class="icon-button" href="cart.html" aria-label="View cart">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L22 7H6"/></svg>
          <span class="cart-count" data-cart-count data-empty="true">0</span>
        </a>
      </div>
    </header>

    <main id="main">
${body}
    </main>

    <footer class="site-footer">
      <div class="footer-grid">
        <div>
          <a class="footer-brand" href="index.html">
            <img src="./assets/LIHF-01_edited.png" alt="">
            <span>Lebanon Hockey</span>
          </a>
          <p class="footer-about">
            Building a fast, proud hockey community through programs, camps,
            events, and partnerships across Canada and Lebanon.
          </p>
        </div>
        <div>
          <h3>Programs</h3>
          <ul class="footer-links">
            <li><a href="teams.html">Our Teams</a></li>
            <li><a href="membership.html">Membership</a></li>
          </ul>
        </div>
        <div>
          <h3>Federation</h3>
          <ul class="footer-links">
            <li><a href="about.html">About</a></li>
            <li><a href="news.html">News</a></li>
            <li><a href="events.html">Events</a></li>
            <li><a href="sponsors.html">Sponsors</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
        <div>
          <h3>Store</h3>
          <ul class="footer-links">
            <li><a href="shop.html">All products</a></li>
            <li><a href="cart.html">Cart</a></li>
            <li><a href="account.html">Your account</a></li>
            <li><a href="donation.html">Donate</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2026 Lebanese Ice Hockey Federation. All rights reserved.</p>
        <nav class="footer-legal" aria-label="Legal">
          <a href="privacy.html">Privacy</a>
          <a href="cookies.html">Cookies</a>
          <a href="refund-policy.html">Refunds &amp; Returns</a>
        </nav>
        <p>1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1</p>
      </div>
    </footer>

    <script src="./assets/api.js"></script>
    <script src="./assets/app.js"></script>
    <script src="./assets/chat.js"></script>
${extraScripts}
  </body>
</html>
`;
}

const pages = [];

/* ==========================================================================
   Shop
   ========================================================================== */
pages.push({
  file: 'shop.html',
  title: 'Store · Lebanon Hockey',
  description:
    'Official Lebanon Hockey merchandise: jerseys, apparel, headwear, and collectibles supporting the federation.',
  active: 'shop.html',
  scripts: ['store.js'],
  body: `      <section class="hero page-hero">
        <div class="hero-media" aria-hidden="true">
          <img src="./assets/4a228d_5fe39cffd8c84e39ac4f0d5754527a88~mv2.jpg" alt="">
        </div>
        <svg class="cedar-mark cedar-watermark" aria-hidden="true"><use href="#cedar-mark"></use></svg>
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">Team Store</p>
          </div>
          <h1>Wear The <span class="accent">Cedars</span></h1>
          <p>Official Lebanon Hockey merchandise. Every purchase supports the federation.</p>
        </div>
      </section>

      <svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
        <symbol id="cedar-mark" viewBox="0 0 100 100">
          <polygon points="50,6 38,28 62,28"></polygon>
          <polygon points="50,20 30,46 70,46"></polygon>
          <polygon points="50,34 22,66 78,66"></polygon>
          <rect x="46" y="66" width="8" height="14"></rect>
          <rect x="18" y="82" width="64" height="5" rx="2.5"></rect>
        </symbol>
      </svg>

      <section class="page-section" data-page="shop">
        <div class="shell">
          <div data-payments-notice></div>

          <div class="shop-intro">
            <p>
              Every jersey is made to order. We work hard to get them to you, and we will
              always give you an honest delivery time-frame rather than a promise we cannot keep.
            </p>
            <p>
              Choose your jersey type, colour and size on each product page. If you need anything
              clarified before ordering, email
              <a href="mailto:sales@lebanonhockey.com">sales@lebanonhockey.com</a> &mdash; thank you
              for your trust.
            </p>
            <p class="shop-intro-pay">
              Prefer to pay another way? Interac e-Transfer within Canada to
              <strong>sales@lebanonhockey.com</strong>, or PayPal from outside Canada to
              <strong>support@lebanonhockey.com</strong>.
            </p>
          </div>

          <div class="shop-toolbar">
            <div class="search-field">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input type="search" placeholder="Search products" aria-label="Search products" data-search>
            </div>

            <button type="button" class="button ghost small filter-toggle" data-filter-toggle aria-expanded="true">
              Filters
            </button>

            <select data-sort aria-label="Sort products">
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
              <option value="newest">Newest</option>
            </select>

            <p class="result-count" data-result-count aria-live="polite"></p>
          </div>

          <div class="shop-layout">
            <aside class="filter-panel" data-filter-panel aria-label="Product filters">
              <div class="filter-group">
                <h2>Category</h2>
                <div class="filter-options" data-category-filters></div>
              </div>

              <div class="filter-group">
                <h2>Price</h2>
                <div class="price-row">
                  <input type="number" min="0" placeholder="Min" aria-label="Minimum price" data-min-price>
                  <span>to</span>
                  <input type="number" min="0" placeholder="Max" aria-label="Maximum price" data-max-price>
                </div>
              </div>

              <div class="filter-group">
                <h2>Availability</h2>
                <label class="checkbox-row">
                  <input type="checkbox" data-in-stock>
                  In stock only
                </label>
              </div>

              <button type="button" class="button ghost small" data-clear-filters>Clear filters</button>
            </aside>

            <div>
              <div class="product-grid" data-product-grid></div>
              <div class="pagination" data-pagination></div>
            </div>
          </div>
        </div>
      </section>`,
});

/* ==========================================================================
   Product
   ========================================================================== */
pages.push({
  file: 'product.html',
  title: 'Product · Lebanon Hockey',
  description: 'Official Lebanon Hockey merchandise.',
  active: 'shop.html',
  scripts: ['store.js'],
  body: `      <section class="page-section" style="padding-top:clamp(32px,4vw,56px)">
        <div class="shell" data-page="product"></div>
      </section>`,
});

/* ==========================================================================
   Cart
   ========================================================================== */
pages.push({
  file: 'cart.html',
  title: 'Cart · Lebanon Hockey',
  description: 'Your Lebanon Hockey shopping cart.',
  active: 'shop.html',
  scripts: ['store.js'],
  body: `      <section class="page-section" style="padding-top:clamp(32px,4vw,56px)" data-page="cart">
        <div class="shell">
          <nav class="breadcrumb">
            <a href="index.html">Home</a> /
            <a href="shop.html">Store</a> /
            <span aria-current="page">Cart</span>
          </nav>

          <h1 style="font-size:clamp(32px,4vw,52px);margin-bottom:var(--s-6)">Your Cart</h1>

          <div data-payments-notice></div>

          <div class="cart-layout">
            <div class="cart-lines" data-cart-lines></div>
            <aside class="summary-panel" data-cart-summary aria-label="Order summary"></aside>
          </div>
        </div>
      </section>`,
});

/* ==========================================================================
   Checkout
   ========================================================================== */
pages.push({
  file: 'checkout.html',
  title: 'Checkout · Lebanon Hockey',
  description: 'Secure checkout for Lebanon Hockey merchandise.',
  active: 'shop.html',
  scripts: ['store.js'],
  body: `      <section class="page-section" style="padding-top:clamp(32px,4vw,56px)" data-page="checkout">
        <div class="shell">
          <nav class="breadcrumb">
            <a href="shop.html">Store</a> /
            <a href="cart.html">Cart</a> /
            <span aria-current="page">Checkout</span>
          </nav>

          <h1 style="font-size:clamp(32px,4vw,52px);margin-bottom:var(--s-6)">Checkout</h1>

          <div data-payments-notice></div>

          <div class="checkout-layout">
            <form class="form-card" data-checkout-form novalidate>
              <h2>Contact</h2>
              <label>
                Email
                <input type="email" name="email" autocomplete="email" required>
              </label>

              <h2 style="margin-top:var(--s-4)">Shipping address</h2>
              <label>
                Full name
                <input type="text" name="name" autocomplete="name" required>
              </label>
              <label>
                Address
                <input type="text" name="line1" autocomplete="address-line1" required>
              </label>
              <label>
                Apartment, suite (optional)
                <input type="text" name="line2" autocomplete="address-line2">
              </label>

              <div class="field-row">
                <label>
                  City
                  <input type="text" name="city" autocomplete="address-level2" required>
                </label>
                <label>
                  Province / State
                  <input type="text" name="region" autocomplete="address-level1">
                </label>
              </div>

              <div class="field-row">
                <label>
                  Postal code
                  <input type="text" name="postal" autocomplete="postal-code">
                </label>
                <label>
                  Country
                  <!-- Filled from /api/checkout/countries, so the codes here and
                       the shipping zone lookup come from one list. Changing it
                       re-quotes the shipping before payment. -->
                  <select name="country" autocomplete="country" required data-country-select>
                    <option value="">Choose your country</option>
                  </select>
                </label>
              </div>

              <fieldset class="pay-methods" data-pay-methods hidden>
                <legend>How would you like to pay?</legend>
                <label class="pay-method">
                  <input type="radio" name="method" value="card" checked>
                  <span>
                    <strong>Card</strong>
                    <small>Paid now on Stripe&rsquo;s secure page.</small>
                  </span>
                </label>
                <label class="pay-method">
                  <input type="radio" name="method" value="etransfer">
                  <span>
                    <strong>Interac e-Transfer</strong>
                    <small>We email you where to send it. Your order ships once the transfer arrives.</small>
                  </span>
                </label>
              </fieldset>

              <button type="submit" class="button primary block" data-checkout-submit>Pay securely</button>
              <p class="form-status" data-checkout-status role="status"></p>
              <p data-secure-note style="margin:0;font-size:13px;color:var(--muted);line-height:1.6">
                You are sent to Stripe to pay; card details never reach our servers.
                By ordering you accept our <a href="refund-policy.html" style="color:var(--red);font-weight:700">refund policy</a>
                &mdash; all sales are final. Anything faulty, damaged or incorrect is replaced or refunded in full.
              </p>
            </form>

            <aside class="summary-panel" data-checkout-summary aria-label="Order summary"></aside>
          </div>
        </div>
      </section>`,
});

/* ==========================================================================
   Order confirmation
   ========================================================================== */
pages.push({
  file: 'order-confirmation.html',
  title: 'Order Confirmation · Lebanon Hockey',
  description: 'Your Lebanon Hockey order confirmation.',
  active: 'shop.html',
  scripts: ['store.js'],
  body: `      <section class="page-section" style="padding-top:clamp(48px,6vw,88px)">
        <div class="shell">
          <div class="confirmation" data-page="confirmation"></div>
        </div>
      </section>`,
});

/* ==========================================================================
   Login
   ========================================================================== */
pages.push({
  file: 'login.html',
  title: 'Sign In · Lebanon Hockey',
  description: 'Sign in to your Lebanon Hockey account.',
  active: '',
  scripts: ['account.js'],
  body: `      <section class="auth-layout">
        <div class="auth-card">
          <p class="eyebrow">Members</p>
          <h1>Sign In</h1>
          <p>Access your orders, invoices, and account details.</p>

          <form data-login-form novalidate>
            <label>
              Email
              <input type="email" name="email" autocomplete="email" required autofocus>
            </label>
            <label>
              Password
              <input type="password" name="password" autocomplete="current-password" required>
            </label>
            <button type="submit" class="button primary block">Sign in</button>
            <p class="form-status" role="status"></p>
          </form>

          <p style="margin:var(--s-4) 0 0;text-align:center;font-size:14px">
            <a href="forgot-password.html" style="color:var(--muted);font-weight:700">Forgot your password?</a>
          </p>

          <p class="auth-alt">
            New here? <a href="register.html">Create an account</a>
          </p>
        </div>
      </section>`,
});

/* ==========================================================================
   Register
   ========================================================================== */
pages.push({
  file: 'register.html',
  title: 'Create Account · Lebanon Hockey',
  description: 'Create a Lebanon Hockey account to track orders and invoices.',
  active: '',
  scripts: ['account.js'],
  body: `      <section class="auth-layout">
        <div class="auth-card">
          <p class="eyebrow">Members</p>
          <h1>Create Account</h1>
          <p>Track your orders, download invoices, and check out faster.</p>

          <form data-register-form novalidate>
            <div class="field-row">
              <label>
                First name
                <input type="text" name="firstName" autocomplete="given-name">
              </label>
              <label>
                Last name
                <input type="text" name="lastName" autocomplete="family-name">
              </label>
            </div>
            <label>
              Email
              <input type="email" name="email" autocomplete="email" required>
            </label>
            <label>
              Password
              <input type="password" name="password" autocomplete="new-password" minlength="8" required>
            </label>
            <label>
              Confirm password
              <input type="password" name="confirmPassword" autocomplete="new-password" minlength="8" required>
            </label>
            <button type="submit" class="button primary block">Create account</button>
            <p class="form-status" role="status"></p>
          </form>

          <p class="auth-alt">
            Already have an account? <a href="login.html">Sign in</a>
          </p>
        </div>
      </section>`,
});

/* ==========================================================================
   Account
   ========================================================================== */
pages.push({
  file: 'account.html',
  title: 'Your Account · Lebanon Hockey',
  description: 'Manage your Lebanon Hockey profile, orders, and invoices.',
  active: '',
  scripts: ['account.js'],
  body: `      <section class="page-section" style="padding-top:clamp(40px,5vw,72px)" data-page="account">
        <div class="shell">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:var(--s-4);flex-wrap:wrap;margin-bottom:var(--s-6)">
            <div>
              <p class="eyebrow">Your account</p>
              <h1 style="font-size:clamp(30px,3.6vw,48px);margin-bottom:6px" data-account-name>Your account</h1>
              <p style="margin:0;color:var(--muted)">
                <span data-account-email></span> · Member since <span data-account-since></span>
              </p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <a class="button ghost small" data-admin-panel href="/admin/" hidden>Admin area</a>
              <button type="button" class="button ghost small" data-logout>Sign out</button>
            </div>
          </div>

          <div class="account-layout">
            <nav class="account-nav" aria-label="Account sections">
              <button type="button" data-tab="orders" aria-current="true">Orders</button>
              <button type="button" data-tab="profile" aria-current="false">Profile</button>
              <button type="button" data-tab="security" aria-current="false">Security</button>
            </nav>

            <div>
              <div class="panel" data-panel="orders">
                <h2 style="font-size:22px;margin:0">Order history</h2>
                <div data-orders style="display:grid;gap:var(--s-3)"></div>
              </div>

              <div class="panel" data-panel="profile" hidden>
                <h2 style="font-size:22px;margin:0">Profile</h2>
                <form class="form-card" data-profile-form novalidate>
                  <div class="field-row">
                    <label>
                      First name
                      <input type="text" name="firstName" autocomplete="given-name">
                    </label>
                    <label>
                      Last name
                      <input type="text" name="lastName" autocomplete="family-name">
                    </label>
                  </div>
                  <label>
                    Phone
                    <input type="tel" name="phone" autocomplete="tel">
                  </label>
                  <button type="submit" class="button primary small" style="justify-self:start">Save changes</button>
                  <p class="form-status" role="status"></p>
                </form>
              </div>

              <div class="panel" data-panel="security" hidden>
                <h2 style="font-size:22px;margin:0">Change password</h2>
                <form class="form-card" data-password-form novalidate>
                  <label>
                    Current password
                    <input type="password" name="currentPassword" autocomplete="current-password" required>
                  </label>
                  <label>
                    New password
                    <input type="password" name="newPassword" autocomplete="new-password" minlength="8" required>
                  </label>
                  <label>
                    Confirm new password
                    <input type="password" name="confirmPassword" autocomplete="new-password" minlength="8" required>
                  </label>
                  <button type="submit" class="button primary small" style="justify-self:start">Update password</button>
                  <p class="form-status" role="status"></p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>`,
});

/* ==========================================================================
   Forgot password
   ========================================================================== */
pages.push({
  file: 'forgot-password.html',
  title: 'Reset Your Password · Lebanon Hockey',
  description: 'Request a password reset link for your Lebanon Hockey account.',
  active: '',
  scripts: ['account.js'],
  body: `      <section class="auth-layout">
        <div class="auth-card">
          <p class="eyebrow">Members</p>
          <h1>Forgot Password</h1>
          <p>Enter your email and we will send you a link to choose a new password. The link is valid for one hour.</p>

          <form data-forgot-form novalidate>
            <label>
              Email
              <input type="email" name="email" autocomplete="email" required autofocus>
            </label>
            <button type="submit" class="button primary block">Send reset link</button>
            <p class="form-status" role="status"></p>
          </form>

          <p class="auth-alt">
            Remembered it? <a href="login.html">Back to sign in</a>
          </p>
        </div>
      </section>`,
});

/* ==========================================================================
   Reset password
   ========================================================================== */
pages.push({
  file: 'reset-password.html',
  title: 'Choose a New Password · Lebanon Hockey',
  description: 'Set a new password for your Lebanon Hockey account.',
  active: '',
  scripts: ['account.js'],
  body: `      <section class="auth-layout">
        <div class="auth-card">
          <p class="eyebrow">Members</p>
          <h1>New Password</h1>
          <p>Choose a new password for your account. You will be signed out everywhere else.</p>

          <form data-reset-form novalidate>
            <label>
              New password
              <input type="password" name="password" autocomplete="new-password" minlength="8" required autofocus>
            </label>
            <label>
              Confirm new password
              <input type="password" name="confirmPassword" autocomplete="new-password" minlength="8" required>
            </label>
            <button type="submit" class="button primary block">Save new password</button>
            <p class="form-status" role="status"></p>
          </form>

          <p class="auth-alt">
            <a href="login.html">Back to sign in</a>
          </p>
        </div>
      </section>`,
});

/* ==========================================================================
   Legal pages
   ========================================================================== */
const LEGAL_UPDATED = 'Last updated: 6 September 2026';

function legalPage({ file, title, description, heading, lead, body }) {
  return {
    file,
    title: `${title} · Lebanon Hockey`,
    description,
    active: '',
    body: `      <section class="hero page-hero" style="min-height:34vh">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">Legal</p>
          </div>
          <h1>${heading}</h1>
          <p>${lead}</p>
        </div>
      </section>

      <section class="page-section">
        <div class="legal">
          <p class="updated">${LEGAL_UPDATED}</p>
${body}
        </div>
      </section>`,
  };
}

pages.push(
  legalPage({
    file: 'privacy.html',
    title: 'Privacy Policy',
    description:
      'How the Lebanese Ice Hockey Federation collects, uses, and protects your personal information.',
    heading: 'Privacy <span class="accent">Policy</span>',
    lead: 'What we collect, why we collect it, and the control you have over it.',
    body: `          <p>
            This policy explains how the <strong>Lebanese Ice Hockey Federation</strong> ("Lebanon Hockey",
            "we", "us") handles personal information collected through
            <a href="index.html">lebanonhockey.com</a> and its online shop.
          </p>
          <p>
            We are based in Quebec, Canada. We follow Quebec's <em>Act respecting the protection of personal
            information in the private sector</em> (as amended by Law&nbsp;25) and Canada's
            <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA).
          </p>

          <h2>1. Who is responsible</h2>
          <p>
            The federation is responsible for the personal information under its control. Our Privacy Officer
            can be reached at
            <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a> or by post at
            1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1, Canada.
          </p>

          <h2>2. What we collect</h2>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th>Information</th><th>When</th><th>Why</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Email address, password (stored only as a cryptographic hash)</td>
                  <td>When you create an account</td>
                  <td>To identify you and secure your account</td>
                </tr>
                <tr>
                  <td>Name, phone number</td>
                  <td>Account profile, checkout</td>
                  <td>To address you and contact you about an order</td>
                </tr>
                <tr>
                  <td>Shipping address</td>
                  <td>At checkout</td>
                  <td>To deliver your order and print your invoice</td>
                </tr>
                <tr>
                  <td>Order and invoice history</td>
                  <td>When you buy something</td>
                  <td>To fulfil the order and meet tax record-keeping obligations</td>
                </tr>
                <tr>
                  <td>Messages you send us</td>
                  <td>Contact form</td>
                  <td>To answer your enquiry</td>
                </tr>
                <tr>
                  <td>IP address and basic request logs</td>
                  <td>Automatically</td>
                  <td>Security, abuse prevention, and rate limiting</td>
                </tr>
                <tr>
                  <td>A single session cookie (<code>lh_sid</code>)</td>
                  <td>Only once you use the cart, sign in, or submit a form</td>
                  <td>To keep you signed in and remember your cart. See the
                      <a href="cookies.html">Cookie Policy</a>.</td>
                </tr>
                              <tr>
                  <td>
                    Membership registration: your name as written in your passport, date of birth,
                    place and country of birth, city of residence, citizenship and second citizenship,
                    your parents' citizenships, and playing details (position, shoots, height, weight,
                    highest level played)
                  </td>
                  <td>When you submit the membership registration form, and only for player, coach and
                      management memberships &mdash; supporter memberships are never asked for them</td>
                  <td>
                    To process your registration and to establish eligibility to represent Lebanon.
                    The International Ice Hockey Federation decides eligibility on the basis of
                    citizenship, including a parent's, which is the only reason we ask
                  </td>
                </tr>
                <tr>
                  <td>Chat messages, and an email address if you choose to give one</td>
                  <td>When you use the chat on the site</td>
                  <td>To answer your question, and to reply later if you leave before we can</td>
                </tr>
                <tr>
                  <td>Donation details: name, email address, and any message you add</td>
                  <td>When you make a one-time or monthly donation</td>
                  <td>To confirm your gift and, for a monthly gift, to let you change or stop it</td>
                </tr>
                <tr>
                  <td>Your name on the public donation leaderboard</td>
                  <td>Only if you tick the box asking for it when you donate</td>
                  <td>To thank supporters publicly. Nothing is published unless you ask for it, and never your email address, your message or anyone else&rsquo;s details</td>
                </tr>
</tbody>
            </table>
          </div>

          <div class="callout">
            <p>
              <strong>Your name goes on the donation leaderboard only if you ask.</strong> The box is unticked
              by default, and a gift is recorded whether or not you tick it. If you change your mind, email us
              and we will take your name off the page &mdash; your donation stays exactly as it is.
            </p>
          </div>

          <div class="callout">
            <p>
              <strong>We never see your card details.</strong> Payments are handled entirely on Stripe's own
              hosted checkout page. Card numbers, expiry dates, and security codes are never sent to, processed
              by, or stored on our servers.
            </p>
          </div>

          <h2>3. What we do not do</h2>
          <ul>
            <li>We do not sell, rent, or trade your personal information.</li>
            <li>We do not use advertising or analytics trackers, and we do not profile you.</li>
            <li>We do not send marketing email. The only messages we send are transactional:
                order confirmations, invoices, password resets, and replies to your enquiries.</li>
            <li>We do not load fonts, scripts, or images from third-party servers, so browsing the site does
                not disclose your visit to anyone else.</li>
          </ul>

          <h2>4. Who we share information with</h2>
          <p>We use a small number of service providers, and only for the purposes below:</p>
          <dl>
            <dt>Stripe Inc. (United States) — payment processing</dt>
            <dd>
              Receives your email address, order amount, and the card details you enter directly on their
              page. Stripe acts as an independent controller for payment data under its own
              privacy policy.
            </dd>
            <dt>Our email provider — transactional email</dt>
            <dd>Receives your email address and the contents of the message being sent to you.</dd>
          </dl>
          <p>
            We may also disclose information where required by law, or to establish or defend a legal claim.
          </p>

          <h2>5. Information stored outside Quebec</h2>
          <p>
            Stripe and our email provider process data in the United States and other countries, which means
            some of your information is stored or handled outside Quebec. Those jurisdictions may not offer
            protections equivalent to Quebec law. We rely on these providers' contractual commitments and
            security certifications, and we assess this before entrusting them with personal information, as
            Law&nbsp;25 requires. Order records, invoices, and account data that we hold ourselves remain on our
            own server.
          </p>

          <h2>6. How long we keep it</h2>
          <ul>
            <li><strong>Orders and invoices</strong> — six years after the transaction, to meet Canada Revenue
                Agency record-keeping requirements.</li>
            <li><strong>Account details</strong> — until you ask us to delete the account.</li>
            <li><strong>Sessions</strong> — 30 days, or until you sign out.</li>
            <li><strong>Password reset links</strong> — one hour, and they can be used only once.</li>
            <li><strong>Contact messages</strong> — until your enquiry is resolved, then up to 12 months.</li>
          </ul>

          <h2>7. How we protect it</h2>
          <ul>
            <li>The whole site is served over HTTPS in production.</li>
            <li>Passwords are stored using <code>scrypt</code> with a unique salt for each account. We cannot
                read your password, and neither can anyone who obtains the database.</li>
            <li>Session tokens are stored hashed, are rotated when you sign in, and can be revoked.</li>
            <li>Administrative pages are restricted to accounts holding the admin role.</li>
          </ul>
          <p>
            If a confidentiality incident occurs that presents a risk of serious injury, we will notify you and
            the <em>Commission d'accès à l'information</em> as Law&nbsp;25 requires, and record it in our incident
            register.
          </p>

          <h2>8. Your rights</h2>
          <p>You may ask us at any time to:</p>
          <ul>
            <li><strong>Access</strong> the personal information we hold about you.</li>
            <li><strong>Correct</strong> anything inaccurate or incomplete. You can edit your name, phone, and
                password yourself from <a href="account.html">your account</a>.</li>
            <li><strong>Delete</strong> your account and personal information, except records we must keep for
                tax purposes.</li>
            <li><strong>Withdraw consent</strong> to a use you previously agreed to.</li>
            <li><strong>Receive a copy</strong> of the information you gave us in a structured, commonly used
                technical format (data portability under Law&nbsp;25).</li>
          </ul>
          <p>
            Write to <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a> and we will respond
            within 30 days. If you are not satisfied with our answer, you may complain to the
            <strong>Commission d'accès à l'information du Québec</strong> or to the
            <strong>Office of the Privacy Commissioner of Canada</strong>.
          </p>

          <h2>9. Automated decisions and profiling</h2>
          <p>
            We do not make decisions about you by automated means, and we do not build profiles of you.
          </p>

          <h2>10. Children</h2>
          <p>
            Our shop is intended for adults. Youth programs are registered by a parent or guardian, who
            provides any information about a minor and consents to its use on the child's behalf.
          </p>
          <p>
            Membership registration for a player under 18 must be completed by a parent or guardian. The
            eligibility details it asks for &mdash; date of birth, place of birth and citizenships &mdash;
            are held for federation and IIHF purposes only, are visible to federation administrators, and
            are never published.
          </p>
          <p>
            Team rosters published on this site name athletes, including athletes under 18, with the team
            they most recently played for and the town they are from. A parent or guardian may ask us at any
            time to remove a minor's name, or to show initials instead, and we will do so without question.
            Write to <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a>.
          </p>

          <h2>11. If you are in the EEA or the UK</h2>
          <p>
            We are not established in Europe and do not target visitors there, but if you contact us from the
            EEA or the UK you may still ask us to access, correct, erase, or port your data, and to restrict or
            object to processing. Where we process your information it is because it is necessary to perform a
            contract with you (your order), to comply with a legal obligation (tax records), or for our
            legitimate interest in keeping the site secure.
          </p>

          <h2>12. Changes</h2>
          <p>
            If we change this policy we will update the date at the top of this page, and for significant
            changes we will say so on the site.
          </p>

          <div class="note">
            <p>
              <strong>Questions?</strong> Email
              <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a> and a person will answer you.
            </p>
          </div>`,
  }),

  legalPage({
    file: 'cookies.html',
    title: 'Cookie Policy',
    description: 'The cookies Lebanon Hockey uses, why there is no cookie banner, and how to control them.',
    heading: 'Cookie <span class="accent">Policy</span>',
    lead: 'We use exactly one cookie, and only when you actually need it.',
    body: `          <p>
            A cookie is a small file a website asks your browser to store. This page lists every cookie
            Lebanon Hockey uses and what each one does.
          </p>

          <div class="callout">
            <p>
              <strong>We use one cookie, and no tracking of any kind.</strong> There are no analytics cookies,
              no advertising cookies, no social media pixels, and no third-party scripts on this site.
            </p>
          </div>

          <h2>The cookie we use</h2>
          <div class="table-scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Purpose</th><th>Set when</th><th>Expires</th><th>Type</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>lh_sid</code></td>
                  <td>
                    Identifies your browsing session so we can remember what is in your cart, keep you signed
                    in, and protect forms against cross-site request forgery.
                  </td>
                  <td>
                    Only when you first add something to the cart, sign in, register, or submit a form. Simply
                    reading pages sets no cookie at all.
                  </td>
                  <td>30 days, or immediately when you sign out</td>
                  <td>First-party, strictly necessary, <code>HttpOnly</code>, <code>SameSite=Lax</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The cookie holds a random identifier only. It contains no personal information, and it cannot be
            read by JavaScript or by any other website.
          </p>

          <h2>Why there is no cookie banner</h2>
          <p>
            Consent banners exist because of cookies that track you. Ours does not: <code>lh_sid</code> is
            strictly necessary to deliver a service you have explicitly asked for — keeping your cart, or
            keeping you signed in — and cookies of that kind are recognised as exempt from prior consent under
            Quebec's Law&nbsp;25 and comparable rules elsewhere.
          </p>
          <p>
            We have also deliberately delayed it: the cookie is issued only at the moment you do something that
            needs it. If you browse the site and never use the cart or sign in, no cookie is ever set.
          </p>
          <p>
            If we ever add analytics or any other non-essential cookie, we will ask for your consent first and
            this page will change.
          </p>

          <h2>Cookies set by Stripe during payment</h2>
          <p>
            When you check out, we send you to Stripe's own hosted payment page at
            <code>checkout.stripe.com</code>. Stripe sets its own cookies there for fraud prevention and to
            operate that page. Those cookies belong to Stripe, are set on Stripe's domain, and are governed by
            Stripe's privacy policy — we cannot read them. You are returned to our site once payment
            completes.
          </p>

          <h2>Similar technologies</h2>
          <p>
            The shop uses your browser's <code>sessionStorage</code> to remember a discount code you have typed
            while you move between the cart and checkout. That information stays on your device, is cleared
            when you close the tab, and is never sent anywhere except when you apply the code.
          </p>
          <p>
            If you start a chat with us, your browser's <code>localStorage</code> keeps one value,
            <code>lh_chat_token</code>, so your conversation is still there as you move from page to page or
            come back later. It identifies the conversation and nothing else &mdash; it is not an account, it is
            not linked to your name unless you tell us, and it is not used to follow you around the site.
            Clearing your browser storage ends that conversation; you can always start a new one.
          </p>
          <p>
            Chat messages are kept so the federation can answer you and refer back to what was asked. They are
            held for up to 12 months, the same as messages sent through the contact form, and then deleted.
          </p>

          <h2>Controlling cookies</h2>
          <p>
            You can delete or block cookies in your browser settings, usually under Privacy or Site Data.
            Blocking <code>lh_sid</code> will stop the shopping cart and sign-in from working, because the
            site has no other way to recognise your session. The rest of the site will still work normally.
          </p>

          <h2>Changes</h2>
          <p>
            If the cookies we use change, we will update this page and the date shown at the top.
          </p>

          <div class="note">
            <p>
              Questions about this policy? Email
              <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a>. See also our
              <a href="privacy.html">Privacy Policy</a>.
            </p>
          </div>`,
  }),

  legalPage({
    file: 'refund-policy.html',
    title: 'Refunds & Returns',
    description:
      'Lebanon Hockey refund policy: all sales are final. Faulty, damaged or incorrect items are replaced or refunded in full.',
    heading: 'Refunds &amp; <span class="accent">Returns</span>',
    lead: 'All sales are final. Anything faulty, damaged or wrong is always put right.',
    body: `          <div class="callout">
            <p>
              <strong>In short:</strong> all sales are final. Orders cannot be returned, exchanged or
              refunded once they are placed. The one exception is an item that arrives faulty, damaged or
              not what you ordered &mdash; we put that right.
            </p>
          </div>

          <h2>1. All sales are final</h2>
          <p>
            Every item sold by the Lebanese Ice Hockey Federation is <strong>non-refundable and
            non-returnable</strong>. We do not accept returns for change of mind, for the wrong size, or
            because an item is no longer wanted.
          </p>
          <p>
            The federation is a small organization and its merchandise is produced in short runs, much of it
            made to order. Stock that comes back cannot be resold, and the cost of handling returns comes
            straight out of what is available for the programs. This policy is what keeps the shop viable.
          </p>

          <h2>2. Check your size before you order</h2>
          <p>
            Because an order cannot be exchanged, please check the sizing note on the product page before
            you buy, and ask us for the garment measurements if you are at all unsure. Email
            <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a> <em>before</em> ordering and we
            will help you choose &mdash; we would far rather spend five minutes on that than have you stuck
            with something that does not fit.
          </p>

          <h2>3. Faulty, damaged, or incorrect items</h2>
          <p>
            This is the exception, and it is not discretionary. If an item arrives faulty, damaged in
            transit, or is not the item you ordered, contact us within <strong>14 days of delivery</strong>
            with your order number and photographs. We will replace it or refund it in full, including
            shipping, at no cost to you.
          </p>
          <p>
            A manufacturing fault that shows up later is still a fault. Tell us and we will look at it.
          </p>

          <h2>4. Personalized and custom-made items</h2>
          <p>
            Items personalized with a name or number are made individually for you and cannot be resold in
            any circumstances. Please check the spelling and number on your order carefully before paying.
            Section 3 still applies: a personalized item that is faulty, or that was made with details
            different from the ones you submitted, is our error and we fix it.
          </p>

          <h2>5. Cancelling an order</h2>
          <p>
            An order can only be cancelled if production has not started. Email us as soon as possible with
            your order number. Once an item has gone into production it cannot be cancelled.
          </p>

          <h2>6. Orders paid by Interac e-Transfer</h2>
          <p>
            An e-Transfer order is reserved when you place it and becomes final when the transfer arrives. If
            you decide not to send the transfer, simply do not send it &mdash; nothing is charged and the
            order lapses. Once the transfer has been received the policy above applies in full.
          </p>

          <h2>7. Delivery times</h2>
          <p>
            Most orders ship within 2&ndash;3 weeks. Delivery after that depends on where the parcel is
            going; the estimate for your destination is shown at checkout once you choose your country. A
            delivery taking longer than estimated is not grounds for a refund, but tell us if a parcel seems
            lost and we will chase it.
          </p>

          <h2>8. Donations and memberships</h2>
          <p>
            Donations and membership fees are also non-refundable. A monthly donation can be stopped at any
            time using the link in your confirmation email; stopping it prevents future charges and does not
            refund past ones.
          </p>

          <h2>9. Your statutory rights</h2>
          <p>
            This policy does not and cannot limit your rights under Quebec's <em>Consumer Protection Act</em>
            or other applicable consumer law. Those rights apply in addition to the terms above, in
            particular where goods do not match their description or are not fit for their ordinary purpose.
            Where this policy and the law disagree, the law wins.
          </p>

          <div class="note">
            <p>
              <strong>Something wrong with your order?</strong> Email
              <a href="mailto:info@lebanonhockey.com">info@lebanonhockey.com</a> with your order number. A
              faulty, damaged or incorrect item is always put right &mdash; the policy above is about change
              of mind, not about leaving you with something broken.
            </p>
          </div>`,
  })
);

pages.forEach((page) => {
  writeFileSync(join(root, page.file), shell(page));
});

console.log(`Generated ${pages.length} pages:`);
pages.forEach((p) => console.log(`  ${p.file}`));
