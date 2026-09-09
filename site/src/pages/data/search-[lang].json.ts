import { getPosts } from '../../lib/content';
import { locales, postUrl, tagName, type Locale } from '../../lib/i18n';
export const getStaticPaths = () => locales.map(lang => ({ params: { lang } }));
export async function GET({ params }: { params: { lang: Locale } }) {
  const posts = await getPosts(params.lang);
  return new Response(JSON.stringify(posts.map(post => ({
    title: post.data.title,
    excerpt: post.data.excerpt,
    url: postUrl(post),
    tags: post.data.tags.map(tag => tagName(tag, params.lang)),
    text: (post.body || '').replace(/<[^>]*>/g, ' ').replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`#*_>]/g, '').replace(/\s+/g, ' ').trim(),
  }))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
