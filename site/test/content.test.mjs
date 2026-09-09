import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'astro/zod';
import rss from '@astrojs/rss';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const root = new URL('../', import.meta.url);
const esmDefault = (value) => ({ __esModule: true, default: value });
const now = Date.parse('2026-09-09T00:00:00Z');

/** Run the real TypeScript modules with only Astro's virtual collection mocked. */
function moduleUnderTest(filename, dependencies = {}, options = {}) {
  const source = readFileSync(new URL(filename, root), 'utf8')
    .replaceAll('import.meta.env.DEV', '__environment.dev')
    .replaceAll('import.meta.env.DBPATCH_INCLUDE_DEMOS', '__environment.demo');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  class TestDate extends Date { static now() { return options.now ?? now; } }
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert(Object.hasOwn(dependencies, name), `Unexpected module dependency: ${name}`);
      return dependencies[name];
    },
    __environment: { dev: options.dev ?? false, demo: options.demo ? 'true' : 'false' },
    process: { env: { DBPATCH_INCLUDE_DEMOS: options.processDemo ? 'true' : 'false' } },
    URL,
    Date: TestDate,
  }, { filename });
  return exports;
}

const i18n = moduleUnderTest('src/lib/i18n.ts');
const config = moduleUnderTest('src/config.ts');
const { collections } = moduleUnderTest('src/content.config.ts', {
  'astro:content': { defineCollection: (definition) => definition },
  'astro/loaders': { glob: (options) => options },
  'astro/zod': { z },
  './lib/i18n': i18n,
});

function post(overrides = {}) {
  const data = {
    title: 'A technical note', date: '2026-09-01', excerpt: 'A short description.',
    slug: 'technical-note', translationKey: 'technical-note', lang: 'zh',
    tags: ['postgresql'], draft: false, sample: false, featured: false,
    ...overrides,
  };
  return { id: `${data.lang}/${data.slug}`, collection: 'posts', data, body: '## Findings\n\nA useful note.' };
}

function contentModule(posts, options = {}) {
  return moduleUnderTest('src/lib/content.ts', {
    'astro:content': { getCollection: async (name) => { assert.equal(name, 'posts'); return posts; } },
  }, options);
}

function rssModule(content) {
  return moduleUnderTest('src/lib/rss.ts', {
    '@astrojs/rss': esmDefault(rss),
    'markdown-it': esmDefault(MarkdownIt),
    'sanitize-html': esmDefault(sanitizeHtml),
    '../config': config,
    './content': content,
    './i18n': i18n,
  });
}

function migratedPosts() {
  // Check the shipped examples only; publishing a new article must not change these fixtures.
  const slugs = ['postgres-explain', 'backup-restore', 'ai-sql-review', 'connection-pool', 'replication-lag', 'a-place-to-write'];
  return ['zh', 'en'].flatMap((locale) => slugs.map((slug) => {
      const filename = `${slug}.md`;
      const source = readFileSync(new URL(`src/content/posts/${locale}/${filename}`, root), 'utf8');
      const [, frontmatter, body] = source.split(/^---\s*$/m);
      // The migrated fixtures deliberately use JSON-compatible YAML scalars.
      const data = Object.fromEntries(frontmatter.trim().split('\n').map((line) => {
        const separator = line.indexOf(':');
        return [line.slice(0, separator), JSON.parse(line.slice(separator + 1).trim())];
      }));
      return { id: `${locale}/${filename.slice(0, -3)}`, collection: 'posts', data, body };
    }));
}

test('schema defaults to an unpublished draft and rejects invalid metadata', () => {
  const schema = collections.posts.schema;
  const { draft, sample, featured, ...input } = post().data;
  const defaults = schema.parse(input);
  assert.equal(defaults.draft, true);
  assert.equal(defaults.sample, false);
  assert.equal(defaults.featured, false);
  for (const changes of [
    { date: '2026-02-30' }, { date: '2026-9-1' }, { updated: '2026-08-31' },
    { slug: '../escape' }, { tags: ['unknown'] }, { tags: ['postgresql', 'postgresql'] },
    { lang: 'fr' }, { unexpected: 'field' },
  ]) assert.equal(schema.safeParse({ ...input, ...changes }).success, false, JSON.stringify(changes));
});

test('loader IDs retain language and reject a language/directory mismatch', () => {
  const id = collections.posts.loader.generateId;
  assert.equal(id({ entry: 'zh/technical-note.md', data: { lang: 'zh' } }), 'zh/technical-note');
  assert.equal(id({ entry: 'en/technical-note.md', data: { lang: 'en' } }), 'en/technical-note');
  assert.equal(id({ entry: 'en\\nested\\note.md', data: { lang: 'en' } }), 'en/nested/note');
  for (const [entry, lang] of [['zh/note.md', 'en'], ['en/note.md', 'zh'], ['fr/note.md', 'fr'], ['note.md', 'zh']]) {
    assert.throws(() => id({ entry, data: { lang } }), /lang must match/);
  }
});

test('production filters drafts, future posts, and samples in every locale', async () => {
  const posts = [
    post(), post({ lang: 'en' }), post({ slug: 'draft', translationKey: 'draft', draft: true }),
    post({ slug: 'future', translationKey: 'future', date: '2026-09-10' }),
    post({ slug: 'sample', translationKey: 'sample', sample: true }),
  ];
  const content = contentModule(posts);
  assert.equal(content.isDemo, false);
  assert.deepEqual(Array.from(await content.getPosts(), (entry) => entry.id), ['en/technical-note', 'zh/technical-note']);
  assert.deepEqual(Array.from(await content.getPosts('zh'), (entry) => entry.id), ['zh/technical-note']);
  assert.deepEqual(Array.from(await content.getPosts('en'), (entry) => entry.id), ['en/technical-note']);
});

