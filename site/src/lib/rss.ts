import rss from '@astrojs/rss';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import { siteConfig } from '../config';
import { getPosts, type Post } from './content';
import { feedUrl, pathFor, postUrl, tagName, type Locale } from './i18n';

const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
const xml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]!));

/** Render the same Markdown as the site, without scripts or reader controls. */
function fullContent(post: Post): string {
  const articleUrl = new URL(postUrl(post), siteConfig.url);
  const context = post.data.context ? `<p>${xml(post.data.context)}</p>` : '';

  const absolute = (attributes: Record<string, string>, name: string): Record<string, string> => {
    const result = { ...attributes };
    if (result[name]) {
      try {
        result[name] = new URL(result[name], articleUrl).href;
      } catch {
        delete result[name];
      }
    }
    return result;
  };

  return sanitizeHtml(context + markdown.render(post.body ?? ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      code: ['class'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      ol: ['start'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attributes) => ({ tagName: 'a', attribs: absolute(attributes, 'href') }),
      img: (_tag, attributes) => ({ tagName: 'img', attribs: absolute(attributes, 'src') }),
    },
  });
}

/** Language and tag feeds share the exact publication rules used by page routes. */
export async function createFeed(locale: Locale, tag?: string): Promise<Response> {
  const posts = (await getPosts(locale)).filter((post) => !tag || post.data.tags.includes(tag));
  const language = locale === 'zh' ? 'zh-CN' : 'en';
  const title = `${siteConfig.name} · ${locale === 'zh' ? '中文' : 'English'}${tag ? ` · ${tagName(tag, locale)}` : ''}`;
  const url = new URL(feedUrl(locale, tag), siteConfig.url).href;
  const channelUrl = new URL(pathFor(locale, tag ? `tags/${tag}/` : ''), siteConfig.url).href;

  return rss({
    title,
    description: siteConfig.description[locale],
    site: channelUrl,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: `<language>${language}</language><atom:link href="${xml(url)}" rel="self" type="application/rss+xml"/>`,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: new Date(`${post.data.date}T00:00:00+08:00`),
      link: new URL(postUrl(post), siteConfig.url).href,
      categories: post.data.tags.map((id) => tagName(id, locale)),
      content: fullContent(post),
      customData: `<guid isPermaLink="false">${xml(`dbpatch:${locale}:${post.data.translationKey}`)}</guid>`,
    })),
  });
}
