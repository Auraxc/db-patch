import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const siteScript = readFileSync(new URL('../public/scripts/site.js', import.meta.url), 'utf8');
const themeScript = readFileSync(new URL('../public/scripts/theme.js', import.meta.url), 'utf8');

// Exercise the actual browser scripts with only their DOM/event boundary mocked.
class Element {
  constructor() {
    this.listeners = new Map();
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.textContent = '';
    this.classList = { add() {}, contains() { return false; } };
  }
  addEventListener(name, callback) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(callback);
    this.listeners.set(name, listeners);
  }
  emit(name, event = {}) {
    return Promise.all((this.listeners.get(name) || []).map(callback => callback({ target: this, ...event })));
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  focus() { this.focused = true; }
}

function documentStub(lang = 'zh-CN') {
  const document = new Element();
  document.readyState = 'complete';
  document.documentElement = new Element();
  document.documentElement.lang = lang;
  document.body = new Element();
  document.body.dataset.site = 'https://db-patch.com';
  return document;
}

function subscriptionPage(english = false, search = '?tag=postgresql') {
  const document = documentStub(english ? 'en' : 'zh-CN');
  const language = new Element();
  language.value = english ? 'en' : 'zh';
  const tag = new Element();
  tag.value = 'all';
  tag.options = ['all', 'postgresql', 'ai'].map(value => ({ value, textContent: value, dataset: {} }));
  Object.defineProperty(tag, 'selectedOptions', { get: () => tag.options.filter(option => option.value === tag.value) });
  const ids = { 'rss-language': language, 'rss-tag': tag };
  const selectors = Object.fromEntries(['data-feed-url', 'data-open-feed', 'data-copy-feed', 'data-copy-status']
    .map(name => [`[${name}]`, new Element()]));
  const switchLanguage = new Element();
  switchLanguage.href = `${english ? '/subscribe/' : '/en/subscribe/'}?lang=zh`;
  document.getElementById = id => ids[id] || null;
  document.querySelector = selector => selectors[selector] || null;
  document.querySelectorAll = selector => selector === 'a[data-language-switch]' ? [switchLanguage] : [];
  const window = new Element();
  window.matchMedia = () => new Element();
  const copied = [];
  const location = { origin: 'http://localhost:4321', search,
    href: `http://localhost:4321${english ? '/en/subscribe/' : '/subscribe/'}${search}` };
  vm.runInNewContext(siteScript, {
    document, window, Element, location, URL, URLSearchParams, setTimeout, clearTimeout,
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
  }, { filename: 'site.js' });
  return { language, tag, switchLanguage, selectors, copied, location };
}

function themePage({ stored, dark = false, blocked = false } = {}) {
  const document = documentStub();
  const window = new Element();
  const media = new Element();
  media.matches = dark;
  window.matchMedia = () => media;
  const menu = new Element();
  menu.hidden = true;
  const toggle = new Element();
  const picker = new Element();
  picker.querySelector = selector => selector === '.theme-options' ? menu : toggle;
  toggle.closest = selector => selector === '.theme-picker' ? picker : selector === '[data-theme-toggle]' ? toggle : null;
  const choices = ['system', 'light', 'dark'].map(value => {
    const choice = new Element();
    choice.dataset.themeChoice = value;
    choice.closest = selector => selector === '[data-theme-choice]' ? choice : selector === '.theme-picker' ? picker : null;
    return choice;
  });
  document.querySelectorAll = selector => ({
    '[data-theme-toggle]': [toggle], '[data-theme-choice]': choices, '.theme-picker': [picker],
  })[selector] || [];
  const writes = [];
  const localStorage = {
    getItem() { if (blocked) throw new Error('Storage disabled'); return stored; },
    setItem(key, value) { if (blocked) throw new Error('Storage disabled'); writes.push([key, value]); },
  };
  vm.runInNewContext(themeScript, { document, window, Element, localStorage }, { filename: 'theme.js' });
  return {
    root: document.documentElement, toggle, choices, writes,
    choose: value => document.emit('click', { target: choices.find(choice => choice.dataset.themeChoice === value) }),
    system: value => { media.matches = value; return media.emit('change'); },
    storage: value => window.emit('storage', { key: 'dbpatch-theme', newValue: value }),
  };
}

test('RSS opens the preview route but copies the canonical subscription URL', async () => {
  for (const english of [false, true]) {
    const page = subscriptionPage(english);
    const route = `${english ? '/en' : ''}/tags/postgresql/rss.xml`;
    assert.equal(page.selectors['[data-open-feed]'].href, route);
    assert.equal(new URL(page.selectors['[data-open-feed]'].href, page.location.href).origin, page.location.origin);
    assert.equal(page.selectors['[data-feed-url]'].textContent, `https://db-patch.com${route}`);
    await page.selectors['[data-copy-feed]'].emit('click');
    assert.deepEqual(page.copied, [`https://db-patch.com${route}`]);
    assert.equal(page.selectors['[data-copy-status]'].textContent, english ? 'Feed URL copied.' : '订阅地址已复制。');
  }
});

test('switching the subscription page language preserves tag, clears all, and omits RSS language', async () => {
  for (const english of [false, true]) {
    const page = subscriptionPage(english);
    assert.equal(new URL(page.switchLanguage.href).pathname, english ? '/subscribe/' : '/en/subscribe/');
    assert.equal(new URL(page.switchLanguage.href).search, '?tag=postgresql');
    page.tag.value = 'ai';
    await page.tag.emit('change');
    assert.equal(new URL(page.switchLanguage.href).search, '?tag=ai');
    page.language.value = english ? 'zh' : 'en';
    await page.language.emit('change');
    assert.equal(new URL(page.switchLanguage.href).search, '?tag=ai');
    page.tag.value = 'all';
    await page.tag.emit('change');
    assert.equal(new URL(page.switchLanguage.href).search, '');
    assert.equal(page.selectors['[data-open-feed]'].href, english ? '/rss.xml' : '/en/rss.xml');
  }
  assert.equal(new URL(subscriptionPage(false, '?tag=unknown').switchLanguage.href).search, '');
});

test('system theme follows OS changes and publishes the accessible current preference', async () => {
  const page = themePage({ dark: true });
  assert.equal(page.root.dataset.themePreference, 'system');
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(page.root.style.colorScheme, 'dark');
  assert.equal(page.toggle.attributes['aria-label'], '外观：跟随系统（当前夜间）');
  await page.system(false);
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.choices[0].attributes['aria-pressed'], 'true');
});

test('manual theme persists, ignores OS changes, and safely returns to system mode', async () => {
  const page = themePage({ stored: 'light', dark: true });
  assert.equal(page.root.dataset.theme, 'light');
  await page.choose('dark');
  await page.system(false);
  assert.equal(page.root.dataset.theme, 'dark');
  assert.deepEqual(page.writes, [['dbpatch-theme', 'dark']]);
  await page.choose('system');
  assert.equal(page.root.dataset.theme, 'light');
  await page.storage('dark');
  assert.equal(page.root.dataset.theme, 'dark');
  const privatePage = themePage({ dark: true, blocked: true });
  assert.equal(privatePage.root.dataset.theme, 'dark');
  await privatePage.choose('light');
  assert.equal(privatePage.root.dataset.theme, 'light');
});
