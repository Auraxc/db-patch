import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { tags } from './lib/i18n';

const tagIds = new Set<string>(tags.map(tag => tag.id));

const dateString = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a quoted date in YYYY-MM-DD format.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Use a real calendar date.');

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/posts',
    // Astro otherwise promotes frontmatter.slug to a globally unique entry ID.
    // Use the language-bearing file path so both translations remain in the store.
    generateId: ({ entry, data }) => {
      const filename = entry.replaceAll('\\', '/');
      const locale = filename.split('/')[0];
      if (!['zh', 'en'].includes(locale) || data.lang !== locale) {
        throw new Error(`Post ${filename} must live under zh/ or en/ and its lang must match that directory.`);
      }
      return filename.replace(/\.md$/i, '');
    },
  }),
  schema: z.object({
    title: z.string().trim().min(1),
    date: dateString,
    updated: dateString.optional(),
    excerpt: z.string().trim().min(1),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.'),
    translationKey: z.string().trim().min(1),
    lang: z.enum(['zh', 'en']),
    tags: z.array(z.string().refine((id) => tagIds.has(id), 'Use a configured tag ID.'))
      .min(1)
      .refine((values) => new Set(values).size === values.length, 'Do not repeat a tag.'),
    draft: z.boolean().default(true),
    sample: z.boolean().default(false),
    featured: z.boolean().default(false),
    category: z.string().trim().min(1).optional(),
    context: z.string().trim().min(1).optional(),
  }).strict().refine((post) => !post.updated || post.updated >= post.date, {
    message: 'The update date cannot precede the publication date.',
    path: ['updated'],
  }),
});

export const collections = { posts };
