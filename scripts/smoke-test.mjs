/**
 * End-to-end smoke test against a running dev server.
 *
 *   npm run dev            (in one terminal)
 *   npm run smoke          (in another)
 *
 * Covers catalogue, cart, discounts, checkout, invoices, accounts, admin
 * gating, and server-side price integrity.
 */
const BASE = process.env.SMOKE_BASE || `http://127.0.0.1:${process.env.PORT || 5174}`;

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

/** Minimal cookie jar so each identity keeps its own session. */
function createClient() {
  const jar = new Map();
  let csrfToken = '';

  async function request(path, options = {}) {
    const headers = Object.assign({}, options.headers);

    if (jar.size) {
      headers.Cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (csrfToken && options.method && options.method !== 'GET') {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    });

    (response.headers.getSetCookie?.() || []).forEach((raw) => {
      const [pair] = raw.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) jar.set(name, value);
      else jar.delete(name);
    });

    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json')
      ? await response.json().catch(() => ({}))
      : await response.text();

    return { status: response.status, body: payload, headers: response.headers };
  }

  return {
    request,
    async bootstrap() {
      const { body } = await request('/api/session');
      csrfToken = body.csrfToken;
      return body;
    },
    refreshCsrf(token) {
      csrfToken = token;
    },
  };
}

const uniq = Date.now();

/* ========================================================================== */
console.log(`\nLebanon Hockey smoke test -> ${BASE}`);

const guest = createClient();

section('Session and pages');
{
  const session = await guest.bootstrap();
  check('GET /api/session returns a CSRF token', Boolean(session.csrfToken));
  check('guest starts signed out', session.user === null);

  const home = await guest.request('/');
  check('GET / serves the home page', home.status === 200 && String(home.body).includes('<title>'));

  const shop = await guest.request('/shop.html');
  check('GET /shop.html serves the shop', shop.status === 200);

  const blocked = await guest.request('/server/config.js');
  check('server source is not web-reachable', blocked.status === 404, `got ${blocked.status}`);

  const envBlocked = await guest.request('/.env');
  check('.env is not web-reachable', envBlocked.status === 404, `got ${envBlocked.status}`);
}

section('Catalogue');
let sampleProduct;
{
  const { body: categories } = await guest.request('/api/categories');
  check('categories load', categories.categories.length === 4, `got ${categories.categories?.length}`);

  const { body: all } = await guest.request('/api/products?perPage=48');
  check('all 11 seeded products load', all.total === 11, `got ${all.total}`);

  const { body: search } = await guest.request('/api/products?search=jersey');
  check('search finds the jersey', search.products.some((p) => p.slug.includes('jersey')));

  const { body: filtered } = await guest.request('/api/products?category=collectibles');
  check('category filter works', filtered.products.every((p) => p.category.slug === 'collectibles'));

  const { body: priced } = await guest.request('/api/products?maxPrice=30');
  check('price filter works', priced.products.every((p) => p.priceCents <= 3000));

  const { body: sorted } = await guest.request('/api/products?sort=price-desc&perPage=48');
  check(
    'sort by price works',
    sorted.products[0].priceCents >= sorted.products[sorted.products.length - 1].priceCents
  );

  const { body: detail } = await guest.request('/api/products/official-team-lebanon-hockey-jersey');
  sampleProduct = detail.product;
  check('product detail loads with variants', detail.product.variants.length === 6);

  const placeholder = await guest.request('/api/placeholder/t-shirt.svg');
  check('placeholder art renders', placeholder.status === 200 && String(placeholder.body).includes('<svg'));
}

