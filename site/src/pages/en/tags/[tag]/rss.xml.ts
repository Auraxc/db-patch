import type { APIRoute, GetStaticPaths } from 'astro';
import { tags } from '../../../../lib/i18n';
import { createFeed } from '../../../../lib/rss';

export const prerender = true;
export const getStaticPaths = (() => tags.map((tag) => ({ params: { tag: tag.id } }))) satisfies GetStaticPaths;
export const GET: APIRoute = ({ params }) => createFeed('en', params.tag);
