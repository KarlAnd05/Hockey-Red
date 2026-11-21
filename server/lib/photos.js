/* ==========================================================================
   Where the old site's photographs belong
   --------------------------------------------------------------------------
   The federation's Wix site carried real photography for its partners, its
   squads, its news posts and every item in the shop. None of it came across
   when those pages were rebuilt, so each of those rows shipped either empty
   or pointing at a generated SVG placeholder.

   The files in assets/photos/ are the originals: Wix serves a resized,
   re-encoded copy in its markup, but dropping the /v1/<transform>/ segment
   from a media URL returns the master that was uploaded. SOURCES.md in that
   folder records the media id behind every file so any can be fetched again.

   This module is the single place the mapping lives. The seeds in db.js,
   lib/sponsors.js and lib/teams.js read it so a fresh database gets the
   photographs on its first boot, and lib/attach-photos.js reads it to fill in
   a database that was already seeded without them. Keeping one copy is what
   stops those two paths drifting apart.

   Data only - no imports, so db.js can read it without a cycle.
   ========================================================================== */

const DIR = '/assets/photos';

/* Sponsors are keyed by name: the sponsors table has no slug, and an admin can
   rename a row, which is why attach-photos only ever matches a name that is
   still exactly what seedSponsors() wrote. */
export const SPONSOR_LOGOS = {
  PILLAR5: { url: `${DIR}/sponsors/pillar5.png`, alt: 'PILLAR5 logo' },
  Egothera: { url: `${DIR}/sponsors/egothera.jpg`, alt: 'Egothera logo' },
  Bawer: { url: `${DIR}/sponsors/bawer.jpg`, alt: 'Bawer logo' },
  Canelle: { url: `${DIR}/sponsors/canelle.jpg`, alt: 'Canelle logo' },
  Adonis: { url: `${DIR}/sponsors/adonis.jpg`, alt: 'Adonis logo' },
  SLC: { url: `${DIR}/sponsors/slc.jpg`, alt: 'SLC logo' },
  "Mr. Mike's": { url: `${DIR}/sponsors/mr-mikes.jpg`, alt: "Mr. Mike's logo" },
};

/* Teams. The old site had several shots per squad; the one picked here is the
   full-squad photograph in each case, because this image is the team's
   portrait at the top of its profile rather than an action shot.

   `panthers` had no photograph anywhere on the old site. The federation has
   since supplied its own set, which is where that entry now comes from - not
   from Wix, so it has no media id in SOURCES.md. */
export const TEAM_PHOTOS = {
  mens: {
    url: `${DIR}/teams/mens-squad.jpg`,
    alt: "Lebanon's men's national team with the Lebanese flag after a medal finish",
  },
  womens: {
    url: `${DIR}/teams/womens-a.jpg`,
    alt: "Lebanon's women's national team posed with the Lebanese flag",
  },
  youth: {
    url: `${DIR}/teams/youth-camp.png`,
    alt: 'Hockey Quebec Youth Camp 2026 poster',
  },
  panthers: {
    url: `${DIR}/teams/panthers/squad.jpg`,
    alt: 'The Lebanese Panthers squad on the ice with their manager',
  },
};

/* More than one photograph per team.

   The teams table carries a single photo_url, which is the portrait at the top
   of the profile. Everything below it comes from here: one line per picture,
   `url - caption`, stored in teams.gallery and rendered by renderTeamPage.
   The caption is what the page shows AND the alt text, so it has to describe
   the picture rather than title it.

   Only the Panthers have a set so far. The other three fall back to their
   single portrait, which is what they had before. */
export const TEAM_GALLERIES = {
  panthers: [
    [`${DIR}/teams/panthers/squad-white.jpg`, 'The squad in their white kit, posed with the goaltender in front'],
    [`${DIR}/teams/panthers/line-up.jpg`, 'The team lined up along the boards, sticks on the ice'],
    [`${DIR}/teams/panthers/four-players.jpg`, 'Four Panthers including the goaltender, posed in black and gold'],
    [`${DIR}/teams/panthers/goaltender.jpg`, 'The goaltender crouched in front of two team-mates'],
    [`${DIR}/teams/panthers/team-talk.jpg`, 'The team gathered round a coaching board between drills'],
    [`${DIR}/teams/panthers/training.jpg`, 'A training session underway on the rink'],
    [`${DIR}/teams/panthers/drill.jpg`, 'A Panthers skater working through a puck drill'],
  ],
};

/** The gallery as teams.gallery stores it: one `url - caption` line each. */
export const galleryText = (slug) =>
  (TEAM_GALLERIES[slug] || []).map(([url, caption]) => `${url} - ${caption}`).join('\n');

/* News posts, keyed by slug. Each is the portrait that ran with the post. */
export const NEWS_IMAGES = {
  'ricardo-tabet-named-mens-gm': {
    url: `${DIR}/news/ricardo-tabet.jpg`,
    alt: "Ricardo Tabet, General Manager of the Men's National Team",
  },
  'jocelyn-trepanier-joins-womens-program': {
    url: `${DIR}/news/jocelyn-trepanier.jpg`,
    alt: "Jocelyn Trépanier, General Manager and Co-Head Coach of the Women's National Team",
  },
  'gregg-kennedy-named-mens-head-coach': {
    url: `${DIR}/news/gregg-kennedy.png`,
    alt: "Gregg Kennedy, Head Coach of the Men's National Team",
  },
};

/* Every product in the shop, keyed by slug. All eleven had photography on the
   old store, so after this there is no product left on /api/placeholder/. */
export const PRODUCT_IMAGES = {
  'official-team-lebanon-hockey-jersey': `${DIR}/products/jersey.png`,
  'official-team-lebanon-jacket': `${DIR}/products/jacket.png`,
  'crewneck-sweatshirt': `${DIR}/products/crewneck.jpg`,
  't-shirt': `${DIR}/products/t-shirt.jpg`,
  polo: `${DIR}/products/polo.jpg`,
  cap: `${DIR}/products/cap.jpg`,
  scarf: `${DIR}/products/scarf.jpg`,
  'cedar-trophy': `${DIR}/products/cedar-trophy.jpg`,
  'puck-with-holder': `${DIR}/products/puck-with-holder.jpg`,
  'lihf-pucks': `${DIR}/products/lihf-pucks.jpg`,
  'official-lebanon-hockey-pin': `${DIR}/products/pin.jpg`,
};

/* The placeholder a product falls back to when it has no photograph of its
   own - one added later in the admin, for instance. Written in one place so
   the seed and the backfill agree on what "still a placeholder" looks like. */
export const productPlaceholder = (slug) => `/api/placeholder/${slug}.svg`;
