# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: sponsors and institutional partners.** Companies, community businesses, and sporting bodies deciding whether to put their name behind the federation. They arrive to judge whether the LIHF is a credible, officially recognized organization, to see who already backs it, and to understand the partnership tiers before starting a conversation. When audience needs conflict, their success outranks the others. (Confirmed during init, over players/families and supporters.)

Also served, and evidenced throughout the codebase:

- **Players and their families** — the men's program, women's program, youth camp, and membership pages, used to find a program, understand it, and join.
- **Supporters and the Lebanese diaspora** — following news and events, buying merchandise, and donating.
- **Federation staff** — the authenticated admin area covering orders, catalogue, discounts, and members.

## Product Purpose

Lebanon Hockey is the official web presence of the Lebanese Ice Hockey Federation (LIHF): one place for the federation's programs, camps, events, membership, partners, and community updates, together with an online store and donation flow that help fund them.

Success is a visitor who leaves understanding that Lebanese ice hockey is a recognized, organized federation rather than an informal club — and, for a prospective partner, one who opens a sponsorship conversation.

## Positioning

The federation's claim is **official international standing**, which a neighbouring club or private hockey organization cannot truthfully copy: recognized by Lebanon's Ministry of Sports (decree 2018, renewed 2022), an IIHF Associate Member since 2019, and a member of the Lebanese Olympic Committee since 2020.

The LIHF is the body that gives Lebanon a seat at the international ice hockey table — not only a team or a program operator. (Confirmed during init over two alternative framings: the diaspora-to-Lebanon bridge, and the local Montreal hockey community.)

## Operating Context

The federation is recognized in Lebanon and publishes a Canadian postal address: 1418 Victoria Avenue, Suite 110, Greenfield Park, Quebec J4V 1M1, Canada. Public contact is info@lebanonhockey.com.

Programs, camps, events, and partnerships run across Canada and Lebanon. The Montreal Challengers Series is the current flagship event carried on the homepage. Store pricing defaults to CAD, which matches the Canadian operating base.

Partnerships are handled as relationships, not self-serve transactions: the sponsors page ends in a "Ready to partner?" contact prompt, so the site's job is to qualify and open the conversation, not to close it.

## Capabilities and Constraints

- **Public site:** home, about, news, men's and women's programs, membership, youth camp, events, sponsors, shop, product detail, donation, plus privacy, cookies, and refund/returns policies.
- **Accounts:** register, sign in, password reset, and an account page. Sessions use one `lh_sid` cookie, issued lazily on first write.
- **Store:** a catalogue that seeds itself on first run (11 products, 4 categories), cart, checkout, order confirmation, the `CEDAR10` discount code, and PDF invoices generated with pdfkit.
- **Payments:** Stripe hosted Checkout — card details never reach the federation's server. *Not confirmed binding during init:* moving off hosted Checkout would be a product decision, not a rule violation.
- **Email:** exactly five transactional messages (order confirmation with invoice attached, new-order alert to admin, password reset, contact form). No marketing mail and no mailing list. Every message carries the federation's name, postal address, and a contact address, which is what CASL requires. With `SMTP_HOST` blank, mail is logged rather than sent — a supported mode, nothing is silently dropped.
- **Admin:** gated on `users.role = 'admin'` at both the `/api/admin/*` and `/admin` layers. Admin HTML is served through an Express route, so a non-admin gets 404 rather than 403 and the area is not discoverable. Demotion deletes that user's sessions, and the last remaining admin cannot be demoted.
- **Runtime:** Express 5 on Node >= 22.5 serving the static pages and a JSON API from a single port; SQLite through Node's built-in `node:sqlite` (`data/store.db`), so there is no native build step and no database server.
- **Money defaults:** currency CAD, flat shipping 1500 cents, free shipping over 20000 cents, tax rate configurable and 0 by default.
- The site runs without Stripe keys; only checkout is disabled.
- **Lineage:** migrated off Wix. `.wix/debug.log` and Wix-derived filenames in `assets/` are residue of that history, not an active dependency.

