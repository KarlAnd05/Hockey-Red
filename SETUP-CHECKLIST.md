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
| Team photos | **3 of 4** | Only the Lebanese Panthers is missing - the old site had no photograph of them anywhere |
| Sponsor logos | **7 of 7** - done | Carried over from the old site |
| Product photos | **11 of 11** - done | Carried over from the old site |
| News images | **3 of 3** - done | Carried over from the old site |
| Schedule | **1 entry** | Camps, tryouts, tournaments, sessions |
| Games played | **0** | See below — this is why no statistics show |

### Statistics are empty because no games are recorded

Player statistics are derived from game sheets. **No games exist yet, so every
profile shows no statistics at all** — which is correct behaviour, not a fault.

Two ways to fill them:

1. **Going forward** — record each game in Admin → Game sheets, or on the **Live entry**
   screen during the match, then mark it *Final* and the players’ pages update
   themselves. *Final* is what counts it towards a career total; publishing it
   is a separate switch that only controls the public match page.
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
                                                    └─ Make a Donation
```

Sponsors opens a flyout on hover holding Make a Donation; on a phone that
child is simply an indented row in the open menu. The header can carry more
flyouts the same way - a third element on a NAV entry in
`scripts/build-store-pages.mjs` is all one takes - which is the room there is
for growth, because the row itself is full at eight items.

Send the intended menu and the navigation will be rebuilt to match, including
any pages that need creating.

### 3.2 How is this name spelled?

The old site spells one board member's name two ways: **Wissam Salaman** in the
board list, and **Wissam Salman** in the Disciplinary & Dispute Committee list.

The About page now uses *Salaman* in both places, because printing two
spellings of what is probably one name on one page reads as a mistake. Two
things to confirm:

- which spelling is right, and
- whether this is one person holding both roles, or two different people.

If it is two people, the committee entry needs correcting on About.

### 3.3 Donation leaderboard ranking

Currently **largest gift first**. That publicly ranks donors by how much they
gave — motivating for some federations, uncomfortable for others.

Alternatives: most recent first, or alphabetical.

### 3.4 Game sheets: what is built, and the three things still missing

The IIHF Official Game Sheet has been built. A sheet now records the match
header (event, venue, date, start, spectators, game number, jersey colours),
both squads, every goal (time, scorer, two assists, game situation), every
penalty (time, player, minutes, offence code, start and end), and a goaltender
record per period. The period summary — goals, shots on goal, penalty minutes,
powerplay and shorthanded goals — is worked out from those entries rather than
typed, so it can never disagree with them.

There is a **Live entry** screen in the admin for recording a match as it
happens, from a phone or a tablet at the rink. A goal takes three taps plus the
time from the clock on the wall.

Three things are needed from the federation:

1. **The ten official role labels.** Staff and officials are entered as
   `Role - Name` lines. The IIHF form names two referees, two linesmen, two
   goal judges, a video goal judge, a scorekeeper, a timekeeper and a game
   supervisor. Confirm the federation uses those titles, or supply its own.

2. **Jersey numbers for the Panthers** — see 3.10, which this now makes urgent
   rather than cosmetic.

3. **Whether the public game sheets section should be switched on.** It is
   **off by default**: the pages exist, but nothing links to them and the
   addresses return "not found". Turning it on adds a *Game Sheets* entry under
   *Our Teams* in the menu. The switch is the **Section on / Section off**
   button in Admin → Game sheets, and it takes effect immediately.

Separately, each match has its own **publish** switch. A match stays private
until it is published, even with the section on — so a record can be finalised,
checked, and only then shown. Publishing a match does not change anybody's
statistics, and marking it *Final* does not reveal the page; the two are
deliberately independent.

Not built: the on-ice participation columns (which six players were on the ice
for each goal) and the game-winning-shots grid. Together they are most of the
typing during a match and are not read on a club site. Say so if a referee
needs them.

### 3.5 Publish the sponsorship prices, or not?

`sponsors.html` now carries the real figures from the federation's rate card:
$3,500-$15,000 for uniform visibility, $250-$10,000 for events, $500-$6,000 for
media. Those came from a deck written to be sent to a prospect, not published.

A public rate card is easy to point at and hard to negotiate away from. It is
confined to one commented block in `sponsors.html`, so it can be removed
without touching anything else. **Confirm you want it public.**

### 3.6 Which Challenger Series deck is current?

Two versions were supplied and they do not agree:

| | English deck | French deck (Adonis) |
|---|---|---|
| Countries | 6 | 7 |
| Games | 16 | 21 |
| Federations | 5 | 7 |
| Combined Instagram | 35K | 40K |

Only the figures both agree on are on the site - 3rd edition, 11 teams, 2
championship finals, 8,500 expected spectators. Say which deck is current and
the rest can go up.

Neither deck gives a **year** for "8-12 July". The events page shows the dates
without one rather than guessing. That needs a year before it means anything.

### 3.7 Are the Lebanese Panthers the clubs programme?

The About Us document names four programmes: men's, women's, youth, and "the
Lebanese hockey clubs". The site's four teams are men's, women's, youth and
Lebanese Panthers, so the Panthers row was given the clubs text - competitive
training, preparing players for international tournaments.

That is an inference from the fact that both lists have four entries. Confirm
it, or say what the Panthers actually are.

### 3.8 These statistics are from 2024

The rate card quotes figures the site does not use, because they are dated:

- "+5 local events planned for **2024**"
- "+3 international competitions scheduled for **2024**" (the French version of
  the same page says 2023)
- "+2.8k Facebook followers"

Current numbers for these, and the site can carry them. The three that are on
the sponsors page now - 300+ registered players, 500 average attendance, 2,500
record attendance - carry no date, so they were safe to use. Confirm they are
still right.

### 3.9 Cedar or Platinum?

The federation's rate card calls its top tier **Cedar**. The database calls it
**platinum**, enforced by a CHECK constraint, and that is what labels current
partners.

The sponsors page now shows both words - "Cedar" in the plans, "Platinum" on a
partner filed under that tier. Renaming the database tier touches the
constraint, the admin dropdown and existing rows, so it was not done in
passing. Worth picking one.

### 3.10 The Panthers roster says "Forward" nine times

The federation supplied nine names for the Lebanese Panthers and nothing else.
The `players` table **requires** a position - its CHECK constraint allows only
`forward`, `defence`, `goaltender` or `staff`, with no value meaning "not
stated" - so all nine were written as forwards, which is also what the admin
defaults to when nobody picks one.

That is a guess, and it is on a public page against nine real people's names.
Jersey numbers were left empty and show as a dash, which is honest; position
has no such option.

**This now blocks live match entry.** The live screen shows one tile per
player with their number on it. With no numbers the tiles fall back to
surnames, which works but is slower to hit correctly between whistles — and a
published match page shows a dash in the number column for every Panther.

**Fix it in Admin -> Teams -> Lebanese Panthers**, where each player's position
and number can be set in a few seconds. The photographs show numbers 5, 6, 7,
8, 9, 10, 31 and 55 on the ice, so the numbers exist - they just cannot be
matched to names from a group shot.

Worth deciding separately: whether the roster should also say **Next
Generation** or carry no squad label. It currently has none, which renders as a
single unlabelled group.

### 3.11 Are these children's names and faces cleared for publication?

The Panthers photographs and roster are of minors. Nine full names now sit on a
public page beside eight photographs of an identifiable youth squad, and the
federation supplied both - so this is presumably intended. It is still worth
confirming that the parents have given consent for **names plus faces**
together, because that combination is what makes a child identifiable to a
stranger rather than to a team-mate.

This now reaches further than the roster. Once a match is published a child's
name appears on the match page beside the goals, assists and **penalties**
recorded against them, and their own profile carries the running totals. A
penalty record in particular is a statement about a named child that would sit
on a public page indefinitely. Confirm that is intended before the first match
is published.

If any family would rather not appear, two things can be done without touching
anything else:

- untick **Active** on that player in Admin -> Teams, which removes them from
  the roster and the table;
- drop a photograph by removing its line from `TEAM_GALLERIES` in
  `server/lib/photos.js`, or clear the team's gallery field in the admin.

### 3.12 Where do the 2026 photographs belong?

Six of the supplied files show a senior player in the red cedar jersey at an
indoor arena, plus a dressing room at what the jerseys call the **United Hockey
Camp 2026**. They are not the Panthers, so they are not on that page. Which
squad and which event? They would suit the men's programme page or a news post.

There is also a photograph of a printed *L'Orient-Le Jour* page from 17
December 2018 - "Les beaux balbutiements du hockey sur glace libanais" by
Thomas Guichard, about the Panthers as Lebanon's first team. A scan of someone
else's newspaper is their copyright, so it was not published. **Citing** it on
About or News is fine, and worth doing - it is good third-party coverage.

### 3.13 Confirm these addresses exist

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
