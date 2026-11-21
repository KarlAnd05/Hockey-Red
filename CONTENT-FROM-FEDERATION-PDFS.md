# Content from the federation's own documents

Source: six PDFs supplied by the federation, read 12 November 2026.
Purpose: a record of what each document says, what went onto the site, what did
not, and what the federation still needs to settle. Companion to
[CONTENT-FROM-LIVE-SITE.md](CONTENT-FROM-LIVE-SITE.md), which covers the old Wix
site.

| Document | What it is |
|---|---|
| `About us ENG.pdf` (14 pp) | The federation's own profile: mandate, mission, the four programmes, the Arab Cup, the documentary, the arena project |
| `LIHF - À Propos de nous - FR.pdf` (14 pp) | The same document in French. Checked against the English; no facts unique to it |
| `Visibility Plans EN.pdf` (12 pp) | The sponsorship rate card: uniform, event and media visibility, four tiers each |
| `Proposition.pdf` (12 pp) | The same rate card in French |
| `Challenger_Series_Partnership_EN.pdf` (10 pp) | Partnership proposal for the 3rd Challenger Series |
| `Adonis Challenger Series.pdf` (9 pp) | A later French revision of the same proposal, addressed to Groupe Adonis. **Its figures differ — see below** |

---

## ⚠️ Three things to decide

1. **The sponsorship prices are now public.** `sponsors.html` lists the real
   figures from the rate card ($3,500–$15,000 uniform, $250–$10,000 event,
   $500–$6,000 media). That deck was written to be sent to a prospect, not
   published, and a public rate card is harder to negotiate away from. It is
   confined to one block in `sponsors.html` marked with a comment, so it can be
   lifted out without disturbing the rest of the page. **Confirm you want it
   public.**
2. **The two Challenger Series decks disagree.** The English version says 6
   countries and 16 games; the later French one for Adonis says 7 countries and
   21 games. They also differ on federations (5 vs 7) and combined Instagram
   following (35K vs 40K). Only the figures both agree on went onto the site —
   3rd edition, 11 teams, 2 championship finals, 8,500 expected spectators.
   **Which deck is current?**
3. **"Lebanese Panthers" is being treated as the club programme.** The About Us
   document names four programmes: men's, women's, youth, and "the Lebanese
   hockey clubs". The site's four teams are men's, women's, youth and Lebanese
   Panthers, so the Panthers row was given the clubs text. That mapping is an
   inference. **Confirm the Panthers are the clubs programme**, or say what the
   fourth team actually is.

---

## What went onto the site

### `about.html`

- **The mandate, restated.** The intro now says what the document says: a
  non-profit, mandated by the Ministry of Sports and the Lebanese Olympic
  Committee, and recognised by the IIHF as its official representative in
  Lebanon. It also notes the federation runs from Montreal.
- **New section — "Hockey as a bridge between communities."** The integration
  argument from page 3, in three cards: hockey as a route into Canadian life,
  the arena as a place communities meet, and integration as a two-way process.
  This was the largest thing missing from the site: it is the federation's own
  reason for existing and it appeared nowhere.
- **New section — "More than a team sheet."** Three cards: the cedar's colours
  (home, away and limited edition), the Radio-Canada documentary directed by
  Frédéric Nassif, and the Montreal base.
- **The arena is 5,000 seats.** Added to the existing "Long term" objective,
  which already mentioned the venue but not its size.

Both new sections were inserted as a **pair** — tinted then plain — so the
alternating backgrounds down the page stay correct. Inserting a single section
would have inverted every section below it.

### `sponsors.html`

- **Reach figures** under the recognition grid: 300+ registered players, 500
  average attendance, 2,500 record attendance.
- **New section — "Three ways to be seen."** The three visibility families
  (uniform, event, media), each with its tier breakdown and price range.
- **New section — "Shaping it around you."** The multi-plan discount (10% for
  two plans at the same tier, 20% for three), in-kind contributions, and custom
  plans.

### `events.html`

- **The Challenger Series card** now says what the event is, where and when,
  and links to a new section instead of the contact form.
- **New section — "A tournament for hockey's newer nations."** The two-leg
  format (Chicago during the Fiesta del Hockey, then Montreal at the Sportplexe
  Pierrefonds, 8–12 July), the mission as the organisers state it, and the four
  agreed figures.

### `index.html`

- The programmes block said "Men's, women's, and youth development" and listed
  one link. It now says **"Four programmes, one cedar"** and links to all four
  team pages.

### The four programme descriptions (database)

The blurbs on **Our Teams** came from placeholder text written during the
rebuild. They now carry the federation's own descriptions, from pages 5–8.

These live in two places that must stay identical:

- `server/lib/teams.js` → `SEED_TEAMS`, for a database that has never been
  seeded;
- `server/lib/attach-copy.js`, which updates a database that already has rows.

`attachFederationCopy()` only rewrites a description that is still *character
for character* the old seeded text. A description someone edited in the admin is
left alone — verified against a scratch database, including the case where an
admin had rewritten one of the four.

---

## What was deliberately left off

- **Dated statistics.** The rate card quotes "+5 local events planned for 2024",
  "+3 international competitions scheduled for 2024" (the French version says
  2023 for the same line) and "+2.8k Facebook followers". All are at least two
  years old. Publishing them now would state something stale as current. See
  the checklist item below.
- **The year of the Challenger Series.** Both decks give "8–12 July" with no
  year anywhere. The site shows the dates without a year rather than guessing.
- **The disputed Challenger Series figures** — see decision 2 above.
- **Media logos.** The decks show NHL, CBC/Radio-Canada, La Presse, CTV and
  Global News marks alongside article headlines. The site states "more than
  twenty media articles", which the deck says in words, rather than reproducing
  other organisations' trademarks.

---

## One side effect worth knowing about

The admin content editor keys every heading, paragraph and list item as
`<page>#<tag><nth>` — the fourth `<p>` on about.html is `about.html#p4`.
Counting is per tag, so adding a heading does not renumber the paragraphs, but
**inserting a section does shift every element of the same tag below it**.

New sections went into the middle of `about.html` and `sponsors.html`, so any
copy the federation had already edited through the admin on those two pages,
below the insertion point, is now attached to different text.

Nothing is lost. `syncAllPages()` runs on every boot and the admin content
screen shows the stored edit next to the current default, so the drift is
visible rather than silent — that is what the `default_value` column is for.
**Worth a pass through Admin → Content for About and Sponsors** to check that
each edit still sits on the text it was written for.

`events.html` and `index.html` are unaffected in practice: the events section
went in near the end, and the homepage changes were text-only.

---

## A note on the tier names

The federation's rate card uses **Cedar, Gold, Silver, Bronze**. The database's
`sponsors.tier` column uses `platinum, gold, silver, bronze, partner`, enforced
by a CHECK constraint, and that is what labels the current partners.

So the page now shows two vocabularies: "Cedar" in the plans, "Platinum" on any
partner filed under that tier. The plans use the federation's own words because
that is what a prospect will have been sent. Renaming the database tier is a
schema change — the CHECK constraint, the admin dropdown and any existing rows —
and is not something to do in passing. Worth reconciling.