## Brand Commitments

Binding, confirmed during init:

- **Zero third-party requests.** No analytics, no advertising, and no external origins. Archivo and Manrope are self-hosted in `assets/fonts/`, so no visitor IP is disclosed to a font CDN, and the Content-Security-Policy allows no external origin except `checkout.stripe.com` as a form-action redirect target. One strictly necessary session cookie (`lh_sid`) is set only once a visitor uses the cart, signs in, or submits a form; reading pages sets nothing. This is precisely why the site carries no cookie banner. Adding any tracker, embed, or hosted asset reintroduces a consent requirement and would mean updating `cookies.html` — it is a decision to raise, never a quiet addition.
- **Fixed identity assets.** The cedar mark (the inline `#cedar-mark` SVG), the LIHF logo (`assets/LIHF-01_edited.png`), the flag strip, and the self-hosted Archivo + Manrope pairing are the federation's identity. Later visual work may not substitute them.

Naming and voice: **Lebanese Ice Hockey Federation** formally, **Lebanon Hockey** as the site and brand name. The current tagline is "Building a fast, proud hockey community through programs, camps, events, and partnerships across Canada and Lebanon."

## Evidence on Hand

Real and checkable — safe for future work to use:

- **Milestones:** founded May 2018; Ministry of Sports decree 2018, renewed 2022; IIHF Associate Member since 2019; Lebanese Olympic Committee member since 2020.
- **Named leadership** (`about.html`): Charles El-Mir, President; Mohamad Teliani, Vice President, Hockey Operations; Paul Doumet, General Secretary; Joanne Diwan, Director, Women's Development; Nancy Constantin, Director, Accounting; Maurizio Sottile, Director, Technical & Ice Rink Project; Lara Karam, Director, Public Relations.
- **Current partners by tier** (`sponsors.html`): Platinum — PILLAR5; Gold — Egothera, Bawer, Canelle; Silver — Adonis, SLC; Bronze — Mr. Mike's.
- **Stated ambition:** a permanent home for the sport in Lebanon; a board seat is dedicated to the technical and ice rink project.
- **Imagery:** action and team photography in `assets/`, plus the youth-camp artwork.

Absences that must not be fabricated: there are no testimonials, no attendance or audience figures, no sponsorship pricing, no media-coverage list, and no published registration numbers anywhere in this project.

Explicitly undecided: the tiers exist by name and by what they fund, but **what a partner actually receives in return is documented nowhere**. Since sponsors are the primary audience, this is the most consequential open product fact — it must be answered by the federation, not invented by a design pass.

## Product Principles

1. **Credibility before charm.** The primary visitor is deciding whether to attach their organization's name to the federation. Official recognition, named leadership, and real partners carry more weight than atmosphere.
2. **Never fabricate proof.** Milestones, partners, and leadership are real and verifiable. Anything not in Evidence on Hand does not get written onto a page.
3. **Privacy is a feature the site advertises.** Zero third-party requests is published in the federation's own policies. Work that would need a tracker or hosted asset is raised as a decision, never absorbed quietly.
4. **One federation, many audiences.** Sponsors come first when needs conflict, but players, families, and supporters keep working paths through the same site; nothing is degraded to make room for a partner pitch.
5. **The store funds the mission.** Commerce, donations, and membership are infrastructure supporting programs — not the point of the site.

## Accessibility & Inclusion

No accessibility standard was confirmed as binding during init, so the required level is an **open decision**.

What exists today, factually: the project ships `scripts/check-contrast.mjs` (`npm run contrast`), a WCAG 2.1 contrast audit that reads the live colour tokens out of `assets/styles.css` — so it cannot drift from the design system — and enforces 4.5:1 for normal text and 3:1 for large text and non-text UI boundaries. The pages carry a skip link, ARIA landmarks, labelled controls, and `aria-hidden` on decorative artwork.

Future work should assume this tooling is in use and keep it passing until the federation decides otherwise.
