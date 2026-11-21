/* ==========================================================================
   Lebanon Hockey - hero parallax
   --------------------------------------------------------------------------
   The slow drift of the hero image as the page scrolls. Seven pages have a
   .hero-media; the rest loaded this for nothing when it lived in app.js.

   Lerped rather than set straight from the scroll position, and it stands down
   once the hero leaves the viewport instead of running a rAF loop forever.
   ========================================================================== */
(function () {
  'use strict';

  if (!document.querySelector('.hero-media')) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --------------------------------------------------------------------------
   Hero parallax - lerped, and idle once the hero leaves the viewport
   -------------------------------------------------------------------------- */
const heroMedia = document.querySelector('.hero-media');

if (heroMedia && !reduceMotion) {
  let current = 0;
  let target = 0;
  let running = false;
  let inView = true;

  const readTarget = () => {
    const rect = heroMedia.parentElement.getBoundingClientRect();
    // Progress 0 -> 1 as the hero scrolls out of the top of the viewport.
    const progress = Math.min(Math.max(-rect.top / Math.max(rect.height, 1), 0), 1);
    target = progress * 90;
  };

  const tick = () => {
    current += (target - current) * 0.1;
    heroMedia.style.transform = `translate3d(0, ${current.toFixed(2)}px, 0)`;

    // Keep animating until we have settled, then stand down.
    if (Math.abs(target - current) > 0.05 && inView) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  };

  const wake = () => {
    readTarget();
    if (!running && inView) {
      running = true;
      requestAnimationFrame(tick);
    }
  };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) wake();
      },
      { threshold: 0 }
    ).observe(heroMedia.parentElement);
  }

  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake, { passive: true });
  wake();
}

})();
