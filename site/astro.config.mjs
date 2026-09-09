import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { remarkSafeContent } from './scripts/markdown-safety.mjs';

export default defineConfig({
  site: 'https://db-patch.com',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    processor: unified({ remarkPlugins: [remarkSafeContent] }),
    shikiConfig: { theme: 'github-dark' },
  },
});
