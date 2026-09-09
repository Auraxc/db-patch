# DB PATCH 静态博客

基于 Astro 生成 HTML，文章使用 Markdown。延续已确认的青空原型，包含中英文、按标签订阅的全文 RSS、站内搜索和跟随系统的日夜主题。部署产物是 `site/dist/`，没有 Worker、数据库或后端服务。现有项目根目录的 CLI 与 `designs/` 原型保留，新网站在 `site/` 内独立运行。

正式域名：<https://db-patch.com>。已有 Cloudflare Pages 地址：<https://db-patch.pages.dev/>。GitHub 仓库：<https://github.com/Auraxc/db-patch>（SSH：`git@github.com:Auraxc/db-patch.git`）。仓库和 Pages 信息已用于配置说明，本次实现没有推送代码、部署或修改 DNS；仅将域名托管到 Cloudflare，不等于已为 Pages 绑定自定义域名。

当前环境对该仓库的只读 SSH 检查返回 `Permission denied (publickey)`。推送前需为 GitHub 配置正确的 SSH 身份，或由你选择已认证的 HTTPS 方式；这不影响本地开发和构建。

## 本地运行

推荐 Node.js 24；先进入项目的 `site/` 目录：

```sh
npm ci
npm run dev
```

打开终端提示的 <http://localhost:4321/>。`dev` 显示 12 篇演示文章（6 组中英文），演示文章标记 `sample: true`。草稿和未来日期的文章仍不会公开显示。中文与英文是独立静态路径：`/` 和 `/en/`，不是依赖浏览器脚本替换文字。

```sh
npm test
npm run build
npm run preview
```

`build` 依次进行类型检查、Astro 静态构建、安全头生成、产物校验。生产构建默认排除 `sample: true`、`draft: true` 和日期晚于上海当日的文章，因此首次正式构建会显示真实的空状态，不把样例当作你的已发表文章。

要检查完整样式和所有样例的静态输出：

```sh
npm run build:demo
npm run preview
```

演示构建会给所有 HTML 加 `noindex`，使用 `X-Robots-Tag`、禁止爬取的 `robots.txt`，并清空 sitemap 中的 URL。**演示构建不用于正式发布**。再次运行 `npm run build` 会生成正式产物。不要在生产环境设置 `DBPATCH_INCLUDE_DEMOS=true`。`preview` 是本地查看工具，不会应用 Cloudflare `_headers`；这些响应头在 Pages 托管后生效。

## 用 Markdown 写文章

```sh
npm run new -- --lang zh --slug postgres-vacuum --title "理解 PostgreSQL VACUUM"
npm run new -- --lang en --slug postgres-vacuum --title "Understanding PostgreSQL VACUUM" --translation-key postgres-vacuum
```

生成位置是 `src/content/posts/zh/` 或 `src/content/posts/en/`。脚本默认使用上海当天日期，可用 `--date 2026-09-09` 指定日期以得到可复现模板。它拒绝非法路径和覆盖已有文件，新文章默认 `draft: true`。

```yaml
---
title: "理解 PostgreSQL VACUUM"
date: "2026-09-09"
excerpt: "说明 VACUUM 的作用、排查方式与操作边界。"
slug: "postgres-vacuum"
translationKey: "postgres-vacuum"
lang: zh
tags:
  - postgresql
  - operations
draft: true
sample: false
featured: false
---

## 问题背景

在这里写正文。
```

日期请保留引号。可选字段有 `updated`（不早于 `date`）、`category`、`context`。两种语言用相同 `translationKey` 建立对应关系，`slug` 可以相同，也可以各自不同；同一语言内 slug 和 translationKey 均不能重复。未提供翻译的文章不会伪装成已翻译页面，也不会把中文正文塞进英文 RSS。

当前标签 ID 为 `postgresql`、`operations`、`backend`、`ai`、`query-optimization`、`notes`。URL 使用稳定 ID，界面和 RSS 分类名按语言显示。增加标签时更新 `src/lib/i18n.ts` 与校验脚本中的标签映射；内容校验自动读取同一份标签配置。

文章写完后将 `draft` 改为 `false`，确认 `sample: false`，运行生产构建检查。日期不能晚于当前上海日期；未来文章只有在日期到达后的下一次构建才会出现，本项目不会自行定时发布。草稿不会出现在本地公开路由中，编辑阶段可直接使用 Markdown 预览；要在本地页面检查，可暂时设为 `draft: false`，但不要把尚未准备好的版本提交到发布分支。

代码使用围栏代码块并注明语言，例如 `sql`。图片放在 `public/images/`，正文引用 `/images/文件名.png`，这样页面与 RSS 都能得到可用链接。不要把凭据、数据库连接串、私人数据或不应公开的运维细节放进仓库。Markdown 不允许执行原始 HTML、脚本或 MDX；站点安全策略也禁止第三方脚本。

