# DB PATCH

DB PATCH 是一个以 PostgreSQL、数据库运维、后端和 AI 为主题的双语静态博客。

- 正式域名：<https://db-patch.com>
- Cloudflare Pages：<https://db-patch.pages.dev>
- 技术栈：Astro、Markdown、GitHub Actions、Cloudflare Pages

网站源码在 [`site/`](site/)；完整的写作、构建和发布说明见 [`site/README.md`](site/README.md)。

```bash
cd site
npm ci
npm run dev
```

生产构建使用 `npm run build`，静态产物位于 `site/dist/`。示例文章、草稿与未来日期文章不会进入生产构建。
