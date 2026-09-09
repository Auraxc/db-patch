import test from 'node:test';
import assert from 'node:assert/strict';
import { pathnameForFile, publicationURLs, validateXML } from '../scripts/verify.mjs';
import { remarkSafeContent } from '../scripts/markdown-safety.mjs';

test('static output filenames map to canonical trailing-slash routes', () => {
  assert.equal(pathnameForFile('index.html'), '/');
  assert.equal(pathnameForFile('en/posts/postgres-notes/index.html'), '/en/posts/postgres-notes/');
  assert.equal(pathnameForFile('404.html'), '/404.html');
});

test('validates RSS syntax rather than matching XML with a regular expression', () => {
  const document = validateXML('<?xml version="1.0"?><rss version="2.0"><channel><language>zh-CN</language><title>A &amp; B</title></channel></rss>', 'rss.xml');
  assert.equal(document.rss.channel.title, 'A & B');
  assert.throws(() => validateXML('<rss><channel></rss>', 'broken.xml'), /invalid XML/);
  assert.throws(() => validateXML('<!DOCTYPE rss SYSTEM "https://example.com/evil.dtd"><rss/>', 'xxe.xml'), /doctypes/);
});

test('Markdown content cannot inject raw HTML or script URL schemes', () => {
  const transform = remarkSafeContent();
  const tree = { type: 'root', children: [{ type: 'html', value: '<script>alert(1)</script>' }, { type: 'paragraph', children: [{ type: 'text', value: 'Safe text' }] }] };
  transform(tree);
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].type, 'paragraph');
  assert.throws(() => transform({ type: 'root', children: [{ type: 'link', url: 'javascript:alert(1)' }] }), /Unsupported Markdown URL/);
  assert.doesNotThrow(() => transform({ type: 'root', children: [{ type: 'link', url: 'https://www.postgresql.org/docs/' }] }));
});

test('production publication excludes samples, drafts, and future articles', () => {
  const posts = [
    { lang: 'zh', slug: 'published', draft: false, date: '2026-09-09' },
    { lang: 'en', slug: 'published', draft: false, date: '2026-09-09' },
    { lang: 'zh', slug: 'sample', draft: false, sample: true, date: '2026-09-01' },
    { lang: 'zh', slug: 'draft', draft: true, date: '2026-09-01' },
    { lang: 'zh', slug: 'default-draft', date: '2026-09-01' },
    { lang: 'zh', slug: 'future', draft: false, date: '2026-09-10' },
  ];
  assert.deepEqual(publicationURLs(posts, { today: '2026-09-09' }), [
    'https://db-patch.com/en/posts/published/',
    'https://db-patch.com/posts/published/',
  ]);
  assert.deepEqual(publicationURLs(posts, { today: '2026-09-09', demo: true }), [
    'https://db-patch.com/en/posts/published/',
    'https://db-patch.com/posts/published/',
    'https://db-patch.com/posts/sample/',
  ]);
});
