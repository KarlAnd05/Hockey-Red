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
};

const NAV = [
  ['index.html', 'dashboard', 'Dashboard'],
  ['products.html', 'products', 'Products'],
  ['orders.html', 'orders', 'Orders'],
  ['customers.html', 'customers', 'Customers'],
  ['invoices.html', 'invoices', 'Invoices'],
  ['discounts.html', 'discounts', 'Discounts'],
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
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
];

pages.forEach((page) => {
  writeFileSync(join(root, 'admin', page.file), shell(page));
});

console.log(`Generated ${pages.length} admin pages:`);
pages.forEach((p) => console.log(`  admin/${p.file}`));
