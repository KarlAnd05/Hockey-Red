# Lebanon Hockey

Website, online store, and admin area for the Lebanese Ice Hockey Federation.

Express 5 serves the static pages and a JSON API from one port. The database is
SQLite via Node's built-in `node:sqlite`, so there is no native build step and no
database server to install.

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Then open <http://127.0.0.1:5174>.

The catalogue (11 products, 4 categories) and the `CEDAR10` discount code seed
themselves on first run.

---

## Creating the admin account

```bash
npm run create-admin -- --email you@example.com
```

The password is prompted for, never passed as an argument, so it stays out of
your shell history and the process list.

- If the email already exists as a customer, it is promoted to admin and keeps
  its current password.
- If it already exists as an admin, you are offered a password reset.
- `ADMIN_EMAIL` in `.env` is an alternative: whoever registers with that exact
  address through the normal signup form is created as an admin.

Sign in at `/login.html`, then open `/admin/`.

### How the admin area is protected

A user is an admin when `users.role = 'admin'`. Two independent gates enforce it:

| Layer | What it protects |
| --- | --- |
| `requireAdmin` on `/api/admin/*` | Every admin API endpoint |
| `requireAdmin` on the `/admin` route | The admin HTML itself |

Admin pages are served through an Express route rather than from the static
directory, so a non-admin cannot even download the shell — the server answers
404 (not 403) so the admin area is not discoverable. Demoting someone from admin
also deletes their sessions, and the last remaining admin cannot be demoted.

---

## Environment variables

Copy `.env.example` to `.env`. `.env` is gitignored; never commit real keys.

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | for checkout | Server-side Stripe key (`sk_test_…` / `sk_live_…`) |
| `STRIPE_PUBLISHABLE_KEY` | no | Exposed to the browser; not needed for hosted Checkout |
| `STRIPE_WEBHOOK_SECRET` | for checkout | Verifies webhook signatures (`whsec_…`) |
| `SESSION_SECRET` | in production | Session signing secret, 32+ random bytes |
| `APP_URL` | yes | Public base URL, used for Stripe success/cancel redirects |
| `ADMIN_EMAIL` | no | This address is promoted to admin when it registers |
| `CURRENCY` | no | Defaults to `cad` |
| `SHIPPING_FLAT_CENTS` | no | Flat shipping, default `1500` |
| `FREE_SHIPPING_THRESHOLD_CENTS` | no | Free over this amount, default `20000` |
| `TAX_RATE` | no | Fraction, e.g. `0.14975`. Default `0` |
| `PORT` | no | Default `5174` |
| `NODE_ENV` | no | Set to `production` when deploying |
| `TRUST_PROXY` | behind a proxy | Number of proxy hops to trust for client IPs |
| `ALLOW_DEV_CHECKOUT` | dev only | Enables the simulated-payment route used by the smoke test |
| `SMTP_HOST` | for email | SMTP server. Leave blank to print mail to the console instead |
| `SMTP_PORT` | no | Default `587` |
| `SMTP_USER` / `SMTP_PASS` | if your server needs auth | SMTP credentials |
| `SMTP_SECURE` | no | Implicit TLS. Defaults to true only on port 465 |
| `MAIL_FROM` | for email | From address, e.g. `Lebanon Hockey <info@lebanonhockey.com>` |
| `MAIL_ADMIN` | for email | Where new-order and contact notifications go. Falls back to `ADMIN_EMAIL` |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The site runs without Stripe keys — only checkout is disabled.

---

## Stripe setup

1. Create the keys in the Stripe dashboard and put the secret key in `.env`.
2. Forward webhooks while developing:

```bash
stripe listen --forward-to localhost:5174/api/stripe/webhook
```

3. Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` and restart.
4. Pay with test card `4242 4242 4242 4242`, any future expiry and CVC.

In production, register the webhook endpoint at `<APP_URL>/api/stripe/webhook`
for `checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
and `charge.refunded`.

Card details never reach this server — Stripe hosts the payment page.

---

## Running the store without Stripe

The site runs fine with no `STRIPE_SECRET_KEY`. The catalogue, cart, discount
codes, accounts and the whole admin area work normally; only taking a card is
switched off, and the store says so plainly:

- `GET /api/session` reports `paymentsEnabled: false`. This is derived from the
  **secret** key, never the publishable one — hosted Stripe Checkout does not need
  a publishable key, so an empty one tells you nothing about whether you can charge.
- The shop, cart and checkout pages show a notice explaining that card payments
  are not on yet, offering email ordering and the donation page instead. The
  checkout button is disabled before the form is filled in, rather than failing
  on submit.
- `POST /api/checkout` returns `503 {"code":"payments_disabled"}` and **creates no
  order**. (It used to create a pending order first and then refuse, which left an
  unsettleable row and a spent order number behind on every attempt.)

To turn payments on, add to `.env`:

```
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PUBLISHABLE_KEY=pk_test_…
CURRENCY=cad
```

