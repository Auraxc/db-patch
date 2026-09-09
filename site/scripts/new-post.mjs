import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contentRoot = fileURLToPath(new URL('../src/content/posts/', import.meta.url));
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const usage = 'npm run new -- --lang zh --slug postgres-notes --title "PostgreSQL 实践笔记" [--translation-key postgres-notes] [--date YYYY-MM-DD]';

export function shanghaiDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseArguments(argv) {
  const options = {};
  const names = new Set(['lang', 'slug', 'title', 'translation-key', 'date']);
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--help' || argv[index] === '-h') return { help: true };
    const name = argv[index].replace(/^--/, '');
    if (!argv[index].startsWith('--') || !names.has(name)) throw new Error(`Unknown argument: ${argv[index]}`);
    const key = name === 'translation-key' ? 'translationKey' : name;
    if (key in options) throw new Error(`Duplicate argument: --${name}`);
    const value = argv[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[key] = value;
  }
  return options;
}

export function draftSource(options, now = new Date()) {
  const { lang, slug } = options;
  if (!['zh', 'en'].includes(lang)) throw new Error('--lang must be zh or en.');
  if (typeof slug !== 'string' || !slugPattern.test(slug) || slug.length > 100) {
    throw new Error('--slug must contain only lowercase letters, numbers, and single hyphens (maximum 100 characters).');
  }
  const title = options.title?.trim();
  if (!title || title.length > 200 || /[\r\n\u0000-\u001f]/.test(title)) throw new Error('--title must be one nonempty line (maximum 200 characters).');
  const translationKey = options.translationKey?.trim() || slug;
  if (translationKey.length > 160 || /[\u0000-\u001f]/.test(translationKey)) throw new Error('--translation-key must be a nonempty single-line identifier.');
  const date = options.date ?? shanghaiDate(now);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error('--date must be a real calendar date in YYYY-MM-DD format.');
  }
  const en = lang === 'en';
  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `date: ${JSON.stringify(date)}`,
    `excerpt: ${JSON.stringify(en ? 'Describe the problem and what readers will learn.' : '简述要解决的问题，以及读者会获得什么。')}`,
    `slug: ${JSON.stringify(slug)}`,
    `translationKey: ${JSON.stringify(translationKey)}`,
    `lang: ${lang}`,
    'tags:',
    '  - notes',
    'draft: true',
    'sample: false',
    'featured: false',
    '---',
    '',
    `## ${en ? 'Context' : '背景'}`,
    '',
    en ? 'Describe the environment, relevant versions, and the problem.' : '说明环境、相关版本与实际遇到的问题。',
    '',
    `## ${en ? 'Investigation' : '排查过程'}`,
    '',
    en ? 'Document the evidence and reproducible steps. Remove credentials and private data.' : '记录证据与可复现的步骤。不要写入凭据或私人数据。',
    '',
    `## ${en ? 'Conclusion' : '结论'}`,
    '',
    en ? 'Explain what worked, the limitations, and how to verify the outcome.' : '说明结果、适用边界，以及验证方法。',
    '',
  ].join('\n');
}

export async function createDraft(options, root = contentRoot, now = new Date()) {
  const source = draftSource(options, now);
  const resolvedRoot = path.resolve(root);
  const directory = path.join(resolvedRoot, options.lang);
  await mkdir(directory, { recursive: true });
  const [actualRoot, actualDirectory] = await Promise.all([realpath(resolvedRoot), realpath(directory)]);
  if (actualDirectory !== path.join(actualRoot, options.lang)) throw new Error('Language directory must not redirect outside the content tree.');
  const filename = path.join(directory, `${options.slug}.md`);
  try {
    await writeFile(filename, source, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Refusing to overwrite an existing article: ${filename}`);
    throw error;
  }
  return filename;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log(usage);
    else console.log(`Created draft: ${await createDraft(options)}\nSet draft: false only when ready to publish.`);
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exitCode = 1;
  }
}
