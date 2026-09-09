import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const siteOrigin = 'https://db-patch.com';
const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));
const executableTypes = new Set(['', 'module', 'text/javascript', 'application/javascript', 'application/ecmascript', 'text/ecmascript']);

export async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build output must not contain symlinks: ${filename}`);
    return entry.isDirectory() ? listFiles(filename) : [filename];
  }));
  return nested.flat().sort();
}

export function attributes(source) {
  const result = {};
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

/** JSON-LD is an inert data block, not an executable inline script. */
export function scriptHashes(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = attributes(match[1]);
    if ('src' in attrs || !executableTypes.has((attrs.type ?? '').toLowerCase())) continue;
    if (match[2].trim()) hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  }
  return [...hashes].sort();
}

export function makeSecurityHeaders(hashes, demo = false) {
  const csp = [
    "default-src 'self'",
    `script-src 'self'${hashes.length ? ` ${hashes.join(' ')}` : ''}`,
    "script-src-attr 'none'",
    // Shiki's per-token colors and the reader's font-size control use inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
  if (`Content-Security-Policy: ${csp}`.length > 2000) {
    throw new Error('CSP exceeds the Cloudflare Pages header-line limit. Move executable inline JavaScript into shared local files.');
  }
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Strict-Transport-Security: max-age=31536000',
    '  Cache-Control: public, max-age=0, must-revalidate',
    ...(demo ? ['  X-Robots-Tag: noindex, nofollow'] : []),
    '',
    '/_astro/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/404.html',
    '  X-Robots-Tag: noindex',
    '',
  ].join('\n');
}

export function noindexHtml(html) {
  const withoutRobots = html.replace(/<meta\b[^>]*>/gi, (tag) => {
    const attrs = attributes(tag.slice(5, -1));
    return attrs.name?.toLowerCase() === 'robots' ? '' : tag;
  });
  return withoutRobots.replace(/<\/head\s*>/i, '<meta name="robots" content="noindex, nofollow"></head>');
}

export async function finalize(dist = defaultDist, { demo = process.env.DBPATCH_INCLUDE_DEMOS === 'true' } = {}) {
  const files = await listFiles(dist);
  const htmlFiles = files.filter((filename) => filename.endsWith('.html'));
  if (!htmlFiles.length) throw new Error(`No HTML files in ${dist}; run astro build first.`);
  const hashes = new Set();
  for (const filename of htmlFiles) {
    const source = await readFile(filename, 'utf8');
    const html = demo ? noindexHtml(source) : source;
    scriptHashes(html).forEach((hash) => hashes.add(hash));
    if (html !== source) await writeFile(filename, html);
  }
  if (demo) {
    for (const filename of files.filter((name) => /(?:^|\/)sitemap[^/]*\.xml$/.test(name))) {
      const source = await readFile(filename, 'utf8');
      const root = /<sitemapindex\b/.test(source) ? 'sitemapindex' : 'urlset';
      await writeFile(filename, `<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></${root}>\n`);
    }
  }
  await writeFile(path.join(dist, '_headers'), makeSecurityHeaders([...hashes].sort(), demo));
  // No SPA fallback: unknown URLs must retain a real HTTP 404 response.
  await writeFile(path.join(dist, '_redirects'), `https://www.db-patch.com/* ${siteOrigin}/:splat 301\n`);
  await writeFile(path.join(dist, 'robots.txt'), demo
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap-index.xml\n`);
  console.log(`Finalized ${htmlFiles.length} pages (${demo ? 'noindex demo' : 'production'}), ${hashes.size} executable inline script hashes.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  finalize().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