Get the `whsec_…` from the Stripe CLI (note the port must match your `PORT`):

```bash
stripe listen --forward-to 127.0.0.1:5174/api/stripe/webhook
```

`ALLOW_DEV_CHECKOUT=true` is a **local-only** escape hatch. With it set, and
`NODE_ENV` not `production`, checkout still creates the pending order and
`POST /api/checkout/dev-complete/:orderId` settles it without Stripe — which is
how `npm run smoke` exercises the paid-order path, invoice and emails. Never set
it on a deployed site.

---

## Donations

`donation.html` takes one-time and monthly gifts through Stripe hosted Checkout, reusing
the same machinery as the shop. With no `STRIPE_SECRET_KEY` the form explains that card
donations are not available, disables submit, and **creates no database row**.

**The fee top-up.** When a donor opts to cover the transaction fee, the amount added is
`(amount + fixed) / (1 - percent) - amount` — the gross-up that makes the federation
actually receive the amount chosen. On a $20 gift at 2.9% + $0.30 that is **$0.91**, not
$0.58: charging 2.9% alone ignores the fixed fee *and* the fee on the top-up, leaving the
federation $0.32 short. The constants live in `config.js` (`STRIPE_FEE_PERCENT`,
`STRIPE_FEE_FIXED_CENTS`) and are served to the page by `GET /api/donate/config`, so the
figure shown to the donor and the figure charged cannot drift apart.

**Monthly giving** uses Stripe Subscriptions. Two things make it work:

- `subscription_data.metadata` is set as well as the session metadata, because Checkout
  metadata does **not** reach the recurring invoices — without it every renewal after the
  first arrives with no way to tell whose gift it is.
- `donation_payments.stripe_invoice_id` is `UNIQUE`. Stripe redelivers `invoice.paid`
  freely, and unlike a one-time gift there is no single status to pivot on, so that
  constraint is what turns a replay into a no-op instead of a double count. Do not drop it.

**Donors can cancel themselves.** A monthly donor has no account, so the thank-you email
carries a link to `/api/donate/manage/<token>`, which opens Stripe's billing portal for
that customer. Only the hash of the token is stored, and it is minted when the email is
rendered — the raw value exists in the donor's inbox and nowhere else.
**Enable the Customer Portal once in the Stripe dashboard or that link will fail.**

**Not a tax receipt.** The federation's charitable status is unconfirmed, so nothing in the
confirmation email or the page says "receipt", "deductible", or carries a registration
number. `server/lib/notifications.js` has a marked block where CRA wording and the
registration number go once that is settled. Until then, leave it as it is.

Webhook events used: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.deleted`. Register these alongside the order events.

## Editing page text

Sign in as an admin and open **Page text** in the admin area (`/admin/content.html`)
to rewrite any heading, paragraph or list item on the public site. Changes are live
as soon as they are saved.

How it works, and why it works this way:

- On every boot the server reads each public page and records what it says —
  currently **779 blocks across 23 pages**. Nothing needs marking up by hand.
- Edits are stored in the `content_blocks` table and swapped in when the page is
  served. They are **not** written back into the `.html` files, because 19 of the
  29 pages are generated by the build scripts and anything written into those
  files would be destroyed by the next `npm run build`.
- Each block keeps both the edit and the page's own wording, so **Reset** always
  has somewhere to go back to, and a reworded source shows up as a difference
  instead of silently replacing someone's text.
- Keys are `<page>#<tag><n>` (for example `index.html#h11`), counted per tag so
  adding a heading does not renumber the paragraphs after it.
- Restructure a page and some keys shift. Edited text whose block has disappeared
  is flagged **No longer on the page** rather than deleted. After a
  `npm run build` or a hand edit, press **Re-read pages** to bring the list back
  in step without restarting.
- Only block-level text is editable (`h1`–`h4`, `p`, `li`). A link or emphasis
  inside a paragraph is edited as part of that paragraph, so no two entries can
  fight over the same words. Stored text is stripped of `<script>`, inline event
  handlers and `javascript:` URLs — an admin writes copy, not code.
- The admin shell itself is deliberately not editable.

---

## Email

Set `SMTP_HOST`, `MAIL_FROM`, and `MAIL_ADMIN` to turn on delivery. **Leaving
`SMTP_HOST` blank is a supported mode**: every message is printed to the console
and written to the `email_log` table instead of being sent, so all the flows stay
testable without a mail account and nothing is silently dropped.