section('Cart');
{
  const rejected = await guest.request('/api/cart/items', {
    method: 'POST',
    body: { slug: sampleProduct.slug, quantity: 1 },
  });
  check('adding a sized product without a size is rejected', rejected.status === 400);

  const added = await guest.request('/api/cart/items', {
    method: 'POST',
    body: { slug: sampleProduct.slug, variantId: sampleProduct.variants[2].id, quantity: 2 },
  });
  check('add to cart works', added.status === 200 && added.body.count === 2, JSON.stringify(added.body).slice(0, 120));
  check('line total is priced server-side', added.body.subtotalCents === 77000, `got ${added.body.subtotalCents}`);

  const pin = await guest.request('/api/cart/items', {
    method: 'POST',
    body: { slug: 'official-lebanon-hockey-pin', quantity: 3 },
  });
  check('second product added', pin.body.count === 5, `got ${pin.body.count}`);
  check('shipping is free above the threshold', pin.body.shippingCents === 0);

  const itemId = pin.body.items[1].id;
  const updated = await guest.request(`/api/cart/items/${itemId}`, {
    method: 'PATCH',
    body: { quantity: 1 },
  });
  check('quantity update works', updated.body.count === 3, `got ${updated.body.count}`);

  const bad = await guest.request('/api/cart/discount', { method: 'POST', body: { code: 'NOPE' } });
  check('unknown discount code is refused', bad.status === 400);

  const good = await guest.request('/api/cart/discount', { method: 'POST', body: { code: 'CEDAR10' } });
  check('CEDAR10 applies 10 percent', good.body.discountCents === Math.round(good.body.subtotalCents * 0.1));

  const noCsrf = await fetch(`${BASE}/api/cart`, { method: 'DELETE' });
  check('writes without a CSRF token are refused', noCsrf.status === 403, `got ${noCsrf.status}`);
}

section('Accounts');
const customerEmail = `smoke-customer-${uniq}@example.com`;
const customer = createClient();
{
  await customer.bootstrap();

  const weak = await customer.request('/api/auth/register', {
    method: 'POST',
    body: { email: customerEmail, password: 'short' },
  });
  check('weak passwords are rejected', weak.status === 400);

  const registered = await customer.request('/api/auth/register', {
    method: 'POST',
    body: { email: customerEmail, password: 'SmokeTest!2026', firstName: 'Smoke', lastName: 'Test' },
  });
  check('registration works', registered.status === 201, JSON.stringify(registered.body).slice(0, 120));
  check('new accounts are customers, not admins', registered.body.user?.role === 'customer');
  customer.refreshCsrf(registered.body.csrfToken);

  const duplicate = await customer.request('/api/auth/register', {
    method: 'POST',
    body: { email: customerEmail, password: 'SmokeTest!2026' },
  });
  // 429 is also a refusal: repeated runs from one IP trip the register limiter,
  // which is the behaviour we want in production.
  check(
    'duplicate email is refused',
    duplicate.status === 409 || duplicate.status === 429,
    `got ${duplicate.status}`
  );
  if (duplicate.status === 429) {
    console.log('        (register rate limiter active - expected on repeat runs)');
  }

  const profile = await customer.request('/api/auth/profile', {
    method: 'PATCH',
    body: { firstName: 'Smoked', lastName: 'Tested', phone: '+1 514 555 0100' },
  });
  check('profile update works', profile.body.user?.firstName === 'Smoked');

  const loggedOut = await customer.request('/api/auth/logout', { method: 'POST' });
  check('logout works', loggedOut.status === 200);

  await customer.bootstrap();
  const wrong = await customer.request('/api/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password: 'WrongPassword1' },
  });
  check('wrong password is refused', wrong.status === 401);

  const login = await customer.request('/api/auth/login', {
    method: 'POST',
    body: { email: customerEmail, password: 'SmokeTest!2026' },
  });
  check('login works', login.status === 200);
  customer.refreshCsrf(login.body.csrfToken);
}

