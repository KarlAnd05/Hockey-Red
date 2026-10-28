# What the site still needs from the federation

Everything in the requirements document is built and tested. This is the list of
**real-world information** the code cannot invent for itself.

It is ordered by consequence, not by effort. Section 1 is the difference between
a site that works and one that is quietly broken; section 4 is polish.

Audited against the live database on 29 October 2026.

---

## 1. Without these the site does not work correctly

### 1.1 `SESSION_SECRET` — **sessions break on every restart**

Not set. When it is missing the server generates a random one at boot, so every
signed-in customer and admin is logged out the moment the site restarts. Fine on
a laptop, wrong in production.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the result in `.env` as `SESSION_SECRET=…`. Generate it once and keep it.

### 1.2 `APP_URL` — currently points at a laptop

It is `http://127.0.0.1:5175`. This value is used to build Stripe's return
links, the cancellation link in every monthly-donation email, and the preview
URL in every shared link. **Left as-is in production, those all point at a
machine nobody else can reach.**

Needs the real address, e.g. `https://lebanonhockey.com`.

### 1.3 Email — **nothing is being delivered right now**

`SMTP_HOST` is not set, so every message is printed to the server console
instead of sent. That currently silently swallows:

- order confirmations and invoices
- e-Transfer payment instructions (the buyer never learns where to send money)
- password resets
- donation receipts and the **cancellation link for monthly gifts**
- contact-form and new-order notifications to the federation

Needed: SMTP host, port, username, password, and the address notifications
should go to (`MAIL_ADMIN`). Any provider works — SendGrid, Mailgun and
Postmark are all a single host/port/key.

### 1.4 A way to take money — **pick at least one**

| Option | What it needs | Notes |
|---|---|---|
| **Interac e-Transfer** | One email address + recipient name | **Fastest.** No account, no application. Orders work the same day. |
| **Stripe** | Secret key, webhook secret | Takes cards. Needs an approved Stripe account. |

Both can run together — the checkout then offers a choice.

Right now neither is configured, so the store takes no orders at all.

### 1.5 Real shipping rates — **the current ones are invented**

The six zones carry placeholder prices I made up so the feature could be built
and tested. **Every one of them is wrong**, and they decide what customers are
charged.

| Zone | Placeholder now | Needs |
|---|---|---|
| Canada | $15.00 + $0.00/item, free over $200, 7–14 days | real |
| United States | $25.00 + $2.00/item, never free, 10–18 days | real |
| Europe | $40.00 + $3.00/item, never free, 14–28 days | real |
| Middle East | $45.00 + $3.00/item, never free, 14–28 days | real |
| Australia / NZ | $50.00 + $4.00/item, never free, 14–28 days | real |
| Rest of the world | $55.00 + $4.00/item, never free, 14–35 days | real |

For each: **base fee**, **per-item fee**, **free-shipping threshold** (or
"never"), and **delivery estimate in days**. Editable in Admin → Shipping.

### 1.6 The sizing guide

Does not exist. The refund policy is now **all sales final**, so a customer who
orders the wrong size cannot return it. Without published measurements that is
a dispute waiting to happen.

Send the garment measurements in any form — a PDF, a photo of a chart, or just
the numbers — and I will build it into the product pages.

---

## 2. Features that are built but have nothing in them

| What | State today | Needed |
|---|---|---|
| Men's roster | **0 players** | Names, positions, numbers |
| Youth roster | **0 players** | Names, positions, numbers |
| Panthers roster | **0 players** | Names, positions, numbers |
| Player photos | **0 of 49** | Portraits — JPEG/PNG/WebP, up to 4MB |
| Player descriptions | **0 of 49** | The short bio on each profile |
| Team photos | **0 of 4** | One per team |
| Sponsor logos | **0 of 7** | One per sponsor |
| Schedule | **1 entry** | Camps, tryouts, tournaments, sessions |
| Games played | **0** | See below — this is why no statistics show |

### Statistics are empty because no games are recorded

Player statistics are derived from game sheets. **No games exist yet, so every
profile shows no statistics at all** — which is correct behaviour, not a fault.

Two ways to fill them:

1. **Going forward** — enter each game in Admin → Game sheets, mark it *Final*,
   and the players' pages update themselves.
2. **History** — for results from before this site existed, each player has
   *Record before this site* fields (games / goals / assists + a note such as
   "2019–2024 national team"). Use these rather than back-filling old sheets.

---

## 3. Decisions only the federation can make

### 3.1 The navigation menu

**Outstanding and blocking.** A menu structure was specified in the original
requirements document, which was lost when an earlier conversation was
summarised. The current menu is:

```
Home · About · Our Teams · News · Membership · Events · Sponsors · Store
```

Send the intended menu and the navigation will be rebuilt to match, including
any pages that need creating.

### 3.2 Donation leaderboard ranking

Currently **largest gift first**. That publicly ranks donors by how much they
gave — motivating for some federations, uncomfortable for others.

Alternatives: most recent first, or alphabetical.

### 3.3 Game sheet fields

The current sheet records: player, number, position, role (captain / alternate /
starting goaltender / staff), dressed-or-scratched, goals, assists, penalty
minutes, and for goaltenders shots against / saves / result.

The requirements document said the full field list would come later. If a real
sheet needs referees, periods, period-by-period scoring or penalty detail, say
so and it can be added — the table was designed to take extra columns without
being reshaped.

### 3.4 Confirm these addresses exist

Both are published on the live site and used in emails:

- `info@lebanonhockey.com`
- `sales@lebanonhockey.com`

---

## 4. For going live

- **Hosting** — where the site will run.
- **Domain** — and the DNS pointed at it.
- **An admin account** for each person who needs one:
  ```bash
  npm run create-admin -- --email someone@lebanonhockey.com
  ```
  There is one admin account today.
- **`ADMIN_EMAIL`** in `.env` — that address is promoted to admin automatically
  when it registers.
- **The default branch on GitHub** is still `project-snapshot-20261013`. The
  current work is on `main`; switch the default in Settings → Branches so people
  land on it.

---

## The shortest path to a working shop

If only three things get done:

1. **`ETRANSFER_EMAIL`** — the store starts taking real orders. No Stripe
   account needed, no waiting.
2. **SMTP settings** — buyers actually receive the instructions telling them
   where to send the money. Without this, item 1 is useless.
3. **Real shipping rates** — customers are charged correctly.

That is a federation taking orders and getting paid. Everything else on this
list improves the site; those three make it function.
