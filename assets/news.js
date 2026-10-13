/**
 * News: the listing, the share menu, and the full-screen photo view.
 *
 * Loaded on news.html and on the per-post pages, which are the same shell with
 * the article rendered into it by the server. Everything here is additive: with
 * JavaScript off the server-rendered post still reads fine, and the listing
 * degrades to the empty state rather than a broken layout.
 *
 * No third-party share widget. Those load scripts from a social network on every
 * page view, which would break the zero-third-party-request commitment in
 * PRODUCT.md and reintroduce a cookie-consent requirement. These are plain links
 * and the browser's own share sheet - nothing is requested until a visitor acts.
 */
(function () {
  'use strict';

  const { api, escapeHtml, formatDate, toast } = window.LH;

  /* ======================================================================
     Full-screen photo
     ====================================================================== */
  let lightbox = null;

  function openLightbox(src, alt) {
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.setAttribute('aria-label', 'Photo');
      lightbox.innerHTML =
        '<button type="button" class="lightbox-close" aria-label="Close photo">&times;</button><img alt="">';
      document.body.appendChild(lightbox);

      lightbox.addEventListener('click', (event) => {
        // Clicking the backdrop or the close button dismisses; the image does not.
        if (event.target === lightbox || event.target.closest('.lightbox-close')) closeLightbox();
      });
    }

    const img = lightbox.querySelector('img');
    img.src = src;
    img.alt = alt || '';
    lightbox.classList.add('is-open');
    document.body.classList.add('has-lightbox');
    lightbox.querySelector('.lightbox-close').focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    document.body.classList.remove('has-lightbox');
    // Hand focus back to whatever opened it.
    document.querySelector('[data-lightbox].was-open')?.focus();
    document.querySelectorAll('[data-lightbox].was-open').forEach((b) => b.classList.remove('was-open'));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox?.classList.contains('is-open')) closeLightbox();
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lightbox]');
    if (!trigger) return;
    event.preventDefault();
    trigger.classList.add('was-open');
    const img = trigger.querySelector('img');
    openLightbox(trigger.dataset.full || img?.src, img?.alt);
  });

  /* ======================================================================
     Share menu
     ====================================================================== */
  function shareItems(post) {
    const url = post.url;
    const text = post.title;
    const items = [
      { label: 'Copy link', action: 'copy' },
      {
        label: 'Share on Facebook',
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      },
      {
        label: 'Share on X',
        href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      },
      {
        label: 'Share on WhatsApp',
        href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      },
    ];

    /* Only the links the admin actually filled in, so a post never offers a dead
       "see it on Instagram" for an account nobody set up. */
    if (post.share?.facebook) items.push({ label: 'See the federation post', href: post.share.facebook });
    if (post.share?.instagram) items.push({ label: 'See it on Instagram', href: post.share.instagram });
    if (post.share?.x) items.push({ label: 'See it on X', href: post.share.x });

    return items;
  }

  function shareMenuHtml(post) {
    const items = shareItems(post)
      .map((item) =>
        item.href
          ? `<a role="menuitem" href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              item.label
            )}</a>`
          : `<button type="button" role="menuitem" data-share-copy>${escapeHtml(item.label)}</button>`
      )
      .join('');

    return `
      <div class="share" data-share data-url="${escapeHtml(post.url)}" data-title="${escapeHtml(post.title)}">
        <button type="button" class="share-toggle" data-share-toggle aria-haspopup="true" aria-expanded="false" aria-label="Share this post">
          <span aria-hidden="true">&#8943;</span>
        </button>
        <div class="share-menu" role="menu" hidden>
          ${navigator.share ? '<button type="button" role="menuitem" data-share-native>Share&hellip;</button>' : ''}
          ${items}
        </div>
      </div>`;
  }

  document.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-share-toggle]');
    const root = event.target.closest('[data-share]');

    // Any click outside closes every open menu.
    document.querySelectorAll('[data-share] .share-menu').forEach((menu) => {
      if (!root || !root.contains(menu)) {
        menu.hidden = true;
        menu.parentElement.querySelector('[data-share-toggle]')?.setAttribute('aria-expanded', 'false');
      }
    });

    if (toggle) {
      const menu = root.querySelector('.share-menu');
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
      return;
    }

    if (!root) return;

    if (event.target.closest('[data-share-copy]')) {
      try {
        await navigator.clipboard.writeText(root.dataset.url);
        toast('Link copied.');
      } catch {
        toast('Could not copy the link.', 'error');
      }
      root.querySelector('.share-menu').hidden = true;
    }

    if (event.target.closest('[data-share-native]')) {
      try {
        await navigator.share({ title: root.dataset.title, url: root.dataset.url });
      } catch {
        /* the visitor dismissed the sheet; nothing to report */
      }
      root.querySelector('.share-menu').hidden = true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-share] .share-menu').forEach((menu) => {
      menu.hidden = true;
      menu.parentElement.querySelector('[data-share-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });

  /* ======================================================================
     The newsroom listing
     ====================================================================== */
  const listHost = document.querySelector('[data-news]');

  if (listHost) {
    (async () => {
      try {
        const data = await api('/api/news');

        if (!data.posts.length) {
          listHost.innerHTML =
            '<div class="empty-state"><h2>No posts yet</h2><p>Federation announcements will appear here.</p></div>';
          return;
        }

        listHost.innerHTML = data.posts
          .map(
            (post) => `
          <article class="info-card news-card">
            ${
              post.imageUrl
                ? `<button type="button" class="news-thumb" data-lightbox data-full="${escapeHtml(
                    post.imageUrl
                  )}" aria-label="View the photo for ${escapeHtml(post.title)} full screen">
                    <img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(post.imageAlt || '')}" loading="lazy">
                  </button>`
                : ''
            }
            <div class="news-head">
              ${post.category ? `<p class="tag">${escapeHtml(post.category)}</p>` : ''}
              ${shareMenuHtml(post)}
            </div>
            <h2><a href="/news/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a></h2>
            <p class="news-date"><time datetime="${escapeHtml(post.publishedAt)}">${escapeHtml(
              formatDate(post.publishedAt)
            )}</time></p>
            <p>${escapeHtml(post.excerpt || post.body.slice(0, 180))}</p>
            ${
              post.contactEmail || post.contactPhone
                ? `<p class="news-contact">${
                    post.contactEmail
                      ? `<a href="mailto:${escapeHtml(post.contactEmail)}">${escapeHtml(post.contactEmail)}</a>`
                      : ''
                  }${post.contactEmail && post.contactPhone ? '<span aria-hidden="true"> · </span>' : ''}${
                    post.contactPhone
                      ? `<a href="tel:${escapeHtml(post.contactPhone.replace(/[^+\d]/g, ''))}">${escapeHtml(
                          post.contactPhone
                        )}</a>`
                      : ''
                  }</p>`
                : ''
            }
            <a class="button ghost small" href="/news/${escapeHtml(post.slug)}">Read more</a>
          </article>`
          )
          .join('');
      } catch (error) {
        listHost.innerHTML = `<div class="empty-state"><h2>Could not load the news</h2><p>${escapeHtml(
          error.message
        )}</p></div>`;
      }
    })();
  }

  /* On a per-post page the article is already rendered by the server; only the
     share control has to be attached. */
  const postShare = document.querySelector('[data-post-share]');
  const article = document.querySelector('[data-post-slug]');

  if (postShare && article) {
    (async () => {
      try {
        const data = await api('/api/news');
        const post = data.posts.find((p) => p.slug === article.dataset.postSlug);
        if (post) postShare.innerHTML = shareMenuHtml(post);
      } catch {
        /* the page is perfectly readable without a share button */
      }
    })();
  }
})();
