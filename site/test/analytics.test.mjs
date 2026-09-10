import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost, normalizePath, shanghaiDay, visitorDigest } from '../../functions/api/track.js';

const request = (body, headers = {}) => new Request('https://db-patch.com/api/track', {
  method: 'POST',
  headers: {
    Origin: 'https://db-patch.com',
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.8',
    'Sec-Fetch-Site': 'same-origin',
    ...headers,
  },
  body: JSON.stringify(body),
});

test('normalizes only local page paths', () => {
  assert.equal(normalizePath('/posts/a/?secret=x#part'), '/posts/a/');
  assert.equal(normalizePath('/posts//a/'), '/posts/a/');
  assert.equal(normalizePath('https://evil.example/x'), null);
  assert.equal(normalizePath('javascript:alert(1)'), null);
});

test('uses the Shanghai calendar day', () => {
  assert.equal(shanghaiDay(Date.parse('2026-09-08T16:30:00Z')), '2026-09-09');
});

test('daily HMAC is stable but changes by event or day', async () => {
  const a = await visitorDigest('test-secret', '2026-09-09\n203.0.113.8\npage_view\n/\n');
  const b = await visitorDigest('test-secret', '2026-09-09\n203.0.113.8\npage_view\n/\n');
  const c = await visitorDigest('test-secret', '2026-09-10\n203.0.113.8\npage_view\n/\n');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{32}$/);
});

test('stores one deduplication row without cookies or raw IP', async () => {
  const calls = [];
  const statement = { bind: (...values) => ({ run: async () => { calls.push(values); } }) };
  const result = await onRequestPost({
    request: request({ event: 'article_click', path: '/', target: '/posts/pg-wal-1tb/' }),
    env: { ANALYTICS_DB: { prepare: () => statement }, ANALYTICS_SALT: 'test-secret' },
  });
  assert.equal(result.status, 204);
  assert.equal(result.headers.get('Set-Cookie'), null);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(1, 4), ['article_click', '/posts/pg-wal-1tb/', '/posts/pg-wal-1tb/']);
  assert(!calls[0].includes('203.0.113.8'));
});

test('rejects cross-site, unknown, and incomplete events', async () => {
  const env = { ANALYTICS_DB: {}, ANALYTICS_SALT: 'test-secret' };
  assert.equal((await onRequestPost({ request: request({ event: 'page_view', path: '/' }, { Origin: 'https://evil.example' }), env })).status, 403);
  assert.equal((await onRequestPost({ request: request({ event: 'unknown', path: '/' }), env })).status, 400);
  assert.equal((await onRequestPost({ request: request({ event: 'article_click', path: '/' }), env })).status, 400);
});
