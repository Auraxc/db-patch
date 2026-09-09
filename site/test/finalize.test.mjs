import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { attributes, finalize, makeSecurityHeaders, noindexHtml, scriptHashes } from '../scripts/finalize.mjs';

test('hashes exact executable inline content, excluding external scripts and inert JSON-LD', () => {
  const code = '\nconsole.log("ready");\n';
  const expected = `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
  const html = `<script>${code}</script><script type="module">${code}</script><script src="/app.js"></script><script type="application/ld+json">{"name":"DB PATCH"}</script>`;
  assert.deepEqual(scriptHashes(html), [expected]);
});

test('CSP has no script wildcards or eval and no third-party script origin', () => {
  const headers = makeSecurityHeaders([]);
  assert.match(headers, /script-src 'self';/);
  assert.match(headers, /script-src-attr 'none'/);
  assert.match(headers, /style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(headers, /unsafe-eval|script-src[^;]*unsafe-inline/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.throws(() => makeSecurityHeaders(Array(100).fill("'sha256-testhash'")), /header-line limit/);
});

test('demo indexing override is idempotent and removes conflicting robots tags', () => {
  const html = '<html><head><meta content="index, follow" name="robots"><title>DB PATCH</title></head><body></body></html>';
  const output = noindexHtml(html);
  assert.equal(output, noindexHtml(output));
  assert.equal((output.match(/name="robots"/g) ?? []).length, 1);
  assert.match(output, /content="noindex, nofollow"/);
  assert.deepEqual(attributes('href="/a/" disabled data-x=plain'), { href: '/a/', disabled: '', 'data-x': 'plain' });
});

test('finalize produces Pages controls and removes demo sitemap destinations', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dbpatch-finalize-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'index.html'), '<html><head><title>DB PATCH</title></head><body></body></html>');
  await writeFile(path.join(directory, 'sitemap-0.xml'), '<?xml version="1.0"?><urlset><url><loc>https://db-patch.com/posts/sample/</loc></url></urlset>');
  await finalize(directory, { demo: true });
  assert.match(await readFile(path.join(directory, 'index.html'), 'utf8'), /noindex, nofollow/);
  assert.match(await readFile(path.join(directory, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
  assert.equal(await readFile(path.join(directory, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  assert.doesNotMatch(await readFile(path.join(directory, 'sitemap-0.xml'), 'utf8'), /<loc>/);
  assert.equal(await readFile(path.join(directory, '_redirects'), 'utf8'), 'https://www.db-patch.com/* https://db-patch.com/:splat 301\n');
});
