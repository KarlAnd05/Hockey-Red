/**
 * Whole-site check: every page, every reference, every origin.
 *
 *   node check-site.mjs [base]
 *
 * Three things at once:
 *   1. every public page returns 200
 *   2. every href/src/srcset/url() it names resolves (no 404s, no typos)
 *   3. nothing points off-origin -- PRODUCT.md makes zero third-party requests
 *      a binding commitment, because adding one reintroduces a cookie-consent
 *      requirement that the site is currently, deliberately, exempt from
 *   4. admin pages stay shut to a guest
 */
const base = (process.argv[2] || 'http://127.0.0.1:5174').replace(/\/$/, '');

const PAGES = [
  '/', 'about.html', 'account.html', 'cart.html', 'checkout.html', 'cookies.html',
  'donation.html', 'events.html', 'forgot-password.html', 'index.html', 'login.html',
  'membership.html', 'mens-program.html', 'news.html', 'order-confirmation.html',
  'privacy.html', 'product.html', 'refund-policy.html', 'register.html',
  'reset-password.html', 'shop.html', 'sponsors.html', 'womens-program.html',
  'youth-camp.html',
];

const ADMIN = [
  '/admin/', '/admin/index.html', '/admin/products.html', '/admin/orders.html',
  '/admin/customers.html', '/admin/invoices.html', '/admin/discounts.html',
];

const badPages = [];
const badRefs = new Map();   // ref -> [status, pages...]
const external = new Map();  // origin -> [pages...]
const checked = new Map();   // url -> status
let refCount = 0;

const note = (map, key, page) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(page);
};

async function status(url, method = 'HEAD') {
  if (checked.has(url)) return checked.get(url);
  let code;
  try {
    let r = await fetch(url, { method, redirect: 'manual' });
    // Some static handlers refuse HEAD; confirm with a ranged GET.
    if (r.status === 404 || r.status === 405) {
      r = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'manual' });
    }
    code = r.status;
  } catch (e) {
    code = `ERR ${e.cause?.code || e.message}`;
  }
  checked.set(url, code);
  return code;
}

/* Pull every reference a browser would actually fetch. */
function refsFrom(html) {
  const out = new Set();
  const add = (v) => {
    if (!v) return;
    const s = v.trim();
    if (!s) return;
    if (/^(data:|mailto:|tel:|javascript:|#)/i.test(s)) return;
    out.add(s.split('#')[0]);
  };

  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/gi)) add(m[1]);
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*'([^']*)'/gi)) add(m[1]);
  for (const m of html.matchAll(/\bsrcset\s*=\s*"([^"]*)"/gi))
    for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) add(m[1]);

  return [...out];
}

console.log(`\nWhole-site check -> ${base}\n`);

/* Posts have a page each at /news/<slug>. Discovering them from the API rather
   than listing them here means a new post is crawled automatically, and a post
   whose photo or link breaks fails this check instead of failing in public. */
try {
  const res = await fetch(new URL('api/news', base + '/').href);
  if (res.ok) {
    const { posts = [] } = await res.json();
    for (const post of posts) PAGES.push(`news/${post.slug}`);
    if (posts.length) console.log(`  (+${posts.length} news posts discovered)\n`);
  }
} catch {
  /* the server may not expose news yet; the rest of the check still stands */
}

for (const page of PAGES) {
  const url = new URL(page, base + '/').href;
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    badPages.push([page, `ERR ${e.cause?.code || e.message}`]);
    continue;
  }
  if (res.status !== 200) {
    badPages.push([page, res.status]);
    continue;
  }

  const html = await res.text();

  for (const ref of refsFrom(html)) {
    refCount += 1;
    let abs;
    try {
      abs = new URL(ref, url);
    } catch {
      note(badRefs, `${ref} (unparseable)`, page);
      continue;
    }

    if (abs.origin !== new URL(base).origin) {
      note(external, abs.origin, page);
      continue; // do not reach off-origin just to check it
    }

    /* The admin link ships `hidden` on every page and is only revealed for a
       signed-in admin. For a guest it is SUPPOSED to 404 -- the server refuses
       to admit the admin surface exists at all. That is asserted below as a
       gate in its own right, not counted as a broken link here. */
    if (abs.pathname.startsWith('/admin')) continue;

    const code = await status(abs.href);
    if (code !== 200 && code !== 206 && code !== 304) {
      note(badRefs, `${abs.pathname} -> ${code}`, page);
    }
  }
}

/* Admin must stay shut to a guest. The project returns 404 rather than 401 so
   the admin surface is not even advertised to someone who is not signed in. */
const adminOpen = [];
const adminCodes = [];
for (const path of ADMIN) {
  const code = await status(new URL(path, base + '/').href, 'GET');
  adminCodes.push([path, code]);
  if (code === 200) adminOpen.push(path);
}

/* --- Report --------------------------------------------------------------- */
const line = '='.repeat(66);
console.log(`  pages checked      ${PAGES.length}`);
console.log(`  references checked ${refCount} (${checked.size} unique)`);
console.log(`  admin paths probed ${ADMIN.length}\n`);
console.log(`  guest sees          ${[...new Set(adminCodes.map(([, c]) => c))].join(', ')} on every admin path`);

let failed = false;

if (badPages.length) {
  failed = true;
  console.log('  PAGES THAT DID NOT RETURN 200');
  for (const [p, c] of badPages) console.log(`    ${String(c).padEnd(10)} ${p}`);
  console.log();
}

if (badRefs.size) {
  failed = true;
  console.log('  BROKEN REFERENCES');
  for (const [ref, pages] of badRefs) {
    console.log(`    ${ref}`);
    console.log(`      on: ${[...pages].join(', ')}`);
  }
  console.log();
}

if (external.size) {
  failed = true;
  console.log('  OFF-ORIGIN REFERENCES (PRODUCT.md: zero third-party requests)');
  for (const [origin, pages] of external) {
    console.log(`    ${origin}`);
    console.log(`      on: ${[...pages].join(', ')}`);
  }
  console.log();
}

if (adminOpen.length) {
  failed = true;
  console.log('  ADMIN REACHABLE WITHOUT SIGNING IN');
  for (const p of adminOpen) console.log(`    ${p}`);
  console.log();
}

console.log(line);
console.log(
  failed
    ? '  CHECK FAILED - see above'
    : `  clean: ${PAGES.length} pages, ${refCount} references, no off-origin, admin shut`
);
console.log(`${line}\n`);

process.exit(failed ? 1 : 0);
