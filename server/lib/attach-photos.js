/**
 * One-time: give the rows that were seeded before the photographs existed the
 * pictures the old site showed.
 *
 * The seeds in db.js, lib/sponsors.js and lib/teams.js now write a photograph
 * with the row, but every one of them is guarded on an empty table, so a
 * database that has already been seeded would never see them. This fills those
 * rows in instead, reading the same map in lib/photos.js that the seeds read,
 * so the two paths cannot disagree about which picture belongs where.
 *
 * Guarded like the other migrations, and deliberately conservative about what
 * counts as "nobody has set this yet":
 *
 *   - an empty photo_url / logo_url / image_url is unset, so it is filled;
 *   - a product still on /api/placeholder/<slug>.svg is unset, because that is
 *     exactly what the old seed wrote and no human would type it;
 *   - anything else is somebody's choice and is left alone.
 *
 * Sponsors have no slug, so they are matched on a name that is still exactly
 * what seedSponsors() wrote. An admin who renamed a partner gets no logo from
 * this rather than the wrong one.
 */
import { db } from '../db.js';
import {
  SPONSOR_LOGOS,
  TEAM_PHOTOS,
  NEWS_IMAGES,
  PRODUCT_IMAGES,
  productPlaceholder,
} from './photos.js';

export function attachPhotos() {
  const done = db.prepare("SELECT value FROM app_meta WHERE key = 'photos_attached'").get();
  if (done && done.value === '1') return 0;

  let filled = 0;

  db.exec('BEGIN');
  try {
    /* Teams. CASE rather than a plain SET so a team whose portrait an admin has
       already chosen keeps it, and the alt text only follows the picture it
       describes - setting one without the other would caption the wrong image. */
    const team = db.prepare(
      `UPDATE teams
          SET photo_url = ?, photo_alt = ?
        WHERE slug = ? AND photo_url = ''`
    );
    for (const [slug, photo] of Object.entries(TEAM_PHOTOS)) {
      filled += team.run(photo.url, photo.alt, slug).changes;
    }

    /* Sponsors, by exact seeded name - see the note above. */
    const sponsor = db.prepare(
      `UPDATE sponsors
          SET logo_url = ?, logo_alt = ?
        WHERE name = ? AND logo_url = ''`
    );
    for (const [name, logo] of Object.entries(SPONSOR_LOGOS)) {
      filled += sponsor.run(logo.url, logo.alt, name).changes;
    }

    /* News posts. */
    const post = db.prepare(
      `UPDATE news_posts
          SET image_url = ?, image_alt = ?
        WHERE slug = ? AND image_url = ''`
    );
    for (const [slug, image] of Object.entries(NEWS_IMAGES)) {
      filled += post.run(image.url, image.alt, slug).changes;
    }

    /* Products. Unlike the other three this field was never empty - the seed
       wrote a generated SVG - so the condition is that it still holds that
       exact placeholder, built from the same helper the seed uses. */
    const product = db.prepare(
      `UPDATE products
          SET image_url = ?
        WHERE slug = ? AND (image_url = '' OR image_url = ?)`
    );
    for (const [slug, url] of Object.entries(PRODUCT_IMAGES)) {
      filled += product.run(url, slug, productPlaceholder(slug)).changes;
    }

    db.prepare(
      `INSERT INTO app_meta (key, value, updated_at) VALUES ('photos_attached', '1', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
    ).run();

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return filled;
}
