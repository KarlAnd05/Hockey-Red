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
    ? 'SELECT * FROM news_posts ORDER BY sort_order, published_at DESC, id DESC'
    : 'SELECT * FROM news_posts WHERE active = 1 ORDER BY sort_order, published_at DESC, id DESC';
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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripTags = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** Paragraphs from a plain-text body, so an admin never has to write HTML. */
function bodyToHtml(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n          ');
}

const absolute = (url) => {
  const value = String(url || '');
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${config.appUrl}/${value.replace(/^\.?\//, '')}`;
};

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

  const meta = [
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="Lebanon Hockey">`,
    `<meta property="og:title" content="${escapeHtml(post.title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(post.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
    post.published_at ? `<meta property="article:published_time" content="${escapeHtml(post.published_at)}">` : '',
  ]
    .filter(Boolean)
    .join('\n    ');

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
          ${bodyToHtml(post.body) || `<p>${escapeHtml(post.excerpt)}</p>`}
          ${contact ? `<p class="post-contact">${contact}</p>` : ''}
          <div class="post-share" data-post-share></div>
        </article>

        <div class="section-cta">
          <a class="button ghost" href="/news.html">All news</a>
        </div>
      </section>`;

  let html = shellHtml;

  // Title and the social preview tags.
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?>/i,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  html = html.replace('</head>', `  ${meta}\n  </head>`);

  // Swap the newsroom listing for this one article.
  html = html.replace(/<main id="main">[\s\S]*?<\/main>/i, `<main id="main">${article}\n    </main>`);

  /* The shell was written for a page at the site root, so every asset and nav
     link in it is relative. This page lives one level down at /news/<slug>, where
     "./assets/styles.css" would resolve to "/news/assets/styles.css" and 404 -
     taking the stylesheet, the fonts, the logo and every script with it.
     Rewriting to absolute fixes all of them at once.

     Deliberately not <base href="/">, which would do the same job but also send
     the "#main" skip link to the homepage instead of down the page. */
  html = html
    .replace(/(src|href)="\.\/(assets\/)/g, '$1="/$2')
    .replace(/(href)="([A-Za-z0-9_-]+\.html)"/g, '$1="/$2"');

  return html;
}
