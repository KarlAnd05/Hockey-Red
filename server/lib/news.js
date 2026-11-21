/**
 * News posts.
 *
 * Posts used to be three hand-written cards in news.html. They are data now, so
 * the federation can publish without a code change, and so each post can have a
 * page of its own.
 *
 * Why per-post pages exist at all: a share link pointing at news.html#slug
 * previews on Facebook or WhatsApp as the generic "Newsroom" with no title and
 * no image, because the preview crawler reads the server's HTML and does not run
 * JavaScript. Rendering the post server-side, into the real page shell, is what
 * makes a shared link look like the article it is.
 */
import { db } from '../db.js';
import { config } from '../config.js';
import { escapeHtml, stripTags, absolute, textToHtml, intoShell, socialMeta } from './page.js';

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function uniqueSlug(base, excludeId = null) {
  let slug = slugify(base) || 'post';
  let n = 2;
  const taken = (value) =>
    db
      .prepare('SELECT id FROM news_posts WHERE slug = ? AND id IS NOT ?')
      .get(value, excludeId);

  while (taken(slug)) {
    slug = `${slugify(base)}-${n}`;
    n += 1;
  }
  return slug;
}

export function listPosts({ includeInactive = false } = {}) {
  const sql = includeInactive
    ? 'SELECT * FROM news_posts ORDER BY published_at DESC, id DESC'
    : 'SELECT * FROM news_posts WHERE active = 1 ORDER BY published_at DESC, id DESC';
  return db.prepare(sql).all();
}

export function findPostBySlug(slug) {
  return db.prepare('SELECT * FROM news_posts WHERE slug = ?').get(String(slug || '')) || null;
}

export function findPost(id) {
  return db.prepare('SELECT * FROM news_posts WHERE id = ?').get(Number(id)) || null;
}

export function serialisePost(post) {
  if (!post) return null;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    category: post.category,
    excerpt: post.excerpt,
    body: post.body,
    imageUrl: post.image_url,
    imageAlt: post.image_alt,
    author: post.author,
    contactEmail: post.contact_email,
    contactPhone: post.contact_phone,
    /* Only the links the admin actually filled in are offered in the share menu,
       so a post never shows a dead "share on Instagram" for an account that is
       not set up. */
    share: {
      facebook: post.share_facebook,
      instagram: post.share_instagram,
      x: post.share_x,
    },
    publishedAt: post.published_at,
    active: Boolean(post.active),
    url: `${config.appUrl}/news/${post.slug}`,
  };
}

/* escapeHtml, stripTags, absolute, textToHtml, intoShell and socialMeta are
   in lib/page.js, shared with the team, player and game-sheet pages. The old
   bodyToHtml here was textToHtml under another name. */

/**
 * Render one post into the real news.html shell.
 *
 * Taking the shell from the live page rather than keeping a copy here means the
 * header, footer and script tags can never drift out of step with the rest of
 * the site - there is only ever one definition of them.
 */
export function renderPostPage(post, shellHtml) {
  const title = `${post.title} · Lebanon Hockey`;
  const description = stripTags(post.excerpt || post.body).slice(0, 200);
  const image = absolute(post.image_url);
  const url = `${config.appUrl}/news/${post.slug}`;

  /* article:published_time is the one tag a post has and a team page does
     not, so it goes through socialMeta's `extra` rather than forking it. */
  const meta = socialMeta({
    title: post.title,
    description,
    image,
    url,
    type: 'article',
    extra: [
      post.published_at
        ? `<meta property="article:published_time" content="${escapeHtml(post.published_at)}">`
        : '',
    ],
  });

  const contact = [
    post.contact_email
      ? `<a href="mailto:${escapeHtml(post.contact_email)}">${escapeHtml(post.contact_email)}</a>`
      : '',
    post.contact_phone
      ? `<a href="tel:${escapeHtml(post.contact_phone.replace(/[^+\d]/g, ''))}">${escapeHtml(post.contact_phone)}</a>`
      : '',
  ]
    .filter(Boolean)
    .join('<span aria-hidden="true"> · </span>');

  const article = `
      <section class="hero page-hero">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="dot" aria-hidden="true"></span>
            <p class="eyebrow">${escapeHtml(post.category || 'Federation News')}</p>
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="post-meta">
            <time datetime="${escapeHtml(post.published_at)}">${escapeHtml(
              String(post.published_at || '').slice(0, 10)
            )}</time>${post.author ? ` <span aria-hidden="true">·</span> ${escapeHtml(post.author)}` : ''}
          </p>
        </div>
      </section>

      <section class="section reveal">
        <article class="post-article" data-post-slug="${escapeHtml(post.slug)}">
          ${
            image
              ? `<button type="button" class="post-figure" data-lightbox data-full="${escapeHtml(
                  post.image_url
                )}" aria-label="View the photo full screen">
            <img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.image_alt || '')}">
            <span class="post-figure-hint">View full screen</span>
          </button>`
              : ''
          }
          ${textToHtml(post.body) || `<p>${escapeHtml(post.excerpt)}</p>`}
          ${contact ? `<p class="post-contact">${contact}</p>` : ''}
          <div class="post-share" data-post-share></div>
        </article>

        <div class="section-cta">
          <a class="button ghost" href="/news.html">All news</a>
        </div>
      </section>`;

  return intoShell(shellHtml, { title, description, meta, main: article });
}
