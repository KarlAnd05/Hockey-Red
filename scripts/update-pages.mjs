/**
 * One-off migration: bring the existing static pages onto the new shell
 * (display font, header account/cart tools, full footer, shared scripts).
 *
 * Safe to re-run - every step checks whether it has already been applied.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Fonts are self-hosted (see the @font-face block in assets/styles.css), so
// pages preload the two latin files instead of calling out to Google.
const FONT_PRELOAD =
  '    <link rel="preload" href="./assets/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>\n' +
  '    <link rel="preload" href="./assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>\n';

const HEADER_TOOLS = `
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
`;

const FOOTER = `    <footer class="site-footer">
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
        <nav class="footer-legal" aria-label="Legal">
          <a href="privacy.html">Privacy</a>
          <a href="cookies.html">Cookies</a>
          <a href="refund-policy.html">Refunds &amp; Returns</a>
        </nav>
        <p>1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1</p>
      </div>
    </footer>`;

const SKIP_LINK = '    <a class="skip-link" href="#main">Skip to content</a>\n';

// Pages written from scratch already carry the new shell.
const SKIP_FILES = new Set([
  'shop.html',
  'product.html',
  'cart.html',
  'checkout.html',
  'order-confirmation.html',
  'login.html',
  'register.html',
  'account.html',
  'forgot-password.html',
  'reset-password.html',
  'privacy.html',
  'cookies.html',
  'refund-policy.html',
]);

const files = readdirSync(root).filter((f) => f.endsWith('.html') && !SKIP_FILES.has(f));
const report = [];

for (const file of files) {
  const path = join(root, file);
  let html = readFileSync(path, 'utf8');
  const before = html;
  const steps = [];

  /* --- Self-hosted fonts -------------------------------------------------- */
  if (html.includes('fonts.googleapis.com')) {
    html = html
      .replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\r?\n/g, '')
      .replace(/[ \t]*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\r?\n/g, '')
      .replace(/[ \t]*<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*" rel="stylesheet">\r?\n/g, '');
    steps.push('drop-google-fonts');
  }

  if (!html.includes('fonts/archivo-latin.woff2')) {
    html = html.replace(
      /([ \t]*<link rel="stylesheet" href="\.\/assets\/styles\.css">)/,
      `${FONT_PRELOAD}$1`
    );
    steps.push('font-preload');
  }

  /* --- Skip link --------------------------------------------------------- */
  if (!html.includes('class="skip-link"')) {
    html = html.replace(/(\s*<div class="flag-strip"[^>]*><\/div>\n)/, `\n${SKIP_LINK}$1`);
    steps.push('skip-link');
  }

  /* --- main landmark id -------------------------------------------------- */
  if (!/<main[^>]*id="main"/.test(html)) {
    html = html.replace(/<main>/, '<main id="main">');
    steps.push('main-id');
  }

  /* --- Header tools ------------------------------------------------------ */
  if (!html.includes('class="header-tools"')) {
    html = html.replace(/(\n\s*<\/header>)/, `${HEADER_TOOLS}$1`);
    steps.push('header-tools');
  }

  /* --- Footer ------------------------------------------------------------ */
  if (!html.includes('class="footer-grid"')) {
    html = html.replace(
      /[ \t]*<footer class="site-footer">[\s\S]*?<\/footer>/,
      FOOTER
    );
    steps.push('footer');
  }

  /* --- Shared script ----------------------------------------------------- */
  if (!html.includes('assets/api.js')) {
    html = html.replace(
      /(\s*)<script src="\.\/assets\/app\.js"><\/script>/,
      '$1<script src="./assets/api.js"></script>$1<script src="./assets/app.js"></script>'
    );
    steps.push('api-script');
  }

  if (html !== before) {
    writeFileSync(path, html);
    report.push(`  ${file.padEnd(24)} ${steps.join(', ')}`);
  } else {
    report.push(`  ${file.padEnd(24)} (already current)`);
  }
}

console.log(`Updated ${files.length} pages:\n${report.join('\n')}`);
