import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { parse as parseYAML } from 'yaml';
import { attributes, listFiles, scriptHashes, siteOrigin } from './finalize.mjs';

const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));
const defaultContent = fileURLToPath(new URL('../src/content/posts/', import.meta.url));
const tagNames = {
  postgresql: ['PostgreSQL', 'PostgreSQL'],
  operations: ['数据库运维', 'Database operations'],
  backend: ['后端', 'Backend'],
  ai: ['AI', 'AI'],
  'query-optimization': ['查询优化', 'Query optimization'],
  notes: ['随记', 'Field notes'],
};
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, processEntities: true });
const array = (value) => value === undefined || value === '' ? [] : Array.isArray(value) ? value : [value];
const nodeText = (value) => typeof value === 'object' && value !== null ? value['#text'] ?? '' : value ?? '';
const decode = (value) => String(value).replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
  if (entity.startsWith('&#')) return String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10));
  return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[entity.toLowerCase()] ?? entity;
});
const plainText = (html) => decode(html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ')).trim();

export function pathnameForFile(relative) {
  const portable = relative.split(path.sep).join('/');
  if (portable === 'index.html') return '/';
  if (portable.endsWith('/index.html')) return `/${portable.slice(0, -10)}`;
  return `/${portable}`;
}

export function validateXML(source, label) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${label}: external entities and doctypes are not allowed.`);
  const validation = XMLValidator.validate(source);
  if (validation !== true) throw new Error(`${label}: invalid XML: ${validation.err.msg}`);
  return parser.parse(source);
}

/** Independently reconcile the generated output against the Markdown publication flags. */
export function publicationURLs(posts, { demo = false, today } = {}) {
  const publicationDay = today ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return posts.filter((post) => post.draft === false && post.date <= publicationDay && (demo || post.sample !== true))
    .map((post) => `${siteOrigin}/${post.lang === 'en' ? 'en/' : ''}posts/${post.slug}/`).sort();
}

export async function verify(dist = defaultDist, { demo = process.env.DBPATCH_INCLUDE_DEMOS === 'true', content = defaultContent } = {}) {
  const files = await listFiles(dist);
  const relativeFiles = new Set(files.map((filename) => path.relative(dist, filename).split(path.sep).join('/')));
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  const read = (relative) => readFile(path.join(dist, relative), 'utf8');
  const htmlByPath = new Map();
  const alternatesByPath = new Map();
  const postTitles = new Map();
  let headers = '';

  const required = ['index.html', '404.html', 'rss.xml', 'en/index.html', 'en/rss.xml', 'data/search-zh.json', 'data/search-en.json', 'robots.txt', 'sitemap-index.xml', '_headers', '_redirects'];
  for (const prefix of ['', 'en/']) {
    for (const page of ['articles', 'tags', 'about', 'subscribe']) required.push(`${prefix}${page}/index.html`);
    for (const tag of Object.keys(tagNames)) required.push(`${prefix}tags/${tag}/index.html`, `${prefix}tags/${tag}/rss.xml`);
  }
  required.forEach((filename) => check(relativeFiles.has(filename), `Missing required output: ${filename}`));
  if (relativeFiles.has('_headers')) headers = await read('_headers');
  check(/script-src 'self'(?:;| )/.test(headers), 'CSP must restrict scripts to this site.');
  check(!/script-src[^;\n]*'unsafe-inline'|'unsafe-eval'/.test(headers), 'CSP must not allow inline script wildcards or eval.');
  check(/script-src-attr 'none'/.test(headers), 'CSP must disable HTML event handlers.');
  if (relativeFiles.has('robots.txt')) {
    const robots = await read('robots.txt');
    check(demo ? /Disallow: \/(?:\n|$)/.test(robots) : robots.includes(`Sitemap: ${siteOrigin}/sitemap-index.xml`), 'robots.txt does not match the build publication mode.');
  }

  function targetFor(value, currentPath, label) {
    if (!value || /^(?:mailto:|tel:|data:)/i.test(value)) return null;
    if (/^(?:javascript:|vbscript:|file:)/i.test(value.trim())) { errors.push(`${label}: unsafe URL ${value}`); return null; }
    let url;
    try { url = new URL(decode(value), new URL(currentPath, siteOrigin)); }
    catch { errors.push(`${label}: invalid URL ${value}`); return null; }
    if (url.origin !== siteOrigin) return null;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { errors.push(`${label}: invalid URL encoding ${value}`); return null; }
    const relative = pathname.replace(/^\//, '');
    const candidates = pathname.endsWith('/') ? [`${relative}index.html`] : [relative, `${relative}/index.html`];
    const resolved = candidates.find((candidate) => relativeFiles.has(candidate));
    check(Boolean(resolved), `${label}: broken internal URL ${value}`);
    return resolved;
  }

  for (const filename of files.filter((name) => name.endsWith('.html'))) {
    const relative = path.relative(dist, filename).split(path.sep).join('/');
    const pathname = pathnameForFile(relative);
    const html = await readFile(filename, 'utf8');
    htmlByPath.set(pathname, html);
    const en = pathname.startsWith('/en/');
    const language = en ? 'en' : 'zh-CN';
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
    check(Boolean(head), `${relative}: missing static document head.`);
    const lang = attributes(html.match(/<html\b([^>]*)>/i)?.[1] ?? '').lang;
    check(lang === language, `${relative}: html lang should be ${language}, got ${lang}.`);
    check(!/(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?|file:\/\/|\/designs\/db-patch\/|\/db-patch\/(?:v[12]\/)?(?:index|article|articles|tags|about)\.html)/i.test(html), `${relative}: prototype/local URL leaked into the build.`);
    const tags = [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)].map((match) => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }));
    for (const { name, attrs } of tags) {
      for (const attribute of Object.keys(attrs)) check(!/^on[a-z]+$/.test(attribute), `${relative}: inline event attribute ${attribute} is forbidden.`);
      for (const attribute of ['href', 'src', 'poster', 'action']) {
        if (attrs[attribute]) targetFor(attrs[attribute], pathname, `${relative} ${name}[${attribute}]`);
      }
      if (attrs.srcset && !attrs.srcset.startsWith('data:')) {
        attrs.srcset.split(',').forEach((entry) => targetFor(entry.trim().split(/\s+/)[0], pathname, `${relative} srcset`));
      }
      if (name === 'script' && attrs.src) {
        check(new URL(decode(attrs.src), new URL(pathname, siteOrigin)).origin === siteOrigin, `${relative}: third-party JavaScript is forbidden.`);
      }
    }
    const links = tags.filter((tag) => tag.name === 'link').map((tag) => tag.attrs);
    const canonicals = links.filter((link) => link.rel === 'canonical');
    check(canonicals.length === 1 && decode(canonicals[0].href) === `${siteOrigin}${pathname}`, `${relative}: canonical must equal ${siteOrigin}${pathname}.`);
    const alternates = links.filter((link) => link.rel === 'alternate' && link.hreflang);
    alternatesByPath.set(pathname, alternates);
    if (relative !== '404.html') {
      check(alternates.some((link) => link.hreflang === language && decode(link.href) === `${siteOrigin}${pathname}`), `${relative}: missing self hreflang.`);
      check(new Set(alternates.map((link) => link.hreflang)).size === alternates.length, `${relative}: duplicate hreflang language.`);
      check(links.some((link) => link.type === 'application/rss+xml' && new URL(decode(link.href), siteOrigin).pathname.startsWith(en ? '/en/' : '/') && (en || !new URL(decode(link.href), siteOrigin).pathname.startsWith('/en/'))), `${relative}: missing locale-specific RSS autodiscovery.`);
    }
    if (demo || relative === '404.html') {
      check(tags.some((tag) => tag.name === 'meta' && tag.attrs.name === 'robots' && /noindex/.test(tag.attrs.content ?? '')), `${relative}: must declare noindex.`);
    }
    for (const hash of scriptHashes(html)) check(headers.includes(hash), `${relative}: executable inline script is missing its CSP hash.`);
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      if (attributes(match[1]).type === 'application/ld+json') {
        try { JSON.parse(match[2]); } catch { errors.push(`${relative}: invalid JSON-LD.`); }
      }
    }
    if (/^\/(?:en\/)?posts\/[^/]+\/$/.test(pathname)) {
      const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? '';
      const title = plainText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
      check(Boolean(title), `${relative}: article title is not server-rendered.`);
      check(plainText(article).length > 40 && /<(?:p|pre|ul|ol)\b/.test(article), `${relative}: readable article content must exist without JavaScript.`);
      postTitles.set(`${siteOrigin}${pathname}`, title);
    }
  }

  for (const [pathname, alternates] of alternatesByPath) {
    for (const alternate of alternates) {
      const url = new URL(decode(alternate.href), siteOrigin);
      if (url.origin !== siteOrigin) { errors.push(`${pathname}: hreflang must use the production domain.`); continue; }
      const otherHTML = htmlByPath.get(url.pathname);
      check(Boolean(otherHTML), `${pathname}: hreflang points to a page that was not generated: ${url.pathname}`);
      const expected = alternate.hreflang;
      if (otherHTML && expected !== 'x-default') check(attributes(otherHTML.match(/<html\b([^>]*)>/i)?.[1] ?? '').lang === expected, `${pathname}: hreflang does not match target language.`);
      check((alternatesByPath.get(url.pathname) ?? []).some((link) => decode(link.href) === `${siteOrigin}${pathname}`), `${pathname}: hreflang is not reciprocal with ${url.pathname}.`);
    }
  }

  try {
    const markdownFiles = (await listFiles(content)).filter((filename) => filename.endsWith('.md'));
    const sources = await Promise.all(markdownFiles.map(async (filename) => {
      const source = await readFile(filename, 'utf8');
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
      if (!frontmatter) throw new Error(`Missing YAML frontmatter: ${filename}`);
      return parseYAML(frontmatter);
    }));
    const expected = publicationURLs(sources, { demo });
    check(JSON.stringify([...postTitles.keys()].sort()) === JSON.stringify(expected), `Markdown publication flags disagree with the ${demo ? 'demo' : 'production'} output; sample, draft, or future articles may have leaked or published articles may be missing.`);
  } catch (error) { errors.push(`Cannot verify source publication rules: ${error.message}`); }

  const feeds = new Map();
  for (const filename of files.filter((name) => name.endsWith('.xml'))) {
    const relative = path.relative(dist, filename).split(path.sep).join('/');
    let document;
    try { document = validateXML(await readFile(filename, 'utf8'), relative); }
    catch (error) { errors.push(error.message); continue; }
    if (relative.endsWith('rss.xml')) {
      const channel = document.rss?.channel;
      check(Boolean(channel), `${relative}: missing RSS channel.`);
      if (!channel) continue;
      const en = relative.startsWith('en/');
      const locale = en ? 'en' : 'zh';
      check(channel.language === (en ? 'en' : 'zh-CN'), `${relative}: incorrect feed language.`);
      const self = array(channel['atom:link']).find((link) => link['@_rel'] === 'self');
      check(self?.['@_href'] === `${siteOrigin}/${relative}`, `${relative}: incorrect feed self URL.`);
      const items = array(channel.item);
      const guids = new Set();
      for (const item of items) {
        const link = nodeText(item.link);
        const expectedPrefix = `${siteOrigin}/${en ? 'en/' : ''}posts/`;
        check(typeof link === 'string' && link.startsWith(expectedPrefix), `${relative}: article link mixes languages or domains: ${link}`);
        targetFor(link, `/${relative}`, `${relative} item link`);
        const guid = nodeText(item.guid);
        check(typeof guid === 'string' && guid.startsWith(`dbpatch:${locale}:`), `${relative}: missing language-specific GUID.`);
        check(!guids.has(guid), `${relative}: duplicate article GUID ${guid}`);
        guids.add(guid);
        check(postTitles.get(link) === nodeText(item.title), `${relative}: feed title does not match the static article: ${link}`);
        const content = nodeText(item['content:encoded']);
        check(typeof content === 'string' && plainText(content).length > 20, `${relative}: missing full article content.`);
        check(!/<script\b|\son[a-z]+\s*=|javascript:/i.test(content), `${relative}: unsafe feed HTML.`);
        for (const match of String(content).matchAll(/(?:href|src)=["']([^"']+)["']/gi)) {
          check(/^(?:https?:\/\/|mailto:)/i.test(match[1]), `${relative}: feed content URL must be absolute: ${match[1]}`);
          targetFor(match[1], `/${relative}`, `${relative} content URL`);
        }
      }
      feeds.set(relative, items);
    }
    for (const location of [...array(document.urlset?.url), ...array(document.sitemapindex?.sitemap)]) {
      const value = nodeText(location.loc);
      check(typeof value === 'string' && value.startsWith(`${siteOrigin}/`), `${relative}: sitemap URL must use the production domain.`);
      targetFor(value, `/${relative}`, `${relative} sitemap URL`);
      check(!/\/404(?:\.html|\/)/.test(value), `${relative}: 404 page must not appear in the sitemap.`);
      if (demo) errors.push(`${relative}: demo sitemap must not advertise sample URLs.`);
    }
  }

  for (const [index, locale] of ['zh', 'en'].entries()) {
    const prefix = locale === 'en' ? 'en/' : '';
    const globalItems = feeds.get(`${prefix}rss.xml`) ?? [];
    const links = globalItems.map((item) => nodeText(item.link)).sort();
    const articleLinks = [...postTitles.keys()].filter((url) => url.startsWith(`${siteOrigin}/${prefix}posts/`)).sort();
    check(JSON.stringify(links) === JSON.stringify(articleLinks), `${locale}: articles and global RSS disagree.`);
    for (const [tag, names] of Object.entries(tagNames)) {
      const filtered = (feeds.get(`${prefix}tags/${tag}/rss.xml`) ?? []).map((item) => nodeText(item.link)).sort();
      const expected = globalItems.filter((item) => array(item.category).map(nodeText).includes(names[index])).map((item) => nodeText(item.link)).sort();
      check(JSON.stringify(filtered) === JSON.stringify(expected), `${locale}/${tag}: tag RSS differs from the corresponding articles.`);
    }
    if (relativeFiles.has(`data/search-${locale}.json`)) {
      try {
        const document = JSON.parse(await read(`data/search-${locale}.json`));
        const posts = Array.isArray(document) ? document : document.posts;
        check(Array.isArray(posts), `${locale}: search index must contain an array.`);
        if (Array.isArray(posts)) {
          const searchLinks = posts.map((post) => new URL(post.url ?? post.href, siteOrigin).href).sort();
          check(JSON.stringify(searchLinks) === JSON.stringify(links), `${locale}: search index and RSS disagree.`);
          for (const post of posts) check(!post.lang || post.lang === locale, `${locale}: search entry uses the wrong language.`);
        }
      } catch (error) { errors.push(`${locale}: invalid search index: ${error.message}`); }
    }
  }

  for (const filename of files.filter((name) => name.endsWith('.css'))) {
    const relative = path.relative(dist, filename).split(path.sep).join('/');
    const source = await readFile(filename, 'utf8');
    for (const match of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) targetFor(match[1], `/${relative}`, relative);
  }
  if (errors.length) throw new Error(`Static build verification failed (${errors.length}):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  console.log(`Verified ${htmlByPath.size} static HTML pages, ${postTitles.size} readable articles, ${feeds.size} language/tag RSS feeds, and all local links.`);
  return { pages: htmlByPath.size, articles: postTitles.size, feeds: feeds.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verify().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
