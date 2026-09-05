/**
 * Generates the storefront and account pages so they share one shell with the
 * rest of the site. Re-run after editing the shell here.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const NAV = [
  ['index.html', 'Home'],
  ['about.html', 'About'],
  ['news.html', 'News'],
  ['mens-program.html', "Men's Program"],
  ['womens-program.html', "Women's Program"],
  ['membership.html', 'Membership'],
  ['youth-camp.html', 'Youth Camp'],
  ['events.html', 'Events'],
  ['sponsors.html', 'Sponsors'],
  ['shop.html', 'Shop'],
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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

      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
        <span></span>
        <span></span>
        <span></span>
      </button>

      <nav id="site-nav" class="site-nav" aria-label="Primary navigation">
${nav}
      </nav>

      <div class="header-tools">
        <a class="icon-button" data-account-link href="login.html">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
          <h4>Programs</h4>
          <ul class="footer-links">
            <li><a href="mens-program.html">Men's Program</a></li>
            <li><a href="womens-program.html">Women's Program</a></li>
            <li><a href="youth-camp.html">Youth Camp</a></li>
            <li><a href="membership.html">Membership</a></li>
          </ul>
        </div>
        <div>
          <h4>Federation</h4>
          <ul class="footer-links">
            <li><a href="about.html">About</a></li>
            <li><a href="news.html">News</a></li>
            <li><a href="events.html">Events</a></li>
            <li><a href="sponsors.html">Sponsors</a></li>
          </ul>
        </div>
        <div>
          <h4>Shop</h4>
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
        <p>1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1</p>
      </div>
    </footer>

    <script src="./assets/api.js"></script>
    <script src="./assets/app.js"></script>
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
  title: 'Shop · Lebanon Hockey',
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
            <p class="eyebrow">Team Shop</p>
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
                <h3>Category</h3>
                <div class="filter-options" data-category-filters></div>
              </div>

              <div class="filter-group">
                <h3>Price</h3>
                <div class="price-row">
                  <input type="number" min="0" placeholder="Min" aria-label="Minimum price" data-min-price>
                  <span>to</span>
                  <input type="number" min="0" placeholder="Max" aria-label="Maximum price" data-max-price>
                </div>
              </div>

              <div class="filter-group">
                <h3>Availability</h3>
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
            <a href="shop.html">Shop</a> /
            <span aria-current="page">Cart</span>
          </nav>

          <h1 style="font-size:clamp(32px,4vw,52px);margin-bottom:var(--s-6)">Your Cart</h1>

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
            <a href="shop.html">Shop</a> /
            <a href="cart.html">Cart</a> /
            <span aria-current="page">Checkout</span>
          </nav>

          <h1 style="font-size:clamp(32px,4vw,52px);margin-bottom:var(--s-6)">Checkout</h1>

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
                  <input type="text" name="country" autocomplete="country-name" value="Canada">
                </label>
              </div>

              <button type="submit" class="button primary block">Pay securely</button>
              <p class="form-status" data-checkout-status role="status"></p>
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

pages.forEach((page) => {
  writeFileSync(join(root, page.file), shell(page));
});

console.log(`Generated ${pages.length} pages:`);
pages.forEach((p) => console.log(`  ${p.file}`));
