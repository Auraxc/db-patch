import type { APIRoute } from 'astro';
import { createFeed } from '../../lib/rss';

export const prerender = true;
export const GET: APIRoute = () => createFeed('en');