Any SMTP provider works. SendGrid, which this project used previously, needs:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your API key>
```

The site sends five transactional messages, and nothing else — there is no
marketing mail and no mailing list:

| Trigger | Goes to | Contents |
| --- | --- | --- |
| Order paid | The customer | Confirmation, line items, totals, address, **invoice PDF attached** |
| Order paid | `MAIL_ADMIN` | New-order alert, customer contact details, link to the admin |
| Password reset requested | The account holder | One-hour, single-use reset link |
| Contact form submitted | `MAIL_ADMIN` | The message, with the sender set as reply-to |

The two order emails are sent from `markOrderPaid()`, which returns early unless
the order is still `pending`. That makes the pair fire **exactly once** even
though both the Stripe webhook and the confirmation-page poll can reach it.
Sending never throws: a mail outage cannot roll back a payment.

Every message carries the federation's name, postal address, and a contact
address, which is what CASL requires of commercial electronic messages.

---

## Privacy and cookies

The site sets **one cookie**, `lh_sid`, and only once a visitor actually uses the
cart, signs in, or submits a form. Reading pages sets nothing:
`GET /api/session` is read-only, and the cookie is issued by `GET /api/csrf`,
which the client calls lazily before its first write.

There is no analytics, no advertising, and **no third-party requests at all** —
Archivo and Manrope are self-hosted in `assets/fonts/`, so no visitor IP is
disclosed to Google. The Content-Security-Policy allows no external origin
except `checkout.stripe.com` as a form-action redirect target.

That combination is why the site carries no cookie banner: a strictly necessary
session cookie is exempt from prior consent. Add analytics and that changes —
you would need a consent mechanism, and `cookies.html` would need updating.

Published policies: [`privacy.html`](privacy.html), [`cookies.html`](cookies.html),
[`refund-policy.html`](refund-policy.html), linked from every page footer. They are
written to Quebec Law 25 and PIPEDA. **Have a lawyer review them before launch.**

---

## Accessibility

```bash
npm run contrast
```

Audits every foreground/background pair against WCAG 2.1, reading the live
tokens out of `assets/styles.css` so it cannot drift from the design system. All
37 pairs currently pass AA, including the 3:1 requirement of WCAG 1.4.11 for the
borders that identify form controls.

Also in place: a skip link, `focus-visible` rings throughout, labelled form
fields, `aria-live` status messages, and a full `prefers-reduced-motion`
fallback that turns the animated photo rail into a plain scroller.

---

## Testing

```bash
npm run dev                                   # terminal 1
npm run smoke                                 # terminal 2
```

104 assertions across cookies, the catalogue, cart, discounts, checkout,
invoices, order emails, password reset, accounts, admin gating, and
price-tampering resistance.

The register endpoint is rate limited per IP, so restart the dev server before
re-running the suite; it tells you if the limiter is what stopped it.

To include the admin CRUD checks, supply an admin login:

```bash
SMOKE_ADMIN_EMAIL=you@example.com SMOKE_ADMIN_PASSWORD='...' npm run smoke
```

`ALLOW_DEV_CHECKOUT=true` lets the suite settle an order without the Stripe CLI.
That route returns 404 whenever `NODE_ENV=production`.

---

## Layout

```
server/
  app.js            wiring, security headers, static allow-list
  db.js             schema, migrations, catalogue seed
  config.js         environment
  middleware/       session, requireAuth, requireAdmin, CSRF, rate limit
  routes/           auth catalog cart checkout webhook orders admin
  lib/              password (scrypt) · cart · orders · invoice (PDF) · money · stripe
                    mail (nodemailer) · notifications (the message templates)
assets/             styles.css store.css admin.css · api.js app.js store.js account.js admin.js
  fonts/            self-hosted Archivo + Manrope (woff2, variable)
admin/              six admin pages (served only through the gated route)
scripts/
  create-admin.mjs      create or promote an admin
  smoke-test.mjs        end-to-end checks
  check-contrast.mjs    WCAG contrast audit of the live tokens
  build-store-pages.mjs regenerate the storefront pages from the shared shell
  build-admin-pages.mjs regenerate the admin pages
  update-pages.mjs      one-off migration for the original static pages
data/store.db       SQLite database (gitignored)
invoices/           generated invoice PDFs (gitignored)
```

`scripts/build-*.mjs` generate HTML from a shared shell. Edit the generator and
re-run it rather than hand-editing the generated pages, so every page keeps the
same header, footer, and scripts.

Delete `data/store.db` to reset the catalogue and start over.

---

## Security notes

- **Prices are always recomputed server-side** from the products table at
  checkout. The client never supplies a price, so a tampered request cannot
  change what is charged.
- Passwords use `scrypt` with a per-user salt and a constant-time comparison.
- Sessions are random 32-byte tokens stored **hashed** in the database,
  `HttpOnly` + `SameSite=Lax` (+ `Secure` in production), rotated on login to
  prevent session fixation, and revocable server-side.
- CSRF uses a double-submit token on every state-changing request except the
  Stripe webhook, which is verified by signature over the raw body instead.
- Login, registration, and the contact form are rate limited per IP.
- Static serving is an allow-list of root-level `.html` files plus `/assets`, so
  `.env`, `server/`, `data/`, and `invoices/` are not web-reachable.

### Product images

Products ship with a generated branded SVG placeholder
(`/api/placeholder/<slug>.svg`). To use real photography, upload the files to
`assets/` and set each product's **Image URL** in the admin to `/assets/<file>`.