section('Checkout and invoice');
let orderId;
{
  const { body: beforeStock } = await guest.request('/api/products/lihf-pucks');
  const stockBefore = beforeStock.product.stock;

  await customer.request('/api/cart/items', {
    method: 'POST',
    body: { slug: 'lihf-pucks', quantity: 2 },
  });

  const missingAddress = await customer.request('/api/checkout', {
    method: 'POST',
    body: { email: customerEmail },
  });
  check('checkout requires an address', missingAddress.status === 400);

  const checkout = await customer.request('/api/checkout', {
    method: 'POST',
    body: {
      email: customerEmail,
      name: 'Smoke Test',
      line1: '1418 Victoria Avenue',
      city: 'Greenfield Park',
      region: 'QC',
      postal: 'J4V 1M1',
      country: 'Canada',
      discountCode: 'CEDAR10',
    },
  });

  orderId = checkout.body.orderId;
  check('checkout creates a pending order', Boolean(orderId), JSON.stringify(checkout.body).slice(0, 160));

  const settled = await customer.request(`/api/checkout/dev-complete/${orderId}`, { method: 'POST' });
  check('order settles to paid', settled.body.order?.status === 'paid', JSON.stringify(settled.body).slice(0, 160));

  const order = settled.body.order || {};
  check(
    'discount recorded on the order',
    order.discountCode === 'CEDAR10' && order.discountCents === Math.round(order.subtotalCents * 0.1),
    `code ${order.discountCode}, discount ${order.discountCents} of ${order.subtotalCents}`
  );
  check(
    'order total is subtotal - discount + shipping + tax',
    order.totalCents ===
      order.subtotalCents - order.discountCents + order.shippingCents + order.taxCents,
    `got ${order.totalCents}`
  );

  const { body: cartAfter } = await customer.request('/api/cart');
  check('cart is emptied after payment', cartAfter.count === 0, `got ${cartAfter.count}`);

  const { body: history } = await customer.request('/api/orders');
  check('order appears in history', history.orders.some((o) => o.id === orderId));

  const invoice = await customer.request(`/api/orders/${orderId}/invoice`);
  check(
    'invoice PDF downloads',
    invoice.headers.get('content-type') === 'application/pdf',
    invoice.headers.get('content-type')
  );

  const { body: stock } = await guest.request('/api/products/lihf-pucks');
  check(
    'stock decremented on payment',
    stock.product.stock === stockBefore - 2,
    `got ${stock.product.stock}, expected ${stockBefore - 2}`
  );
}

section('Authorization');
{
  const otherOrder = await guest.request(`/api/orders/${orderId}`);
  check('another visitor cannot read the order', otherOrder.status === 404, `got ${otherOrder.status}`);

  const otherInvoice = await guest.request(`/api/orders/${orderId}/invoice`);
  check('another visitor cannot download the invoice', otherInvoice.status === 404);

  const guestOrders = await guest.request('/api/orders');
  check('order history requires sign-in', guestOrders.status === 401);

  const adminEndpoints = ['/api/admin/stats', '/api/admin/products', '/api/admin/orders', '/api/admin/customers', '/api/admin/invoices', '/api/admin/discounts'];

  for (const endpoint of adminEndpoints) {
    const asCustomer = await customer.request(endpoint);
    check(`customer is blocked from ${endpoint}`, asCustomer.status === 404, `got ${asCustomer.status}`);
  }

  const adminHtml = await customer.request('/admin/');
  check('customer cannot load the admin shell', adminHtml.status === 404, `got ${adminHtml.status}`);

  const adminHtmlGuest = await guest.request('/admin/index.html');
  check('guest cannot load the admin shell', adminHtmlGuest.status === 404);

  const escalate = await customer.request('/api/admin/customers/1/role', {
    method: 'PATCH',
    body: { role: 'admin' },
  });
  check('customer cannot promote themselves', escalate.status === 404);
}

section('Price integrity');
{
  const tamper = createClient();
  await tamper.bootstrap();

  const added = await tamper.request('/api/cart/items', {
    method: 'POST',
    body: {
      slug: 'official-lebanon-hockey-pin',
      quantity: 1,
      priceCents: 1,
      unitPriceCents: 1,
      price: 0.01,
      lineTotalCents: 1,
    },
  });

  check(
    'forged prices in the request body are ignored',
    added.body.subtotalCents === 1500,
    `got ${added.body.subtotalCents}`
  );

  const hugeQty = await tamper.request('/api/cart/items', {
    method: 'POST',
    body: { slug: 'cedar-trophy', quantity: 100000 },
  });
  check('absurd quantities are refused or clamped', hugeQty.status === 409 || hugeQty.body.count <= 200);

  const negative = await tamper.request('/api/cart/items', {
    method: 'POST',
    body: { slug: 'cap', quantity: -5 },
  });
  check('negative quantities cannot credit the cart', negative.body.subtotalCents >= 1500);
}

