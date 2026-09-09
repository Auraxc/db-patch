import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from './i18n';

export type Post = CollectionEntry<'posts'>;

/** Samples appear during development, or in an explicitly requested demo build. */
export const isDemo = import.meta.env.DEV
  || import.meta.env.DBPATCH_INCLUDE_DEMOS === 'true'
  || process.env.DBPATCH_INCLUDE_DEMOS === 'true';

function checkUniquePosts(posts: Post[]): void {
  const slugs = new Map<string, string>();
  const translations = new Map<string, string>();

  for (const post of posts) {
    for (const [value, field, seen] of [
      [post.data.slug, 'slug', slugs],
      [post.data.translationKey, 'translationKey', translations],
    ] as const) {
      const key = `${post.data.lang}:${value}`;
      const previous = seen.get(key);
      if (previous !== undefined) {
        throw new Error(`Duplicate ${field} "${value}" for ${post.data.lang}: ${previous} and ${post.id}.`);
      }
      seen.set(key, post.id);
    }
  }
}

/** The single publication filter used by pages, feeds, and search output. */
export async function getPosts(locale?: Locale): Promise<Post[]> {
  const posts = await getCollection('posts');
  checkUniquePosts(posts);

  // YYYY-MM-DD strings sort chronologically; publishing follows Asia/Shanghai.
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return posts
    .filter((post) => (!locale || post.data.lang === locale)
      && !post.data.draft
      && post.data.date <= today
      && (isDemo || !post.data.sample))
    .sort((a, b) => b.data.date.localeCompare(a.data.date)
      || a.data.lang.localeCompare(b.data.lang)
      || a.data.slug.localeCompare(b.data.slug));
}

/** Estimate mixed Chinese/English reading time without a stored, stale counter. */
export function readingMinutes(post: Post): number {
  const text = (post.body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '');
  const characters = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const words = text.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(characters / 400 + words / 220));
}
