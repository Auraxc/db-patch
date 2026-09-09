/* Set the page theme before its first paint; no storage access is required. */
(() => {
  'use strict';

  const root = document.documentElement;
  const storageKey = 'dbpatch-theme';
  const choices = ['system', 'light', 'dark'];
  let preference = 'system';
  let systemTheme;

  try {
    const saved = localStorage.getItem(storageKey);
    if (choices.includes(saved)) preference = saved;
  } catch (_) { /* Private browsing can disable storage. */ }

  try {
    systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  } catch (_) { /* A browser without matchMedia defaults to daylight. */ }

  const icons = {
    system: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
    dark: '<path d="M20.6 13.2A8.8 8.8 0 0 1 10.8 3.4a9 9 0 1 0 9.8 9.8Z"/>',
  };

  function syncControls() {
    const english = root.lang.toLowerCase().startsWith('en');
    const names = english
      ? {system: 'System', light: 'Light', dark: 'Dark'}
      : {system: '跟随系统', light: '日间', dark: '夜间'};
    const active = root.dataset.theme;
    const label = english
      ? `Theme: ${names[preference]}${preference === 'system' ? ` (currently ${names[active].toLowerCase()})` : ''}`
      : `外观：${names[preference]}${preference === 'system' ? `（当前${names[active]}）` : ''}`;

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[preference]}</svg><span class="sr-only">${label}</span>`;
      const menu = button.closest('.theme-picker')?.querySelector('.theme-options');
      button.setAttribute('aria-expanded', String(Boolean(menu && !menu.hidden)));
    });
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    });
  }

  function applyTheme() {
    const actual = preference === 'system' ? (systemTheme?.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = actual;
    root.dataset.themePreference = preference;
    root.style.colorScheme = actual;
    syncControls();
  }

  function closeMenus(returnFocus = false) {
    document.querySelectorAll('.theme-picker').forEach(picker => {
      const menu = picker.querySelector('.theme-options');
      const toggle = picker.querySelector('[data-theme-toggle]');
      if (!menu || menu.hidden) return;
      menu.hidden = true;
      toggle?.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle?.focus();
    });
  }

  applyTheme();
  window.DBPatchTheme = {syncControls};

  const onSystemChange = () => {
    if (preference === 'system') applyTheme();
  };
  systemTheme?.addEventListener('change', onSystemChange);

  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    preference = choices.includes(event.newValue) ? event.newValue : 'system';
    applyTheme();
  });

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;
    const choice = target.closest('[data-theme-choice]');
    if (choice && choices.includes(choice.dataset.themeChoice)) {
      preference = choice.dataset.themeChoice;
      try { localStorage.setItem(storageKey, preference); } catch (_) { /* Keep the choice for this page. */ }
      applyTheme();
      closeMenus(true);
      return;
    }

    const toggle = target.closest('[data-theme-toggle]');
    if (toggle) {
      const menu = toggle.closest('.theme-picker')?.querySelector('.theme-options');
      if (!menu) return;
      const shouldOpen = menu.hidden;
      closeMenus();
      menu.hidden = !shouldOpen;
      toggle.setAttribute('aria-expanded', String(shouldOpen));
      return;
    }
    if (!target.closest('.theme-picker')) closeMenus();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenus(true);
  });

  document.addEventListener('focusin', event => {
    if (!event.target.closest?.('.theme-picker')) closeMenus();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncControls, {once: true});
  else syncControls();
})();
