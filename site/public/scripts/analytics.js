/* Cookie-free, same-origin analytics. No raw IP, user agent, search terms, or scroll trail is sent. */
(() => {
  'use strict';
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;

  const sent = new Set();
  function record(event, target = '') {
    const key = `${event}\n${location.pathname}\n${target}`;
    if (sent.has(key)) return;
    sent.add(key);
    fetch('/api/track', {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: location.pathname, target }),
    }).catch(() => {});
  }

  record('page_view');
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    try {
      const target = new URL(link.href, location.href);
      if (target.origin === location.origin && /^\/(?:en\/)?posts\//.test(target.pathname)) record('article_click', target.pathname);
    } catch { /* Invalid links are ignored. */ }
  }, { capture: true });

  const article = document.querySelector('[data-pagefind-body]');
  if (!article) return;
  let ticking = false;
  function measure() {
    ticking = false;
    const bounds = article.getBoundingClientRect();
    const readable = Math.max(1, bounds.height - innerHeight);
    const progress = Math.max(0, Math.min(1, -bounds.top / readable));
    if (progress >= .5) record('read_50');
    if (progress >= .9) {
      record('read_complete');
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
    }
  }
  function schedule() {
    if (!ticking) { ticking = true; requestAnimationFrame(measure); }
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  measure();
})();
