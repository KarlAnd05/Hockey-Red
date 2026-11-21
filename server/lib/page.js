/**
 * The pieces every server-rendered page needs.
 *
 * Three sections of the site render pages on the server rather than in the
 * browser - a news post at /news/<slug>, a team and a player at /teams/<slug>
 * and /players/<slug>, and now a game sheet at /games/<slug>. They all do it
 * for the same reason: these are the pages whose links get shared, and a
 * link-preview crawler reads the HTML the server sends without running any
 * JavaScript, so the title, the description and the image have to already be
 * in it.
 *
 * They also all do it the same way: take the real page as a shell, swap the
 * <main> for the rendered one, and fix up the links. That was written twice -
 * once in lib/teams.js and once in lib/news.js, which said so in a comment and
 * left it there. A third copy for games is where a duplicated regex over HTML
 * stops being a shortcut and starts being a bug waiting for somebody to fix
 * only two of the three. So it lives here once.
 */
import { config } from '../config.js';

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Strip markup down to the words, for a meta description. */
export const stripTags = (value) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A site-absolute URL, for the social tags.
 *
 * Open Graph and Twitter will not follow a relative image, so a path out of the
 * database has to be made whole. Leading "./" is dropped as well as "/": the
 * generated pages write asset paths both ways and either should survive.
 */
export const absolute = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${config.appUrl}/${raw.replace(/^\.?\//, '')}`;
};

/** Plain paragraphs from a textarea, so an admin never has to write HTML. */
export function textToHtml(text, indent = '\n          ') {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join(indent);
}

/**
 * "Left - Right" per line, rendered as a definition list.
 *
 * The shape teams.staff, teams.honours and games.officials all store: a short
 * list somebody typed, rendered verbatim, with nothing querying inside it. A
 * line with no " - " becomes a term with an empty definition rather than being
 * dropped, because losing somebody's name is worse than an empty cell.
 */
export function lineList(text, className) {
  const rows = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split(' - ');
      const right = rest.join(' - ');
      return right
        ? `<div><dt>${escapeHtml(left)}</dt><dd>${escapeHtml(right)}</dd></div>`
        : `<div><dt>${escapeHtml(left)}</dt><dd></dd></div>`;
    });

  return rows.length ? `<dl class="${className}">${rows.join('')}</dl>` : '';
}

/**
 * Put a rendered <main> into a real page shell.
 *
 * The shell is a page written for the site root, so its asset and nav links are
 * relative. These pages live one level down at /teams/<slug>, /news/<slug> or
 * /games/<slug>, where "./assets/styles.css" resolves to
 * "/teams/assets/styles.css" and 404s, taking the stylesheet, fonts, logo and
 * scripts with it. Rewriting to absolute fixes all of them at once -
 * deliberately not <base href="/">, which would do the same job but send the
 * "#main" skip link to the homepage instead of down the page.
 */
export function intoShell(shellHtml, { title, description, meta, main }) {
  let html = shellHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?>/i,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  html = html.replace('</head>', `  ${meta}\n  </head>`);
  html = html.replace(/<main id="main">[\s\S]*?<\/main>/i, `<main id="main">${main}\n    </main>`);

  return html
    .replace(/(src|href)="\.\/(assets\/)/g, '$1="/$2')
    .replace(/(href)="([A-Za-z0-9_-]+\.html)"/g, '$1="/$2"');
}

/**
 * The canonical link and the share tags.
 *
 * No image means no og:image and a small Twitter card rather than a large one
 * with a blank space where the picture should be. `extra` is for tags only one
 * kind of page has, such as article:published_time on a news post.
 */
export function socialMeta({ title, description, image, url, type = 'website', extra = [] }) {
  return [
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta property="og:type" content="${escapeHtml(type)}">`,
    `<meta property="og:site_name" content="Lebanon Hockey">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    image ? `<meta property="og:image" content="${escapeHtml(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : '',
    ...extra,
  ]
    .filter(Boolean)
    .join('\n    ');
}