## 个人信息与订阅

在 `src/config.ts` 填写真实简介、署名和公开平台地址。`platforms` 为空时不显示占位账号；公众号需要同时填写名称和本地二维码图片。只配置你确认过的链接，不自动生成社交账号。

RSS 均为构建生成的完整静态 XML，并与页面、搜索使用相同发布过滤规则：

| 订阅范围 | 中文 | English |
| --- | --- | --- |
| 全站 | `/rss.xml` | `/en/rss.xml` |
| PostgreSQL | `/tags/postgresql/rss.xml` | `/en/tags/postgresql/rss.xml` |
| 其他标签 | `/tags/<id>/rss.xml` | `/en/tags/<id>/rss.xml` |

在 `/subscribe/` 或 `/en/subscribe/` 选择语言和标签即可获取订阅地址。每篇文章的 HTML、RSS 正文、标签归档都不依赖 JavaScript；JS 只增强搜索、主题、代码复制等交互。搜索索引是公开的静态 JSON，不能用于保存私密内容。

主题默认跟随操作系统，手动选择日间/夜间后保存在本地浏览器；选择“跟随系统”即可恢复自动模式。没有分析追踪脚本、广告脚本或必须同意才能阅读的弹窗。

## GitHub Actions 与 Cloudflare Pages

工作流在仓库根目录 `.github/workflows/site.yml`：PR 和 `main` 提交都会安装锁定依赖、运行测试、构建并上传 `db-patch-site` 产物。只在 **push 到 main** 且配置了 Pages 项目变量时进入部署阶段；PR 和手动运行不会部署。没有 Cloudflare 配置时只构建，不创建任何远端资源。

请确认已有 `db-patch` Pages 项目，并选择一种发布方式。此项目提供的是 **GitHub Actions 构建 + Wrangler 上传静态产物**：不要同时启用同一分支的 Cloudflare Git 自动构建，以免重复发布。若已有 Pages Git 集成，可先检查并关闭其自动生产部署；不需要删除项目。手动直传项目也可使用当前工作流。

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 | 内容 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 对目标 Cloudflare 账户具有 **Cloudflare Pages: Edit** 权限的 API Token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | 该 Pages 项目所属的账户 ID |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | 现有项目名，预计为 `db-patch`；请在控制台确认 |

Token 的账户范围仅选择目标账户，不需要全局 API Key，也不需要 DNS 编辑权限。不要把 Token 发到聊天、写入 `.env.example` 或提交到 Git。生产凭据只传入部署步骤；PR 构建没有接触凭据的步骤。

建议在 **Settings → Environments → production** 开启所需审批和部署分支限制，仅允许 `main`，并可把两个 Secret 放在该环境中。缺少 Secret 时工作流会明确提示跳过部署，构建产物仍保留 14 天。Pages 项目名不存在时部署应失败，请先确认已有项目，不要依赖命令自动创建资源。

Cloudflare 控制台中打开 **Workers & Pages → db-patch → Custom domains**，检查 `db-patch.com` 是否已添加并显示有效；按控制台引导完成域名验证/绑定。若也使用 `www.db-patch.com`，为同一项目添加该域名后，生成的 `_redirects` 会以 301 跳转到主域。项目仅提供此必要重定向，没有会把未知地址伪装成正常页的 SPA fallback；真实 404 使用 `404.html`。本次未执行这些在线操作。

Pages 应托管的是 `site/dist/` 的内容，不是源代码或仓库根目录。所有 canonical、hreflang、RSS、sitemap 都使用 `https://db-patch.com`。若仅在 `pages.dev` 检查站点，它仍声明正式域名为规范地址。正式上线前确认样例未出现、语言切换/标签订阅可用，并在浏览器网络面板检查 CSP 安全头。

## 校验与安全边界

`scripts/verify.mjs` 校验所有静态页面/资源链接、文章无 JS 可读、规范地址和双向 hreflang、全文 RSS XML 语法、语言和标签隔离、搜索/文章/RSS 一致性以及原型地址残留。构建后 `scripts/finalize.mjs` 生成安全响应头，只允许本站脚本；必要的可执行内联脚本由实际 HTML 计算 SHA-256 授权，样式为了代码高亮允许内联，但不允许脚本 `unsafe-inline` 或 `unsafe-eval`。

网站不加载外部字体或第三方脚本。图片允许 HTTPS 来源，建议优先使用自己的本地静态图片。HTML 静态化和 CSP 不能替代内容审查、依赖更新、GitHub/Cloudflare 账号 MFA、最小权限 Token 与适当的仓库分支保护。
