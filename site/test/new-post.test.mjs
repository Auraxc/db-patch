import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDraft, draftSource, parseArguments, shanghaiDate } from '../scripts/new-post.mjs';

const options = { lang: 'zh', slug: 'postgres-notes', title: 'PostgreSQL 实践笔记', translationKey: 'postgres-notes' };

test('uses the Asia/Shanghai publication day', () => {
  assert.equal(shanghaiDate(new Date('2026-09-08T15:59:59Z')), '2026-09-08');
  assert.equal(shanghaiDate(new Date('2026-09-08T16:00:00Z')), '2026-09-09');
});

test('same arguments and date produce an identical unpublished Markdown template', () => {
  const args = { ...options, date: '2026-09-09' };
  const source = draftSource(args);
  assert.equal(source, draftSource(args, new Date('2030-01-01')));
  assert.match(source, /^---\ntitle: "PostgreSQL 实践笔记"/);
  assert.match(source, /draft: true\nsample: false\nfeatured: false/);
  assert.match(source, /date: "2026-09-09"/);
  assert.match(source, /translationKey: "postgres-notes"/);
});

test('English template has the same translation key without Chinese placeholder text', () => {
  const source = draftSource({ ...options, lang: 'en', title: 'PostgreSQL notes' });
  assert.match(source, /lang: en/);
  assert.match(source, /## Investigation/);
  assert.doesNotMatch(source, /\p{Script=Han}/u);
});

test('rejects traversal, invalid language, dates, and multiline titles', () => {
  for (const slug of ['../secrets', '/tmp/post', 'a/b', '.', '..', 'a\\b', 'a--b', 'UPPER', 'a%2fb']) {
    assert.throws(() => draftSource({ ...options, slug }), /--slug/);
  }
  assert.throws(() => draftSource({ ...options, lang: '../en' }), /--lang/);
  assert.throws(() => draftSource({ ...options, date: '2026-02-30' }), /--date/);
  assert.throws(() => draftSource({ ...options, title: 'title\ndraft: false' }), /--title/);
});

test('parses only known, nonduplicate options', () => {
  assert.deepEqual(parseArguments(['--lang', 'en', '--slug', 'hello', '--title', 'Hello world']), { lang: 'en', slug: 'hello', title: 'Hello world' });
  assert.throws(() => parseArguments(['--output', '/tmp/post']), /Unknown/);
  assert.throws(() => parseArguments(['--lang']), /Missing/);
  assert.throws(() => parseArguments(['--translation-key', 'a', '--translation-key', 'b']), /Duplicate/);
  assert.deepEqual(parseArguments(['--help']), { help: true });
});

test('draft creation never overwrites existing content', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dbpatch-draft-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = await createDraft(options, directory, new Date('2026-09-09T00:00:00Z'));
  const source = await readFile(filename, 'utf8');
  await assert.rejects(createDraft({ ...options, title: 'Replacement' }, directory), /Refusing to overwrite/);
  assert.equal(await readFile(filename, 'utf8'), source);
});

test('refuses a language directory redirected outside the content tree', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dbpatch-symlink-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'posts');
  const outside = path.join(directory, 'outside');
  await Promise.all([mkdir(root), mkdir(outside)]);
  await symlink(outside, path.join(root, 'zh'), 'dir');
  await assert.rejects(createDraft(options, root), /must not redirect/);
});
