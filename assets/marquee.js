/* ==========================================================================
   Lebanon Hockey - photo marquee
   --------------------------------------------------------------------------
   The scrolling photo rails. Only the home page has one, and this is the single
   biggest block that used to ship on all 22 pages.

   rAF transform loop that wraps on the measured pixel width of one content
   cycle, so it never snaps at the loop boundary the way a keyframe from 0% to
   -50% does. Hover eases the speed down instead of hard-stopping it, scrolling
   nudges the velocity, and the rail can be dragged with inertia.
   ========================================================================== */
(function () {
  'use strict';

  if (!document.querySelector('.marquee')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   Photo marquee
   --------------------------------------------------------------------------
   rAF transform loop that wraps on the measured pixel width of one content
   cycle, so it never snaps at the loop boundary the way a keyframe from 0% to
   -50% does. Hover eases the speed down instead of hard-stopping it, scrolling
   nudges the velocity, and the rail can be dragged with inertia.
   ========================================================================== */
/* Bare <img> children become .marquee-item wrappers. That wrapper is what
   carries the tile size, crop and radius, and the reduced-motion rules in
   styles.css already target .marquee-item - so this has to run even when the
   animation does not, or the rail renders full-resolution photographs at their
   natural height. */
function normaliseTiles(root) {
  const track = root.querySelector('.marquee-track');
  if (!track) return;

  Array.from(track.children)
    .filter((el) => !el.dataset.clone)
    .forEach((el) => {
      if (el.classList.contains('marquee-item')) return;
      if (el.tagName !== 'IMG') return;
      const wrapper = document.createElement('div');
      wrapper.className = 'marquee-item';
      el.replaceWith(wrapper);
      wrapper.appendChild(el);
    });
}

function initMarquee(root) {
  const track = root.querySelector('.marquee-track');
  if (!track) return;

  normaliseTiles(root);

  const baseItems = Array.from(track.children).filter((el) => !el.dataset.clone);
  const baseCount = baseItems.length;
  if (!baseCount) return;

  const speed = Number(root.dataset.speed || 42);            // px per second
  const direction = root.dataset.direction === 'right' ? -1 : 1;

  let cycleWidth = 0;
  let offset = 0;
  let speedFactor = 1;      // eased multiplier (hover / drag)
  let targetFactor = 1;
  let scrollBoost = 0;      // decaying nudge from page scroll
  let dragging = false;
  let dragVelocity = 0;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let rafId = null;
  let visible = true;

  /* --- Build enough clones to cover 2x the viewport, then measure ---------- */
  function build() {
    track.querySelectorAll('[data-clone]').forEach((el) => el.remove());

    const needed = root.clientWidth * 2;
    let guard = 0;

    while (track.scrollWidth < needed + 400 && guard < 12) {
      baseItems.forEach((item) => {
        const clone = item.cloneNode(true);
        clone.dataset.clone = 'true';
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('img').forEach((img) => img.setAttribute('alt', ''));
        track.appendChild(clone);
      });
      guard += 1;
    }

    // One cycle = distance from the first tile to the first tile of the next
    // copy. Measured with getBoundingClientRect because offsetLeft is rounded to
    // whole pixels, and a rounding error here is exactly what makes a marquee
    // visibly snap. (The old -50% keyframe was 11px short of a true cycle.)
    // Both reads sit on the same track, so the live transform cancels out.
    const all = Array.from(track.children);

    if (all[baseCount]) {
      cycleWidth =
        all[baseCount].getBoundingClientRect().left - all[0].getBoundingClientRect().left;
    } else {
      cycleWidth = track.scrollWidth;
    }

    measureTiles();
  }

  /* --- Per-tile counter-parallax ------------------------------------------
     Geometry is measured once per build/resize and cached. Reading
     getBoundingClientRect for every tile on every frame would force a synchronous
     layout 60 times a second, which stalls the compositor on a long rail.
     ------------------------------------------------------------------------ */
  let tileCache = [];
  let rootWidth = 1;

  function measureTiles() {
    rootWidth = root.clientWidth || 1;

    // Read every rect in one pass, relative to the track, so the values are
    // sub-pixel accurate and independent of the current transform.
    const trackLeft = track.getBoundingClientRect().left;

    tileCache = Array.from(track.children).map((tile) => {
      const rect = tile.getBoundingClientRect();
      return {
        el: tile,
        left: rect.left - trackLeft,
        width: rect.width,
        shift: null,
      };
    });
  }

  function paintTiles() {
    for (let i = 0; i < tileCache.length; i += 1) {
      const tile = tileCache[i];
      const left = tile.left - offset;

      // Skip anything comfortably off-stage.
      if (left > rootWidth + tile.width || left < -tile.width * 2) continue;

      const ratio = ((left + tile.width / 2) / rootWidth - 0.5) * 2;
      const shift = Math.round(-ratio * 14 * 10) / 10;

      if (shift !== tile.shift) {
        tile.shift = shift;
        tile.el.style.setProperty('--tile-shift', `${shift}px`);
      }
    }
  }

  /* --- Main loop ----------------------------------------------------------- */
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // clamp after tab switch
    lastTime = now;

    speedFactor += (targetFactor - speedFactor) * 0.08;
    scrollBoost *= 0.92;
    if (Math.abs(scrollBoost) < 0.01) scrollBoost = 0;

    if (dragging) {
      // Position is driven by pointer movement in onPointerMove.
    } else if (Math.abs(dragVelocity) > 0.5) {
      offset -= dragVelocity;
      dragVelocity *= 0.94;
    } else {
      dragVelocity = 0;
      offset += (speed * speedFactor + scrollBoost) * direction * dt;
    }

    if (cycleWidth > 0) {
      offset = ((offset % cycleWidth) + cycleWidth) % cycleWidth;
    }

    track.style.transform = `translate3d(${-offset.toFixed(2)}px, 0, 0)`;
    paintTiles();

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId !== null) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* --- Interaction --------------------------------------------------------- */
  root.addEventListener('pointerenter', () => {
    targetFactor = 0.15;
  });

  root.addEventListener('pointerleave', () => {
    targetFactor = 1;
  });

  root.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragVelocity = 0;
    lastPointerX = event.clientX;
    lastPointerTime = performance.now();
    root.classList.add('is-dragging');
    root.setPointerCapture(event.pointerId);
  });

  root.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastPointerX;
    const now = performance.now();
    const dt = Math.max(now - lastPointerTime, 1);

    offset -= dx;
    // px per frame-ish, used as inertia when the pointer is released
    dragVelocity = (dx / dt) * 16;
    lastPointerX = event.clientX;
    lastPointerTime = now;
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-dragging');
    if (event.pointerId !== undefined && root.hasPointerCapture?.(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }
  };

  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  /* --- Scroll coupling ----------------------------------------------------- */
  let lastScrollY = window.scrollY;

  const onScroll = () => {
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    // Scrolling down pushes the rail along its own direction; up drags it back.
    scrollBoost = Math.max(Math.min(scrollBoost + delta * 2.2, 320), -320);
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  /* --- Only run while on screen and the tab is visible ---------------------- */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !document.hidden) start();
        else stop();
      },
      { threshold: 0 }
    ).observe(root);
  } else {
    start();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  /* --- Resize -------------------------------------------------------------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      offset = 0;
    }, 150);
  });

  build();

  // Re-measure once images have decoded, since layout width depends on them.
  const imgs = Array.from(track.querySelectorAll('img'));
  const pending = imgs.filter((img) => !img.complete);

  if (pending.length) {
    let settled = 0;
    pending.forEach((img) => {
      const done = () => {
        settled += 1;
        if (settled === pending.length) build();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  }
}

document.querySelectorAll('.marquee').forEach((root) => {
  normaliseTiles(root);
  if (!reduceMotion) initMarquee(root);
});

})();
