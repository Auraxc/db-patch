/* Progressive enhancement only: every article and navigation link is static HTML. */
(() => {
  'use strict';

  function init() {
    const root = document.documentElement;
    const english = root.lang.toLowerCase().startsWith('en');
    const locale = english ? 'en' : 'zh';
    const say = (zh, en) => english ? en : zh;
    root.classList.add('js-ready');
    window.DBPatchTheme?.syncControls();

    let siteOrigin = location.origin;
    try {
      const configured = new URL(document.body.dataset.site || location.origin);
      if (['https:', 'http:'].includes(configured.protocol)) siteOrigin = configured.origin;
    } catch (_) { /* A local preview remains usable without a configured domain. */ }

    const menu = document.querySelector('.main-nav');
    const menuButton = document.querySelector('.menu-button');
    function closeNavigation(focus = false) {
      if (!menu || !menuButton || !menu.classList.contains('open')) return;
      menu.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', say('展开导航', 'Open navigation'));
      if (focus) menuButton.focus();
    }
    menuButton?.addEventListener('click', () => {
      if (!menu) return;
      const opened = menu.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(opened));
      menuButton.setAttribute('aria-label', opened ? say('收起导航', 'Close navigation') : say('展开导航', 'Open navigation'));
    });
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.main-nav a') || !event.target.closest('.main-nav, .menu-button')) closeNavigation();
    });
    document.addEventListener('focusin', event => {
      if (menu?.classList.contains('open') && event.target instanceof Element && !event.target.closest('.main-nav, .menu-button')) closeNavigation();
    });
    try {
      const mobile = window.matchMedia('(max-width: 760px)');
      const onWidthChange = () => { if (!mobile.matches) closeNavigation(); };
      mobile.addEventListener('change', onWidthChange);
    } catch (_) { /* Navigation remains functional without media query events. */ }

    let toastTimer;
    function notify(message, inline) {
      if (inline) { inline.textContent = message; return; }
      let status = document.querySelector('.toast');
      if (!status) {
        status = document.createElement('div');
        status.className = 'toast';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        document.body.append(status);
      }
      status.textContent = message;
      status.classList.add('visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => status.classList.remove('visible'), 3500);
    }
    async function copyText(text, message, inline) {
      try {
        await navigator.clipboard.writeText(text);
        notify(message, inline);
        return true;
      } catch (_) {
        notify(say('无法自动复制，请选中文字手动复制。', 'Automatic copying is unavailable. Please select and copy the text.'), inline);
        return false;
      }
    }

    const searchDialog = document.getElementById('search-dialog');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchCount = document.getElementById('search-count');
    let searchIndex;
    let searchRequest = 0;
    let searchTimer;
    let searchTrigger;
    const normalize = value => String(value || '').normalize('NFKC').toLowerCase();

    function safeSearchURL(value) {
      if (typeof value !== 'string') return null;
      try {
        const url = new URL(value, location.origin);
        if (!['https:', 'http:'].includes(url.protocol) || ![location.origin, siteOrigin].includes(url.origin)) return null;
        if (url.pathname.startsWith('/en/') !== english) return null;
        return url.pathname + url.search + url.hash;
      } catch (_) { return null; }
    }

    function loadSearchIndex() {
      if (!searchIndex) {
        searchIndex = fetch(`/data/search-${locale}.json`).then(response => {
          if (!response.ok) throw new Error('Search index unavailable');
          return response.json();
        }).then(entries => {
          if (!Array.isArray(entries)) throw new Error('Invalid search index');
          return entries.flatMap(entry => {
            const url = safeSearchURL(entry?.url);
            if (!url || typeof entry.title !== 'string') return [];
            const tags = Array.isArray(entry.tags) ? entry.tags.filter(tag => typeof tag === 'string') : [];
            return [{title: entry.title, excerpt: typeof entry.excerpt === 'string' ? entry.excerpt : '', url,
              searchable: normalize([entry.title, entry.excerpt, ...tags, typeof entry.text === 'string' ? entry.text : ''].join(' '))}];
          });
        }).catch(error => { searchIndex = undefined; throw error; });
      }
      return searchIndex;
    }

    async function runSearch() {
      if (!searchInput || !searchResults || !searchCount) return;
      const request = ++searchRequest;
      searchCount.textContent = say('正在加载搜索…', 'Loading search…');
      try {
        const entries = await loadSearchIndex();
        if (request !== searchRequest) return;
        const words = normalize(searchInput.value).trim().split(/\s+/).filter(Boolean);
        const matched = entries.filter(entry => words.every(word => entry.searchable.includes(word)));
        const fragment = document.createDocumentFragment();
        for (const entry of matched.slice(0, 40)) {
          const link = document.createElement('a');
          link.className = 'search-result';
          link.href = entry.url;
          const title = document.createElement('h3');
          title.textContent = entry.title;
          const description = document.createElement('p');
          description.textContent = entry.excerpt;
          link.append(title, description);
          fragment.append(link);
        }
        if (!matched.length) {
          const empty = document.createElement('p');
          empty.className = 'empty-state';
          empty.textContent = say('没有找到文章。试试 PostgreSQL、备份或 AI。', 'No matching articles. Try PostgreSQL, backups or AI.');
          fragment.append(empty);
        }
        searchResults.replaceChildren(fragment);
        const summary = words.length
          ? say(`找到 ${matched.length} 篇文章`, `${matched.length} articles found`)
          : say(`${matched.length} 篇中文文章 · 可搜索标题、正文与标签`, `${matched.length} English articles · Search titles, text and tags`);
        searchCount.textContent = summary + (matched.length > 40 ? say(' · 显示前 40 篇，请缩小搜索范围', ' · Showing the first 40; refine your search') : '');
      } catch (_) {
        if (request !== searchRequest) return;
        searchResults.replaceChildren();
        searchCount.textContent = say('搜索暂时无法加载，请重试或浏览文章归档。', 'Search could not load. Try again or browse the article archive.');
      }
    }

    function openSearch(trigger) {
      if (!searchDialog || !searchInput || typeof searchDialog.showModal !== 'function') return false;
      searchTrigger = trigger || document.activeElement;
      closeNavigation();
      if (!searchDialog.open) searchDialog.showModal();
      searchInput.focus();
      runSearch();
      return true;
    }
    document.querySelectorAll('[data-search]').forEach(trigger => {
      trigger.addEventListener('click', event => { if (openSearch(trigger)) event.preventDefault(); });
    });
    searchInput?.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
    searchDialog?.querySelectorAll('.close-dialog, [data-close-dialog]').forEach(button => button.addEventListener('click', () => searchDialog.close()));
    searchDialog?.addEventListener('click', event => {
      if (event.target !== searchDialog) return;
      const bounds = searchDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) searchDialog.close();
    });
    searchDialog?.addEventListener('close', () => { searchTrigger?.focus?.(); });
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        if (openSearch()) event.preventDefault();
      }
      if (event.key === 'Escape') {
        if (searchDialog?.open) { event.preventDefault(); searchDialog.close(); }
        else closeNavigation(true);
      }
    });

    const feedLanguage = document.getElementById('rss-language');
    const feedTag = document.getElementById('rss-tag');
    const feedText = document.querySelector('[data-feed-url]');
    const openFeed = document.querySelector('[data-open-feed]');
    const copyFeed = document.querySelector('[data-copy-feed]');
    const copyStatus = document.querySelector('[data-copy-status]');
    if (feedLanguage && feedTag && feedText && openFeed) {
      const parameters = new URLSearchParams(location.search);
      if (['zh', 'en'].includes(parameters.get('lang'))) feedLanguage.value = parameters.get('lang');
      const requestedTag = parameters.get('tag');
      if (requestedTag && Array.from(feedTag.options).some(option => option.value === requestedTag)) feedTag.value = requestedTag;
      function updateFeed() {
        const language = feedLanguage.value === 'en' ? 'en' : 'zh';
        const tag = feedTag.value;
        const selectedTag = tag && tag !== 'all' && /^[a-z0-9-]+$/.test(tag) ? tag : null;
        const path = (language === 'en' ? '/en' : '') + (selectedTag ? `/tags/${selectedTag}/rss.xml` : '/rss.xml');
        const url = new URL(path, siteOrigin).href;
        feedText.textContent = url;
        // Preview the generated local file; only the copied subscription URL is canonical.
        openFeed.href = path;
        document.querySelectorAll('a[data-language-switch]').forEach(link => {
          const target = new URL(link.href, location.href);
          if (selectedTag) target.searchParams.set('tag', selectedTag);
          else target.searchParams.delete('tag');
          target.searchParams.delete('lang');
          link.href = target.href;
        });
        for (const option of feedTag.options) {
          const translated = option.dataset[language];
          if (translated) option.textContent = translated;
        }
        const summary = document.querySelector('.rss-summary');
        if (summary) summary.textContent = `${language === 'en' ? 'English' : '中文'} · ${feedTag.selectedOptions[0]?.textContent || ''}`;
        if (copyStatus) copyStatus.textContent = '';
      }
      feedLanguage.addEventListener('change', updateFeed);
      feedTag.addEventListener('change', updateFeed);
      copyFeed?.addEventListener('click', () => copyText(feedText.textContent, say('订阅地址已复制。', 'Feed URL copied.'), copyStatus));
      updateFeed();
    }

    const article = document.getElementById('article-content');
    const fontButton = document.getElementById('font-toggle');
    const sizeButton = document.getElementById('font-size');
    if (article) {
      let serif = false;
      let large = false;
      try { serif = localStorage.getItem('dbpatch-serif') === 'true'; large = localStorage.getItem('dbpatch-large-text') === 'true'; } catch (_) {}
      function updateReading() {
        article.classList.toggle('reading-serif', serif);
        article.classList.toggle('reading-large', large);
        fontButton?.setAttribute('aria-pressed', String(serif));
        sizeButton?.setAttribute('aria-pressed', String(large));
        sizeButton?.setAttribute('aria-label', large ? say('恢复正文字号', 'Reset text size') : say('增大正文字号', 'Increase text size'));
        if (sizeButton) sizeButton.textContent = large ? 'A−' : 'A＋';
      }
      fontButton?.addEventListener('click', () => { serif = !serif; updateReading(); try { localStorage.setItem('dbpatch-serif', String(serif)); } catch (_) {} });
      sizeButton?.addEventListener('click', () => { large = !large; updateReading(); try { localStorage.setItem('dbpatch-large-text', String(large)); } catch (_) {} });
      updateReading();

      article.querySelectorAll('pre').forEach(pre => {
        if (pre.closest('.code-block')) return;
        const code = pre.querySelector('code') || pre;
        const source = code.textContent;
        const block = document.createElement('div');
        block.className = 'code-block';
        const toolbar = document.createElement('div');
        toolbar.className = 'code-toolbar';
        const language = document.createElement('span');
        language.textContent = pre.dataset.language || code.className.match(/language-([\w-]+)/)?.[1] || 'CODE';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-code';
        button.textContent = say('复制', 'Copy');
        button.setAttribute('aria-label', say('复制代码', 'Copy code'));
        button.addEventListener('click', async () => {
          if (await copyText(source, say('代码已复制。', 'Code copied.'))) {
            button.textContent = say('已复制', 'Copied');
            setTimeout(() => { button.textContent = say('复制', 'Copy'); }, 2000);
          }
        });
        toolbar.append(language, button);
        pre.before(block);
        block.append(toolbar, pre);
        pre.tabIndex = 0;
        pre.setAttribute('aria-label', say('代码，可横向滚动', 'Code block, horizontally scrollable'));
      });

      const tocLinks = Array.from(document.querySelectorAll('#toc-links a[href^="#"]'));
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            for (const link of tocLinks) {
              const active = decodeURIComponent(link.hash.slice(1)) === entry.target.id;
              link.classList.toggle('active', active);
              if (active) link.setAttribute('aria-current', 'location');
              else link.removeAttribute('aria-current');
            }
          }
        }, {rootMargin: '-5% 0px -65% 0px', threshold: 0});
        article.querySelectorAll('h2[id], h3[id]').forEach(heading => observer.observe(heading));
      }
      const progress = document.querySelector('.read-progress');
      if (progress) {
        let queued = false;
        const updateProgress = () => {
          queued = false;
          const bounds = article.getBoundingClientRect();
          const range = bounds.height - window.innerHeight * .55;
          const fraction = range > 0 ? Math.max(0, Math.min(1, (-bounds.top + 60) / range)) : bounds.top < 60 ? 1 : 0;
          progress.style.width = `${fraction * 100}%`;
        };
        const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(updateProgress); } };
        window.addEventListener('scroll', schedule, {passive: true});
        window.addEventListener('resize', schedule);
        if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(article);
        updateProgress();
      }
    }
    document.querySelectorAll('[data-share]').forEach(button => {
      button.addEventListener('click', () => {
        const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
        copyText(canonical, say('文章链接已复制。', 'Article link copied.'));
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