test('demo and development include samples without admitting drafts or future posts', async () => {
  const posts = [
    post({ sample: true }),
    post({ slug: 'draft', translationKey: 'draft', sample: true, draft: true }),
    post({ slug: 'future', translationKey: 'future', sample: true, date: '2026-09-10' }),
  ];
  for (const options of [{ dev: true }, { demo: true }, { processDemo: true }]) {
    const content = contentModule(posts, options);
    assert.equal(content.isDemo, true);
    assert.deepEqual(Array.from(await content.getPosts(), (entry) => entry.id), ['zh/technical-note']);
  }
});

test('publication dates use the Asia/Shanghai day boundary', async () => {
  const posts = [post({ date: '2026-09-09' })];
  assert.equal((await contentModule(posts, { now: Date.parse('2026-09-08T15:59:59Z') }).getPosts()).length, 0);
  assert.equal((await contentModule(posts, { now: Date.parse('2026-09-08T16:00:00Z') }).getPosts()).length, 1);
});

test('translations can share identities, but duplicate identities within a locale fail', async () => {
  assert.equal((await contentModule([post(), post({ lang: 'en' })]).getPosts()).length, 2);
  await assert.rejects(contentModule([post(), post({ translationKey: 'different' })]).getPosts(), /Duplicate slug/);
  await assert.rejects(contentModule([post(), post({ slug: 'different', draft: true })]).getPosts(), /Duplicate translationKey/);
});

test('all twelve migrated samples have real headings, source links, and readable code', () => {
  const posts = migratedPosts();
  assert.equal(posts.length, 12);
  const content = contentModule(posts, { demo: true });
  const markdown = new MarkdownIt({ html: false });
  for (const entry of posts) {
    collections.posts.schema.parse(entry.data);
    assert.equal(entry.data.sample, true);
    assert.equal(entry.data.draft, false);
    assert(entry.body.includes('## '));
    assert(!/<\/?(?:div|button|svg|pre|p)\b/.test(entry.body));
    assert(!markdown.render(entry.body).includes('**'));
    assert(Number.isInteger(content.readingMinutes(entry)) && content.readingMinutes(entry) > 0);
    if (['postgres-explain', 'backup-restore', 'replication-lag'].includes(entry.data.slug)) {
      assert(entry.body.includes('https://www.postgresql.org/docs/16/'));
    }
  }
  assert.equal(posts.reduce((total, entry) => total + (entry.body.match(/^```(?:sql|text)$/gm) ?? []).length, 0), 6);
});

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true });
const itemsOf = (channel) => !channel.item ? [] : Array.isArray(channel.item) ? channel.item : [channel.item];

test('fourteen full-text feeds are valid and strictly separated by language and tag', async () => {
  const posts = migratedPosts();
  const feeds = rssModule(contentModule(posts, { demo: true }));
  for (const locale of i18n.locales) {
    for (const tag of [undefined, ...i18n.tags.map((entry) => entry.id)]) {
      const response = await feeds.createFeed(locale, tag);
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert.equal(XMLValidator.validate(xml), true);
      const channel = parser.parse(xml).rss.channel;
      const items = itemsOf(channel);
      const expected = posts.filter((entry) => entry.data.lang === locale && (!tag || entry.data.tags.includes(tag)));
      assert.equal(channel.language, locale === 'en' ? 'en' : 'zh-CN');
      assert.equal(channel['atom:link']['@_href'], new URL(i18n.feedUrl(locale, tag), config.siteConfig.url).href);
      assert.equal(items.length, expected.length);
      assert.equal((xml.match(/<guid /g) ?? []).length, expected.length);
      assert.deepEqual(items.map((item) => item.guid['#text']).sort(), expected.map((entry) => `dbpatch:${locale}:${entry.data.translationKey}`).sort());
      for (const entry of expected) {
        const item = items.find((candidate) => candidate.title === entry.data.title);
        assert(item);
        assert.equal(item.link, new URL(i18n.postUrl(entry), config.siteConfig.url).href);
        assert.equal(item.description, entry.data.excerpt);
        assert(item['content:encoded'].includes('<h2>'));
        assert(!/<button\b|<svg\b/.test(item['content:encoded']));
        if (locale === 'en') assert(!/[\u3400-\u9fff]/u.test(item['content:encoded']));
      }
    }
  }
});

test('RSS applies production filters and sanitizes full-text links and HTML', async () => {
  const visible = post();
  visible.body = '[Relative](../other/) ![Diagram](/images/chart.png) [Unsafe](javascript:alert(1))\n\n<script>alert(1)</script>\n\n```sql\nSELECT 1;\n```';
  const feeds = rssModule(contentModule([
    visible,
    post({ slug: 'sample', translationKey: 'sample', sample: true }),
    post({ slug: 'draft', translationKey: 'draft', draft: true }),
    post({ slug: 'future', translationKey: 'future', date: '2026-09-10' }),
    post({ lang: 'en' }),
  ]));
  const xml = await (await feeds.createFeed('zh', 'postgresql')).text();
  assert.equal(XMLValidator.validate(xml), true);
  const items = itemsOf(parser.parse(xml).rss.channel);
  assert.equal(items.length, 1);
  const html = items[0]['content:encoded'];
  assert(html.includes('href="https://db-patch.com/posts/other/"'));
  assert(html.includes('src="https://db-patch.com/images/chart.png"'));
  assert(!/<script\b|href="javascript:|onerror=/i.test(html));
  assert(html.includes('SELECT 1;'));
});