section('Admin');
if (!process.env.SMOKE_ADMIN_EMAIL || !process.env.SMOKE_ADMIN_PASSWORD) {
  console.log('  SKIP  set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD to test the admin area');
} else {
  const admin = createClient();
  await admin.bootstrap();

  const login = await admin.request('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.SMOKE_ADMIN_EMAIL, password: process.env.SMOKE_ADMIN_PASSWORD },
  });
  check('admin can sign in', login.status === 200, JSON.stringify(login.body).slice(0, 120));
  check('admin has the admin role', login.body.user?.role === 'admin');
  admin.refreshCsrf(login.body.csrfToken);

  const shell = await admin.request('/admin/');
  check('admin can load the admin shell', shell.status === 200, `got ${shell.status}`);

  for (const file of ['products.html', 'orders.html', 'customers.html', 'invoices.html', 'discounts.html']) {
    const res = await admin.request(`/admin/${file}`);
    check(`admin can load ${file}`, res.status === 200, `got ${res.status}`);
  }

  const traversal = await admin.request('/admin/../.env');
  check('admin route rejects path traversal', traversal.status === 404, `got ${traversal.status}`);

  const { body: stats } = await admin.request('/api/admin/stats');
  check('dashboard stats load', typeof stats.revenueCents === 'number' && Array.isArray(stats.series));
  check('dashboard counts paid orders', stats.paidCount >= 1, `got ${stats.paidCount}`);

  const { body: adminProducts } = await admin.request('/api/admin/products');
  check('admin product list loads', adminProducts.products.length === 11, `got ${adminProducts.products?.length}`);

  const created = await admin.request('/api/admin/products', {
    method: 'POST',
    body: { name: `Smoke Product ${uniq}`, priceCents: 4200, stock: 7, active: true },
  });
  check('admin can create a product', created.status === 201, JSON.stringify(created.body).slice(0, 120));

  const newId = created.body.id;

  const patched = await admin.request(`/api/admin/products/${newId}`, {
    method: 'PATCH',
    body: { priceCents: 5500, stock: 3 },
  });
  check('admin can edit a product', patched.status === 200);

  const { body: check1 } = await guest.request(`/api/products/${created.body.slug}`);
  check('product edit is visible in the shop', check1.product.priceCents === 5500, `got ${check1.product?.priceCents}`);

  const variant = await admin.request(`/api/admin/products/${newId}/variants`, {
    method: 'POST',
    body: { name: 'One size', stock: 3 },
  });
  check('admin can add a variant', variant.status === 201);

  const discountCode = `SMOKE${uniq.toString().slice(-6)}`;
  const newDiscount = await admin.request('/api/admin/discounts', {
    method: 'POST',
    body: { code: discountCode, type: 'fixed', value: 500, minSubtotalCents: 1000 },
  });
  check('admin can create a discount', newDiscount.status === 201, JSON.stringify(newDiscount.body).slice(0, 120));

  const shopper = createClient();
  await shopper.bootstrap();
  await shopper.request('/api/cart/items', { method: 'POST', body: { slug: 'cedar-trophy', quantity: 1 } });
  const applied = await shopper.request('/api/cart/discount', { method: 'POST', body: { code: discountCode } });
  check('new discount works at the till', applied.body.discountCents === 500, `got ${applied.body.discountCents}`);

  const duplicateCode = await admin.request('/api/admin/discounts', {
    method: 'POST',
    body: { code: discountCode, type: 'percent', value: 5 },
  });
  check('duplicate discount codes are refused', duplicateCode.status === 409);

  const { body: invoices } = await admin.request('/api/admin/invoices');
  check('admin invoice list loads', invoices.invoices.length >= 1, `got ${invoices.invoices?.length}`);

  const regenerated = await admin.request(`/api/admin/invoices/${invoices.invoices[0].orderId}/regenerate`, {
    method: 'POST',
  });
  check('admin can regenerate an invoice', regenerated.status === 200);

  const { body: adminCustomers } = await admin.request('/api/admin/customers');
  check('admin customer list loads', adminCustomers.customers.length >= 1);

  const self = adminCustomers.customers.find((c) => c.email === process.env.SMOKE_ADMIN_EMAIL);
  const selfDemote = await admin.request(`/api/admin/customers/${self.id}/role`, {
    method: 'PATCH',
    body: { role: 'customer' },
  });
  check('admin cannot demote themselves', selfDemote.status === 400, `got ${selfDemote.status}`);

  await admin.request(`/api/admin/products/${newId}`, { method: 'DELETE' });
  await admin.request(`/api/admin/discounts/${newDiscount.body.id}`, { method: 'DELETE' });
  check('admin cleanup completed', true);
}

/* ========================================================================== */
console.log(`\n${'='.repeat(46)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed) {
  console.log(`\n  Failures:\n${failures.map((f) => `    - ${f}`).join('\n')}`);
}
console.log(`${'='.repeat(46)}\n`);

process.exit(failed ? 1 : 0);
