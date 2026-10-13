/**
 * Generates the admin screens. They live in admin/ and are served only through
 * the requireAdmin-gated Express route, never from the static directory.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'admin'), { recursive: true });

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  products: '<path d="M20 7 12 3 4 7v10l8 4 8-4z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
  orders: '<path d="M6 2h12l2 6-8 14L4 8z"/><path d="M4 8h16"/>',
  customers: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  invoices: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  discounts: '<path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9z"/><circle cx="8" cy="8" r="1.4"/>',
  content: '<path d="M4 5h16M4 10h16M4 15h10"/><path d="m15.5 20.5 5-5 2 2-5 5H15.5z"/>',
  donations: '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z"/>',
  news: '<path d="M4 5h12a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2z"/><path d="M18 9h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M7 9h6M7 13h6M7 17h4"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.8-5.2A8.2 8.2 0 0 1 3.6 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 8.4 8.4z"/>',
  registrations: '<path d="M16 3H8a2 2 0 0 0-2 2v16l6-3 6 3V5a2 2 0 0 0-2-2z"/><path d="M9 8h6M9 12h4"/>',
  roster: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
};

const NAV = [
  ['index.html', 'dashboard', 'Dashboard'],
  ['products.html', 'products', 'Products'],
  ['orders.html', 'orders', 'Orders'],
  ['customers.html', 'customers', 'Customers'],
  ['invoices.html', 'invoices', 'Invoices'],
  ['discounts.html', 'discounts', 'Discounts'],
  ['donations.html', 'donations', 'Donations'],
  ['news.html', 'news', 'News'],
  ['chat.html', 'chat', 'Chat'],
  ['registrations.html', 'registrations', 'Registrations'],
  ['roster.html', 'roster', 'Roster'],
  ['content.html', 'content', 'Page text'],
];

function shell({ file, key, title, heading, lead, actions = '', body }) {
  const nav = NAV.map(
    ([href, icon, label]) => `        <a href="${href}"${href === file ? ' class="is-active"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>
          <span>${label}</span>
        </a>`
  ).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>${title} · Lebanon Hockey Admin</title>
    <link rel="icon" href="/assets/LIHF-01_edited.png" type="image/png">
    <link rel="preload" href="/assets/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/assets/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/assets/styles.css">
    <link rel="stylesheet" href="/assets/store.css">
    <link rel="stylesheet" href="/assets/admin.css">
  </head>
  <body class="admin-body" data-admin-page="${key}">
    <aside class="admin-rail">
      <a class="admin-brand" href="index.html">
        <img src="/assets/LIHF-01_edited.png" alt="">
        <span>Lebanon Hockey<small>Admin</small></span>
      </a>

      <nav class="admin-nav" aria-label="Admin sections">
${nav}
      </nav>

      <div class="admin-rail-foot">
        <div class="admin-user" data-admin-user></div>
        <a href="/index.html">View site</a>
        <button type="button" data-admin-logout>Sign out</button>
      </div>
    </aside>

    <main class="admin-main">
      <div class="admin-head">
        <div>
          <h1>${heading}</h1>
          <p>${lead}</p>
        </div>
        <div class="admin-actions">${actions}</div>
      </div>

${body}
    </main>

    <div class="modal-backdrop" data-modal-backdrop hidden></div>

    <script src="/assets/api.js"></script>
    <script src="/assets/admin.js"></script>
  </body>
</html>
`;
}

const pages = [
  {
    file: 'index.html',
    key: 'dashboard',
    title: 'Dashboard',
    heading: 'Dashboard',
    lead: 'Revenue, orders, and stock at a glance.',
    body: `      <div class="stat-grid" data-stats></div>

      <section class="admin-panel">
        <header><h2>Revenue, last 30 days</h2></header>
        <div class="chart" data-chart></div>
      </section>

      <section class="admin-panel">
        <header>
          <h2>Recent orders</h2>
          <a class="mini-button" href="orders.html">All orders</a>
        </header>
        <div data-recent-orders></div>
      </section>

      <section class="admin-panel">
        <header>
          <h2>Low stock</h2>
          <a class="mini-button" href="products.html">Manage products</a>
        </header>
        <div data-low-stock></div>
      </section>

      <section class="admin-panel">
        <header><h2>Best sellers</h2></header>
        <div data-top-products></div>
      </section>`,
  },
  {
    file: 'products.html',
    key: 'products',
    title: 'Products',
    heading: 'Products',
    lead: 'Catalogue, pricing, stock, and sizes.',
    actions: '<button type="button" class="button primary small" data-new-product>New product</button>',
    body: `      <div class="admin-toolbar">
        <input type="search" placeholder="Search products" aria-label="Search products" data-product-search>
      </div>

      <section class="admin-panel">
        <div data-products></div>
      </section>`,
  },
  {
    file: 'orders.html',
    key: 'orders',
    title: 'Orders',
    heading: 'Orders',
    lead: 'Every order, its status, and its invoice.',
    body: `      <div class="admin-toolbar">
        <input type="search" placeholder="Search order number, email, or name" aria-label="Search orders" data-order-search>
        <select data-status-filter aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <section class="admin-panel">
        <div data-orders></div>
      </section>`,
  },
  {
    file: 'customers.html',
    key: 'customers',
    title: 'Customers',
    heading: 'Customers',
    lead: 'Accounts, spend, and admin access.',
    body: `      <div class="admin-toolbar">
        <input type="search" placeholder="Search name or email" aria-label="Search customers" data-customer-search>
      </div>

      <section class="admin-panel">
        <div data-customers></div>
      </section>`,
  },
  {
    file: 'invoices.html',
    key: 'invoices',
    title: 'Invoices',
    heading: 'Invoices',
    lead: 'Issued automatically when an order is paid.',
    body: `      <section class="admin-panel">
        <div data-invoices></div>
      </section>`,
  },
  {
    file: 'discounts.html',
    key: 'discounts',
    title: 'Discounts',
    heading: 'Discounts',
    lead: 'Promotional codes, limits, and redemptions.',
    actions: '<button type="button" class="button primary small" data-new-discount>New code</button>',
    body: `      <section class="admin-panel">
        <div data-discounts></div>
      </section>`,
  },
  {
    file: 'donations.html',
    key: 'donations',
    title: 'Donations',
    heading: 'Donations',
    lead: 'One-time gifts and monthly donors. Figures are what the federation actually received.',
    body: `      <div class="stat-grid" data-donation-stats></div>

      <section class="admin-panel">
        <div data-donations></div>
      </section>`,
  },
  {
    file: 'news.html',
    key: 'news',
    title: 'News',
    heading: 'News posts',
    lead: 'Each post gets its own page and its own share preview. Photos open full screen.',
    actions: '<button type="button" class="button primary small" data-new-post>New post</button>',
    body: `      <section class="admin-panel">
        <div data-news-admin></div>
      </section>`,
  },
  {
    file: 'chat.html',
    key: 'chat',
    title: 'Chat',
    heading: 'Chat',
    lead: 'Visitors asking questions on the site. Replies reach them the next time their page checks in.',
    body: `      <div class="chat-admin">
        <aside class="chat-threads" data-chat-threads aria-label="Conversations"></aside>
        <section class="chat-thread" data-chat-thread></section>
      </div>`,
  },
  {
    file: 'registrations.html',
    key: 'registrations',
    title: 'Registrations',
    heading: 'Membership registrations',
    lead: 'Applications from the membership form. Eligibility details are shown only when you open a record.',
    actions:
      '<a class="button ghost small" href="/api/admin/registrations.csv">Export CSV</a>',
    body: `      <div class="stat-grid" data-registration-stats></div>

      <section class="admin-panel">
        <div data-registrations></div>
      </section>`,
  },
  {
    file: 'roster.html',
    key: 'roster',
    title: 'Roster',
    heading: 'Team roster',
    lead: "Players shown on the men's and women's program pages. Hiding a player removes them from the public site without losing the record.",
    actions: '<button type="button" class="button primary small" data-new-player>Add player</button>',
    body: `      <div class="admin-toolbar">
        <select data-roster-program aria-label="Program">
          <option value="womens">Women&rsquo;s program</option>
          <option value="mens">Men&rsquo;s program</option>
        </select>
      </div>

      <section class="admin-panel">
        <div data-roster-admin></div>
      </section>`,
  },
  {
    file: 'content.html',
    key: 'content',
    title: 'Page text',
    heading: 'Page text',
    lead: 'Rewrite any heading, paragraph or list item on the public site. Changes go live immediately.',
    actions:
      '<button type="button" class="button ghost small" data-content-resync>Re-read pages</button>',
    body: `      <section class="admin-panel">
        <div class="content-intro">
          <p>
            Every block of text on the public pages is listed here, page by page.
            Edit one and it replaces the wording visitors see &mdash; the page file
            itself is left alone, so a rebuild cannot wipe your changes.
            <strong>Reset</strong> puts a block back to what the page's own markup says.
          </p>
          <p class="content-hint">
            After <code>npm run build</code> or a hand edit to a page, use
            <strong>Re-read pages</strong> so this list matches the site again.
          </p>
        </div>

        <div class="content-toolbar">
          <div class="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" placeholder="Search the site's text" aria-label="Search the site's text" data-content-search>
          </div>
          <select data-content-page aria-label="Filter by page">
            <option value="">All pages</option>
          </select>
          <label class="content-only-edited">
            <input type="checkbox" data-content-edited-only>
            Edited only
          </label>
          <p class="result-count" data-content-count aria-live="polite"></p>
        </div>

        <div data-content-list></div>
      </section>`,
  },
];

pages.forEach((page) => {
  writeFileSync(join(root, 'admin', page.file), shell(page));
});

console.log(`Generated ${pages.length} admin pages:`);
pages.forEach((p) => console.log(`  admin/${p.file}`));
