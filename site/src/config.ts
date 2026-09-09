/** Edit only verified public information here. Empty platform links are not displayed. */
export const siteConfig = {
  url: 'https://db-patch.com',
  name: 'DB PATCH',
  description: {
    zh: '记录 PostgreSQL、数据库运维、后端工程与 AI 实践的个人技术空间。',
    en: 'Personal notes on PostgreSQL, database operations, backend engineering, and practical AI.',
  },
  author: {
    name: 'DB PATCH',
    role: { zh: '数据库运维 / 后端开发', en: 'Database operations / Backend' },
  },
  platforms: [] as Array<{
    name: string;
    url: string;
    group: 'code' | 'writing' | 'contact';
    icon?: string;
  }>,
  // Add a local image path and the public account name to show WeChat.
  wechat: { name: '', qrImage: '' },
};
