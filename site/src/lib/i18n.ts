export const locales = ['zh', 'en'] as const;
export type Locale = typeof locales[number];
export const tags = [
  { id: 'postgresql', zh: 'PostgreSQL', en: 'PostgreSQL', icon: 'database', descriptionZh: '从执行计划到数据，理解数据库。', descriptionEn: 'Understanding the database through execution plans and data.' },
  { id: 'operations', zh: '数据库运维', en: 'Database operations', icon: 'patch', descriptionZh: '备份、恢复、复制与日常运维。', descriptionEn: 'Backups, recovery, replication, and reliable daily operations.' },
  { id: 'backend', zh: '后端', en: 'Backend', icon: 'code', descriptionZh: '从接口到存储，关注行为与边界。', descriptionEn: 'Behavior and boundaries, from APIs to storage.' },
  { id: 'ai', zh: 'AI', en: 'AI', icon: 'spark', descriptionZh: '试用新工具，也验证它的边界。', descriptionEn: 'Trying new tools and checking their limits.' },
  { id: 'query-optimization', zh: '查询优化', en: 'Query optimization', icon: 'search', descriptionZh: '顺着证据，找到查询瓶颈。', descriptionEn: 'Following the evidence to find query bottlenecks.' },
  { id: 'notes', zh: '随记', en: 'Field notes', icon: 'book', descriptionZh: '记录观察、思考和值得保存的片段。', descriptionEn: 'Observations, notes, and things worth keeping.' },
] as const;
export function text(locale: Locale, zh: string, en: string) { return locale === 'en' ? en : zh; }
export function pathFor(locale: Locale, segment = '') {
  const path = segment.replace(/^\/+|\/+$/g, '');
  return `${locale === 'en' ? '/en/' : '/'}${path ? `${path}/` : ''}`;
}
export function postUrl(post: { data: { lang: Locale; slug: string } }) { return pathFor(post.data.lang, `posts/${post.data.slug}`); }
export function feedUrl(locale: Locale, tag?: string) { return `${pathFor(locale, tag ? `tags/${tag}` : '')}rss.xml`; }
export function tagName(id: string, locale: Locale) { return tags.find(tag => tag.id === id)?.[locale] ?? id; }
